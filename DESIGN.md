# DESIGN.md — Wero

Este documento tiene dos partes. La **primera** describe lo que existe hoy en el código, sin juicios y sin proponer cambios. La **segunda**, "Reglas", es la ley para todo cambio futuro.

- Producto, audiencia y tono: [`PRODUCT.md`](PRODUCT.md).
- Dónde el código incumple hoy las reglas: [`DESIGN-AUDIT.md`](DESIGN-AUDIT.md).
- Por qué la dirección visual es la que es: [`docs/DISENO.md`](docs/DISENO.md).

Fuente de verdad de los valores: `src/theme/` (`tokens.ts`, `typography.ts`, `motion.ts`, `portadas.ts`). `npm run check:color` falla si aparece un hex, un `rgba(` o un color escrito a mano dentro de un shader fuera de esa carpeta, y si los pasos de `senal` se separan más de 8° de tono.

---

# Parte 1 · Lo que existe hoy

## 1.1 Dirección visual

"Neón nocturno" (v4.0): tinta azul profunda y un cian eléctrico. Una sola fuente de luz arriba a la izquierda (`sol`), tarjetas sin borde parejo (llevan un **filo de luz** de 1 px en degradado), fondo en degradado que se aclara arriba, y una única superficie de color (`contraste`). Un solo tema, oscuro.

**Señal en vivo (v5.0).** Wero se aprende de oído, así que Practicar se comporta como una consola de audio encendida: ondas, medidores y luz cian que responden al progreso real. Solo la señal usa luz de color; todo lo demás sigue sobrio. La luz vive detrás del contenido (una aurora que nace del `sol`, un ecualizador que respira, un anillo que se llena) y se apaga cuando no se ve, no tiene foco o el sistema pide menos movimiento.

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
| `accent50`…`accent900` | Escala del acento; el `400` es `accent` (`#E7F9FE`, `#CDF3FF`, `#A9EAFE`, `#7FE1FE`, `#45D9FF`, `#2EC4E8`, `#19A2C2`, `#147E97`, `#15596A`, `#113B47`) |
| `contraste50`…`contraste900` | Escala del primario; el `800` es `contraste` (`#0B3A50`) |
| `neutral50`…`neutral900` | Escala de los neutros (tinta azulada); `50`, `200`, `300`, `700`, `800` y `900` son `text`, `textMuted`, `textFaint`, `surfaceHigh`, `surface` y `bg` |
| `star` | `#E9C944`, dorado para estrellas y aciertos seguidos: a 16° del ámbar de fallo (`wrong`) y a 16° de `world.fonetica`; 7.4:1 sobre las superficies |
| `accentBorde` | `rgba(69,217,255,0.32)` |
| `onAccent` | `#04141C` (texto sobre el cian: nunca blanco) |

**Estado**

| Token | Valor | Semántica |
|---|---|---|
| `correct` (+`Soft`, `Deep` `#22B87A`, `Fondo` `#10241B`) | `#4ADE9B` | Acierto |
| `wrong` (+`Soft`, `Deep` `#CF9320`, `Fondo` `#241C0C`) | `#F2B33D` | Fallo: ámbar, nunca rojo |
| `riskWarn` | `#F2B33D` | Advertencia de contenido |
| `riskStrong` (+`Soft`) | `#FF7A66` | Único rojo: lenguaje explícito |

**Mundos** (`color.world`, categorías de contenido): una familia con la misma luminosidad (OKLCH L 0.73) y saturación (C 0.12); solo cambia el tono. `dia_a_dia #71ABF2` (254°), `calle #E1925A` (55°), `dinero #86B96A` (135°), `gente #DD88B9` (345°), `cultura #A89AED` (291°), `tech #21BFBB` (192°), `legal #C78FD9` (318°), `fonetica #AAAF4F` (112°). Ninguno queda a menos de 24° del acento, de `correct`, de `wrong` ni de `riskStrong`, y todos pasan 4.5:1 sobre las ocho superficies (el más bajo, `gente`, da 4.78). **Se usan en chico**: un punto junto al nombre (`PuntoMundo`), una etiqueta, una barra fina (`ProgressBar` de 4 a 5 px) y el tinte de los cubitos. Nunca en fondos grandes ni en botones. Excepción documentada en el audit: las 5 piezas del tablero de Dulces (`TINTES`) son contenido de juego, no marca.

**Velos y auxiliares:** `velo` (0.94), `veloPortada` (0.42), `veloMuro` (0.72), `veloBarra` (0.72), `trackFondo` (negro 0.38), `biselSombra` (negro 0.45), `textSobrePortada` (0.22), `shadow` `#000000`, `notifAndroid` `#E8543F` (requisito del sistema operativo).

**Degradados**

