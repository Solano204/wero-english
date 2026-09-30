import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Path, Skia, SweepGradient, vec, type SkPath } from '@shopify/react-native-skia';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { color, font, motionDuration, motionEasing, motionRadio, radius, senal } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';
import { FxSeguro } from './FxSeguro';
import { energiaEn } from './OndaVoz';
import { useSenalActiva } from './useSenalActiva';
import type { VozEnVivo } from './useVozEnVivo';

/** Barras de la onda circular y cuánto miden en reposo (un punto: el anillo plano). */
const BARRAS = 60;
const MIN_BARRA = 3;
const GROSOR = 3;
/** Radio interior de las barras, como fracción del diámetro. */
const RADIO_INTERIOR = 0.34;
/** Ciclos por segundo de audio del vaivén de las barras. */
const VAIVEN = 2.4;
const OPACIDAD_REPOSO = 0.5;

const ANCHO_PILDORA = 96;
const ALTO_PILDORA = 36;
const PERSPECTIVA = 260;
const ETIQUETA = { en: 'Inglés', es: 'Español' } as const;
// Copias locales: un worklet captura un texto, no el objeto de tema entero.
const COLOR_EN = color.accent;
const COLOR_ES = color.text;

/** Traza las barras radiales alrededor del centro como un solo `SkPath`. */
function trazarAnillo(diametro: number, energia: number, fase: number): SkPath {
  'worklet';
  const trazo = Skia.Path.Make();
  const c = diametro / 2;
  const r0 = diametro * RADIO_INTERIOR;
  const maximo = c - 2 - r0;
  for (let i = 0; i < BARRAS; i++) {
    const t = i / BARRAS;
    const angulo = t * 2 * Math.PI - Math.PI / 2;
    // Múltiplos enteros de t: la forma cierra sin costura al dar la vuelta.
    const a = 0.5 + 0.5 * Math.sin(2 * Math.PI * (fase + 3 * t));
    const b = 0.5 + 0.5 * Math.sin(2 * Math.PI * (fase * 1.7 - 5 * t) + 0.9);
    const forma = 0.25 + 0.75 * (0.6 * a + 0.4 * b);
    const largo = Math.min(maximo, Math.max(MIN_BARRA, maximo * energia * forma));
    const cos = Math.cos(angulo);
    const sen = Math.sin(angulo);
    trazo.moveTo(c + cos * r0, c + sen * r0);
    trazo.lineTo(c + cos * (r0 + largo), c + sen * (r0 + largo));
  }
  return trazo;
}

interface BarrasProps {
  voz: VozEnVivo;
  envolvente: number[];
  diametro: number;
  bolsillo: boolean;
}

function Barras({ voz, envolvente, diametro, bolsillo }: BarrasProps) {
  const { pos, activa, sonando } = voz;
  const { activo } = useSenalActiva();
  const env = useSharedValue<number[]>(envolvente);
  const energia = useSharedValue(0);
  const fase = useSharedValue(0);
  const acumulado = useSharedValue(0);
  const intervalo = useSharedValue<number>(motionRadio.cuadro);

  useEffect(() => {
    env.value = envolvente;
  }, [envolvente, env]);

  useEffect(() => {
    intervalo.value = bolsillo ? motionRadio.cuadroBolsillo : motionRadio.cuadro;
  }, [bolsillo, intervalo]);

  // La energía y la fase salen de la posición del audio, sin re-render de React y a lo sumo cada `intervalo` ms:
  // en bolsillo el anillo se dibuja a 30 fps.
  const control = useFrameCallback((cuadro) => {
    'worklet';
    acumulado.value += cuadro.timeSincePreviousFrame ?? 0;
    if (acumulado.value < intervalo.value) return;
    acumulado.value = 0;
    energia.value = energiaEn(env.value, pos.value) * activa.value;
    fase.value = Math.max(0, pos.value) * VAIVEN;
  }, false);

  // Solo corre mientras suena la voz y hay foco (y sin «reducir movimiento»): en pausa, sin sonido o en segundo
  // plano no cuesta ni un cuadro y el anillo queda plano.
  const corre = activo && sonando;
  useEffect(() => {
    control.setActive(corre);
    if (!corre) energia.value = 0;
    return () => control.setActive(false);
  }, [corre, control, energia]);

  const trazo = useDerivedValue(() => trazarAnillo(diametro, energia.value, fase.value));
  const opacidad = useDerivedValue(() => OPACIDAD_REPOSO + (1 - OPACIDAD_REPOSO) * activa.value);
  const c = diametro / 2;
  const centro = vec(c, c);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
      <Circle c={centro} r={diametro * RADIO_INTERIOR - 10} color={color.accentSoft} />
      <Circle c={centro} r={diametro * RADIO_INTERIOR - 4} style="stroke" strokeWidth={2} color={color.borderStrong} />
      <Path path={trazo} style="stroke" strokeWidth={GROSOR} strokeCap="round" opacity={opacidad}>
        <SweepGradient c={centro} colors={[senal[0], senal[1], senal[2], senal[1], senal[0]]} />
      </Path>
    </Canvas>
  );
}

