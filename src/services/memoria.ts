import { AppState } from 'react-native';
import { vaciarDistractores } from '@/data/repos/distractores';
import * as media from './media';

/**
 * Suelta lo que la app guarda en memoria y puede volver a armar sola: las rutas de medios ya resueltas y el pool de
 * distractores. Los JSON de contenido y de marcas no se sueltan: Metro los guarda en su registro de módulos al
 * pedirlos y soltar la referencia de aquí no liberaría nada.
 */
export function vaciarCaches(): void {
  media.invalidate();
  vaciarDistractores();
}

/** Vacía las cachés cuando el sistema avisa que falta memoria. Devuelve la baja. */
export function vaciarConMemoriaBaja(): () => void {
  const sub = AppState.addEventListener('memoryWarning', vaciarCaches);
  return () => sub.remove();
}
