# Plan de arranque (prompt 3 de 6) — propuesta, espera OK

Principio: al abrir, la app solo hace lo necesario para mostrar Practicar y que se pueda tocar. Lo demás, cuando se pide
o después del primer cuadro interactivo.

## 1. Cómo se mide

| Qué | Dónde | Estado |
|---|---|---|
| Tramos del arranque (`app`, `base`, `catalogo`, `fuentes`, `splash`, `primerRender`, `interactivo`) y el bloqueo más largo del hilo de JS | `src/shared/utils/marcasArranque.ts` (release con `EXPO_PUBLIC_MEDIR=1`) | listo (commit `108fb68`) |
| `am start -W` en frío, 5 veces, mediana (y la mediana de cada marca) | `scripts/medir-arranque.sh 5` | listo; **se corre en el Xiaomi** |
| Profiler de React Native DevTools grabando el arranque | release con `EXPO_PUBLIC_MEDIR=1` → DevTools → Performance → recargar | **en el Xiaomi** |
| Peso del bundle y módulos | `expo export` + Expo Atlas | medido aquí |
| Costo de evaluar un módulo aislado | Hermes CLI (x86, VM 0.12): solo sirve para comparar, no es el tiempo del teléfono | medido aquí |

En este contenedor no hay teléfono ni SDK de Android: TotalTime, las marcas y el profiler quedan para el Xiaomi con
los dos comandos de arriba. Lo que sí se midió aquí:

| Pieza | Medido aquí | Estimado en gama media (×5–8) |
|---|---|---|
| Evaluar `catalogo.json` (2.4 MB, 1,524 entradas; Metro lo compila como objeto literal) | 5–8 ms | 40–60 ms, en **cada** arranque |
| La huella del catálogo (`catalogVersionOf`, recorre las 1,524) | ~1 ms | ~5 ms |
| Registrar ~7,887 módulos de medios (`__d`) + el índice | ~5 ms | 25–40 ms, y +1.7 MB de bytecode |
| Hermes del bundle actual (sin aud/img) | 7,727,907 B | — |

## 2. Lo que corre hoy al abrir (en orden)

**Al cargar el bundle** (antes de cualquier render)
1. `index.js`: `react-native-gesture-handler`, `registerRootComponent`.
2. `App.tsx` (módulo): `SplashScreen.preventAutoHideAsync()`. Con `inlineRequires` activo (ya está en
   `metro.config.js`), el resto de los imports se evalúan al usarse.
3. Cada módulo del bundle se registra (`__d`), aunque no se evalúe: incluye los ~7,887 medios de `bundled.ts` en el
   build real.

**Primer render de App**
4. `useFonts(fuentes)`: carga en tiempo de ejecución **5 fuentes, 1.05 MB** (CharisSIL sola pesa 716 KB y solo la
   usan las pantallas de IPA). Hasta que terminan, App pinta `null`.
5. `useBarraOculta()` (barra de navegación de Android oculta).
6. Listener de `AppState` para cortar el audio.
7. `RootNavigator`: listener de toque de notificación (**carga `expo-notifications`** y llama
   `setNotificationHandler`) y la pila con `BootScreen`.

**BootScreen** (debajo del splash)
8. `getDb()`: abre SQLite, 3 `PRAGMA`, lee `user_version` y corre las migraciones que falten (cada una en su
   transacción; si no cambió la versión, ninguna).
9. `loadContent().catalog`: **evalúa `catalogo.json` completo en cada arranque**, solo para decidir si hay que sembrar.
10. `seedCatalog`: `COUNT(*)`, lee la versión guardada, a veces un `COUNT` más; calcula la huella recorriendo las
    1,524 entradas. En la primera instalación (o si cambia el catálogo) inserta las 1,524 filas en 77 `INSERT` dentro de
    una transacción, con barra de progreso.
11. `audio.initAudio()`: modo de audio nativo (`setAudioModeAsync`) y, solo en dev, el paquete de SFX guardado
    (AsyncStorage). Los SFX **ya no** se precargan: cada uno crea su player al primer uso.
12. `notifications.setupChannel()`: crea el canal de Android (nativo).
13. `restore()`: AsyncStorage (sesión) → SQL (usuario). Sin sesión: AsyncStorage (consentimiento de Google) y, si
    aplica, el inicio de sesión automático de Google. Al entrar: `useUnlockStore.cargar` (SQL).

**Al salir de Boot**
14. Se oculta el splash (fuentes listas y status ≠ booting).
15. `App` → `loadSettings` (SQL) → aplica háptica, SFX, volumen y música.
16. `music.iniciar()`: crea el player y **empieza la música** (está prendida por defecto).
17. `TabNavigator`: evalúa los módulos de **las tres pestañas** (Explorar, Practicar y Progreso, con sus gráficas de
    Skia), aunque solo monta Practicar (las pestañas ya son perezosas al montar).
18. Practicar: `usePracticar` lanza **9 funciones en paralelo = 12 consultas SQL** (récords, reto 2, habla, niveles,
    estadísticas 3, uso, días, vencidas, nuevas) y evalúa `phrasal_verbs.json` (145 KB) **solo para contar los verbos**
    del renglón de Phrasal. `ConsolaHoy` y `RetoSemana` leen AsyncStorage (celebraciones), pero solo cuando la meta o el reto ya se cumplieron.
    Skia: `FondoAurora`, `OndaSenal` y las portadas.
