import { InteractionManager } from 'react-native';

/**
 * Lo que no hace falta para mostrar Practicar y tocarlo: se anota aquí y corre después del primer cuadro
 * interactivo (Practicar con sus datos pintados), cuando el hilo de JS ya está libre.
 *
 * `listoParaDiferidos()` lo llama Practicar al quedar interactivo, o el navegador si el arranque termina en otra
 * pantalla (la entrada o las preguntas de bienvenida). Por si nada lo llama, corre solo a los TOPE_MS.
 */

const TOPE_MS = 5000;
const pendientes: (() => unknown)[] = [];
let listo = false;
let tope: ReturnType<typeof setTimeout> | null = null;

function correr(tarea: () => unknown): void {
  InteractionManager.runAfterInteractions(() => {
    try {
      const r = tarea();
      if (r && typeof (r as Promise<unknown>).catch === 'function') (r as Promise<unknown>).catch(() => undefined);
    } catch {
      /* una tarea diferida que falla no tumba a las demás */
    }
  });
}

/** Corre `tarea` después del primer cuadro interactivo (o ya, en la siguiente pausa, si ese momento pasó). */
export function trasArranque(tarea: () => unknown): void {
  if (listo) {
    correr(tarea);
    return;
  }
  pendientes.push(tarea);
  if (!tope) tope = setTimeout(listoParaDiferidos, TOPE_MS);
}

/** El arranque terminó: lo anotado empieza a correr. Solo cuenta la primera vez. */
export function listoParaDiferidos(): void {
  if (listo) return;
  listo = true;
  if (tope) clearTimeout(tope);
  tope = null;
  for (const t of pendientes.splice(0)) correr(t);
}
