import React, { memo, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '@/shared/ui/Icon';
import { useReloj, useSenalActiva } from '@/shared/ui/fx/useSenalActiva';
import { color, font, motionColmena, motionDuration, motionEasing, motionSenal, motionSpring, radius, senal } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { etiquetaRanura, type DistribucionRanuras } from '@/features/juegos/colmena/logic/geometria';

/** Cómo terminó la ronda: la armó quien juega, o se completó con «No me sale» o al acabarse el tiempo. */
export type Resolucion = 'acierto' | 'ayuda';

type Estado = 'vacia' | 'llena' | 'ayuda' | 'fallo';

const LINEA = 2;
const CURSOR = 3;
/** El cursor respira entre esta opacidad y 1. */
const OPACIDAD_CURSOR_MIN = 0.35;
const ANCHO_COMPLETA = 32;
const LETRA_COMPLETA = font.size.xl;
const LETRA_MIN = 12;
/** La insignia de cada palabra (check o ojo): un círculo con su ícono de 16, en la esquina de arriba a la derecha. */
const INSIGNIA = 20;

const RELLENO: Record<Exclude<Estado, 'vacia'>, { fondo: string; linea: string; letra: string }> = {
  llena: { fondo: color.accentSoft, linea: color.accent, letra: color.text },
  ayuda: { fondo: color.wrongSoft, linea: color.wrong, letra: color.wrong },
  fallo: { fondo: color.wrongSoft, linea: color.wrong, letra: color.text },
};
const CORRECTA = { fondo: color.correctSoft, linea: color.correct };

/** El tamaño de la letra en una ranura de ese ancho: 22 con la ranura completa, y proporcional si se encogió. */
export function fuenteDeRanura(ancho: number): number {
  return Math.max(LETRA_MIN, Math.round((LETRA_COMPLETA * ancho) / ANCHO_COMPLETA));
}

function estadoDe(k: number, armado: number, resolucion: Resolucion | null, desdeAyuda: number, fallo: boolean): Estado {
  if (resolucion === 'acierto') return 'llena';
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
  /** La armó quien juega y la ronda ya se resolvió: la onda de luz llega aquí y la deja en `correct`. */
  acierto: boolean;
  fuente: number;
  /** Cuánto espera la letra en aparecer: lo que tarda en llegar la ficha que vuela hasta aquí. */
  retraso: number;
  /** Cuánto espera la onda de luz en llegar a esta ranura. */
  onda: number;
}

const Ranura = memo(function Ranura({ x, y, ancho, alto, letra, etiqueta, estado, acierto, fuente, retraso, onda }: RanuraProps) {
  const reducido = useMovimientoReducido();
  const aparece = useSharedValue(letra ? 1 : 0);
  const ok = useSharedValue(0);
  const destello = useSharedValue(0);

  useEffect(() => {
    if (!letra) {
      aparece.set(0);
      return;
    }
    const cfg = { duration: motionDuration.rapido, easing: motionEasing.entrar };
    aparece.set(reducido ? withTiming(1, cfg) : withDelay(retraso, withTiming(1, cfg)));
  }, [letra, retraso, reducido, aparece]);

  // La onda de luz llega, la ranura se enciende un instante en `senal` y se queda en `correct`.
  useEffect(() => {
    if (!acierto) return;
    const cfg = { duration: motionDuration.rapido, easing: motionEasing.entrar };
    if (reducido) {
      ok.set(withTiming(1, cfg));
      return;
    }
    ok.set(withDelay(onda, withTiming(1, cfg)));
    destello.set(withDelay(
      onda,
      withSequence(
        withTiming(1, { duration: motionDuration.rapido / 2, easing: motionEasing.entrar }),
        withTiming(0, { duration: motionDuration.base, easing: motionEasing.salir })
      )
    ));
  }, [acierto, onda, reducido, ok, destello]);

  const relleno = estado === 'vacia' ? null : RELLENO[estado];
  const base = relleno?.letra ?? color.text;
  // La capa de color entra con la letra; el aviso de una letra que no va se ve desde el primer cuadro.
  const capa = useAnimatedStyle(() => ({ opacity: estado === 'fallo' ? 1 : aparece.get() }));
  const capaOk = useAnimatedStyle(() => ({ opacity: ok.get() }));
  const capaOnda = useAnimatedStyle(() => ({ opacity: destello.get() }));
  const texto = useAnimatedStyle(() => ({
    opacity: aparece.get(),
    color: acierto ? interpolateColor(ok.get(), [0, 1], [color.text, color.correct]) : base,
  }));

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
      {acierto ? (
        <>
          <Animated.View style={[styles.capa, { backgroundColor: CORRECTA.fondo, borderBottomColor: CORRECTA.linea }, capaOk]} />
          <Animated.View style={[styles.capa, styles.onda, capaOnda]} />
        </>
      ) : null}
      <Animated.Text allowFontScaling={false} style={[styles.letra, { fontSize: fuente, lineHeight: alto }, texto]}>
        {letra ?? ''}
      </Animated.Text>
    </View>
  );
});

