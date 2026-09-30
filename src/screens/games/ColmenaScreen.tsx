import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, EmptyState, ErrorCarga, Header, Screen } from '@/components/base';
import { Hueso, HuesoBoton, ProveedorEsqueleto } from '@/components/esqueleto';
import { Marcador } from '@/components/fx';
import { BloqueEscuchar } from '@/components/juegos/colmena/BloqueEscuchar';
import { FraseResuelta } from '@/components/juegos/colmena/FraseResuelta';
import { disposicionPanal, distribuirRanuras, fichasParaCompletar, retrasoVuelo } from '@/components/juegos/colmena/geometria';
import { DURACION_VUELO, type Vuelo } from '@/components/juegos/colmena/Hexagono';
import { Panal, type Colocada, type RechazoFicha } from '@/components/juegos/colmena/Panal';
import { ProgresoHex } from '@/components/juegos/colmena/ProgresoHex';
import { RanurasPalabra, fuenteDeRanura } from '@/components/juegos/colmena/RanurasPalabra';
import { useVozRonda } from '@/components/juegos/colmena/useVozRonda';
import { RelojRonda } from '@/components/juegos/pares/RelojRonda';
import { buildRounds, estaCompleta, pistaPara, vaBien } from '@/domain/colmena';
import { useNivel } from './useNivel';
import { applyGameGrade } from '@/db/games';
import { getRandomSpellable } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore, useSettingsStore } from '@/store';
import { useMovimientoReducido } from '@/utils';
import { formaPalabras } from '@/utils/text';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import { useCortarAudioAlSalir } from '@/hooks/useCortarAudioAlSalir';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { color, font, layout, radius, space, motionColmena, motionDuration } from '@/theme';
import type { ColmenaRound, NivelColmena } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Ruta = RouteProp<RootStackParams, 'Colmena'>;

/** Cuántas veces se puede escuchar la palabra completa por ronda. */
const ESCUCHAS_POR_RONDA = 2;

/** Las ranuras de la frase: 32 × 40, con los espacios de la escala (letras, palabras y líneas). */
const RANURAS = {
  hueco: space.xs,
  entrePalabras: space.lg,
  entreLineas: space.sm,
  anchoBase: 32,
  altoBase: 40,
  anchoMin: 12,
};

/**
 * El panal: cada fila mide `layout.tapMin` de alto (esa es el área táctil de cada ficha). El hueco es de 5 y no de 4
 * para que la sexta columna quepa en los 328 dp de un teléfono de 360.
 */
const PANAL = { toqueMin: layout.tapMin, hueco: 5 };

/** La pista enciende su ficha en `senal` este rato antes de que salga sola. */
const PISTA_BRILLO_MS = motionDuration.base;

/** Cuánto se bloquea "Siguiente" tras tocarlo, para no procesar dos toques. */
const AVANZAR_DEBOUNCE_MS = 400;

/**
 * P-24, Colmena.
 *
 * Se ve el español y se arma la palabra en inglés tocando letras.
 * Es producción pura disfrazada de juego: exige recordar la ortografía
 * completa igual que Escribir, pero sin teclado y sin castigar el dedo.
 *
 * Cada ronda escribe una calificación SM-2 real, así que jugar adelanta
 * la cola de repaso en vez de robarle tiempo.
 */
