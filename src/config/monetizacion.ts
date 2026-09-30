/**
 * Un solo interruptor para toda la publicidad y los muros por anuncio.
 *
 * En `false` (hoy): `AdBar` y `AdFullScreen` no se pintan, `useUnlockStore.abierto()`
 * devuelve `true` para todo sin escribir en la base, y `pedirRecompensa()` resuelve
 * `'visto'` de inmediato. Nada de esto toca la base de datos: al poner esto en `true`
 * después, cada usuario conserva exactamente lo que ya desbloqueó de verdad.
 *
 * Antes de poner esto en `true`:
 *   - Declarar los anuncios en la Política de contenido de Google Play (sección
 *     Anuncios) antes de publicar esa versión.
 *   - Seguir sin SDK conectado (ver `src/services/anuncios.ts`) no rompe nada: sin un
 *     `RewardedProvider` registrado, los muros vuelven a su comportamiento de "sin
 *     proveedor" (bloquean en producción, pasan en __DEV__), que ya es el
 *     comportamiento documentado ahí.
 *
 * No se prende solo por fecha ni por build: cambia este valor y publica una
 * versión nueva.
 */
export const ANUNCIOS_ACTIVOS = false;
