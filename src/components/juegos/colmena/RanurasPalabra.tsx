import React, { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useReloj, useSenalActiva } from '@/components/fx/useSenalActiva';
import { color, font, motionDuration, motionEasing, motionSenal, radius } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import { etiquetaRanura, type DistribucionRanuras } from './geometria';

/** Cómo terminó la ronda: la armó quien juega, o se completó con «No me sale» o al acabarse el tiempo. */
export type Resolucion = 'acierto' | 'ayuda';

type Estado = 'vacia' | 'llena' | 'acierto' | 'ayuda' | 'fallo';

const LINEA = 2;
const CURSOR = 3;
/** El cursor respira entre esta opacidad y 1. */
const OPACIDAD_CURSOR_MIN = 0.35;
const ANCHO_COMPLETA = 32;
const LETRA_COMPLETA = font.size.xl;
const LETRA_MIN = 12;

const RELLENO: Record<Exclude<Estado, 'vacia'>, { fondo: string; linea: string; letra: string }> = {
  llena: { fondo: color.accentSoft, linea: color.accent, letra: color.text },
  acierto: { fondo: color.correctSoft, linea: color.correct, letra: color.correct },
  ayuda: { fondo: color.wrongSoft, linea: color.wrong, letra: color.wrong },
  fallo: { fondo: color.wrongSoft, linea: color.wrong, letra: color.text },
};

function estadoDe(k: number, armado: number, resolucion: Resolucion | null, desdeAyuda: number, fallo: boolean): Estado {
  if (resolucion === 'acierto') return 'acierto';
  if (resolucion === 'ayuda') return k >= desdeAyuda ? 'ayuda' : 'llena';
  if (k < armado) return 'llena';
  return fallo && k === armado ? 'fallo' : 'vacia';
}

interface RanuraProps {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  letra: string | null;
  etiqueta: string;
  estado: Estado;
  fuente: number;
  /** Cuánto espera la letra en aparecer: lo que tarda en llegar la ficha que vuela hasta aquí. */
  retraso: number;
}

