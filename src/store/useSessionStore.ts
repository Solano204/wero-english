import { create } from 'zustand';
import {
  countDue,
  getDistractors,
  getNewCards,
  getSessionCards,
  getWordDecoys,
  upsertCardState,
  type ContentFilter,
} from '@/db/queries';
import { endSession, startSession, touchStreak } from '@/db/progress';
import { StudySession, gradeFrom } from '@/domain/session';
import { newCardState } from '@/domain/sm2';
import type { SessionSummary, StudyCard } from '@/types';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';

type Phase = 'idle' | 'loading' | 'active' | 'finished' | 'empty';

/** Lo que la pantalla necesita saber después de responder. */
export interface Feedback {
  correct: boolean;
  answer: string;
  nota: string | null;
  nextLabel: string;
}

interface SessionState {
  phase: Phase;
  card: StudyCard | null;
  feedback: Feedback | null;
  summary: SessionSummary | null;
  done: number;
  goal: number;
  remaining: number;
  dueCount: number;
  /** Aciertos seguidos dentro de la sesión. Muere al terminarla. */
  seguidas: number;
  /**
   * Aciertos totales de la sesión, no seguidos.
   *
   * `seguidas` se cae al primer fallo y eso está bien para una racha,
   * pero deja al usuario sin ningún número que solo suba. Este sube y no
   * baja: es lo que hace que fallar no borre lo que ya hiciste.
   */
  aciertos: number;
  /** Un salto o un continuar ya está en curso: ignora toques extra. */
  avanzando: boolean;

  refreshCounts: (usuarioId: number, filter: ContentFilter) => Promise<void>;
  start: (
    usuarioId: number,
    filter: ContentFilter,
    meta: number,
    nuevas: number
  ) => Promise<void>;
  answer: (
    usuarioId: number,
    correct: boolean,
    elapsedMs: number,
    usedHint: boolean
  ) => Promise<void>;
  next: () => void;
  skip: () => void;
  finish: (usuarioId: number) => Promise<void>;
  reset: () => void;
}

/* La instancia de la sesión vive fuera del store: es un objeto mutable
   y meterlo en el estado de zustand haría que cada respuesta clonara
   toda la cola. Con 60 tarjetas eso se nota en dispositivos lentos. */
let engine: StudySession | null = null;
let sesionId: number | null = null;
/** Candado de finish(): ver el comentario dentro de la acción. */
let terminandoSesion = false;

/**
 * Ventana en la que se ignoran toques repetidos de "Saltar"/"Siguiente".
 * Corta a propósito: que se sienta ágil, no un candado de un segundo.
 */
const AVANZAR_COOLDOWN_MS = 400;
let avanzarTimer: ReturnType<typeof setTimeout> | null = null;

function limpiarAvanzarTimer(): void {
  if (avanzarTimer) {
    clearTimeout(avanzarTimer);
    avanzarTimer = null;
  }
}

