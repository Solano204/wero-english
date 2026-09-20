# Auditoría de diseño

Qué reglas de `DESIGN.md` incumple hoy el código y cómo se comporta en pantallas, texto, rendimiento y audio. **No se corrigió nada.**
Se regenera con `npm run audit:diseno` (análisis estático de 158 archivos de `src/` y `App.tsx`). Las reglas que dependen de juicio visual van en "Revisión manual".

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
<!-- PLAN:end -->

## Conteo por regla

| Regla | Qué mide | Hallazgos |
|---|---|---|
| COLOR-1 | colores de marca de más (mundos + `contraste`) | 9 |
| COLOR-3 | colores sin escala 50–900 | 1 |
| COLOR-4 | pares texto/superficie bajo AA | 0 |
| TIPO-1 | familias: fuente del sistema, `CharisSIL` sin cargar, `monospace` | 0 |
| TIPO-2 | cuerpo < 16 px (estilos de cuerpo en 15, 13 o 12, salvo los descartados a mano) | 0 |
| TIPO-2b | line-height del cuerpo fuera de 1.4–1.6 | 1 |
| TIPO-4 | títulos ≥ 28 px sin letterSpacing negativo | 0 |
| ESP-1 | espaciado fuera de 4/8 | 30 |
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
| MOT-1 | duraciones, curvas y springs fuera de `motion.ts` (salvo los relojes revisados) | 10 |
| MOT-2 | tocables sin el feedback al presionar (`Presionable`) | 0 |

# Auditoría estática

## COLOR

**COLOR-1 · Máximo 3 colores de marca.** Hoy hay: acento cian `accent` (`src/theme/tokens.ts:66`), superficie `contraste` (`:75`) y una paleta de **8 colores de mundo** (`:99-108`) usada como color de categoría en tarjetas y chips. Aparte, `riskStrong` (`:92`), el rojo de lenguaje explícito.

**COLOR-2 · Degradados dentro de un mismo tono.** Los `gradiente` por mundo (`tokens.ts:194-212`) son de un solo tono. Para revisar: `filoLuz` (`:165-169`) mezcla blanco y cian, y `FONDO` (`:149`). Usos de `<LinearGradient`:
- `src/components/base/Card.tsx:126`
- `src/components/base/Card.tsx:162`
- `src/components/base/Screen.tsx:72`
- `src/components/base/Screen.tsx:86`
- `src/components/card/FeedbackBand.tsx:115`
- `src/components/card/SceneImage.tsx:73`
- `src/components/card/SceneImage.tsx:86`
- `src/components/unlock/MuroDesbloqueo.tsx:76`
- `src/navigation/TabNavigator.tsx:94`

**COLOR-3 · Cada color con escala 50–900.** Ninguno la tiene: `accent` solo trae `accent`, `accentSoft` y `accentDeep` (`tokens.ts:66-68`); igual `correct`, `wrong` y los ocho de `world`.

**COLOR-4 · Contraste AA (4.5:1).** Pares texto/superficie que fallan (calculados de los tokens):
- (ninguno)

`text` sobre `accent` da 1.47: usar siempre `onAccent`.

## TIPOGRAFÍA

**TIPO-1 · Máximo 2 familias; prohibidas Inter, Roboto, Arial y Space Grotesk como default.** Familias de `font.family` (`tokens.ts`), cargadas en `App.tsx` con `useFonts` (`src/theme/fuentes.ts`): Bricolage Grotesque (títulos), Instrument Sans (cuerpo) y Charis SIL (IPA). Un `fontFamily` que no salga de `font.family`, o un texto sin familia, cae a la fuente del sistema (en Android, **Roboto**). Ocurrencias fuera de `font.family`:
- (ninguno)

**TIPO-2 · Cuerpo de 16 px mínimo.** El token de cuerpo `font.size.md` vale **16** (`tokens.ts`) y `text.body` y `text.bodyMuted` lo usan. Estilos de cuerpo o descripción por debajo de 16 px (0):
- (ninguno)

