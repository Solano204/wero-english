# Auditoría de diseño

Qué reglas de `DESIGN.md` incumple hoy el código y cómo se comporta en pantallas, texto, rendimiento y audio. **No se corrigió nada.**
Se regenera con `npm run audit:diseno` (análisis estático de 211 archivos de `src/` y `App.tsx`). Las reglas que dependen de juicio visual van en "Revisión manual".

<!-- PLAN:start -->
## Top 10

Orden: primero lo que se nota en los primeros 10 segundos (tipografía, jerarquía de Practicar, íconos) y lo que afecta la accesibilidad (contraste, áreas táctiles); a igual impacto, el de menor esfuerzo. **Esfuerzo:** S = un token o un archivo; M = varios archivos o un componente; L = toca muchas pantallas. Este bloque se escribe a mano y `npm run audit:diseno` lo conserva.

| # | regla | qué se arregla | archivos | esfuerzo | impacto |
|---|---|---|---|---|---|
| 1 | TIPO-2 | Cuerpo de 15 a 16 px: subir `font.size.md` (`text.body` y `bodyMuted` lo heredan y ya tienen line-height ×1.5); después pasar a 16 los 44 estilos de cuerpo que usan 13 o 12 | `src/theme/tokens.ts:305`, `typography.ts:29-40` (+120 usos) | S | alto |
| 2 | COLOR-4 | Contraste AA: aclarar `accentDeep`, `wrongDeep` y seis colores de mundo, o no usarlos sobre `contraste` y `surfaceHigh` (8 pares bajo 4.5) | `tokens.ts:68,86,100-106` | S | alto |
| 3 | MOV-1 | Áreas táctiles a 48 dp: `iconoRedondo` de 36 y 44, `AudioButton` `sm` 34 y `md` 44 (hoy dependen de un `hitSlop` que se solapa entre vecinos) y cuatro chips de 40 a 46 dp | `tokens.ts:233-237`, `AudioButton.tsx:99-100`, `TileBuilder.tsx:171`, `OnboardingScreen.tsx:482`, `LecturaScreen.tsx:313`, `SettingsScreen.tsx:417` | M | alto |
| 4 | ACC-3 + ACC-2 | Practicar: de 16 modos con el mismo peso a una acción principal ("lo que toca hoy"), 3 o 4 destacados y el resto plegado | `src/screens/extras/PracticeScreen.tsx` | M | alto |
| 5 | TIPO-1 | Fuente propia: cargar una familia para la interfaz y `CharisSIL` para IPA con `expo-font` (ya instalado); salir de Roboto en Android y de `monospace` | `App.tsx`, `typography.ts`, `tokens.ts:318`, `ErrorBoundary.tsx:81`, `AzarScreen.tsx:321`, `assets/fonts/` (nuevo) | M | alto |
| 6 | IA-1 + IA-1b | Íconos: un solo set (`react-native-svg` ya está instalado) en lugar de 15 líneas con emojis y 53 con glifos de texto (▶ ► ■ ✓ › →); ver IA-1 e IA-1b para la lista | `AudioButton.tsx`, `IconButton.tsx`, `TabNavigator.tsx`, `PronunciationScreen.tsx`, `ColmenaScreen.tsx`, `AzarScreen.tsx`, `GameEndScreen.tsx` y más | L | alto |
| 7 | IA-3 + ACC-1 | Quitar el `glow` cian de todo botón `primary`, y que el selector de niveles de Ajustes no pinte 3 botones `primary` a la vez | `Button.tsx:144-147`, `tokens.ts:277-283`, `SettingsScreen.tsx:96` | S | medio |
| 8 | TIPO-4 | `letterSpacing` de −1% a −2% en los 26 títulos de 28 px o más: `text.display` y `text.h1` primero; la lista completa está en TIPO-4 | `typography.ts:6-17`, `PhraseBlock.tsx:70`, `ExploreScreen.tsx:124`, `Card.tsx:219` | S | medio |
| 9 | TXT-1 + ACC-1 | Que no se corte lo importante y que la acción principal sea sólida: título y subtítulo del `Header` (títulos de lecturas), `EntryRow` compacta y `DulcesScreen`; y `secondary` a `primary` en `EmptyState` (11 usos), `DownloadsScreen` y `ErrorDetailScreen` | `Header.tsx:30,35`, `EntryRow.tsx:110,115`, `DulcesScreen.tsx:593`, `EmptyState.tsx:25`, `DownloadsScreen.tsx:134`, `ErrorDetailScreen.tsx:90` | S | medio |
| 10 | EST-error + RND-1 + AUD-1 | Robustez: estado de error en 19 pantallas que leen la base (y de carga en 13); `ErrorsScreen` (194 tarjetas) y `PronunciationScreen` (53) a `FlatList`; regenerar el audio vacío `aud/phrasal/5_ejemplo_en_lento.mp3` | `ErrorsScreen.tsx:76`, `PronunciationScreen.tsx:190`, tabla de la sección a) | M | medio |

