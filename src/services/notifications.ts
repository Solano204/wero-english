import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { color } from '@/theme';
import { getDb } from '@/data/cliente';
import { getLastActive } from '@/data/repos/progreso';
import { countDue } from '@/data/repos/tarjetas';
import { getStuckEntries } from '@/data/repos/frases';
import { filtroEstudio } from '@/domain/cola';
import { rellena, tokensDe, tokensDesconocidos, type Valores } from '@/domain/plantillas';
import { weightedPick } from '@/domain/arreglos';
import { dayKey, daysBetween } from '@/domain/fechas';
import type { ContentFilter, NotificacionesFile, NotifPlantilla } from '@/types';

/**
 * Notificaciones locales.
 *
 * Las cinco prohibiciones del archivo notificaciones.json se aplican aquí
 * en código, no solo como comentario:
 *   - una por día como máximo
 *   - nunca fuera de la ventana horaria
 *   - nunca una entrada de vulgaridad 2
 *   - nunca mencionar que se rompió la racha
 *   - silencio total después de la de 14 días
 *
 * ------------------------------------------------------------------
 * Por qué el módulo se carga tarde y no arriba
 *
 * Desde SDK 53, expo-notifications tumba la app entera al importarse
 * dentro de Expo Go en Android: al arrancar registra un listener de push
 * y lanza un error rojo de "runtime not ready" antes de que se pinte una
 * sola pantalla. Las notificaciones push ya no existen en Expo Go, y el
 * módulo no distingue entre querer push y querer solo locales.
 *
 * Con un import normal arriba, ese error se dispara aunque el usuario
 * nunca abra Ajustes. Cargándolo dentro de una función y solo fuera de
 * Expo Go, la app corre completa en Expo Go y las notificaciones se
 * prenden solas en cuanto se compila un development build.
 * ------------------------------------------------------------------
 */

const CHANNEL = 'wero-diario';

/** Expo Go se detecta por el entorno de ejecución, no por __DEV__. */
export const enExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type NotificationsModule = typeof import('expo-notifications');

let mod: NotificationsModule | null = null;
let intento = false;

function load(): NotificationsModule | null {
  if (intento) return mod;
  intento = true;

  if (enExpoGo || Platform.OS === 'web') {
    mod = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('expo-notifications') as NotificationsModule;
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    mod = null;
  }

  return mod;
}

export interface EstadoNotificaciones {
  ok: boolean;
  razon: string;
}

export function isAvailable(): EstadoNotificaciones {
  if (enExpoGo) {
    return {
      ok: false,
      razon:
        'En Expo Go no hay notificaciones desde el SDK 53. Se prenden solas cuando compiles la app con npx expo run:android.',
    };
  }
  if (!load()) {
    return {
      ok: false,
      razon: 'El módulo de notificaciones no está disponible en este dispositivo.',
    };
  }
  return { ok: true, razon: '' };
}

export async function requestPermission(): Promise<boolean> {
  const N = load();
  if (!N) return false;
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await N.requestPermissionsAsync();
  return asked.granted;
}

export async function setupChannel(): Promise<void> {
  const N = load();
  if (!N) return;
  if (Platform.OS !== 'android') return;
  await N.setNotificationChannelAsync(CHANNEL, {
    name: 'Recordatorio diario',
    importance: N.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 120],
    lightColor: color.notifAndroid,
    sound: null,
  });
}

export async function cancelAll(): Promise<void> {
  const N = load();
  if (!N) return;
  await N.cancelAllScheduledNotificationsAsync();
}

interface ScheduleContext {
  usuarioId: number;
  config: NotificacionesFile;
  filter: ContentFilter;
  hora: string;
  racha: number;
  /** v3: cuántas al día. Si no viene, se comporta como la v1: una. */
  porDia?: number;
  /** v3: ventana horaria del usuario, formato HH:MM. */
  desde?: string;
  hasta?: string;
}

