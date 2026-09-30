# Plan de listas, imágenes, medios y animaciones (prompt 5 de 6) — hecho

Aprobado («ok») y aplicado en `perf/serie-rendimiento`: 8 commits (`87e9ed6` listas, `807f9bc` expo-image,
`1326244` imágenes, `f73699a` audio, `acb8f75` animaciones, `5d3a48b` sombras, `67de61f` hojas, `6b7c0a3`
Pressable). Tabla antes/después: `docs/RENDIMIENTO.md`, «Después de listas, medios y animaciones».

## 0. Lo que falta y se corre fuera de aquí

1. **Voz:** `node scripts/muestras-audio.mjs` (5 pares para oír) y, si suenan bien,
   `node scripts/optimiza-audio.mjs --aplicar` donde están los MP3. Sin `--aplicar` solo reporta. Los originales van a
   `medios-originales/` (fuera de Git y del bundle).
2. **Imágenes:** `npm i --no-save sharp && node scripts/optimiza-imagenes.mjs` (reporta) y `--aplicar` si el ahorro
   vale la pena. Solo reemplaza una imagen si baja ≥ 5 %.
3. **FPS:** el recorrido de `RENDIMIENTO.md` → «Flashlight» en release en el Xiaomi.
4. **APK/AAB:** `./gradlew assembleRelease` y `bundleRelease` antes y después de los dos scripts de medios.

## 0.1 Lo que quedó igual y por qué

- **FlatList afinado, no FlashList/Legend List:** las listas largas son cuatro y ya estaban virtualizadas;
  `removeClippedSubviews` es el default en Android. Si una sigue bajo 55 FPS en el Xiaomi, se prueba FlashList v2 solo
  en esa.
- **Errores remonta la lista al cambiar de filtro** (`key`): a propósito, para que las primeras 8 entren escalonadas
  con la lista nueva. El scroll vuelve arriba porque la lista es otra; al navegar y volver se conserva.
- **Phrasal sin `getItemLayout`:** el encabezado es un párrafo de alto variable (cambia con el tamaño de letra), así
  que los offsets no serían exactos.
- **Frases sueltas sin precarga aparte:** el mazo ya monta las cartas de abajo con su imagen al mismo tamaño.
- **Mi mazo sigue con `itemLayoutAnimation`:** es el reacomodo con resorte al quitar una frase (se ve).
- **Acordeones que animan `height`** (GrupoPlegable, NotaPlegable, BloqueGramatica, Desatorar) y **el resaltado de
  Lecturas**: son transiciones cortas al tocar, no bucles; con transform no se puede empujar lo de abajo igual.
- **Karaoke:** el color por palabra ya va en el hilo de UI y Reanimated solo actualiza las 1–2 palabras que cambian;
  el muestreo de 50 ms corre solo mientras suena la frase.
- **BlurView** (barra de pestañas, muro, imagen desenfocada, encabezados): en Android sin `blurMethod` es un tinte
  translúcido, barato. **La hoja de consentimiento sigue en `Modal`** (cubre el encabezado y responde al botón atrás).

## 0.2 Propuestas que cambian cómo se ve (esperan tu OK)

1. **Practicar tiene 3 lienzos de Skia animando a la vez** cuando se ve la consola: aurora (ya a 20 fps), onda de HOY
   (60 fps) y portada héroe (60 fps). La regla es 2. Opciones: (a) la portada héroe queda quieta en su fotograma
   limpio mientras la consola está a la vista y se anima al bajar; (b) la onda a 30 fps (respira en 4 s: el cambio
   casi no se ve).
2. **ArcoSenal (Progreso)** redibuja a 60 fps un temblor de ±0.4°: a 30 fps.
3. **Sombra de las fichas de Colmena/Estudio (TileBuilder) y de Pares (FichaPar):** no son filas de lista, pero sobre
   tinta tampoco se ven; quitarlas.
4. Si Flashlight marca caídas en los acordeones o en el karaoke: acordeón que abre con fundido sin animar el alto;
   karaoke con dos capas de texto (una encima que se revela con `opacity`).

---

Diagnóstico original (antes del OK):

## 1. Cómo se mide y qué se pudo medir aquí

| Qué | Herramienta | Estado |
|---|---|---|
| FPS de UI y de JS al hacer scroll, abrir el lab de sonidos, animaciones | Flashlight (`flashlight measure`) o Perf Monitor en release, Xiaomi | **en el Xiaomi** |
| Caídas < 55 FPS y su causa | Flashlight + profiler de RN DevTools | **en el Xiaomi**; aquí se localizaron las causas probables leyendo el código |
| Peso de imágenes y audio | `du`, `ffprobe`, `sharp` | medido aquí (música y SFX); voz e imágenes no están en el contenedor (`assets/aud` y `assets/img` vacíos y `media.wero.app` bloqueado) |
| Peso del APK/AAB | `bundletool` / `eas build` | **en tu máquina** |
| Avisos de Reanimated y de listas (`VirtualizedList: You have a large list…`, `Reading from value during render`) | consola en dev | se revisa en el Xiaomi |