- `FONDO`: `#0E1620` → `bgFin`, de pantalla. Dirección `sol`: inicio `(0,0)`, fin `(0.9,1)`.
- `gradiente`: un solo par neutro (`neutro: #1B242F → #111820`) para todas las tarjetas con portada, sea de mundo o de modo. **Si al verlo en el teléfono Practicar se ve plano, probar un tinte del mundo con croma ≤ 0.03.** No está aplicado.
- `filoLuz`: blanco 0.28 → blanco 0.04 → cian 0.18. `filoOk` y `filoWrong` son sus versiones de veredicto (verde y ámbar).
- `resplandorSol`: cian 0.16 → 0.04 → 0, el halo de `Screen`.
- `senal`: `accent900` → `accent400` → `accent100`. Un solo tono (cian, separación de 2°), sin hex nuevos. Pinta las barras de la onda de HOY y la luz de la señal.
- `reflejo`: blanco 0 → 0.38 → 0, el reflejo metálico que cruza el botón principal de HOY.
- `aurora`: `opacidadMax 0.18`, `paralaje 8` px y `resolucion 0.25` (el shader se pinta a un cuarto de resolución). `grano`: `opacidad 0.03`, estático.

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
- **`layout`:** `screenPad 16`, `tapMin 48`, `cardMaxWidth 520`, `adBar 56`, `filaModo 56` (alto mínimo de un renglón de modo).
- **`iconoRedondo`** (área táctil del botón circular): `sm 48`, `md 48`, `lg 52`. **`iconoVisual`** (el círculo que se ve, centrado dentro): `sm 36`, `md 44`, `lg 52`.
- **`depth`** (borde inferior de piezas de juego): `sm 2`, `md 3`, `lg 4`.
- Todo `padding`, `margin` y `gap` sale de esa escala (ESP-1 = 0); los valores de 1 a 3 pasan a 4, el 6 a 4 dentro de un grupo y a 8 entre filas, el 10 a 12 en las píldoras y a 8 en la barra de pestañas, el 20 a 24. Excepciones que no cuentan, con su motivo en el audit: `padding: 1` del filo de luz (una envoltura de 1 px que hace de borde), los bordes de 1 a 2 px y los márgenes negativos de hasta 2 px que compensan un borde.

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

**Movimiento** (`src/theme/motion.ts`, la única fuente; MOT-1): `motionDuration` `rapido 150` (tocar), `base 220` (cambios de estado) y `lento 320` (transiciones y plegables). Curvas `entrar` (ease-out, lo que entra) y `salir` (ease-in, lo que sale); nunca lineal, salvo los dos relojes de ronda (`RoundTimer` y la caída de Caída, con motivo en el audit). Un solo resorte, `rebote`, para lo que rebota a propósito (banda de resultado, pausa de Caída). Escalón de listas: `escalon(i)` = 40 ms por elemento con tope de 8; del noveno en adelante el retraso se queda en el del octavo. Solo se animan `transform` y `opacity` (y `height` en los plegables). **Al presionar**, todo tocable pasa por `Presionable`: escala 0.97 en `rapido` (MOT-2). **Acierto:** pulso 1 → 1.04 → 1 en `base` y color `correct`. **Fallo:** sacudida de 3 oscilaciones de ±6 px dentro de `base` y color `wrong` (ámbar, nunca rojo). Los dos salen de `useEfectoResultado` (o de la prop `resultado` de `Presionable`), iguales en todos los juegos, con su háptico y su sonido. Un solo efecto de partículas, `Trozos`. La fiesta de fin de partida (`Confetti` y el sonido de nivel completo) solo con buen resultado: 2 o más estrellas o, sin estrellas, 5 rondas y 70 %; si no, el resumen entra sobrio y sin sonido. Con Reduce Motion no hay sacudida, partículas ni escala: quedan el color, la opacidad (0.7 al presionar), el háptico y el sonido; Reanimated salta sus animaciones al valor final (`ReduceMotion.System`).

**Movimiento de la señal (v5.0).** Se suman a `motion.ts`: `motionDuration.escena` 450 (una escena que cambia: HOY que se expande) y `coreografia` 900 (tope de la entrada de una pantalla); los resortes `liquido` (la píldora de la barra) y `aguja` (550 ms con rebote, para que la entrada de la aguja dure siempre lo mismo) y `motionEasing.lineal` (solo para dirigir una animación por tramos); `motionSenal` con `respiro` 4000 (la onda), `aurora` 20000, `reflejo` 6000 y `reflejoPaso` 700, `interferencia` 120, `anillo` 900, `marcador` 700, `onda` 600, `portada` 3200 (los bucles de las portadas), `medidor` 600 (los segmentos del reto), `aguja` 350 y `temblor` 3000 (el medidor de Progreso), `espectro` 600 y `columna` 20 (las columnas del espectrograma); y `motionEntrada` con los retrasos de la coreografía (`hoy` 100, `onda` 350, `chips` 450, `destacados` 500). Los bucles de la señal corren en el hilo de UI (`useFrameCallback`), sin `setState` por fotograma, y solo se anima `transform` y `opacity` (más los uniforms del shader y el `SkPath` de la onda). Como mucho 3 canvases de Skia en bucle a la vez: la aurora, la onda de HOY y la portada de la tarjeta héroe. Progreso solo tiene uno: la aguja del medidor.

