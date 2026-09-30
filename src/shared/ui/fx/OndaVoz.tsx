import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, LinearGradient, Path, Skia, vec, type SkPath, type SkSize } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { ENV_HZ } from '@/domain/marcas';
import { color, motionDuration, motionEasing, senal } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { FxSeguro } from './FxSeguro';
import type { VozEnVivo } from './useVozEnVivo';

/** Barras de la onda: menos y más gruesas con «Lento», que se ve más ancha y más calmada. */
const BARRAS_NORMAL = 33;
const BARRAS_LENTA = 21;
const GROSOR_NORMAL = 0.55;
const GROSOR_LENTA = 0.68;
/** Ciclos por segundo de audio del vaivén interno de las barras; «Lento» avanza aún más despacio. */
const VAIVEN = 2.4;
const VAIVEN_LENTO = 1.5;
/** En reposo cada barra es un punto: la línea plana. */
const MIN_BARRA = 3;
const OPACIDAD_REPOSO = 0.5;
// Copia local: un worklet captura un número, no el módulo entero del que viene.
const MUESTRAS_POR_SEGUNDO = ENV_HZ;

interface ParametrosVoz {
  ancho: number;
  alto: number;
  barras: number;
  grosor: number;
  /** 0 (línea plana) a 1 (toda la energía). */
  energia: number;
  /** Fase del vaivén (ciclos). */
  fase: number;
  /** 0 a 1: la línea se dibuja del centro hacia los lados al conectarse. */
  conexion: number;
}

/** Traza las barras espejadas sobre la línea central como un solo `SkPath`. */
function trazarVoz(p: ParametrosVoz): SkPath {
  'worklet';
  const trazo = Skia.Path.Make();
  const paso = p.ancho / p.barras;
  const grosor = paso * p.grosor;
  const mitad = p.barras / 2;
  const techo = p.alto - 2;
  for (let i = 0; i < p.barras; i++) {
    const t = i / (p.barras - 1);
    const distancia = Math.abs(i + 0.5 - mitad) / mitad;
    if (distancia > p.conexion) continue;
    const a = 0.5 + 0.5 * Math.sin(2 * Math.PI * (p.fase + t * 2.1));
    const b = 0.5 + 0.5 * Math.sin(2 * Math.PI * (p.fase * 1.7 - t * 3.3) + 0.9);
    const forma = 0.25 + 0.75 * (0.6 * a + 0.4 * b);
    // Las barras de los lados suben menos: la onda se ve como una sola voz, no como un tablero.
    const afinado = 0.35 + 0.65 * Math.cos((Math.PI / 2) * distancia);
    const alto = Math.min(techo, Math.max(MIN_BARRA, techo * p.energia * forma * afinado));
    const x = i * paso + (paso - grosor) / 2;
    trazo.addRRect(Skia.RRectXY(Skia.XYWHRect(x, (p.alto - alto) / 2, grosor, alto), grosor / 2, grosor / 2));
  }
  return trazo;
}

/** Energía de la voz en `pos` segundos, interpolada entre dos muestras de la envolvente. */
export function energiaEn(envolvente: number[], pos: number): number {
  'worklet';
  const x = Math.max(0, pos) * MUESTRAS_POR_SEGUNDO;
  const i = Math.floor(x);
  const a = envolvente[i] ?? 0;
  const b = envolvente[i + 1] ?? 0;
  return a + (b - a) * (x - i);
}

/** El tono de la onda cuando suena el español (Detalle): neutro, para distinguir los dos idiomas sin otro color de marca. */
const NEUTRO: [string, string, string] = [color.textMuted, color.textMuted, color.textMuted];

interface Props {
  voz: VozEnVivo;
  /** Energía de la voz de 0 a 1 (`analizar().envolvente`). */
  envolvente: number[];
  alto: number;
  /** `senal` (el degradado de siempre) o `neutro` (`textMuted`, la voz en español). */
  tono?: 'senal' | 'neutro';
}

function Barras({ voz, envolvente, alto, tono = 'senal' }: Props) {
  const { pos, activa, lenta } = voz;
  const reducido = useMovimientoReducido();
  const tam = useSharedValue<SkSize>({ width: 0, height: alto });
  const env = useSharedValue<number[]>(envolvente);
  // La señal se conecta al montar: la línea se dibuja del centro hacia los lados.
  const conexion = useSharedValue(reducido ? 1 : 0);

  useEffect(() => {
    env.set(envolvente);
  }, [envolvente, env]);

  useEffect(() => {
    conexion.set(reducido ? 1 : withTiming(1, { duration: motionDuration.lento, easing: motionEasing.entrar }));
  }, [reducido, conexion]);

  const barras = lenta ? BARRAS_LENTA : BARRAS_NORMAL;
  const grosor = lenta ? GROSOR_LENTA : GROSOR_NORMAL;
  const vaiven = lenta ? VAIVEN_LENTO : VAIVEN;

  const trazo = useDerivedValue(() => {
    const { width, height } = tam.get();
    // Con reducir movimiento la onda es una línea estática: no lee la posición.
    const energia = reducido ? 0 : energiaEn(env.get(), pos.get()) * activa.get();
    return trazarVoz({
      ancho: width,
      alto: height,
      barras,
      grosor,
      energia,
      fase: reducido ? 0 : Math.max(0, pos.get()) * vaiven,
      conexion: conexion.get(),
    });
  });
  const opacidad = useDerivedValue(() => OPACIDAD_REPOSO + (1 - OPACIDAD_REPOSO) * activa.get());
  const fin = useDerivedValue(() => vec(tam.get().width, 0));

  return (
    <Canvas style={[styles.lienzo, { height: alto }]} onSize={tam} pointerEvents="none" accessible={false}>
      <Path path={trazo} opacity={opacidad}>
        <LinearGradient start={vec(0, 0)} end={fin} colors={tono === 'neutro' ? NEUTRO : senal} />
      </Path>
    </Canvas>
  );
}

/**
 * La onda de la voz: el héroe de Estudio. Plana en reposo; con la reproducción
 * (Escuchar, Lento o el audio automático) sube con la energía de la voz y se
 * aplana en `base` al terminar. La energía sale de los tiempos de palabra, no de
 * la amplitud real del audio. Decorativa: el lector de pantalla no la ve.
 */
export function OndaVoz(props: Props) {
  return (
    <FxSeguro>
      <Barras {...props} />
    </FxSeguro>
  );
}

const styles = StyleSheet.create({
  lienzo: { alignSelf: 'stretch' },
});