**Hecho en la fase B:** 1 (TIPO-2), 2 (COLOR-4), 3 (MOV-1), 4 (ACC-3: de 16 a 7 opciones visibles, y ACC-2 con Hoy como única superficie destacada), 5 (TIPO-1), 6 (IA-1 e IA-1b: íconos de Phosphor por `Icon`), 7 (IA-3 y ACC-1), 8 (TIPO-4) y 9 (TXT-1 y ACC-1). Excepciones: el subtítulo del `Header` queda en 1 línea por decisión y `DownloadsScreen` se queda `secondary` porque son 16 botones iguales. `npm run check:color` cuida que no vuelvan los colores sueltos y `npm run check:practicar` prueba la lógica de Hoy.

**Practicar 5.0 (señal en vivo):** aurora, onda, anillo, marcador, portadas de Skia, inclinación 3D, barra líquida y encabezado comprimido, todo en `src/components/fx/`. Reglas nuevas: MOT-3 (un momento héroe y como mucho 3 canvases en bucle), MOT-4 (los bucles se pausan fuera de pantalla, sin foco o en segundo plano) y MOT-5 (reducir movimiento deja todo en su estado final), más la excepción de IA-3 para la luz de escena. `npm run check:color` vigila que `senal` siga en un solo tono y que ningún shader traiga colores escritos a mano.
<!-- PLAN:end -->

## Conteo por regla

| Regla | Qué mide | Hallazgos |
|---|---|---|
| COLOR-1 | colores de mundo que tiñen fondos grandes (portadas tintadas y rellenos), salvo las piezas de Dulces | 0 |
| COLOR-3 | colores de marca (acento, primario, neutro) sin escala 50–900 | 0 |
| COLOR-4 | pares texto/superficie bajo AA | 0 |
| TIPO-1 | familias: fuente del sistema, `CharisSIL` sin cargar, `monospace` | 0 |
| TIPO-2 | cuerpo < 16 px (estilos de cuerpo en 15, 13 o 12, salvo los descartados a mano) | 0 |
| TIPO-2b | line-height del cuerpo fuera de 1.4–1.6 | 1 |
| TIPO-4 | títulos ≥ 28 px sin letterSpacing negativo | 0 |
| ESP-1 | espaciado fuera de 4/8 | 0 |
| ACC-1 | acción principal no sólida o varios sólidos a la vez | 0 |
| ACC-3 | opciones visibles en Practicar con los grupos plegados (máximo recomendado 7) | 7 |
| MOV-1 | áreas táctiles < 48 dp (estilos + tokens) | 0 |
| IA-1 | líneas con emojis | 0 |
| IA-1b | líneas con glifos de texto como íconos | 0 |
| IA-3 | sombras de color o fuera de tokens | 0 |
| EST-carga | pantallas que cargan datos sin estado de carga | 0 |
| EST-vacio | pantallas que cargan datos sin estado vacío | 5 |
| EST-error | pantallas que cargan datos sin estado de error | 0 |
| TXT-1 | texto de contenido cortado con `numberOfLines={1}` | 1 |
| RND-1 | listas sin `keyExtractor` estable, con ítem sin `memo` o con separador inline | 0 |
| RND-2 | hooks con dependencias que cambian en cada render | 0 |
| RND-3 | estado por intervalo, cuadro o scroll que repinta toda la pantalla | 0 |
| AUD-1 | audios de los JSON que no están en el bundle o están vacíos | 1 |
| MOT-1 | duraciones, curvas y springs fuera de `motion.ts` (salvo los relojes revisados) | 0 |
| MOT-2 | tocables sin el feedback al presionar (`Presionable`) | 0 |
| MOT-3 | más de un momento héroe animado por pantalla, o más de 3 canvases de Skia en bucle | 0 |
| MOT-4 | bucles de la señal que no se pausan fuera de pantalla, sin foco o en segundo plano | 0 |
| MOT-5 | efectos de la señal que no respetan reducir movimiento | 0 |

# Auditoría estática

