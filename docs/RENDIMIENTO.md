# Rendimiento de Wero

Serie «Rendimiento y estructura». Reglas: medir antes, cambiar y medir después; cero cambios visibles; commits
pequeños; se mide en **release**, nunca en debug.

Punto de partida: tag `antes-de-rendimiento` (commit `be93b64`). Rama de trabajo: `perf/serie-rendimiento`.

## Línea base

«Medido aquí» se sacó con `expo export --platform android` en modo producción (Hermes, `.hbc`). El checkout del
contenedor no trae `assets/aud` ni `assets/img` (el `bundled.ts` local está vacío), así que el bundle y los assets de
aquí **no incluyen** los ~7.9k medios del build real. Lo que depende del teléfono queda «pendiente» con el comando
exacto para sacarlo (ver abajo).

| Métrica | LÍNEA BASE | DESPUÉS DE LIMPIEZA | DESPUÉS DE ESTRUCTURA | DESPUÉS DE ARRANQUE | DESPUÉS DE RE-RENDERS | DESPUÉS DE LISTAS, MEDIOS Y ANIMACIONES | Cómo |
|---|---|---|---|---|---|---|---|
| Bundle JS Hermes (`.hbc`) | 7,698,751 B (7.34 MiB) | 7,678,696 B (7.32 MiB), −20 KB | 7,727,907 B (7.37 MiB), +49 KB (+0.6 %) | **6,943,452 B (6.62 MiB), −755 KB contra la base (−9.8 %)** | 7,258,665 B (6.92 MiB): +315 KB por las cachés del React Compiler; −440 KB contra la base | 7,259,533 B (6.92 MiB): +0.9 KB (Hoja, PrecargaImagen, rellenoBarra); −439 KB contra la base | `expo export`, medido aquí |
| Salida JS antes de Hermes | 12.71 MB | — | 12.72 MB | 10.31 MB (−19 %) | — | — | Expo Atlas |
| Módulos en el bundle | 2,425 | 2,425 | 2,484 (+59: hooks y componentes partidos) | 2,472 | — | — | Expo Atlas |
| Assets empaquetados (sin aud/img) | 104 archivos · 3.68 MB | igual (el borrado de assets espera OK) | 104 archivos (los 12 sfx duplicados ya venían deduplicados por hash) | 100 archivos · 3.76 MB (salen las 5 fuentes, que van en el APK; entra `catalogo.db`, 1.1 MB) | igual | 100 archivos · **2.63 MB (−1.13 MB)**: música 689 → 517 KB, 80 efectos 1,872 → 941 KB | `expo export` |
| Export completo (sin aud/img) | 11,386,071 B | 11,366,016 B | 11,415,227 B | 10,710,095 B | 11,025,308 B | **9,895,519 B (−1.13 MB)** | `expo export` |
| APK release (arm64) | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente | `cd android && ./gradlew assembleRelease` → `app/build/outputs/apk/release/` |
| AAB release | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente (con la voz a 32 kbps se espera ~−33 % de los ~6.3k MP3) | `./gradlew bundleRelease` → `app/build/outputs/bundle/release/` |
| TTI frío (`am start -W`, TotalTime) | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente | ver «Arranque» |
| Arranque JS → Practicar interactivo | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente | cronómetro `[medir]` (ver «Arranque») |
| FPS medio / CPU / RAM (Flashlight) | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente (recorrido de listas y animaciones: ver «Flashlight») | ver «Flashlight» |

**Después de estructura.** El prompt 2 no busca bajar peso: parte pantallas en hooks y componentes y mueve archivos a
capas. Eso suma 59 módulos, y cada módulo de Metro lleva su envoltura (`__d(function…)`, su tabla de dependencias),
de ahí los +49 KB de Hermes (+0.6 %) con la misma salida de código (12.72 MB). El orden de los hooks y efectos de
cada pantalla no cambió, así que no se espera diferencia de arranque ni de FPS; se confirma en el teléfono.

### Después de arranque (prompt 3): cada arreglo

El teléfono no está en este contenedor: TotalTime, las marcas por tramo (`app`, `base`, `catalogo`, `splash`,
`primerRender`, `interactivo`) y el bloqueo más largo del hilo de JS se sacan en el Xiaomi con
`scripts/medir-arranque.sh 5` sobre un release con `EXPO_PUBLIC_MEDIR=1`, antes (tag `antes-de-rendimiento`) y
después. Lo de aquí es el bundle y el costo aislado de cada pieza en Hermes CLI (x86; en gama media, ×5–8).