interface InsigniaProps {
  x: number;
  y: number;
  tipo: Resolucion;
  retraso: number;
}

/** La marca de una palabra terminada: `check` en verde si la armó quien juega, el ojo en ámbar si la completó la ayuda. */
function Insignia({ x, y, tipo, retraso }: InsigniaProps) {
  const reducido = useMovimientoReducido();
  const escala = useSharedValue(reducido ? 1 : 0);
  const opacidad = useSharedValue(0);

  useEffect(() => {
    const cfg = { duration: motionDuration.rapido, easing: motionEasing.entrar };
    if (reducido) {
      escala.set(1);
      opacidad.set(withTiming(1, cfg));
      return;
    }
    opacidad.set(withDelay(retraso, withTiming(1, cfg)));
    escala.set(withDelay(retraso, withSpring(1, motionSpring.rebote)));
  }, [retraso, reducido, escala, opacidad]);

  const estilo = useAnimatedStyle(() => ({ opacity: opacidad.get(), transform: [{ scale: escala.get() }] }));
  const acierto = tipo === 'acierto';
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no"
      style={[
        styles.insignia,
        { left: x, top: y, backgroundColor: acierto ? color.correctSoft : color.wrongSoft },
        estilo,
      ]}
    >
      <Icon name={acierto ? 'check' : 'reveal'} size="sm" color={acierto ? color.correct : color.wrong} />
    </Animated.View>
  );
}

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
      px.set(x);
      py.set(y);
      return;
    }
    const cfg = { duration: motionDuration.rapido, easing: motionEasing.entrar };
    px.set(withTiming(x, cfg));
    py.set(withTiming(y, cfg));
  }, [x, y, reducido, px, py]);

  useEffect(() => {
    presente.set(withTiming(visible ? 1 : 0, {
      duration: reducido ? 0 : motionDuration.rapido,
      easing: motionEasing.entrar,
    }));
  }, [visible, reducido, presente]);

  const estilo = useAnimatedStyle(() => ({
    opacity: presente.get() * (OPACIDAD_CURSOR_MIN + (1 - OPACIDAD_CURSOR_MIN) * (0.5 - 0.5 * Math.cos(2 * Math.PI * fase.get()))),
    transform: [{ translateX: px.get() }, { translateY: py.get() }],
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
 * queda en `accent`. Al resolverse por acierto, una onda de luz en `senal` recorre las ranuras de izquierda a
 * derecha (en cuanto llega la última ficha), las deja en `correct` y cada palabra recibe su `check`; si la
 * completó la ayuda, las ranuras que puso ella quedan en ámbar y cada palabra lleva el ojo. Cada ranura anuncia
 * «Palabra 1 de 5, letra 3 de 5, vacía» o su letra.
 */
export function RanurasPalabra({ distribucion, palabras, objetivo, armado, resolucion, desdeAyuda, fallo, retrasos }: Props) {
  const total = objetivo.length;
  const siguiente = resolucion === null && armado.length < total;
  const fuente = fuenteDeRanura(distribucion.ranuraAncho);
  const foco = distribucion.ranuras[Math.min(armado.length, total - 1)];

  // La onda sale cuando aterriza la última ficha y cruza las ranuras en `ondaPaso` ms cada una, sin pasar de `ondaTope`.
  const aterriza = ((retrasos ?? []).reduce((m, r) => Math.max(m, r ?? 0), 0));
  const paso = Math.min(motionColmena.ondaPaso, motionColmena.ondaTope / Math.max(1, total));
  const ultimaDe = useMemo(() => {
    const ultima: number[] = [];
    distribucion.ranuras.forEach((r, k) => {
      ultima[r.palabra] = k;
    });
    return ultima;
  }, [distribucion]);

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
            acierto={resolucion === 'acierto'}
            fuente={fuente}
            retraso={retrasos?.[k] ?? 0}
            onda={aterriza + k * paso}
          />
        );
      })}
      {resolucion
        ? distribucion.palabras.map((p, i) => (
            <Insignia
              key={`insignia-${i}`}
              x={p.x + p.ancho - INSIGNIA / 2}
              y={p.y - INSIGNIA / 2}
              tipo={resolucion}
              retraso={aterriza + (ultimaDe[i] ?? 0) * paso + motionDuration.rapido}
            />
          ))
        : null}
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
  // La onda de luz: el color de la señal sobre la ranura, un instante.
  onda: { backgroundColor: senal[1], borderBottomColor: senal[2] },
  letra: { fontFamily: font.family.heading, textAlign: 'center' },
  insignia: {
    position: 'absolute',
    width: INSIGNIA,
    height: INSIGNIA,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
