import { useCallback, useEffect, useReducer, useRef, useState, useEffectEvent, useLayoutEffect } from 'react';
import { AppState, Dimensions } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Jugada, TableroDulcesRef } from '@/features/juegos/dulces/components/TableroDulces';
import type { DestinoTitulo, PreguntaDulces } from '@/features/juegos/dulces/components/HojaPregunta';
import { RESPALDO_DULCES, ladoPara } from '@/features/juegos/dulces/logic/medidas';
import { PARTIDA_INICIAL, fasePartida, mejorColor, opcionesPara, partidaDulces } from '@/features/juegos/dulces/logic/partida';
import { useMedidasDulces } from './useMedidasDulces';
import { useRespuestaDulces } from './useRespuestaDulces';
import { useVozMatch } from './useVozMatch';
import { useNivel } from '@/features/juegos/comun/useNivel';
import { clone, createBoard, findMatches, hayMovimiento, rebarajar, swap, type Board } from '@/domain/match3';
import { resolverPorPasos, type Paso } from '@/domain/match3Pasos';
import { shuffle } from '@/domain/arreglos';
import { getRandomEntries } from '@/data/repos/frases';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { useMusicaPantalla } from '@/estado/useMusicaPantalla';
import { useCarga } from '@/shared/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { useReaccion } from '@/shared/hooks/useReaccion';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { space } from '@/theme';
import type { DulceObjetivo, Entry, NivelDulces } from '@/types';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Ruta = RouteProp<RootStackParams, 'Dulces'>;

const ANCHO = Dimensions.get('window').width;

/** Tope del vuelo de la frase hasta el título de la pregunta (unos 320 ms): si no llega a medirse, se suelta igual. */
const VUELO_MAXIMO_MS = 1200;

/**
 * Toda la partida de Dulces: carga, tablero, metas, jugadas y la pregunta. La pantalla solo la pinta.
 * El momento de la partida vive en una máquina de estados (`logic/partida.ts`); la lógica del tablero,
 * en domain/match3.ts, probada desde node.
 */
