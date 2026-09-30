import { buildCard } from './exercise';
import { REINSERCION_MAX, REINSERCION_MIN, intercalar } from './cola';
import { review, gradeFrom, newCardState } from './sm2';
import { conteo } from '@/utils/text';
import { addDays, startOfDay } from '@/utils/date';
import type {
  AnswerResult,
  CardState,
  Entry,
  Grade,
  SessionSummary,
  StudyCard,
} from '@/types';

/**
 * La sesión de estudio como máquina de estados pura.
 *
 * No toca la base ni React: recibe las tarjetas, procesa respuestas y
 * dice cuál va. Así se puede probar sin emulador y la pantalla queda
 * como una vista tonta encima.
 */

export interface SessionInput {
  due: { entry: Entry; state: CardState }[];
  fresh: { entry: Entry; state: CardState }[];
  distractorsFor: (entry: Entry) => string[];
  /**
   * Palabras señuelo en inglés para el ejercicio Construir.
   * Es opcional a propósito: sin ella la sesión sigue funcionando y
   * Construir simplemente sale sin fichas de sobra.
   */
  wordDecoysFor?: (entry: Entry) => string[];
  meta: number;
  /**
   * Cuántas veces puede volver a salir, en esta sesión, una tarjeta FALLADA.
   * 0 = nunca vuelve. Las acertadas no vuelven, estén o no en aprendizaje.
   */
  maxReinserciones?: number;
  /** Azar para elegir a cuántas tarjetas vuelve (3 a 5) y para intercalar. Se inyecta en las pruebas. */
  azar?: () => number;
  /**
   * Vencidas en orden al azar y nuevas repartidas entre ellas (ver `intercalar`), en vez de todas
   * las vencidas y luego las nuevas. Estudiar lo usa siempre; sin él, el orden de siempre.
   */
  intercalar?: boolean;
}

export interface PendingCard {
  card: StudyCard;
  /** Cuándo puede volver a mostrarse, en ms epoch. */
  readyAt: number;
}

export class StudySession {
  private queue: PendingCard[] = [];
  private readonly startedAt: number;
  private answered = 0;
  private correct = 0;
  private newSeen = new Set<number>();
  private missed = new Map<number, Entry>();
  private readonly meta: number;
  /** Cuántas tarjetas trae la sesión. Arranca fijo y solo sube con cada reinserción. */
  private total = 0;
  private readonly distractorsFor: (e: Entry) => string[];
  private readonly wordDecoysFor: (e: Entry) => string[];
  /** Aciertos seguidos dentro de esta sesión. No se guarda en la base. */
  private combo = 0;
  private mejorCombo = 0;
  private readonly maxReinserciones: number;
  private readonly azar: () => number;
  /** Cuántas veces se reinsertó cada tarjeta en esta sesión. */
  private reinsertadas = new Map<number, number>();
  private reinserciones = 0;
  /** Las que entraron como nuevas; solo cuentan como vistas si se responden. */
  private freshIds = new Set<number>();
  /** Las nuevas que llegaron a mostrarse (fueron la tarjeta actual). */
  private mostradas = new Set<number>();

  constructor(input: SessionInput, now: number = Date.now()) {
    this.startedAt = now;
    this.meta = input.meta;
    this.maxReinserciones = input.maxReinserciones ?? 0;
    this.azar = input.azar ?? Math.random;
    this.distractorsFor = input.distractorsFor;
    this.wordDecoysFor = input.wordDecoysFor ?? (() => []);

    // Una frase no viene dos veces en la lista inicial, aunque esté en las
    // dos. Dentro de la sesión tampoco se repite, con una sola excepción: la
    // FALLADA vuelve una vez, 3 a 5 tarjetas después, para corregir el error
    // en fresco. Las acertadas, incluso las que SM-2 deja en aprendizaje, no
    // vuelven: se programan para mañana, que es donde de verdad sirven.
    // Ver la misma tarjeta dos veces en tres minutos es lo que hacía sentir
    // la práctica interminable, y reinsertar también los pasos de aprendizaje
    // llevaba una sesión de 20 a 40 o 55 respuestas.
    const vistas = new Set<number>();

    const dueCards = input.due
      .filter((d) => !vistas.has(d.entry.id) && vistas.add(d.entry.id))
      .map((d) => this.make(d.entry, d.state, false, now));

    const freshCards = input.fresh
      .filter((d) => !vistas.has(d.entry.id) && vistas.add(d.entry.id))
      .map((d) => {
        this.freshIds.add(d.entry.id);
        return this.make(
          d.entry,
          d.state ?? newCardState(d.entry.id),
          false,
          now
        );
      });

    // Primero las vencidas (ya vienen de la más atrasada a la menos), luego
    // las nuevas. La cola se recorta a la meta; el total arranca fijo y solo
    // crece con cada reinserción, para que la barra siempre llegue al final.
    this.queue = (input.intercalar ? intercalar(dueCards, freshCards, this.azar) : [...dueCards, ...freshCards]).slice(
      0,
      input.meta
    );
    this.total = this.queue.length;
  }

