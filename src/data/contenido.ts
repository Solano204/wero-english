import type {
  Catalog,
  ConfusionesVozFile,
  ContraccionesFile,
  ErroresFile,
  FonemasFile,
  GramaticaFile,
  LecturasFile,
  JuegoNiveles,
  NivelesFile,
  NotificacionesFile,
  PhrasalFile,
  PacksFile,
  SituacionesFile,
} from '@/types';

/* Los JSON se importan con require para que Metro los inline en el
   bundle. Con import estático y resolveJsonModule el tipado es peor
   y los archivos vacíos rompen la compilación. */

/* eslint-disable @typescript-eslint/no-var-requires */

export interface ContentBundle {
  catalog: Catalog;
  packs: PacksFile;
  situaciones: SituacionesFile;
  contracciones: ContraccionesFile;
  errores: ErroresFile;
  fonemas: FonemasFile;
  notificaciones: NotificacionesFile;
  lecturas: LecturasFile;
  niveles: NivelesFile;
  phrasal: PhrasalFile;
  gramatica: GramaticaFile;
  confusionesVoz: ConfusionesVozFile;
}

/** Estructura vacía por archivo, para que la app arranque sin datos. */
const EMPTY: ContentBundle = {
  catalog: { total: 0, schema_version: 0, entries: [] },
  packs: {
    version: 0,
    generado: '',
    total_entradas: 0,
    total_packs: 0,
    mundos: [],
    packs: [],
  },
  situaciones: {
    version: 0,
    rondas_por_partida: 10,
    nota_juez: '',
    nota_seleccion: '',
    nota_imagen: '',
    arquetipos: [],
    escenarios: [],
  },
  contracciones: {
    version: 0,
    total_reducciones: 0,
    total_cazala: 0,
    nota_opciones: '',
    grupos: [],
    cazala: [],
  },
  errores: { version: 0, total: 0, nota_ipa: '', errores: [] },
  fonemas: {
    version: 0,
    total_fonemas: 0,
    total_reglas: 0,
    fonemas: [],
    reglas: [],
  },
  notificaciones: {
    version: 0,
    reglas: {
      max_vulgaridad: 1,
      solo_entradas_descargadas: true,
      no_repetir_en_dias: 14,
      max_por_dia: 1,
      ventana_horaria: '06:00-22:00',
      nota: '',
    },
    plantillas: [],
    vuelta: [],
    prohibido: [],
  },
  lecturas: {
    version: 0,
    total: 0,
    nota_frases: '',
    nota_audio: '',
    lecturas: [],
  },
  niveles: { version: 0, nivelesPorJuego: 0, nota: '', juegos: {} },
  phrasal: { version: 0, total: 0, nota: '', grupos: [], verbos: [] },
  gramatica: { version: 0, bloques: {}, temas: [] },
  confusionesVoz: { version: 0, fuente: '', nota: '', pares: {} },
};

/**
 * Carga un JSON tolerando que esté vacío o ausente.
 * Así puedes clonar el proyecto, correrlo, y pegar los datos después
 * sin que la app truene por un archivo que falta.
 */
function safeLoad<T>(loader: () => unknown, fallback: T, name: string): T {
  try {
    const raw = loader();
    if (!raw || typeof raw !== 'object') return fallback;
    if (Array.isArray(raw) && raw.length === 0) return fallback;
    return raw as T;
  } catch {
    if (__DEV__) console.warn(
      `[content] Falta o está vacío assets/data/${name}. ` +
        'Pega el contenido y recarga.'
    );
    return fallback;
  }
}

/** Cómo se carga cada archivo. Metro inlinea el JSON; el require() lo evalúa. */
const CARGADORES: { [K in keyof ContentBundle]: [() => unknown, string] } = {
  catalog: [() => require('@data/catalogo.json'), 'catalogo.json'],
  packs: [() => require('@data/packs.json'), 'packs.json'],
  situaciones: [() => require('@data/situaciones.json'), 'situaciones.json'],
  contracciones: [() => require('@data/contracciones.json'), 'contracciones.json'],
  errores: [() => require('@data/errores.json'), 'errores.json'],
  fonemas: [() => require('@data/fonemas.json'), 'fonemas.json'],
  notificaciones: [() => require('@data/notificaciones.json'), 'notificaciones.json'],
  lecturas: [() => require('@data/lecturas.json'), 'lecturas.json'],
  niveles: [() => require('@data/niveles.json'), 'niveles.json'],
  phrasal: [() => require('@data/phrasal_verbs.json'), 'phrasal_verbs.json'],
  gramatica: [() => require('@data/gramatica.json'), 'gramatica.json'],
  confusionesVoz: [() => require('@data/confusiones_voz.json'), 'confusiones_voz.json'],
};

let cache: ContentBundle | null = null;

/**
 * Todo el contenido, cada archivo cargado la primera vez que alguien lo lee.
 *
 * Evaluar un JSON grande bloquea el hilo de JS: antes los 11 archivos (~3 MB)
 * se evaluaban juntos en el arranque aunque el arranque solo necesita el
 * catálogo. Ahora cada propiedad es un getter que carga su archivo una vez.
 */
export function loadContent(): ContentBundle {
  if (cache) return cache;

  const bundle = {} as ContentBundle;
  for (const clave of Object.keys(CARGADORES) as (keyof ContentBundle)[]) {
    const [loader, name] = CARGADORES[clave];
    let valor: unknown;
    let listo = false;
    Object.defineProperty(bundle, clave, {
      enumerable: true,
      get() {
        if (!listo) {
          valor = safeLoad(loader, EMPTY[clave], name);
          listo = true;
        }
        return valor;
      },
    });
  }
  cache = bundle;
  return cache;
}

/** Qué archivos están vacíos. Se muestra en la pantalla de diagnóstico. */
export function contentHealth(): { name: string; ok: boolean; count: number }[] {
  const c = loadContent();
  return [
    { name: 'catalogo.json', ok: c.catalog.entries.length > 0, count: c.catalog.entries.length },
    { name: 'packs.json', ok: c.packs.packs.length > 0, count: c.packs.packs.length },
    { name: 'situaciones.json', ok: c.situaciones.escenarios.length > 0, count: c.situaciones.escenarios.length },
    { name: 'contracciones.json', ok: c.contracciones.grupos.length > 0, count: c.contracciones.cazala.length },
    { name: 'errores.json', ok: c.errores.errores.length > 0, count: c.errores.errores.length },
    { name: 'fonemas.json', ok: c.fonemas.fonemas.length > 0, count: c.fonemas.fonemas.length },
    { name: 'notificaciones.json', ok: c.notificaciones.plantillas.length > 0, count: c.notificaciones.plantillas.length },
    { name: 'lecturas.json', ok: c.lecturas.lecturas.length > 0, count: c.lecturas.lecturas.length },
    {
      name: 'niveles.json',
      ok: Object.keys(c.niveles.juegos).length > 0,
      count: Object.values(c.niveles.juegos).reduce(
        (s, j: JuegoNiveles) => s + j.total,
        0
      ),
    },
    { name: 'phrasal_verbs.json', ok: c.phrasal.verbos.length > 0, count: c.phrasal.verbos.length },
    { name: 'gramatica.json', ok: c.gramatica.temas.length > 0, count: c.gramatica.temas.length },
  ];
}