## 1.7 Componentes base

| Componente | Qué es hoy |
|---|---|
| `Screen` | Fondo `bg` con el degradado `FONDO` y el resplandor del sol. Props `scroll`, `padded`, `footer` (fijo abajo, con borde superior fino y fondo `bgFin`), `fondo`, `encabezado` y `scrollY`. En las pestañas el scroll termina con un hueco de barra de pestañas + franja de anuncios + safe area + `space.xl`. Ninguna pantalla redefine fondo ni safe area |
| `Header` | Fila de mínimo 48 dp. Flecha atrás a la izquierda (ancho fijo 56), título `lg` semibold centrado de hasta 2 líneas, subtítulo `sm` muted de 1 línea, lado derecho que crece con su contenido |
| `Button` | Píldora. `md`: alto mínimo 48, padding `lg`. `lg`: alto mínimo 58, padding `xl`. Etiqueta `md` o `lg` semibold. Variantes: `primary` (cian sólido + sombra `soft`), `secondary` (`surfaceAlt`, borde `borderStrong`, sombra `soft`), `ghost` (transparente), `danger` (`riskStrong`). Bloqueado: opacidad 0.45. Vibración ligera al tocar Ícono opcional (`icon`, 20 px en `md` y 24 en `lg`, gap 8, antes del texto o con `iconAlFinal`); un botón solo con ícono exige `accessibilityLabel` |
| `IconButton` | Círculo `iconoVisual` (36, 44 o 52) dentro de un área táctil `iconoRedondo` (48, 48 o 52), con un `Icon` de 24 px (`icono`). Sin `hitSlop` |
| `Card` | Filo de luz de 1 px sobre `surface`, radio `lg`, padding `lg`, `gap md`. Props: `elevated`, `portada` (degradado o imagen con alto reservado), `onLongPress` |
| `Badge` | Píldora, texto `sm` semibold (`xs` en `small`). Opcionales: un punto de color, un ícono antes del texto y contenido extra después (las estrellas de un nivel) |
| `ProgressBar` | Carril `trackFondo`, relleno `accent` animado con `scaleX`; alto 6 por defecto |
| `RoundTimer` | Reloj de ronda de los juegos |
| `OptionButton` | Alto mínimo 56 (52 en teléfonos de menos de 700 dp de alto), radio `md`, sin borde en reposo, texto `md`. El veredicto se da en la opción: la correcta se enciende con `correctFondo`, el filo `filoOk`, una palomita (`check`) y un pulso 1 → 1.04 → 1; la elegida mal se sacude con `wrongFondo`, `filoWrong` y una equis (`close`) mientras la correcta se enciende a la vez; las demás bajan a 0.45. Con lector de pantalla dice «Correcta» o «No era esta». Estados: idle, elegida, correcta, fallada, atenuada |
| `AudioButton` | Píldora `accentSoft` con el ícono `play` (o `slow`, que siempre lleva el texto "Lento" a la vista) y etiqueta opcional. Píldora de `sm 34`, `md 44` o `lg 56` de alto dentro de un área táctil de 48 dp como mínimo (`toque`), sin `hitSlop`. Se apaga (opacidad 0.4, deshabilitado) si no hay audio |
| `EntryRow` | Renglón de frase en dos variantes: `compacta` (una línea) y `mazo` (texto a dos líneas y barra de audios etiquetados) |
| `HojaVeredicto` | Hoja de veredicto de Estudio (`fx/`): sube desde abajo con el resorte `rebote` 320 ms después de que el veredicto se vio en su sitio, con un velo de 0.5 como máximo. «Eso es» (verde, `check`) o «Era esta» (ámbar, `close`) con la frase correcta, la nota si hay y, a la derecha, cuándo vuelve la tarjeta. Un solo botón sólido, «Siguiente» con la flecha al final, igual en los dos casos, y «Ver detalle» ghost a la izquierda. Deslizar hacia arriba equivale a «Siguiente»; hacia abajo no la cierra. Con Reduce Motion aparece con un fundido |
| `EmptyState` | Ícono `xl` (32), título, cuerpo y botón `primary` opcional |
| `Carga` + `Skeleton` | Una sola forma de cargar datos: `useCarga(fn, deps)` devuelve `{ estado, datos, error, demora, reintentar }` y `<Carga>` pinta el estado. Sin nada los primeros 300 ms (para no parpadear), después `Skeleton` (bloques que laten en opacidad; quietos con Reduce Motion). El error es `EmptyState` con `warning`, "No se pudo cargar. Intenta de nuevo." y un botón `primary` "Reintentar" (`ErrorCarga`) |
| `Icon` | Única puerta a los íconos: Phosphor en `bold` (`star-filled` con relleno). 25 nombres por función (`play`, `slow`, `volume`, `star`, `check`, `close`, `chevron-right`, `arrow-right`, `back`, `lock`, `warning`, `explore`, `practice`, `progress`…), tamaños `sm 16`, `md 20`, `lg 24`, `xl 32`. Decorativo salvo que lleve `accessibilityLabel`. `slow` nunca va sin el texto "Lento". `check:imports` prohíbe importar Phosphor fuera de `Icon.tsx` |
| `SectionTitle` | Título con contador o acción `sm`. Variante `lista` (por omisión): `lg` semibold con margen. Variante `bloque`: `h2` sin margen, para bloques separados por `gap`; el contador va a la derecha como texto `sm`. Practicar usa `bloque` en «Destacados», «Todo lo demás» y «Esta semana» |
| Barra de pestañas | Flotante: `left`/`right` `md`, alto 68, radio `lg`, `BlurView` con velo y filo. Tres pestañas: Vocabulario, Practicar (inicial) y Progreso. Etiqueta `xs` semibold; ícono `Icon` de 24 (`explore`, `practice`, `progress`; el activo cambia de color y hace 1 → 1.12 → 1). Una sola píldora `accentSoft` de 54×28 se desliza entre pestañas con el resorte `liquido` y se estira en el trayecto (la cabeza llega antes que la cola); cada cambio de pestaña da háptico ligero |
| Señal (`components/fx/`) | `FondoAurora` (aurora Skia de 20 s con parallax del giroscopio y grano estático), `OndaSenal` (28 barras que respiran en 4 s), `AnilloMeta` (arco que se llena en 900 ms, destello una vez por día), `Marcador` (dígitos que ruedan), `MedidorVU` (medidor segmentado del reto de la semana, sin bucles), `MedidorSenal` (medidor semicircular de Progreso: arco `senal`, marcas cada 10 %, aguja con overshoot y temblor de ±0.4°), `Espectrograma` (21 columnas de las últimas tres semanas con scrubbing), `BotonSenal` (reflejo cada 6 s y onda desde el dedo), `PortadaJuego` (escenas Skia de Pares, Caída y Dulces; el resto, su ícono), `TarjetaTilt` (inclinación de 6° máximo), `PildoraLiquida` (píldora de la barra), `TransicionHoy` (overlay que expande HOY a pantalla completa en 450 ms), `OndaVoz` (Skia, el héroe de Estudio), `FraseKaraoke`, `BarraSesion` y `ChipMarcador` (Estudio, ver 1.8), `HojaVeredicto`, y `useSenalActiva` / `useReloj` (foco, segundo plano, reducir movimiento y visibilidad en un solo lugar). Todo efecto va envuelto en `FxSeguro`: si Skia o un sensor fallan, la pantalla queda completa y estática |
| Detalle (`components/detalle/`) | `ImagenSangre` (imagen a todo el ancho, radio `lg` solo abajo, parallax de 0.3 y zoom 1.06 → 1 en 450 ms; sin archivo no dibuja ni reserva lugar), `HeroeFrase` (frase en display 34 con `FraseKaraoke`, IPA, `OndaVoz`, Escuchar y Lento, traducción en `xl` con su audio), `NotaPlegable` («Cómo se pronuncia»), `EscalaRegistro` (5 pasos con un indicador que se desliza con el resorte `rebote`), `CuandoNoDecirla` (bloque ámbar con `warning` y filo izquierdo de 3 px), `FilaDondeVive` (punto del mundo, nombre, bloque y chevron), `BotonGuardar` (footer: «Guardar» primary o «Guardada» secondary) y `Aparece` (un bloque sube 8 dp con fundido al entrar a la vista). `SceneImage` y `Card` ya no pintan iniciales |
| Niveles (`components/niveles/`) | `CeldaNivel` (seis estados que se reconocen sin color: perfecto, hecho, abierto, actual, con anuncio y bloqueado), `EncabezadoTramo` (pegajoso, con estrellas del tramo y barra fina en `star`), `FilaNiveles` (renglón de 5, alto exacto), `AnilloActual` (el único bucle de la pantalla), `EstrellasCelda` (las estrellas que se encienden en cascada o con destello), `DesbloqueoCelda` (el candado que se abre), `EncabezadoNiveles` (juego y «N de M estrellas» con `Marcador`) y los hooks `useScrollNivel` y `useRecompensaNiveles`. La lógica pura está en `domain/niveles.ts` |
| `Presionable` | `Pressable` con el feedback unificado (escala 0.97 en `rapido`; con Reduce Motion baja la opacidad a 0.7) y la prop `resultado` (`acierto` pulsa, `fallo` sacude) |
| Retroalimentación | `Trozos` (cubitos al acertar; en Estudio salen de la opción acertada), `Confetti` (solo fin de partida con buen resultado), `useEfectoResultado` |