| Arreglo | Commit | Medido aquí | Lo que se quita del arranque |
|---|---|---|---|
| A · mapa de medios por paquete | `0193033` | con los 7,829 medios (de prueba): Hermes 9,882,709 → 9,798,066 B (−85 KB) | el índice de 7.8k llaves ya no se arma completo: solo el del paquete que se pide (7–600 llaves) |
| B · JSON perezosos | `a25b3ba` | evaluar `phrasal_verbs.json`: ~1 ms | Practicar ya no evalúa 145 KB de JSON para un conteo |
| C · base prearmada y Practicar en una consulta | `501ad02` | Hermes −765 KB; evaluar `catalogo.json` + su huella: 6–9 ms | cada arranque: sin JSON de 2.4 MB ni recorrido de 1,524 entradas; Practicar: 12 consultas → 1; primera instalación: 1 copia en vez de 77 INSERT |
| D · fuentes incrustadas | `cfb47c2` | Hermes −23 KB; 5 assets menos en JS | ya no se cargan 1.05 MB de fuentes desde JS ni se espera con la app en blanco |
| E · servicios diferidos | `cacc5a1` | — | modo de audio, canal de notificaciones y desbloqueos salen de antes de interactivo; 1 lectura de AsyncStorage menos sin sesión |
| F · pestañas perezosas | `63e7ac2` | Hermes +3 KB | el código de Vocabulario y Progreso (con sus gráficas de Skia) no se evalúa al abrir |
| G · splash y primer cuadro | — | sin cambio | ya se cumplía: el splash se oculta al terminar Boot con Practicar montado, y Practicar ya pinta su esqueleto si los datos tardan |
| H · bundle | — | sin cambio | los íconos ya entraban uno por uno (57), sin lodash; lo pesado que queda no se puede partir (ver abajo) |

**Arreglo de datos en C.** La siembra vieja hacía `DELETE FROM entrada` y `tarjeta` apunta a `entrada` con
`ON DELETE CASCADE`: cada actualización que cambiaba el catálogo borraba el avance de todas las frases (probado con
las migraciones de la app: 300 tarjetas → 0). La nueva es un upsert y las conserva.

### Después de re-renders (prompt 4): por interacción

Tiempos de commit: se miden en el Xiaomi con React Native DevTools → Profiler y «Highlight updates» (build de
desarrollo o de perfilado) en el tag `antes-de-rendimiento` y en la rama; aquí no hay teléfono. Lo que sí se puede
decir desde el código (y el React Compiler, que ahora compila 418 funciones y deja fuera 5 a propósito):

| Interacción | ANTES: commits · qué se repinta | DESPUÉS: commits · qué se repinta | Commit más largo (Xiaomi) |
|---|---|---|---|
| Estudio: opción y siguiente tarjeta | ~6 · 5 de pantalla completa | ~6 · la raíz y solo los hijos cuyo dato cambió (el compilador conserva los elementos iguales) | pendiente |
| Cázala: marcar | 1 (+1 por onLayout) · los 6 renglones y la pantalla | 1 · el renglón marcado (memo con props estables) | pendiente |
| Colmena: colocar letra | 1 · pantalla completa; todas las ranuras en la 1.ª letra | 1 · el hexágono tocado y lo que cambió; letra equivocada 4 → 3 commits; cambio de ronda 2 → 1 | pendiente |
| Dulces: intercambiar | 2 + ~3 por paso · todas las MetaFrase por paso | igual en commits · solo las metas que sumaron; el tablero sigue fuera del compilador con su memo a mano | pendiente |
| Practicar: abrir/cerrar grupo | 1 · toda la pantalla con 4 lienzos de Skia | 1 · solo ese grupo (GrupoPracticar) | pendiente |
| Phrasal: escribir | 1 por tecla, síncrono · todos los renglones montados | teclear no espera a la lista (useDeferredValue) · sin búsqueda ningún renglón se repinta; con búsqueda, solo los que cambian de marcas | pendiente |
| Ajuste y volver a Practicar | 1 · Ajustes con cualquier llave | 1 · Ajustes solo con lo que muestra; Practicar solo si cambia algo que pinta (y ahora sí recarga con Modo Limpio o niveles) | pendiente |
| Cambiar de pestaña | 1 · barra con opciones nuevas por pestaña | 1 · opciones fijas; la barra de la librería sigue pintando sus íconos | pendiente |

