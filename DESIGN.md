# DESIGN.md — Wero

Este documento tiene dos partes. La **primera** describe lo que existe hoy en el código, sin juicios y sin proponer cambios. La **segunda**, "Reglas", es la ley para todo cambio futuro.

- Producto, audiencia y tono: [`PRODUCT.md`](PRODUCT.md).
- Dónde el código incumple hoy las reglas: [`DESIGN-AUDIT.md`](DESIGN-AUDIT.md).
- Por qué la dirección visual es la que es: [`docs/DISENO.md`](docs/DISENO.md).

Fuente de verdad de los valores: `src/theme/` (`tokens.ts`, `typography.ts`, `motion.ts`, `portadas.ts`). `npm run check:color` falla si aparece un hex o `rgba(` fuera de esa carpeta.

---

# Parte 1 · Lo que existe hoy

## 1.1 Dirección visual

"Neón nocturno" (v4.0): tinta azul profunda y un cian eléctrico. Una sola fuente de luz arriba a la izquierda (`sol`), tarjetas sin borde parejo (llevan un **filo de luz** de 1 px en degradado), fondo en degradado que se aclara arriba, y una única superficie de color (`contraste`). Un solo tema, oscuro.

## 1.2 Color

Todo en `src/theme/tokens.ts`.

**Fondos y superficies**

| Token | Valor | Uso |
|---|---|---|
| `bg` | `#0A0F16` | Fondo base |
| `bgFin` | `#06090D` | Final del degradado de fondo; footer |
| `bgAlto` | `#101823` | Fondo elevado |
| `surface` / `surfaceSolida` | `#141D28` | Tarjetas |
| `surfaceAlt` | `#1A2532` | Superficie alta; botón `secondary`; fichas |
| `surfaceHigh` | `#22303F` | Superficie máxima |
| `contraste` | `#0B3A50` | La única superficie de color |

**Texto y bordes**

| Token | Valor |
|---|---|
| `text` | `#EAF2F9` |
| `textMuted` | `#B4C2CE` |
| `textFaint` | `#90A2B4` |
| `onContraste` | `#EAF7FD` |
| `border` | `rgba(255,255,255,0.08)` |
| `borderStrong` | `rgba(255,255,255,0.18)` |
| `filo` | `rgba(255,255,255,0.16)` |

**Acento (cian)**

| Token | Valor |
|---|---|
| `accent` | `#45D9FF` |
| `accentSoft` | `rgba(69,217,255,0.14)` |
| `accentDeep` | `#17ABD8` |
| `accentBorde` | `rgba(69,217,255,0.32)` |
| `onAccent` | `#04141C` (texto sobre el cian: nunca blanco) |

**Estado**

| Token | Valor | Semántica |
|---|---|---|
| `correct` (+`Soft`, `Deep` `#22B87A`, `Fondo` `#10241B`) | `#4ADE9B` | Acierto |
| `wrong` (+`Soft`, `Deep` `#CF9320`, `Fondo` `#241C0C`) | `#F2B33D` | Fallo: ámbar, nunca rojo |
| `riskWarn` | `#F2B33D` | Advertencia de contenido |
| `riskStrong` (+`Soft`) | `#FF7A66` | Único rojo: lenguaje explícito |

**Mundos** (`color.world`, categorías de contenido): `dia_a_dia #66A2EA`, `calle #F08A4B`, `dinero #4ADE9B`, `gente #E27BC5`, `cultura #A390F6`, `tech #4FAAC5`, `legal #96A0AE`, `fonetica #E0B441`.

**Velos y auxiliares:** `velo` (0.94), `veloPortada` (0.42), `veloMuro` (0.72), `veloBarra` (0.72), `trackFondo` (negro 0.38), `biselSombra` (negro 0.45), `textSobrePortada` (0.22), `shadow` `#000000`, `notifAndroid` `#E8543F` (requisito del sistema operativo).

**Degradados**

