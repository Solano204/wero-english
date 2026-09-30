import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  countDue,
  countNew,
  getProximoRepaso,
  getDistractors,
  getDueCards,
  getNewCards,
  getWordDecoys,
  upsertCardState,
  type ContentFilter,
} from '@/db/queries';
import { endSession, getNuevasHoy, startSession, touchStreak } from '@/db/progress';
import { nuevaSemilla } from '@/db/semilla';
import { MAX_REINSERCIONES, armarSesion, filtroEstudio } from '@/domain/cola';
import { StudySession, etiquetaRepaso, gradeFrom } from '@/domain/session';
import type { SessionSummary, StudyCard } from '@/types';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';

/**
 * `empty`: no hubo nada que armar (sin vencidas ni nuevas); `error`: no se pudo armar la sesión.
 * Ninguna de las dos deja a la pantalla sin qué mostrar: las dos tienen su estado final.
 */
type Phase = 'idle' | 'loading' | 'active' | 'finished' | 'empty' | 'error';

/** Dónde se guardan, por usuario, las nuevas que la última sesión mostró y no se contestaron. */
const claveSinContestar = (usuarioId: number) => `wero:nuevas-sin-contestar:${usuarioId}`;

async function leerSinContestar(usuarioId: number): Promise<Set<number>> {
  try {
    const crudo = await AsyncStorage.getItem(claveSinContestar(usuarioId));
    const ids = crudo ? (JSON.parse(crudo) as unknown) : [];
    return new Set(Array.isArray(ids) ? ids.filter((x): x is number => typeof x === 'number') : []);
  } catch {
    return new Set();
  }
}

