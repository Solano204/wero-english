import AsyncStorage from '@react-native-async-storage/async-storage';
import { VERSION_AVISO } from '@/config/legal';

/**
 * Los consentimientos que da la persona antes de que la app tome un dato o pida un permiso.
 *
 * Viven en AsyncStorage y son del TELÉFONO, no de un usuario: el de Google se da antes de que
 * exista cualquier cuenta. Cada uno guarda la versión del aviso con que se dio; si
 * VERSION_AVISO sube, deja de contar y se vuelve a pedir en el siguiente uso.
 */
export type TipoConsentimiento = 'google' | 'microfono' | 'notificaciones' | 'descargas';

export const TIPOS_CONSENTIMIENTO: TipoConsentimiento[] = ['google', 'microfono', 'notificaciones', 'descargas'];

export interface Consentimiento {
  tipo: TipoConsentimiento;
  /** true: «Aceptar y continuar»; false: «Ahora no». */
  aceptado: boolean;
  version: number;
  /** ISO 8601. */
  fecha: string;
}

const clave = (tipo: TipoConsentimiento) => `wero:consentimiento:${tipo}`;

export async function leer(tipo: TipoConsentimiento): Promise<Consentimiento | null> {
  try {
    const crudo = await AsyncStorage.getItem(clave(tipo));
    if (!crudo) return null;
    const c = JSON.parse(crudo) as Consentimiento;
    return typeof c?.aceptado === 'boolean' && typeof c.version === 'number' ? c : null;
  } catch {
    return null;
  }
}

/** Aceptado con la versión vigente del aviso. */
export async function vigente(tipo: TipoConsentimiento): Promise<boolean> {
  const c = await leer(tipo);
  return c !== null && c.aceptado && c.version === VERSION_AVISO;
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