const Ranura = memo(function Ranura({ x, y, ancho, alto, letra, etiqueta, estado, fuente, retraso }: RanuraProps) {
  const reducido = useMovimientoReducido();
  const aparece = useSharedValue(letra ? 1 : 0);

  useEffect(() => {
    if (!letra) {
      aparece.value = 0;
      return;
    }
    const cfg = { duration: motionDuration.rapido, easing: motionEasing.entrar };
    aparece.value = reducido ? withTiming(1, cfg) : withDelay(retraso, withTiming(1, cfg));
  }, [letra, retraso, reducido, aparece]);

  // La capa de color entra con la letra; el aviso de una letra que no va se ve desde el primer cuadro.
  const capa = useAnimatedStyle(() => ({ opacity: estado === 'fallo' ? 1 : aparece.value }));
  const texto = useAnimatedStyle(() => ({ opacity: aparece.value }));
  const relleno = estado === 'vacia' ? null : RELLENO[estado];

  return (
    <View
      style={[styles.ranura, { left: x, top: y, width: ancho, height: alto }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={etiqueta}
    >
      {relleno ? (
        <Animated.View style={[styles.capa, { backgroundColor: relleno.fondo, borderBottomColor: relleno.linea }, capa]} />
      ) : null}
      <Animated.Text
        allowFontScaling={false}
        style={[styles.letra, { fontSize: fuente, lineHeight: alto, color: relleno?.letra ?? color.text }, texto]}
      >
        {letra ?? ''}
      </Animated.Text>
    </View>
  );
});

interface CursorProps {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  visible: boolean;
}

/**
 * El cursor: una sola pieza que respira y se corre de una ranura a la siguiente. Es el único bucle de la
 * pantalla fuera del reloj y se detiene sin foco, en segundo plano y con «reducir movimiento» (queda fijo).
 */
function Cursor({ x, y, ancho, alto, visible }: CursorProps) {
  const { activo, reducido } = useSenalActiva();
  const fase = useReloj(motionSenal.cursor, { activo: activo && visible, reducido, faseQuieta: 0.5 });
  const px = useSharedValue(x);
  const py = useSharedValue(y);
  const presente = useSharedValue(visible ? 1 : 0);
  const primera = useRef(true);

  useEffect(() => {
    if (primera.current || reducido) {
      primera.current = false;
      px.value = x;
      py.value = y;
      return;
    }
    const cfg = { duration: motionDuration.rapido, easing: motionEasing.entrar };
    px.value = withTiming(x, cfg);
    py.value = withTiming(y, cfg);
  }, [x, y, reducido, px, py]);

  useEffect(() => {
    presente.value = withTiming(visible ? 1 : 0, {
      duration: reducido ? 0 : motionDuration.rapido,
      easing: motionEasing.entrar,
    });
  }, [visible, reducido, presente]);

  const estilo = useAnimatedStyle(() => ({
    opacity: presente.value * (OPACIDAD_CURSOR_MIN + (1 - OPACIDAD_CURSOR_MIN) * (0.5 - 0.5 * Math.cos(2 * Math.PI * fase.value))),
    transform: [{ translateX: px.value }, { translateY: py.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no"
      style={[styles.cursor, { width: ancho, height: alto }, estilo]}
    />
  );
}

interface Props {
  distribucion: DistribucionRanuras;
  /** Cuántas letras tiene cada palabra, para lo que anuncia el lector de pantalla. */
  palabras: readonly number[];
  objetivo: string;
  armado: string;
  resolucion: Resolucion | null;
  /** Desde qué ranura completó la ayuda; las anteriores las puso quien juega. */
  desdeAyuda: number;
  /** La última letra no iba: la ranura que sigue lo avisa en ámbar. */
  fallo: boolean;
  /** Cuánto espera cada letra en aparecer (por ranura); sin dato, aparece al momento. */
  retrasos?: readonly number[];
}

/**
 * Las ranuras de la frase, agrupadas por palabra. Cada una es de 32 × 40 (más chica solo si una palabra no
 * cabría), con base en `trackFondo` y una línea abajo en `textFaint`; la que sigue lleva el cursor. Llena
 * queda en `accent`; al resolverse, en `correct` si la armó quien juega y en ámbar donde completó la ayuda.
 * Cada ranura anuncia «Palabra 1 de 5, letra 3 de 5, vacía» o su letra.
 */
export function RanurasPalabra({ distribucion, palabras, objetivo, armado, resolucion, desdeAyuda, fallo, retrasos }: Props) {
  const total = objetivo.length;
  const siguiente = resolucion === null && armado.length < total;
  const fuente = Math.max(LETRA_MIN, Math.round((LETRA_COMPLETA * distribucion.ranuraAncho) / ANCHO_COMPLETA));
  const foco = distribucion.ranuras[Math.min(armado.length, total - 1)];

  return (
    <View style={{ width: distribucion.ancho, height: distribucion.alto }}>
      {distribucion.ranuras.map((r, k) => {
        const letra = k < armado.length ? (armado[k] ?? null) : null;
        return (
          <Ranura
            key={k}
            x={r.x}
            y={r.y}
            ancho={distribucion.ranuraAncho}
            alto={distribucion.ranuraAlto}
            letra={letra}
            etiqueta={etiquetaRanura(r.palabra, palabras.length, r.letra, palabras[r.palabra] ?? 0, letra)}
            estado={estadoDe(k, armado.length, resolucion, desdeAyuda, fallo)}
            fuente={fuente}
            retraso={retrasos?.[k] ?? 0}
          />
        );
      })}
      {foco ? <Cursor x={foco.x} y={foco.y} ancho={distribucion.ranuraAncho} alto={distribucion.ranuraAlto} visible={siguiente} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ranura: {
    position: 'absolute',
    borderRadius: radius.sm,
    backgroundColor: color.trackFondo,
    borderBottomWidth: LINEA,
    borderBottomColor: color.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capa: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius.sm, borderBottomWidth: LINEA },
  letra: { fontFamily: font.family.heading, textAlign: 'center' },
  cursor: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: radius.sm,
    backgroundColor: color.accentSoft,
    borderBottomWidth: CURSOR,
    borderBottomColor: color.accent,
  },
});
