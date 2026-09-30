/**
 * Contraste WCAG 2.x entre dos colores (#rrggbb o rgba(...) opaco). Lo usa el muestrario de paletas para mostrar, en
 * vivo, si cada par texto/fondo pasa AA. Un rgba con alfa se toma como su color sin alfa (el muestrario solo mide
 * colores sólidos).
 */
function canales(c: string): [number, number, number] {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}

function luminancia(c: string): number {
  const [r, g, b] = canales(c).map((v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
