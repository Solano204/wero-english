import type { IconName } from '@/shared/ui';
import type { ModoId } from '@/types/modos';
import type { GrupoId } from './modos';

/** Ícono de cada modo: la ficha de su renglón y la portada estática de un destacado (sin letras). */
export const ICONO_MODO: Record<ModoId, IconName> = {
  study: 'cards',
  gramatica: 'book',
  colmena: 'hexagon',
  pares: 'link',
  caida: 'arrow-down',
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

/** Ícono de cada grupo plegable de "Todo lo demás". */
export const ICONO_GRUPO: Record<GrupoId, IconName> = {
  juegos: 'game',
  oir: 'ear',
  leer: 'books',
};
