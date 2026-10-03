import { getDb } from '@/data/cliente';
import type { AtoradaVista } from '@/domain/atoradas';
import type { OrdenErrores } from '@/domain/errores';
import type { BorradorPerfil } from '@/domain/perfilInicial';
import type { Nivel } from '@/types';

/** Ajustes por usuario. Se guardan como texto y se parsean al leer. */
export interface Settings {
  modoLimpio: boolean;
  niveles: Nivel[];
  /** Frases por sesión de estudio: vencidas primero, luego nuevas. */
  metaDiaria: number;
  /** Cuántas frases nuevas entran al día en Study. */
  nuevasPorDia: number;
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
  /** Las respuestas del onboarding mientras contesta: si cierra la app a la mitad, continúa donde iba. */
  onboardingBorrador: BorradorPerfil | null;

  /** Grupos de Practicar que el usuario dejó desplegados (ids de `GRUPOS`). */
  practicarGruposAbiertos: string[];

  /** El lector ya mostró la leyenda de las frases subrayadas: desde entonces arranca plegada. */
  leyendaLecturaVista: boolean;

  /** Cómo se ordena la lista de Errores que te delatan: los más graves primero, o en el orden del contenido. */
  ordenErrores: OrdenErrores;

  /** Las frases que estaban atoradas en la última visita a Se me atoran (id y fallos): así se sabe cuáles ya no lo están. */
  atoradasVistas: AtoradaVista[];
}

export const DEFAULT_SETTINGS: Settings = {
  modoLimpio: false,
  niveles: [1, 2, 3],
  metaDiaria: 20,
  nuevasPorDia: 10,
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
  onboardingBorrador: null,
  practicarGruposAbiertos: [],
  leyendaLecturaVista: false,
  ordenErrores: 'graves',
  atoradasVistas: [],
};

export async function loadSettings(usuarioId: number): Promise<Settings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ clave: string; valor: string }>(
    'SELECT clave, valor FROM ajuste WHERE usuario_id = ?;',
    [usuarioId]
  );

  const out: Settings = { ...DEFAULT_SETTINGS };
  // `nuevasPorSesion` (por sesión, sin efecto) se volvió `nuevasPorDia`: si el
  // usuario había guardado un valor, arranca como el valor de `nuevasPorDia`.
  let anterior: number | null = null;
  for (const r of rows) {
    if (r.clave === 'nuevasPorSesion') {
      const v: unknown = JSON.parse(r.valor);
      if (typeof v === 'number') anterior = v;
      continue;
    }
    try {
      (out as unknown as Record<string, unknown>)[r.clave] = JSON.parse(
        r.valor
      );
    } catch {
      // Un ajuste corrupto no debe tumbar el arranque: se usa el default.
    }
  }
  if (anterior !== null && !rows.some((r) => r.clave === 'nuevasPorDia')) {
    out.nuevasPorDia = anterior;
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

/** Varios ajustes en una sola transacción: o se guardan todos o ninguno. */
export async function saveSettingsBatch(usuarioId: number, parcial: Partial<Settings>): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const [clave, valor] of Object.entries(parcial)) {
      if (valor === undefined) continue;
      await db.runAsync(
        `INSERT INTO ajuste (usuario_id, clave, valor) VALUES (?,?,?)
         ON CONFLICT(usuario_id, clave) DO UPDATE SET valor = excluded.valor;`,
        [usuarioId, clave, JSON.stringify(valor)]
      );
    }
  });
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