## 1.8 Las cinco pantallas más usadas

**Practicar (Home) · v5.0.** `Screen` con scroll, fondo vivo (aurora y grano) y un encabezado que se comprime: «Practicar» a 34 que, con el scroll, se reduce a 22 y sube a una banda con desenfoque (solo iOS; en Android, fondo sólido), con un chip de racha (`fire`, en `star`) a la derecha. Bloques separados por 32 (dentro de cada uno, 16). **Hoy** (`ConsolaHoy`): la única superficie de color (`contraste`) y el único momento héroe. Lleva un ecualizador de fondo cuya energía sale de las frases pendientes (casi plano con 0), un anillo de meta diaria a la derecha (`hoy` de `metaDiaria`, con destello una vez por día), el modo que toca, tres chips con marcador («N pendientes», «N hoy» y «Racha: N días») y el botón `primary` grande que dice qué hará ("Repasar N frases" si hay repasos vencidos, con N tope de `metaDiaria`; "Corregir N errores" si no y hay frases atoradas; "Seguir con X" con el último modo usado; "Empezar" sin historial). Al tocarlo, la tarjeta se expande a pantalla completa (450 ms) mientras el modo se abre por debajo. **Destacados**, asimétricos (IA-2): el más usado por días de uso va en una tarjeta héroe a todo el ancho (alto ~180) y los otros dos en dos columnas (~150), nunca el de Hoy. Cada una lleva una portada de Skia (Pares, Caída y Dulces) o el ícono del modo, sin letras; «Nivel N · E estrellas» con una barra fina de nivel/200; inclinación 3D al mantener presionado y parallax de la portada de 0.15 con el scroll. **Todo lo demás**: 3 grupos plegados por defecto ("Juegos", "Oír y hablar", "Leer y repasar"). El encabezado lleva el ícono del grupo, el nombre, la cuenta en `Badge` y un chevron que gira 180° en `base`. Al abrir, alto y opacidad en `lento` con ease-out y los renglones entran con `escalon(i)` desde 8 dp más abajo; al cerrar, al revés con ease-in y sin escalón. Los grupos abiertos se guardan en `practicarGruposAbiertos`. Cada renglón (`FilaModo`, alto mínimo 56) lleva una ficha de 40×40 (`radius.sm`, `surfaceAlt`) con el ícono del modo en 24 px `textMuted`, el nombre en `md` semibold, una sola línea `sm` muted con la descripción corta (`corta` en `modos.ts`) y a la derecha el dato como `Badge`: «Nivel N» con estrellas en `star` (juegos), «nuevo» (`accentSoft`, pulsa una sola vez por sesión), un punto ámbar y «N frases» (Se me atoran), estrella y «N guardadas» (Mi mazo) o un texto corto. Sin dato no hay `Badge`. Los separadores son de 1 px en `border`, con sangría desde el texto. Al presionar: escala 0.97, un barrido de luz `accentSoft` de izquierda a derecha en `base` y el chevron avanza 4 dp y regresa. **Esta semana** es el reto como medidor VU: un segmento de 4×28 (gap 2) por acierto de la meta, en dos filas si no caben, los encendidos en el degradado `senal` y los apagados en `trackFondo`. Al entrar en la vista se encienden de izquierda a derecha en 600 ms como máximo y el contador «N de M» rueda con `Marcador`; lleva el chip «Quedan N días». Al completar la meta, un destello del medidor y una estrella con «Reto completo. M aciertos esta semana.», una vez por semana y sin confeti; el medidor expone «N de M aciertos esta semana» y sus segmentos son decorativos. No hay bucles ni momentos héroe en estos bloques (MOT-3). La primera vez por sesión hay una coreografía de entrada de 900 ms como máximo (título, HOY con un barrido de luz, la onda que se enciende, los chips que ruedan, los destacados escalonados); en las visitas siguientes, solo un fundido de 150 ms. Con los grupos plegados hay 7 opciones (1 + 3 + 3) para 17 destinos; el código está en `screens/extras/practicar/`.