/**
 * Programa las notificaciones diarias.
 *
 * La v1 mandaba una a una hora fija. La v3 manda N repartidas dentro de
 * una ventana, que es lo que hace que la notificación deje de ser un
 * recordatorio y se vuelva una frase que llega mientras haces otra cosa.
 *
 * Se usan disparadores DAILY, uno por hueco, así que quedan N
 * notificaciones pendientes y no N por día acumulándose. Eso importa:
 * iOS solo admite 64 notificaciones locales pendientes y las que
 * sobran se descartan en silencio.
 */
export async function scheduleNext(ctx: ScheduleContext): Promise<boolean> {
  const N = load();
  if (!N) return false;

  await cancelAll();

  const inactivo = await diasInactivo(ctx.usuarioId);

  // Después de 14 días sin abrir, silencio hasta que vuelva.
  if (inactivo > 14) return false;

  const cuantas = Math.max(0, Math.min(ctx.porDia ?? 1, MAX_POR_DIA));
  if (cuantas === 0) return false;

  // Con una sola al día manda la hora exacta que el usuario eligió.
  // Repartir una en medio de la ventana ignoraría su ajuste, que es
  // justamente lo que fue a configurar.
  const huecos =
    cuantas === 1
      ? [horaExacta(ctx.hora, ctx.config.reglas.ventana_horaria)]
      : repartirHoras(
          ctx.desde ?? ctx.hora,
          ctx.hasta ?? ctx.hora,
          cuantas,
          ctx.config.reglas.ventana_horaria
        );

  const yaUsadas = new Set<string>();
  let programadas = 0;

  for (const hueco of huecos) {
    const body = await composeBody(ctx, inactivo, yaUsadas);
    if (!body) break;
    yaUsadas.add(body.plantilla);

    await N.scheduleNotificationAsync({
      content: {
        title: 'Wero',
        body: body.texto,
        data: { abre_en: body.abre_en, plantilla: body.plantilla },
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DAILY,
        hour: hueco.hour,
        minute: hueco.minute,
        channelId: CHANNEL,
      },
    });

    await logNotif(ctx.usuarioId, body.plantilla, body.entryId);
    programadas++;
  }

  return programadas > 0;
}

/** Tope duro. Más allá el sistema las agrupa y el usuario las apaga. */
const MAX_POR_DIA = 12;

/** La hora que el usuario puso, recortada a la ventana permitida. */
function horaExacta(
  hora: string,
  ventana: string
): { hour: number; minute: number } {
  const lim = limitesDe(ventana);
  const m = clampMin(toMinutos(hora, 20 * 60), lim);
  return { hour: Math.floor(m / 60), minute: m % 60 };
}

/**
 * Reparte n horas dentro de la ventana, con los extremos hacia adentro.
 *
 * Si se repartiera de borde a borde, la primera caería a las 9:00 en
 * punto, que es cuando la gente está entrando al trabajo, y la última
 * justo a la hora de dormir. Media hora de margen a cada lado quita ese
 * problema sin acortar la ventana de verdad.
 */
function repartirHoras(
  desde: string,
  hasta: string,
  n: number,
  ventana: string
): { hour: number; minute: number }[] {
  const lim = limitesDe(ventana);
  const ini = clampMin(toMinutos(desde, 9 * 60), lim);
  const fin = clampMin(toMinutos(hasta, 21 * 60), lim);

  // Ventana invertida o de un solo punto: una sola, en el inicio.
  if (fin <= ini + 30 || n === 1) {
    const m = Math.round((ini + fin) / 2);
    return [{ hour: Math.floor(m / 60), minute: m % 60 }];
  }

  const margen = Math.min(30, Math.floor((fin - ini) / (n + 1)));
  const a = ini + margen;
  const b = fin - margen;
  const paso = (b - a) / (n - 1);

  const out: { hour: number; minute: number }[] = [];
  for (let i = 0; i < n; i++) {
    const m = Math.round(a + paso * i);
    out.push({ hour: Math.floor(m / 60), minute: m % 60 });
  }
  return out;
}

function toMinutos(hhmm: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return fallback;
  return Math.min(23 * 60 + 59, Math.max(0, h * 60 + min));
}

