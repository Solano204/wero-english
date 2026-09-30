import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Entry, JuegoId } from '@/types';
import type { DocLegal } from '@/legal/tipos';

/** Todas las rutas en un solo lugar, tipadas. */

export type RootStackParams = {
  Boot: undefined;
  Auth: undefined;
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainTabParams> | undefined;

  Study: { packId?: string } | undefined;

  Detail: { entryId: number };
  PackDetail: { packId: string };
  WorldDetail: { worldId: string };


  /* Juegos de la v3. Todos terminan en la misma pantalla de cierre,
     que es la que otorga estrellas y abre el siguiente. */
  /* Cada juego se abre en un nivel. Sin nivel arranca en el que sigue. */
  Niveles: { juego: JuegoId };
  Colmena: { nivel?: number } | undefined;
  Pares: { nivel?: number } | undefined;
  Caida: { nivel?: number } | undefined;
  Dulces: { nivel?: number } | undefined;
  GameEnd: {
    juego: JuegoId;
    rondas: number;
    aciertos: number;
    /** Si viene, la pantalla otorga estrellas y abre el siguiente. */
    nivel?: number;
  };

  EarMode: { packId?: string } | undefined;
  Pronunciation: { fonemaId?: string } | undefined;
  Contractions: undefined;
  Cazala: undefined;
  Errors: undefined;
  ErrorDetail: { errorId: string };

  MinimalPairs: { fonemaId?: string } | undefined;

  Gramatica: undefined;
  GramaticaTema: { temaId: string };

  Phrasal: undefined;
  /** `origen`: dónde estaba el verbo en la lista (coordenadas de la ventana), para que viaje hasta su título. */
  PhrasalVerbo: { verbo: string; origen?: { x: number; y: number; width: number; height: number } | null };
  Azar: undefined;
  Lecturas: undefined;
  Lectura: { lecturaId: string };

  Downloads: undefined;
  Settings: undefined;
  /** Un texto legal empaquetado; también existe fuera de la sesión (entrada y onboarding). */
  LegalDoc: { doc: DocLegal };
  /** Confirmación de «Borrar cuenta y datos» (`cuenta`) o «Borrar todos mis datos» (`datos`). */
  Borrar: { modo: 'cuenta' | 'datos' };
  Stuck: undefined;
  Deck: undefined;
  Diagnostics: undefined;
  SfxSampler: undefined;
};

export type MainTabParams = {
  Explore: undefined;
  Practice: undefined;
  Progress: undefined;
};

/** El destino que abre cada notificación, según el campo abre_en. */
export const NOTIF_TARGETS: Record<string, keyof RootStackParams> = {
  'P-02': 'Main',
  'P-05': 'Study',
  'P-12': 'Main',
  'P-13': 'Main',
  'P-21': 'Lecturas',
  'P-22': 'Errors',
  'P-23': 'Main',
  'P-24': 'Colmena',
  'P-25': 'Pares',
  'P-10b': 'MinimalPairs',
  'P-26': 'Caida',
  'P-27': 'Dulces',
};

export type EntryLike = Pick<Entry, 'id'>;
