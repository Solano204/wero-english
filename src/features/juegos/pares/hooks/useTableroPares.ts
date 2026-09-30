import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, View } from 'react-native';
import { distribuir } from '@/features/juegos/pares/logic/geometria';
import { escalon, motionDuration } from '@/theme';
import type { ParesTablero } from '@/types';

/**
 * Lo que mide y reparte el tablero de Pares: dónde cae cada ficha (según la zona medida), cuándo terminó de
 * caer la última, y dónde quedan la capa de la pantalla y la fila de segmentos (a donde vuela cada par).
 */
export function useTableroPares(tablero: ParesTablero | null, reducido: boolean) {
  // El tablero se reparte con las fichas cayendo una tras otra; el reloj y los toques esperan a que caiga la última.
  const [repartidoDe, setRepartidoDe] = useState<ParesTablero | null>(null);
  const repartido = tablero !== null && repartidoDe === tablero;
  // Lo que mide la zona del tablero: de ahí sale dónde cae cada ficha.
  const [zona, setZona] = useState({ x: 0, y: 0, ancho: 0, alto: 0 });
  const geo = useMemo(
    () => distribuir(tablero?.fichas.length ?? 0, zona.ancho, zona.alto),
    [tablero?.fichas.length, zona.ancho, zona.alto]
  );
  const alMedirZona = useCallback((e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setZona((z) => (z.x === x && z.y === y && z.ancho === width && z.alto === height ? z : { x, y, ancho: width, alto: height }));
  }, []);
  const fichasTotal = tablero?.fichas.length ?? 0;
  useEffect(() => {
    if (!tablero || zona.ancho === 0 || repartidoDe === tablero) return undefined;
    const demora = reducido ? motionDuration.rapido : escalon(fichasTotal - 1) + motionDuration.escena;
    const t = setTimeout(() => setRepartidoDe(tablero), demora);
    return () => clearTimeout(t);
  }, [tablero, zona.ancho, repartidoDe, fichasTotal, reducido]);
  // La capa donde se funden las fichas mide lo que toda la pantalla; `segmentos` es la esquina de la fila de progreso en esa capa.
  const capaRef = useRef<View>(null);
  const segmentosRef = useRef<View>(null);
  const scrollY = useRef(0);
  const [capa, setCapa] = useState({ ancho: 0, alto: 0 });
  const [segmentos, setSegmentos] = useState<{ x: number; y: number } | null>(null);
  const medirSegmentos = useCallback(() => {
    const raiz = capaRef.current;
    if (!raiz) return;
    segmentosRef.current?.measureLayout(
      raiz,
      (x, y) => setSegmentos((s) => (s && s.x === x && s.y === y ? s : { x, y })),
      () => undefined
    );
  }, []);
  const alMedirCapa = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setCapa((c) => (c.ancho === width && c.alto === height ? c : { ancho: width, alto: height }));
      medirSegmentos();
    },
    [medirSegmentos]
  );
  const alScrollear = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);

  return { repartido, zona, geo, alMedirZona, capaRef, segmentosRef, scrollY, capa, segmentos, medirSegmentos, alMedirCapa, alScrollear };
}
