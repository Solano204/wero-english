import { useCallback, useEffect, useReducer, useRef, useState, useEffectEvent, useLayoutEffect } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RONDA_INICIAL, faseColmena, rondaColmena } from '@/features/juegos/colmena/logic/ronda';
import { useTableroColmena } from './useTableroColmena';
import { useVozRonda } from './useVozRonda';
import { aplicarPista, buildRounds, estaCompleta, invariantesPanal, vaBien } from '@/domain/colmena';
import { useNivel } from '@/features/juegos/comun/useNivel';
import { applyGameGrade } from '@/data/repos/juegos';
import { getRandomSpellable } from '@/data/repos/frases';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { useMusicaPantalla } from '@/estado/useMusicaPantalla';
import { useCarga } from '@/shared/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { motionColmena, motionDuration } from '@/theme';
import type { ColmenaRound, NivelColmena } from '@/types';
import type { RootStackParams } from '@/types/rutas';
import { conFinal, conFinalAsync } from '@/shared/utils/conFinal';
import { sinEsperar } from '@/services/fallas';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Ruta = RouteProp<RootStackParams, 'Colmena'>;

/** Cuántas veces se puede escuchar la palabra completa por ronda. */
const ESCUCHAS_POR_RONDA = 2;

/** La pista enciende su ficha en `senal` este rato antes de que salga sola. */
const PISTA_BRILLO_MS = motionDuration.base;

/** Cuánto se bloquea "Siguiente" tras tocarlo, para no procesar dos toques. */
const AVANZAR_DEBOUNCE_MS = 400;

/** Cuánto se bloquea «Pista» tras tocarla: lo que tarda el estado nuevo en llegar a la siguiente pista. */
const PISTA_DEBOUNCE_MS = 300;

/**
 * Toda la partida de Colmena: rondas, letras, pistas, escuchas, el reloj y el paso a la ronda que sigue.
 * La pantalla solo la pinta. Cada ronda es una máquina de estados (`logic/ronda.ts`).
 *
 * Cada ronda escribe una calificación SM-2 real, así que jugar adelanta
 * la cola de repaso en vez de robarle tiempo.
 */
