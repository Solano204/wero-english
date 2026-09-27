import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
  type TextLayoutLine,
} from 'react-native';
import Animated, {
  cancelAnimation,
  runOnUI,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Button, Card } from '@/components/base';
import { GrupoAudio, type ControlAudio } from '@/components/card/GrupoAudio';
import { CableTrazo } from '@/components/fx/CableTrazo';
import { FraseKaraoke, useVozEnVivo } from '@/components/fx';
import { VistaCorreccion, useCorreccion } from '@/components/gramatica/CorreccionFrase';
import { analizar } from '@/domain/marcas';
import { anuncioDeError, duracionCorreccion, inicioDeCorreccion, type TiemposMalentendido } from '@/domain/errores';
import * as audio from '@/services/audio';
import { marcasDe } from '@/services/marcas';
import {
  color,
  escalon,
  font,
  motionDuration,
  motionEasing,
  motionError,
  motionMalentendido,
  space,
} from '@/theme';
import { useMovimientoReducido } from '@/utils';
import type { ErrorCard } from '@/types';
import { SenalRota } from './SenalRota';

/** Espera antes de arrancar, para que termine la transición de la pantalla. */
const RETRASO_ENTRADA = motionDuration.base;
/** Margen tras la corrección antes de pasar al karaoke, en ms. */
const MARGEN_FINAL = 60;
/** Lo que baja cada tarjeta al entrar, en dp. */
const SUBE = 8;
/** Ancho del filo lateral de una tarjeta, en dp. */
const FILO = 3;

/** Los tiempos que pone `motion.ts` para calcular cuándo arranca el paso c y cuánto dura (`domain/errores.ts`). */
const TIEMPOS: TiemposMalentendido = {
  tope: motionMalentendido.tope,
  cMin: motionMalentendido.cMin,
  cMax: motionMalentendido.cMax,
  tacha: motionError.tacha,
  pausa: motionError.pausa,
  entra: motionError.entra,
  entraSube: motionDuration.lento,
  icono: motionDuration.base,
  escena: motionDuration.escena,
  aparecerSubiendo: motionDuration.lento,
  escalon,
};

interface BarraTachaProps {
  linea: TextLayoutLine;
  indice: number;
  total: number;
  progreso: SharedValue<number>;
}

/** La línea que tacha un renglón de «Lo que dices» de izquierda a derecha; los renglones se tachan uno tras otro. */
function BarraTacha({ linea, indice, total, progreso }: BarraTachaProps) {
  const estilo = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.min(1, Math.max(0, progreso.value * total - indice)) }],
  }));
  // La posición va en el nodo de afuera y la escala en el de adentro.
  return (
    <View
      pointerEvents="none"
      style={[styles.tachaCaja, { left: linea.x, top: linea.y + linea.height * 0.55, width: linea.width }]}
    >
      <Animated.View style={[styles.tacha, estilo]} />
    </View>
  );
}

interface Props {
  error: ErrorCard;
}

/**
 * El héroe del detalle de un error: la señal que se rompe, en tres pasos (≤ 1.6 s en total).
 *
 * a) «Lo que dices» entra con la frase normal, sin tachar. b) Un cable de señal (el de Pares) baja de esa tarjeta a «Lo
 * que entienden»; a medio camino hace interferencia (vibra y se pone ámbar) y lo que entienden llega con glitch y se
 * asienta. c) «Lo que dices» se tacha de izquierda a derecha y en «Lo correcto» la frase incorrecta se transforma en la
 * correcta con el diff de Gramática (con un fundido si se parecen poco); al terminar, la frase pasa a tener karaoke. «Ver
 * otra vez» la repite. El paso c arranca lo más tarde que deje terminar dentro del tope, según el par (`domain/errores.ts`).
 *
 * Con «reducir movimiento» no hay cable, glitch, tachado animado ni morph: los tres pasos aparecen completos con un
 * fundido. El lector de pantalla oye el malentendido entero en orden, como un solo elemento; los botones de audio de «Lo
 * correcto» quedan aparte.
 */
