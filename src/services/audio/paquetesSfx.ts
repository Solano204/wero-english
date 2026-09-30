/* eslint-disable @typescript-eslint/no-var-requires */
/* Los archivos de cada paquete de efectos (A, B, C y D). */

export type SfxKey =
  | 'success'
  | 'fail'
  | 'tap'
  | 'match'
  | 'combo'
  | 'nivelCompleto'
  | 'caidaPieza'
  | 'pista';

/** Los 4 juegos de sonido: D es el actual (sin variantes ni escalera); A/B/C son los nuevos. */
export type SfxPackId = 'A' | 'B' | 'C' | 'D';

/**
 * `success` tiene 5 alturas (escalera de aciertos) × 3 variantes; `fail`/`tap`/`match` solo 3
 * variantes; el resto, un solo archivo. Todos los `require()` son literales (Metro no permite
 * una ruta calculada), así que este catálogo es largo mecánicamente, no complicado.
 */
interface FuentesPaquete {
  success: readonly (readonly number[])[]; // [escalon 1..5][variante 0..2]
  fail: readonly number[];
  tap: readonly number[];
  match: readonly number[];
  combo: number;
  nivelCompleto: number;
  caidaPieza: number;
  pista: number;
}

const unaVoz = (m: number): readonly number[] => [m, m, m];
const unaAltura = (m: number): readonly number[] => [m, m, m];

const PAQUETE_D: FuentesPaquete = {
  // D no tenía variantes ni escalera: los 5×3 huecos de `success` apuntan al mismo archivo de siempre.
  success: [1, 2, 3, 4, 5].map(() => unaAltura(require('../../../assets/sfx/success.wav'))),
  fail: unaVoz(require('../../../assets/sfx/fail.wav')),
  tap: unaVoz(require('../../../assets/sfx/tap.wav')),
  match: unaVoz(require('../../../assets/sfx/match.wav')),
  combo: require('../../../assets/sfx/combo.wav'),
  nivelCompleto: require('../../../assets/sfx/nivel_completo.wav'),
  caidaPieza: require('../../../assets/sfx/caida_pieza.wav'),
  pista: require('../../../assets/sfx/pista.wav'),
};

const PAQUETE_A: FuentesPaquete = {
  success: [
    [require('../../../assets/sfx/a/success_h1_v1.wav'), require('../../../assets/sfx/a/success_h1_v2.wav'), require('../../../assets/sfx/a/success_h1_v3.wav')],
    [require('../../../assets/sfx/a/success_h2_v1.wav'), require('../../../assets/sfx/a/success_h2_v2.wav'), require('../../../assets/sfx/a/success_h2_v3.wav')],
    [require('../../../assets/sfx/a/success_h3_v1.wav'), require('../../../assets/sfx/a/success_h3_v2.wav'), require('../../../assets/sfx/a/success_h3_v3.wav')],
    [require('../../../assets/sfx/a/success_h4_v1.wav'), require('../../../assets/sfx/a/success_h4_v2.wav'), require('../../../assets/sfx/a/success_h4_v3.wav')],
    [require('../../../assets/sfx/a/success_h5_v1.wav'), require('../../../assets/sfx/a/success_h5_v2.wav'), require('../../../assets/sfx/a/success_h5_v3.wav')],
  ],
  fail: [require('../../../assets/sfx/a/fail_1.wav'), require('../../../assets/sfx/a/fail_2.wav'), require('../../../assets/sfx/a/fail_3.wav')],
  tap: [require('../../../assets/sfx/a/tap_1.wav'), require('../../../assets/sfx/a/tap_2.wav'), require('../../../assets/sfx/a/tap_3.wav')],
  match: [require('../../../assets/sfx/a/match_1.wav'), require('../../../assets/sfx/a/match_2.wav'), require('../../../assets/sfx/a/match_3.wav')],
  combo: require('../../../assets/sfx/a/combo.wav'),
  nivelCompleto: require('../../../assets/sfx/a/nivel_completo.wav'),
  caidaPieza: require('../../../assets/sfx/a/caida_pieza.wav'),
  pista: require('../../../assets/sfx/a/pista.wav'),
};

