# Rendimiento de Wero

Serie «Rendimiento y estructura». Reglas: medir antes, cambiar y medir después; cero cambios visibles; commits
pequeños; se mide en **release**, nunca en debug.

Punto de partida: tag `antes-de-rendimiento` (commit `be93b64`). Rama de trabajo: `perf/serie-rendimiento`.

## Línea base

«Medido aquí» se sacó con `expo export --platform android` en modo producción (Hermes, `.hbc`). El checkout del
contenedor no trae `assets/aud` ni `assets/img` (el `bundled.ts` local está vacío), así que el bundle y los assets de
aquí **no incluyen** los ~7.9k medios del build real. Lo que depende del teléfono queda «pendiente» con el comando
exacto para sacarlo (ver abajo).

| Métrica | LÍNEA BASE | DESPUÉS DE LIMPIEZA | DESPUÉS DE ESTRUCTURA | DESPUÉS DE ARRANQUE | DESPUÉS DE RE-RENDERS | Cómo |
|---|---|---|---|---|---|---|
| Bundle JS Hermes (`.hbc`) | 7,698,751 B (7.34 MiB) | 7,678,696 B (7.32 MiB), −20 KB | 7,727,907 B (7.37 MiB), +49 KB (+0.6 %) | **6,943,452 B (6.62 MiB), −755 KB contra la base (−9.8 %)** | 7,258,665 B (6.92 MiB): +315 KB por las cachés del React Compiler; −440 KB contra la base | `expo export`, medido aquí |
| Salida JS antes de Hermes | 12.71 MB | — | 12.72 MB | 10.31 MB (−19 %) | — | Expo Atlas |
| Módulos en el bundle | 2,425 | 2,425 | 2,484 (+59: hooks y componentes partidos) | 2,472 | — | Expo Atlas |
| Assets empaquetados (sin aud/img) | 104 archivos · 3.68 MB | igual (el borrado de assets espera OK) | 104 archivos (los 12 sfx duplicados ya venían deduplicados por hash) | 100 archivos · 3.76 MB (salen las 5 fuentes, que van en el APK; entra `catalogo.db`, 1.1 MB) | igual | `expo export` |
| Export completo (sin aud/img) | 11,386,071 B | 11,366,016 B | 11,415,227 B | 10,710,095 B | 11,025,308 B | `expo export` |
| APK release (arm64) | pendiente | pendiente | pendiente | pendiente | pendiente | `cd android && ./gradlew assembleRelease` → `app/build/outputs/apk/release/` |
| AAB release | pendiente | pendiente | pendiente | pendiente | pendiente | `./gradlew bundleRelease` → `app/build/outputs/bundle/release/` |
| TTI frío (`am start -W`, TotalTime) | pendiente | pendiente | pendiente | pendiente | pendiente | ver «Arranque» |
| Arranque JS → Practicar interactivo | pendiente | pendiente | pendiente | pendiente | pendiente | cronómetro `[medir]` (ver «Arranque») |
| FPS medio / CPU / RAM (Flashlight) | pendiente | pendiente | pendiente | pendiente | pendiente | ver «Flashlight» |

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