function limitesDe(ventana: string): { min: number; max: number } {
  const win = /(\d{2}):(\d{2})-(\d{2}):(\d{2})/.exec(ventana);
  if (!win) return { min: 6 * 60, max: 22 * 60 };
  return {
    min: Number(win[1]) * 60 + Number(win[2]),
    max: Number(win[3]) * 60 + Number(win[4]),
  };
}

function clampMin(v: number, lim: { min: number; max: number }): number {
  return Math.min(lim.max, Math.max(lim.min, v));
}

interface Composed {
  texto: string;
  abre_en: string;
  plantilla: string;
  entryId: number | null;
}

async function composeBody(
  ctx: ScheduleContext,
  inactivo: number,
  excluir: Set<string> = new Set()
): Promise<Composed | null> {
  // Las de vuelta ganan sobre las normales: el usuario que se fue tres
  // días no necesita saber cuántas tarjetas tiene, necesita un gancho.
  const vuelta = ctx.config.vuelta.find((v) => {
    const m = /dias_sin_abrir==(\d+)/.exec(v.condicion);
    return m ? Number(m[1]) === inactivo : false;
  });

  if (vuelta && excluir.size === 0 && plantillaValida(vuelta)) {
    const texto = await fillTokens(vuelta.texto, ctx);
    return texto
      ? { texto, abre_en: vuelta.abre_en, plantilla: vuelta.id, entryId: null }
      : null;
  }

  const elegibles: NotifPlantilla[] = [];
  // Misma definición y mismo filtro que la sesión de Study: lo que dice la
  // notificación es lo que la sesión va a servir.
  const due = await countDue(ctx.usuarioId, filtroEstudio(ctx.filter));
  const stuck = await getStuckEntries(ctx.usuarioId, 3, 1);
  const recientes = await plantillasRecientes(
    ctx.usuarioId,
    ctx.config.reglas.no_repetir_en_dias
  );

  for (const p of ctx.config.plantillas) {
    if (!plantillaValida(p)) continue;
    if (recientes.has(p.id)) continue;
    // Dos notificaciones idénticas el mismo día es peor que una sola.
    if (excluir.has(p.id)) continue;
    if (!condicionCumple(p.condicion, { due, stuck: stuck.length, racha: ctx.racha })) {
      continue;
    }
    elegibles.push(p);
  }

  const pick = weightedPick(elegibles, (p) => p.peso);
  if (!pick) return null;

  const texto = await fillTokens(pick.texto, ctx, { vencidas: due, racha: ctx.racha });
  if (!texto) return null;

  return {
    texto,
    abre_en: pick.abre_en,
    plantilla: pick.id,
    entryId: null,
  };
}

function condicionCumple(
  cond: string,
  data: { due: number; stuck: number; racha: number }
): boolean {
  if (cond === 'siempre') return true;
  if (cond === 'tarjetas_vencidas==0') return data.due === 0;

  const due = /tarjetas_vencidas>=(\d+)/.exec(cond);
  if (due) return data.due >= Number(due[1]);

  const stuck = /existe_entrada_con_fallos>=(\d+)/.exec(cond);
  if (stuck) return data.stuck > 0;

  const racha = /racha>=(\d+)/.exec(cond);
  if (racha) return data.racha >= Number(racha[1]);

  // Los módulos v1.1 y v1.2 aún no existen: sus plantillas no aplican.
  if (cond.includes('modulo_') || cond.includes('lectura_')) return false;

  return false;
}

/**
 * Una plantilla con un token que no existe no se manda nunca. En desarrollo
 * truena para que se arregle el JSON; en producción se descarta y la
 * notificación cae en otra plantilla, así nadie ve "{racha}" literal.
 */
function plantillaValida(p: { id: string; texto: string }): boolean {
  const malos = tokensDesconocidos(p.texto);
  if (malos.length === 0) return true;
  const msg = `[notificaciones] la plantilla ${p.id} usa tokens que no existen: ${malos.join(', ')}`;
  if (__DEV__) throw new Error(msg);
  console.warn(msg);
  return false;
}

async function contarDominadas(usuarioId: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM tarjeta WHERE usuario_id = ? AND dominada = 1;',
    [usuarioId]
  );
  return row?.n ?? 0;
}

