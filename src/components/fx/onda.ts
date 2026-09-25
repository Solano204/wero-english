import { Skia, type SkPath } from '@shopify/react-native-skia';

/** Barras del ecualizador. */
export const BARRAS = 28;
/** Fracción del alto del lienzo que alcanza la barra más alta: la onda vive en la parte baja. */
export const ZONA = 0.42;
const MIN_BARRA = 3;

export interface ParametrosOnda {
  ancho: number;
  alto: number;
  /** 0 a 1: avance del ciclo de respiro (4 s). */
  fase: number;
  /** 0 (línea plana) a 1 (toda la energía). */
  energia: number;
  /** 0 a 1: microruido de interferencia. */
  ruido: number;
  margenAbajo: number;
}

/**
 * Traza las barras como un solo `SkPath`. Corre en el hilo de UI cada cuadro:
 * 28 rectángulos redondeados, sin asignar nada más.
 */
export function trazarBarras(p: ParametrosOnda): SkPath {
  'worklet';
  const trazo = Skia.Path.Make();
  const paso = p.ancho / BARRAS;
  const grosor = paso * 0.55;
  const techo = p.alto * ZONA;
  for (let i = 0; i < BARRAS; i++) {
    const t = i / (BARRAS - 1);
    const a = 0.5 + 0.5 * Math.sin(2 * Math.PI * (p.fase + t * 1.5));
    const b = 0.5 + 0.5 * Math.sin(2 * Math.PI * (p.fase * 2 - t * 2.3) + 0.6);
    const envolvente = 0.45 + 0.55 * Math.sin(Math.PI * t);
    const ruido = p.ruido * Math.sin(i * 127.1 + p.ruido * 311.7);
    const forma = 0.2 + 0.8 * (0.6 * a + 0.4 * b) * envolvente + 0.5 * ruido;
    const alto = Math.min(techo, Math.max(MIN_BARRA, techo * p.energia * forma));
    const x = i * paso + (paso - grosor) / 2;
    const y = p.alto - p.margenAbajo - alto;
    trazo.addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, grosor, alto), grosor / 2, grosor / 2));
  }
  return trazo;
}