- `FONDO`: `#0E1620` → `bgFin`, de pantalla. Dirección `sol`: inicio `(0,0)`, fin `(0.9,1)`.
- `gradiente`: 17 pares oscuros y tintados, uno por mundo y por juego (ej. `calle: #3A2318 → #1B120D`, `dinero: #123021 → #0B1A13`), para tarjetas con portada.
- `filoLuz`: blanco 0.28 → blanco 0.04 → cian 0.18. `filoOk` y `filoWrong` son sus versiones de veredicto (verde y ámbar).
- `resplandorSol`: cian 0.16 → 0.04 → 0, el halo de `Screen`.

**Contraste medido** (WCAG, calculado de los tokens): `text` ≥ 10.7:1 sobre cualquier superficie; `textMuted` ≥ 6.66; `textFaint` ≥ 4.62; `accent` ≥ 7.27; `onAccent` sobre `accent` 11.25; `text` sobre `accent` 1.47. Todos los pares de texto pasan AA (mínimo 4.5:1) sobre las ocho superficies, `contraste` incluida. Para lograrlo se aclararon `accentDeep`, `wrongDeep` y cinco colores de mundo (`dia_a_dia`, `gente`, `cultura`, `tech`, `legal`), lo mínimo para cruzar el umbral. `accentDeep` solo se usa como borde inferior de fichas (no como texto) y `wrongDeep` no se usa fuera de los tokens.

## 1.3 Tipografía

- **Familias** (`font.family`, `tokens.ts`): **Bricolage Grotesque** para títulos y cifras grandes (`display` 700, `heading` 600), **Instrument Sans** para todo lo demás (`body` 400, `bodyStrong` 600) y **Charis SIL** Regular solo para IPA. `App.tsx` las carga con `useFonts` (`src/theme/fuentes.ts`) y el splash espera. El peso va en la familia: no se usa `fontWeight`.
- **Tamaños** (`font.size`): `xs 12`, `sm 13`, `md 16`, `lg 18`, `xl 22`, `xxl 28`, `display 34`. Valores sueltos en uso: 44 (inicial de portada), 46 (logo), 64 (marcador final de Caída).
- **Estilos compartidos** (`text.*`):

| Estilo | Tamaño | Familia | Line-height |
|---|---|---|---|
| `display` | 34 | Bricolage 700 | ×1.15 |
| `h1` | 28 | Bricolage 700 | ×1.2 |
| `h2` | 22 | Bricolage 600 | ×1.25 |
| `h3` | 18 | Bricolage 600 | — |
| `body` / `bodyMuted` | 16 | Instrument 400 | ×1.5 |
| `small` | 13 | Instrument 400 | ×1.45 |
| `tiny` | 12 | Instrument 600 | — |
| `ipa` | 16 | Charis SIL 400 | — (`letterSpacing 0.3`) |

- **`letterSpacing`** en uso: todo texto de 28 px o más lleva −1.5 % de su tamaño (`tamaño * -0.015`); etiquetas en mayúsculas 0.6 a 0.9; etiqueta de `Button` 0.2. Excepción que no es título: la inicial de portada pendiente.

## 1.4 Espaciado y medidas

- **`space`:** `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 24`, `xxl 32`, `xxxl 48`.
- **`layout`:** `screenPad 16`, `tapMin 48`, `cardMaxWidth 520`, `adBar 56`.
- **`iconoRedondo`** (área táctil del botón circular): `sm 48`, `md 48`, `lg 52`. **`iconoVisual`** (el círculo que se ve, centrado dentro): `sm 36`, `md 44`, `lg 52`.
- **`depth`** (borde inferior de piezas de juego): `sm 2`, `md 3`, `lg 4`.
- Valores sueltos que aparecen en estilos, fuera de esa escala: 1, 2, 3, 5, 6, 10 y 20 px, y márgenes negativos de −1 a −10 (detalle con archivo y línea en `DESIGN-AUDIT.md`).

## 1.5 Radios