interface PildoraProps {
  idioma: 'en' | 'es';
  activo: boolean;
}

/** «Inglés» o «Español» al centro del anillo: cambia con un flip vertical cada vez que cambia el idioma. */
function Pildora({ idioma, activo }: PildoraProps) {
  const reducido = useMovimientoReducido();
  const flip = useSharedValue(idioma === 'es' ? 1 : 0);

  useEffect(() => {
    const destino = idioma === 'es' ? 1 : 0;
    flip.value = reducido ? destino : withTiming(destino, { duration: motionDuration.base, easing: motionEasing.entrar });
  }, [idioma, reducido, flip]);

  // Cada cara gira hasta quedar de canto (a la mitad del flip) y la otra sale de canto: el texto cambia sin que
  // se vean las dos a la vez. Con «reducir movimiento» no hay giro: se cambia de cara y solo cambia el color.
  const en = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [
      { perspective: PERSPECTIVA },
      { rotateX: `${interpolate(flip.value, [0, 0.5], [0, -90], Extrapolation.CLAMP)}deg` },
    ],
  }));
  const es = useAnimatedStyle(() => ({
    opacity: flip.value >= 0.5 ? 1 : 0,
    transform: [
      { perspective: PERSPECTIVA },
      { rotateX: `${interpolate(flip.value, [0.5, 1], [90, 0], Extrapolation.CLAMP)}deg` },
    ],
  }));

  return (
    <View
      style={[styles.pildora, !activo && styles.enPausa]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Idioma: ${ETIQUETA[idioma]}`}
    >
      <Animated.Text style={[styles.etiqueta, styles.cara, { color: COLOR_EN }, en]}>{ETIQUETA.en}</Animated.Text>
      <Animated.Text style={[styles.etiqueta, styles.cara, { color: COLOR_ES }, es]}>{ETIQUETA.es}</Animated.Text>
    </View>
  );
}

interface Props {
  /** La voz que suena ahora (la del inglés o la del español) y su energía (`analizar().envolvente`). */
  voz: VozEnVivo;
  envolvente: number[];
  diametro: number;
  /** El idioma del paso en curso: lo dice la píldora del centro. */
  idioma: 'en' | 'es';
  /** La secuencia está sonando (no en pausa). */
  activo: boolean;
  /** Modo bolsillo: el anillo se dibuja como mucho a 30 fps. */
  bolsillo: boolean;
}

/**
 * La radio de Modo oído: un anillo de barras radiales que suben con la voz que suena y se aplanan al terminar o al
 * pausar (el anillo se congela solo, sin bucle propio), y al centro la píldora del idioma. La energía sale de los
 * tiempos de palabra, no de la amplitud real del audio. Con «reducir movimiento» el anillo queda plano y la píldora
 * cambia sin girar. Si Skia falla, queda la píldora.
 */
export function AnilloRadio({ voz, envolvente, diametro, idioma, activo, bolsillo }: Props) {
  return (
    <View style={[styles.raiz, { width: diametro, height: diametro }]}>
      <FxSeguro>
        <Barras voz={voz} envolvente={envolvente} diametro={diametro} bolsillo={bolsillo} />
      </FxSeguro>
      <Pildora idioma={idioma} activo={activo} />
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { alignItems: 'center', justifyContent: 'center' },
  pildora: {
    width: ANCHO_PILDORA,
    height: ALTO_PILDORA,
    borderRadius: radius.pill,
    backgroundColor: color.accentSoft,
    borderWidth: 1,
    borderColor: color.accentBorde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enPausa: { opacity: 0.6 },
  cara: { position: 'absolute' },
  etiqueta: { fontFamily: font.family.bodyStrong, fontSize: font.size.md },
});
