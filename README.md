# Wero

App de vocabulario inglés-español para hispanohablantes mexicanos.
React Native con Expo, todo offline, sin servidor.

---

Expo SDK 54 · React Native 0.81 · React 19 · nueva arquitectura activada.

## Arrancar en cinco minutos

```bash
npm install
npm run check:data      # dice qué JSON faltan
npx expo start -c
```

La app **arranca aunque los JSON estén vacíos**. Verás una pantalla de
inicio sin contenido y en Ajustes → Diagnóstico sale qué falta. Eso es a
propósito: así puedes correrla antes de pegar nada.

## `app.json` no lleva `sdkVersion`

Y es a propósito. Expo deduce el SDK de la versión del paquete `expo`
instalada. Si alguien escribe `"sdkVersion"` en `app.json`, esa línea
manda sobre `package.json`: Expo Go dirá que el proyecto es de ese SDK
aunque tengas otro instalado, y `expo install --check` comparará contra
las versiones equivocadas y pedirá bajar veinte paquetes.

Si vuelves a ver "el proyecto usa SDK 54" con un expo 57 instalado,
revisa esa llave antes que nada.

## Nunca corras `npx expo install --fix` a ciegas

Ese comando alinea todo el proyecto con la versión de `expo` que esté
**instalada en node_modules**, no con la que dice el `package.json`. Si
por lo que sea quedó instalado un expo viejo, `--fix` no lo sube: baja
los otros veinte paquetes para que le empaten. Así es como un proyecto
de SDK 57 se convierte en uno de SDK 54 sin que nadie lo pida.

Antes de correrlo, comprueba con quién está hablando:

```bash
npx expo --version
```

Si no dice `57.x`, borra `node_modules` y `package-lock.json` y vuelve a
instalar. No corras `--fix`.

## Los datos ya están pegados

Las 1,524 entradas, los 17 packs, los 44 fonemas, las 194 tarjetas de
error, los 60 escenarios, las 20 de Cázala y las 6 historias **ya vienen
en `assets/data/`**. `npm run check:data` los revisa y sale 8 de 8.

Dos archivos se generan con script en vez de escribirse a mano:

```bash
python3 scripts/genera_lecturas.py   # 24 historias
python3 scripts/genera_niveles.py    # 800 niveles
```

Ninguno **escribe nada si algo no cuadra**. El de lecturas valida que
cada frase citada exista en el catálogo y que aparezca literal en el
texto. El de niveles valida que cada banda tenga entradas suficientes y
que las tres estrellas nunca pidan más de lo que el nivel da.

Para agregar historias, se edita `scripts/lecturas_extra.py` y se corre
el generador. El texto va con las frases del catálogo escritas tal cual.

Si los vuelves a generar, los nombres cambian respecto al disco:

| Tu archivo | Va en |
|---|---|
| `catalogo_v9.json` | `assets/data/catalogo.json` |
| `packs.json` | `assets/data/packs.json` |
| `situaciones.json` | `assets/data/situaciones.json` |
| `contracciones.json` | `assets/data/contracciones.json` |
| `errores_final.json` | `assets/data/errores.json` |
| `fonemas_final.json` | `assets/data/fonemas.json` |
| `notificaciones.json` | `assets/data/notificaciones.json` |
| generado por script | `assets/data/lecturas.json` |
| generado por script | `assets/data/niveles.json` |

Después de pegar:

```bash
npm run check:data      # verifica que todo cuadre
npx expo start -c       # el -c limpia el caché de Metro
```

**El `-c` no es opcional.** Sin él Metro sigue sirviendo los JSON viejos
que tenía cacheados y parece que no pasó nada.

## Expo Go: qué corre y qué no

La app entera corre en Expo Go **menos dos cosas**, y las dos se
prenden solas en cuanto compiles un development build:

| | En Expo Go | En development build |
|---|---|---|
| Estudiar, juegos, niveles, lecturas | sí | sí |
| Notificaciones | **no** | sí |
| Micrófono (pares mínimos) | **no** | sí |

Las notificaciones no son un bug: **Expo quitó push de Expo Go en el
SDK 53** y el módulo `expo-notifications` truena al importarse dentro de
Expo Go en Android, aunque solo quieras notificaciones locales. Por eso
`src/services/notifications.ts` lo carga tarde y solo fuera de Expo Go.
Si vuelves a poner un `import * as Notifications` arriba del archivo, la
app deja de arrancar en Expo Go con un error rojo de "runtime not ready".

## El micrófono necesita otra compilación

El laboratorio de habla usa `expo-speech-recognition`, que trae código
nativo. **No corre en Expo Go.** La app entera sí corre en Expo Go: lo
único que verás es la pantalla "Di la palabra" apagada con su
explicación. Todo lo demás funciona igual.

Para prenderlo:

```bash
npm install
npx expo run:android      # necesitas Android Studio instalado
```

Eso genera un development build. A partir de ahí `npx expo start
--dev-client` y trabajas igual que antes. Solo hay que volver a
compilar cuando cambies una dependencia nativa, no cuando cambies
código.

## El tema

