let pulsoNuevoHecho = false;

/** ¿Falta el pulso de la etiqueta «nuevo»? Solo se hace una vez por sesión. */
export function pulsoNuevoPendiente(): boolean {
  return !pulsoNuevoHecho;
}

export function consumirPulsoNuevo(): void {
  pulsoNuevoHecho = true;
}
