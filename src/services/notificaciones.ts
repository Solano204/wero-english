import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { color } from '@/theme';
import { contarDominadas, fraseSegura, plantillasRecientes, registrarNotificacion } from '@/data/repos/notificaciones';
import { getLastActive } from '@/data/repos/progreso';
import { countDue } from '@/data/repos/tarjetas';
import { getStuckEntries } from '@/data/repos/frases';
import { filtroEstudio } from '@/domain/cola';
import { rellena, tokensDe, tokensDesconocidos, type Valores } from '@/domain/plantillas';
import { weightedPick } from '@/domain/arreglos';
import { dayKey, daysBetween } from '@/domain/fechas';
import { MAX_POR_DIA, condicionCumple, horaExacta, repartirHoras } from '@/domain/horarioNotificaciones';
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

    await registrarNotificacion(ctx.usuarioId, body.plantilla, body.entryId);
    programadas++;
  }

  return programadas > 0;
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
  if (pedidos.has('phrase') && valores.phrase === undefined) valores.phrase = await fraseSegura(ctx.usuarioId, ctx.config.reglas.max_vulgaridad);
  if (pedidos.has('vencidas') && valores.vencidas === undefined) {
    valores.vencidas = await countDue(ctx.usuarioId, filtroEstudio(ctx.filter));
  }
  if (pedidos.has('racha') && valores.racha === undefined) valores.racha = ctx.racha;
  if (pedidos.has('dominadas') && valores.dominadas === undefined) valores.dominadas = await contarDominadas(ctx.usuarioId);
  // faltan, titulo y lo_que_dices aún no tienen fuente: sin valor, la plantilla no aplica.
  return rellena(template, valores);
}

async function diasInactivo(usuarioId: number): Promise<number> {
  const last = await getLastActive(usuarioId);
  if (!last) return 0;
  return Math.max(0, daysBetween(last, dayKey()));
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