`radius`: `sm 14`, `md 20`, `lg 28`, `xl 36`, `pill 999`. Uso: `Button` y `Badge` en `pill`; `Card` en `lg` (interior `lg − 1` bajo el filo); `OptionButton`, inputs y fichas de Pares en `md`; fichas de Caída en `lg`.

## 1.6 Sombras, desenfoque y movimiento

**Sombras** (`shadow`):

| Token | Color | Opacidad | Radio | Offset Y | Elevación |
|---|---|---|---|---|---|
| `none` | transparente | 0 | 0 | 0 | 0 |
| `soft` | `#000` | 0.40 | 10 | 4 | 3 |
| `card` | `#000` | 0.55 | 20 | 10 | 7 |
| `raised` | `#000` | 0.70 | 32 | 18 | 14 |

No hay sombras de color: el botón `primary` usa `soft` y la barra de pestañas usa `card` (con `elevation 0`).

**Desenfoque** (`blur`, expo-blur): `suave 18`, `medio 32`, `fuerte 55`. Se usa en la barra de pestañas y en el muro de desbloqueo.

**Movimiento** (`motion.ts`, `duration`): `motionDuration` `rapida 120`, `normal 220`, `lenta 350`; `duration` `instant 120`, `fast 180`, `base 240`, `slow 380`, `reveal 520`. Easing `salida`, `entrada` y `estandar` (cúbicas). Resortes `suave`, `conRebote` y `firme`. Al presionar, escala 0.96 con resorte firme; al soltar, rebote ligero. Todo componente respeta `useMovimientoReducido()`.

## 1.7 Componentes base

| Componente | Qué es hoy |
|---|---|
| `Screen` | Fondo `bg` con el degradado `FONDO` y el resplandor del sol. Props `scroll`, `padded`, `footer` (fijo abajo, con borde superior fino y fondo `bgFin`). Ninguna pantalla redefine fondo ni safe area |
| `Header` | Fila de mínimo 48 dp. Flecha atrás a la izquierda (ancho fijo 56), título `lg` semibold centrado de hasta 2 líneas, subtítulo `sm` muted de 1 línea, lado derecho que crece con su contenido |
| `Button` | Píldora. `md`: alto mínimo 48, padding `lg`. `lg`: alto mínimo 58, padding `xl`. Etiqueta `md` o `lg` semibold. Variantes: `primary` (cian sólido + sombra `soft`), `secondary` (`surfaceAlt`, borde `borderStrong`, sombra `soft`), `ghost` (transparente), `danger` (`riskStrong`). Bloqueado: opacidad 0.45. Vibración ligera al tocar Ícono opcional (`icon`, 20 px en `md` y 24 en `lg`, gap 8, antes del texto o con `iconAlFinal`); un botón solo con ícono exige `accessibilityLabel` |
| `IconButton` | Círculo `iconoVisual` (36, 44 o 52) dentro de un área táctil `iconoRedondo` (48, 48 o 52), con un `Icon` de 24 px (`icono`). Sin `hitSlop` |
| `Card` | Filo de luz de 1 px sobre `surface`, radio `lg`, padding `lg`, `gap md`. Props: `accent` (tiñe el borde), `elevated`, `portada` (degradado o imagen con alto reservado), `onLongPress` |
| `Badge` | Píldora, texto `sm` semibold (`xs` en `small`) |
| `ProgressBar` | Carril `trackFondo`, relleno `accent` animado con `scaleX`; alto 6 por defecto |
| `RoundTimer` | Reloj de ronda de los juegos |
| `OptionButton` | Alto mínimo 56, radio `md`, sin borde, texto `md`. Estados: idle, elegida, correcta, incorrecta, atenuada |
| `AudioButton` | Píldora `accentSoft` con el ícono `play` (o `slow`, que siempre lleva el texto "Lento" a la vista) y etiqueta opcional. Píldora de `sm 34`, `md 44` o `lg 56` de alto dentro de un área táctil de 48 dp como mínimo (`toque`), sin `hitSlop`. Se apaga (opacidad 0.4, deshabilitado) si no hay audio |
| `EntryRow` | Renglón de frase en dos variantes: `compacta` (una línea) y `mazo` (texto a dos líneas y barra de audios etiquetados) |
| `FeedbackBand` | Banda de veredicto con filo verde o ámbar |
| `EmptyState` | Ícono `xl` (32), título, cuerpo y botón `primary` opcional |
| `Carga` + `Skeleton` | Una sola forma de cargar datos: `useCarga(fn, deps)` devuelve `{ estado, datos, error, demora, reintentar }` y `<Carga>` pinta el estado. Sin nada los primeros 300 ms (para no parpadear), después `Skeleton` (bloques que laten en opacidad; quietos con Reduce Motion). El error es `EmptyState` con `warning`, "No se pudo cargar. Intenta de nuevo." y un botón `primary` "Reintentar" (`ErrorCarga`) |
| `Icon` | Única puerta a los íconos: Phosphor en `bold` (`star-filled` con relleno). 25 nombres por función (`play`, `slow`, `volume`, `star`, `check`, `close`, `chevron-right`, `arrow-right`, `back`, `lock`, `warning`, `explore`, `practice`, `progress`…), tamaños `sm 16`, `md 20`, `lg 24`, `xl 32`. Decorativo salvo que lleve `accessibilityLabel`. `slow` nunca va sin el texto "Lento". `check:imports` prohíbe importar Phosphor fuera de `Icon.tsx` |
| `SectionTitle` | Título `lg` semibold con contador o acción `sm` |
| Barra de pestañas | Flotante: `left`/`right` `md`, alto 68, radio `lg`, `BlurView` con velo y filo. Tres pestañas: Vocabulario, Practicar (inicial) y Progreso. Etiqueta `xs` semibold; ícono `Icon` de 24 (`explore`, `practice`, `progress`; el activo cambia de color, no de ícono) en una píldora de 54×28 que se enciende con `accentSoft` |
| Retroalimentación | `Trozos` (cubitos al acertar), `Estrellas`, `Confetti`, `Chispas`, `Toast` |

