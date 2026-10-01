import type { SQLiteBindValue } from 'expo-sqlite';
import { getDb } from '@/data/cliente';

/** Una fila tal como la devuelve SQLite. */
export type Fila = Record<string, unknown>;

/**
 * Una consulta con su forma de leer el resultado. Se puede correr sola (`correr`) o junto con otras en una
 * sola ida a SQLite (`correrLote`): así una pantalla que necesita diez datos no hace diez viajes.
 */
export interface Parte<T> {
  /** Un SELECT completo (sin el `;` final hace falta; se quita si lo trae). */
  sql: string;
  params: SQLiteBindValue[];
  /** Las columnas del SELECT, en su nombre de salida: lo que `correrLote` empaqueta en JSON. */
  columnas: readonly string[];
  leer: (filas: Fila[]) => T;
}

const sinPuntoYComa = (sql: string) => sql.trim().replace(/;\s*$/, '');

export async function correr<T>(p: Parte<T>): Promise<T> {
  const db = await getDb();
  return p.leer(await db.getAllAsync<Fila>(sinPuntoYComa(p.sql) + ';', p.params));
}

type Resultados<P extends Record<string, Parte<unknown>>> = { [K in keyof P]: P[K] extends Parte<infer T> ? T : never };

/**
 * Corre varias partes en UNA consulta: cada una va como subconsulta que devuelve sus filas en JSON
 * (`json_group_array(json_object(...))`), y cada parte lee sus filas igual que si hubiera corrido sola.
 * Los `?` se numeran en el orden del texto, así que los parámetros van en el mismo orden que las partes.
 */
export async function correrLote<P extends Record<string, Parte<unknown>>>(partes: P): Promise<Resultados<P>> {
  const claves = Object.keys(partes) as (keyof P & string)[];
  const selects = claves.map((k) => {
    const p = partes[k] as Parte<unknown>;
    const obj = p.columnas.map((c) => `'${c}', "${c}"`).join(', ');
    return `(SELECT json_group_array(json_object(${obj})) FROM (${sinPuntoYComa(p.sql)})) AS "${k}"`;
  });
  const params = claves.flatMap((k) => (partes[k] as Parte<unknown>).params);
  const db = await getDb();
  const fila = await db.getFirstAsync<Record<string, string>>(`SELECT ${selects.join(',\n       ')};`, params);
  const out = {} as Resultados<P>;
  for (const k of claves) {
    const p = partes[k] as Parte<unknown>;
    (out as Record<string, unknown>)[k] = p.leer(JSON.parse(fila?.[k] ?? '[]') as Fila[]);
  }
  return out;
}