Por eso abajo no hay números de FPS: cada fila dice **dónde** se espera la caída y **por qué** según el código. Cuando
corras Flashlight me pasas el resultado y lo anoto en `RENDIMIENTO.md`.

Comando sugerido (release, Xiaomi, 3 corridas):

```sh
flashlight measure   # abre la app, haz el recorrido, y exporta el JSON
```

## 2. Diagnóstico por flujo

### Listas

| Dónde | Hoy | Riesgo de caída | Causa |
|---|---|---|---|
| Errores (`FlatList`) | `key={cat|orden}` en la lista | alto al cambiar filtro | remonta la lista completa y pierde el scroll |
| Errores, Atoradas, Mi mazo (filas) | cada fila es un `Card`: sin `memo`, `shadow.card` (elevation 7), `LinearGradient` de envoltura | medio en scroll rápido | sombra y gradiente por fila; en Android la elevación se pinta por fila |
| Mi mazo | `itemLayoutAnimation={REACOMODO}` en todas las filas | medio al borrar/reordenar | anima layout de la lista entera |
| Phrasal | `FlatList` sin `getItemLayout` | bajo–medio | alturas casi fijas: se puede dar `getItemLayout` |
| Niveles | ya tiene `getItemLayout` | — | — |
| Gramática, Lecturas, Explorar, WorldDetail | `ScrollView` + `map` | bajo | listas cortas o acordeones; no vale virtualizar |
| Pantallas en general | `Screen` pinta 2 `LinearGradient` de fondo | bajo | capa extra fija, no por fila |
| Pagers (Sonidos, Azar) | ya montan actual ±1 (Sonidos pone `View` vacíos al resto, Azar 3 cartas) | — | — |

No hay listas anidadas en la misma dirección.

**FlashList v2 / Legend List:** las listas largas son pocas (Errores, Atoradas, Mi mazo, Phrasal) y con filas de
alto conocido. Propongo **FlatList afinado** (`getItemLayout`, `windowSize`, `maxToRenderPerBatch`,
`removeClippedSubviews` en Android, filas `memo`) en vez de otra dependencia nativa. Si en el Xiaomi alguna sigue
bajo 55 FPS, entonces se prueba FlashList v2 solo en esa.

### Imágenes

- Ya todo usa `expo-image` (`MarcoImagen`, `SceneImage`, portada de `Card`, `Identidad`); no hay `Image` de RN.
- Falta en todas: `cachePolicy`, `recyclingKey`, `transition` corta, `placeholder`. Tampoco hay `prefetch`.
- `hayImagen()` hace un `File.exists` síncrono en **cada render**: se cachea por ruta.
- Tamaños: las imágenes son 640×640 WebP q80 (1200×400 mundos/juegos, 512×512 fon/wero, según
  `scripts/gemini.mjs`). En un marco 16:9 de ~900 px físicos no sobran píxeles, así que recomprimir gana poco. El
  script `scripts/optimiza-imagenes.mjs` (sharp, WebP q80, originales fuera del bundle) se hace igual, pero lo corres
  tú donde están las imágenes y reporta el ahorro; si es < 5 % no se reemplaza nada.

### Audio

| Tipo | Hoy | Propuesta | Ahorro esperado |
|---|---|---|---|
| Voz (≈6,344 MP3 de Polly) | MP3 mono 22,050 Hz, ~48 kbps | MP3 mono 22,050 Hz, **32 kbps** | ~−33 % |
| Música (`assets/music`, 706 KB) | MP3 128 kbps estéreo | MP3 **96 kbps** estéreo | −25 % |
| SFX (`assets/sfx`, 80 WAV, 1.92 MB) | WAV 44.1 kHz | WAV **22,050 Hz mono** | −50 %; se quedan en WAV porque MP3/AAC meten silencio al inicio (latencia) |

Muestras (te las mando aparte): 2 de música y 3 de SFX, antes y después.

| Muestra | Antes | Después |
|---|---|---|
| 1 · música app | 384,983 B | 288,750 B |
| 2 · música juegos | 321,035 B | 240,789 B |
| 3 · SFX success_h3_v1 | 30,036 B | 15,074 B |
| 4 · SFX match_1 | 8,248 B | 4,180 B |
| 5 · SFX fail_1 | 19,448 B | 9,780 B |

Las de **voz** no se pueden generar aquí (no están los MP3). En tu máquina:
`node scripts/muestras-audio.mjs` → escribe 5 pares (frase EN, frase ES, fonema, lectura, phrasal) en
`muestras-audio/`. Con tu OK a las dos cosas se hace `scripts/optimiza-audio.mjs` (mismos nombres y rutas).

