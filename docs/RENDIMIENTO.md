# Rendimiento de Wero

Serie «Rendimiento y estructura». Reglas: medir antes, cambiar y medir después; cero cambios visibles; commits
pequeños; se mide en **release**, nunca en debug.

Punto de partida: tag `antes-de-rendimiento` (commit `be93b64`). Rama de trabajo: `perf/serie-rendimiento`.

## Línea base

«Medido aquí» se sacó con `expo export --platform android` en modo producción (Hermes, `.hbc`). El checkout del
contenedor no trae `assets/aud` ni `assets/img` (el `bundled.ts` local está vacío), así que el bundle y los assets de
aquí **no incluyen** los ~7.9k medios del build real. Lo que depende del teléfono queda «pendiente» con el comando
exacto para sacarlo (ver abajo).

| Métrica | LÍNEA BASE | DESPUÉS DE LIMPIEZA | DESPUÉS DE ESTRUCTURA | Cómo |
|---|---|---|---|---|
| Bundle JS Hermes (`.hbc`) | 7,698,751 B (7.34 MiB) | 7,678,696 B (7.32 MiB), −20 KB | 7,727,907 B (7.37 MiB), +49 KB (+0.6 %) | `expo export`, medido aquí |
| Salida JS antes de Hermes | 12.71 MB | — | 12.72 MB | Expo Atlas |
| Módulos en el bundle | 2,425 | 2,425 | 2,484 (+59: hooks y componentes partidos) | Expo Atlas |
| Assets empaquetados (sin aud/img) | 104 archivos · 3.68 MB | igual (el borrado de assets espera OK) | 104 archivos (los 12 sfx duplicados ya venían deduplicados por hash) | `expo export` |
| Export completo (sin aud/img) | 11,386,071 B | 11,366,016 B | 11,415,227 B | `expo export` |
| APK release (arm64) | pendiente | pendiente | pendiente | `cd android && ./gradlew assembleRelease` → `app/build/outputs/apk/release/` |
| AAB release | pendiente | pendiente | pendiente | `./gradlew bundleRelease` → `app/build/outputs/bundle/release/` |
| TTI frío (`am start -W`, TotalTime) | pendiente | pendiente | pendiente | ver «Arranque» |
| Arranque JS → Practicar interactivo | pendiente | pendiente | pendiente | cronómetro `[medir]` (ver «Arranque») |
| FPS medio / CPU / RAM (Flashlight) | pendiente | pendiente | pendiente | ver «Flashlight» |

**Después de estructura.** El prompt 2 no busca bajar peso: parte pantallas en hooks y componentes y mueve archivos a
capas. Eso suma 59 módulos, y cada módulo de Metro lleva su envoltura (`__d(function…)`, su tabla de dependencias),
de ahí los +49 KB de Hermes (+0.6 %) con la misma salida de código (12.72 MB). El orden de los hooks y efectos de
cada pantalla no cambió, así que no se espera diferencia de arranque ni de FPS; se confirma en el teléfono.

### Top 15 módulos (Expo Atlas, tamaño de salida)

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

# Cronómetro de la app: desde que arranca el JS hasta que Practicar es interactivo
# (release: construir con EXPO_PUBLIC_MEDIR=1; en debug siempre está prendido)
adb logcat -c && adb logcat -s ReactNativeJS | grep "\[medir\]"
```

El cronómetro vive en `src/utils/medicion.ts` y se dispara en el primer frame con Practicar ya cargado. Sin
`EXPO_PUBLIC_MEDIR=1` no hace nada en release.

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