export function useRondaColmena() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const user = useAuthStore((s) => s.user);
  const { nivel, config, filtrar } = useNivel('colmena', params?.nivel);
  const nv = config as NivelColmena | null;
  const filter = useSettingsStore((s) => s.filter);
  // Colmena exige leer y escuchar con atención: la música de fondo, aun
  // baja, estorba más de lo que ayuda. useMusicaPantalla('silencio') la
  // pausa con fundido al entrar y la retoma sola al salir.
  useMusicaPantalla('silencio');
  useCortarAudioAlSalir();

  useEffect(() => {
    // Al salir de la pantalla o ir a background: corta voz y SFX. stop()
    // ya para ambos (ver audio.ts).
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') audio.stop();
    });
    return () => {
      sub.remove();
      audio.stop();
      if (avanzandoTimer.current) clearTimeout(avanzandoTimer.current);
      if (salidaTimer.current) clearTimeout(salidaTimer.current);
      if (pistaTimer.current) clearTimeout(pistaTimer.current);
    };
  }, []);

  const [rounds, setRounds] = useState<ColmenaRound[]>([]);
  const [idx, setIdx] = useState(0);
  const [armado, setArmado] = useState('');
  const [usadas, setUsadas] = useState<number[]>([]);
  const [aciertos, setAciertos] = useState(0);
  // jugando, resuelta o saliendo; resuelta lleva desde qué ranura completó la ayuda («No me sale» o el
  // tiempo; null si la ronda la armó quien juega) y si fue porque se acabó el tiempo.
  const [ronda, despachar] = useReducer(rondaColmena, RONDA_INICIAL);
  const resuelta = ronda.fase !== 'jugando';
  const saliendo = ronda.fase === 'saliendo';
  const ayudaDesde = ronda.fase === 'jugando' ? null : ronda.ayudaDesde;
  const seAcabo = ronda.fase === 'jugando' ? false : ronda.seAcabo;
  // Las pistas ya no se compran: el nivel trae las que trae.
  const [pistas, setPistas] = useState(0);
  // Escuchas de la PALABRA completa (independientes de las pistas de
  // letra): dos por ronda, se reinician con cada una.
  const [escuchas, setEscuchas] = useState(ESCUCHAS_POR_RONDA);
  const [sonandoEscuchar, setSonandoEscuchar] = useState(false);
  // Evita doble toque en "Siguiente": se levanta solo a los 400ms. El
  // estado solo deshabilita el botón; el candado de verdad es la ref, que
  // cambia en el mismo toque (dos toques en el mismo cuadro veían el
  // estado viejo y pasaban los dos).
  const [avanzando, setAvanzando] = useState(false);
  const candadoAvanzar = useRef(false);
  const avanzandoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lo mismo para «Pista»: dos toques sobre el mismo estado viejo ponían la misma ficha dos veces y gastaban
  // dos pistas por una letra.
  const candadoPista = useRef(false);
  const pistaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Qué ronda ya se resolvió. El reloj avisa desde el hilo de UI y puede
  // llegar en el mismo instante que la última letra o «No me sale», con
  // un `resuelta` todavía viejo: esta ref corta la segunda resolución.
  const resueltaEn = useRef(-1);
  // Al pasar de ronda el panal se deshace primero; este es el reloj que espera a que salga.
  const salidaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducido = useMovimientoReducido();

  const empezoEn = useRef(Date.now());
  // El color de error dura lo que el efecto (`base`) y se apaga solo.
  const [falloLetra, setFalloLetra] = useState(false);
  useEffect(() => {
    if (!falloLetra) return undefined;
    const t = setTimeout(() => setFalloLetra(false), motionDuration.base);
    return () => clearTimeout(t);
  }, [falloLetra]);

  const carga = useCarga(
    async () => {
      if (!user || !nv) return;
      // Se piden más de las necesarias porque el filtro de longitud de
      // esUsable descarta bastantes: pedir justo las del nivel deja
      // partidas cortas.
      const pool = await getRandomSpellable(filter(), 160);
      const dentro = filtrar(pool, nv.rondas);
      setRounds(buildRounds(dentro, nv.rondas, nv.senuelos));
      setPistas(nv.pistasGratis);
    },
    [user, filter, nv, filtrar]
  );
  const loading = carga.estado === 'cargando';

  const round = rounds[idx];

  const { voz, analisis } = useVozRonda(round?.entry ?? null);
  const tablero = useTableroColmena(round);
  const { volarFaltantes, rechazar, colocar, limpiar } = tablero;

  // El lector de pantalla oye la frase completa cuando se resuelve la ronda.
  const efectoResuelta = useEffectEvent(() => {
    if (!resuelta || !round) return;
    const frase = round.entry.phrase;
    AccessibilityInfo.announceForAccessibility(
      ayudaDesde === null ? `Frase completa: ${frase}` : `${seAcabo ? 'Se acabó el tiempo. ' : ''}La frase era: ${frase}`
    );
    // Solo cuenta el momento de resolverse.
  });
  useEffect(() => efectoResuelta(), [resuelta]);

  const tocarLetra = useCallback(
    (i: number, viaPista = false) => {
      if (!round || resuelta || resueltaEn.current === idx || usadas.includes(i)) return;
      const letra = round.letras[i] ?? '';
      const siguiente = armado + letra;

      if (!vaBien(round.objetivo, siguiente)) {
        // Letra equivocada: se sacude y no se acepta. No se descuenta
        // nada, no hay vidas y no se acaba la partida. El SFX es el
        // mismo "fail" suave del resto de la app: ni esto es un regaño.
        haptics.failure();
        void audio.playFail();
        setFalloLetra(true);
        rechazar(i, armado.length);
        return;
      }

      haptics.tapLight();
      // Si vino de "Pista", ya sonó su propio empujoncito: un tap encima
      // sería ruido, no confirmación.
      if (!viaPista) void audio.playTap();
      setArmado(siguiente);
      setUsadas((prev) => [...prev, i]);
      colocar(i, armado.length, viaPista, viaPista ? PISTA_BRILLO_MS : 0);

      if (estaCompleta(round.objetivo, siguiente)) {
        resueltaEn.current = idx;
        despachar({ tipo: 'resolver', ayudaDesde: null, seAcabo: false });
        setAciertos((a) => a + 1);
        haptics.success();
        void audio.playRoundResultBilingue(true, round.entry.audio_en, round.entry.audio_es);
        if (user) {
          sinEsperar(applyGameGrade(
            user.id,
            round.entry.id,
            true,
            Date.now() - empezoEn.current,
            'producir'
          ), 'juego:colmena');
        }
      }
    },
    [round, resuelta, idx, usadas, armado, rechazar, colocar, user]
  );

  // El panal no se vuelve a pintar entero con cada letra: las fichas reciben siempre la misma función.
  const tocarRef = useRef(tocarLetra);
  useLayoutEffect(() => {
    tocarRef.current = tocarLetra;
  }, [tocarLetra]);
  const alTocarFicha = (ficha: number) => tocarRef.current(ficha);

  /**
   * Una pista pone exactamente UNA letra: la de la siguiente ranura vacía, de UNA sola ficha libre (elegida por
   * id, en `aplicarPista`). Solo esa ficha queda usada; las demás siguen en el panal. Si esa letra completa la
   * frase, `tocarLetra` termina la ronda igual que cuando la completa quien juega.
   */
  const usarPista = () => {
    if (!round || resuelta || pistas <= 0 || candadoPista.current) return;

    const pista = aplicarPista({ objetivo: round.objetivo, letras: round.letras, armado, usadas });
    if (!pista) return;

    candadoPista.current = true;
    conFinal(() => {
      setPistas((n) => Math.max(0, n - 1));
      void audio.playPista();
      tocarLetra(pista.ficha, true);
    }, () => {
      // Se suelta siempre, pase lo que pase arriba, y un instante después: así el toque siguiente ya ve el estado nuevo.
      if (pistaTimer.current) clearTimeout(pistaTimer.current);
      pistaTimer.current = setTimeout(() => {
        candadoPista.current = false;
      }, PISTA_DEBOUNCE_MS);
    });
  };

  // Solo en desarrollo: con la ronda en juego, las fichas usadas son las letras colocadas, sin repetidas.
  useEffect(() => {
    if (!__DEV__ || !round || resuelta) return;
    const fallas = invariantesPanal({ objetivo: round.objetivo, letras: round.letras, armado, usadas });
    if (fallas.length > 0) {
      if (__DEV__) console.warn('[colmena] invariantes rotas:', fallas.join('; '));
    }
  }, [round, resuelta, armado, usadas]);

  /**
   * Escuchar la palabra completa en inglés. Independiente de las pistas
   * de letra: dos usos por ronda, y no gasta nada si ya no quedan.
   *
   * Si se toca mientras suena, audio.play() reutiliza el mismo player
   * (mismo relPath) y solo rebobina: nunca se encima, y como el botón
   * ya está bloqueado por sonandoEscuchar, no hay forma normal de que
   * esto se dispare dos veces por el mismo uso.
   */
  const escucharPalabra = async () => {
    if (!round || resuelta || sonandoEscuchar || escuchas <= 0) return;
    setEscuchas((n) => n - 1);
    setSonandoEscuchar(true);
    await conFinalAsync(async () => {
      await audio.play(round.entry.audio_en);
      await audio.waitUntilDone();
    }, () => {
      // Pase lo que pase (audio.ts ya pone su propio tope, pero el
      // candado de este botón se libera aquí siempre): "Escuchar" nunca
      // se queda deshabilitado el resto de la ronda.
      setSonandoEscuchar(false);
    });
  };

  // Qué ronda ya mandó a avanzarRonda: una sola vez por ronda, sin
  // importar si lo dispara el temporizador de salida o «Siguiente» de
  // nuevo mientras el primero seguía en camino.
  const avanzadaDesde = useRef(-1);

  /** Pasa a la ronda que sigue. Lo de la ronda que se deja se limpia junto con el cambio: la nueva no pinta ni un cuadro con ello. */
  const avanzarRonda = () => {
    if (avanzadaDesde.current === idx) return;
    avanzadaDesde.current = idx;
    limpiar();
    // Todo lo de la ronda nueva en el mismo toque (antes, un efecto en [idx] lo repetía en un segundo render).
    empezoEn.current = Date.now();
    setArmado('');
    setUsadas([]);
    despachar({ tipo: 'nuevaRonda' });
    setEscuchas(ESCUCHAS_POR_RONDA);
    setSonandoEscuchar(false);
    setIdx((i) => i + 1);
  };

  const siguiente = () => {
    // Bloquea el botón ~400ms: sin esto, dos toques rápidos podían
    // procesar dos avances y disparar dos veces la lógica de abajo.
    if (candadoAvanzar.current) return;
    candadoAvanzar.current = true;
    setAvanzando(true);
    conFinal(() => {
      // Corta SFX y voz en camino: si no, la de la ronda que se deja
      // atrás compite con el audio automático de la que entra.
      audio.stop();
      if (idx + 1 >= rounds.length) {
        nav.replace('GameEnd', {
          juego: 'colmena',
          rondas: rounds.length,
          aciertos,
          nivel: nivel ?? undefined,
        });
        return;
      }
      // El panal se deshace hacia abajo y, cuando sale, entra la ronda que
      // sigue. El cambio lo da un temporizador con la duración de esa
      // salida, nunca el aviso de fin de una animación (que puede no
      // llegar si se cancela o se salta); avanzarRonda solo corre una vez
      // por ronda. Con «reducir movimiento» no se espera nada.
      if (reducido) {
        avanzarRonda();
        return;
      }
      despachar({ tipo: 'salir' });
      if (salidaTimer.current) clearTimeout(salidaTimer.current);
      salidaTimer.current = setTimeout(avanzarRonda, motionColmena.salida);
    }, () => {
      // Pase lo que pase arriba (un error, un retorno temprano), el
      // candado se suelta solo.
      if (avanzandoTimer.current) clearTimeout(avanzandoTimer.current);
      avanzandoTimer.current = setTimeout(() => {
        candadoAvanzar.current = false;
        setAvanzando(false);
      }, AVANZAR_DEBOUNCE_MS);
    });
  };

  /**
   * Resuelve la ronda con ayuda: «No me sale» o se acabó el tiempo. Se revela la palabra y se califica como
   * fallo. No se acaba la partida: perder el nivel entero por una ronda lenta convertiría el reloj en un
   * castigo en vez de en presión.
   *
   * La ronda se resuelve siempre, tenga o no `user`: antes el guard cubría toda la función, así que sin
   * `user` la ronda se quedaba pegada para siempre (nunca aparecía «Siguiente»). Grabar la calificación sí
   * depende de `user`; resolver la ronda no.
   */
  const resolverConAyuda = async (porTiempo: boolean) => {
    if (!round || resuelta || resueltaEn.current === idx) return;
    resueltaEn.current = idx;
    despachar({ tipo: 'resolver', ayudaDesde: armado.length, seAcabo: porTiempo });
    volarFaltantes(usadas, armado);
    setArmado(round.objetivo);
    if (porTiempo) haptics.failure();
    void audio.playRoundResultBilingue(false, round.entry.audio_en, round.entry.audio_es);
    if (user) {
      await applyGameGrade(
        user.id,
        round.entry.id,
        false,
        Date.now() - empezoEn.current,
        'producir'
      );
    }
  };
  const seAcaboElTiempo = () => sinEsperar(resolverConAyuda(true), 'juego:colmena');
  const rendirse = () => sinEsperar(resolverConAyuda(false), 'juego:colmena');

  return {
    nav,
    carga,
    loading,
    fase: faseColmena(ronda, loading, round !== undefined),
    nivel,
    nv,
    rounds,
    round,
    idx,
    armado,
    resuelta,
    saliendo,
    ayudaDesde,
    seAcabo,
    pistas,
    escuchas,
    sonandoEscuchar,
    avanzando,
    falloLetra,
    voz,
    analisis,
    tablero,
    alTocarFicha,
    usarPista,
    escucharPalabra,
    siguiente,
    seAcaboElTiempo,
    rendirse,
  };
}
