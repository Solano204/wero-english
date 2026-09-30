import { DevSettings } from 'react-native';
import type { Color } from './tokens';
import { paletaPorId, type PaletaId } from './paletas';

/**
 * Solo en desarrollo: qué paleta del muestrario se está probando sobre la app real.
 *
 * Se guarda en una base aparte (`wero-dev.db`, nunca la de los datos) y se lee SÍNCRONA al cargar tokens.ts, antes de
 * que cualquier pantalla arme su StyleSheet: por eso cambiar de paleta recarga la app. En release no se usa nunca
 * (tokens.ts solo llama a esto con __DEV__).
 */

export type OpcionMundos = 'a' | 'b';

interface Guardado {
  paleta: PaletaId;
  mundos: OpcionMundos;
}

const POR_OMISION: Guardado = { paleta: 'D', mundos: 'a' };

type BaseSincrona = {
  execSync: (sql: string) => void;
  getFirstSync: <T>(sql: string, ...params: unknown[]) => T | null;
  runSync: (sql: string, ...params: unknown[]) => unknown;
};

let base: BaseSincrona | null | undefined;

function abrir(): BaseSincrona | null {
  if (base !== undefined) return base;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sqlite = require('expo-sqlite') as { openDatabaseSync: (nombre: string) => BaseSincrona };
    const db = sqlite.openDatabaseSync('wero-dev.db');
    db.execSync('CREATE TABLE IF NOT EXISTS dev_ajuste (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);');
    base = db;
  } catch {
    base = null;
  }
  return base;
}

export function leerPaletaDev(): Guardado {
  const db = abrir();
  if (!db) return POR_OMISION;
  try {
    const fila = db.getFirstSync<{ valor: string }>("SELECT valor FROM dev_ajuste WHERE clave = 'paleta';");
    const valor = fila ? (JSON.parse(fila.valor) as Partial<Guardado>) : {};
    return {
      paleta: paletaPorId(valor.paleta)?.id ?? POR_OMISION.paleta,
      mundos: valor.mundos === 'b' ? 'b' : 'a',
    };
  } catch {
    return POR_OMISION;
  }
}

/** Guarda la elección y recarga la app para que TODO (estilos, Skia, barras) se arme con la paleta nueva. */
export function usarPaletaDev(paleta: PaletaId, mundos: OpcionMundos = leerPaletaDev().mundos): void {
  const db = abrir();
  if (!db) return;
  try {
    db.runSync(
      "INSERT INTO dev_ajuste (clave, valor) VALUES ('paleta', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor;",
      JSON.stringify({ paleta, mundos })
    );
  } catch {
    return;
  }
  DevSettings.reload();
}

/** La llama tokens.ts al cargar, solo en __DEV__: pone encima de `color` la paleta elegida en el muestrario. */
export function aplicarPaletaDev(color: Color, tema: { claro: boolean }): void {
  const elegida = leerPaletaDev();
  const paleta = paletaPorId(elegida.paleta);
  if (!paleta?.color) return;
  Object.assign(color, paleta.color);
  color.world = { ...(elegida.mundos === 'b' && paleta.mundosApagados ? paleta.mundosApagados : paleta.color.world) };
  color.dulce = { ...color.dulce };
  tema.claro = paleta.claro;
}
