import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, EmptyState, ErrorCarga, Header, Screen } from '@/components/base';
import { Hueso, ProveedorEsqueleto } from '@/components/esqueleto';
import { TableroDulces, type Jugada, type TableroDulcesRef } from '@/components/juegos/dulces/TableroDulces';
import { TROZOS_RETRASO_MS, azarFijo, trozosDelPaso, trozosPorPieza } from '@/components/juegos/dulces/tablero';
import { Estallidos, type EstallidosRef, type Trozo } from '@/components/juegos/dulces/Estallidos';
import { FraseVoladora } from '@/components/juegos/dulces/FraseVoladora';
import { HojaPregunta, type DestinoTitulo, type PreguntaDulces } from '@/components/juegos/dulces/HojaPregunta';
import { TarjetaMetas } from '@/components/juegos/dulces/MetaFrase';
import { NotaInicial, PieDulces } from '@/components/juegos/dulces/PieDulces';
import { Trozos, useReaccion } from '@/components/feedback';
import {
  clone,
  createBoard,
  findMatches,
  hayMovimiento,
  rebarajar,
  swap,
  type Board } from '@/domain/match3';
import { resolverPorPasos, type Paso } from '@/domain/match3Pasos';
import { applyGameGrade } from '@/data/repos/juegos';
import { getRandomEntries } from '@/data/repos/frases';
import { useCarga } from '@/hooks/useCarga';
import { shuffle } from '@/domain/arreglos';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { useMusicaPantalla } from '@/estado/useMusicaPantalla';
import { useCortarAudioAlSalir } from '@/hooks/useCortarAudioAlSalir';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { color, font, motionDulces, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';
import { useNivel } from './useNivel';
import type { DulceObjetivo, Entry, NivelDulces } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Ruta = RouteProp<RootStackParams, 'Dulces'>;

/** Valores de respaldo si niveles.json no cargó. */
const COLS_DEF = 7;
const ROWS_DEF = 8;
const COLORES_DEF = 5;
const JUGADAS_DEF = 22;
const META_DEF = 9;

const ANCHO = Dimensions.get('window').width;

/** Tope del vuelo de la frase hasta el título de la pregunta (unos 320 ms): si no llega a medirse, se suelta igual. */
const VUELO_MAXIMO_MS = 1200;
/** Tope duro de la secuencia de la pregunta: si el audio no carga, se suelta igual. */
const RESPUESTA_MAXIMA_MS = 6000;
/** Pausa entre el inglés y el español al acertar. */
const PAUSA_ENTRE_IDIOMAS_MS = 250;
/** Cuánto se deja ver la marca sin voz (Voz automática apagada). */
const SIN_VOZ_VISUAL_MS = 900;
/** Bloqueo de "Seguir" en la pregunta contra doble toque. */
const AVANZAR_DEBOUNCE_MS = 400;
/** Entre matches muy seguidos, no suena más de una voz cada tanto. */
const VOZ_MATCH_THROTTLE_MS = 700;

/**
 * El lado de la pieza depende de cuántas columnas pida el nivel. El tablero usa casi todo el ancho (márgenes
 * y huecos de `space.xs`) para acercarse a los 48 dp: con 8 columnas en un teléfono de 360 dp salen de 42 y el
 * área táctil se completa con `hitSlop` (ver `Pieza`).
 */
function ladoPara(cols: number): number {
  return Math.floor((ANCHO - space.xs * 2 - (cols - 1) * space.xs) / cols);
}

/**
 * P-27, Dulces.
 *
 * Un tres en línea normal, con una diferencia: cada color está amarrado
 * a una frase que el usuario tiene pendiente. Quitar piezas de un color
 * llena la barra de esa frase, y cuando se llena aparece la pregunta.
 *
 * Sin esa amarra sería un juego bonito que no enseña nada, y el tiempo
 * que pasa aquí sería tiempo robado a la sesión. Con ella, jugar
 * adelanta la cola de repaso igual que estudiar.
 *
 * Toda la lógica del tablero vive en domain/match3.ts y está probada
 * desde node. Aquí solo se pinta y se anima.
 */
export function DulcesScreen() {
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

  const COLS = nv?.cols ?? COLS_DEF;
  const ROWS = nv?.rows ?? ROWS_DEF;
  const COLORES = nv?.colores ?? COLORES_DEF;
  const FRASES = nv?.frases ?? COLORES_DEF;
  const META = nv?.metaPorFrase ?? META_DEF;
  const LADO = ladoPara(COLS);
  const PASO_CELDA = LADO + space.xs;
  const ANCHO_TABLERO = COLS * PASO_CELDA - space.xs;
  const ALTO_TABLERO = ROWS * PASO_CELDA - space.xs;

  const [board, setBoard] = useState<Board | null>(null);
  const [pool, setPool] = useState<Entry[]>([]);
  const [objetivos, setObjetivos] = useState<DulceObjetivo[]>([]);
  const objetivosRef = useRef(objetivos);
  objetivosRef.current = objetivos;
  const [elegida, setElegida] = useState<number | null>(null);
  // Cubitos al acertar.
  const reaccion = useReaccion();
  const [jugadas, setJugadas] = useState(JUGADAS_DEF);
  const [resueltas, setResueltas] = useState(0);
  const [pregunta, setPregunta] = useState<PreguntaDulces | null>(null);
  // Bloquea las opciones mientras suena la secuencia de la respuesta.
  const [respondiendo, setRespondiendo] = useState(false);
  const [elegidaOpcion, setElegidaOpcion] = useState<string | null>(null);
  const [avanzando, setAvanzando] = useState(false);
  // El tablero anima cada jugada (intercambio, cascada, rebarajado): mientras dura no se aceptan toques.
  const tableroRef = useRef<TableroDulcesRef>(null);
  const animandoRef = useRef(false);
  const [animando, setAnimando] = useState(false);
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
  // Los trozos de las piezas vuelan a las barras: hace falta saber dónde están el tablero y cada barra, en la
  // misma capa. Se miden al empezar cada jugada (el scroll pudo cambiarlas).
  const capaRef = useRef<View>(null);
  const tableroCajaRef = useRef<View>(null);
  const estallidosRef = useRef<EstallidosRef>(null);
  const barras = useRef(new Map<number, View>());
  const frases = useRef(new Map<number, View>());
  const posiciones = useRef<{
    tablero: { x: number; y: number } | null;
    barras: Map<number, { x: number; y: number; w: number; h: number }>;
    frases: Map<number, { x: number; y: number; w: number; h: number }>;
  }>({ tablero: null, barras: new Map(), frases: new Map() });
  // Si el tablero no cabe la pantalla scrollea, y entonces solo los deslizamientos horizontales intercambian.
  const [vistaAlto, setVistaAlto] = useState(0);
  const [contenidoAlto, setContenidoAlto] = useState(0);
  const puedeScroll = vistaAlto > 0 && contenidoAlto > vistaAlto + 1;

  const siguienteFrase = useRef(0);
  const empezoEn = useRef(Date.now());

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
  const montado = useRef(true);

  // Throttle de la voz del match: entre toques muy seguidos, solo la
  // más reciente llega a sonar, y suena en cuanto pasa la ventana.
  const ultimaVozMatch = useRef(0);
  const vozMatchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    montado.current = true;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') return;
      audio.stop();
      if (vozMatchTimer.current) clearTimeout(vozMatchTimer.current);
      // El tope de la respuesta se queda: si la voz no vuelve, al regresar
      // la pregunta se cierra igual en vez de quedarse abierta para siempre.
    });
    return () => {
      montado.current = false;
      sub.remove();
      respuestaToken.current++;
      audio.stop();
      if (vozMatchTimer.current) clearTimeout(vozMatchTimer.current);
      if (limiteRespuesta.current) clearTimeout(limiteRespuesta.current);
      if (avanzarDebounce.current) clearTimeout(avanzarDebounce.current);
    };
  }, []);

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

  /**
   * Voz del match: audio.play() ya invalida por su cuenta cualquier
   * reproducción anterior (su propio token), así que un match nuevo
   * nunca queda encimado con el de antes. El throttle es aparte: entre
   * toques muy seguidos evita una voz por cada uno, dejando sonar solo
   * la más reciente cuando pasa la ventana.
   */
  const reproducirVozMatch = useCallback(
    (entry: Entry) => {
      if (!autoAudio) return;
      if (vozMatchTimer.current) {
        clearTimeout(vozMatchTimer.current);
        vozMatchTimer.current = null;
      }
      const ahora = Date.now();
      const falta = VOZ_MATCH_THROTTLE_MS - (ahora - ultimaVozMatch.current);
      if (falta <= 0) {
        ultimaVozMatch.current = ahora;
        void audio.play(entry.audio_en);
      } else {
        vozMatchTimer.current = setTimeout(() => {
          ultimaVozMatch.current = Date.now();
          void audio.play(entry.audio_en);
        }, falta);
      }
    },
    [autoAudio]
  );

  const registrarBarra = useCallback((colorPieza: number, vista: View | null) => {
    if (vista) barras.current.set(colorPieza, vista);
    else barras.current.delete(colorPieza);
  }, []);

  const registrarFrase = useCallback((colorPieza: number, vista: View | null) => {
    if (vista) frases.current.set(colorPieza, vista);
    else frases.current.delete(colorPieza);
  }, []);

  const medirPosiciones = useCallback(() => {
    const capa = capaRef.current;
    if (!capa) return;
    tableroCajaRef.current?.measureLayout(
      capa,
      (x, y) => {
        posiciones.current.tablero = { x, y };
      },
      () => undefined
    );
    barras.current.forEach((vista, colorPieza) => {
      vista.measureLayout(
        capa,
        (x, y, w, h) => {
          posiciones.current.barras.set(colorPieza, { x, y, w, h });
        },
        () => undefined
      );
    });
    frases.current.forEach((vista, colorPieza) => {
      vista.measureLayout(
        capa,
        (x, y, w, h) => {
          posiciones.current.frases.set(colorPieza, { x, y, w, h });
        },
        () => undefined
      );
    });
  }, []);

  useEffect(() => {
    if (!vuelo) return undefined;
    const t = setTimeout(() => setVuelo(null), VUELO_MAXIMO_MS);
    return () => clearTimeout(t);
  }, [vuelo]);

  /** Sale la pregunta: la meta destella y su frase vuela al título de la hoja (si se pudo medir y hay movimiento). */
  const abrirPregunta = useCallback(
    (nueva: PreguntaDulces) => {
      const donde = posiciones.current.frases.get(nueva.objetivo.color);
      setDestinoTitulo(null);
      setVuelo(
        donde && !reducido ? { desde: { x: donde.x, y: donde.y, ancho: donde.w }, texto: nueva.objetivo.entry.phrase } : null
      );
      setPregunta(nueva);
    },
    [reducido]
  );

  /** Las piezas de un paso estallan: de cada una salen trozos de su color que vuelan al frente de la barra de su meta. */
  const alEstallar = useCallback(
    (paso: Paso) => {
      const origen = posiciones.current.tablero;
      if (!origen) return;
      const total = paso.quitar.length;
      const porPieza = trozosPorPieza(total);
      const limite = trozosDelPaso(total);
      const trozos: Trozo[] = [];
      paso.quitar.forEach((celda, k) => {
        const c = paso.colores[k] as number;
        const cx = origen.x + (celda % COLS) * PASO_CELDA + LADO / 2;
        const cy = origen.y + Math.floor(celda / COLS) * PASO_CELDA + LADO / 2;
        const barra = posiciones.current.barras.get(c);
        const meta = objetivosRef.current.find((o) => o.color === c);
        const frente = meta ? Math.min(1, (meta.llevas + (paso.porColor[c] ?? 0)) / meta.meta) : 1;
        for (let m = 0; m < porPieza && trozos.length < limite; m++) {
          const semilla = celda * 7 + m;
          // Un color sin meta no tiene barra a la que ir: sus trozos se dispersan y caen.
          const aLaBarra = barra !== undefined && meta !== undefined;
          trozos.push({
            x0: cx + (azarFijo(semilla) - 0.5) * LADO * 0.6,
            y0: cy + (azarFijo(semilla + 101) - 0.5) * LADO * 0.6,
            x1: aLaBarra ? barra.x + barra.w * frente : cx + (azarFijo(semilla + 33) - 0.5) * 70,
            y1: aLaBarra ? barra.y + barra.h / 2 : cy + 46,
            color: c,
            // Salen cuando la pieza ya se está yendo, y no todos a la vez.
            retraso: motionDulces.pulso + Math.round(azarFijo(semilla + 57) * TROZOS_RETRASO_MS),
          });
        }
      });
      estallidosRef.current?.lanzar(trozos);
    },
    [COLS, LADO, PASO_CELDA]
  );

  /** Le pide al tablero que anime la jugada y no acepta toques hasta que termine. */
  const animar = useCallback((jugada: Omit<Jugada, 'onFin'>, alTerminar?: () => void) => {
    animandoRef.current = true;
    setAnimando(true);
    medirPosiciones();
    tableroRef.current?.jugar({
      ...jugada,
      onFin: () => {
        animandoRef.current = false;
        setAnimando(false);
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
  useEffect(() => {
    if (!pregunta) return;
    if (vozMatchTimer.current) {
      clearTimeout(vozMatchTimer.current);
      vozMatchTimer.current = null;
    }
    audio.stop();
    if (autoAudio) void audio.play(pregunta.objetivo.entry.audio_en);
    // Solo debe correr cuando aparece una pregunta nueva, no en cada
    // cambio de `respondiendo` mientras la misma sigue abierta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pregunta]);

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
      setPregunta(null);
      setVuelo(null);
      setDestinoTitulo(null);
      setRespondiendo(false);
      setElegidaOpcion(null);
      empezoEn.current = Date.now();
    },
    [pool, META]
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
      if (vozMatchTimer.current) {
        clearTimeout(vozMatchTimer.current);
        vozMatchTimer.current = null;
      }
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
    [autoAudio, avanzarTrasRespuesta]
  );

  const responder = useCallback(
    (opcion: string) => {
      if (!pregunta || !user || respondiendo) return;
      const objetivo = pregunta.objetivo;
      const bien = opcion === objetivo.entry.spanish_main;

      setRespondiendo(true);
      setElegidaOpcion(opcion);

      void applyGameGrade(
        user.id,
        objetivo.entry.id,
        bien,
        Date.now() - empezoEn.current,
        'reconocer'
      );

      if (bien) {
        haptics.success();
        reaccion.celebra();
        setResueltas((r) => r + 1);
      } else {
        haptics.failure();
      }

      void reproducirSecuenciaRespuesta(objetivo, bien);
    },
    [pregunta, user, respondiendo, reaccion, reproducirSecuenciaRespuesta]
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

  useEffect(() => {
    if (jugadas <= 0 && !pregunta && !animando) {
      const t = setTimeout(terminar, 900);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [jugadas, pregunta, animando, terminar]);

  if (carga.estado === 'error') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Dulces" />
        <ErrorCarga onReintentar={carga.reintentar} />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen transicionCarga={carga.demora ? 'esqueleto' : undefined}>
        <Header onBack={() => nav.goBack()} title="Dulces" />
        {carga.demora ? (
          <ProveedorEsqueleto etiqueta="Llenando el tablero" style={styles.esqueletoRaiz}>
            <View style={styles.esqueletoMetas}>
              {Array.from({ length: 3 }, (_, i) => (
                <Hueso key={i} width={72} height={72} radius={radius.md} />
              ))}
            </View>
            <View style={styles.esqueletoTablero}>
              {Array.from({ length: 6 }, (_, fila) => (
                <View key={fila} style={styles.esqueletoFila}>
                  {Array.from({ length: 7 }, (_, col) => (
                    <Hueso key={col} width={38} height={38} radius={radius.sm} />
                  ))}
                </View>
              ))}
            </View>
          </ProveedorEsqueleto>
        ) : null}
      </Screen>
    );
  }

  if (!board || objetivos.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Dulces" />
        <EmptyState
          title="No se pudo armar el tablero"
          body="No hay frases suficientes con los filtros que traes puestos."
          actionLabel="Volver"
          onAction={() => nav.goBack()}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={styles.sinHueco} transicionCarga={carga.huboEsqueleto ? 'contenido' : undefined}>
      <View ref={capaRef} style={styles.capa} onLayout={(e) => setCapaAlto(e.nativeEvent.layout.height)}>
        <Trozos disparo={reaccion.trozos} tinte={color.world.cultura} />
        <View style={styles.top}>
          <Header
            onBack={() => nav.goBack()}
            title={nivel ? `Nivel ${nivel}` : undefined}
          />
        </View>

        {/* Scroll interno: en niveles con más filas/columnas el tablero
            puede pasar de la altura disponible en pantallas chicas y, sin
            esto, se cortaría contra "Dejarlo aquí" en vez de dejarse ver
            completo con scroll. */}
        <ScrollView
          style={styles.medio}
          contentContainerStyle={styles.medioContenido}
          showsVerticalScrollIndicator={false}
          scrollEnabled={pregunta === null}
          onLayout={(e) => setVistaAlto(e.nativeEvent.layout.height)}
          onContentSizeChange={(_, alto) => setContenidoAlto(alto)}
        >
          <View style={styles.metas}>
            <TarjetaMetas
              key={llave}
              objetivos={objetivos}
              registrarBarra={registrarBarra}
              registrarFrase={registrarFrase}
              llenaColor={pregunta?.objetivo.color ?? null}
            />
          </View>

          <View
            ref={tableroCajaRef}
            collapsable={false}
            style={{ width: ANCHO_TABLERO, height: ALTO_TABLERO, alignSelf: 'center' }}
          >
            <TableroDulces
              ref={tableroRef}
              celdas={board.cells}
              cols={COLS}
              rows={ROWS}
              lado={LADO}
              hueco={space.xs}
              llave={llave}
              elegida={elegida}
              bloqueado={animando || jugadas <= 0 || pregunta !== null}
              soloHorizontal={puedeScroll}
              onTocar={tocar}
              onDeslizar={deslizar}
            />
          </View>

          <NotaInicial visible={!huboLinea} texto="Junta tres del mismo color para llenar su barra" />
        </ScrollView>

        <PieDulces jugadas={jugadas} total={nv?.jugadas ?? JUGADAS_DEF} onDejar={terminar} />

        <HojaPregunta
          pregunta={pregunta}
          respondiendo={respondiendo}
          elegidaOpcion={elegidaOpcion}
          avanzando={avanzando}
          tituloListo={vuelo === null}
          capaAlto={capaAlto}
          onDestinoTitulo={setDestinoTitulo}
          onResponder={responder}
          onSeguir={seguirAhora}
        />
        {vuelo && destinoTitulo ? (
          <FraseVoladora
            key={vuelo.texto}
            texto={vuelo.texto}
            desde={vuelo.desde}
            hasta={destinoTitulo}
            onFin={() => setVuelo(null)}
          />
        ) : null}
        <Estallidos ref={estallidosRef} />
      </View>
    </Screen>
  );
}

/**
 * Tres opciones: la correcta y dos de otras frases del mismo montón.
 * Cuatro no caben junto al tablero sin hacer scroll, y hacer scroll en
 * medio de una pregunta rompe el ritmo del juego.
 */
function opcionesPara(o: DulceObjetivo, pool: Entry[]): string[] {
  const correcta = o.entry.spanish_main;
  const otras = shuffle(
    pool
      .filter((e) => e.id !== o.entry.id && e.spanish_main !== correcta)
      .map((e) => e.spanish_main)
  ).slice(0, 2);
  return shuffle([correcta, ...otras]);
}

/**
 * De los colores quitados en la jugada, cuál se lleva la voz del
 * match: el de más piezas y, en empate, el más cerca de llenar su
 * barra (ya con lo de esta jugada sumado).
 */
function mejorColor(
  porColor: Record<number, number>,
  objetivos: DulceObjetivo[]
): number | null {
  let mejor: number | null = null;
  let mejorPiezas = -1;
  let mejorCercania = -1;

  for (const [colStr, piezas] of Object.entries(porColor)) {
    const col = Number(colStr);
    const o = objetivos.find((x) => x.color === col);
    const cercania = o ? o.llevas / o.meta : 0;
    if (piezas > mejorPiezas || (piezas === mejorPiezas && cercania > mejorCercania)) {
      mejor = col;
      mejorPiezas = piezas;
      mejorCercania = cercania;
    }
  }
  return mejor;
}

const styles = StyleSheet.create({
  // `Screen` suma un colchón abajo cuando no hay footer: aquí el contenido llega hasta el borde seguro.
  sinHueco: { paddingBottom: 0 },
  capa: { flex: 1 },
  top: { paddingHorizontal: space.lg, paddingTop: space.sm },
  medio: { flex: 1 },
  medioContenido: { paddingBottom: space.sm },
  metas: { paddingHorizontal: space.lg, marginBottom: space.md },
  esqueletoRaiz: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.xl, alignItems: 'center' },
  esqueletoMetas: { flexDirection: 'row', gap: space.md },
  esqueletoTablero: { gap: space.xs },
  esqueletoFila: { flexDirection: 'row', gap: space.xs },
});