**Progreso · v5.0.** Mismo encabezado que Practicar (`EncabezadoComprimido`: «Tu progreso» a 34 que se comprime a 22 con el scroll) y jalar para refrescar (`RefreshControl` en `Screen`; la aguja da un empujón al terminar). **El héroe** es el medidor de señal (`MedidorSenal`): un semicírculo con el arco de fondo en `trackFondo`, el de valor en el degradado `senal`, marcas cada 10 % y una aguja que sale de 0, se pasa un poco del valor y se asienta con resorte (350 ms + 550 ms); en reposo tiembla ±0.4° cada 3 s, y ese temblor se pausa fuera de pantalla, sin foco o en segundo plano y no existe con reducir movimiento. El valor es dominadas / total; debajo, el número en `Marcador` (display, cifras tabulares), «frases dominadas de 1,436» y «128 vistas», y dos chips: la racha con `fire` en `star` y el récord («Récord: 4 días»; con la racha igual o mayor, «Récord actual» con un destello dorado una vez por récord). Con 0 frases vistas el medidor queda en reposo con una explicación. **Últimas tres semanas** es un espectrograma: 21 días corridos en tres bloques de 7 que terminan hoy («Hace dos semanas», «La semana pasada», «Esta semana»), con la inicial del día bajo cada columna, los aciertos en `accent` y el resto de las respuestas en `accentSoft`, escala de raíz cuadrada, el máximo como referencia en una línea punteada, los días sin práctica como un punto de 4 px y «Hoy» marcado. Las columnas suben de izquierda a derecha (20 ms entre una y otra, 600 ms en total); al deslizar el dedo sale «Mar 15 · 42 respuestas · 30 aciertos» con un háptico por columna, y con lector de pantalla la gráfica dice su resumen y abre la lista de días como texto. **Por mundo**: una fila por mundo con frases (del que más domina al que menos, también con 0 dominadas), con punto, nombre, «N de M» y una barra fina de 4 dp en el color del mundo que se llena escalonada al entrar a la vista; el total y lo dominado salen de `consultaProgresoPorMundo`, bajo el mismo filtro de contenido. Cada fila abre `WorldDetail`. **Por juego**: cuadrícula de dos columnas con Colmena, Pares, Caída, Dulces y Cázala: ícono, «Nivel N de 200» (el más alto desbloqueado), las estrellas totales y una barra fina de nivel/200; Cázala no tiene niveles y muestra sus partidas y su mejor puntaje; sin partidas, «Sin jugar». **Detalle**: cuadrícula 2×2 donde el número manda (`h1`): la precisión como anillo con el número al centro (un guion mientras no haya práctica), la racha más larga con `fire`, las guardadas con `star` (abre `Deck`) y las atoradas con un punto ámbar (abre `Stuck`); con atoradas, la única acción principal, «Corregir N errores», con el mismo texto que HOY. Cada sección se anima al entrar a la vista; la primera vez por sesión hay una coreografía de 900 ms como máximo (título, aguja, chips, columnas) y en las visitas siguientes, un fundido de 150 ms.

