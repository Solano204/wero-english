import AsyncStorage from '@react-native-async-storage/async-storage';
import { VERSION_AVISO } from '@/config/legal';

/**
 * Los consentimientos que da la persona antes de que la app tome un dato o pida un permiso.
 *
 * Viven en AsyncStorage y son del TELÉFONO, no de un usuario: el de Google se da antes de que
 * exista cualquier cuenta. Cada uno guarda la versión del aviso con que se dio; si
 * VERSION_AVISO sube, deja de contar y se vuelve a pedir en el siguiente uso.
 */
import type { TipoConsentimiento } from '@/types/consentimiento';

export type { TipoConsentimiento };

export const TIPOS_CONSENTIMIENTO: TipoConsentimiento[] = ['google', 'microfono', 'notificaciones', 'descargas'];

export interface Consentimiento {
  tipo: TipoConsentimiento;
  /** true: «Aceptar y continuar»; false: «Ahora no». */
  aceptado: boolean;
  version: number;
  /** ISO 8601. */
  fecha: string;
}

/** La llave de AsyncStorage de cada consentimiento (el arranque la lee junto con la sesión, en un multiGet). */
export const clave = (tipo: TipoConsentimiento) => `wero:consentimiento:${tipo}`;

/** Un consentimiento tal como quedó guardado (texto de AsyncStorage), o null si no hay o no se entiende. */
export function desdeCrudo(crudo: string | null): Consentimiento | null {
  try {
    if (!crudo) return null;
    const c = JSON.parse(crudo) as Consentimiento;
    return typeof c?.aceptado === 'boolean' && typeof c.version === 'number' ? c : null;
  } catch {
    return null;
  }
}

export async function leer(tipo: TipoConsentimiento): Promise<Consentimiento | null> {
  try {
    return desdeCrudo(await AsyncStorage.getItem(clave(tipo)));
  } catch {
    return null;
  }
}

/** Aceptado con la versión vigente del aviso (de un consentimiento ya leído). */
export function esVigente(c: Consentimiento | null): boolean {
  return c !== null && c.aceptado && c.version === VERSION_AVISO;
}

/** Aceptado con la versión vigente del aviso. */
export async function vigente(tipo: TipoConsentimiento): Promise<boolean> {
  return esVigente(await leer(tipo));
}

/** «Ahora no» con la versión vigente: lo que se pide solo (sin que la persona toque nada) no vuelve a insistir. */
export async function rechazadoVigente(tipo: TipoConsentimiento): Promise<boolean> {
  const c = await leer(tipo);
  return c !== null && !c.aceptado && c.version === VERSION_AVISO;
}

export async function guardar(tipo: TipoConsentimiento, aceptado: boolean): Promise<void> {
  const c: Consentimiento = { tipo, aceptado, version: VERSION_AVISO, fecha: new Date().toISOString() };
  try {
    await AsyncStorage.setItem(clave(tipo), JSON.stringify(c));
  } catch (err) {
    // Si no se pudo guardar, la hoja se vuelve a mostrar la próxima vez: nunca se asume un sí.
    if (__DEV__) console.warn('[consentimiento] no se pudo guardar', tipo, err);
  }
}

/** Al borrar la cuenta: el teléfono queda como recién instalado en cuanto a consentimientos. */
export async function borrarTodos(): Promise<void> {
  await AsyncStorage.multiRemove(TIPOS_CONSENTIMIENTO.map(clave));
}