## COLOR

**COLOR-1 · Máximo 3 colores de marca: primario (`contraste`), acento (`accent`) y neutro.** Los ocho colores de mundo son una familia (misma luminosidad y saturación, solo cambia el tono) y van en chico: un punto, una etiqueta, una barra fina y el tinte de los cubitos. Solo cuentan como marca si tiñen fondos grandes. Portadas tintadas en `gradiente` (0) y `backgroundColor: color.world…` fuera del tema:
- (ninguno)

**Excepción revisada a mano (no cuenta):**
- `src/screens/games/DulcesScreen.tsx:668` — las 5 piezas del tablero (`TINTES`) son contenido de juego, no marca: necesitan cinco colores distintos para poder jugarse
- `src/screens/games/DulcesScreen.tsx:669` — las 5 piezas del tablero (`TINTES`) son contenido de juego, no marca: necesitan cinco colores distintos para poder jugarse
- `src/screens/games/DulcesScreen.tsx:670` — las 5 piezas del tablero (`TINTES`) son contenido de juego, no marca: necesitan cinco colores distintos para poder jugarse
- `src/screens/games/DulcesScreen.tsx:671` — las 5 piezas del tablero (`TINTES`) son contenido de juego, no marca: necesitan cinco colores distintos para poder jugarse
- `src/screens/games/DulcesScreen.tsx:672` — las 5 piezas del tablero (`TINTES`) son contenido de juego, no marca: necesitan cinco colores distintos para poder jugarse

**COLOR-2 · Degradados dentro de un mismo tono.** Las portadas usan un solo degradado neutro (`gradiente.neutro`). El degradado de la señal (`senal`) va de `accent900` a `accent100`, sin hex nuevos, y `npm run check:color` verifica que sus tres pasos no se separen más de 8° de tono. Para revisar: `filoLuz` mezcla blanco y cian, y `FONDO`. Usos de `<LinearGradient`:
- `src/components/base/Card.tsx:126`
- `src/components/base/Card.tsx:162`
- `src/components/base/Screen.tsx:117`
- `src/components/base/Screen.tsx:131`
- `src/components/card/OptionButton.tsx:134`
- `src/components/card/SceneImage.tsx:71`
- `src/components/card/SceneImage.tsx:84`
- `src/components/fx/BarraSesion.tsx:103`
- `src/components/fx/BarraSesion.tsx:111`
- `src/components/fx/BotonSenal.tsx:84`
- `src/components/fx/HojaVeredicto.tsx:171`
- `src/components/fx/MedidorVU.tsx:99`
- `src/components/fx/OndaSenal.tsx:53`
- `src/components/fx/OndaVoz.tsx:119`
- `src/components/fx/PortadaJuego.tsx:93`
- `src/components/unlock/MuroDesbloqueo.tsx:76`
- `src/navigation/TabNavigator.tsx:122`
- `src/screens/extras/practicar/ConsolaHoy.tsx:98`
- `src/screens/extras/practicar/Destacados.tsx:73`
- `src/screens/extras/practicar/FilaModo.tsx:92`

**COLOR-3 · Cada color de marca con escala 50–900.** Se exige a `accent`, `contraste` (primario) y `neutral`, con los diez pasos en `tokens.ts`. Sin escala completa: ninguno. Los colores de estado y los de mundo no llevan escala.

**COLOR-4 · Contraste AA (4.5:1).** Pares texto/superficie que fallan (calculados de los tokens):
- (ninguno)

`text` sobre `accent` da 1.47: usar siempre `onAccent`.

## TIPOGRAFÍA

**TIPO-1 · Máximo 2 familias; prohibidas Inter, Roboto, Arial y Space Grotesk como default.** Familias de `font.family` (`tokens.ts`), cargadas en `App.tsx` con `useFonts` (`src/theme/fuentes.ts`): Bricolage Grotesque (títulos), Instrument Sans (cuerpo) y Charis SIL (IPA). Un `fontFamily` que no salga de `font.family`, o un texto sin familia, cae a la fuente del sistema (en Android, **Roboto**). Ocurrencias fuera de `font.family`:
- (ninguno)

**TIPO-2 · Cuerpo de 16 px mínimo.** El token de cuerpo `font.size.md` vale **16** (`tokens.ts`) y `text.body` y `text.bodyMuted` lo usan. Estilos de cuerpo o descripción por debajo de 16 px (0):
- (ninguno)