Se quedan en 12–13 px, revisados a mano (16):
- `src/components/base/Ads.tsx:186` — fullNota: fontSize sm = 13 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/components/list/EntryRow.tsx:150` — verTexto: fontSize sm = 13 — etiqueta de un botón de texto: lo que se toca es el contenedor
- `src/screens/entry/OnboardingScreen.tsx:469` — nota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/screens/entry/OnboardingScreen.tsx:491` — chipTexto: fontSize sm = 13 — etiqueta de una línea (metadato o chip)
- `src/screens/extras/LecturaScreen.tsx:309` — leyendaTexto: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/screens/extras/LecturasScreen.tsx:233` — difTexto: fontSize xs = 12 — etiqueta de una línea (metadato o chip)
- `src/screens/games/CaidaScreen.tsx:612` — finNota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/screens/games/CaidaScreen.tsx:658` — siguienteTexto: fontSize sm = 13 — etiqueta de un botón de texto: lo que se toca es el contenedor
- `src/screens/games/ColmenaScreen.tsx:604` — nota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/screens/games/DulcesScreen.tsx:699` — metaFrase: fontSize xs = 12 — etiqueta de una línea (metadato o chip)
- `src/screens/games/DulcesScreen.tsx:722` — pieNota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/screens/games/DulcesScreen.tsx:765` — seguirTexto: fontSize sm = 13 — etiqueta de un botón de texto: lo que se toca es el contenedor
- `src/screens/games/GameEndScreen.tsx:248` — estrellasNota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/screens/games/GameEndScreen.tsx:254` — repasoNota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/screens/games/ParesScreen.tsx:442` — saltarTexto: fontSize sm = 13 — etiqueta de un botón de texto: lo que se toca es el contenedor
- `src/screens/utility/SettingsScreen.tsx:426` — horaTexto: fontSize sm = 13 — etiqueta de una línea (metadato o chip)

Otros `fontSize` < 16 por archivo (etiquetas y secundarios; revisar cuáles son cuerpo): `src/screens/extras/PronunciationScreen.tsx` 8, `src/screens/extras/ContractionsScreen.tsx` 5, `src/components/base/Input.tsx` 4, `src/screens/extras/LecturasScreen.tsx` 4, `src/screens/extras/MinimalPairsScreen.tsx` 4, `src/screens/games/CazalaScreen.tsx` 4, `src/screens/games/NivelesScreen.tsx` 4, `src/screens/utility/DiagnosticsScreen.tsx` 4, `src/screens/utility/DownloadsScreen.tsx` 4, `src/screens/entry/AuthScreen.tsx` 3, `src/screens/entry/OnboardingScreen.tsx` 3, `src/screens/extras/AzarScreen.tsx` 3, `src/screens/extras/ErrorDetailScreen.tsx` 3, `src/screens/extras/PhrasalScreen.tsx` 3, `src/screens/games/DulcesScreen.tsx` 3, `src/screens/games/ParesScreen.tsx` 3, `src/screens/study/StudyScreen.tsx` 3, `src/screens/utility/ProgressScreen.tsx` 3, `src/components/base/Ads.tsx` 2, `src/components/base/Badge.tsx` 2, `src/components/card/FeedbackBand.tsx` 2, `src/components/card/StudyCardView.tsx` 2, `src/components/card/TileBuilder.tsx` 2, `src/components/list/SectionTitle.tsx` 2, `src/screens/discover/DetailScreen.tsx` 2, `src/screens/discover/WorldDetailScreen.tsx` 2, `src/screens/extras/EarModeScreen.tsx` 2, `src/screens/extras/ErrorsScreen.tsx` 2, `src/screens/extras/GramaticaScreen.tsx` 2, `src/screens/extras/GramaticaTemaScreen.tsx` 2, `src/screens/extras/PracticeScreen.tsx` 2, `src/screens/games/CaidaScreen.tsx` 2, `src/screens/games/ColmenaScreen.tsx` 2, `src/components/base/ErrorBoundary.tsx` 1, `src/components/base/Header.tsx` 1, `src/components/card/AudioButton.tsx` 1, `src/components/card/ReproductorCapitulo.tsx` 1, `src/components/feedback/Toast.tsx` 1, `src/components/unlock/CandadoBadge.tsx` 1, `src/components/unlock/MuroDesbloqueo.tsx` 1, `src/navigation/TabNavigator.tsx` 1, `src/screens/discover/ExploreScreen.tsx` 1, `src/screens/entry/BootScreen.tsx` 1, `src/screens/extras/practicar/FilaModo.tsx` 1, `src/screens/games/GameEndScreen.tsx` 1, `src/screens/utility/SettingsScreen.tsx` 1, `src/screens/utility/StuckScreen.tsx` 1.

**TIPO-2b · Line-height del cuerpo entre 1.4 y 1.6** (texto de 18 px o menos):
- `src/screens/extras/GramaticaTemaScreen.tsx:345` — en: 18 px con lineHeight x1.35

**TIPO-4 · Títulos ≥ 28 px con letterSpacing de −1% a −2%:**
- (ninguno)

