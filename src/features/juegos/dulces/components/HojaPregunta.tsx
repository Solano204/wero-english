import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/shared/ui/Button';
import { AudioButton } from '@/shared/ui/AudioButton';
import { OptionButton, type OptionState } from '@/shared/ui/OptionButton';
import { FraseKaraoke } from '@/shared/ui/fx/FraseKaraoke';
import { useVozEnVivo } from '@/shared/ui/fx/useVozEnVivo';
import { analizar } from '@/domain/marcas';
import { marcasDe } from '@/services/marcas';
import { color, filoLuz, font, motionDuration, motionEasing, motionSpring, radius, sol, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { DulceObjetivo } from '@/types';

/** El velo nunca pasa de esto: el tablero, congelado, sigue viéndose. */
const VELO_MAX = 0.5;
/** El grosor del filo de luz de la hoja. */
const FILO = 1;

export interface PreguntaDulces {
  objetivo: DulceObjetivo;
  opciones: string[];
}

/** Dónde queda el título de la hoja en la capa de la pantalla: a donde vuela la frase de la meta. */
export interface DestinoTitulo {
  x: number;
  y: number;
  ancho: number;
}

interface Props {
  pregunta: PreguntaDulces | null;
  /** Ya se contestó: se marcan las opciones y aparece «Siguiente» en lugar de Escuchar. */
  respondiendo: boolean;
  elegidaOpcion: string | null;
  avanzando: boolean;
  /** El título se enseña cuando la frase de la meta ya llegó a él (o si no hay vuelo). */
  tituloListo: boolean;
  /** El alto de la capa donde va la hoja (pegada abajo): con él se calcula dónde queda el título. */
  capaAlto: number;
  onDestinoTitulo: (destino: DestinoTitulo) => void;
  onResponder: (opcion: string) => void;
  onSeguir: () => void;
}

/**
 * La pregunta que sale al llenarse una barra, como hoja inferior en la zona del pulgar (igual que la de
 * Estudio): sube con un resorte sobre el tablero, que se queda arriba congelado bajo un velo de a lo más 0.5.
 * Trae «Llenaste esta», la frase (con karaoke al oírla, sea sola o con Escuchar), «¿Qué significa?» y tres
 * opciones que se marcan como en Estudio (la correcta con `check` en verde; la que falló en ámbar con `close`,
 * y la correcta se enciende). Al contestar, «Siguiente» (`primary`, a todo lo ancho) toma el lugar de Escuchar.
 *
 * Escucha la voz desde que hay pregunta, no desde que sube: el audio arranca al abrirse. Con «reducir
 * movimiento» no sube: aparece con un fundido, y el karaoke cambia de color igual.
 */
export function HojaPregunta({
  pregunta,
  respondiendo,
  elegidaOpcion,
  avanzando,
  tituloListo,
  capaAlto,
  onDestinoTitulo,
  onResponder,
  onSeguir,
}: Props) {
  const reducido = useMovimientoReducido();
  const { height: alturaVentana } = useWindowDimensions();

  // Al irse, la hoja se lleva su contenido: no se vacía a media salida.
  const ultima = useRef<PreguntaDulces | null>(null);
  if (pregunta) ultima.current = pregunta;
  const p = ultima.current;
  const visible = pregunta !== null;

  const entry = p?.objetivo.entry ?? null;
  const vozEn = useVozEnVivo(entry?.audio_en ?? null);
  const en = useMemo(
    () =>
      entry
        ? // Lo que se dice puede diferir de lo que se ve; los tiempos se calculan sobre lo dicho.
          analizar(entry.phrase, entry.phrase_tts || entry.phrase, marcasDe(entry.audio_en), vozEn.duracion)
        : null,
    [entry, vozEn.duracion]
  );

  const y = useSharedValue(alturaVentana);
  const velo = useSharedValue(0);
  const opacidad = useSharedValue(reducido ? 0 : 1);
  const titulo = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      velo.value = withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar });
      if (reducido) {
        y.value = 0;
        opacidad.value = withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar });
      } else {
        opacidad.value = 1;
        // La barra destella un instante antes de que suba la hoja.
        y.value = withDelay(motionDuration.rapido, withSpring(0, motionSpring.rebote));
      }
    } else {
      velo.value = withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir });
      if (reducido) opacidad.value = withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir });
      else y.value = withTiming(alturaVentana, { duration: motionDuration.rapido, easing: motionEasing.salir });
    }
  }, [visible, reducido, alturaVentana, y, velo, opacidad]);

  // El título aparece cuando la frase de la meta llega a su lugar.
  useEffect(() => {
    titulo.value = withTiming(tituloListo ? 1 : 0, {
      duration: reducido ? 0 : motionDuration.rapido,
      easing: motionEasing.entrar,
    });
  }, [tituloListo, reducido, titulo]);

  const hojaAnim = useAnimatedStyle(() => ({ opacity: opacidad.value, transform: [{ translateY: y.value }] }));
  const veloAnim = useAnimatedStyle(() => ({ opacity: velo.value * VELO_MAX }));
  const tituloAnim = useAnimatedStyle(() => ({ opacity: titulo.value }));

  // Dónde quedará el título cuando la hoja termine de subir: la hoja va pegada al fondo de la capa.
  const [altoHoja, setAltoHoja] = useState(0);
  const tituloEn = useRef({ x: 0, y: 0, ancho: 0 });
  const avisar = useCallback(() => {
    if (altoHoja <= 0 || capaAlto <= 0 || tituloEn.current.ancho <= 0) return;
    onDestinoTitulo({ x: tituloEn.current.x, y: capaAlto - altoHoja + tituloEn.current.y, ancho: tituloEn.current.ancho });
  }, [altoHoja, capaAlto, onDestinoTitulo]);
  useEffect(() => {
    avisar();
  }, [avisar, p]);
  const alMedirTitulo = useCallback(
    (e: LayoutChangeEvent) => {
      const { x, y: dentro, width } = e.nativeEvent.layout;
      tituloEn.current = { x: x + FILO, y: dentro + FILO, ancho: width };
      avisar();
    },
    [avisar]
  );

  if (!p || !en) return null;
  const correcta = p.objetivo.entry.spanish_main;

  const estadoDe = (opcion: string): OptionState => {
    if (!respondiendo) return 'idle';
    if (opcion === correcta) return 'correct';
    if (opcion === elegidaOpcion) return 'wrong';
    return 'dimmed';
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? 'box-none' : 'none'}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!visible}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.velo, veloAnim]} />
      <Animated.View style={[styles.hoja, hojaAnim]} onLayout={(e) => setAltoHoja(e.nativeEvent.layout.height)}>
        <LinearGradient colors={filoLuz} start={sol.start} end={sol.end} style={styles.filo}>
          <View style={styles.contenido} accessibilityLiveRegion="polite">
            <Text style={styles.etiqueta}>Llenaste esta</Text>
            <Animated.View onLayout={alMedirTitulo} style={tituloAnim}>
              <FraseKaraoke palabras={en.palabras} voz={vozEn} tamano="lg" />
            </Animated.View>
            <Text style={styles.ayuda}>¿Qué significa?</Text>
            <View style={styles.opciones}>
              {p.opciones.map((o, i) => (
                <OptionButton
                  key={o}
                  label={o}
                  state={estadoDe(o)}
                  index={i}
                  compacta
                  disabled={respondiendo}
                  onPress={() => onResponder(o)}
                />
              ))}
            </View>
            {respondiendo ? (
              <Button label="Siguiente" size="lg" full disabled={avanzando} onPress={onSeguir} />
            ) : (
              <AudioButton path={p.objetivo.entry.audio_en} size="sm" label="Escuchar" />
            )}
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  velo: { backgroundColor: color.velo },
  hoja: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  filo: {
    padding: FILO,
    paddingBottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  contenido: {
    padding: space.lg,
    gap: space.sm,
    alignItems: 'stretch',
    borderTopLeftRadius: radius.xl - FILO,
    borderTopRightRadius: radius.xl - FILO,
    backgroundColor: color.bg,
    overflow: 'hidden',
  },
  etiqueta: {
    fontSize: font.size.xs,
    color: color.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontFamily: font.family.bodyStrong,
  },
  ayuda: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  opciones: { gap: space.xs },
});
