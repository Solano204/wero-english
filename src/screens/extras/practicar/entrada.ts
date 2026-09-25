let yaEntro = false;

/**
 * true solo la primera vez que Practicar se monta en la sesión de la app: ahí va
 * la coreografía de entrada. Las visitas siguientes solo hacen un fundido.
 */
export function tomarEntrada(): boolean {
  if (yaEntro) return false;
  yaEntro = true;
  return true;
}