## 1.8 Las cinco pantallas más usadas

**Practicar (Home).** `Screen` con scroll y cuatro bloques separados por 32 (dentro de cada bloque, 16). Título "Practicar" (`xxl`). **Hoy**: la única superficie de color (`contraste`), con el modo que toca, un botón `primary` grande que dice qué hará ("Repasar N frases" si hay repasos vencidos, con N tope de `metaDiaria` y el total aparte como "Tienes N pendientes"; "Corregir N errores" si no y hay frases atoradas, "Seguir con X" con el último modo usado, "Empezar" sin historial) y, si existen, "Llevas N frases hoy" y "Racha: N días". **Destacados**: 3 tarjetas medianas con portada de 56 (los más usados por días de uso; sin datos, los primeros del orden de siempre; nunca el de Hoy). **Todo lo demás**: 3 grupos plegados por defecto ("Juegos", "Oír y hablar", "Leer y repasar", cada uno con su cuenta) que se despliegan en 200 ms (alto y opacidad, sin animación con Reduce Motion); los que el usuario deja abiertos se guardan en `practicarGruposAbiertos`. Cada renglón: nombre, dato opcional y chevron, 48 dp como mínimo. Al final, el reto de la semana. Con los grupos plegados hay 7 opciones (1 + 3 + 3) para 17 destinos; el código está en `screens/extras/practicar/`.

**Estudio.** Arriba, barra de progreso y contador `xs`; debajo, aciertos (`lg` bold en `accent` + `sm` muted) y una racha `xs` semibold. `StudyCardView`: instrucción `xs` en mayúsculas, escenario con la frase en español (`xl`, ×1.35), `AudioButton` grande, opciones (`OptionButton`, alto 56, `gap md`) o un campo de texto (alto 58, radio `md`, borde 1.5), y `FeedbackBand` al responder.

