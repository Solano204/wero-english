import React, { memo, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Line, Polygon } from 'react-native-svg';
import type { VozEnVivo } from '@/components/fx';
import {
  INCLINACION,
  ORDEN_ES,
  PROPORCION,
  VOCALES_ES,
  cercanasEs,
  descripcionMapa,
  enTrapecio,
  posicionVocal,
  sinBarras,
} from '@/domain/vocales';
import { color, font, layout, motionDuration, motionSpring } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';

const MARGEN_IZQ = 20;
/** Arriba caben «anterior» y «posterior»; a la derecha, «cerrada» y «abierta». */
const MARGEN_ARRIBA = 32;
const MARGEN_ABAJO = 20;
const CANAL_DERECHO = 60;
const RADIO_FANTASMA = 11;
const RADIO_PUNTO = 15;
/** La estela: cuántos puntos deja el que viaja y qué tanto se atrasa cada uno (fracción del viaje). */
const ESTELA = 4;
const PASO_ESTELA = 0.09;
/** Cuánto crece el punto con la voz y cuántas veces late por segundo de audio. */
const LATIDO = 0.3;
const LATIDOS_POR_S = 3;
/** El viaje espera a que la página termine de aparecer. */
const ESPERA_MS = motionDuration.lento;

interface Punto {
  x: number;
  y: number;
}

interface EstelaProps {
  indice: number;
  progreso: SharedValue<number>;
  origen: Punto;
  destino: Punto;
}

