/**
 * Lo legal que la app necesita saber: versión y fecha del aviso de privacidad y las URLs
 * públicas de los textos. Los textos mismos van empaquetados (src/legal/textos.ts, generado
 * de docs/*.md con `npm run legal:generar`) y se leen sin internet.
 *
 * Subir VERSION_AVISO cuando el aviso de privacidad cambie en algo de fondo: cada
 * consentimiento guardado con una versión anterior se vuelve a pedir en su siguiente uso.
 */
export const VERSION_AVISO = 1;
export const FECHA_AVISO = '2026-09-30';

// TODO: poner las URLs públicas cuando estén publicadas (ver docs/web/LEEME.md). Mientras
// sigan siendo de ejemplo, el botón «Ver en la web» no se muestra.
export const URL_PRIVACIDAD = 'https://ejemplo.invalid/wero/privacidad.html';
export const URL_TERMINOS = 'https://ejemplo.invalid/wero/terminos.html';
export const URL_ELIMINAR_CUENTA = 'https://ejemplo.invalid/wero/eliminar-cuenta.html';

/** false para las URLs de ejemplo de arriba: la app no ofrece abrir algo que no existe. */
export function esUrlReal(url: string): boolean {
  return /^https:\/\//.test(url) && !url.includes('.invalid/');
}

/** «30 de septiembre de 2026», para arriba de cada texto legal. */
export function fechaLegible(iso: string): string {
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${meses[(m ?? 1) - 1]} de ${a}`;
}
