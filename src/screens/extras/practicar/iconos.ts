import type { IconName } from '@/components/base';
import type { ModoId } from './hoy';

/** Ícono de la portada estática de cada modo (sin letras). */
export const ICONO_MODO: Record<ModoId, IconName> = {
  study: 'cards',
  gramatica: 'book',
  colmena: 'hexagon',
  pares: 'cards',
  caida: 'arrow-right',
  dulces: 'star',
  cazala: 'target',
  pares_minimos: 'microphone',
  oido: 'headphones',
  sonidos: 'waveform',
  suena: 'ear',
  phrasal: 'puzzle',
  azar: 'shuffle',
  lecturas: 'books',
  errores: 'warning',
  atoran: 'anchor',
  mazo: 'bookmark',
};
