/**
 * Dónde vive la imagen de portada de cada mundo y de cada juego.
 *
 * Están en un solo archivo porque son rutas, no diseño: si mañana las
 * imágenes se mueven a otra carpeta o cambian de formato, se edita aquí
 * y ninguna pantalla se entera.
 *
 * Mientras el archivo no exista, la tarjeta usa su degradado y se ve
 * bien igual. Se pueden ir metiendo de una en una.
 */

export const PORTADA_MUNDO: Record<string, string> = {
  calle: 'img/mundos/calle.webp',
  dinero: 'img/mundos/dinero.webp',
  dia_a_dia: 'img/mundos/dia_a_dia.webp',
  gente: 'img/mundos/gente.webp',
  cultura: 'img/mundos/cultura.webp',
  tech: 'img/mundos/tech.webp',
  legal: 'img/mundos/legal.webp',
  fonetica: 'img/mundos/fonetica.webp',
};

export const PORTADA_JUEGO: Record<string, string> = {
  colmena: 'img/juegos/colmena.webp',
  pares: 'img/juegos/pares.webp',
  caida: 'img/juegos/caida.webp',
  dulces: 'img/juegos/dulces.webp',
  judge: 'img/juegos/judge.webp',
  cazala: 'img/juegos/cazala.webp',
  pares_minimos: 'img/juegos/habla.webp',
  gramatica: 'img/juegos/gramatica.webp',
  oido: 'img/juegos/oido.webp',
  sonidos: 'img/juegos/sonidos.webp',
  suena: 'img/juegos/suena.webp',
  errores: 'img/juegos/errores.webp',
  atoran: 'img/juegos/atoran.webp',
  mazo: 'img/juegos/mazo.webp',
  lecturas: 'img/juegos/lecturas.webp',
  phrasal: 'img/juegos/phrasal.webp',
  azar: 'img/juegos/azar.webp',
};