/**
 * Rellena los tokens con nombre que la plantilla pide, uno por dato:
 * {phrase}, {vencidas}, {racha} y {dominadas}. `conocidos` trae los que el
 * llamador ya calculó. Devuelve null si falta un dato, porque una
 * notificación con un hueco es peor que ninguna.
 */
async function fillTokens(
  template: string,
  ctx: ScheduleContext,
  conocidos: Valores = {}
): Promise<string | null> {
  const pedidos = new Set(tokensDe(template));
  const valores: Valores = { ...conocidos };
  if (pedidos.has('phrase') && valores.phrase === undefined) valores.phrase = await pickSafePhrase(ctx);
  if (pedidos.has('vencidas') && valores.vencidas === undefined) {
    valores.vencidas = await countDue(ctx.usuarioId, filtroEstudio(ctx.filter));
  }
  if (pedidos.has('racha') && valores.racha === undefined) valores.racha = ctx.racha;
  if (pedidos.has('dominadas') && valores.dominadas === undefined) valores.dominadas = await contarDominadas(ctx.usuarioId);
  // faltan, titulo y lo_que_dices aún no tienen fuente: sin valor, la plantilla no aplica.
  return rellena(template, valores);
}

/** Una frase ya vista, de vulgaridad baja. Nunca una de vulgaridad 2. */
async function pickSafePhrase(ctx: ScheduleContext): Promise<string | null> {
  const db = await getDb();
  const max = ctx.config.reglas.max_vulgaridad;
  const row = await db.getFirstAsync<{ phrase: string }>(
    `SELECT e.phrase FROM entrada e
       JOIN tarjeta t ON t.entry_id = e.id AND t.usuario_id = ?
      WHERE e.vulgaridad <= ? AND e.is_canonical = 1 AND e.revisar = 0
        AND t.repeticiones >= 1
      ORDER BY RANDOM() LIMIT 1;`,
    [ctx.usuarioId, max]
  );
  return row?.phrase ?? null;
}

async function plantillasRecientes(
  usuarioId: number,
  dias: number
): Promise<Set<string>> {
  const db = await getDb();
  const desde = Date.now() - dias * 86_400_000;
  const rows = await db.getAllAsync<{ plantilla: string }>(
    'SELECT DISTINCT plantilla FROM notif_log WHERE usuario_id = ? AND enviado_en >= ?;',
    [usuarioId, desde]
  );
  return new Set(rows.map((r) => r.plantilla));
}

async function logNotif(
  usuarioId: number,
  plantilla: string,
  entryId: number | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO notif_log (usuario_id, plantilla, entry_id, enviado_en) VALUES (?,?,?,?);',
    [usuarioId, plantilla, entryId, Date.now()]
  );
}

async function diasInactivo(usuarioId: number): Promise<number> {
  const last = await getLastActive(usuarioId);
  if (!last) return 0;
  return Math.max(0, daysBetween(last, dayKey()));
}

/** Recorta la hora a la ventana permitida. */
function parseHour(
  hora: string,
  ventana: string
): { hour: number; minute: number } {
  const [h = '20', m = '00'] = hora.split(':');
  let hour = Number(h);
  const minute = Number(m) || 0;

  const win = /(\d{2}):\d{2}-(\d{2}):\d{2}/.exec(ventana);
  const min = win ? Number(win[1]) : 6;
  const max = win ? Number(win[2]) : 22;

  if (!Number.isFinite(hour)) hour = 20;
  hour = Math.min(max, Math.max(min, hour));

  return { hour, minute };
}

/** El listener que abre la pantalla correcta al tocar la notificación. */
export function onNotificationTap(
  handler: (abreEn: string) => void
): () => void {
  const N = load();
  // Sin módulo se devuelve una baja vacía en vez de null: quien llama
  // hace cleanup() en su useEffect sin preguntar, y así no truena.
  if (!N) return () => undefined;

  const sub = N.addNotificationResponseReceivedListener((res) => {
    const abre = res.notification.request.content.data?.['abre_en'];
    if (typeof abre === 'string') handler(abre);
  });
  return () => sub.remove();
}