Se quedan en 12–13 px, revisados a mano (19):
- `src/components/base/Ads.tsx:186` — fullNota: fontSize sm = 13 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/components/fx/Espectrograma.tsx:273` — etiquetaTexto: fontSize sm = 13 — etiqueta flotante de una línea con el dato del día que se toca: metadato, no lo que se estudia
- `src/components/fx/Espectrograma.tsx:286` — hoyTexto: fontSize xs = 12 — etiqueta de una línea (metadato o chip)
- `src/components/fx/Espectrograma.tsx:288` — listaTexto: fontSize sm = 13 — texto alternativo de la gráfica: una línea por día, información secundaria
- `src/components/list/EntryRow.tsx:145` — verTexto: fontSize sm = 13 — etiqueta de un botón de texto: lo que se toca es el contenedor
- `src/screens/entry/OnboardingScreen.tsx:470` — nota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/screens/entry/OnboardingScreen.tsx:492` — chipTexto: fontSize sm = 13 — etiqueta de una línea (metadato o chip)
- `src/screens/extras/LecturaScreen.tsx:310` — leyendaTexto: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/screens/extras/LecturasScreen.tsx:236` — difTexto: fontSize xs = 12 — etiqueta de una línea (metadato o chip)
- `src/screens/games/CaidaScreen.tsx:642` — finNota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/screens/games/CaidaScreen.tsx:688` — siguienteTexto: fontSize sm = 13 — etiqueta de un botón de texto: lo que se toca es el contenedor
- `src/screens/games/ColmenaScreen.tsx:610` — nota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/screens/games/DulcesScreen.tsx:688` — metaFrase: fontSize xs = 12 — etiqueta de una línea (metadato o chip)
- `src/screens/games/DulcesScreen.tsx:711` — pieNota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/screens/games/DulcesScreen.tsx:754` — seguirTexto: fontSize sm = 13 — etiqueta de un botón de texto: lo que se toca es el contenedor
- `src/screens/games/GameEndScreen.tsx:249` — estrellasNota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/screens/games/GameEndScreen.tsx:255` — repasoNota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/screens/games/ParesScreen.tsx:465` — saltarTexto: fontSize sm = 13 — etiqueta de un botón de texto: lo que se toca es el contenedor
- `src/screens/utility/SettingsScreen.tsx:426` — horaTexto: fontSize sm = 13 — etiqueta de una línea (metadato o chip)

Otros `fontSize` < 16 por archivo (etiquetas y secundarios; revisar cuáles son cuerpo): `src/screens/extras/PronunciationScreen.tsx` 8, `src/screens/extras/ContractionsScreen.tsx` 5, `src/components/base/Input.tsx` 4, `src/screens/extras/LecturasScreen.tsx` 4, `src/screens/extras/MinimalPairsScreen.tsx` 4, `src/screens/games/CazalaScreen.tsx` 4, `src/screens/games/NivelesScreen.tsx` 4, `src/screens/utility/DiagnosticsScreen.tsx` 4, `src/screens/utility/DownloadsScreen.tsx` 4, `src/components/fx/Espectrograma.tsx` 3, `src/screens/entry/AuthScreen.tsx` 3, `src/screens/entry/OnboardingScreen.tsx` 3, `src/screens/extras/AzarScreen.tsx` 3, `src/screens/extras/ErrorDetailScreen.tsx` 3, `src/screens/extras/PhrasalScreen.tsx` 3, `src/screens/games/DulcesScreen.tsx` 3, `src/screens/games/ParesScreen.tsx` 3, `src/components/base/Ads.tsx` 2, `src/components/base/Badge.tsx` 2, `src/components/card/TileBuilder.tsx` 2, `src/components/fx/HojaVeredicto.tsx` 2, `src/components/list/SectionTitle.tsx` 2, `src/screens/discover/DetailScreen.tsx` 2, `src/screens/discover/WorldDetailScreen.tsx` 2, `src/screens/extras/EarModeScreen.tsx` 2, `src/screens/extras/ErrorsScreen.tsx` 2, `src/screens/extras/GramaticaScreen.tsx` 2, `src/screens/extras/GramaticaTemaScreen.tsx` 2, `src/screens/games/CaidaScreen.tsx` 2, `src/screens/games/ColmenaScreen.tsx` 2, `src/components/base/ErrorBoundary.tsx` 1, `src/components/base/Header.tsx` 1, `src/components/card/AudioButton.tsx` 1, `src/components/card/BloqueVoz.tsx` 1, `src/components/card/DiffFrase.tsx` 1, `src/components/card/ReproductorCapitulo.tsx` 1, `src/components/card/StudyCardView.tsx` 1, `src/components/fx/ChipMarcador.tsx` 1, `src/components/progreso/CuadroDato.tsx` 1, `src/components/progreso/FichaJuego.tsx` 1, `src/components/progreso/FilaMundo.tsx` 1, `src/components/progreso/PanelSenal.tsx` 1, `src/components/unlock/CandadoBadge.tsx` 1, `src/components/unlock/MuroDesbloqueo.tsx` 1, `src/navigation/TabNavigator.tsx` 1, `src/screens/discover/ExploreScreen.tsx` 1, `src/screens/entry/BootScreen.tsx` 1, `src/screens/extras/practicar/ConsolaHoy.tsx` 1, `src/screens/extras/practicar/Destacados.tsx` 1, `src/screens/extras/practicar/FilaModo.tsx` 1, `src/screens/extras/practicar/MetaModo.tsx` 1, `src/screens/games/GameEndScreen.tsx` 1, `src/screens/utility/ProgressScreen.tsx` 1, `src/screens/utility/SettingsScreen.tsx` 1, `src/screens/utility/StuckScreen.tsx` 1.

