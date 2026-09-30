import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Button } from '@/shared/ui/Button';
import { FILO_HOJA, Hoja } from '@/shared/ui/Hoja';
import { AudioButton } from '@/shared/ui/AudioButton';
import { OptionButton, type OptionState } from '@/shared/ui/OptionButton';
import { FraseKaraoke } from '@/shared/ui/fx/FraseKaraoke';
import { useVozEnVivo } from '@/shared/ui/fx/useVozEnVivo';
import { analizar } from '@/domain/marcas';
import { marcasDe } from '@/services/marcas';
import { color, filoLuz, font, motionDuration, motionEasing, space } from '@/theme';
import { useUltimo } from '@/shared/hooks/useUltimo';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { DulceObjetivo } from '@/types';

/** El grosor del filo de luz de la hoja (el título se mide dentro de él). */
const FILO = FILO_HOJA;

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

  // Al irse, la hoja se lleva su contenido: no se vacía a media salida.
  const p = useUltimo(pregunta);
  const visible = pregunta !== null;

  const entry = p?.objetivo.entry ?? null;
  const vozEn = useVozEnVivo(entry?.audio_en ?? null);
  const en = (entry
        ? // Lo que se dice puede diferir de lo que se ve; los tiempos se calculan sobre lo dicho.
          analizar(entry.phrase, entry.phrase_tts || entry.phrase, marcasDe(entry.audio_en), vozEn.duracion)
        : null);

  const titulo = useSharedValue(0);

  // El título aparece cuando la frase de la meta llega a su lugar.
  useEffect(() => {
    titulo.set(withTiming(tituloListo ? 1 : 0, {
      duration: reducido ? 0 : motionDuration.rapido,
      easing: motionEasing.entrar,
    }));
  }, [tituloListo, reducido, titulo]);

  const tituloAnim = useAnimatedStyle(() => ({ opacity: titulo.get() }));

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
  const alMedirTitulo = (e: LayoutChangeEvent) => {
    const { x, y: dentro, width } = e.nativeEvent.layout;
    tituloEn.current = { x: x + FILO, y: dentro + FILO, ancho: width };
    avisar();
  };

  if (!p || !en) return null;
  const correcta = p.objetivo.entry.spanish_main;

  const estadoDe = (opcion: string): OptionState => {
    if (!respondiendo) return 'idle';
    if (opcion === correcta) return 'correct';
    if (opcion === elegidaOpcion) return 'wrong';
    return 'dimmed';
  };

  return (
    <Hoja
      visible={visible}
      filo={filoLuz}
      estiloCuerpo={styles.contenido}
      velo="pasa"
      // La barra destella un instante antes de que suba la hoja.
      retrasoSubida={motionDuration.rapido}
      onLayout={(e) => setAltoHoja(e.nativeEvent.layout.height)}
    >
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
    </Hoja>
  );
}

const styles = StyleSheet.create({
  contenido: { padding: space.lg, gap: space.sm, alignItems: 'stretch', backgroundColor: color.bg },
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
