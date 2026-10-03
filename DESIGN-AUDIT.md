# Auditoría de diseño

Qué reglas de `DESIGN.md` incumple hoy el código y cómo se comporta en pantallas, texto, rendimiento y audio. **No se corrigió nada.**
Se regenera con `npm run audit:diseno` (análisis estático de 593 archivos de `src/`). Las reglas que dependen de juicio visual van en "Revisión manual".

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
| COLOR-1 | colores de mundo que tiñen fondos grandes (portadas tintadas y rellenos) | 0 |
| COLOR-3 | colores de marca (acento, primario, neutro) sin escala 50–900 | 0 |
| COLOR-4 | pares texto/superficie bajo AA | 0 |
| TIPO-1 | familias: fuente del sistema, `CharisSIL` sin cargar, `monospace` | 0 |
| TIPO-2 | cuerpo < 16 px (estilos de cuerpo en 15, 13 o 12, salvo los descartados a mano) | 7 |
| TIPO-2b | line-height del cuerpo fuera de 1.4–1.6 | 0 |
| TIPO-4 | títulos ≥ 28 px sin letterSpacing negativo | 0 |
| ESP-1 | espaciado fuera de 4/8 | 0 |
| ACC-1 | acción principal no sólida o varios sólidos a la vez | 0 |
| ACC-3 | opciones visibles en Practicar con los grupos plegados (máximo recomendado 7) | 7 |
| MOV-1 | áreas táctiles < 48 dp (estilos + tokens) | 0 |
| IA-1 | líneas con emojis | 0 |
| IA-1b | líneas con glifos de texto como íconos | 1 |
| IA-3 | sombras de color o fuera de tokens | 0 |
| EST-carga | pantallas que cargan datos sin estado de carga | 0 |
| EST-vacio | pantallas que cargan datos sin estado vacío | 5 |
| EST-error | pantallas que cargan datos sin estado de error | 0 |
| TXT-1 | texto de contenido cortado con `numberOfLines={1}` | 1 |
| TXT-2 | texto de contenido variable en una fila con ícono, botón o badge sin poder encogerse | 0 |
| RND-1 | listas sin `keyExtractor` estable, con ítem sin `memo` o con separador inline | 0 |
| RND-2 | hooks con dependencias que cambian en cada render | 0 |
| RND-3 | estado por intervalo, cuadro o scroll que repinta toda la pantalla | 0 |
| AUD-1 | audios de los JSON que no están en el bundle o están vacíos | 0 |
| MOT-1 | duraciones, curvas y springs fuera de `motion.ts` (salvo los relojes revisados) | 0 |
| MOT-2 | tocables sin el feedback al presionar (`Presionable`) | 0 |
| MOT-3 | más de un momento héroe animado por pantalla, o más de 3 canvases de Skia en bucle | 0 |
| MOT-4 | bucles de la señal que no se pausan fuera de pantalla, sin foco o en segundo plano | 0 |
| MOT-5 | efectos de la señal que no respetan reducir movimiento | 0 |
| MOT-6 | nodos con animación de layout (`entering`, `exiting`, `layout`) y un transform en el mismo nodo | 0 |

# Auditoría estática

## COLOR

**COLOR-1 · Máximo 3 colores de marca: primario (`contraste`), acento (`accent`) y neutro.** Los ocho colores de mundo son una familia (misma luminosidad y saturación, solo cambia el tono) y van en chico: un punto, una etiqueta, una barra fina y el tinte de los cubitos. Solo cuentan como marca si tiñen fondos grandes. Portadas tintadas en `gradiente` (0) y `backgroundColor: color.world…` fuera del tema:
- (ninguno)

**Excepción revisada a mano (no cuenta):**
- (ninguno)

