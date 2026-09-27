import React from 'react';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { color as tinta, depth, pieza, radius } from '@/theme';
import { CAJA, TRAZOS, formaDe } from './piezas';

/** Los cuatro tonos (claro, medio, oscuro y símbolo) del tinte de un color: con el medio se pintan las barras de las metas. */
export function tinteDe(color: number): (typeof pieza.tintes)[number] {
  const indice = ((Math.trunc(color) % pieza.tintes.length) + pieza.tintes.length) % pieza.tintes.length;
  return pieza.tintes[indice] ?? pieza.tintes[0];
}

/** Qué tanto de la cara ocupa el símbolo. */
const PROPORCION_SIMBOLO = 0.45;

interface SimboloProps {
  color: number;
  /** El lado del recuadro donde va el símbolo, en dp. */
  tam: number;
  x: number;
  y: number;
}

/**
 * El símbolo de un color, en un tono del mismo matiz un 70 % más oscuro que la cara (no
 * blanco: se perdería sobre los colores claros como `amarillo`): círculo, triángulo,
 * cuadrado, rombo, estrella o hexágono. Va dentro de un `Svg`.
 */
export function SimboloPieza({ color, tam, x, y }: SimboloProps) {
  const escala = tam / CAJA;
  return <Path d={TRAZOS[formaDe(color)]} fill={tinteDe(color).simbolo} transform={`translate(${x} ${y}) scale(${escala})`} />;
}

interface Props {
  color: number;
  /** El lado de la pieza entera (cara y canto), en dp. */
  lado: number;
}

/**
 * La cara de una pieza, vista como un cubito: la cara de arriba con un degradado del mismo tono (el claro
 * donde da el sol, arriba a la izquierda), un brillo suave del sol y, debajo, el canto inferior con
 * `biselSombra`. El símbolo del color va al centro de la cara. Todo en un solo SVG: con 72 piezas en
 * el tablero cada una cuesta una vista, no cinco.
 */
export function CaraPieza({ color, lado }: Props) {
  const indice = ((Math.trunc(color) % pieza.tintes.length) + pieza.tintes.length) % pieza.tintes.length;
  const t = tinteDe(color);
  const bisel = lado >= 40 ? depth.md : depth.sm;
  const cara = lado - bisel;
  const r = Math.min(radius.sm, lado * 0.3);
  const tam = cara * PROPORCION_SIMBOLO;

  return (
    <Svg width={lado} height={lado}>
      <Defs>
        <LinearGradient id={`cara${indice}`} x1="0" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={t.claro} />
          <Stop offset="0.5" stopColor={t.medio} />
          <Stop offset="1" stopColor={t.oscuro} />
        </LinearGradient>
        <RadialGradient id={`sol${indice}`} cx="0.22" cy="0.16" rx="0.62" ry="0.5">
          <Stop offset="0" stopColor={pieza.brillo} />
          <Stop offset="1" stopColor={pieza.brilloFin} />
        </RadialGradient>
      </Defs>
      {/* El canto: el mismo tinte, hundido con negro. Solo asoma debajo de la cara. */}
      <Rect x={0} y={0} width={lado} height={lado} rx={r} fill={t.oscuro} />
      <Rect x={0} y={0} width={lado} height={lado} rx={r} fill={tinta.biselSombra} />
      <Rect x={0} y={0} width={lado} height={cara} rx={r} fill={`url(#cara${indice})`} />
      <Rect x={0} y={0} width={lado} height={cara} rx={r} fill={`url(#sol${indice})`} />
      <SimboloPieza color={color} tam={tam} x={(lado - tam) / 2} y={(cara - tam) / 2} />
    </Svg>
  );
}