**Estudio · v5.0.** Estructura fija para el pulgar y sin scroll a 360×640: arriba una fila con atrás, los chips de la sesión y «Saltar»; debajo la barra (6 dp, relleno `senal`, punto de luz con el resorte `liquido`); después la instrucción `xs` y el bloque de la frase anclado en el tercio superior; abajo lo que se toca. Si algo no cabe, la zona de abajo es lo único que se acorta y scrollea, con la acción principal fija. Por debajo de 700 dp de alto todo se aprieta: huecos de 8, opciones de 52 y la imagen de la frase a 72. **El héroe** es «la frase es señal» (`OndaVoz`, Skia): una onda espejada de 33 barras (21 y más anchas con «Lento») que está plana en reposo y sube con la voz mientras suena Escuchar, Lento o el audio automático, y se aplana en 220 ms al terminar; con la frase visible va sobre ella y en Escuchar y Dictado, sin texto, es más grande y centrada con «Otra vez» debajo. La energía sale de los tiempos de palabra, no de la amplitud real del audio. **Karaoke** (`FraseKaraoke`): la palabra que suena en `text`, las dichas en `textMuted` y las que faltan en `textFaint`, con un levante de 2 dp; lo que no se dice (una nota entre paréntesis) no se ilumina. Los tiempos salen de `assets/data/marcas.json` (marcas de palabra de Polly, `polly.mjs --marcas`) o, si faltan, de una estimación por sílabas sobre la duración real del audio (`domain/marcas.ts`); nada de esto toca el audio. **Chips**: «N atinadas» con `Marcador` (oculto en 0) y, con el ajuste activo y 3 aciertos seguidos o más, `fire` con la cifra (dice «N seguidas»). La barra brilla por escalones a los 3, 5 y 10 aciertos seguidos y al fallar el brillo baja con calma, sin mensaje. **Veredicto en su sitio, sin velo negro**: opciones como se describe en `OptionButton`; en Construir las fichas saltan a la frase con el resorte `rebote` y, al calificar, se iluminan de izquierda a derecha (verde si era la palabra de ese lugar, ámbar y subrayada si no); en Completar la palabra tocada vuela de su opción al hueco (320 ms) y queda en verde, o en ámbar y tachada; en Dictado y Escribir la hoja muestra la frase con lo que faltó (subrayado) y lo que sobró (subrayado y tachado) en ámbar. Los cubitos salen de la opción acertada. **Transiciones**: la tarjeta que se va sale a la izquierda con un fundido (220 ms) y la nueva entra por la derecha (320 ms) y su onda se conecta dibujándose del centro a los lados; con Reduce Motion solo hay fundidos. **Final**: la barra se llena, una franja de luz la recorre una vez y entra la línea «N de M frases atinadas», con confeti solo si la sesión fue buena (5 respuestas o más y 70 %, la regla de las partidas); con vencidas pendientes se ofrece seguir.