19. A los 2.5 s: `precargarDistractores` (ya diferido).

Las pantallas del stack ya se cargan con `getComponent`, y `SfxSampler` y `ProbarVoz` solo existen en `__DEV__`
(fuera del release).

## 3. Arreglos propuestos (en orden, midiendo cada uno)

**A · Mapa de medios por paquete.** Hoy los `require` ya están dentro de un `switch` (no se evalúan al abrir), pero el
bundle registra los ~7,887 módulos y el índice es un objeto de 7,887 llaves. Propuesta:
`build-asset-map.mjs` genera `src/assets/medios/<paquete>.ts` (uno por pack de `aud/` y uno por carpeta de `img/`) y un
`bundled.ts` chico con solo el índice ruta → paquete; `media.ts` pide el módulo del paquete la primera vez (require
perezoso). La reproducción no cambia. Ganancia esperada: el índice deja de construirse completo; el registro de módulos
(`__d`) **no desaparece** (Metro no parte el bundle en release), así que el ahorro es chico (decenas de ms). Se mide en
el Xiaomi porque aquí no están `assets/aud` ni `assets/img`.

**B · JSON perezosos.** Ya son perezosos por archivo (`loadContent`), salvo dos que se piden al abrir:
- `catalogo.json` en Boot → sale del arranque con C.
- `phrasal_verbs.json` en Practicar, solo por el conteo → el conteo se genera al compilar (un `resumenContenido.ts`
  generado por script y verificado por `check:data`), y el JSON se carga al entrar a Phrasal.
Esqueletos: las pantallas de lecturas, fonemas, errores, gramática y phrasal ya tienen `useCarga` con esqueleto.

**C · Base prearmada.** Un script genera `assets/data/catalogo.db` (solo la tabla `entrada`, con `node:sqlite`) y la
huella del catálogo como constante generada. En el arranque: si la huella guardada coincide, **no se toca el JSON ni se
recorre nada** (una lectura de `app_meta`). Si no (primera instalación o catálogo nuevo): se importa `catalogo.db`
desde assets (`importDatabaseFromAssetAsync`), `ATTACH` + `INSERT INTO entrada SELECT …` en una transacción y se borra
la copia; el avance del usuario está en otras tablas y no se toca, igual que hoy. Con eso `catalogo.json` sale del
bundle (**−2.4 MB de JS**): Cázala y Diagnóstico, los otros dos que lo leían, pasan a leer de la base. Además: las 12
consultas de Practicar en 2 (una de conteos del usuario y una de la cola), revisando los índices con
`EXPLAIN QUERY PLAN`; la conexión ya es una sola y reutilizada.

**D · Fuentes incrustadas.** Las 5 se usan (body 230 usos, bodyStrong 105, heading 31, display 28, ipa 15): no se
borra ninguna. Pasan al plugin de `expo-font` en `app.json` (van dentro del APK y Android las registra solo); se quita
`useFonts` y el `return null` que espera. En Android el nombre de familia es el del archivo: `ipa` pasa de
`'CharisSIL'` a `'CharisSIL-Regular'` (las otras cuatro ya coinciden). Mismo aspecto.

**E · Servicios diferidos.** Después de que Practicar es interactivo (`InteractionManager.runAfterInteractions`):
canal de notificaciones y listener de toque, `useUnlockStore.cargar`, y la preparación de audio (`setAudioModeAsync`
queda en el primer `play`, que ya lo llama si falta). Las lecturas de AsyncStorage del arranque en un solo `multiGet` (sesión y consentimiento de Google, que hoy van
una tras otra cuando no hay sesión; con sesión es una sola lectura). **Música:** hoy suena en cuanto se sale de Boot; diferirla
hasta después de interactivo la haría empezar unos cientos de ms más tarde. ¿La difiero o la dejo como está?

**F · Pantallas perezosas.** Las del stack ya lo son. Falta: Explorar y Progreso con `getComponent` en las pestañas,
para que sus módulos (y las gráficas de Skia de Progreso) no se evalúen al abrir.

**G · Splash y primer cuadro.** Con D ya no se esperan fuentes: el splash se oculta cuando la base y la sesión están
listas (hoy), no antes. Practicar ya maqueta su esqueleto mientras cargan los datos; se revisa que no haya cuadro
vacío entre el splash y Practicar.

**H · Bundle.** Con Atlas otra vez: `catalogo.json` sale (C); íconos: phosphor entra por `shared/ui/Icon.tsx` con
imports por ícono (se confirma que no arrastra el paquete completo); no hay lodash. `react-reconciler` (336 KB) lo trae
Skia y no se puede quitar.

## 4. Metas y lo que no depende de aquí

- Bundle más chico que la línea base: con C se espera 7.7 MB → ~5.3 MB de Hermes (se confirma con `expo export`).
- Arranque < 2.0 s o −40 %, y ningún bloqueo > 100 ms: **se miden en el Xiaomi** con `scripts/medir-arranque.sh`; aquí no
  hay dispositivo, así que la tabla ANTES/DESPUÉS del teléfono la llenas tú (o me pasas la salida del script y la
  anoto).
- Lo que no se toca: Skia en Practicar (es el diseño de la pantalla), el registro de módulos de Metro (sin partir el
  bundle no se evita).