**TIPO-2b · Line-height del cuerpo entre 1.4 y 1.6** (texto de 18 px o menos):
- `src/screens/extras/GramaticaTemaScreen.tsx:345` — en: 18 px con lineHeight x1.35

**TIPO-4 · Títulos ≥ 28 px con letterSpacing de −1% a −2%:**
- (ninguno)

Descartados (28 px o más, pero no son títulos):
- `src/components/base/Card.tsx:220` — portadaVacia: inicial suelta de una portada pendiente (`textSobrePortada`), no un título
- `src/components/card/SceneImage.tsx:124` — inicial: inicial suelta de una imagen pendiente (`textSobrePortada`), no un título

## ESPACIADO

**ESP-1 · Escala 4/8 (4, 8, 12, 16, 24, 32, 48).** Los tokens `space` (`tokens.ts:214-222`) coinciden con la escala. Las violaciones son valores sueltos o sumas. Excepciones válidas, que no cuentan: `padding: 1` (el filo de luz), los bordes de 1 a 2 px (`borderWidth`, que no son espaciado y el audit no mira) y los márgenes negativos de hasta 2 px que compensan un borde.
- (ninguno)

**Excepciones revisadas (no cuentan):**
- `src/components/base/Card.tsx:194` — filo: padding 1, el filo de luz (una envoltura de 1 px que hace de borde)
- `src/components/fx/HojaVeredicto.tsx:220` — filo: padding 1, el filo de luz (una envoltura de 1 px que hace de borde)
- `src/components/unlock/MuroDesbloqueo.tsx:126` — filo: padding 1, el filo de luz (una envoltura de 1 px que hace de borde)
- `src/navigation/TabNavigator.tsx:231` — filo: padding 1, el filo de luz (una envoltura de 1 px que hace de borde)
- `src/screens/extras/practicar/Destacados.tsx:169` — filo: padding 1, el filo de luz (una envoltura de 1 px que hace de borde)

## JERARQUÍA Y ACCIÓN

**ACC-1 · Una sola acción principal, botón sólido de alto contraste.** `Button` tiene 4 variantes: `primary` (cian sólido), `secondary` (con borde), `ghost` y `danger` (`Button.tsx:143-158`). Revisado leyendo cada render, **los hallazgos reales son:**
- (ninguno)


Descartados tras leer el render (no son hallazgo):
- `src/screens/extras/LecturaScreen.tsx` — la vista de preguntas y la de lectura son excluyentes (`enPreguntas`)
- `src/screens/games/CazalaScreen.tsx` — `checked ? Siguiente : Revisar`
- `src/screens/games/GameEndScreen.tsx` — `nivel ? Nivel siguiente (primary) + Recoger (secondary) : Recoger (primary)`: nunca hay dos
- `src/screens/utility/DownloadsScreen.tsx` — lista de 16 packs con la misma acción "descargar": ninguna es la principal y 16 `primary` romperían "una sola acción sólida"; se queda `secondary`
- `src/screens/entry/OnboardingScreen.tsx` — un paso a la vez (`paso === N`); en el último, "Permitir y empezar" y "Entrar a la app" son excluyentes

**ACC-3 · Menos opciones (Ley de Hick).** `PracticeScreen` (la pestaña de inicio) muestra **7 opciones** con los grupos plegados: 1 acción de HOY + 3 destacados + 3 grupos, que guardan el resto de los 17 destinos. Máximo recomendado 7.