La app es oscura, con tarjetas de vidrio. Todo sale de `src/theme/tokens.ts`: si quieres volver a
claro, es ese archivo y nada más. Los tokens `shadow` y `depth` son los
que dan el relieve; quitarlos deja la interfaz plana sin romper nada.

Lo que el micrófono puede y no puede hacer está escrito en
`src/services/speech.ts`. En corto: decide cuál de dos palabras dijiste,
no califica tu acento. Por eso el ejercicio son pares mínimos
(beach / bitch) y no una nota del uno al cien.

## Los medios

Los mp3 y webp del pack empaquetado van en `assets/aud/` y `assets/img/`.
**Después de copiarlos, corre:**

```bash
npm run build:assets
```

Eso genera `src/assets/bundled.ts` con un `require()` por archivo. Metro
solo entiende rutas literales, así que sin ese mapa los medios del
binario no se encuentran nunca. Hay que correrlo cada vez que agregues o
quites archivos.

Los nombres exactos de cada archivo están en `docs/MEDIOS.md`. No los
inventas: ya vienen escritos dentro de tus JSON.

---

## Estructura

```
src/
├── navigation/    navegación y rutas
├── screens/       las 22 pantallas, por grupo
├── components/    UI: base, card, list, feedback
├── db/            SQLite: esquema, consultas, migraciones
├── domain/        SM-2, juez del juego, sesión — sin React
├── services/      audio, notificaciones, auth, descargas
├── store/         zustand
├── theme/         tokens de diseño
├── types/         tipos de todos los JSON
└── utils/         fecha, arrays, texto
```

La regla que ordena todo: **`domain/` no importa nada de React ni de la
base.** Es lógica pura, se prueba sin emulador, y por eso el archivo
`scripts/verify.mjs` puede comprobar 35 reglas en medio segundo.

---

## Las decisiones que importan

**El fallo es ámbar, no rojo.** El usuario va a fallar cientos de veces
por diseño. Si cada fallo se siente como un regaño, abandona en la
semana dos. Está en `theme/tokens.ts` y en `FeedbackBand`.

**SM-2 con pasos de aprendizaje.** Una tarjeta nueva o fallada no se va a
días: vuelve en la misma sesión al minuto y a los diez. Sin eso,
aprendes algo hoy y mañana lo fallas desde cero.

**Piso de facilidad en 1.3.** Sin ese piso, una tarjeta fallada cinco
veces reaparece cada día para siempre y envenena la cola.

**Un solo reproductor de audio.** Crear un player por sonido filtra
memoria nativa; en una sesión de 60 tarjetas la app se pone a tirones.

**El juez lee del arquetipo, nunca del escenario.** Los 60 escenarios no
traen tabla propia justamente para que no puedan contradecirse.

**El filtro de contenido está en un solo lugar.** `buildFilter()` en
`db/queries.ts`. Si se replica por pantalla, tarde o temprano una se
olvida y sale una frase de vulgaridad 2 con el Modo Limpio encendido.

**Iconos como glifos de texto.** Cuatro símbolos no justifican 400 KB de
librería de iconos en el bundle.

---

## Verificación

```bash
npm run typecheck       # tsc en modo estricto
npm run verify          # 35 pruebas de la lógica de dominio
npm run check:imports   # imports rotos y ciclos
npm run check:data      # estado de los JSON
```

Los cuatro pasan en limpio. Lo que **no** está probado y solo se sabe en
el teléfono: si los glifos IPA se ven o salen cuadritos, si el audio
suena con el teléfono en silencio, cómo se siente la animación en un
dispositivo de gama baja, y si las notificaciones sobreviven al gestor
de batería de Xiaomi y Huawei.

---

## Rendimiento

Lo que ya está hecho:

- Índices en SQLite sobre las consultas del camino caliente
  (`vence_en`, `pack_final`, `mundo`, `regla_grupo`)
- WAL activado: la UI no se congela mientras se siembra o descarga
- Distractores precargados de golpe al armar la sesión, no uno por
  tarjeta en medio del estudio
- La sesión vive fuera del store de zustand, para no clonar la cola
  entera en cada respuesta
- `FlatList` con `removeClippedSubviews` en las listas largas
- `EntryRow` memoizado
- Las animaciones corren en el hilo de UI con reanimated, no en el de JS

Lo que falta y solo se puede medir en el teléfono: el tamaño real del
bundle, el tiempo de arranque en frío y el consumo de memoria con los
1,524 registros cargados.

---

## Falta antes de publicar

- Fuente con cobertura IPA en `assets/fonts/` si los símbolos salen
  como cuadritos (Charis SIL o Noto Sans)
- Icono 512×512 y splash en `assets/`
- Los mp3 y webp
- Reemplazar SHA-256 por PBKDF2 si algún día hay sincronización con
  servidor. Para una app local sin datos sensibles, lo actual es
  proporcionado

---

## Por qué la carpeta se llama `navigation/` y no `app/`

Expo Router detecta automáticamente una carpeta `src/app` y la trata
como enrutado por archivos. Si esa carpeta existe, Metro imprime
`Using src/app as the root directory for Expo Router` y la navegación
manual deja de funcionar.

Esta app usa React Navigation con un stack explícito, no enrutado por
archivos. Por eso la carpeta se llama `navigation/`. **No la renombres
a `app/`.**