export function usePartidaDulces() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);
  const autoAudio = useSettingsStore((s) => s.autoAudio);
  const { nivel, config, filtrar } = useNivel('dulces', params?.nivel);
  const nv = config as NivelDulces | null;
  // Se necesita oír bien la voz del match y de la pregunta: la música
  // competiría justo en esos momentos.
  useMusicaPantalla('silencio');
  useCortarAudioAlSalir();

  const { COLS_DEF, ROWS_DEF, COLORES_DEF, JUGADAS_DEF, META_DEF } = RESPALDO_DULCES;
  const COLS = nv?.cols ?? COLS_DEF;
  const ROWS = nv?.rows ?? ROWS_DEF;
  const COLORES = nv?.colores ?? COLORES_DEF;
  const FRASES = nv?.frases ?? COLORES_DEF;
  const META = nv?.metaPorFrase ?? META_DEF;
  const LADO = ladoPara(COLS, ANCHO);
  const PASO_CELDA = LADO + space.xs;
  const ANCHO_TABLERO = COLS * PASO_CELDA - space.xs;
  const ALTO_TABLERO = ROWS * PASO_CELDA - space.xs;

  const [board, setBoard] = useState<Board | null>(null);
  const [pool, setPool] = useState<Entry[]>([]);
  const [objetivos, setObjetivos] = useState<DulceObjetivo[]>([]);
  const objetivosRef = useRef(objetivos);
  useLayoutEffect(() => {
    objetivosRef.current = objetivos;
  }, [objetivos]);
  const [elegida, setElegida] = useState<number | null>(null);
  // Cubitos al acertar.
  const reaccion = useReaccion();
  const [jugadas, setJugadas] = useState<number>(JUGADAS_DEF);
  const [resueltas, setResueltas] = useState(0);
  // jugando, animando, pregunta o respondiendo: nunca dos a la vez.
  const [partida, despachar] = useReducer(partidaDulces, PARTIDA_INICIAL);
  const pregunta = partida.fase === 'pregunta' || partida.fase === 'respondiendo' ? partida.pregunta : null;
  // Bloquea las opciones mientras suena la secuencia de la respuesta.
  const respondiendo = partida.fase === 'respondiendo';
  const elegidaOpcion = partida.fase === 'respondiendo' ? partida.opcion : null;
  // El tablero anima cada jugada (intercambio, cascada, rebarajado): mientras dura no se aceptan toques.
  const animando = partida.fase === 'animando';
  const tableroRef = useRef<TableroDulcesRef>(null);
  const animandoRef = useRef(false);
  // Cambia con cada tablero nuevo: el tablero animado reparte piezas nuevas.
  const [llave, setLlave] = useState(0);
  // La nota del inicio se va tras la primera línea y no vuelve.
  const [huboLinea, setHuboLinea] = useState(false);
  const reducido = useMovimientoReducido();
  // La frase de la meta que se llenó vuela al título de la pregunta: `vuelo` es de dónde sale, `destinoTitulo`
  // a dónde llega (lo mide la hoja) y `capaAlto` sirve para saber dónde queda esa hoja.
  const [capaAlto, setCapaAlto] = useState(0);
  const [destinoTitulo, setDestinoTitulo] = useState<DestinoTitulo | null>(null);
  const [vuelo, setVuelo] = useState<{ desde: DestinoTitulo; texto: string } | null>(null);
  const medidas = useMedidasDulces(objetivosRef, { COLS, LADO, PASO_CELDA });
  const { cajaFrase, medirPosiciones, alEstallar } = medidas;
  // Si el tablero no cabe la pantalla scrollea, y entonces solo los deslizamientos horizontales intercambian.
  const [vistaAlto, setVistaAlto] = useState(0);
  const [contenidoAlto, setContenidoAlto] = useState(0);
  const puedeScroll = vistaAlto > 0 && contenidoAlto > vistaAlto + 1;

  const siguienteFrase = useRef(0);
  const empezoEn = useRef(Date.now());
  const tomarSiguienteFrase = useCallback(() => {
    const i = siguienteFrase.current;
    siguienteFrase.current = i + 1;
    return i;
  }, []);
  const msDesdeInicio = useCallback(() => Date.now() - empezoEn.current, []);
  const reiniciarReloj = useCallback(() => {
    empezoEn.current = Date.now();
  }, []);
  const montado = useRef(true);

  const { reproducirVozMatch, cancelarVozMatch } = useVozMatch(autoAudio);
  const alCerrarPregunta = useCallback(() => {
    setVuelo(null);
    setDestinoTitulo(null);
  }, []);
  const respuesta = useRespuestaDulces({
    user,
    autoAudio,
    pregunta,
    respondiendo,
    pool,
    META,
    tomarSiguienteFrase,
    msDesdeInicio,
    reiniciarReloj,
    montado,
    despachar,
    setObjetivos,
    setResueltas,
    alCerrarPregunta,
    celebra: reaccion.celebra,
    cancelarVozMatch,
  });
  const { soltarRespuesta } = respuesta;

  useEffect(() => {
    montado.current = true;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') return;
      audio.stop();
      cancelarVozMatch(false);
      // El tope de la respuesta se queda: si la voz no vuelve, al regresar
      // la pregunta se cierra igual en vez de quedarse abierta para siempre.
    });
    return () => {
      montado.current = false;
      sub.remove();
      soltarRespuesta();
      audio.stop();
      cancelarVozMatch(false);
    };
  }, [cancelarVozMatch, soltarRespuesta]);

  const carga = useCarga(
    async () => {
      if (!user || !nv) return;
      const entradas = await getRandomEntries(filter(), 120, {
        maxWords: 6,
        maxLen: 34,
      });

      const mezcladas = shuffle(filtrar(entradas, nv.frases));
      setPool(mezcladas);
      setObjetivos(
        mezcladas.slice(0, nv.frases).map((entry, i) => ({
          entry,
          // Con más frases que colores, dos frases comparten color: es
          // preferible a dejar colores muertos que no llenan nada.
          color: i % nv.colores,
          llevas: 0,
          meta: nv.metaPorFrase,
        }))
      );
      siguienteFrase.current = nv.frases;
      setJugadas(nv.jugadas);
      setBoard(createBoard(nv.cols, nv.rows, nv.colores));
      setLlave((l) => l + 1);
      setHuboLinea(false);
      empezoEn.current = Date.now();
    },
    [user, filter, nv, filtrar]
  );
  const loading = carga.estado === 'cargando';

  const terminar = useCallback(() => {
    audio.stop();
    nav.replace('GameEnd', {
      juego: 'dulces',
      rondas: FRASES,
      aciertos: resueltas,
      nivel: nivel ?? undefined,
    });
  }, [nav, resueltas, FRASES, nivel]);

  useEffect(() => {
    if (!vuelo) return undefined;
    const t = setTimeout(() => setVuelo(null), VUELO_MAXIMO_MS);
    return () => clearTimeout(t);
  }, [vuelo]);

  /** Sale la pregunta: la meta destella y su frase vuela al título de la hoja (si se pudo medir y hay movimiento). */
  const abrirPregunta = useCallback(
    (nueva: PreguntaDulces) => {
      const donde = cajaFrase(nueva.objetivo.color);
      setDestinoTitulo(null);
      setVuelo(
        donde && !reducido ? { desde: { x: donde.x, y: donde.y, ancho: donde.w }, texto: nueva.objetivo.entry.phrase } : null
      );
      despachar({ tipo: 'abrirPregunta', pregunta: nueva });
    },
    [reducido, cajaFrase]
  );

  /** Le pide al tablero que anime la jugada y no acepta toques hasta que termine. */
  const animar = useCallback((jugada: Omit<Jugada, 'onFin'>, alTerminar?: () => void) => {
    animandoRef.current = true;
    despachar({ tipo: 'animar' });
    medirPosiciones();
    tableroRef.current?.jugar({
      ...jugada,
      onFin: () => {
        animandoRef.current = false;
        despachar({ tipo: 'finAnimacion' });
        alTerminar?.();
      },
    });
  }, [medirPosiciones]);

  /** Lo que llegó a las barras de las metas: los trozos de un paso de la cascada. */
  const sumarAMetas = useCallback((paso: Paso) => {
    setObjetivos((prev) => prev.map((o) => ({ ...o, llevas: o.llevas + (paso.porColor[o.color] ?? 0) })));
  }, []);

  /*
   * Intercambio libre, y libre de verdad.
   *
   * Antes la ficha solo se movía si el movimiento armaba línea, y
   * solo entre vecinas. Eso convertía el juego en un buscaminas: la
   * app ya sabía la respuesta y solo te dejaba acertar.
   *
   * Ahora se puede cambiar CUALQUIER par de fichas, vecinas o no, y
   * el cambio se queda aunque no arme nada. Lo que hace que siga
   * siendo un juego y no un lienzo es el presupuesto de jugadas:
   * cada intercambio cuesta una, armes o no. Así el jugador decide
   * si explora o si va al grano, que es justo la decisión
   * interesante.
   *
   * La lógica se decide aquí y de golpe (mismo azar, mismo orden); lo que
   * cambia es que el tablero la ANIMA paso a paso y las metas se llenan
   * cuando llegan los trozos. La pregunta, si esta jugada llenó una barra,
   * sale cuando termina la animación.
   */
  const intercambiar = useCallback(
    (a: number, c: number) => {
      if (!board) return;
      const nuevo = clone(board);
      swap(nuevo, a, c);

      const arma = findMatches(nuevo).length > 0;
      if (arma) setHuboLinea(true);
      setElegida(null);
      setJugadas((j) => j - 1);

      if (!arma) {
        // El cambio se queda. Un golpecito seco: no pasó nada malo,
        // simplemente no armó.
        haptics.tapLight();
        void audio.playTap();
        setBoard(nuevo);
        animar({ a, c, pasos: [], rebarajado: null, final: nuevo.cells });
        return;
      }

      const res = resolverPorPasos(nuevo, COLORES);

      haptics.success();
      void audio.playSuccess();
      setBoard(nuevo);

      // Se reparte lo quitado entre las frases de cada color.
      const sig = objetivos.map((o) => ({ ...o, llevas: o.llevas + (res.porColor[o.color] ?? 0) }));
      const llena = sig.find((o) => o.llevas >= o.meta);
      let pendiente: PreguntaDulces | null = null;
      if (llena) {
        // Si esta jugada llena una barra, la voz del match se salta:
        // pasa directo a la pregunta (cuando termine la animación).
        pendiente = { objetivo: llena, opciones: opcionesPara(llena, pool) };
      } else {
        // El color con más piezas quitadas en esta jugada (una cascada
        // cuenta como una sola jugada, resolve() ya la resolvió
        // entera). En empate, el que esté más cerca de llenar su barra.
        const colorGanador = mejorColor(res.porColor, sig);
        const objetivo = sig.find((o) => o.color === colorGanador);
        if (objetivo) reproducirVozMatch(objetivo.entry);
      }

      let rebarajado: number[] | null = null;
      if (!hayMovimiento(nuevo)) {
        const otro = clone(nuevo);
        rebarajar(otro, COLORES);
        setBoard(otro);
        rebarajado = otro.cells;
      }

      animar(
        {
          a,
          c,
          pasos: res.pasos,
          rebarajado,
          final: rebarajado ?? nuevo.cells,
          onEstallido: alEstallar,
          onLlegan: sumarAMetas,
        },
        () => {
          if (pendiente) abrirPregunta(pendiente);
        }
      );
    },
    [board, objetivos, pool, COLORES, reproducirVozMatch, animar, alEstallar, sumarAMetas, abrirPregunta]
  );

  const tocar = useCallback(
    (i: number) => {
      if (!board || pregunta || jugadas <= 0 || animandoRef.current) return;

      if (elegida === null) {
        haptics.tapLight();
        void audio.playTap();
        setElegida(i);
        return;
      }
      if (elegida === i) {
        setElegida(null);
        return;
      }
      intercambiar(elegida, i);
    },
    [board, elegida, pregunta, jugadas, intercambiar]
  );

  /** Deslizar una pieza hacia su vecina las intercambia, como en cualquier tres en línea. */
  const deslizar = useCallback(
    (origen: number, destino: number) => {
      if (!board || pregunta || jugadas <= 0 || animandoRef.current) return;
      intercambiar(origen, destino);
    },
    [board, pregunta, jugadas, intercambiar]
  );

  // Al mostrarse la pregunta: corta lo que sonaba (incluida una voz de
  // match que hubiera quedado pendiente) y dice la frase en inglés.
  const efectoPregunta = useEffectEvent(() => {
    if (!pregunta) return;
    cancelarVozMatch(true);
    audio.stop();
    if (autoAudio) void audio.play(pregunta.objetivo.entry.audio_en);
    // Solo debe correr cuando aparece una pregunta nueva, no en cada
    // cambio de `respondiendo` mientras la misma sigue abierta.
  });
  useEffect(() => efectoPregunta(), [pregunta]);

  useEffect(() => {
    if (jugadas <= 0 && !pregunta && !animando) {
      const t = setTimeout(terminar, 900);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [jugadas, pregunta, animando, terminar]);

  return {
    nav,
    carga,
    loading,
    fase: fasePartida(partida, loading, jugadas),
    nivel,
    jugadasTotal: nv?.jugadas ?? JUGADAS_DEF,
    tablero: { board, COLS, ROWS, LADO, ANCHO_TABLERO, ALTO_TABLERO, llave, elegida, puedeScroll },
    objetivos,
    jugadas,
    huboLinea,
    animando,
    pregunta,
    respondiendo,
    elegidaOpcion,
    avanzando: respuesta.avanzando,
    vuelo,
    destinoTitulo,
    capaAlto,
    reaccion,
    tableroRef,
    medidas,
    setCapaAlto,
    setVistaAlto,
    setContenidoAlto,
    setDestinoTitulo,
    setVuelo,
    tocar,
    deslizar,
    terminar,
    responder: respuesta.responder,
    seguirAhora: respuesta.seguirAhora,
  };
}