## MÓVIL

**MOV-1 · Área táctil mínima 48×48 dp.** Por debajo, en tokens y componentes:
- (ninguno)

Estilos interactivos con alto menor a 48 (verificar si llevan `hitSlop`):
- (ninguno)

## ANTI-LOOK-IA

**IA-1 · Los emojis no son íconos de interfaz.** `docs/DISENO.md` (§ "Los emojis se quitaron") dice que salieron de toda la app; siguen en:
- (ninguno)

**IA-1b · Íconos de un solo set y un solo grosor.** Glifos de texto (▶ ► ■ ✓ ✕ › → ☆…) usados como íconos, mezclados con emojis y con `IconButton`:
- (ninguno)

**IA-3 · Sombras discretas y consistentes; ninguna de color.** El halo cian (`glow`) se eliminó: `primary` usa `shadow.soft` (negra) y la barra de pestañas usa `shadow.card`. `shadow.card` (opacidad 0.55, radio 20) y `shadow.raised` (0.7, radio 32) no son discretas. Sombras definidas fuera de los tokens:
- (ninguno)

**Excepción (v5.0):** la luz de la señal (aurora, onda, anillo y destello de `src/components/fx/`) es luz de escena, no sombra de color. El audit solo exige que ningún archivo de `fx/` use `shadowColor`:
- (ninguno)


## Revisión manual (no se puede medir estáticamente)

- **TIPO-3** jerarquía con tamaño y peso, no solo color; **TIPO-5** no mezclar alineaciones en un bloque.
- **ESP-2** proximidad (lo que va junto, cerca; entre secciones, el doble).
- **ACC-2** una sola cosa destacada por pantalla: en Practicar es HOY (`ConsolaHoy`, la única superficie `contraste`). Las portadas animadas de los destacados y la aurora son ambiente, no un segundo momento héroe (MOT-3).
- **MOV-2** acciones frecuentes en la mitad inferior: en los juegos "Saltar" vive en el `right` del `Header` (arriba a la derecha).
- **MOV-3** barra inferior: flota (`TabNavigator.tsx`, estilo `bar`) sobre un `BlurView` con filo y una píldora líquida; tiene fondo propio, así que cumple, pero no va pegada al borde.
- **MOV-4** padding que empuja el contenido: revisar en dispositivo.
- **IA-2** tarjetas de distinto tamaño y peso: en Practicar los destacados son una héroe a todo el ancho (180) y dos compactas (150); `Card` sigue siendo una sola pieza con filo y sombra `card` en el resto de la app.

# Auditoría de comportamiento

## a) Estados: carga, vacío y error

Pantallas de `src/screens/` que leen de la base (`@/db/`). Cada celda apunta a la primera línea que evidencia el estado; ✗ es que no se detectó ninguno. La detección busca nombres de estado (`loading`, `cargando`, `useCarga`, `<Carga>`, `ErrorCarga`, `EmptyState`, `.length === 0`, `.catch`, `setError`), así que un estado con otro nombre saldría ✗ y hay que confirmarlo.

| pantalla (archivo) | carga | vacío | error |
|---|---|---|---|
| `discover/DetailScreen.tsx` | ✓ `:42` | ✓ `:59` | ✓ `:57` |
| `discover/ExploreScreen.tsx` | ✓ `:27` | ✓ `:65` | ✓ `:79` |
| `discover/PackDetailScreen.tsx` | ✓ `:35` | ✗ | ✓ `:61` |
| `discover/WorldDetailScreen.tsx` | ✓ `:29` | ✗ | ✓ `:52` |
| `entry/BootScreen.tsx` | ✓ `:88` | ✓ `:37` | ✓ `:25` |
| `extras/AzarScreen.tsx` | ✓ `:73` | ✓ `:206` | ✓ `:197` |
| `extras/ContractionsScreen.tsx` | ✓ `:34` | ✓ `:45` | ✓ `:92` |
| `extras/EarModeScreen.tsx` | ✓ `:93` | ✓ `:202` | ✓ `:185` |
| `extras/LecturaScreen.tsx` | ✓ `:55` | ✓ `:131` | ✓ `:145` |
| `extras/LecturasScreen.tsx` | ✓ `:49` | ✓ `:75` | ✓ `:94` |
| `extras/PracticeScreen.tsx` | ✓ `:98` | ✗ | ✓ `:167` |
| `games/CaidaScreen.tsx` | ✓ `:159` | ✓ `:365` | ✓ `:345` |
| `games/CazalaScreen.tsx` | ✓ `:72` | ✓ `:141` | ✓ `:185` |
| `games/ColmenaScreen.tsx` | ✓ `:113` | ✓ `:299` | ✓ `:279` |
| `games/DulcesScreen.tsx` | ✓ `:146` | ✓ `:471` | ✓ `:451` |
| `games/NivelesScreen.tsx` | ✓ `:56` | ✗ | ✓ `:139` |
| `games/ParesScreen.tsx` | ✓ `:111` | ✓ `:287` | ✓ `:263` |
| `utility/DeckScreen.tsx` | ✓ `:22` | ✓ `:25` | ✓ `:39` |
| `utility/DiagnosticsScreen.tsx` | ✓ `:31` | ✗ | ✓ `:61` |
| `utility/ProgressScreen.tsx` | ✓ `:71` | ✓ `:96` | ✓ `:113` |
| `utility/StuckScreen.tsx` | ✓ `:26` | ✓ `:29` | ✓ `:37` |

