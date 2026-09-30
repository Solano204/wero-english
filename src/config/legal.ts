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

// Las páginas públicas (GitHub Pages, ver docs/web/LEEME.md). Con URLs reales, cada texto legal de
// la app ofrece «Ver en la web».
export const URL_PRIVACIDAD = 'https://solano204.github.io/wero-legal/privacidad/';
export const URL_TERMINOS = 'https://solano204.github.io/wero-legal/terminos/';
export const URL_ELIMINAR_CUENTA = 'https://solano204.github.io/wero-legal/borrar-cuenta/';

/** false para una URL de ejemplo (`.invalid`): la app no ofrece abrir algo que no existe. */
export function esUrlReal(url: string): boolean {
  return /^https:\/\//.test(url) && !url.includes('.invalid/');
}

/** «30 de septiembre de 2026», para arriba de cada texto legal. */
export function fechaLegible(iso: string): string {
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${meses[(m ?? 1) - 1]} de ${a}`;
}