export function SecuenciaMalentendido({ error: e }: Props) {
  const reducido = useMovimientoReducido();
  const correccion = useCorreccion(e.lo_que_dices, e.lo_correcto);
  const { jugar: jugarCorreccion, detener: detenerCorreccion } = correccion;

  const [glitch, setGlitch] = useState(0);
  const [final, setFinal] = useState(false);
  const [lineas, setLineas] = useState<TextLayoutLine[]>([]);
  const ancho = useRef(0);
  const c1 = useRef({ y: 0, alto: 0 });
  const c2 = useRef({ y: 0, alto: 0 });
  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([]);

  const v1 = useSharedValue(0);
  const v2 = useSharedValue(0);
  const v3 = useSharedValue(0);
  const tachaDices = useSharedValue(0);
  const ax = useSharedValue(0);
  const ay = useSharedValue(0);
  const ex = useSharedValue(0);
  const ey = useSharedValue(0);
  const tension = useSharedValue(1);
  const vis = useSharedValue(0);
  const brillo = useSharedValue(0);
  const ambar = useSharedValue(0);
  const pulso = useSharedValue(0);
  const vibra = useSharedValue(0);
  const desvio = useDerivedValue(
    () => Math.sin(vibra.value * Math.PI * 2 * motionMalentendido.oscilaciones) * motionMalentendido.amplitud * (1 - vibra.value)
  );

  const voz = useVozEnVivo(e.audio);
  const { palabras } = useMemo(
    () => analizar(e.lo_correcto, e.lo_correcto, marcasDe(e.audio), voz.duracion),
    [e.lo_correcto, e.audio, voz.duracion]
  );

  const limpiar = useCallback(() => {
    temporizadores.current.forEach(clearTimeout);
    temporizadores.current = [];
    detenerCorreccion();
    [v1, v2, v3, tachaDices, ax, ay, ex, ey, tension, vis, brillo, ambar, pulso, vibra].forEach((v) => cancelAnimation(v));
  }, [detenerCorreccion, v1, v2, v3, tachaDices, ax, ay, ex, ey, tension, vis, brillo, ambar, pulso, vibra]);

  const programar = useCallback((ms: number, fn: () => void) => {
    temporizadores.current.push(setTimeout(fn, ms));
  }, []);

  /** El cable baja de «Lo que dices» a «Lo que entienden» y, a medio camino, hace interferencia. */
  const soltarCable = useCallback(() => {
    if (ancho.current === 0 || c2.current.alto === 0) return;
    const x = ancho.current / 2;
    const desde = c1.current.y + c1.current.alto;
    const hasta = c2.current.y;
    runOnUI(() => {
      'worklet';
      ax.value = x;
      ay.value = desde;
      ex.value = x;
      ey.value = desde;
      tension.value = 1;
      vis.value = 1;
      brillo.value = 1;
      ambar.value = 0;
      pulso.value = 0;
      vibra.value = 0;
      const media = motionMalentendido.cable / 2;
      ey.value = withTiming(hasta, { duration: motionMalentendido.cable, easing: motionEasing.entrar });
      ambar.value = withDelay(media, withTiming(1, { duration: motionMalentendido.interferencia, easing: motionEasing.entrar }));
      vibra.value = withDelay(media, withTiming(1, { duration: motionMalentendido.interferencia, easing: motionEasing.lineal }));
      vis.value = withDelay(motionMalentendido.cable, withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir }));
    })();
  }, [ax, ay, ex, ey, tension, vis, brillo, ambar, pulso, vibra]);

  const arrancar = useCallback(() => {
    limpiar();
    setFinal(false);
    const aparece = { duration: motionDuration.base, easing: motionEasing.entrar };
    if (reducido) {
      v1.value = withTiming(1, aparece);
      v2.value = withTiming(1, aparece);
      v3.value = withTiming(1, aparece);
      tachaDices.value = 1;
      setFinal(true);
      return;
    }
    v1.value = 0;
    v2.value = 0;
    v3.value = 0;
    tachaDices.value = 0;
    vis.value = 0;
    const modo = correccion.modo === 'morph' ? 'morph' : 'fundido';
    const duracion = duracionCorreccion(modo, correccion.tachas, correccion.entradas, TIEMPOS);
    const inicioC = inicioDeCorreccion(duracion, TIEMPOS);
    const mitadCable = motionMalentendido.cableInicio + motionMalentendido.cable / 2;
    // a) «Lo que dices» entra con la frase normal.
    programar(0, () => {
      v1.value = withTiming(1, aparece);
    });
    // b) El cable baja; a medio camino la señal hace interferencia y lo que entienden llega con glitch.
    programar(motionMalentendido.cableInicio, soltarCable);
    programar(mitadCable, () => {
      v2.value = withTiming(1, aparece);
      setGlitch((g) => g + 1);
    });
    // c) «Lo que dices» se tacha y «Lo correcto» transforma la frase incorrecta en la correcta.
    programar(inicioC, () => {
      tachaDices.value = withTiming(1, { duration: motionError.tacha, easing: motionEasing.lineal });
      v3.value = withTiming(1, aparece);
      jugarCorreccion();
    });
    programar(inicioC + duracion + MARGEN_FINAL, () => setFinal(true));
  }, [limpiar, reducido, v1, v2, v3, tachaDices, vis, correccion.modo, correccion.tachas, correccion.entradas, programar, soltarCable, jugarCorreccion]);

  // Arranca al entrar y se suelta al salir. `arrancar` cambia con la corrección: la referencia evita rearmar el arranque.
  const arrancarRef = useRef(arrancar);
  arrancarRef.current = arrancar;
  useEffect(() => {
    const t = setTimeout(() => arrancarRef.current(), RETRASO_ENTRADA);
    return () => {
      clearTimeout(t);
      limpiar();
    };
  }, [limpiar]);

  // Con «reducir movimiento» solo el fundido: nada sube.
  const estilo1 = useAnimatedStyle(() => ({ opacity: v1.value, transform: [{ translateY: reducido ? 0 : (1 - v1.value) * SUBE }] }));
  const estilo2 = useAnimatedStyle(() => ({ opacity: v2.value, transform: [{ translateY: reducido ? 0 : (1 - v2.value) * SUBE }] }));
  const estilo3 = useAnimatedStyle(() => ({ opacity: v3.value, transform: [{ translateY: reducido ? 0 : (1 - v3.value) * SUBE }] }));
  const estiloDices = useAnimatedStyle(() => ({ opacity: 1 - 0.35 * tachaDices.value }));

  const alTexto = useCallback((ev: NativeSyntheticEvent<TextLayoutEventData>) => setLineas(ev.nativeEvent.lines), []);

  const sonar = (ruta: string, lento: boolean) => {
    void (lento ? audio.playSlow(ruta) : audio.play(ruta));
  };
  const controles: ControlAudio[] = [
    { clave: 'en', etiqueta: 'Escuchar', descripcion: 'Escuchar lo correcto', icono: 'volume', ruta: e.audio, lento: false, suena: voz.sonando && !voz.lenta },
    { clave: 'lento', etiqueta: 'Lento', descripcion: 'Escuchar lo correcto despacio', icono: 'slow', ruta: e.audio, lento: true, suena: voz.sonando && voz.lenta },
  ];

  return (
    <View>
      <View accessible accessibilityRole="text" accessibilityLabel={anuncioDeError(e)}>
        <View
          style={styles.bloque}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onLayout={(ev) => {
            ancho.current = ev.nativeEvent.layout.width;
          }}
        >
          <Animated.View
            style={estilo1}
            onLayout={(ev) => {
              c1.current = { y: ev.nativeEvent.layout.y, alto: ev.nativeEvent.layout.height };
            }}
          >
            <Card>
              <View style={[styles.filo, styles.filoMal]} />
              <Text style={styles.rotulo}>Lo que dices</Text>
              <View>
                <Animated.Text style={[styles.dices, estiloDices]} onTextLayout={alTexto}>
                  {e.lo_que_dices}
                </Animated.Text>
                {lineas.map((l, i) => (
                  <BarraTacha key={i} linea={l} indice={i} total={lineas.length} progreso={tachaDices} />
                ))}
              </View>
            </Card>
          </Animated.View>

          <Animated.View
            style={[styles.entienden, estilo2]}
            onLayout={(ev) => {
              c2.current = { y: ev.nativeEvent.layout.y, alto: ev.nativeEvent.layout.height };
            }}
          >
            <Card>
              <View style={[StyleSheet.absoluteFill, styles.velo]} pointerEvents="none" />
              <Text style={styles.rotulo}>Lo que entienden</Text>
              <SenalRota texto={e.lo_que_entienden} estilo={styles.textoEntienden} disparo={glitch} />
            </Card>
          </Animated.View>

          <CableTrazo
            ax={ax}
            ay={ay}
            ex={ex}
            ey={ey}
            tension={tension}
            vis={vis}
            brillo={brillo}
            ambar={ambar}
            pulso={pulso}
            desvio={desvio}
          />
        </View>
      </View>

      <Animated.View style={[styles.correcto, estilo3]}>
        <Card>
          <View style={[styles.filo, styles.filoBien]} />
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.textos}>
            <Text style={styles.rotulo}>Lo correcto</Text>
            {final ? (
              <FraseKaraoke palabras={palabras} voz={voz} tamano="h3" alinear="inicio" />
            ) : (
              <VistaCorreccion correccion={correccion} mal={e.lo_que_dices} bien={e.lo_correcto} />
            )}
            <Text style={styles.ipa}>{e.ipa_correcto}</Text>
          </View>
          <GrupoAudio controles={controles} alSonar={sonar} />
        </Card>
      </Animated.View>

      {reducido ? null : (
        <View style={styles.otraVez}>
          <Button variant="ghost" icon="repeat" label="Ver otra vez" onPress={arrancar} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Aquí viven las dos tarjetas de arriba y el cable que las une: las medidas del cable salen de este bloque.
  bloque: { position: 'relative' },
  // Lo que hay entre las dos tarjetas es por donde baja el cable.
  entienden: { marginTop: space.xxxl },
  correcto: { marginTop: space.md },
  textos: { gap: space.sm },
  filo: { position: 'absolute', top: 0, bottom: 0, left: 0, width: FILO },
  filoMal: { backgroundColor: color.wrong },
  filoBien: { backgroundColor: color.correct },
  velo: { backgroundColor: color.wrongSoft },
  rotulo: {
    fontSize: font.size.xs,
    color: color.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: font.family.bodyStrong,
  },
  dices: {
    fontFamily: font.family.body,
    fontSize: font.size.xl,
    lineHeight: font.size.xl * 1.3,
    color: color.text,
  },
  textoEntienden: {
    fontFamily: font.family.body,
    fontSize: font.size.xl,
    lineHeight: font.size.xl * 1.3,
    color: color.wrong,
    fontStyle: 'italic',
  },
  tachaCaja: { position: 'absolute', height: 2 },
  tacha: { flex: 1, backgroundColor: color.text, transformOrigin: 'left' },
  ipa: { fontFamily: font.family.ipa, fontSize: font.size.md, color: color.textMuted, letterSpacing: 0.3 },
  otraVez: { alignItems: 'flex-start', marginTop: space.sm },
});
