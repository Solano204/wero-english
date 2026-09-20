import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Button,
  EmptyState,
  ErrorCarga,
  Header,
  Icon,
  ProgressBar,
  RoundTimer,
  Screen,
} from '@/components/base';
import { Trozos, useReaccion } from '@/components/feedback';
import { buildRounds, estaCompleta, pistaPara, vaBien } from '@/domain/colmena';
import { useNivel } from './useNivel';
import { applyGameGrade } from '@/db/games';
import { getRandomSpellable } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore, useSettingsStore } from '@/store';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { color, font, layout, radius, space, aparecer } from '@/theme';
import type { ColmenaRound, NivelColmena } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Ruta = RouteProp<RootStackParams, 'Colmena'>;

/** Cuántas veces se puede escuchar la palabra completa por ronda. */
const ESCUCHAS_POR_RONDA = 2;

/** Cuánto se bloquea "Siguiente" tras tocarlo, para no procesar dos toques. */
const AVANZAR_DEBOUNCE_MS = 400;

/**
 * A partir de cuántas fichas el teclado empieza a apretar. Con señuelos,
 * una palabra larga puede traer hasta ~26 fichas (tope de 22 letras en
 * esUsable + 4 señuelos como máximo en los niveles); de ahí para arriba
 * conviene encoger antes de que el teclado se desborde.
 */
const MUCHAS_LETRAS = 16;

/** Lado de cada ficha de letra: se encoge con muchas fichas, nunca por
 * debajo del mínimo táctil de la app (layout.tapMin, ya arriba de 44px). */
function ladoLetra(cantidad: number): number {
  return cantidad > MUCHAS_LETRAS ? layout.tapMin : 54;
}

