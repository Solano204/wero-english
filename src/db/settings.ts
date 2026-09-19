import { getDb } from './client';
import type { Nivel } from '@/types';

/** Ajustes por usuario. Se guardan como texto y se parsean al leer. */
export interface Settings {
  modoLimpio: boolean;
  niveles: Nivel[];
  metaDiaria: number;
  nuevasPorSesion: number;
  autoAudio: boolean;
  haptics: boolean;
  /** Ping de acierto / tono suave de fallo al responder una tarjeta. */
  sonidosFeedback: boolean;
  /** Música de fondo en toda la app. */
  musica: boolean;
  /** 0 a 100. Se guarda aparte del interruptor para no perder el nivel al apagarla. */
  volumenMusica: number;
  /** Si está apagado, los juegos usan la misma pista de app.mp3. */
  musicaJuegosDistinta: boolean;
  notificaciones: boolean;
  horaNotificacion: string;
  soloWifi: boolean;

  /* ---------- v3 ---------- */

  /** Cuántas frases al día manda la app. 0 apaga sin desactivar el permiso. */
  notifPorDia: number;
  /** Ventana horaria. Fuera de ella no se programa nada. */
  notifDesde: string;
  notifHasta: string;
  /** El contador de aciertos seguidos dentro de la sesión. */
  mostrarSeguidas: boolean;
  /** El usuario ya aceptó el micrófono al menos una vez. */
  micHabilitado: boolean;
  /** Onboarding contestado. Si es false se muestra al entrar. */
  onboardingHecho: boolean;
  /** Respuesta a "dónde se te traba el inglés". Solo se guarda local. */
  dondeSeTraba: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  modoLimpio: false,
  niveles: [1, 2, 3],
  metaDiaria: 20,
  nuevasPorSesion: 5,
  autoAudio: true,
  haptics: true,
  sonidosFeedback: true,
  musica: true,
  volumenMusica: 35,
  musicaJuegosDistinta: true,
  notificaciones: true,
  horaNotificacion: '20:00',
  soloWifi: true,

  // Cuatro al día, no diez: suficiente para hacer hábito y pocas para
  // que la app no se sienta encima. El usuario lo mueve en el onboarding.
  notifPorDia: 4,
  notifDesde: '09:00',
  notifHasta: '21:00',
  mostrarSeguidas: true,
  micHabilitado: false,
  onboardingHecho: false,
  dondeSeTraba: null,
};

/** Tope de notificaciones diarias. Más allá el sistema las agrupa igual. */
export const NOTIF_MAX_POR_DIA = 12;

export async function loadSettings(usuarioId: number): Promise<Settings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ clave: string; valor: string }>(
    'SELECT clave, valor FROM ajuste WHERE usuario_id = ?;',
    [usuarioId]
  );

  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    try {
      (out as unknown as Record<string, unknown>)[r.clave] = JSON.parse(
        r.valor
      );
    } catch {
      // Un ajuste corrupto no debe tumbar el arranque: se usa el default.
    }
  }
  return out;
}

export async function saveSetting<K extends keyof Settings>(
  usuarioId: number,
  clave: K,
  valor: Settings[K]
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO ajuste (usuario_id, clave, valor) VALUES (?,?,?)
     ON CONFLICT(usuario_id, clave) DO UPDATE SET valor = excluded.valor;`,
    [usuarioId, clave, JSON.stringify(valor)]
  );
}

/**
 * Metadatos globales de la app (tabla `app_meta`), sin usuario_id.
 * Para marcas que hay que leer antes de que exista una sesión, como
 * "catalog_version" durante el sembrado en BootScreen.
 */
export async function getAppMeta(clave: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ valor: string }>(
    'SELECT valor FROM app_meta WHERE clave = ?;',
    [clave]
  );
  return row?.valor ?? null;
}

export async function setAppMeta(clave: string, valor: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO app_meta (clave, valor) VALUES (?,?)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor;`,
    [clave, valor]
  );
}