/** Un punto de luz que sigue al que viaja, cada vez más atrás y más tenue, y se apaga al llegar. */
const Estela = memo(function Estela({ indice, progreso, origen, destino }: EstelaProps) {
  const k = indice + 1;
  const estilo = useAnimatedStyle(() => {
    const q = Math.min(1, Math.max(0, progreso.value - k * PASO_ESTELA));
    const x = origen.x + (destino.x - origen.x) * q - 5;
    const y = origen.y + (destino.y - origen.y) * q - 5;
    const sale = interpolate(progreso.value, [0.85, 1], [1, 0], Extrapolation.CLAMP);
    const entra = interpolate(progreso.value, [0, 0.05], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: (0.55 - k * 0.1) * sale * entra,
      transform: [{ translateX: x }, { translateY: y }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.estela, estilo]} />;
});

interface Props {
  /** El símbolo de la vocal (con o sin barras). Si no está en la tabla del IPA, no hay mapa. */
  ipa: string;
  /** Es la página que se ve: el punto viaja cuando entra a ella. */
  esActual: boolean;
  /** La voz del sonido aislado: el punto late con ella. */
  voz: VozEnVivo;
}

/**
 * El mapa de la boca: el trapecio de vocales del IPA (anterior a posterior, cerrada a abierta) con las cinco
 * vocales del español como puntos fantasma y la vocal inglesa como un punto de `accent` con su símbolo. Al entrar a
 * la página el punto sale de la vocal española más cercana en el mapa y viaja despacio, con resorte, hasta su lugar
 * real dejando una estela: así se ve, por ejemplo, que /ɪ/ está entre la i y la e. Al sonar el sonido aislado el
 * punto late con el audio. Con «reducir movimiento» aparece ya en su lugar, sin viaje, estela ni latido.
 */
export function MapaBoca({ ipa, esActual, voz }: Props) {
  const reducido = useMovimientoReducido();
  const { width } = useWindowDimensions();
  const progreso = useSharedValue(reducido ? 1 : 0);
  const { pos: posAudio, activa } = voz;

  useEffect(() => {
    if (reducido) {
      progreso.value = 1;
      return;
    }
    progreso.value = esActual ? withDelay(ESPERA_MS, withSpring(1, motionSpring.viaje)) : 0;
  }, [esActual, reducido, progreso]);

  const g = useMemo(() => {
    const p = posicionVocal(ipa);
    if (!p) return null;
    const ancho = width - layout.screenPad * 2;
    const w = ancho - MARGEN_IZQ - CANAL_DERECHO;
    const h = w * PROPORCION;
    const aPunto = (q: { atras: number; abierta: number }): Punto => {
      const t = enTrapecio(q);
      return { x: MARGEN_IZQ + t.x * w, y: MARGEN_ARRIBA + t.y * w };
    };
    const cercana = cercanasEs(p)[0]?.vocal ?? 'i';
    return {
      ancho,
      alto: h + MARGEN_ARRIBA + MARGEN_ABAJO,
      w,
      h,
      real: aPunto(p),
      origen: aPunto(VOCALES_ES[cercana]),
      fantasmas: ORDEN_ES.map((v) => ({ vocal: v, ...aPunto(VOCALES_ES[v]) })),
    };
  }, [ipa, width]);

  const real = g?.real ?? { x: 0, y: 0 };
  const origen = g?.origen ?? { x: 0, y: 0 };
  const estiloPunto = useAnimatedStyle(() => {
    const q = progreso.value;
    const x = origen.x + (real.x - origen.x) * q - RADIO_PUNTO;
    const y = origen.y + (real.y - origen.y) * q - RADIO_PUNTO;
    const latido = reducido
      ? 1
      : 1 + LATIDO * activa.value * (0.5 + 0.5 * Math.sin(2 * Math.PI * LATIDOS_POR_S * Math.max(0, posAudio.value)));
    return { transform: [{ translateX: x }, { translateY: y }, { scale: latido }] };
  });

  if (!g) return null;
  const { ancho, alto, w, h } = g;
  const esquinas = [
    [MARGEN_IZQ, MARGEN_ARRIBA],
    [MARGEN_IZQ + w, MARGEN_ARRIBA],
    [MARGEN_IZQ + w, MARGEN_ARRIBA + h],
    [MARGEN_IZQ + INCLINACION * w, MARGEN_ARRIBA + h],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(' ');
  // Las guías: la altura de cada tercio y la línea del centro.
  const guia = (abierta: number) => {
    const y = MARGEN_ARRIBA + abierta * PROPORCION * w;
    return { x1: MARGEN_IZQ + INCLINACION * abierta * w, x2: MARGEN_IZQ + w, y };
  };
  const tercio = guia(1 / 3);
  const dosTercios = guia(2 / 3);
  const centroArriba = MARGEN_IZQ + 0.5 * w;
  const centroAbajo = MARGEN_IZQ + (INCLINACION + 0.5 * (1 - INCLINACION)) * w;

  return (
    <View
      style={{ width: ancho, height: alto }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Mapa de la boca. ${descripcionMapa(ipa) ?? ''}`}
    >
      <Svg width={ancho} height={alto} pointerEvents="none">
        <Polygon points={esquinas} fill={color.trackFondo} stroke={color.borderStrong} strokeWidth={1.5} strokeLinejoin="round" />
        <Line x1={tercio.x1} y1={tercio.y} x2={tercio.x2} y2={tercio.y} stroke={color.border} strokeWidth={1} />
        <Line x1={dosTercios.x1} y1={dosTercios.y} x2={dosTercios.x2} y2={dosTercios.y} stroke={color.border} strokeWidth={1} />
        <Line x1={centroArriba} y1={MARGEN_ARRIBA} x2={centroAbajo} y2={MARGEN_ARRIBA + h} stroke={color.border} strokeWidth={1} />
      </Svg>

      <Text style={[styles.eje, { left: MARGEN_IZQ, top: 0 }]}>anterior</Text>
      <Text style={[styles.eje, styles.derecha, { right: CANAL_DERECHO, top: 0 }]}>posterior</Text>
      <Text style={[styles.eje, { left: MARGEN_IZQ + w + 8, top: MARGEN_ARRIBA - 8 }]}>cerrada</Text>
      <Text style={[styles.eje, { left: MARGEN_IZQ + w + 8, top: MARGEN_ARRIBA + h - 8 }]}>abierta</Text>

      {g.fantasmas.map((f) => (
        <View key={f.vocal} pointerEvents="none" style={[styles.fantasma, { left: f.x - RADIO_FANTASMA, top: f.y - RADIO_FANTASMA }]}>
          <Text style={styles.letra}>{f.vocal}</Text>
        </View>
      ))}

      {reducido
        ? null
        : Array.from({ length: ESTELA }, (_, i) => (
            <Estela key={i} indice={i} progreso={progreso} origen={g.origen} destino={g.real} />
          ))}

      <Animated.View pointerEvents="none" style={[styles.punto, estiloPunto]}>
        <Text style={styles.simbolo}>{sinBarras(ipa)}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  eje: { position: 'absolute', fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  derecha: { textAlign: 'right' },
  fantasma: {
    position: 'absolute',
    width: RADIO_FANTASMA * 2,
    height: RADIO_FANTASMA * 2,
    borderRadius: RADIO_FANTASMA,
    borderWidth: 1.5,
    borderColor: color.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letra: { fontFamily: font.family.bodyStrong, fontSize: font.size.xs, color: color.textFaint },
  estela: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: color.accent,
  },
  punto: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: RADIO_PUNTO * 2,
    height: RADIO_PUNTO * 2,
    borderRadius: RADIO_PUNTO,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Charis SIL solo trae Regular: se compensa con tamaño, no con peso.
  simbolo: { fontFamily: font.family.ipa, fontSize: font.size.md, color: color.onAccent },
});