Sin carga: 0 de 21 · sin vacío: 5 · sin error: 0.

## b) Texto cortado

`numberOfLines={1}` en texto cuyo contenido importa (frases, traducciones, títulos, nombres). Se corta con "…" y el usuario no puede leer el resto:
- `src/components/base/Header.tsx:35` — `{subtitle}`

Otros 3 `numberOfLines={1}` en etiquetas, contadores y similares no se listan.

## c) Rendimiento

**Listas:** `FlatList` o `SectionList` sin `keyExtractor`, con clave por índice, con el ítem sin `memo` o con el separador creado en cada render, y colecciones grandes pintadas con `.map` dentro de un `ScrollView`:
- (ninguno)

**Dependencias que cambian en cada render** (el efecto o el callback se vuelve a disparar sin necesidad, como pasaba con `grupos` en `ContractionsScreen`):
- (ninguno)

**Estado que se actualiza por intervalo, cuadro o scroll** (`setInterval`, `requestAnimationFrame`, `onScroll` con `setState`; solo el de una pantalla cuenta como hallazgo, el de un componente hoja es informativo):
- `src/components/card/ReproductorCapitulo.tsx:54` — `setInterval` cada 250 ms con `setState`: repinta un componente hoja

**Solo informativo (no cuenta):** claves por índice en listas estáticas, que solo importan si la lista se reordena o se filtra:
- `src/components/base/Skeleton.tsx:63` — key por índice
- `src/components/card/FilaEstrellas.tsx:22` — key por índice
- `src/components/feedback/Confetti.tsx:39` — key por índice
- `src/components/fx/PortadaJuego.tsx:161` — key por índice
- `src/screens/entry/OnboardingScreen.tsx:291` — key por índice
- `src/screens/extras/GramaticaTemaScreen.tsx:177` — key por índice
- `src/screens/extras/GramaticaTemaScreen.tsx:290` — key por índice
- `src/screens/extras/GramaticaTemaScreen.tsx:292` — key por índice

Pantallas con más de 8 `useState` (cualquier cambio repinta la pantalla; no es un bug por sí solo, pero es donde mirar si hay tirones): `games/CaidaScreen.tsx` 11, `games/ColmenaScreen.tsx` 12, `games/DulcesScreen.tsx` 11, `games/ParesScreen.tsx` 9.

## d) Audio

Los botones de audio no desaparecen cuando falta el archivo: `AudioButton` se pinta **apagado** (opacidad 0.4, deshabilitado) si la ruta no está empaquetada ni descargada (`hayAudio`, `AudioButton.tsx`). Rutas de audio que los JSON de `assets/data/` piden y **no están en `bundled.ts`** (1 de 6344):

| grupo | pedidas | sin empaquetar |
|---|---|---|
| `aud/phrasal` | 1242 | 1 (ej. `aud/phrasal/5_ejemplo_en_lento.mp3`) |
| `aud` | 3048 | 0 |
| `aud/rules` | 300 | 0 |
| `aud/caza` | 60 | 0 |
| `aud/err` | 216 | 0 |
| `aud/fon` | 574 | 0 |
| `aud/reg` | 75 | 0 |
| `aud/gram` | 800 | 0 |
| `aud/lec` | 29 | 0 |

**Audios vacíos** (empaquetados, pero de menos de 1000 bytes: `isBundled` dice que existen, así que su botón se pinta **activo** y falla en silencio):
- (ninguno)