**Niveles · v5.0.** El mapa de los 200 niveles de Colmena, Pares, Caída y Dulces. Arriba, un encabezado fijo con el nombre del juego y «N de M estrellas» (la cifra rueda con `Marcador` cuando sube) sobre una barra fina en `star`; toma la banda de desenfoque al hacer scroll y la lista empieza debajo, así que ninguna fila queda cortada. La lista está virtualizada (`Animated.FlatList` con `getItemLayout`) y se divide en tres tramos, las bandas del juego, cada uno con su encabezado pegado arriba: «Niveles 1–70» en `h3`, «N frases» en `sm` muted y sus estrellas («12 de 210») con una barra fina. Un tramo con todas las estrellas colapsa a su encabezado con `star-filled` y se expande con un toque; uno bloqueado muestra solo el candado y «Se abre al terminar el nivel N» (la regla real es por nivel: el primero del tramo se abre al terminar el anterior). Renglones de cinco celdas cuadradas (nunca menos de 48 dp, texto de 12 px como mínimo) con estados que se reconocen sin color: **perfecto** (`surface` con filo dorado `starFilo` y tres estrellas llenas), **hecho** (las estrellas que tiene), **abierto sin jugar** (`surfaceAlt`, tres estrellas vacías), **con anuncio** (`surfaceAlt`, borde punteado en Skia, `play` y «Anuncio» en `accent`), **bloqueado** (el fondo, número apagado y `lock`) y **actual**. El verde queda para el estado de un juego, no para esta cuadrícula. **El héroe** es el nivel actual: 12 % más grande, en el degradado `senal` con el número en `onAccent`, con un anillo fijo y una onda que sale cada 2.4 s (el único bucle; se pausa sin foco o en segundo plano y con Reduce Motion queda el anillo fijo). La acción principal es «Jugar nivel N» fija en el footer. Al entrar, el nivel actual queda centrado con medidas reales (las mismas de `getItemLayout` y el alto medido de la lista); la primera vez por sesión baja animado en `lento`, las siguientes cae directo, y si te alejas aparece «Ir al nivel N» sobre el footer. Los renglones entran con `escalon(i)` y las estrellas del tramo actual se encienden en cascada una vez. Al volver con estrellas nuevas (se compara con la última foto del mapa, en memoria) la celda pulsa 1 → 1.06 → 1, sus estrellas nuevas se encienden una por una con un destello dorado, el contador rueda y el nuevo actual llega con resorte. Abrir con anuncio vuelve sólido el punteado y abre el candado; si el anuncio falla la celda no cambia y sale el mensaje de `razonMuro`. Con Reduce Motion no hay onda, cascada, scroll animado ni candado animado.

**Pares.** `Header` con "Nivel N" y contador `xs`; reloj; instrucción `sm`. Tablero de dos columnas con fichas de 47.5 % de ancho, alto mínimo 62 y radio `md` (inglés en `surfaceAlt`, español en `surface`; activa con borde `accent`; fallo en ámbar). Al acertar, un velo con tarjeta (inglés `xl` bold, español `md`, "Saltar con chevron"). Pie con la cuenta de jugadas (`xs`) y un botón (`ghost` mientras hay jugadas, `primary` al terminar).

**Caída.** Marcador `xl` bold en `accent`, la frase que cae (`xxl` bold centrada), fichas de respuesta de alto mínimo 96, radio `lg`, con borde inferior `depth.sm` y sombra `card`. Una línea de piso de 4 px en `riskStrong`. Pantalla final con el resultado a 64 px en `accent`, una tarjeta de resumen (`correct` y `wrong`) y una nota `xs`.