Descartados (28 px o más, pero no son títulos):
- `src/components/base/Card.tsx:219` — portadaVacia: inicial suelta de una portada pendiente (`textSobrePortada`), no un título
- `src/components/card/SceneImage.tsx:126` — inicial: inicial suelta de una imagen pendiente (`textSobrePortada`), no un título

## ESPACIADO

**ESP-1 · Escala 4/8 (4, 8, 12, 16, 24, 32, 48).** Los tokens `space` (`tokens.ts:214-222`) coinciden con la escala. Las violaciones son valores sueltos o sumas. No se cuenta `padding: 1`: es el filo de luz, una técnica de borde.
- `src/components/base/Badge.tsx:84` — wrap: paddingHorizontal: space.sm + 2 = 10
- `src/components/base/Badge.tsx:89` — small: paddingVertical: 3 = 3
- `src/components/base/Input.tsx:72` — label: marginLeft: 2 = 2
- `src/components/base/Input.tsx:99` — error: marginLeft: 2 = 2
- `src/components/base/Input.tsx:100` — hint: marginLeft: 2 = 2
- `src/components/feedback/Chispas.tsx:98` — chispa: marginLeft: -1.5 = -1.5
- `src/components/feedback/Estrellas.tsx:83` — chispa: marginLeft: -10 = -10
- `src/components/feedback/Estrellas.tsx:84` — chispa: marginTop: -10 = -10
- `src/components/list/EntryRow.tsx:145` — body: gap: 3 = 3
- `src/components/list/EntryRow.tsx:146` — bodyMazo: gap: 3 = 3
- `src/components/list/EntryRow.tsx:159` — badges: marginTop: 2 = 2
- `src/components/unlock/CandadoBadge.tsx:28` — wrap: paddingHorizontal: 10 = 10
- `src/navigation/TabNavigator.tsx:175` — bar: paddingBottom: 10 = 10
- `src/navigation/TabNavigator.tsx:176` — bar: paddingTop: 10 = 10
- `src/navigation/TabNavigator.tsx:188` — label: marginTop: 2 = 2
- `src/navigation/TabNavigator.tsx:190` — item: paddingTop: 2 = 2
- `src/screens/entry/OnboardingScreen.tsx:470` — previa: gap: 2 = 2
- `src/screens/extras/ContractionsScreen.tsx:160` — itemText: gap: 2 = 2
- `src/screens/extras/ErrorsScreen.tsx:183` — understood: marginLeft: space.lg + space.xs = 20
- `src/screens/extras/LecturasScreen.tsx:231` — meta: marginTop: 2 = 2
- `src/screens/extras/PhrasalScreen.tsx:177` — forma: gap: 3 = 3
- `src/screens/extras/PronunciationScreen.tsx:489` — pairSide: gap: 2 = 2
- `src/screens/games/DulcesScreen.tsx:695` — metas: gap: 6 = 6
- `src/screens/games/DulcesScreen.tsx:698` — metaCuerpo: gap: 2 = 2
- `src/screens/games/NivelesScreen.tsx:287` — estrellas: marginTop: 1 = 1
- `src/screens/study/StudyScreen.tsx:296` — aciertosRow: gap: 6 = 6
- `src/screens/utility/ProgressScreen.tsx:173` — big: gap: 2 = 2
- `src/screens/utility/ProgressScreen.tsx:189` — bars: gap: 3 = 3
- `src/screens/utility/SettingsScreen.tsx:429` — hint: marginTop: 2 = 2
- `src/screens/utility/StuckScreen.tsx:89` — slot: gap: 2 = 2

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


## Revisión manual (no se puede medir estáticamente)

- **TIPO-3** jerarquía con tamaño y peso, no solo color; **TIPO-5** no mezclar alineaciones en un bloque.
- **ESP-2** proximidad (lo que va junto, cerca; entre secciones, el doble).
- **ACC-2** una sola cosa destacada por pantalla: hoy conviven el botón principal cian, la superficie `contraste`, el filo de luz de cada tarjeta y el acento cian.
- **MOV-2** acciones frecuentes en la mitad inferior: en los juegos "Saltar" vive en el `right` del `Header` (arriba a la derecha).
- **MOV-3** barra inferior: flota (`TabNavigator.tsx`, estilo `bar`) sobre un `BlurView` con filo; tiene fondo propio, así que cumple, pero no va pegada al borde.
- **MOV-4** padding que empuja el contenido: revisar en dispositivo.
- **IA-2** tarjetas de distinto tamaño y peso: `Card` es una sola pieza con filo y sombra `card`.