/** Espacio entre fichas: igual que el lado, se aprieta con muchas letras. */
function huecoLetras(cantidad: number): number {
  return cantidad > MUCHAS_LETRAS ? space.xs : space.sm;
}

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
    };
  }, []);

  const [rounds, setRounds] = useState<ColmenaRound[]>([]);
  // Cara y cubitos. El numero se relanza en cada respuesta;
  // no hace falta apagarlo con un temporizador.
  const reaccion = useReaccion();
  const [idx, setIdx] = useState(0);
  const [armado, setArmado] = useState('');
  const [usadas, setUsadas] = useState<number[]>([]);
  const [aciertos, setAciertos] = useState(0);
  const [resuelta, setResuelta] = useState(false);
  // Las pistas ya no se compran: el nivel trae las que trae.
  const [pistas, setPistas] = useState(0);
  // Escuchas de la PALABRA completa (independientes de las pistas de
  // letra): dos por ronda, se reinician con cada una.
  const [escuchas, setEscuchas] = useState(ESCUCHAS_POR_RONDA);
  const [sonandoEscuchar, setSonandoEscuchar] = useState(false);
  // Evita doble toque en "Siguiente": se levanta solo a los 400ms.
  const [avanzando, setAvanzando] = useState(false);
  const avanzandoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const empezoEn = useRef(Date.now());
  const shake = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

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

  useEffect(() => {
    empezoEn.current = Date.now();
    setArmado('');
    setUsadas([]);
    setResuelta(false);
    setEscuchas(ESCUCHAS_POR_RONDA);
    setSonandoEscuchar(false);
  }, [idx]);

  const tocarLetra = useCallback(
    (i: number, viaPista = false) => {
      if (!round || resuelta || usadas.includes(i)) return;
      const letra = round.letras[i] ?? '';
      const siguiente = armado + letra;

      if (!vaBien(round.objetivo, siguiente)) {
        // Letra equivocada: se sacude y no se acepta. No se descuenta
        // nada, no hay vidas y no se acaba la partida. El SFX es el
        // mismo "fail" suave del resto de la app: ni esto es un regaño.
        haptics.failure();
      reaccion.falla();
        void audio.playFail();
        shake.value = withSequence(
          withTiming(-8, { duration: 55 }),
          withTiming(8, { duration: 55 }),
          withSpring(0)
        );
        return;
      }

      haptics.tapLight();
      // Si vino de "Pista", ya sonó su propio empujoncito: un tap encima
      // sería ruido, no confirmación.
      if (!viaPista) void audio.playTap();
      setArmado(siguiente);
      setUsadas((prev) => [...prev, i]);

      if (estaCompleta(round.objetivo, siguiente)) {
        setResuelta(true);
        setAciertos((a) => a + 1);
        haptics.success();
      reaccion.celebra();
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
    [round, resuelta, usadas, armado, shake, user]
  );

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
    await audio.play(round.entry.audio_en);
    await audio.waitUntilDone();
    setSonandoEscuchar(false);
  }, [round, resuelta, sonandoEscuchar, escuchas]);

  const siguiente = useCallback(() => {
    // Bloquea el botón ~400ms: sin esto, dos toques rápidos podían
    // procesar dos avances y disparar dos veces la lógica de abajo.
    if (avanzando) return;
    setAvanzando(true);
    if (avanzandoTimer.current) clearTimeout(avanzandoTimer.current);
    avanzandoTimer.current = setTimeout(() => setAvanzando(false), AVANZAR_DEBOUNCE_MS);

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
    setIdx((i) => i + 1);
  }, [avanzando, idx, rounds.length, aciertos, nav, nivel]);

  /**
   * Se acabó el tiempo.
   *
   * Se revela la palabra y se califica como fallo, igual que rendirse.
   * No se acaba la partida: perder el nivel entero por una ronda lenta
   * convertiría el reloj en un castigo en vez de en presión.
   */
  const seAcaboElTiempo = useCallback(async () => {
    if (!user || !round || resuelta) return;
    setResuelta(true);
    setArmado(round.objetivo);
    haptics.failure();
      reaccion.falla();
    void audio.playRoundResultBilingue(false, round.entry.audio_en, round.entry.audio_es);
    await applyGameGrade(
      user.id,
      round.entry.id,
      false,
      Date.now() - empezoEn.current,
      'producir'
    );
  }, [user, round, resuelta]);

  const rendirse = useCallback(async () => {
    if (!user || !round || resuelta) return;
    setResuelta(true);
    setArmado(round.objetivo);
    void audio.playRoundResultBilingue(false, round.entry.audio_en, round.entry.audio_es);
    await applyGameGrade(
      user.id,
      round.entry.id,
      false,
      Date.now() - empezoEn.current,
      'producir'
    );
  }, [user, round, resuelta]);

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
      <Screen>
        <Header onBack={() => nav.goBack()} title="Colmena" />
        <View style={styles.center}>
          <Text style={styles.loading}>Armando el tablero…</Text>
        </View>
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

  if (!round) return null;

  const puedePista =
    !resuelta && pistas > 0 && armado.length < round.objetivo.length;

  const tamLetra = ladoLetra(round.letras.length);
  const gapLetras = huecoLetras(round.letras.length);

  return (
    <Screen
      padded={false}
      footer={
        // Zona 3, fija: nunca se mueve ni se tapa, sin importar cuánto
        // crezca el teclado de arriba (ver Screen.tsx: con footer, la
        // pantalla ya no reserva el colchón de tab bar que le robaba
        // espacio a la zona de en medio).
        <View style={styles.pie}>
          {resuelta ? (
            <Button
              icon={idx + 1 >= rounds.length ? 'check' : 'arrow-right'}
              accessibilityLabel={
                idx + 1 >= rounds.length ? 'Terminar' : 'Siguiente'
              }
              onPress={siguiente}
              disabled={avanzando}
              full
              size="lg"
            />
          ) : (
            <View style={styles.pieRow}>
              <Button
                icon="hint"
                label={`Pista ${pistas}`}
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
          <Text style={styles.nota}>
            Sin reloj y sin vidas. Puedes salir cuando quieras.
          </Text>
        </View>
      }
    >
      <Trozos disparo={reaccion.trozos} tinte={color.world.fonetica} x="50%" y="50%" />
      <View style={styles.top}>
        <Header
          onBack={() => nav.goBack()}
          title={nivel ? `Nivel ${nivel}` : undefined}
          right={
            <Text style={styles.contador}>
              {idx + 1} de {rounds.length}
            </Text>
          }
        />
        <ProgressBar value={idx} total={rounds.length} />

        {nv ? (
          <View style={styles.reloj}>
            <RoundTimer
              segundos={nv.segundosRonda}
              llave={`${nivel ?? 0}-${idx}`}
              pausado={resuelta}
              onFin={() => void seAcaboElTiempo()}
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

        {!resuelta ? (
          <Pressable
            onPress={() => void escucharPalabra()}
            disabled={escuchas <= 0 || sonandoEscuchar}
            accessibilityRole="button"
            accessibilityLabel="Escuchar la palabra"
            accessibilityState={{ disabled: escuchas <= 0 || sonandoEscuchar }}
            hitSlop={8}
            style={({ pressed }) => [
              styles.escuchar,
              (escuchas <= 0 || sonandoEscuchar) && styles.escucharApagado,
              pressed && escuchas > 0 && !sonandoEscuchar && styles.escucharPress,
            ]}
          >
            <View style={styles.escucharFila}>
              <Icon
                name="volume"
                size="md"
                color={escuchas <= 0 || sonandoEscuchar ? color.textFaint : color.accent}
              />
              <Text
                style={[
                  styles.escucharTexto,
                  (escuchas <= 0 || sonandoEscuchar) && styles.escucharTextoApagado,
                ]}
              >
                {escuchas}
              </Text>
            </View>
          </Pressable>
        ) : null}

        <Animated.View style={[styles.huecos, anim]}>
          {round.objetivo.split('').map((c, i) => (
            <View
              key={`hueco-${i}`}
              style={[styles.hueco, i < armado.length && styles.huecoLleno]}
            >
              <Text style={styles.huecoTexto}>
                {i < armado.length ? armado[i] : ' '}
              </Text>
            </View>
          ))}
        </Animated.View>

        {resuelta ? (
          <Animated.View entering={aparecer()} style={styles.revelado}>
            <Text style={styles.frase}>{round.entry.phrase}</Text>
            <Text style={styles.fraseEs}>{round.entry.spanish_main}</Text>
          </Animated.View>
        ) : (
          <View style={[styles.letras, { gap: gapLetras }]}>
            {round.letras.map((l, i) => {
              const gastada = usadas.includes(i);
              return (
                <Pressable
                  key={`letra-${i}`}
                  onPress={() => tocarLetra(i)}
                  disabled={gastada}
                  accessibilityRole="button"
                  accessibilityLabel={`Letra ${l}`}
                  hitSlop={4}
                  style={({ pressed }) => [
                    styles.letra,
                    { width: tamLetra, height: tamLetra },
                    gastada && styles.letraGastada,
                    pressed && !gastada && styles.letraPress,
                  ]}
                >
                  <Text
                    style={[styles.letraTexto, gastada && styles.letraTextoOff]}
                  >
                    {l}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.lg, paddingTop: space.sm },
  contador: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  reloj: { marginTop: space.sm },
  body: { flex: 1 },
  bodyContenido: {
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
  escuchar: {
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  escucharApagado: { backgroundColor: color.surfaceHigh },
  escucharPress: { opacity: 0.75 },
  escucharFila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  escucharTexto: {
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
    color: color.accent,
  },
  escucharTextoApagado: { color: color.textFaint },
  huecos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.xs,
  },
  hueco: {
    minWidth: 30,
    height: 40,
    borderRadius: radius.sm,
    borderBottomWidth: 2,
    borderBottomColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  huecoLleno: {
    backgroundColor: color.accentSoft,
    borderBottomColor: color.accent,
  },
  huecoTexto: {
    fontSize: font.size.xl,
    color: color.text,
    fontFamily: font.family.heading,
  },
  letras: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    flexShrink: 1,
  },
  letra: {
    // Lado fijado en el render según ladoLetra(): aquí solo el resto.
    borderRadius: radius.md,
    backgroundColor: color.surfaceAlt,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letraGastada: { backgroundColor: color.surface, borderColor: color.surface },
  letraPress: { opacity: 0.7 },
  letraTexto: {
    fontSize: font.size.xl,
    color: color.text,
    fontFamily: font.family.heading,
  },
  letraTextoOff: { color: 'transparent' },
  revelado: { alignItems: 'center', gap: space.xs },
  frase: {
    fontSize: font.size.lg,
    color: color.correct,
    fontFamily: font.family.heading,
    textAlign: 'center',
  },
  fraseEs: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
    textAlign: 'center',
  },
  // El footer de Screen ya pone el padding horizontal y el de abajo
  // (con SafeArea incluida): aquí solo el espacio entre la fila de
  // botones y la nota.
  pie: { gap: space.sm },
  pieRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  grow: { flex: 1 },
  nota: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.md },
});
