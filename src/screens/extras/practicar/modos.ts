import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '@/navigation/routes';
import type { ModoId } from './hoy';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * Los grupos de "Todo lo demás". Con los grupos plegados, Practicar muestra
 * 1 acción de HOY + NUM_DESTACADOS tarjetas + un renglón por grupo: 7 como máximo (ACC-3).
 */
export const GRUPOS = [
  { id: 'juegos', titulo: 'Juegos' },
  { id: 'oir', titulo: 'Oír y hablar' },
  { id: 'leer', titulo: 'Leer y repasar' },
] as const;

export type GrupoId = (typeof GRUPOS)[number]['id'];

export interface Modo {
  titulo: string;
  cuerpo: string;
  /** Clave de PORTADA_JUEGO. */
  arte: string;
  grupo: GrupoId;
  ir: (nav: Nav) => void;
}

/** Los 17 destinos de Practicar. El orden de aparición sale de `ORDEN` en hoy.ts. */
export const MODOS: Record<ModoId, Modo> = {
  study: {
    titulo: 'Estudiar',
    cuerpo: 'Tus repasos del día y frases nuevas, en unos tres minutos',
    arte: 'azar',
    grupo: 'leer',
    ir: (nav) => nav.navigate('Study', undefined),
  },
  gramatica: {
    titulo: 'Gramática',
    cuerpo: 'Tiempos, modales, condicionales y qué decir en cada situación',
    arte: 'gramatica',
    grupo: 'leer',
    ir: (nav) => nav.navigate('Gramatica'),
  },
  colmena: {
    titulo: 'Colmena',
    cuerpo: 'Arma la palabra letra por letra · 200 niveles',
    arte: 'colmena',
    grupo: 'juegos',
    ir: (nav) => nav.navigate('Niveles', { juego: 'colmena' }),
  },
  pares: {
    titulo: 'Pares',
    cuerpo: 'Junta cada frase con su significado · 200 niveles',
    arte: 'pares',
    grupo: 'juegos',
    ir: (nav) => nav.navigate('Niveles', { juego: 'pares' }),
  },
  caida: {
    titulo: 'Caída',
    cuerpo: 'Dos opciones bajando, contra reloj · 200 niveles',
    arte: 'caida',
    grupo: 'juegos',
    ir: (nav) => nav.navigate('Niveles', { juego: 'caida' }),
  },
  dulces: {
    titulo: 'Dulces',
    cuerpo: 'Tres en línea con frases al azar · 200 niveles',
    arte: 'dulces',
    grupo: 'juegos',
    ir: (nav) => nav.navigate('Niveles', { juego: 'dulces' }),
  },
  cazala: {
    titulo: 'Cázala',
    cuerpo: 'Oye una frase rápida y di qué reducciones traía',
    arte: 'cazala',
    grupo: 'juegos',
    ir: (nav) => nav.navigate('Cazala'),
  },
  pares_minimos: {
    titulo: 'Di la palabra',
    cuerpo: 'Wero te escucha y te dice cuál palabra entendió',
    arte: 'pares_minimos',
    grupo: 'oir',
    ir: (nav) => nav.navigate('MinimalPairs', undefined),
  },
  oido: {
    titulo: 'Modo oído',
    cuerpo: 'Escucha en el camión, sin tocar la pantalla',
    arte: 'oido',
    grupo: 'oir',
    ir: (nav) => nav.navigate('EarMode', undefined),
  },
  sonidos: {
    titulo: 'Laboratorio de sonidos',
    cuerpo: 'Los 44 sonidos del inglés y los que no existen en español',
    arte: 'sonidos',
    grupo: 'oir',
    ir: (nav) => nav.navigate('Pronunciation', undefined),
  },
  suena: {
    titulo: 'Cómo suena de verdad',
    cuerpo: 'Gonna, wanna, wader: lo que se dice y no se escribe',
    arte: 'suena',
    grupo: 'oir',
    ir: (nav) => nav.navigate('Contractions'),
  },
  phrasal: {
    titulo: 'Phrasal verbs',
    cuerpo: 'Frases donde la partícula lo cambia todo',
    arte: 'phrasal',
    grupo: 'leer',
    ir: (nav) => nav.navigate('Phrasal'),
  },
  azar: {
    titulo: 'Al azar',
    cuerpo: 'Frases sueltas, sin algoritmo y sin llevar cuenta',
    arte: 'azar',
    grupo: 'leer',
    ir: (nav) => nav.navigate('Azar'),
  },
  lecturas: {
    titulo: 'Lecturas',
    cuerpo: 'Historias hechas con frases que ya viste. Hay para niños.',
    arte: 'lecturas',
    grupo: 'leer',
    ir: (nav) => nav.navigate('Lecturas'),
  },
  errores: {
    titulo: 'Errores que te delatan',
    cuerpo: 'Lo que llevas años diciendo mal sin que nadie te corrija',
    arte: 'errores',
    grupo: 'leer',
    ir: (nav) => nav.navigate('Errors'),
  },
  atoran: {
    titulo: 'Se me atoran',
    cuerpo: 'Las que más fallas, sin cronómetro',
    arte: 'atoran',
    grupo: 'leer',
    ir: (nav) => nav.navigate('Stuck'),
  },
  mazo: {
    titulo: 'Mi mazo',
    cuerpo: 'Las que guardaste con estrella',
    arte: 'mazo',
    grupo: 'leer',
    ir: (nav) => nav.navigate('Deck'),
  },
};
