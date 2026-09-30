import { useCallback, useRef, type RefObject } from 'react';
import type { View } from 'react-native';
import type { EstallidosRef, Trozo } from '@/features/juegos/dulces/components/Estallidos';
import { TROZOS_RETRASO_MS, azarFijo, trozosDelPaso, trozosPorPieza } from '@/features/juegos/dulces/logic/tablero';
import type { Paso } from '@/domain/match3Pasos';
import { motionDulces } from '@/theme';
import type { DulceObjetivo } from '@/types';

type Caja = { x: number; y: number; w: number; h: number };

/**
 * Los trozos de las piezas vuelan a las barras: hace falta saber dónde están el tablero y cada barra, en la
 * misma capa. Se miden al empezar cada jugada (el scroll pudo cambiarlas).
 */
export function useMedidasDulces(
  objetivosRef: RefObject<DulceObjetivo[]>,
  medidas: { COLS: number; LADO: number; PASO_CELDA: number }
) {
  const { COLS, LADO, PASO_CELDA } = medidas;
  const capaRef = useRef<View>(null);
  const tableroCajaRef = useRef<View>(null);
  const estallidosRef = useRef<EstallidosRef>(null);
  const barras = useRef(new Map<number, View>());
  const frases = useRef(new Map<number, View>());
  const posiciones = useRef<{
    tablero: { x: number; y: number } | null;
    barras: Map<number, Caja>;
    frases: Map<number, Caja>;
  }>({ tablero: null, barras: new Map(), frases: new Map() });

  const registrarBarra = useCallback((colorPieza: number, vista: View | null) => {
    if (vista) barras.current.set(colorPieza, vista);
    else barras.current.delete(colorPieza);
  }, []);

  const registrarFrase = useCallback((colorPieza: number, vista: View | null) => {
    if (vista) frases.current.set(colorPieza, vista);
    else frases.current.delete(colorPieza);
  }, []);

  const medirPosiciones = useCallback(() => {
    const capa = capaRef.current;
    if (!capa) return;
    tableroCajaRef.current?.measureLayout(
      capa,
      (x, y) => {
        posiciones.current.tablero = { x, y };
      },
      () => undefined
    );
    barras.current.forEach((vista, colorPieza) => {
      vista.measureLayout(
        capa,
        (x, y, w, h) => {
          posiciones.current.barras.set(colorPieza, { x, y, w, h });
        },
        () => undefined
      );
    });
    frases.current.forEach((vista, colorPieza) => {
      vista.measureLayout(
        capa,
        (x, y, w, h) => {
          posiciones.current.frases.set(colorPieza, { x, y, w, h });
        },
        () => undefined
      );
    });
  }, []);

  /** Dónde está la frase de una meta, si ya se midió. */
  const cajaFrase = useCallback((colorPieza: number) => posiciones.current.frases.get(colorPieza), []);

  /** Las piezas de un paso estallan: de cada una salen trozos de su color que vuelan al frente de la barra de su meta. */
  const alEstallar = useCallback(
    (paso: Paso) => {
      const origen = posiciones.current.tablero;
      if (!origen) return;
      const total = paso.quitar.length;
      const porPieza = trozosPorPieza(total);
      const limite = trozosDelPaso(total);
      const trozos: Trozo[] = [];
      paso.quitar.forEach((celda, k) => {
        const c = paso.colores[k] as number;
        const cx = origen.x + (celda % COLS) * PASO_CELDA + LADO / 2;
        const cy = origen.y + Math.floor(celda / COLS) * PASO_CELDA + LADO / 2;
        const barra = posiciones.current.barras.get(c);
        const meta = objetivosRef.current.find((o) => o.color === c);
        const frente = meta ? Math.min(1, (meta.llevas + (paso.porColor[c] ?? 0)) / meta.meta) : 1;
        for (let m = 0; m < porPieza && trozos.length < limite; m++) {
          const semilla = celda * 7 + m;
          // Un color sin meta no tiene barra a la que ir: sus trozos se dispersan y caen.
          const aLaBarra = barra !== undefined && meta !== undefined;
          trozos.push({
            x0: cx + (azarFijo(semilla) - 0.5) * LADO * 0.6,
            y0: cy + (azarFijo(semilla + 101) - 0.5) * LADO * 0.6,
            x1: aLaBarra ? barra.x + barra.w * frente : cx + (azarFijo(semilla + 33) - 0.5) * 70,
            y1: aLaBarra ? barra.y + barra.h / 2 : cy + 46,
            color: c,
            // Salen cuando la pieza ya se está yendo, y no todos a la vez.
            retraso: motionDulces.pulso + Math.round(azarFijo(semilla + 57) * TROZOS_RETRASO_MS),
          });
        }
      });
      estallidosRef.current?.lanzar(trozos);
    },
    [COLS, LADO, PASO_CELDA, objetivosRef]
  );

  return { capaRef, tableroCajaRef, estallidosRef, registrarBarra, registrarFrase, medirPosiciones, cajaFrase, alEstallar };
}
