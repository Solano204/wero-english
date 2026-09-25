import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Canvas, DashPathEffect, Line, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  DIAS_POR_BLOQUE,
  alturaColumna,
  etiquetaDia,
  inicial,
  listaAccesible,
  maximo,
  resumenAccesible,
  type DiaGrafica,
} from '@/components/progreso/datos';
import * as haptics from '@/services/haptics';
import { color, font, motionDuration, motionEasing, motionSenal, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import { FxSeguro } from './FxSeguro';

/** Alto de las columnas. */
const ALTO = 96;
const HUECO = space.xs;
const HUECO_BLOQUE = space.lg;
const RADIO_COLUMNA = 3;
const PUNTO = 4;
const ALTO_ETIQUETAS = 24;
const ALTO_INICIALES = 20;
const ALTO_HOY = 20;
const OPACIDAD_GUIA = 0.25;
/** Lo que hay que deslizar a los lados para que sea scrubbing, y lo que hay que subir o bajar para que sea scroll. */
const ACTIVA_X = 8;
const FALLA_Y = 12;
const BLOQUES = ['Hace dos semanas', 'La semana pasada', 'Esta semana'] as const;

interface Props {
  /** Los 21 días, del más viejo a hoy. */
  dias: DiaGrafica[];
  /** Las columnas suben al pasar a true (cuando la gráfica entra a la vista). */
  activo: boolean;
  /** Retraso (ms) de la primera subida: la coreografía de entrada. */
  retraso?: number;
}

/**
 * Espectrograma de las últimas tres semanas: 21 columnas en tres bloques, cada una con
 * los aciertos en `accent` y el resto de las respuestas en `accentSoft`. La altura sale
 * de la raíz cuadrada (un día muy alto no aplasta a los demás) y el máximo va como
 * referencia en una línea punteada. Los días sin práctica son un punto. Al entrar las
 * columnas suben de izquierda a derecha como un ecualizador; al deslizar el dedo sale
 * «Mar 15 · 42 respuestas · 30 aciertos» con un háptico por columna.
 */
export function Espectrograma({ dias, activo, retraso = 0 }: Props) {
  const [ancho, setAncho] = useState(0);
  return (
    <View onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
      {ancho > 0 ? (
        <FxSeguro>
          <Grafica dias={dias} ancho={ancho} activo={activo} retraso={retraso} />
        </FxSeguro>
      ) : null}
    </View>
  );
}

function Grafica({ dias, ancho, activo, retraso = 0 }: Props & { ancho: number }) {
  const reducido = useMovimientoReducido();
  const [etiqueta, setEtiqueta] = useState('');
  const [lista, setLista] = useState(false);
  const progreso = useSharedValue(0);
  const seleccion = useSharedValue(-1);
  const mostrar = useSharedValue(0);
  const anchoEtiqueta = useSharedValue(0);

  const n = dias.length;
  const columna = (ancho - HUECO_BLOQUE * 2 - (n - 3) * HUECO) / n;
  const bloque = DIAS_POR_BLOQUE * columna + (DIAS_POR_BLOQUE - 1) * HUECO + HUECO_BLOQUE;
  const xs = useMemo(
    () => dias.map((_, i) => Math.floor(i / DIAS_POR_BLOQUE) * bloque + (i % DIAS_POR_BLOQUE) * (columna + HUECO)),
    [dias, bloque, columna]
  );
  const centros = useMemo(() => xs.map((x) => x + columna / 2), [xs, columna]);
  const max = maximo(dias);
  const altos = useMemo(() => dias.map((d) => alturaColumna(d.respuestas, max, ALTO)), [dias, max]);
  const altosAciertos = useMemo(
    () => dias.map((d, i) => (d.respuestas > 0 ? (altos[i] ?? 0) * (d.aciertos / d.respuestas) : 0)),
    [dias, altos]
  );
  const puntos = useMemo(() => {
    const trazo = Skia.Path.Make();
    dias.forEach((d, i) => {
      if (d.respuestas === 0) trazo.addCircle((xs[i] ?? 0) + columna / 2, ALTO - PUNTO / 2, PUNTO / 2);
    });
    return trazo;
  }, [dias, xs, columna]);

  useEffect(() => {
    if (!activo) return;
    progreso.value = reducido
      ? 1
      : withDelay(retraso, withTiming(1, { duration: motionSenal.espectro, easing: motionEasing.lineal }));
  }, [activo, reducido, retraso, progreso]);

  // Las columnas suben una tras otra: cada una empieza `columna` ms después de la anterior.
  const dibujar = (alturas: number[]) => {
    'worklet';
    const trazo = Skia.Path.Make();
    const radio = Math.min(RADIO_COLUMNA, columna / 2);
    const duracion = motionSenal.espectro - (n - 1) * motionSenal.columna;
    for (let i = 0; i < n; i++) {
      const t = Math.min(1, Math.max(0, (progreso.value * motionSenal.espectro - i * motionSenal.columna) / duracion));
      const alto = (alturas[i] ?? 0) * (1 - (1 - t) * (1 - t) * (1 - t));
      if (alto < 0.5) continue;
      trazo.addRRect(Skia.RRectXY(Skia.XYWHRect(xs[i] ?? 0, ALTO - alto, columna, alto), radio, radio));
    }
    return trazo;
  };
  const totales = useDerivedValue(() => dibujar(altos));
  const aciertos = useDerivedValue(() => dibujar(altosAciertos));
  const guiaX = useDerivedValue(() => (seleccion.value >= 0 ? (xs[seleccion.value] ?? 0) - HUECO / 2 : -ancho));
  const guiaOpacidad = useDerivedValue(() => mostrar.value * OPACIDAD_GUIA);

  const cambio = useCallback(
    (i: number) => {
      const d = dias[i];
      if (d) setEtiqueta(etiquetaDia(d));
      haptics.selection();
    },
    [dias]
  );

  const gesto = useMemo(() => {
    const tocar = (x: number) => {
      'worklet';
      let mejor = 0;
      let distancia = Infinity;
      for (let i = 0; i < centros.length; i++) {
        const d = Math.abs(x - (centros[i] ?? 0));
        if (d < distancia) {
          distancia = d;
          mejor = i;
        }
      }
      mostrar.value = withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar });
      if (mejor !== seleccion.value) {
        seleccion.value = mejor;
        runOnJS(cambio)(mejor);
      }
    };
    return Gesture.Pan()
      .activeOffsetX([-ACTIVA_X, ACTIVA_X])
      .failOffsetY([-FALLA_Y, FALLA_Y])
      .onStart((e) => tocar(e.x))
      .onUpdate((e) => tocar(e.x))
      .onFinalize(() => {
        mostrar.value = withTiming(0, { duration: motionDuration.base, easing: motionEasing.salir });
      });
  }, [centros, cambio, mostrar, seleccion]);

  const estiloEtiqueta = useAnimatedStyle(() => {
    const centro = seleccion.value >= 0 ? (centros[seleccion.value] ?? 0) : 0;
    const izquierda = Math.min(Math.max(centro - anchoEtiqueta.value / 2, 0), Math.max(0, ancho - anchoEtiqueta.value));
    return { opacity: mostrar.value, transform: [{ translateX: izquierda }] };
  });

  const ultimo = n - 1;
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={resumenAccesible(dias)}
      accessibilityHint="Abre la lista de días como texto"
      accessibilityActions={[{ name: 'activate', label: lista ? 'Cerrar la lista de días' : 'Ver los días como lista' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'activate') setLista((v) => !v);
      }}
    >
      <View style={styles.etiquetas} importantForAccessibility="no-hide-descendants">
        {BLOQUES.map((nombre, b) => (
          <Text key={nombre} style={[styles.bloque, { left: xs[b * DIAS_POR_BLOQUE] ?? 0 }]}>
            {nombre}
          </Text>
        ))}
        <Text style={styles.maximo}>{max}</Text>
      </View>

      <GestureDetector gesture={gesto}>
        <View style={styles.lienzo}>
          <Canvas style={{ width: ancho, height: ALTO }} pointerEvents="none" accessible={false}>
            <Line p1={vec(0, 0.5)} p2={vec(ancho, 0.5)} color={color.borderStrong} style="stroke" strokeWidth={1}>
              <DashPathEffect intervals={[3, 4]} />
            </Line>
            <Path path={puntos} color={color.trackFondo} />
            <Rect x={guiaX} y={0} width={columna + HUECO} height={ALTO} color={color.accent} opacity={guiaOpacidad} />
            <Path path={totales} color={color.accentSoft} />
            <Path path={aciertos} color={color.accent} />
          </Canvas>
          <Animated.View
            pointerEvents="none"
            style={[styles.etiqueta, estiloEtiqueta]}
            onLayout={(e) => {
              anchoEtiqueta.value = e.nativeEvent.layout.width;
            }}
          >
            <Text style={styles.etiquetaTexto}>{etiqueta}</Text>
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.iniciales} importantForAccessibility="no-hide-descendants">
        {dias.map((d, i) => (
          <Text
            key={d.dia}
            style={[styles.inicial, { left: xs[i] ?? 0, width: columna }, i === ultimo && styles.inicialHoy]}
          >
            {inicial(d.dia)}
          </Text>
        ))}
      </View>
      <View style={styles.hoy} importantForAccessibility="no-hide-descendants">
        <Text style={[styles.hoyTexto, { right: ancho - (centros[ultimo] ?? 0) + space.sm }]}>Hoy</Text>
        <View style={[styles.hoyPunto, { left: (centros[ultimo] ?? 0) - PUNTO / 2 }]} />
      </View>

      {lista ? (
        <View style={styles.lista}>
          {listaAccesible(dias).map((linea) => (
            <Text key={linea} style={styles.listaTexto}>
              {linea}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  etiquetas: { height: ALTO_ETIQUETAS },
  bloque: {
    position: 'absolute',
    top: 0,
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    color: color.textMuted,
  },
  maximo: {
    position: 'absolute',
    top: 0,
    right: 0,
    fontFamily: font.family.bodyStrong,
    fontSize: font.size.sm,
    fontVariant: ['tabular-nums'],
    color: color.textFaint,
  },
  lienzo: { height: ALTO },
  etiqueta: {
    position: 'absolute',
    top: -ALTO_ETIQUETAS,
    left: 0,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceHigh,
  },
  etiquetaTexto: { fontFamily: font.family.bodyStrong, fontSize: font.size.sm, color: color.text },
  iniciales: { height: ALTO_INICIALES, marginTop: space.xs },
  inicial: {
    position: 'absolute',
    top: 0,
    textAlign: 'center',
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
  },
  inicialHoy: { fontFamily: font.family.bodyStrong, color: color.accent },
  hoy: { height: ALTO_HOY },
  hoyPunto: { position: 'absolute', top: 0, width: PUNTO, height: PUNTO, borderRadius: PUNTO / 2, backgroundColor: color.accent },
  hoyTexto: { position: 'absolute', top: -space.xs, fontFamily: font.family.bodyStrong, fontSize: font.size.xs, color: color.accent },
  lista: { marginTop: space.md, gap: space.xs },
  listaTexto: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
});