export const useSessionStore = create<SessionState>((set, get) => {
  /**
   * Marca que se está avanzando de tarjeta y lo sostiene por
   * AVANZAR_COOLDOWN_MS. Mientras dure, skip()/next() ignoran toques
   * extra y el botón "Saltar" (y "Siguiente" de FeedbackBand) se pueden
   * deshabilitar leyendo este mismo valor del store.
   */
  function marcarAvanzando(): void {
    set({ avanzando: true });
    limpiarAvanzarTimer();
    avanzarTimer = setTimeout(() => {
      set({ avanzando: false });
      avanzarTimer = null;
    }, AVANZAR_COOLDOWN_MS);
  }

  return {
  phase: 'idle',
  card: null,
  feedback: null,
  summary: null,
  done: 0,
  goal: 0,
  remaining: 0,
  dueCount: 0,
  seguidas: 0,
  aciertos: 0,
  avanzando: false,

  refreshCounts: async (usuarioId, filter) => {
    const n = await countDue(usuarioId, filter);
    set({ dueCount: n });
  },

  // `nuevas` se conserva en la firma para no tocar a los cuatro
  // llamadores, pero ya no se usa: sin plan diario no hay reparto entre
  // repaso y contenido nuevo.
  start: async (usuarioId, filter, meta, _nuevas) => {
    set({ phase: 'loading', feedback: null, summary: null });

    // El modo limpio sí se respeta; el nivel ya no. Uno es una decisión
    // del usuario sobre qué quiere ver, el otro era una suposición de la
    // app sobre qué puede.
    const { modoLimpio } = filter;

    /*
     * Se acabó el plan diario.
     *
     * Antes esto pedía primero las vencidas y rellenaba con nuevas: eso
     * era "tus 12 de hoy". Ahora son frases al azar de las 1,524, cada
     * vez que se entra, sin cola y sin deuda.
     *
     * Lo que se conserva es el estado SM-2 de las que ya se vieron. No
     * es contradicción: sirve para que el ejercicio siga escalando
     * (Reconocer la primera vez, Escribir a la sexta) y para que
     * Progreso y la dificultad de las lecturas tengan de dónde salir.
     * Se quitó la planeación, no la memoria.
     */
    const crudas = await getSessionCards(usuarioId, modoLimpio, meta);

    const yaEsta = new Set<number>();
    const due = crudas
      .filter((c) => !yaEsta.has(c.entry.id) && yaEsta.add(c.entry.id))
      // Una entrada sin fila en `tarjeta` llega con state null. Aqui se
      // le da su estado SM-2 inicial: de este punto hacia dentro, `state`
      // siempre existe y nadie mas tiene que comprobarlo.
      .map((c) => ({
        entry: c.entry,
        state: c.state ?? newCardState(c.entry.id),
      }));
    const fresh: typeof due = [];

    if (due.length === 0) {
      set({ phase: 'empty', card: null, remaining: 0 });
      return;
    }

    // Los distractores se precargan de golpe: una consulta por tarjeta
    // en medio de la sesión mete un salto perceptible entre tarjetas.
    const all = [...due, ...fresh];
    const distractorMap = new Map<number, string[]>();
    const wordMap = new Map<number, string[]>();
    await Promise.all(
      all.map(async (c) => {
        distractorMap.set(c.entry.id, await getDistractors(c.entry, 3));
        // Los señuelos de palabra solo hacen falta si la frase es lo
        // bastante larga para que Construir aparezca. Pedirlos para
        // todas duplicaría las consultas del arranque sin necesidad.
        if (c.entry.word_count >= 3) {
          wordMap.set(c.entry.id, await getWordDecoys(c.entry, 3));
        }
      })
    );

    engine = new StudySession({
      due,
      fresh,
      meta,
      distractorsFor: (e) => distractorMap.get(e.id) ?? [],
      wordDecoysFor: (e) => wordMap.get(e.id) ?? [],
    });

    sesionId = await startSession(usuarioId);

    const card = engine.current();
    const p = engine.progress;
    set({
      phase: 'active',
      card,
      done: p.done,
      goal: p.goal,
      remaining: engine.remaining,
      feedback: null,
      seguidas: 0,
      aciertos: 0,
    });
  },

  answer: async (usuarioId, correct, elapsedMs, usedHint) => {
    if (!engine) return;
    const card = get().card;
    if (!card) return;

    const grade = gradeFrom(correct, elapsedMs, usedHint);
    const res = engine.answer({ grade, correct, elapsedMs, usedHint });
    if (!res) return;

    // Antes del await: la celebración visual (StudyScreen.reaccion) se
    // dispara en el mismo tick que esta llamada, así que el sonido tiene
    // que salir aquí también, no después del viaje a SQLite de abajo,
    // o la tarjeta se ve festejando un instante antes de oírse.
    if (correct) {
      haptics.success();
      void audio.playSuccess();
    } else {
      haptics.failure();
      void audio.playFail();
    }

    await upsertCardState(usuarioId, res.state);

    const p = engine.progress;
    set({
      feedback: {
        correct,
        answer: card.answer,
        nota: card.entry.no_usar_cuando,
        nextLabel: labelFor(res.state.intervalo),
      },
      done: p.done,
      goal: p.goal,
      remaining: engine.remaining,
      seguidas: engine.seguidas,
      aciertos: engine.aciertos,
    });
  },

  next: () => {
    // Si ya se está procesando un avance, este toque se ignora: sin
    // esto, tocar "Siguiente" rápido podía disparar dos audios de
    // frase encimados de tarjetas distintas.
    if (!engine || get().avanzando) return;
    marcarAvanzando();
    // Corta lo que esté sonando ANTES de cambiar de tarjeta: si no, el
    // audio automático de la nueva se pone a competir con el de la
    // anterior, que es justo el síntoma reportado.
    audio.stop();
    const card = engine.current();
    if (!card) {
      set({ phase: 'finished', card: null, feedback: null });
      return;
    }
    set({ card, feedback: null, remaining: engine.remaining });
  },

  skip: () => {
    if (!engine || get().avanzando) return;
    marcarAvanzando();
    audio.stop();
    engine.skip();
    set({ card: engine.current(), feedback: null, remaining: engine.remaining });
  },

  finish: async (usuarioId) => {
    // Candado sincrónico: el botón físico de atrás a veces entrega el
    // evento dos veces seguidas antes de que la primera llamada llegue
    // a su primer await. Sin esto, las dos pasan el `if (!engine)` con
    // engine todavía vivo y touchStreak/endSession corren dos veces
    // (sesión contada doble) y `set({ phase: 'finished' })` dispara más
    // de una vez, lo que puede duplicar el goBack() de la pantalla.
    if (terminandoSesion) return;
    terminandoSesion = true;
    try {
      if (!engine) {
        set({ phase: 'finished' });
        return;
      }
      // Se libera aquí, no solo se pausa: se sale de la sesión de
      // estudio, así que no vale la pena seguir cargando el player nativo
      // hasta la próxima.
      audio.releaseAudio();

      const { racha } = await touchStreak(usuarioId);
      const summary = engine.summary(racha);

      if (sesionId !== null) {
        await endSession(sesionId, usuarioId, {
          respuestas: summary.total,
          aciertos: summary.correct,
          nuevas: summary.newCards,
        });
      }

      set({ phase: 'finished', summary, card: null, feedback: null });
      engine = null;
      sesionId = null;
    } finally {
      terminandoSesion = false;
    }
  },

  reset: () => {
    engine = null;
    sesionId = null;
    limpiarAvanzarTimer();
    audio.releaseAudio();
    set({
      phase: 'idle',
      card: null,
      feedback: null,
      summary: null,
      done: 0,
      goal: 0,
      remaining: 0,
      seguidas: 0,
      aciertos: 0,
      avanzando: false,
    });
  },
  };
});

function labelFor(intervalo: number): string {
  if (intervalo === 0) return 'Vuelve en esta sesión';
  if (intervalo === 1) return 'La vuelves a ver mañana';
  if (intervalo < 7) return `La vuelves a ver en ${intervalo} días`;
  if (intervalo < 30) return `La vuelves a ver en ${Math.round(intervalo / 7)} semanas`;
  return `La vuelves a ver en ${Math.round(intervalo / 30)} meses`;
}
