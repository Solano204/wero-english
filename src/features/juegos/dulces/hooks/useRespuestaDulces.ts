import { useCallback, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { EventoPartida } from '@/features/juegos/dulces/logic/partida';
import type { PreguntaDulces } from '@/features/juegos/dulces/components/HojaPregunta';
import { applyGameGrade } from '@/data/repos/juegos';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import type { DulceObjetivo, Entry, User } from '@/types';

/** Tope duro de la secuencia de la pregunta: si el audio no carga, se suelta igual. */
const RESPUESTA_MAXIMA_MS = 6000;
/** Pausa entre el inglés y el español al acertar. */
const PAUSA_ENTRE_IDIOMAS_MS = 250;
/** Cuánto se deja ver la marca sin voz (Voz automática apagada). */
const SIN_VOZ_VISUAL_MS = 900;
/** Bloqueo de "Seguir" en la pregunta contra doble toque. */
const AVANZAR_DEBOUNCE_MS = 400;

interface Params {
  user: User | null;
  autoAudio: boolean;
  pregunta: PreguntaDulces | null;
  respondiendo: boolean;
  pool: Entry[];
  META: number;
  siguienteFrase: RefObject<number>;
  empezoEn: RefObject<number>;
  montado: RefObject<boolean>;
  despachar: Dispatch<EventoPartida>;
  setObjetivos: Dispatch<SetStateAction<DulceObjetivo[]>>;
  setResueltas: Dispatch<SetStateAction<number>>;
  alCerrarPregunta: () => void;
  celebra: () => void;
  cancelarVozMatch: (soltar: boolean) => void;
}

/**
 * La pregunta de Dulces, de la respuesta a la frase siguiente: califica en SM-2, suena la secuencia de
 * la respuesta y cierra la pregunta una sola vez (el token evita que la voz, «Seguir» y el tope avancen dos veces).
 */
export function useRespuestaDulces(p: Params) {
  const {
    user,
    autoAudio,
    pregunta,
    respondiendo,
    pool,
    META,
    siguienteFrase,
    empezoEn,
    montado,
    despachar,
    setObjetivos,
    setResueltas,
    alCerrarPregunta,
    celebra,
    cancelarVozMatch,
  } = p;
  const [avanzando, setAvanzando] = useState(false);

  // Token de la secuencia de respuesta vigente: uno nuevo invalida
  // cualquier voz o temporizador en camino de una secuencia anterior
  // (Seguir, un timeout o una respuesta nueva no deberían poder
  // pisarse entre sí).
  const respuestaToken = useRef(0);
  const limiteRespuesta = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avanzarDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // El candado de "Seguir" de verdad: el estado `avanzando` solo deshabilita
  // el botón, y dos toques en el mismo cuadro todavía lo ven en false.
  const candadoAvanzar = useRef(false);

  /**
   * Cierra la pregunta vigente y continúa el juego: la frase resuelta
   * deja su color libre para la siguiente. La llaman tanto el final
   * natural de la voz como "Seguir" y el tope de RESPUESTA_MAXIMA_MS;
   * el token evita que dos de ellos avancen dos veces.
   */
  const avanzarTrasRespuesta = useCallback(
    (miToken: number, objetivo: DulceObjetivo) => {
      if (respuestaToken.current !== miToken) return;
      respuestaToken.current++;
      if (limiteRespuesta.current) clearTimeout(limiteRespuesta.current);
      audio.stop();
      if (!montado.current) return;

      // Sin módulo: antes daba la vuelta a la bolsa y repetía frases ya
      // contestadas en la misma partida. Si se acaban, el color se
      // queda con la que tenía y deja de pedir pregunta; la partida
      // termina por jugadas, como siempre.
      const nueva = pool[siguienteFrase.current];
      siguienteFrase.current++;

      setObjetivos((prev) =>
        prev
          .map((o) =>
            o.color === objetivo.color && nueva
              ? { entry: nueva, color: o.color, llevas: 0, meta: META }
              : o
          )
          .filter((o) => o.entry.id !== objetivo.entry.id || nueva)
      );
      despachar({ tipo: 'cerrarPregunta' });
      alCerrarPregunta();
      empezoEn.current = Date.now();
    },
    [pool, META, montado, siguienteFrase, setObjetivos, despachar, alCerrarPregunta, empezoEn]
  );

  /**
   * ACIERTO: SFX de acierto, inglés, pausa breve, español.
   * FALLO: SFX de fallo, español de la correcta (para que se quede con
   * el significado). Sin "Voz automática" solo queda el SFX y un
   * momento visual para leer la marca, sin voces ni pausas largas.
   */
  const reproducirSecuenciaRespuesta = useCallback(
    async (objetivo: DulceObjetivo, bien: boolean) => {
      const miToken = ++respuestaToken.current;
      cancelarVozMatch(true);
      audio.stop();

      limiteRespuesta.current = setTimeout(
        () => avanzarTrasRespuesta(miToken, objetivo),
        RESPUESTA_MAXIMA_MS
      );

      void (bien ? audio.playSuccess() : audio.playFail());

      if (!autoAudio) {
        await new Promise((r) => setTimeout(r, SIN_VOZ_VISUAL_MS));
        avanzarTrasRespuesta(miToken, objetivo);
        return;
      }

      if (bien) {
        if (objetivo.entry.audio_en) {
          await audio.play(objetivo.entry.audio_en);
          await audio.waitUntilDone();
        }
        if (respuestaToken.current !== miToken) return; // Seguir/timeout ya cerró
        await new Promise((r) => setTimeout(r, PAUSA_ENTRE_IDIOMAS_MS));
        if (respuestaToken.current !== miToken) return;
        if (objetivo.entry.audio_es) {
          await audio.play(objetivo.entry.audio_es);
          await audio.waitUntilDone();
        }
      } else if (objetivo.entry.audio_es) {
        await audio.play(objetivo.entry.audio_es);
        await audio.waitUntilDone();
      }

      if (respuestaToken.current !== miToken) return;
      avanzarTrasRespuesta(miToken, objetivo);
    },
    [autoAudio, avanzarTrasRespuesta, cancelarVozMatch]
  );

  const responder = useCallback(
    (opcion: string) => {
      if (!pregunta || !user || respondiendo) return;
      const objetivo = pregunta.objetivo;
      const bien = opcion === objetivo.entry.spanish_main;

      despachar({ tipo: 'responder', opcion });

      void applyGameGrade(
        user.id,
        objetivo.entry.id,
        bien,
        Date.now() - empezoEn.current,
        'reconocer'
      );

      if (bien) {
        haptics.success();
        celebra();
        setResueltas((r) => r + 1);
      } else {
        haptics.failure();
      }

      void reproducirSecuenciaRespuesta(objetivo, bien);
    },
    [pregunta, user, respondiendo, despachar, empezoEn, celebra, setResueltas, reproducirSecuenciaRespuesta]
  );

  /** Botón "Seguir ›" de la pregunta: corta la voz y avanza ya. */
  const seguirAhora = useCallback(() => {
    if (candadoAvanzar.current || !pregunta) return;
    candadoAvanzar.current = true;
    setAvanzando(true);
    try {
      avanzarTrasRespuesta(respuestaToken.current, pregunta.objetivo);
    } finally {
      // El candado se suelta siempre, pase lo que pase al avanzar.
      if (avanzarDebounce.current) clearTimeout(avanzarDebounce.current);
      avanzarDebounce.current = setTimeout(() => {
        candadoAvanzar.current = false;
        setAvanzando(false);
      }, AVANZAR_DEBOUNCE_MS);
    }
  }, [pregunta, avanzarTrasRespuesta]);

  /** Al desmontar: nada de la secuencia en camino puede seguir. */
  const soltarRespuesta = useCallback(() => {
    respuestaToken.current++;
    if (limiteRespuesta.current) clearTimeout(limiteRespuesta.current);
    if (avanzarDebounce.current) clearTimeout(avanzarDebounce.current);
  }, []);

  return { avanzando, responder, seguirAhora, soltarRespuesta };
}