**Pares.** `Header` con "Nivel N" y contador `xs`; reloj; instrucción `sm`. Tablero de dos columnas con fichas de 47.5 % de ancho, alto mínimo 62 y radio `md` (inglés en `surfaceAlt`, español en `surface`; activa con borde `accent`; fallo en ámbar). Al acertar, un velo con tarjeta (inglés `xl` bold, español `md`, "Saltar con chevron"). Pie con la cuenta de jugadas (`xs`) y un botón (`ghost` mientras hay jugadas, `primary` al terminar).

**Caída.** Marcador `xl` bold en `accent`, la frase que cae (`xxl` bold centrada), fichas de respuesta de alto mínimo 96, radio `lg`, con borde inferior `depth.sm` y sombra `card`. Una línea de piso de 4 px en `riskStrong`. Pantalla final con el resultado a 64 px en `accent`, una tarjeta de resumen (`correct` y `wrong`) y una nota `xs`.

**Detalle.** Encabezado centrado con la frase (`PhraseBlock`) y su imagen (`gap xl`), etiquetas como `Badge`, un bloque de advertencia (título `xs` bold en mayúsculas en `riskWarn`, cuerpo `md` ×1.5) y bloques informativos (título `xs` en mayúsculas `textFaint`, cuerpo `md` ×1.5, `marginTop lg`).

---

# Parte 2 · Reglas

Serán la ley para todo cambio futuro. Donde una regla choque con `docs/DISENO.md` o con el código actual, **mandan estas reglas**. `DESIGN-AUDIT.md` lista lo que hoy las incumple; cada código de abajo (COLOR-1, TIPO-2…) es el mismo que usa esa auditoría.

## COLOR

- **COLOR-1.** Máximo 3 colores de marca: primario, acento y neutro. Los de estado (correcto, error, advertencia) aparte y solo para estado.
- **COLOR-2.** Degradados, si existen, dentro de un mismo tono. Nunca entre colores no relacionados.
- **COLOR-3.** Cada color con escala de tonos (50–900).
- **COLOR-4.** Contraste texto/fondo mínimo 4.5:1 (WCAG AA); texto grande 3:1.

## TIPOGRAFÍA

- **TIPO-1.** Máximo 2 familias. Prohibidas como default: Inter, Roboto, Arial y Space Grotesk.
- **TIPO-2.** Cuerpo de 16 px mínimo; line-height del cuerpo entre 1.4 y 1.6.
- **TIPO-3.** La jerarquía se hace con tamaño Y peso, no solo con color.
- **TIPO-4.** Títulos grandes (≥ 28 px) con `letterSpacing` negativo leve (−1% a −2%).
- **TIPO-5.** No mezclar alineaciones en un mismo bloque.

## ESPACIADO

- **ESP-1.** Escala de 4/8: 4, 8, 12, 16, 24, 32, 48. Nada fuera de la escala.
- **ESP-2.** Proximidad: lo que va junto, cerca; entre secciones, el doble.

## JERARQUÍA Y ACCIÓN

- **ACC-1.** Una sola acción principal por pantalla: botón sólido y de alto contraste. Nada de botones solo con borde para la acción principal.
- **ACC-2.** Solo UNA cosa destacada por pantalla (efecto Von Restorff).
- **ACC-3.** Menos opciones visibles = decisiones más rápidas (Ley de Hick).

## MÓVIL

- **MOV-1.** Área táctil mínima de 48×48 dp, aunque el ícono se vea más chico.
- **MOV-2.** Acciones frecuentes en la mitad inferior (zona del pulgar).
- **MOV-3.** Navegación inferior separada del contenido con fondo o borde.
- **MOV-4.** Sin padding excesivo que empuje el contenido fuera de la pantalla.
- **MOV-5.** Respetar las convenciones de Android/iOS (Ley de Jakob): atrás arriba a la izquierda, swipe atrás, etc.

## ANTI-LOOK-IA

- **IA-1.** Los emojis no se usan como íconos de interfaz. Íconos de un solo set y un solo grosor.
- **IA-2.** No todas las tarjetas iguales en tamaño y peso: variar según importancia.
- **IA-3.** Sombras discretas y consistentes; nada de sombras de colores.