**Detalle · v5.0.** Sin tarjeta anidada y sin marco de iniciales. Con imagen, va a sangre arriba (alto 0.66 del ancho, radio `lg` solo abajo) con parallax de 0.3 y un zoom 1.06 → 1 al entrar; sin imagen no se reserva lugar y la pantalla arranca con la frase. La flecha de atrás flota arriba a la izquierda y no hay estrella arriba: **Guardar** es el botón `primary` fijo abajo (footer), «Guardada» en `secondary` con `star-filled` en `star` cuando ya lo está, y el botón arranca con el estado real de la base. Al guardar, la estrella hace 1 → 1.25 → 1 con resorte, un anillo dorado se expande una vez desde el ícono y hay un háptico ligero; al quitarla solo cambia el estado, y el cambio se anuncia al lector de pantalla. **El héroe** es la frase (`display` 34, letterSpacing negativo) con karaoke, su IPA en Charis SIL y la onda de la voz (`OndaVoz`) en reposo; Escuchar y Lento la encienden con los mismos tiempos de palabra que Estudio, y al sonar el español la onda pasa a `textMuted` para distinguir los dos idiomas sin otro color de marca. La traducción principal va en `xl` con su audio en español y, si hay `ipa_note`, un botón de texto «Cómo se pronuncia» la despliega (alto y opacidad en `lento`, ease-out). **Registro** es una escala de 5 pasos (Formal · Neutro · Informal · Muy informal · Solo con amigos): un indicador sale del primer paso y se desliza al actual con el resorte `rebote`, encendiendo los segmentos a su paso; el último paso, para la vulgaridad 2, va en `riskStrong` con `warning` y su texto. Nivel, «Puede pasar de moda» (solo las `efimera`) y el aviso de vulgaridad 1 van como chips a la derecha; la escala dice «Registro: muy informal, 4 de 5». **«Cuándo NO decirla»** conserva el ámbar (`riskWarnSoft`) con `warning` y un filo izquierdo de 3 px en `riskWarn`. «Otras formas de traducirla» solo sale si `spanish` es distinto de `spanish_main` una vez normalizado (`mismoTexto`: sin mayúsculas, acentos, puntuación ni espacios extra; la ñ cuenta), y lo mismo la «Versión sin groserías»; **«Dónde vive»** es una fila tocable (punto del mundo, nombre, bloque y chevron) que abre `WorldDetail`. Al llegar, la ficha aparece con un fundido y una escala 0.96 → 1 en `escena` (la transición compartida de Reanimated sigue siendo experimental y necesita build nativo) y luego entran escalonados la escala de registro (200 ms), «Cuándo NO decirla» (350 ms) y el contexto (500 ms). Con Reduce Motion no hay parallax, zoom, onda animada, anillo ni entrada: todo está ya en su lugar.

---

# Parte 2 · Reglas

Serán la ley para todo cambio futuro. Donde una regla choque con `docs/DISENO.md` o con el código actual, **mandan estas reglas**. `DESIGN-AUDIT.md` lista lo que hoy las incumple; cada código de abajo (COLOR-1, TIPO-2…) es el mismo que usa esa auditoría.

## COLOR

- **COLOR-1.** Máximo 3 colores de marca: primario (`contraste`), acento (`accent`) y neutro. Los de estado (correcto, error, advertencia) aparte y solo para estado. Los colores de mundo son una familia que va en chico (punto, etiqueta, barra fina, cubitos), nunca en fondos grandes.
- **COLOR-2.** Degradados, si existen, dentro de un mismo tono. Nunca entre colores no relacionados.
- **COLOR-3.** Cada color de marca (acento, primario y neutro) con escala de tonos (50–900), en `tokens.ts`; el audit la exige.
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

## MOVIMIENTO

- **MOT-1.** Ninguna duración, curva ni resorte fuera de `src/theme/motion.ts`. Nadie inventa su propia idea de "rápido".
- **MOT-2.** Todo tocable pasa por `Presionable`: escala 0.97 en `rapido`, o solo opacidad con Reduce Motion.
- **MOT-3.** Un solo momento héroe animado por pantalla. En Practicar es HOY (`ConsolaHoy`); en Progreso, el medidor de señal (`MedidorSenal`); en Estudio, la onda de la voz (`OndaVoz`, que no es un bucle: la mueve la posición del audio y solo mientras suena). La aurora y las portadas son ambiente. Como mucho 3 canvases de Skia en bucle a la vez por pantalla.
- **MOT-4.** Todo bucle se pausa fuera de pantalla, sin foco o con la app en segundo plano. Se decide en un solo lugar: `useSenalActiva` (foco + `AppState` + reducir movimiento) y `useReloj` con `visible`.
- **MOT-5.** Con reducir movimiento no hay bucles, inclinación, parallax ni marcador: todo queda en su estado final, un fotograma limpio y pulido.

## ANTI-LOOK-IA

- **IA-1.** Los emojis no se usan como íconos de interfaz. Íconos de un solo set y un solo grosor.
- **IA-2.** No todas las tarjetas iguales en tamaño y peso: variar según importancia.
- **IA-3.** Sombras discretas y consistentes; nada de sombras de colores. **Excepción:** la luz de la señal (aurora, onda, anillo y destello de `src/components/fx/`) es luz de escena, no sombra de color: vive detrás del contenido y no proyecta nada. Ningún archivo de `fx/` usa `shadowColor`.