Memorización a mano: useMemo 141 → 65 y useCallback 263 → 64 (280 quitados); memo() 25 → 26 (se sumó el renglón
de Cázala). La lista de lo que se quedó y por qué está en `docs/PLAN-RERENDERS.md`.

### Después de listas, medios y animaciones (prompt 5)

Los FPS se miden en el Xiaomi con Flashlight (recorrido abajo, en «Flashlight»); aquí no hay teléfono. Lo que cambió y
lo que se midió aquí:

| Qué | ANTES | DESPUÉS | Commit |
|---|---|---|---|
| Atoradas y Mi mazo: filas por tanda al hacer scroll | 10 (cada una con karaoke y grupo de audio) | 4 | `87e9ed6` |
| Imágenes locales: caché de `expo-image` | `disk` (en Android se salta la memoria: decodifica en cada montaje y copia a disco) | `memory` + `recyclingKey` por ruta | `807f9bc` |
| «¿Existe esta imagen/audio?» | `File.exists` síncrono en cada render (cada botón de audio y cada imagen) | una vez por ruta, con caché que se limpia al descargar o borrar un pack | `807f9bc` |
| Estudio: imagen de la siguiente tarjeta | se decodifica al aparecer | se decodifica antes, invisible y al mismo tamaño (`Image.prefetch` en Android solo baja http) | `807f9bc` |
| Música (2 MP3) | 128 kbps · 689 KB | 96 kbps · 517 KB (−25 %) | `f73699a` |
| Efectos (80 WAV) | 44.1 kHz · 1,872 KB | 22,050 Hz mono · 941 KB (−50 %) | `f73699a` |
| Voz (~6.3k MP3) | Polly, mono 22,050 Hz ~48 kbps | `node scripts/optimiza-audio.mjs --aplicar` (32 kbps) donde están los medios | `f73699a` |
| Imágenes (~1.8k WebP) | 640×640 q80 (ffmpeg) | `node scripts/optimiza-imagenes.mjs` reporta; reemplaza solo si baja ≥ 5 % | `1326244` |
| Barras de tiempo (4) | `width` cada cuadro (layout) | `translateX` (sin layout) | `acb8f75` |
| Bucles fuera de la vista | reflejo del botón de HOY y onda del nivel actual seguían corriendo | se pausan | `acb8f75` |
| Brillo de esqueletos | `withRepeat` sin cancelar ni pausa sin foco | se detiene sin foco o en segundo plano y se cancela al desmontar | `acb8f75` |
| Paralaje del giroscopio | una animación nueva cada 50 ms aunque el teléfono esté quieto | solo si el destino cambia ≥ 0.25 dp | `acb8f75` |
| Sombras | `elevation` 7 en cada fila de Errores, Atoradas y Mi mazo, y en la ficha que cae | sin sombra ahí (negra sobre #0B0C10–#040507: no se veía) | `5d3a48b` |
| Hojas inferiores | 3 copias de la misma animación; consentimiento en `Modal` sin `navigationBarTranslucent` | una `Hoja` en `shared/ui`; el `Modal` que queda, translúcido arriba y abajo | `67de61f` |
| Tocables | 0 `Touchable*` | 0, y ESLint los rechaza | `6b7c0a3` |

Lo que quedó igual a propósito y las propuestas que esperan tu OK (cambiarían cómo se ve): `docs/PLAN-LISTAS-MEDIOS.md`.

### Top 15 módulos después de arranque (Expo Atlas)

| # | Tamaño | Módulo |
|---|---|---|
| 1 | 336.6 KB | `react-reconciler.production.js` (lo trae Skia) |
| 2 | 324.6 KB | `ReactFabric-prod.js` |
| 3 | 160.8 KB | `assets/data/errores.json` (perezoso) |
| 4 | 145.4 KB | `assets/data/phrasal_verbs.json` (perezoso) |
| 5 | 131.8 KB | `assets/data/fonemas.json` (perezoso) |
| 6 | 112.1 KB | `assets/data/niveles.json` (perezoso) |
| 7 | 110.6 KB | `assets/data/gramatica.json` (perezoso) |
| 8 | 77.1 KB | `assets/data/cazala_entradas.json` (perezoso) |
| 9 | 58.8 KB | `assets/data/lecturas.json` (perezoso) |
| 10 | 51.5 KB | reanimated `layoutReanimation/…/Zoom.ts` |
| 11 | 48.0 KB | `VirtualizedList.js` |
| 12 | 41.5 KB | react-native-svg `extract/transform.js` |
| 13 | 40.2 KB | reanimated `…/Flip.ts` |
| 14 | 39.3 KB | `whatwg-url-minimum` |
| 15 | 39.1 KB | reanimated `…/Bounce.ts` |

Lo que no se pudo quitar: los presets de animación de Reanimated (Zoom, Flip, Bounce, Rotate…) entran completos
porque el índice de la librería los exporta todos y Metro no hace tree-shaking; `react-reconciler` lo trae Skia;
el registro de módulos (`__d`) de los ~7.8k medios sigue aunque ya no se evalúen (Metro no parte el bundle en
release).

### Top 15 módulos, línea base (Expo Atlas, tamaño de salida)

| # | Tamaño | Módulo | De |
|---|---|---|---|
| 1 | 2449.4 KB | `assets/data/catalogo.json` | app |
| 2 | 336.6 KB | `react-reconciler.production.js` (lo trae Skia) | lib |
| 3 | 324.6 KB | `ReactFabric-prod.js` | lib |
| 4 | 163.2 KB | `assets/data/errores.json` | app |
| 5 | 145.7 KB | `assets/data/phrasal_verbs.json` | app |
| 6 | 133.5 KB | `assets/data/fonemas.json` | app |
| 7 | 112.1 KB | `assets/data/niveles.json` | app |
| 8 | 111.3 KB | `assets/data/gramatica.json` | app |
| 9 | 59.1 KB | `assets/data/lecturas.json` | app |
| 10 | 51.5 KB | reanimated `layoutReanimation/…/Zoom.ts` | lib |
| 11 | 48.8 KB | `VirtualizedList.js` | lib |
| 12 | 41.6 KB | react-native-svg `extract/transform.js` | lib |
| 13 | 40.2 KB | reanimated `…/Flip.ts` | lib |
| 14 | 39.5 KB | `src/services/audio.ts` | app |
| 15 | 39.3 KB | `whatwg-url-minimum` | lib |

Por paquete: `assets/data` 3274.7 KB · `src` 2538.5 KB · reanimated 1560.5 KB · react-native 1407.0 KB · skia 528.3 KB
· react-reconciler 348.2 KB · phosphor 279.9 KB · gesture-handler 279.6 KB · svg 275.9 KB · @react-navigation/core
221.4 KB · worklets 199.5 KB.

Para regenerarlo: `EXPO_OFFLINE=1 EXPO_UNSTABLE_ATLAS=true npx expo export --platform android` y
`npx expo-atlas .expo/atlas.jsonl`.

### Top 10 componentes (React DevTools Profiler)

Pendiente: necesita el teléfono. Ver «Profiler».

## Presupuestos y candados

Los topes: lo logrado al cerrar la serie **+ 10 %** (en FPS, −10 %). Los que dependen del teléfono se fijan con la
primera medición en el Xiaomi (release) y se anotan aquí y, los de tamaño, en `scripts/presupuestos.json`.

| Qué | Logrado | Presupuesto | Cómo se revisa |
|---|---|---|---|
| Bundle de JS (Hermes `.hbc`) | 7,259,533 B | **7,985,487 B (7.62 MB)** | `npm run presupuesto` (falla si se pasa) |
| Assets empaquetados (sin aud/img) | 2,629,538 B | **2,892,492 B (2.76 MB)** | `npm run presupuesto` |
| AAB release | pendiente | medido + 10 % (anotar `aabBytes`) | `npm run presupuesto -- --aab <ruta>` |
| Arranque en frío (TotalTime, mediana de 5) | pendiente | medido + 10 %; meta de la serie < 2.0 s | `scripts/medir-arranque.sh 5` |
| Bloqueo más largo del hilo de JS al arrancar | pendiente | < 100 ms | marca `[medir]` (mismo script) |
| FPS de scroll (Errores, Mi mazo, Phrasal, Niveles) | pendiente | ≥ 55 (y ≥ medido − 10 %) | Flashlight, recorrido de abajo |
| FPS de animaciones (Practicar, Caída, Pares, Frases sueltas) | pendiente | ≥ 55 | Flashlight |
| Memoria (PSS) tras 15 min de uso | pendiente | medido + 10 %, y sin crecimiento sostenido en 30 min | `scripts/medir-memoria.sh` |
| Cierres en 30 min de resistencia | pendiente | 0 | `scripts/medir-memoria.sh resistencia 30` |

**Candados automáticos** (corren en `npm run verificar`, obligatorio antes de cada build):

- `npm run check:perf`, que falla con cualquiera de estos:
  - `.map()` en un ScrollView más allá de las listas revisadas;
  - `TouchableOpacity`/`TouchableHighlight`;
  - `Modal` fuera de `HojaConsentimiento`;
  - `measure()` sin revisar null;
  - `setInterval` o listeners sin su limpieza en el mismo efecto;
  - `Image` de react-native;
  - `console` fuera de `__DEV__`;
  - JSON grandes o el mapa de medios arriba de un módulo del arranque;
  - archivos de más de 400 líneas.

  Las excepciones van en el propio script, con su motivo.
- ESLint rechaza los `Touchable*` y el `Button` nativo; los hooks y el React Compiler, como siempre.
- `npm run presupuesto` compara el tamaño del bundle y del AAB contra `scripts/presupuestos.json`.

## Cómo medir en el teléfono

Siempre con el APK **release** instalado (`npx expo run:android --variant release`), el teléfono en carga y con la
app cerrada antes de cada corrida. Se toma la **mediana de 5**.

### Arranque

```bash
# TTI frío del sistema (TotalTime, en ms)
adb shell am force-stop app.wero.mobile
adb shell am start -W -n app.wero.mobile/.MainActivity

# Marcas de la app por tramo (release: construir con EXPO_PUBLIC_MEDIR=1; en debug siempre están prendidas)
adb logcat -c && adb logcat -s ReactNativeJS | grep "\[medir\]"

# Todo junto: 5 arranques en frío con TotalTime y las marcas, y la mediana de cada una
scripts/medir-arranque.sh 5
```

Las marcas viven en `src/shared/utils/marcasArranque.ts`. Cada una es el tiempo desde que empezó el JS
(`__BUNDLE_START_TIME__`): `app` (se evaluó App.tsx), `base` (SQLite abierta y migrada), `catalogo` (catálogo
revisado o sembrado), `splash` (oculto; las fuentes van incrustadas y no tienen marca), `primerRender` (primer cuadro de Practicar) e `interactivo`
(Practicar con sus datos pintados). Un vigía cada 16 ms anota el bloqueo más largo del hilo de JS hasta 3 s después de
`interactivo`. Sin `EXPO_PUBLIC_MEDIR=1` no hace nada en release.

### Flashlight

```bash
npm i -g @perf-profiler/flashlight   # o: curl https://get.flashlight.dev | bash
flashlight measure                    # abrir la app y recorrer: Boot → Practicar → 10 tarjetas → Colmena → Estudio
```

Recorrido de listas y animaciones (prompt 5), una medición por tramo: scroll rápido de arriba abajo en Errores, Se me
atoran, Mi mazo, Phrasal y Niveles; Sonidos deslizando 10 fonemas; Practicar quieto 10 s con la consola a la vista
(aurora, onda y portada héroe a la vez) y haciendo scroll; una ronda de Caída y una de Pares (barras de tiempo);
Frases sueltas deslizando 10 cartas; Estudio con 5 tarjetas con imagen. Anotar cada caída por debajo de 55 FPS y dónde.

Anotar: FPS medio, % CPU medio, RAM máxima y el puntaje.

### Profiler

En un build de desarrollo, abrir React DevTools (`j` en Metro), pestaña Profiler, grabar el mismo recorrido y anotar
los 10 componentes con más tiempo total de render.

## Hallazgos de esta pasada

- **Hermes**: sí (el export produce `.hbc`). **Sin modo debug en release**: `__DEV__` es `false` en el export de
  producción; las pantallas de prueba (`ProbarVoz`, `SfxSampler`) se quedan fuera del bundle.
- **console**: en producción se quitan todos menos `console.error` (`babel-plugin-transform-remove-console`).
- **Versiones duplicadas**: ninguna (una sola copia de react, react-native, reanimated y worklets).
- **expo-doctor**: 19/21. Las 2 que fallan son de red (el proxy bloquea el esquema y React Native Directory), no del
  proyecto. `expo install --check`: al día.
- **Metro**: `blockList` para carpetas de trabajo (`SOUNDS ENGLISH`, `.agents`, `.claude`, `docs`, builds, `.tmp-*`).