const PAQUETE_B: FuentesPaquete = {
  success: [
    [require('../../../assets/sfx/b/success_h1_v1.wav'), require('../../../assets/sfx/b/success_h1_v2.wav'), require('../../../assets/sfx/b/success_h1_v3.wav')],
    [require('../../../assets/sfx/b/success_h2_v1.wav'), require('../../../assets/sfx/b/success_h2_v2.wav'), require('../../../assets/sfx/b/success_h2_v3.wav')],
    [require('../../../assets/sfx/b/success_h3_v1.wav'), require('../../../assets/sfx/b/success_h3_v2.wav'), require('../../../assets/sfx/b/success_h3_v3.wav')],
    [require('../../../assets/sfx/b/success_h4_v1.wav'), require('../../../assets/sfx/b/success_h4_v2.wav'), require('../../../assets/sfx/b/success_h4_v3.wav')],
    [require('../../../assets/sfx/b/success_h5_v1.wav'), require('../../../assets/sfx/b/success_h5_v2.wav'), require('../../../assets/sfx/b/success_h5_v3.wav')],
  ],
  fail: [require('../../../assets/sfx/b/fail_1.wav'), require('../../../assets/sfx/b/fail_2.wav'), require('../../../assets/sfx/b/fail_3.wav')],
  tap: [require('../../../assets/sfx/b/tap_1.wav'), require('../../../assets/sfx/b/tap_2.wav'), require('../../../assets/sfx/b/tap_3.wav')],
  match: [require('../../../assets/sfx/b/match_1.wav'), require('../../../assets/sfx/b/match_2.wav'), require('../../../assets/sfx/b/match_3.wav')],
  combo: require('../../../assets/sfx/b/combo.wav'),
  nivelCompleto: require('../../../assets/sfx/b/nivel_completo.wav'),
  caidaPieza: require('../../../assets/sfx/b/caida_pieza.wav'),
  pista: require('../../../assets/sfx/b/pista.wav'),
};

const PAQUETE_C: FuentesPaquete = {
  success: [
    [require('../../../assets/sfx/c/success_h1_v1.wav'), require('../../../assets/sfx/c/success_h1_v2.wav'), require('../../../assets/sfx/c/success_h1_v3.wav')],
    [require('../../../assets/sfx/c/success_h2_v1.wav'), require('../../../assets/sfx/c/success_h2_v2.wav'), require('../../../assets/sfx/c/success_h2_v3.wav')],
    [require('../../../assets/sfx/c/success_h3_v1.wav'), require('../../../assets/sfx/c/success_h3_v2.wav'), require('../../../assets/sfx/c/success_h3_v3.wav')],
    [require('../../../assets/sfx/c/success_h4_v1.wav'), require('../../../assets/sfx/c/success_h4_v2.wav'), require('../../../assets/sfx/c/success_h4_v3.wav')],
    [require('../../../assets/sfx/c/success_h5_v1.wav'), require('../../../assets/sfx/c/success_h5_v2.wav'), require('../../../assets/sfx/c/success_h5_v3.wav')],
  ],
  fail: [require('../../../assets/sfx/c/fail_1.wav'), require('../../../assets/sfx/c/fail_2.wav'), require('../../../assets/sfx/c/fail_3.wav')],
  tap: [require('../../../assets/sfx/c/tap_1.wav'), require('../../../assets/sfx/c/tap_2.wav'), require('../../../assets/sfx/c/tap_3.wav')],
  match: [require('../../../assets/sfx/c/match_1.wav'), require('../../../assets/sfx/c/match_2.wav'), require('../../../assets/sfx/c/match_3.wav')],
  combo: require('../../../assets/sfx/c/combo.wav'),
  nivelCompleto: require('../../../assets/sfx/c/nivel_completo.wav'),
  caidaPieza: require('../../../assets/sfx/c/caida_pieza.wav'),
  pista: require('../../../assets/sfx/c/pista.wav'),
};

export const PAQUETES: Record<SfxPackId, FuentesPaquete> = { A: PAQUETE_A, B: PAQUETE_B, C: PAQUETE_C, D: PAQUETE_D };
