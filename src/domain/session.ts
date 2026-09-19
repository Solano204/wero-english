import { buildCard } from './exercise';
import { review, gradeFrom, newCardState } from './sm2';
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
  /** Cuántas tarjetas trae la sesión. Se fija al construirla y no cambia. */
  private total = 0;
  private readonly distractorsFor: (e: Entry) => string[];
  private readonly wordDecoysFor: (e: Entry) => string[];
  /** Aciertos seguidos dentro de esta sesión. No se guarda en la base. */
  private combo = 0;
  private mejorCombo = 0;

  constructor(input: SessionInput, now: number = Date.now()) {
    this.startedAt = now;
    this.meta = input.meta;
    this.distractorsFor = input.distractorsFor;
    this.wordDecoysFor = input.wordDecoysFor ?? (() => []);

    // Una frase no se repite NUNCA dentro de una sesión. Ni porque
    // venga en las dos listas, ni porque se falle. Ver la misma tarjeta
    // dos veces en tres minutos es lo que hacía sentir la práctica
    // interminable, y es peor que no volver a verla: la vuelve a sacar
    // el algoritmo mañana, que es donde de verdad sirve.
    const vistas = new Set<number>();

    const dueCards = input.due
      .filter((d) => !vistas.has(d.entry.id) && vistas.add(d.entry.id))
      .map((d) => this.make(d.entry, d.state, false, now));

    const freshCards = input.fresh
      .filter((d) => !vistas.has(d.entry.id) && vistas.add(d.entry.id))
      .map((d) => {
        this.newSeen.add(d.entry.id);
        return this.make(
          d.entry,
          d.state ?? newCardState(d.entry.id),
          false,
          now
        );
      });

    // La cola se recorta a la meta y ya no crece. El total queda fijo
    // desde el segundo cero: por eso la barra llega al final siempre.
    this.queue = interleave(dueCards, freshCards, 4).slice(0, input.meta);
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
    return next?.card ?? null;
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
   * Procesa una respuesta. Devuelve el estado nuevo para persistirlo y
   * si la tarjeta vuelve en esta sesión.
   */
  answer(
    result: AnswerResult,
    now: number = Date.now()
  ): { state: CardState; grade: Grade; requeue: boolean } | null {
    const idx = this.queue.findIndex((p) => p.readyAt <= now);
    const pos = idx >= 0 ? idx : 0;
    const pending = this.queue[pos];
    if (!pending) return null;

    const grade = result.grade;
    const { state, requeue } = review(
      pending.card.state,
      grade,
      now
    );

    this.answered++;
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

    // La tarjeta sale y no vuelve. `requeue` se sigue devolviendo porque
    // SM-2 lo usa para programar el repaso de mañana, pero ya no se
    // reinserta en esta sesión.
    this.queue.splice(pos, 1);

    return { state, grade, requeue };
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
 * Intercala b dentro de a insertando uno de b cada `every` de a.
 * Con every=4: A A A A B A A A A B ...
 */
function interleave<T>(a: T[], b: T[], every: number): T[] {
  if (b.length === 0) return [...a];
  if (a.length === 0) return [...b];

  const out: T[] = [];
  let bi = 0;
  for (let i = 0; i < a.length; i++) {
    out.push(a[i] as T);
    if ((i + 1) % every === 0 && bi < b.length) {
      out.push(b[bi++] as T);
    }
  }
  while (bi < b.length) out.push(b[bi++] as T);
  return out;
}