# Auditoría de comportamiento

## a) Estados: carga, vacío y error

Pantallas de `src/screens/` que leen de la base (`@/db/`). Cada celda apunta a la primera línea que evidencia el estado; ✗ es que no se detectó ninguno. La detección busca nombres de estado (`loading`, `cargando`, `useCarga`, `<Carga>`, `ErrorCarga`, `EmptyState`, `.length === 0`, `.catch`, `setError`), así que un estado con otro nombre saldría ✗ y hay que confirmarlo.

| pantalla (archivo) | carga | vacío | error |
|---|---|---|---|
| `discover/DetailScreen.tsx` | ✓ `:42` | ✓ `:59` | ✓ `:57` |
| `discover/ExploreScreen.tsx` | ✓ `:27` | ✓ `:65` | ✓ `:79` |
| `discover/PackDetailScreen.tsx` | ✓ `:34` | ✗ | ✓ `:60` |
| `discover/WorldDetailScreen.tsx` | ✓ `:28` | ✗ | ✓ `:51` |
| `entry/BootScreen.tsx` | ✓ `:88` | ✓ `:37` | ✓ `:25` |
| `extras/AzarScreen.tsx` | ✓ `:73` | ✓ `:206` | ✓ `:197` |
| `extras/ContractionsScreen.tsx` | ✓ `:34` | ✓ `:45` | ✓ `:92` |
| `extras/EarModeScreen.tsx` | ✓ `:93` | ✓ `:202` | ✓ `:185` |
| `extras/LecturaScreen.tsx` | ✓ `:55` | ✓ `:131` | ✓ `:145` |
| `extras/LecturasScreen.tsx` | ✓ `:48` | ✓ `:74` | ✓ `:93` |
| `extras/PracticeScreen.tsx` | ✓ `:82` | ✗ | ✓ `:163` |
| `games/CaidaScreen.tsx` | ✓ `:157` | ✓ `:363` | ✓ `:343` |
| `games/CazalaScreen.tsx` | ✓ `:72` | ✓ `:141` | ✓ `:185` |
| `games/ColmenaScreen.tsx` | ✓ `:116` | ✓ `:306` | ✓ `:286` |
| `games/DulcesScreen.tsx` | ✓ `:153` | ✓ `:482` | ✓ `:462` |
| `games/NivelesScreen.tsx` | ✓ `:55` | ✗ | ✓ `:138` |
| `games/ParesScreen.tsx` | ✓ `:109` | ✓ `:286` | ✓ `:262` |
| `utility/DeckScreen.tsx` | ✓ `:21` | ✓ `:24` | ✓ `:38` |
| `utility/DiagnosticsScreen.tsx` | ✓ `:31` | ✗ | ✓ `:61` |
| `utility/ProgressScreen.tsx` | ✓ `:25` | ✓ `:86` | ✓ `:57` |
| `utility/StuckScreen.tsx` | ✓ `:25` | ✓ `:28` | ✓ `:36` |

Sin carga: 0 de 21 · sin vacío: 5 · sin error: 0.

## b) Texto cortado

`numberOfLines={1}` en texto cuyo contenido importa (frases, traducciones, títulos, nombres). Se corta con "…" y el usuario no puede leer el resto:
- `src/components/base/Header.tsx:35` — `{subtitle}`

Otros 4 `numberOfLines={1}` en etiquetas, contadores y similares no se listan.

## c) Rendimiento

**Listas:** `FlatList` o `SectionList` sin `keyExtractor`, con clave por índice, con el ítem sin `memo` o con el separador creado en cada render, y colecciones grandes pintadas con `.map` dentro de un `ScrollView`:
- (ninguno)

**Dependencias que cambian en cada render** (el efecto o el callback se vuelve a disparar sin necesidad, como pasaba con `grupos` en `ContractionsScreen`):
- (ninguno)

**Estado que se actualiza por intervalo, cuadro o scroll** (`setInterval`, `requestAnimationFrame`, `onScroll` con `setState`; solo el de una pantalla cuenta como hallazgo, el de un componente hoja es informativo):
- `src/components/card/ReproductorCapitulo.tsx:54` — `setInterval` cada 250 ms con `setState`: repinta un componente hoja

**Solo informativo (no cuenta):** claves por índice en listas estáticas, que solo importan si la lista se reordena o se filtra:
- `src/components/base/Skeleton.tsx:65` — key por índice
- `src/components/card/FilaEstrellas.tsx:22` — key por índice
- `src/components/feedback/Confetti.tsx:41` — key por índice
- `src/screens/entry/OnboardingScreen.tsx:290` — key por índice
- `src/screens/extras/GramaticaTemaScreen.tsx:177` — key por índice
- `src/screens/extras/GramaticaTemaScreen.tsx:290` — key por índice
- `src/screens/extras/GramaticaTemaScreen.tsx:292` — key por índice