export function ColmenaScreen() {
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
    };
  }, []);

  const [rounds, setRounds] = useState<ColmenaRound[]>([]);
  const [idx, setIdx] = useState(0);
  const [armado, setArmado] = useState('');
  const [usadas, setUsadas] = useState<number[]>([]);
  const [aciertos, setAciertos] = useState(0);
  const [resuelta, setResuelta] = useState(false);
  // Desde qué ranura completó la ayuda («No me sale» o el tiempo); null si la ronda la armó quien juega.
  const [ayudaDesde, setAyudaDesde] = useState<number | null>(null);
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
  // Qué ronda ya se resolvió. El reloj avisa desde el hilo de UI y puede
  // llegar en el mismo instante que la última letra o «No me sale», con
  // un `resuelta` todavía viejo: esta ref corta la segunda resolución.
  const resueltaEn = useRef(-1);
  // Al pasar de ronda el panal se deshace primero; este es el reloj que espera a que salga.
  const [saliendo, setSaliendo] = useState(false);
  const salidaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducido = useMovimientoReducido();
  // La ronda terminó porque se acabó el tiempo (y no porque quien juega se rindió).
  const [seAcabo, setSeAcabo] = useState(false);

  const empezoEn = useRef(Date.now());
  // Lo que solo se dibuja: qué fichas vuelan y hacia dónde, y la última letra que no iba.
  const [colocadas, setColocadas] = useState<Colocada[]>([]);
  const [rechazo, setRechazo] = useState<RechazoFicha | null>(null);
  const rechazoId = useRef(0);
  // Dónde queda cada caja en el contenido del scroll: los vuelos se calculan contra estas dos.
  const origenRanuras = useRef({ x: 0, y: 0 });
  const origenPanal = useRef({ x: 0, y: 0 });
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
  const { width: anchoVentana } = useWindowDimensions();
  // La forma de las palabras solo dibuja: la comparación sigue siendo sobre `objetivo`, sin espacios.
  const forma = useMemo(() => {
    if (!round) return [];
    const largos = formaPalabras(round.entry.phrase_tts);
    // Por si algún día la forma no suma lo que hay que armar: una sola palabra, sin perder ninguna letra.
    return largos.reduce((a, n) => a + n, 0) === round.objetivo.length ? largos : [round.objetivo.length];
  }, [round]);
  const distribucion = useMemo(
    () => distribuirRanuras(forma, anchoVentana - space.lg * 2, RANURAS),
    [forma, anchoVentana]
  );
  const disposicion = useMemo(
    () => disposicionPanal(round?.letras.length ?? 0, anchoVentana - space.lg * 2, PANAL),
    [round, anchoVentana]
  );
  // Cada letra aparece en su ranura cuando llega la ficha que vuela hasta ella.
  const retrasos = useMemo(() => {
    const r: number[] = [];
    for (const c of colocadas) r[c.ranura] = c.retraso + DURACION_VUELO;
    return r;
  }, [colocadas]);

  const aterrizaMs = useMemo(() => retrasos.reduce((m, r) => Math.max(m, r ?? 0), 0), [retrasos]);

  // El lector de pantalla oye la frase completa cuando se resuelve la ronda.
  useEffect(() => {
    if (!resuelta || !round) return;
    const frase = round.entry.phrase;
    AccessibilityInfo.announceForAccessibility(
      ayudaDesde === null ? `Frase completa: ${frase}` : `${seAcabo ? 'Se acabó el tiempo. ' : ''}La frase era: ${frase}`
    );
    // Solo cuenta el momento de resolverse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resuelta]);

  /** El vuelo de una ficha del panal a una ranura, del centro de una al centro de la otra. */
  const vueloA = useCallback(
    (ficha: number, ranura: number, tipo: Vuelo['tipo'], retraso: number): Vuelo | null => {
      const h = disposicion.hexagonos[ficha];
      const r = distribucion.ranuras[ranura];
      if (!h || !r) return null;
      const centroFichaX = origenPanal.current.x + h.x + disposicion.hexAncho / 2;
      const centroFichaY = origenPanal.current.y + h.y + disposicion.hexAlto / 2;
      const centroRanuraX = origenRanuras.current.x + r.x + distribucion.ranuraAncho / 2;
      const centroRanuraY = origenRanuras.current.y + r.y + distribucion.ranuraAlto / 2;
      return {
        dx: centroRanuraX - centroFichaX,
        dy: centroRanuraY - centroFichaY,
        ranuraAncho: distribucion.ranuraAncho,
        ranuraAlto: distribucion.ranuraAlto,
        fuente: fuenteDeRanura(distribucion.ranuraAncho),
        retraso,
        tipo,
      };
    },
    [disposicion, distribucion]
  );

  /** Las fichas que faltan vuelan una por una a su ranura («No me sale» y el tiempo). Solo dibuja. */
  const volarFaltantes = useCallback(() => {
    if (!round) return;
    const fichas = fichasParaCompletar(round.letras, usadas, round.objetivo, armado.length);
    const nuevas: Colocada[] = [];
    fichas.forEach((ficha, j) => {
      const ranura = armado.length + j;
      const vuelo = vueloA(ficha, ranura, 'ayuda', retrasoVuelo(j, fichas.length));
      if (vuelo) nuevas.push({ ...vuelo, ficha, ranura });
    });
    setColocadas((prev) => [...prev, ...nuevas]);
  }, [round, usadas, armado, vueloA]);

  useEffect(() => {
    empezoEn.current = Date.now();
    setArmado('');
    setUsadas([]);
    setResuelta(false);
    setAyudaDesde(null);
    setSeAcabo(false);
    setSaliendo(false);
    setEscuchas(ESCUCHAS_POR_RONDA);
    setSonandoEscuchar(false);
  }, [idx]);

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
        // La ficha se asoma hacia la ranura que sigue y regresa; ahí no hay nada que descontar.
        const hacia = vueloA(i, armado.length, 'toque', 0);
        if (hacia) setRechazo({ id: ++rechazoId.current, ficha: i, dx: hacia.dx, dy: hacia.dy });
        return;
      }

      haptics.tapLight();
      // Si vino de "Pista", ya sonó su propio empujoncito: un tap encima
      // sería ruido, no confirmación.
      if (!viaPista) void audio.playTap();
      setArmado(siguiente);
      setUsadas((prev) => [...prev, i]);
      const vuelo = vueloA(i, armado.length, viaPista ? 'pista' : 'toque', viaPista ? PISTA_BRILLO_MS : 0);
      if (vuelo) setColocadas((prev) => [...prev, { ...vuelo, ficha: i, ranura: armado.length }]);

      if (estaCompleta(round.objetivo, siguiente)) {
        resueltaEn.current = idx;
        setResuelta(true);
        setAciertos((a) => a + 1);
        haptics.success();
        void audio.playRoundResultBilingue(true, round.entry.audio_en, round.entry.audio_es);
        if (user) {
          void applyGameGrade(
            user.id,
            round.entry.id,
            true,
            Date.now() - empezoEn.current,
            'producir'
          );
        }
      }
    },
    [round, resuelta, idx, usadas, armado, vueloA, user]
  );

  // El panal no se vuelve a pintar entero con cada letra: las fichas reciben siempre la misma función.
  const tocarRef = useRef(tocarLetra);
  tocarRef.current = tocarLetra;
  const alTocarFicha = useCallback((ficha: number) => tocarRef.current(ficha), []);

  const usarPista = useCallback(() => {
    if (!round || resuelta || pistas <= 0) return;

    const letra = pistaPara(round.objetivo, armado);
    if (!letra) return;

    // La pista pone la letra que sigue, nunca resuelve la palabra: si
    // terminara el ejercicio, no sería un empujón sino la respuesta.
    const i = round.letras.findIndex(
      (l, k) => l === letra && !usadas.includes(k)
    );
    if (i >= 0) {
      setPistas((n) => n - 1);
      void audio.playPista();
      tocarLetra(i, true);
    }
  }, [round, resuelta, pistas, armado, usadas, tocarLetra]);

  /**
   * Escuchar la palabra completa en inglés. Independiente de las pistas
   * de letra: dos usos por ronda, y no gasta nada si ya no quedan.
   *
   * Si se toca mientras suena, audio.play() reutiliza el mismo player
   * (mismo relPath) y solo rebobina: nunca se encima, y como el botón
   * ya está bloqueado por sonandoEscuchar, no hay forma normal de que
   * esto se dispare dos veces por el mismo uso.
   */
  const escucharPalabra = useCallback(async () => {
    if (!round || resuelta || sonandoEscuchar || escuchas <= 0) return;
    setEscuchas((n) => n - 1);
    setSonandoEscuchar(true);
    try {
      await audio.play(round.entry.audio_en);
      await audio.waitUntilDone();
    } finally {
      // Pase lo que pase (audio.ts ya pone su propio tope, pero el
      // candado de este botón se libera aquí siempre): "Escuchar" nunca
      // se queda deshabilitado el resto de la ronda.
      setSonandoEscuchar(false);
    }
  }, [round, resuelta, sonandoEscuchar, escuchas]);

  // Qué ronda ya mandó a avanzarRonda: una sola vez por ronda, sin
  // importar si lo dispara el temporizador de salida o «Siguiente» de
  // nuevo mientras el primero seguía en camino.
  const avanzadaDesde = useRef(-1);

  /** Pasa a la ronda que sigue. Lo de la ronda que se deja se limpia junto con el cambio: la nueva no pinta ni un cuadro con ello. */
  const avanzarRonda = useCallback(() => {
    if (avanzadaDesde.current === idx) return;
    avanzadaDesde.current = idx;
    setColocadas([]);
    setRechazo(null);
    setArmado('');
    setUsadas([]);
    setResuelta(false);
    setAyudaDesde(null);
    setSeAcabo(false);
    setSaliendo(false);
    setIdx((i) => i + 1);
  }, [idx]);

  const siguiente = useCallback(() => {
    // Bloquea el botón ~400ms: sin esto, dos toques rápidos podían
    // procesar dos avances y disparar dos veces la lógica de abajo.
    if (candadoAvanzar.current) return;
    candadoAvanzar.current = true;
    setAvanzando(true);
    try {
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
      setSaliendo(true);
      if (salidaTimer.current) clearTimeout(salidaTimer.current);
      salidaTimer.current = setTimeout(avanzarRonda, motionColmena.salida);
    } finally {
      // Pase lo que pase arriba (un error, un retorno temprano), el
      // candado se suelta solo.
      if (avanzandoTimer.current) clearTimeout(avanzandoTimer.current);
      avanzandoTimer.current = setTimeout(() => {
        candadoAvanzar.current = false;
        setAvanzando(false);
      }, AVANZAR_DEBOUNCE_MS);
    }
  }, [idx, rounds.length, aciertos, nav, nivel, reducido, avanzarRonda]);

  /**
   * Se acabó el tiempo.
   *
   * Se revela la palabra y se califica como fallo, igual que rendirse.
   * No se acaba la partida: perder el nivel entero por una ronda lenta
   * convertiría el reloj en un castigo en vez de en presión.
   */
  const seAcaboElTiempo = useCallback(async () => {
    // La ronda se resuelve siempre, tenga o no `user`: antes este guard
    // cubría toda la función, así que sin `user` el tiempo se agotaba y
    // la ronda se quedaba pegada para siempre (nunca aparecía «Siguiente»).
    // Grabar la calificación sí depende de `user`; resolver la ronda no.
    if (!round || resuelta || resueltaEn.current === idx) return;
    resueltaEn.current = idx;
    setResuelta(true);
    setSeAcabo(true);
    setAyudaDesde(armado.length);
    volarFaltantes();
    setArmado(round.objetivo);
    haptics.failure();
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
  }, [user, round, resuelta, idx, armado, volarFaltantes]);

  const rendirse = useCallback(async () => {
    // Mismo arreglo que seAcaboElTiempo: "No me sale" tiene que resolver
    // la ronda aunque `user` no esté listo.
    if (!round || resuelta || resueltaEn.current === idx) return;
    resueltaEn.current = idx;
    setResuelta(true);
    setAyudaDesde(armado.length);
    volarFaltantes();
    setArmado(round.objetivo);
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
  }, [user, round, resuelta, idx, armado, volarFaltantes]);

  if (carga.estado === 'error') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Colmena" />
        <ErrorCarga onReintentar={carga.reintentar} />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen transicionCarga={carga.demora ? 'esqueleto' : undefined}>
        <Header onBack={() => nav.goBack()} title="Colmena" />
        {carga.demora ? (
          <>
            <ProveedorEsqueleto etiqueta="Armando el tablero" style={styles.esqueletoRaiz}>
              <View style={styles.esqueletoReloj}>
                <Hueso height={4} radius={radius.pill} />
              </View>
              <View style={styles.esqueletoCentro}>
                <Hueso width="70%" height={18} style={styles.esqueletoCentrado} />
                <Hueso width="55%" height={26} style={styles.esqueletoCentrado} />
              </View>
              <View style={styles.esqueletoEscuchar}>
                <HuesoBoton width={150} />
                <Hueso width={88} height={32} />
              </View>
              <View style={styles.esqueletoRanuras}>
                {Array.from({ length: 12 }, (_, i) => (
                  <Hueso key={i} width={28} height={36} />
                ))}
              </View>
              <View style={styles.esqueletoPanal}>
                {[6, 5, 6, 5].map((n, fila) => (
                  <View key={fila} style={[styles.esqueletoFilaPanal, fila % 2 === 1 && styles.esqueletoFilaCorrida]}>
                    {Array.from({ length: n }, (_, i) => (
                      <Hueso key={i} width={48} height={48} radius={radius.md} />
                    ))}
                  </View>
                ))}
              </View>
            </ProveedorEsqueleto>
            <View style={styles.pie}>
              <View style={styles.pieRow}>
                <HuesoBoton />
                <HuesoBoton />
              </View>
            </View>
          </>
        ) : null}
      </Screen>
    );
  }

  if (rounds.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Colmena" />
        <EmptyState
          icon="warning"
          title="No se pudo armar el tablero"
          body="No hay frases que quepan en la cuadrícula con los filtros que traes puestos. Prueba quitando el modo limpio o subiendo el nivel en Ajustes."
          actionLabel="Volver"
          onAction={() => nav.goBack()}
        />
      </Screen>
    );
  }

  // Entre la última ronda y el resumen no hay ronda: la pantalla nunca queda en blanco, sale con su encabezado.
  if (!round) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Colmena" />
      </Screen>
    );
  }

  // Todos los niveles traen reloj (de 22 a 60 s por ronda); sin él no hay barra.
  const tieneReloj = nv !== null && nv.segundosRonda > 0;
  // La nota dice solo lo que es verdad: con reloj, qué pasa cuando se acaba; sin él, que no hay ni reloj ni vidas.
  const nota = tieneReloj
    ? 'Sin vidas. Si se acaba el tiempo, ves la frase y sigues.'
    : 'Sin reloj y sin vidas. Puedes salir cuando quieras.';

  const puedePista =
    !resuelta && pistas > 0 && armado.length < round.objetivo.length;

  return (
    <Screen
      transicionCarga={carga.huboEsqueleto ? 'contenido' : undefined}
      padded={false}
      footer={
        // Zona 3, fija: nunca se mueve ni se tapa, sin importar cuánto
        // crezca el teclado de arriba (ver Screen.tsx: con footer, la
        // pantalla ya no reserva el colchón de tab bar que le robaba
        // espacio a la zona de en medio).
        <View style={styles.pie}>
          {resuelta ? (
            <Button
              label={idx + 1 >= rounds.length ? 'Terminar' : 'Siguiente'}
              icon={idx + 1 >= rounds.length ? 'check' : 'arrow-right'}
              iconAlFinal={idx + 1 < rounds.length}
              onPress={siguiente}
              disabled={avanzando}
              full
              size="lg"
            />
          ) : (
            <View style={styles.pieRow}>
              <Button
                icon="hint"
                label="Pista"
                accessibilityLabel={`Pista ${pistas}`}
                sufijo={<Marcador valor={pistas} tamano={font.size.md} color={color.text} />}
                variant="secondary"
                onPress={usarPista}
                disabled={!puedePista}
                style={styles.grow}
              />
              <Button
                icon="reveal"
                label="No me sale"
                variant="ghost"
                onPress={rendirse}
                style={styles.grow}
              />
            </View>
          )}
          <Text style={styles.nota}>{nota}</Text>
        </View>
      }
    >
      <View style={styles.top}>
        <Header onBack={() => nav.goBack()} title={nivel ? `Nivel ${nivel}` : undefined} />
        <ProgresoHex total={rounds.length} actual={idx} resuelta={resuelta} />

        {tieneReloj ? (
          <View style={styles.reloj}>
            <RelojRonda
              segundos={nv.segundosRonda}
              llave={`${nivel ?? 0}-${idx}`}
              pausado={resuelta}
              onFin={() => void seAcaboElTiempo()}
              etiqueta="Reloj de la ronda"
            />
          </View>
        ) : null}
      </View>

      {/*
       * Zona 1 (arriba, con scroll interno) y zona 2 (en medio, el
       * teclado) van en el MISMO ScrollView: así el teclado nunca puede
       * quedar clavado detrás de la barra fija de abajo, ni aunque una
       * palabra larguísima lo empuje más de lo que cabe en la pantalla.
       * flexShrink en la zona del teclado hace que, en el caso normal
       * (todo cabe), no se vea scroll ni falta espacio.
       */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContenido}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.instruccion}>¿Cómo se dice?</Text>
        <Text style={styles.pista}>{round.pista}</Text>

        <BloqueEscuchar
          escuchas={escuchas}
          sonando={sonandoEscuchar}
          voz={voz}
          envolvente={analisis?.envolvente ?? []}
          onEscuchar={() => void escucharPalabra()}
          visible={!resuelta}
        />

        <View
          onLayout={(e) => {
            origenRanuras.current = { x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y };
          }}
        >
          <RanurasPalabra
            key={idx}
            distribucion={distribucion}
            palabras={forma}
            objetivo={round.objetivo}
            armado={armado}
            resolucion={resuelta ? (ayudaDesde === null ? 'acierto' : 'ayuda') : null}
            desdeAyuda={ayudaDesde ?? round.objetivo.length}
            fallo={falloLetra}
            retrasos={retrasos}
          />
        </View>

        <View style={styles.espacio} />

        <View
          style={{ width: disposicion.ancho, minHeight: disposicion.alto }}
          onLayout={(e) => {
            origenPanal.current = { x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y };
          }}
        >
          <View style={styles.panalCapa}>
            <Panal
              key={idx}
              letras={round.letras}
              disposicion={disposicion}
              colocadas={colocadas}
              rechazo={rechazo}
              resuelta={resuelta}
              saliendo={saliendo}
              onTocar={alTocarFicha}
            />
          </View>
          {resuelta && analisis ? (
            <FraseResuelta
              key={idx}
              entry={round.entry}
              palabras={analisis.palabras}
              voz={voz}
              seAcabo={seAcabo}
              retraso={aterrizaMs}
              saliendo={saliendo}
              alto={disposicion.alto}
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.lg, paddingTop: space.sm },
  reloj: { marginTop: space.sm },
  body: { flex: 1 },
  // Con poco contenido el panal queda pegado abajo (zona del pulgar); con mucho, todo hace scroll.
  espacio: { flex: 1 },
  // El panal va en el lugar del wrapper sin darle altura: si la frase resuelta es más alta, el wrapper crece con ella.
  panalCapa: { position: 'absolute', left: 0, top: 0 },
  bodyContenido: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    gap: space.lg,
    paddingTop: space.lg,
    // Colchón extra antes del footer fijo: sumado al padding propio
    // del footer (ver Screen.tsx), deja al menos 16px libres entre el
    // teclado y la barra de Pista / No me sale.
    paddingBottom: space.sm,
  },
  instruccion: {
    fontSize: font.size.xs,
    color: color.textFaint,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    fontFamily: font.family.bodyStrong,
  },
  pista: {
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    fontFamily: font.family.display,
    color: color.text,
    textAlign: 'center',
  },
  // El footer de Screen ya pone el padding horizontal y el de abajo
  // (con SafeArea incluida): aquí solo el espacio entre la fila de
  // botones y la nota.
  pie: { gap: space.sm },
  // Alto fijo de «Siguiente»: el pie no cambia de tamaño al resolverse la ronda, y el panal no se corre mientras vuela la última ficha.
  pieRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center', minHeight: 58 },
  grow: { flex: 1 },
  nota: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
  },
  esqueletoRaiz: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.lg },
  esqueletoReloj: { marginBottom: space.sm },
  esqueletoCentro: { alignItems: 'center', gap: space.sm },
  esqueletoCentrado: { alignSelf: 'center' },
  esqueletoEscuchar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  esqueletoRanuras: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs },
  esqueletoPanal: { gap: space.xs, alignItems: 'center' },
  esqueletoFilaPanal: { flexDirection: 'row', gap: space.xs },
  esqueletoFilaCorrida: { marginLeft: space.xl },
});