  private make(
    entry: Entry,
    state: CardState,
    isRelearn: boolean,
    readyAt: number
  ): PendingCard {
    return {
      card: buildCard(
        entry,
        state,
        this.distractorsFor(entry),
        isRelearn,
        this.wordDecoysFor(entry)
      ),
      readyAt,
    };
  }

  /** La tarjeta que toca, o null si la sesión terminó. */
  current(now: number = Date.now()): StudyCard | null {
    if (this.queue.length === 0) return null;
    const ready = this.queue.find((p) => p.readyAt <= now);
    // Si ninguna está lista pero quedan, se adelanta la más próxima:
    // hacer esperar al usuario mirando una pantalla vacía es peor que
    // mostrarle la tarjeta un minuto antes de lo ideal.
    const next = ready ?? this.queue[0];
    if (next && this.freshIds.has(next.card.entry.id)) this.mostradas.add(next.card.entry.id);
    return next?.card ?? null;
  }

  /**
   * Las nuevas que se mostraron y no se contestaron (se saltaron o se salió antes). La próxima
   * sesión las evita mientras haya otras, para no ver las mismas frases al volver a entrar.
   */
  nuevasSinContestar(): number[] {
    return [...this.mostradas].filter((id) => !this.newSeen.has(id));
  }

  get remaining(): number {
    return this.queue.length;
  }

  get progress(): { done: number; goal: number } {
    // El total no depende de cuánto se ha respondido. Antes sí, y por eso
    // la barra nunca terminaba de llenarse.
    return { done: this.answered, goal: this.total };
  }

  /** ¿Ya no quedan tarjetas? Es el único criterio de fin. */
  get terminada(): boolean {
    return this.queue.length === 0;
  }

  /** Aciertos seguidos ahora mismo. Vive solo mientras dura la sesión. */
  get seguidas(): number {
    return this.combo;
  }