async function guardarSinContestar(usuarioId: number, ids: number[]): Promise<void> {
  try {
    await AsyncStorage.setItem(claveSinContestar(usuarioId), JSON.stringify(ids));
  } catch {
    // Sin esto la próxima sesión solo podría repetir alguna: no vale tumbar el cierre.
  }
}

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
  /** Vencidas que quedaron al terminar la sesión completa. 0 si se salió antes. */
  pendientes: number;
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
  /** Para el estado final: cuándo vuelve el próximo repaso (ms epoch) o null si no hay. */
  proximoRepaso: number | null;
  /** Para el estado final: frases nuevas que quedan en el catálogo con el filtro. */
  nuevasCatalogo: number;
  /** La sesión en curso es la extra de «Aprender frases nuevas» (solo nuevas). */
  soloNuevas: boolean;

  refreshCounts: (usuarioId: number, filter: ContentFilter) => Promise<void>;
  start: (
    usuarioId: number,
    filter: ContentFilter,
    meta: number,
    nuevasPorDia: number,
    opciones?: { soloNuevas?: boolean }
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
/** El filtro con el que arrancó la sesión, para contar lo que queda al terminarla. */
let filtroSesion: ContentFilter | null = null;
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

  /** Lo que dice el estado final: cuándo vuelve el próximo repaso y cuántas nuevas quedan en el catálogo. */
  async function datosDeCierre(
    usuarioId: number,
    filtro: ContentFilter
  ): Promise<{ proximoRepaso: number | null; nuevasCatalogo: number }> {
    try {
      const [proximoRepaso, nuevasCatalogo] = await Promise.all([
        getProximoRepaso(usuarioId, filtro),
        countNew(usuarioId, filtro),
      ]);
      return { proximoRepaso, nuevasCatalogo };
    } catch {
      return { proximoRepaso: null, nuevasCatalogo: 0 };
    }
  }

  /** Arma la sesión y la deja lista (o en `empty`). La llama `start`, que atrapa cualquier error. */
  async function armarYEmpezar(
    usuarioId: number,
    filter: ContentFilter,
    meta: number,
    nuevasPorDia: number,
    soloNuevas: boolean
  ): Promise<void> {
    // El modo limpio sí se respeta; el nivel no (ver filtroEstudio): uno es
    // una decisión del usuario sobre qué quiere ver, el otro era una
    // suposición de la app sobre qué puede.
    const filtro = filtroEstudio(filter);
    filtroSesion = filtro;

    /*
     * La sesión (ver domain/cola.ts): tamaño = meta. Entran las vencidas
     * más atrasadas y nuevas hasta el límite de hoy (hasta 3 lugares se
     * reservan para nuevas aunque la cola sea larga).
     *
     * Cada sesión es distinta: las nuevas salen de un sorteo nuevo (una sal
     * de expo-crypto por sesión, `semillaDeSesion`), se evitan las que la
     * sesión anterior mostró y no se contestaron, y las vencidas van en orden
     * al azar intercaladas con las nuevas.
     *
     * «Aprender frases nuevas» (`soloNuevas`) es una sesión extra: solo
     * nuevas, hasta la meta, aunque ya se haya llegado al límite de hoy.
     */
    const sal = nuevaSemilla();
    const excluir = await leerSinContestar(usuarioId);
    const { due, fresh } = await armarSesion({
      size: meta,
      nuevasPorDia: soloNuevas ? meta : nuevasPorDia,
      yaHoy: soloNuevas ? 0 : await getNuevasHoy(usuarioId),
      traerNuevas: (n) => getNewCards(usuarioId, filtro, n, sal),
      traerVencidas: soloNuevas ? async () => [] : (n) => getDueCards(usuarioId, filtro, n),
      excluir,
      idDe: (c) => c.entry.id,
    });

    if (due.length + fresh.length === 0) {
      set({ phase: 'empty', card: null, remaining: 0, ...(await datosDeCierre(usuarioId, filtro)) });
      return;
    }

    // Los distractores se precargan de golpe: una consulta por tarjeta
    // en medio de la sesión mete un salto perceptible entre tarjetas.
    const all = [...due, ...fresh];
    const distractorMap = new Map<number, string[]>();
    const wordMap = new Map<number, string[]>();

    // Se eligen una tarjeta tras otra con la lista de los que ya salieron en
    // esta sesión: dos tarjetas no comparten opciones falsas mientras haya
    // otras disponibles. Cada elección es barata (el catálogo va en memoria),
    // pero cada 8 se cede el hilo para que la pantalla de carga siga fluida.
    const distractoresUsados = new Set<string>();
    for (let i = 0; i < all.length; i++) {
      const c = all[i];
      if (!c) continue;
      const falsos = await getDistractors(c.entry, 3, distractoresUsados);
      distractorMap.set(c.entry.id, falsos);
      for (const f of falsos) distractoresUsados.add(f);
      if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0));
    }

    // Los señuelos de palabra solo hacen falta si la frase es lo bastante
    // larga para que Construir aparezca. Pedirlos para todas duplicaría las
    // consultas del arranque sin necesidad.
    await Promise.all(
      all
        .filter((c) => c.entry.word_count >= 3)
        .map(async (c) => {
          wordMap.set(c.entry.id, await getWordDecoys(c.entry, 3));
        })
    );

    engine = new StudySession({
      due,
      fresh,
      meta,
      maxReinserciones: MAX_REINSERCIONES,
      intercalar: true,
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
  pendientes: 0,
  seguidas: 0,
  aciertos: 0,
  avanzando: false,
  proximoRepaso: null,
  nuevasCatalogo: 0,
  soloNuevas: false,

  refreshCounts: async (usuarioId, filter) => {
    const n = await countDue(usuarioId, filter);
    set({ dueCount: n });
  },

  // `nuevas` se conserva en la firma para no tocar a los cuatro
  // llamadores, pero ya no se usa: sin plan diario no hay reparto entre
  // repaso y contenido nuevo.
  start: async (usuarioId, filter, meta, nuevasPorDia, opciones) => {
    const soloNuevas = Boolean(opciones?.soloNuevas);
    set({ phase: 'loading', feedback: null, summary: null, pendientes: 0, soloNuevas });
    try {
      await armarYEmpezar(usuarioId, filter, meta, nuevasPorDia, soloNuevas);
    } catch (err) {
      // Sin esto una consulta que falla dejaba la pantalla en «Armando tu sesión» para siempre.
      console.warn('[estudio] no se pudo armar la sesión', err);
      engine = null;
      set({ phase: 'error', card: null, remaining: 0 });
    }
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
        nextLabel: etiquetaRepaso(res.state.intervalo, res.reinsertada),
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
    const card = engine.current();
    // Saltar la última tarjeta también termina la sesión: sin esto quedaba una pantalla vacía.
    if (!card) {
      set({ phase: 'finished', card: null, feedback: null, remaining: 0 });
      return;
    }
    set({ card, feedback: null, remaining: engine.remaining });
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
      const completa = engine.terminada;

      if (sesionId !== null) {
        await endSession(sesionId, usuarioId, {
          respuestas: summary.total,
          aciertos: summary.correct,
          nuevas: summary.newCards,
        });
      }

      // Las nuevas que se vieron y no se contestaron: la próxima sesión las evita (ver armarSesion).
      await guardarSinContestar(usuarioId, engine.nuevasSinContestar());

      // Solo si la sesión se terminó de verdad: al salir a medias no se ofrece seguir.
      const pendientes =
        completa && filtroSesion ? await countDue(usuarioId, filtroSesion) : 0;
      const cierre = completa && filtroSesion ? await datosDeCierre(usuarioId, filtroSesion) : {};

      set({ phase: 'finished', summary, card: null, feedback: null, pendientes, ...cierre });
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
      pendientes: 0,
      seguidas: 0,
      aciertos: 0,
      avanzando: false,
      proximoRepaso: null,
      nuevasCatalogo: 0,
      soloNuevas: false,
    });
  },
  };
});