**COLOR-2 · Degradados dentro de un mismo tono.** Las portadas usan un solo degradado neutro (`gradiente.neutro`). El degradado de la señal (`senal`) va de `senalInicio` a `senalFin` (azul marino hondo, cobalto y luz), sin hex nuevos, y `npm run check:color` verifica que sus tres pasos no se separen más de 8° de tono. Para revisar: `filoLuz` mezcla blanco y el azul del acento, y `FONDO`. Usos de `<LinearGradient`:
- `src/app/navegacion/TabNavigator.tsx:121`
- `src/features/errores/screens/ErrorsScreen.tsx:99`
- `src/features/juegos/caida/components/PisoResplandor.tsx:77`
- `src/features/juegos/caida/components/PistaCaida.tsx:62`
- `src/features/juegos/cazala/components/PieCaza.tsx:44`
- `src/features/juegos/cazala/components/ResultadoCaza.tsx:96`
- `src/features/juegos/colmena/components/Hexagono.tsx:313`
- `src/features/juegos/dulces/components/SimboloPieza.tsx:56`
- `src/features/juegos/niveles/components/CeldaNivel.tsx:130`
- `src/features/lecturas/components/TarjetaLectura.tsx:91`
- `src/features/phrasal/components/RenglonVerbo.tsx:77`
- `src/features/practicar/components/BotonSenal.tsx:87`
- `src/features/practicar/components/ConsolaHoy.tsx:102`
- `src/features/practicar/components/Destacados.tsx:74`
- `src/features/practicar/components/FilaModo.tsx:112`
- `src/features/practicar/components/MedidorVU.tsx:99`
- `src/features/practicar/components/OndaSenal.tsx:55`
- `src/features/practicar/components/PortadaJuego.tsx:93`
- `src/shared/ui/Card.tsx:131`
- `src/shared/ui/Card.tsx:159`
- `src/shared/ui/esqueleto/Hueso.tsx:105`
- `src/shared/ui/fx/BarraSesion.tsx:118`
- `src/shared/ui/fx/BarraSesion.tsx:126`
- `src/shared/ui/fx/BarraSesion.tsx:129`
- `src/shared/ui/fx/CableTrazo.tsx:80`
- `src/shared/ui/fx/OndaVoz.tsx:124`
- `src/shared/ui/Hoja.tsx:103`
- `src/shared/ui/MarcoImagen.tsx:149`
- `src/shared/ui/MuroDesbloqueo.tsx:74`
- `src/shared/ui/OptionButton.tsx:136`
- `src/shared/ui/Screen.tsx:159`
- `src/shared/ui/Screen.tsx:173`

**COLOR-3 · Cada color de marca con escala 50–900.** Se exige a `accent`, `contraste` (primario) y `neutral`, con los diez pasos en `tokens.ts`. Sin escala completa: ninguno. Los colores de estado y los de mundo no llevan escala.

**COLOR-4 · Contraste AA (4.5:1).** Pares texto/superficie que fallan (calculados de los tokens):
- (ninguno)

`text` sobre `accent` da 1.47: usar siempre `onAccent`.

## TIPOGRAFÍA

**TIPO-1 · Máximo 2 familias; prohibidas Inter, Roboto, Arial y Space Grotesk como default.** Familias de `font.family` (`tokens.ts`), incrustadas en el APK por el plugin de `expo-font` en `app.json`: Bricolage Grotesque (títulos), Instrument Sans (cuerpo) y Charis SIL (IPA). Un `fontFamily` que no salga de `font.family`, o un texto sin familia, cae a la fuente del sistema (en Android, **Roboto**). Ocurrencias fuera de `font.family`:
- (ninguno)

**TIPO-2 · Cuerpo de 16 px mínimo.** El token de cuerpo `font.size.md` vale **16** (`tokens.ts`) y `text.body` y `text.bodyMuted` lo usan. Estilos de cuerpo o descripción por debajo de 16 px (7):
- `src/features/ajustes/screens/PerfilScreen.tsx:128` — cambiarTexto: fontSize sm = 13
- `src/features/cuenta/components/ProgresoPerfil.tsx:55` — texto: fontSize xs = 12
- `src/features/cuenta/components/ResumenPerfil.tsx:95` — cambiarTexto: fontSize sm = 13
- `src/features/cuenta/screens/AuthScreen.tsx:279` — notaSm: fontSize sm = 13
- `src/features/juegos/dulces/components/CapaDepuracion.tsx:51` — texto: fontSize xs = 12
- `src/shared/ui/PasoCuantas.tsx:124` — chipTexto: fontSize sm = 13
- `src/shared/ui/PreguntaPerfil.tsx:91` — nota: fontSize xs = 12