  /**
   * Procesa una respuesta. Devuelve el estado nuevo para persistirlo.
   *
   * `requeue` es lo que pide SM-2 (también para las acertadas en aprendizaje) y
   * `reinsertada` lo que de verdad hizo la sesión: solo la fallada vuelve, y una
   * sola vez. Lo que se le dice al usuario ("vuelve en esta sesión") sale de esta.
   */
  answer(
    result: AnswerResult,
    now: number = Date.now()
  ): { state: CardState; grade: Grade; requeue: boolean; reinsertada: boolean } | null {
    const idx = this.queue.findIndex((p) => p.readyAt <= now);
    const pos = idx >= 0 ? idx : 0;
    const pending = this.queue[pos];
    if (!pending) return null;

    const grade = result.grade;
    const sm2 = review(pending.card.state, grade, now);
    const { requeue } = sm2;
    let state = sm2.state;
    // Una acertada que SM-2 deja en un paso de aprendizaje (intervalo 0, «vuelve en 1 o 10 min»)
    // no vuelve en esta sesión: solo las falladas se reinsertan. Se programa para mañana con
    // intervalo 1, que es cuando de verdad la vuelve a ver, en vez de quedar con intervalo 0. SM-2
    // no cambia: `repeticiones` y `facilidad` siguen igual, así que la frase gradúa al mismo paso.
    if (grade !== 1 && state.intervalo === 0) {
      state = { ...state, intervalo: 1, vence_en: startOfDay(addDays(now, 1)) };
    }

    this.answered++;
    if (this.freshIds.has(pending.card.entry.id)) this.newSeen.add(pending.card.entry.id);
    if (result.correct) {
      this.correct++;
      this.combo++;
      if (this.combo > this.mejorCombo) this.mejorCombo = this.combo;
      this.missed.delete(pending.card.entry.id);
    } else {
      // El contador de seguidas se cae y no se menciona nunca más:
      // es un gusto pequeño mientras dura, no una deuda.
      this.combo = 0;
      this.missed.set(pending.card.entry.id, pending.card.entry);
    }

    this.queue.splice(pos, 1);

    // Solo la fallada (grado 1) vuelve, entre 3 y 5 tarjetas después y no más
    // de `maxReinserciones` veces por sesión. `requeue` de SM-2 también pide
    // volver a las acertadas en aprendizaje; eso no se respeta en la sesión:
    // SM-2 ya las dejó programadas para mañana.
    const id = pending.card.entry.id;
    const veces = this.reinsertadas.get(id) ?? 0;
    const reinsertada = grade === 1 && veces < this.maxReinserciones;
    if (reinsertada) {
      this.reinsertadas.set(id, veces + 1);
      this.reinserciones++;
      this.total++;
      const salto = REINSERCION_MIN + Math.floor(this.azar() * (REINSERCION_MAX - REINSERCION_MIN + 1));
      this.queue.splice(Math.min(this.queue.length, salto), 0, this.make(pending.card.entry, state, true, now));
    }

    return { state, grade, requeue, reinsertada };
  }

  /**
   * Salta la tarjeta sin calificarla. Se va de la sesión y no vuelve.
   * Antes la mandaba al final, y eso era otra forma de repetir.
   */
  skip(now: number = Date.now()): void {
    const idx = this.queue.findIndex((p) => p.readyAt <= now);
    const pos = idx >= 0 ? idx : 0;
    if (!this.queue[pos]) return;
    this.queue.splice(pos, 1);
  }

  /** Cuántas tarjetas se reinsertaron en esta sesión. Solo lectura. */
  get totalReinserciones(): number {
    return this.reinserciones;
  }

  /** Aciertos acumulados en la sesion. Solo lectura. */
  get aciertos(): number {
    return this.correct;
  }

  summary(streak: number, now: number = Date.now()): SessionSummary {
    return {
      correct: this.correct,
      total: this.answered,
      newCards: this.newSeen.size,
      streak,
      missed: [...this.missed.values()],
      durationMs: now - this.startedAt,
      mejorRacha: this.mejorCombo,
    };
  }
}

export { gradeFrom };

/**
 * ¿La sesión merece celebración? La misma regla que las partidas (`GameEndScreen`):
 * al menos 5 respuestas y 70% de aciertos. Una sesión corta o floja termina sin
 * fiesta, y sin regaño tampoco.
 */
export function sesionMerece(aciertos: number, total: number): boolean {
  return total >= 5 && aciertos / total >= 0.7;
}

/**
 * Lo que se le dice al usuario de cuándo vuelve la tarjeta que acaba de responder.
 *
 * «Vuelve en esta sesión» solo si la sesión de verdad la reinsertó. Un intervalo de 0
 * días también sale de un acierto en paso de aprendizaje (1 o 10 minutos), y esa no
 * vuelve en esta sesión: se ve en la siguiente vuelta.
 */
export function etiquetaRepaso(intervalo: number, reinsertada: boolean): string {
  if (reinsertada) return 'Vuelve en esta sesión';
  if (intervalo <= 0) return 'La vuelves a ver pronto';
  if (intervalo === 1) return 'La vuelves a ver mañana';
  if (intervalo < 7) return `La vuelves a ver en ${conteo(intervalo, 'día')}`;
  if (intervalo < 30) return `La vuelves a ver en ${conteo(Math.round(intervalo / 7), 'semana')}`;
  return `La vuelves a ver en ${conteo(Math.round(intervalo / 30), 'mes', 'meses')}`;
}