Pantallas con más de 8 `useState` (cualquier cambio repinta la pantalla; no es un bug por sí solo, pero es donde mirar si hay tirones): `games/CaidaScreen.tsx` 10, `games/ColmenaScreen.tsx` 11, `games/DulcesScreen.tsx` 12, `games/ParesScreen.tsx` 9.

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

Archivos que pintan `<AudioButton>`: `screens/extras/PhrasalScreen.tsx` 6, `screens/extras/GramaticaTemaScreen.tsx` 5, `components/list/EntryRow.tsx` 4, `components/card/PhraseBlock.tsx` 3, `components/card/StudyCardView.tsx` 3, `screens/extras/PronunciationScreen.tsx` 3, `screens/games/CazalaScreen.tsx` 3, `screens/extras/ContractionsScreen.tsx` 2, `screens/extras/ErrorDetailScreen.tsx` 2, `screens/extras/MinimalPairsScreen.tsx` 1, `screens/games/DulcesScreen.tsx` 1.

## e) Movimiento

**MOT-1 · Nada de movimiento fuera de `src/theme/motion.ts`.** Cuenta duraciones y retrasos numéricos, `Easing.*`, springs sin preset, `springify` y las APIs de animación de React Native:
- `src/components/card/OptionButton.tsx:65` — duración literal: `withTiming(-7, { duration: 55 }),`
- `src/components/card/OptionButton.tsx:66` — duración literal: `withTiming(7, { duration: 55 }),`
- `src/components/card/OptionButton.tsx:67` — duración literal: `withTiming(-4, { duration: 55 }),`
- `src/components/card/OptionButton.tsx:68` — duración literal: `withTiming(0, { duration: 55 })`
- `src/components/feedback/Chispas.tsx:66` — duración literal: `withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })`
- `src/components/feedback/Estrellas.tsx:57` — duración literal: `withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })`
- `src/components/feedback/Toast.tsx:20` — duración literal: `y.value = withTiming(message ? 0 : -80, { duration: 220 });`
- `src/screens/games/ColmenaScreen.tsx:156` — duración literal: `withTiming(-8, { duration: 55 }),`
- `src/screens/games/ColmenaScreen.tsx:157` — duración literal: `withTiming(8, { duration: 55 }),`
- `src/screens/games/ColmenaScreen.tsx:158` — spring sin preset: `withSpring(0)`

**Excepciones revisadas a mano (no cuentan):**
- `src/components/base/RoundTimer.tsx:76` — reloj de la ronda: la barra baja a ritmo constante durante los segundos que dura la ronda
- `src/screens/games/CaidaScreen.tsx:248` — reloj de la ronda: la ficha cae a velocidad constante y su duración es la de la ronda

**MOT-2 · Todo tocable pasa por `Presionable`** (escala 0.97 en `rapido`; con Reduce Motion baja la opacidad). Cuenta `Pressable`, `AnimatedPressable` y `Touchable*` sueltos:
- (ninguno)

## Notas

- Los íconos salen de `Icon` (Phosphor). Quedan flechas y marcas (← → ✓ ✗) como contenido en `catalogo.json`, `gramatica.json` y `medios.json`: son notación de las lecciones, no íconos de interfaz, y el audit no las cuenta.
- `padding: 1` (Card, FeedbackBand, MuroDesbloqueo, TabNavigator) es la técnica del filo de luz y no se cuenta en ESP-1.
- `impeccable detect src` devolvió 0 hallazgos; sus patrones son de HTML y CSS, así que ese 0 no dice nada de esta app.
- Los conteos salen de análisis estático: resuelve expresiones con los tokens `space` y `font.size`, no valores calculados en ejecución.

<!-- conteos: {"COLOR-1":9,"COLOR-3":1,"COLOR-4":0,"TIPO-1":0,"TIPO-2":0,"TIPO-2b":1,"TIPO-4":0,"ESP-1":30,"ACC-1":0,"ACC-3":7,"MOV-1":0,"IA-1":0,"IA-1b":0,"IA-3":0,"EST-carga":0,"EST-vacio":5,"EST-error":0,"TXT-1":1,"RND-1":0,"RND-2":0,"RND-3":0,"AUD-1":1,"MOT-1":10,"MOT-2":0} -->