Archivos que pintan `<AudioButton>`: `screens/extras/PhrasalScreen.tsx` 6, `screens/extras/GramaticaTemaScreen.tsx` 5, `components/list/EntryRow.tsx` 4, `components/card/BloqueVoz.tsx` 3, `components/card/PhraseBlock.tsx` 3, `screens/extras/PronunciationScreen.tsx` 3, `screens/games/CazalaScreen.tsx` 3, `screens/extras/ContractionsScreen.tsx` 2, `screens/extras/ErrorDetailScreen.tsx` 2, `screens/extras/MinimalPairsScreen.tsx` 1, `screens/games/DulcesScreen.tsx` 1.

## e) Movimiento

**MOT-1 · Nada de movimiento fuera de `src/theme/motion.ts`.** Cuenta duraciones y retrasos numéricos, `Easing.*`, springs sin preset, `springify` y las APIs de animación de React Native:
- (ninguno)

**Excepciones revisadas a mano (no cuentan):**
- `src/components/base/RoundTimer.tsx:76` — reloj de la ronda: la barra baja a ritmo constante durante los segundos que dura la ronda
- `src/screens/games/CaidaScreen.tsx:250` — reloj de la ronda: la ficha cae a velocidad constante y su duración es la de la ronda

**MOT-2 · Todo tocable pasa por `Presionable`** (escala 0.97 en `rapido`; con Reduce Motion baja la opacidad). Cuenta `Pressable`, `AnimatedPressable` y `Touchable*` sueltos:
- (ninguno)

**MOT-3 · Un solo momento héroe animado por pantalla** (en Practicar es HOY, `ConsolaHoy`) **y como máximo 3 canvases de Skia en bucle a la vez.** Archivos con canvas en bucle (4): `FondoAurora.tsx`, `MedidorSenal.tsx`, `OndaSenal.tsx`, `PortadaJuego.tsx`. Hallazgos:
- (ninguno)

**MOT-4 · Todo bucle se pausa fuera de pantalla, sin foco o en segundo plano.** Los efectos de la señal consultan `useSenalActiva` (foco + AppState + reducir movimiento) y `useReloj` se detiene con `visible`. Bucles que no lo hacen:
- (ninguno)

**MOT-5 · Con reducir movimiento no hay bucles, tilt, parallax ni marcador; todo queda en su estado final.** Archivos de la señal que animan sin consultar `useMovimientoReducido` ni `useSenalActiva`:
- (ninguno)

**Excepciones revisadas a mano (no cuentan):**
- `src/components/fx/TransicionHoy.tsx:40` — solo se monta si `ConsolaHoy` la pide, y `ConsolaHoy` no la pide con reducir movimiento
- `src/screens/extras/practicar/Destacados.tsx:63` — `entering` de Reanimated: salta al valor final con reducir movimiento (`ReduceMotion.System`)

## Notas

- Los íconos salen de `Icon` (Phosphor). Quedan flechas y marcas (← → ✓ ✗) como contenido en `catalogo.json`, `gramatica.json` y `medios.json`: son notación de las lecciones, no íconos de interfaz, y el audit no las cuenta.
- `padding: 1` (Card, FeedbackBand, MuroDesbloqueo, TabNavigator) es la técnica del filo de luz y no se cuenta en ESP-1.
- `impeccable detect src` devolvió 0 hallazgos; sus patrones son de HTML y CSS, así que ese 0 no dice nada de esta app.
- Los bucles anteriores a la v5.0 (`Skeleton` mientras carga, el respiro de `EarModeScreen`) quedan fuera de MOT-4 y MOT-5: MOT-3 a MOT-5 se miden sobre la señal (`src/components/fx/`, Practicar y la barra de pestañas).
- Los conteos salen de análisis estático: resuelve expresiones con los tokens `space` y `font.size`, no valores calculados en ejecución.

<!-- conteos: {"COLOR-1":0,"COLOR-3":0,"COLOR-4":0,"TIPO-1":0,"TIPO-2":0,"TIPO-2b":1,"TIPO-4":0,"ESP-1":0,"ACC-1":0,"ACC-3":7,"MOV-1":0,"IA-1":0,"IA-1b":0,"IA-3":0,"EST-carga":0,"EST-vacio":5,"EST-error":0,"TXT-1":1,"RND-1":0,"RND-2":0,"RND-3":0,"AUD-1":1,"MOT-1":0,"MOT-2":0,"MOT-3":0,"MOT-4":0,"MOT-5":0} -->
