# Serie «Rendimiento y estructura»: resumen

Seis prompts en `perf/serie-rendimiento` (126 commits desde el tag `antes-de-rendimiento`), sin cambiar lo que ve o hace
el usuario salvo lo pedido: la pantalla de error y «Copiar reporte de errores» en Ajustes. Números y columnas completas
en `docs/RENDIMIENTO.md`.

## Qué se ganó

| | Antes | Después |
|---|---|---|
| Bundle de JS (Hermes) | 7.34 MiB | **6.95 MiB (−410 KB, −5.3 %)**, con el React Compiler encendido (sin él quedaba en 6.62 MiB) |
| Export sin medios | 11.39 MB | **9.92 MB (−1.46 MB)** |
| JSON evaluado en cada arranque | `catalogo.json` (2.4 MB) + phrasal | **ninguno**: base prearmada y conteos generados |
| Consultas SQL al abrir Practicar | 12 | **1** |
| Fuentes | 1.05 MB cargadas desde JS con la app en blanco | incrustadas en el APK |
| Memorización a mano | 404 `useMemo`/`useCallback` | 129, con 418 funciones compiladas por el React Compiler |
| Música y efectos | 2.56 MB | **1.46 MB (−43 %)**, efectos en WAV para que suenen sin retraso |
| Players de audio vivos | hasta 30 | **hasta 18** |
| Un error de render | tumbaba toda la app | tumba solo esa pantalla y queda anotado en el teléfono |
| Candados | ninguno | `npm run verificar` (36 pasos), `check:perf` (9 reglas), `presupuesto`, Maestro |

Además se arreglaron tres fallas reales:
- La siembra del catálogo borraba el avance en cada actualización (`DELETE` en cascada).
- El micrófono podía abrirse después de salir de la pantalla.
- Las calificaciones de los juegos se perdían en silencio si la base fallaba.

## Qué quedó pendiente

Todo lo que se mide en el teléfono. El contenedor no tiene dispositivo, así que estas columnas siguen en «pendiente» en
`RENDIMIENTO.md`: TTI y marcas de arranque, FPS con Flashlight, memoria a los 15 min y la prueba de 30 min, tamaños de
APK/AAB, y las pruebas de Maestro. Los scripts ya están: `scripts/medir-arranque.sh`, `scripts/medir-memoria.sh`,
`npm run presupuesto -- --aab …` y `maestro test e2e`.

Fuera de aquí, además:
1. Voz a 32 kbps e imágenes: `scripts/optimiza-audio.mjs` y `scripts/optimiza-imagenes.mjs` donde están los medios, tras
   oír `scripts/muestras-audio.mjs`.
2. Las propuestas visuales que esperan OK (`PLAN-LISTAS-MEDIOS.md` §0.2): 3 lienzos de Skia en Practicar (la regla
   dice 2), ArcoSenal a 30 fps, sombras de TileBuilder y Pares.
3. Anotar `aabBytes` en `scripts/presupuestos.json` con el primer AAB medido, y los presupuestos del teléfono en
   `RENDIMIENTO.md`.

## Los 3 riesgos principales que quedan

1. **Nada de lo del teléfono está medido todavía.** Las mejoras de arranque, FPS y memoria están razonadas desde el
   código y medidas en tamaño, pero no confirmadas en el Xiaomi. Hasta correr los scripts, no hay forma de saber si
   la meta de < 2 s y 55 FPS se cumple.
2. **Practicar sigue siendo la pantalla más cargada:** tres lienzos de Skia animando a la vez (aurora, onda y portada
   héroe) sobre un scroll. Es donde más probablemente caigan los FPS en gama media, y bajarlo cambia cómo se ve (espera
   tu OK).
3. **El React Compiler es ahora parte del rendimiento.** Se quitaron 280 memos a mano porque el compilador los hace;
   si algún archivo deja de compilarse (una regla rota), vuelve a repintar de más sin que nada falle. El lint avisa
   (`react-compiler` en advertencia), pero no bloquea el build: vale la pena subirlo a error cuando el plugin de ESLint
   alcance al compilador 1.0.