### Animaciones

| Dónde | Hoy | Causa de caída probable | Arreglo (sin cambiar cómo se ve) |
|---|---|---|---|
| Barras de tiempo: `RoundTimer:101`, `RelojRonda:51`, `BarraTiempo:25`, `BotonMantener:60` | animan `width` cada cuadro | layout por cuadro | `scaleX` con `transformOrigin` izquierda |
| Acordeones: `GrupoPlegable:53`, `NotaPlegable:40`, `BloqueGramatica:66`, `Desatorar:99` | animan `height` | layout por cuadro, empuja lo de abajo | medir una vez y animar `height` solo al abrir/cerrar sigue siendo layout: propongo dejarlos (son eventos cortos, no loops) salvo que Flashlight marque caída |
| `TextoAcompanado:148` | alto del resaltado | layout por palabra | `scaleY`/`translateY` |
| `FraseKaraoke` | color de `Text` por palabra, alimentado por un `setInterval` de 50 ms en JS (`useVozEnVivo`) | JS a 20 Hz + un nodo por palabra | el progreso en un shared value y el color por `opacity` de una capa encima |
| `useReproductorCapitulo` | `setProgreso` cada 250 ms | re-render de la pantalla 4 veces por segundo | shared value para la barra; estado solo al cambiar de frase |
| `EarModeScreen:150` | `exiting` y opacidad animada en el mismo nodo | conflicto de layout animation + transform | envolver en un `View` |
| Practicar | 3 superficies de Skia animando a la vez (aurora 20 fps, `OndaSenal` 60, portada héroe 60) + grano estático | pasa del máximo de 2 | portada héroe a pausa fuera de pantalla; `OndaSenal` a 30 fps |
| Parallax por giroscopio | `withTiming` nuevo cada 50 ms | reinicia animación a 20 Hz | `withSpring` sobre el valor, o lectura directa en un worklet |
| `BotonSenal` (reflejo) | cada cuadro, sin pausa fuera de pantalla | trabajo invisible | gate con `useVisibilidad` y foco |
| `ArcoSenal` | redibuja a 60 fps por un temblor de ±0.4° | Skia a 60 fps para algo casi estático | rotación con `transform` o 20 fps |
| `AnilloActual` | loop sin pausa fuera de pantalla | trabajo invisible | gate de visibilidad/foco |
| `Hueso` (esqueleto) | `withRepeat` sin cancelar ni gate de foco | sigue al desmontar/sin foco | `cancelAnimation` al desmontar y pausa sin foco |
| Movimiento reducido | ya existe `useMovimientoReducido` | — | se revisa que apague aurora, parallax, reflejo y temblor |

Ninguno de estos cambia cómo se ve. Si en el Xiaomi alguno **sigue** bajo 55 FPS después, te propongo la versión
ligera y espero tu OK.

### Sombras y capas

- `FichaCaida`: `shadow.card` en fichas que se mueven cada cuadro.
- `TileBuilder`: sombra suave en cada ficha.
- `Card` en filas de listas (ver Listas).
- `MuroDesbloqueo`: `BlurView` + tarjeta `shadow.raised`.
- `BlurView` en `TabNavigator`, `MuroDesbloqueo`, `MarcoImagen` y encabezados: en Android sin `blurMethod` solo pinta un
  tinte translúcido (barato). No se cambia.

Arreglo: la sombra de las fichas que se mueven, pintada una vez en una capa estática (o un borde inferior que la imite);
`Card` con variante `plano` para filas (misma apariencia con el borde y fondo, sin elevación).

### Hojas y `Modal`

- Solo `HojaConsentimiento` usa `Modal` de RN (`statusBarTranslucent` sí, `navigationBarTranslucent` **no**).
- `HojaVeredicto`, `HojaPregunta` y `HojaPausa` son hojas de Reanimated dentro de la pantalla, cada una con su propia
  implementación.

Arreglo: `shared/ui/Hoja.tsx` (una sola implementación: fondo, subida, gesto y altura) y las cuatro hojas la usan;
`HojaConsentimiento` deja el `Modal`.

### Toques

No hay `Touchable*`; todo es `Presionable`/`Pressable`. Se revisa con un check que siga así.

## 3. Commits propuestos (con tu OK)

1. `perf: listas virtualizadas`
2. `perf: expo-image y tamaños`
3. `perf: imágenes recomprimidas` (solo si el script da > 5 %)
4. `perf: audio optimizado` (con tu OK a las muestras)
5. `perf: animaciones en hilo de UI`
6. `perf: sombras y capas`
7. `perf: hojas sin Modal`
8. `perf: Pressable`

Cada uno con typecheck, lint, `check:media`, `check:data` y `audit:diseno` en verde, y columna «DESPUÉS DE LISTAS,
MEDIOS Y ANIMACIONES» en `RENDIMIENTO.md`.