Se quedan en 12–13 px, revisados a mano (15):
- `src/features/ajustes/components/ControlesAjustes.tsx:128` — horaTexto: fontSize sm = 13 — etiqueta de una línea (metadato o chip)
- `src/features/cuenta/components/Presentacion.tsx:88` — nota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/features/cuenta/screens/AuthScreen.tsx:296` — legalTexto: fontSize xs = 12 — nota al pie o leyenda: «Al continuar aceptas los Términos y el Aviso de privacidad», una línea bajo los botones
- `src/features/gramatica/components/BloqueGramatica.tsx:134` — resumen: fontSize sm = 13 — una línea de lo que reúne el bloque, como `FilaModo.corta` de Practicar: apoya al título, no es lo que se estudia
- `src/features/gramatica/components/RenglonTema.tsx:143` — gancho: fontSize sm = 13 — una o dos líneas que apoyan al título del renglón, como `FilaModo.corta` de Practicar; el gancho del tema se lee en 16 px en su pantalla
- `src/features/juegos/caida/components/FinCaida.tsx:192` — nota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/features/juegos/colmena/components/PieColmena.tsx:72` — nota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/features/juegos/dulces/components/PieDulces.tsx:119` — nota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/features/juegos/fin/screens/GameEndScreen.tsx:184` — estrellasNota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/features/juegos/fin/screens/GameEndScreen.tsx:190` — repasoNota: fontSize xs = 12 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia
- `src/features/progreso/components/GraficaEspectrograma.tsx:248` — etiquetaTexto: fontSize sm = 13 — etiqueta flotante de una línea con el dato del día que se toca: metadato, no lo que se estudia
- `src/features/progreso/components/GraficaEspectrograma.tsx:261` — hoyTexto: fontSize xs = 12 — etiqueta de una línea (metadato o chip)
- `src/features/progreso/components/GraficaEspectrograma.tsx:263` — listaTexto: fontSize sm = 13 — texto alternativo de la gráfica: una línea por día, información secundaria
- `src/features/vocabulario/components/EntryRow.tsx:151` — verTexto: fontSize sm = 13 — etiqueta de un botón de texto: lo que se toca es el contenedor
- `src/shared/ui/Ads.tsx:191` — fullNota: fontSize sm = 13 — nota al pie o leyenda: información secundaria de una o dos líneas, no lo que se estudia

Otros `fontSize` < 16 por archivo (etiquetas y secundarios; revisar cuáles son cuerpo): `src/features/sonidos/screens/ContractionsScreen.tsx` 5, `src/features/sonidos/screens/MinimalPairsScreen.tsx` 5, `src/features/ajustes/screens/DiagnosticsScreen.tsx` 4, `src/features/ajustes/screens/DownloadsScreen.tsx` 4, `src/shared/ui/Input.tsx` 4, `src/features/cuenta/screens/AuthScreen.tsx` 3, `src/features/errores/components/DueloContraste.tsx` 3, `src/features/progreso/components/GraficaEspectrograma.tsx` 3, `src/features/ajustes/screens/ProbarVozScreen.tsx` 2, `src/features/cuenta/components/ResumenPerfil.tsx` 2, `src/features/detalle/components/EscalaRegistro.tsx` 2, `src/features/errores/screens/ErrorsScreen.tsx` 2, `src/features/estudio/components/HojaVeredicto.tsx` 2, `src/features/estudio/components/TileBuilder.tsx` 2, `src/features/juegos/dulces/components/HojaPregunta.tsx` 2, `src/features/juegos/niveles/components/EncabezadoTramo.tsx` 2, `src/features/juegos/niveles/screens/NivelesScreen.tsx` 2, `src/features/juegos/pares/screens/ParesScreen.tsx` 2, `src/features/lecturas/components/TarjetaLectura.tsx` 2, `src/features/sonidos/components/DueloPar.tsx` 2, `src/features/sonidos/components/MapaBoca.tsx` 2, `src/features/vocabulario/screens/WorldDetailScreen.tsx` 2, `src/shared/ui/Ads.tsx` 2, `src/shared/ui/Badge.tsx` 2, `src/shared/ui/PasoCuantas.tsx` 2, `src/shared/ui/SectionTitle.tsx` 2, `src/app/arranque/BootScreen.tsx` 1, `src/app/navegacion/TabNavigator.tsx` 1, `src/features/ajustes/components/ControlesAjustes.tsx` 1, `src/features/ajustes/components/FilaLegal.tsx` 1, `src/features/ajustes/components/Identidad.tsx` 1, `src/features/ajustes/components/SeccionRecordatorios.tsx` 1, `src/features/ajustes/screens/PerfilScreen.tsx` 1, `src/features/ajustes/screens/SettingsScreen.tsx` 1, `src/features/atoradas/components/Desatorar.tsx` 1, `src/features/atoradas/components/MedidorAtasco.tsx` 1, `src/features/cuenta/screens/OnboardingScreen.tsx` 1, `src/features/detalle/components/CuandoNoDecirla.tsx` 1, `src/features/detalle/components/FilaDondeVive.tsx` 1, `src/features/detalle/screens/DetailScreen.tsx` 1, `src/features/errores/components/MedidorGravedad.tsx` 1, `src/features/errores/components/SecuenciaMalentendido.tsx` 1, `src/features/errores/screens/ErrorDetailScreen.tsx` 1, `src/features/estudio/components/BloqueVoz.tsx` 1, `src/features/estudio/components/ChipMarcador.tsx` 1, `src/features/estudio/components/DiffFrase.tsx` 1, `src/features/estudio/components/StudyCardView.tsx` 1, `src/features/frases-sueltas/components/IndicadorArrastre.tsx` 1, `src/features/frases-sueltas/screens/AzarScreen.tsx` 1, `src/features/gramatica/components/RenglonTema.tsx` 1, `src/features/gramatica/screens/GramaticaScreen.tsx` 1, `src/features/gramatica/screens/GramaticaTemaScreen.tsx` 1, `src/features/juegos/caida/screens/CaidaScreen.tsx` 1, `src/features/juegos/cazala/components/FraseMorph.tsx` 1, `src/features/juegos/cazala/components/RenglonCaza.tsx` 1, `src/features/juegos/cazala/components/ResultadoCaza.tsx` 1, `src/features/juegos/colmena/screens/ColmenaScreen.tsx` 1, `src/features/juegos/dulces/components/MetaFrase.tsx` 1, `src/features/juegos/fin/screens/GameEndScreen.tsx` 1, `src/features/juegos/niveles/components/CeldaNivel.tsx` 1, `src/features/juegos/niveles/components/EncabezadoNiveles.tsx` 1, `src/features/juegos/pares/components/FichaPar.tsx` 1, `src/features/lecturas/components/AnilloFrases.tsx` 1, `src/features/lecturas/components/PieReproductor.tsx` 1, `src/features/mazo/components/DeslizarQuitar.tsx` 1, `src/features/phrasal/components/ChipsFormas.tsx` 1, `src/features/phrasal/components/DetalleForma.tsx` 1, `src/features/phrasal/components/RenglonVerbo.tsx` 1, `src/features/phrasal/screens/PhrasalVerboScreen.tsx` 1, `src/features/practicar/components/ConsolaHoy.tsx` 1, `src/features/practicar/components/Destacados.tsx` 1, `src/features/practicar/components/FilaModo.tsx` 1, `src/features/practicar/components/MetaModo.tsx` 1, `src/features/progreso/components/CuadroDato.tsx` 1, `src/features/progreso/components/FichaJuego.tsx` 1, `src/features/progreso/components/FilaMundo.tsx` 1, `src/features/progreso/components/PanelSenal.tsx` 1, `src/features/progreso/screens/ProgressScreen.tsx` 1, `src/features/sonidos/components/IndiceFonemas.tsx` 1, `src/features/sonidos/components/PaginaFonema.tsx` 1, `src/features/sonidos/components/RenglonPalabra.tsx` 1, `src/features/sonidos/screens/PronunciationScreen.tsx` 1, `src/features/vocabulario/screens/ExploreScreen.tsx` 1, `src/shared/ui/AudioButton.tsx` 1, `src/shared/ui/GrupoAudio.tsx` 1, `src/shared/ui/Header.tsx` 1, `src/shared/ui/HojaConsentimiento.tsx` 1, `src/shared/ui/MuroDesbloqueo.tsx` 1.

**TIPO-2b · Line-height del cuerpo entre 1.4 y 1.6** (texto de 18 px o menos):
- (ninguno)

**TIPO-4 · Títulos ≥ 28 px con letterSpacing de −1% a −2%:**
- (ninguno)


## ESPACIADO

**ESP-1 · Escala 4/8 (4, 8, 12, 16, 24, 32, 48).** Los tokens `space` (`tokens.ts:214-222`) coinciden con la escala. Las violaciones son valores sueltos o sumas. Excepciones válidas, que no cuentan: `padding: 1` (el filo de luz), los bordes de 1 a 2 px (`borderWidth`, que no son espaciado y el audit no mira) y los márgenes negativos de hasta 2 px que compensan un borde.
- (ninguno)

**Excepciones revisadas (no cuentan):**
- `src/app/navegacion/TabNavigator.tsx:248` — filo: padding 1, el filo de luz (una envoltura de 1 px que hace de borde)
- `src/features/juegos/cazala/components/ResultadoCaza.tsx:127` — filo: padding 1, el filo de luz (una envoltura de 1 px que hace de borde)
- `src/features/practicar/components/Destacados.tsx:170` — filo: padding 1, el filo de luz (una envoltura de 1 px que hace de borde)
- `src/shared/ui/Card.tsx:191` — filo: padding 1, el filo de luz (una envoltura de 1 px que hace de borde)
- `src/shared/ui/MuroDesbloqueo.tsx:124` — filo: padding 1, el filo de luz (una envoltura de 1 px que hace de borde)

## JERARQUÍA Y ACCIÓN

**ACC-1 · Una sola acción principal, botón sólido de alto contraste.** `Button` tiene 4 variantes: `primary` (`primario`, azul sólido), `secondary` (con borde), `ghost` y `danger` (`Button.tsx:143-158`). Revisado leyendo cada render, **los hallazgos reales son:**
- (ninguno)


Descartados tras leer el render (no son hallazgo):
- `src/features/lecturas/screens/LecturaScreen.tsx` — la vista de preguntas y la de lectura son excluyentes (`enPreguntas`)
- `src/features/juegos/cazala/components/PieCaza.tsx` — `revisada ? Siguiente : Revisar`: el pie muestra uno u otro, nunca los dos
- `src/features/juegos/fin/screens/GameEndScreen.tsx` — `nivel ? Nivel siguiente (primary) + Recoger (secondary) : Recoger (primary)`: nunca hay dos
- `src/features/ajustes/screens/DownloadsScreen.tsx` — lista de 16 packs con la misma acción "descargar": ninguna es la principal y 16 `primary` romperían "una sola acción sólida"; se queda `secondary`
- `src/features/cuenta/screens/OnboardingScreen.tsx` — un paso a la vez (`paso === N`); en el último, "Permitir y empezar" y "Entrar a la app" son excluyentes
- `src/features/estudio/components/FinDelDia.tsx` — `quedan ? Seguir repasando : sinNuevas ? Frases sueltas : Aprender frases nuevas`: un solo `primary` a la vez; Jugar es `secondary` y Volver `ghost`
- `src/features/cuenta/screens/AuthScreen.tsx` — tres vistas excluyentes (vincular tu avance, usuario y contraseña, inicio), cada una con un solo `primary`; en el inicio la acción principal es «Continuar con Google» (`BotonGoogle`, con la marca de Google) y lo demás es `secondary`/`ghost`

**ACC-3 · Menos opciones (Ley de Hick).** `PracticeScreen` (la pestaña de inicio) muestra **7 opciones** con los grupos plegados: 1 acción de HOY + 3 destacados + 3 grupos, que guardan el resto de los 16 destinos. Máximo recomendado 7.

## MÓVIL

**MOV-1 · Área táctil mínima 48×48 dp.** Por debajo, en tokens y componentes:
- (ninguno)

Estilos interactivos con alto menor a 48 (verificar si llevan `hitSlop`):
- (ninguno)

## ANTI-LOOK-IA

**IA-1 · Los emojis no son íconos de interfaz.** `docs/DISENO.md` (§ "Los emojis se quitaron") dice que salieron de toda la app; siguen en:
- (ninguno)

**IA-1b · Íconos de un solo set y un solo grosor.** Glifos de texto (▶ ► ■ ✓ ✕ › → ☆…) usados como íconos, mezclados con emojis y con `IconButton`:
- `src/features/cuenta/components/ResumenPerfil.tsx:33` — →

**IA-3 · Sombras discretas y consistentes; ninguna de color.** El halo de color (`glow`) se eliminó: `primary` usa `shadow.soft` (negra) y la barra de pestañas usa `shadow.card`. `shadow.card` (opacidad 0.55, radio 20) y `shadow.raised` (0.7, radio 32) no son discretas. Sombras definidas fuera de los tokens:
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

Pantallas (`*/screens/*Screen.tsx`) que leen de la base (`@/data/`). Cada celda apunta a la primera línea que evidencia el estado; ✗ es que no se detectó ninguno. La detección busca nombres de estado (`loading`, `cargando`, `useCarga`, `<Carga>`, `ErrorCarga`, `EmptyState`, `.length === 0`, `.catch`, `setError`), así que un estado con otro nombre saldría ✗ y hay que confirmarlo.

| pantalla (archivo) | carga | vacío | error |
|---|---|---|---|
| `src/app/arranque/BootScreen.tsx` | ✓ `:91` | ✓ `:38` | ✓ `:27` |
| `ajustes/screens/DiagnosticsScreen.tsx` | ✓ `:36` | ✗ | ✓ `:36` |
| `atoradas/screens/StuckScreen.tsx` | ✓ `:53` | ✓ `:41` | ✓ `:53` |
| `detalle/screens/DetailScreen.tsx` | ✓ `:30` | ✓ `:32` | ✓ `:30` |
| `frases-sueltas/screens/AzarScreen.tsx` | ✓ `:24` | ✓ `:36` | ✓ `:26` |
| `juegos/caida/screens/CaidaScreen.tsx` | ✓ `:36` | ✓ `:72` | ✓ `:38` |
| `juegos/colmena/screens/ColmenaScreen.tsx` | ✓ `:39` | ✓ `:48` | ✓ `:30` |
| `juegos/dulces/screens/DulcesScreen.tsx` | ✓ `:30` | ✓ `:68` | ✓ `:33` |
| `juegos/niveles/screens/NivelesScreen.tsx` | ✓ `:79` | ✗ | ✓ `:79` |
| `juegos/pares/screens/ParesScreen.tsx` | ✓ `:30` | ✓ `:68` | ✓ `:33` |
| `lecturas/screens/LecturaScreen.tsx` | ✓ `:253` | ✓ `:33` | ✓ `:133` |
| `lecturas/screens/LecturasScreen.tsx` | ✓ `:56` | ✓ `:30` | ✓ `:56` |
| `mazo/screens/DeckScreen.tsx` | ✓ `:62` | ✓ `:49` | ✓ `:62` |
| `oido/screens/EarModeScreen.tsx` | ✓ `:62` | ✓ `:91` | ✓ `:64` |
| `practicar/screens/PracticeScreen.tsx` | ✓ `:88` | ✗ | ✓ `:76` |
| `progreso/screens/ProgressScreen.tsx` | ✓ `:47` | ✓ `:260` | ✓ `:47` |
| `sonidos/screens/ContractionsScreen.tsx` | ✓ `:17` | ✓ `:19` | ✓ `:66` |
| `vocabulario/screens/ExploreScreen.tsx` | ✓ `:45` | ✓ `:31` | ✓ `:45` |
| `vocabulario/screens/PackDetailScreen.tsx` | ✓ `:38` | ✗ | ✓ `:38` |
| `vocabulario/screens/WorldDetailScreen.tsx` | ✓ `:21` | ✗ | ✓ `:21` |

Sin carga: 0 de 20 · sin vacío: 5 · sin error: 0.

## b) Texto cortado

`numberOfLines={1}` en texto cuyo contenido importa (frases, traducciones, títulos, nombres). Se corta con "…" y el usuario no puede leer el resto:
- `src/shared/ui/Header.tsx:35` — `{subtitle}`

Otros 4 `numberOfLines={1}` en etiquetas, contadores y similares no se listan.

**TXT-2 · Un texto de contenido variable en una fila con un ícono, un botón o un badge tiene que poder encogerse** (`flex`, `flexShrink`, `flexGrow`, `width` o `maxWidth` en su estilo). En una fila de React Native el texto no se encoge por omisión: uno largo empuja a su hermano fuera de la tarjeta y su audio queda cortado (el bug de `PhraseBlock`). Hallazgos:
- (ninguno)

## c) Rendimiento

**Listas:** `FlatList` o `SectionList` sin `keyExtractor`, con clave por índice, con el ítem sin `memo` o con el separador creado en cada render, y colecciones grandes pintadas con `.map` dentro de un `ScrollView`:
- (ninguno)

**Dependencias que cambian en cada render** (el efecto o el callback se vuelve a disparar sin necesidad, como pasaba con `grupos` en `ContractionsScreen`):
- (ninguno)

**Estado que se actualiza por intervalo, cuadro o scroll** (`setInterval`, `requestAnimationFrame`, `onScroll` con `setState`; solo el de una pantalla cuenta como hallazgo, el de un componente hoja es informativo):
- `src/features/lecturas/hooks/useReproductorCapitulo.ts:98` — `setInterval` cada 250 ms con `setState`: repinta un componente hoja

**Solo informativo (no cuenta):** claves por índice en listas estáticas, que solo importan si la lista se reordena o se filtra:
- `src/features/atoradas/components/MedidorAtasco.tsx:50` — key por índice
- `src/features/atoradas/components/MedidorAtasco.tsx:53` — key por índice
- `src/features/atoradas/screens/StuckScreen.tsx:59` — key por índice
- `src/features/cuenta/components/Presentacion.tsx:63` — key por índice
- `src/features/cuenta/components/TextoLegal.tsx:12` — key por índice
- `src/features/cuenta/components/TextoLegal.tsx:34` — key por índice
- `src/features/cuenta/components/TextoLegal.tsx:41` — key por índice
- `src/features/cuenta/components/TextoLegal.tsx:54` — key por índice
- `src/features/errores/components/SecuenciaMalentendido.tsx:276` — key por índice
- `src/features/estudio/screens/StudyScreen.tsx:46` — key por índice
- `src/features/gramatica/components/FormulaFichas.tsx:52` — key por índice
- `src/features/gramatica/components/MedidorNivel.tsx:35` — key por índice
- `src/features/gramatica/screens/GramaticaTemaScreen.tsx:80` — key por índice
- `src/features/gramatica/screens/GramaticaTemaScreen.tsx:158` — key por índice
- `src/features/juegos/caida/components/IndicadorRitmo.tsx:49` — key por índice
- `src/features/juegos/caida/screens/CaidaScreen.tsx:63` — key por índice
- `src/features/juegos/caida/screens/CaidaScreen.tsx:155` — key por índice
- `src/features/juegos/colmena/components/EsqueletoColmena.tsx:24` — key por índice
- `src/features/juegos/colmena/components/EsqueletoColmena.tsx:31` — key por índice
- `src/features/juegos/colmena/components/Panal.tsx:64` — key por índice
- `src/features/juegos/colmena/components/ProgresoHex.tsx:88` — key por índice
- `src/features/juegos/comun/FilaEstrellas.tsx:22` — key por índice
- `src/features/juegos/dulces/components/CapaDepuracion.tsx:36` — key por índice
- `src/features/juegos/dulces/screens/DulcesScreen.tsx:50` — key por índice
- `src/features/juegos/niveles/components/EsqueletoNiveles.tsx:47` — key por índice
- `src/features/juegos/niveles/components/EstrellasCelda.tsx:79` — key por índice
- `src/features/juegos/pares/components/FichasJugadas.tsx:39` — key por índice
- `src/features/juegos/pares/components/SegmentosPares.tsx:94` — key por índice
- `src/features/juegos/pares/screens/ParesScreen.tsx:53` — key por índice
- `src/features/lecturas/components/EsqueletoTexto.tsx:39` — key por índice
- `src/features/lecturas/components/Oracion.tsx:122` — key por índice
- `src/features/lecturas/components/Oracion.tsx:125` — key por índice
- `src/features/lecturas/components/TextoAcompanado.tsx:188` — key por índice
- `src/features/lecturas/screens/LecturasScreen.tsx:66` — key por índice
- `src/features/mazo/screens/DeckScreen.tsx:68` — key por índice
- `src/features/phrasal/components/ChipsFormas.tsx:30` — key por índice
- `src/features/phrasal/components/RuletaParticulas.tsx:169` — key por índice
- `src/features/practicar/components/PortadaJuego.tsx:161` — key por índice
- `src/features/progreso/screens/ProgressScreen.tsx:56` — key por índice
- `src/features/progreso/screens/ProgressScreen.tsx:64` — key por índice
- `src/features/sonidos/components/MapaBoca.tsx:185` — key por índice
- `src/features/sonidos/screens/ContractionsScreen.tsx:72` — key por índice
- `src/features/vocabulario/screens/ExploreScreen.tsx:50` — key por índice
- `src/features/vocabulario/screens/PackDetailScreen.tsx:43` — key por índice
- `src/features/vocabulario/screens/WorldDetailScreen.tsx:26` — key por índice
- `src/shared/ui/esqueleto/Hueso.tsx:133` — key por índice
- `src/shared/ui/feedback/Confetti.tsx:39` — key por índice
- `src/shared/ui/fx/PuntosRepeticion.tsx:54` — key por índice
- `src/shared/ui/Skeleton.tsx:40` — key por índice

Pantallas con más de 8 `useState` (cualquier cambio repinta la pantalla; no es un bug por sí solo, pero es donde mirar si hay tirones): ninguna.

## d) Audio

Los botones de audio no desaparecen cuando falta el archivo: `AudioButton` se pinta **apagado** (opacidad 0.4, deshabilitado) si la ruta no está empaquetada ni descargada (`hayAudio`, `AudioButton.tsx`). Rutas de audio que los JSON de `assets/data/` piden y **no están en `bundled.ts`** (0 de 6344):

| grupo | pedidas | sin empaquetar |
|---|---|---|
| `aud` | 3048 | 0 |
| `aud/rules` | 300 | 0 |
| `aud/caza` | 60 | 0 |
| `aud/err` | 216 | 0 |
| `aud/fon` | 574 | 0 |
| `aud/reg` | 75 | 0 |
| `aud/gram` | 800 | 0 |
| `aud/lec` | 29 | 0 |
| `aud/phrasal` | 1242 | 0 |

**Audios vacíos** (empaquetados, pero de menos de 1000 bytes: `isBundled` dice que existen, así que su botón se pinta **activo** y falla en silencio):
- (ninguno)

Archivos que pintan `<AudioButton>`: `features/vocabulario/components/EntryRow.tsx` 4, `features/detalle/components/HeroeFrase.tsx` 3, `features/estudio/components/BloqueVoz.tsx` 3, `features/estudio/components/PhraseBlock.tsx` 3, `features/gramatica/components/ErrorQueSeCorrige.tsx` 2, `features/juegos/cazala/components/BloqueEscucha.tsx` 2, `features/sonidos/screens/ContractionsScreen.tsx` 2, `features/juegos/caida/components/FinCaida.tsx` 1, `features/juegos/cazala/components/ResultadoCaza.tsx` 1, `features/juegos/dulces/components/HojaPregunta.tsx` 1, `features/phrasal/components/DetalleForma.tsx` 1, `features/sonidos/screens/MinimalPairsScreen.tsx` 1.

## e) Movimiento

**MOT-1 · Nada de movimiento fuera de `src/theme/motion.ts`.** Cuenta duraciones y retrasos numéricos, `Easing.*`, springs sin preset, `springify` y las APIs de animación de React Native:
- (ninguno)

**Excepciones revisadas a mano (no cuentan):**
- `src/features/juegos/caida/hooks/usePartidaCaida.ts:237` — reloj de la ronda: la ficha cae a velocidad constante y su duración es la de la ronda
- `src/shared/ui/RoundTimer.tsx:70` — reloj de la ronda: la barra baja a ritmo constante durante los segundos que dura la ronda

**MOT-2 · Todo tocable pasa por `Presionable`** (escala 0.97 en `rapido`; con Reduce Motion baja la opacidad). Cuenta `Pressable`, `AnimatedPressable` y `Touchable*` sueltos:
- (ninguno)

**MOT-3 · Un solo momento héroe animado por pantalla** (en Practicar es HOY, `ConsolaHoy`) **y como máximo 3 canvases de Skia en bucle a la vez.** Archivos con canvas en bucle (5): `AnilloRadio.tsx`, `FondoAurora.tsx`, `OndaSenal.tsx`, `PortadaJuego.tsx`, `ArcoSenal.tsx`. Hallazgos:
- (ninguno)

**MOT-4 · Todo bucle se pausa fuera de pantalla, sin foco o en segundo plano.** Los efectos de la señal consultan `useSenalActiva` (foco + AppState + reducir movimiento) y `useReloj` se detiene con `visible`. Bucles que no lo hacen:
- (ninguno)

**MOT-5 · Con reducir movimiento no hay bucles, tilt, parallax ni marcador; todo queda en su estado final.** Archivos de la señal que animan sin consultar `useMovimientoReducido` ni `useSenalActiva`:
- (ninguno)

**Excepciones revisadas a mano (no cuentan):**
- `src/app/navegacion/TransicionHoy.tsx:40` — solo se monta si `ConsolaHoy` la pide, y `ConsolaHoy` no la pide con reducir movimiento
- `src/features/frases-sueltas/components/CartaEnMazo.tsx:62` — recibe `reducido` (useMovimientoReducido) de MazoCartas: con reducir movimiento no hay abanico de entrada
- `src/features/juegos/caida/hooks/useChoqueCaida.ts:38` — recibe `reducido` (useMovimientoReducido) de usePartidaCaida: con reducir movimiento no hay aplaste ni destello, solo cambian los colores
- `src/features/juegos/caida/hooks/useMarcadorCaida.ts:52` — recibe `reducido` (useMovimientoReducido) de usePartidaCaida: con reducir movimiento el marcador no pulsa
- `src/features/practicar/components/Destacados.tsx:64` — `entering` de Reanimated: salta al valor final con reducir movimiento (`ReduceMotion.System`)

**MOT-6 · Ningún nodo mezcla una animación de layout (`entering`, `exiting`, `layout`) con un transform, animado o estático.** Reanimated pisa el transform y avisa `[Reanimated] Property "transform" … may be overwritten by a layout animation`. Se separa: un `Animated.View` exterior con la animación de layout y, adentro, el componente que anima su transform. `Presionable` anima su escala en su propio nodo y por eso su tipo ya no acepta esas tres props. Hallazgos en todo `src/`:
- (ninguno)

## Notas

- Los íconos salen de `Icon` (Phosphor). Quedan flechas y marcas (← → ✓ ✗) como contenido en `catalogo.json`, `gramatica.json` y `medios.json`: son notación de las lecciones, no íconos de interfaz, y el audit no las cuenta.
- `padding: 1` (Card, FeedbackBand, MuroDesbloqueo, TabNavigator) es la técnica del filo de luz y no se cuenta en ESP-1.
- `impeccable detect src` devolvió 0 hallazgos; sus patrones son de HTML y CSS, así que ese 0 no dice nada de esta app.
- Los bucles anteriores a la v5.0 (`Skeleton` mientras carga) quedan fuera de MOT-4 y MOT-5: MOT-3 a MOT-5 se miden sobre la señal (`src/components/fx/`, Practicar y la barra de pestañas).
- Los conteos salen de análisis estático: resuelve expresiones con los tokens `space` y `font.size`, no valores calculados en ejecución.

<!-- conteos: {"COLOR-1":0,"COLOR-3":0,"COLOR-4":0,"TIPO-1":0,"TIPO-2":7,"TIPO-2b":0,"TIPO-4":0,"ESP-1":0,"ACC-1":0,"ACC-3":7,"MOV-1":0,"IA-1":0,"IA-1b":1,"IA-3":0,"EST-carga":0,"EST-vacio":5,"EST-error":0,"TXT-1":1,"TXT-2":0,"RND-1":0,"RND-2":0,"RND-3":0,"AUD-1":0,"MOT-1":0,"MOT-2":0,"MOT-3":0,"MOT-4":0,"MOT-5":0,"MOT-6":0} -->
