# Las pantallas

| Código | Archivo | Qué hace |
|---|---|---|
| P-00 | `entry/BootScreen` | Migraciones, siembra el catálogo, barra de progreso real |
| P-01 | `entry/AuthScreen` | Alta y entrada. Usuario y contraseña, sin Google |
| P-02 | `home/HomeScreen` | Inicio. Una decisión visible: empezar |
| P-03 | `discover/ExploreScreen` | Los 8 mundos y el buscador |
| P-04 | `discover/WorldDetailScreen` | Los packs de un mundo |
| — | `discover/PackDetailScreen` | Las frases de un pack, con FlatList |
| P-05 | `study/StudyScreen` | La sesión. Los cuatro ejercicios |
| P-07 | `study/SessionEndScreen` | Cierre, con confeti solo si se lo ganó |
| P-08 | `games/JudgeScreen` | ¿Lo digo o no? |
| — | `games/JudgeEndScreen` | Cierre del juego |
| P-09 | `extras/EarModeScreen` | Modo oído, sin tocar la pantalla |
| P-10 | `extras/PronunciationScreen` | Los 44 sonidos con pares mínimos |
| P-11 | `utility/SettingsScreen` | Ajustes |
| P-12 | `discover/DetailScreen` | Ficha completa de una frase |
| P-13 | `utility/ProgressScreen` | Progreso y gráfica de 21 días |
| P-14 | `utility/StuckScreen` | Las que se atoran, sin cronómetro |
| P-15 | `utility/DownloadsScreen` | Administrar packs descargados |
| P-16 | `extras/PracticeScreen` | Menú de práctica |
| P-17 | `utility/DeckScreen` | Mi mazo, las de estrella |
| P-19 | `extras/ContractionsScreen` | Cómo suena de verdad |
| — | `games/CazalaScreen` | Caza las tres reducciones |
| P-22 | `extras/ErrorsScreen` | Errores que te delatan |
| P-23 | `extras/PracticeScreen` | Arcade: juegos, micrófono, reto de la semana |
| P-24 | `games/ColmenaScreen` | Arma la palabra letra por letra |
| P-25 | `games/ParesScreen` | Tablero de frase contra significado |
| — | `games/GameEndScreen` | Cierre de cualquier partida, monedas y colección |
| P-10b | `extras/MinimalPairsScreen` | Di la palabra, con micrófono |
| P-01b | `entry/OnboardingScreen` | Presentación y cinco preguntas, saltables |
| P-26 | `games/CaidaScreen` | Dos opciones cayendo, contra reloj |
| P-27 | `games/DulcesScreen` | Tres en línea amarrado a frases pendientes |
| — | `games/NivelesScreen` | Mapa de 200 niveles por juego |
| — | `extras/PhrasalScreen` | 67 phrasal verbs, agrupados por verbo |
| — | `extras/AzarScreen` | Frases sueltas, sin algoritmo |
| P-21 | `extras/LecturasScreen` | Biblioteca, con dificultad tuya |
| — | `extras/LecturaScreen` | El lector y sus tres preguntas |
| — | `extras/ErrorDetailScreen` | Ficha de un error |
| — | `utility/DiagnosticsScreen` | Qué JSON están vacíos |

## Faltan, y por qué

**P-06** (revelación de tarjeta) está adentro de `FeedbackBand`, no es
pantalla propia.

**P-18** (gramática) y **P-20** (trucos) siguen pendientes: no hay
pantalla porque no hay contenido, `gramatica.json` y `trucos.json`
todavía no existen.

**P-21 lecturas ya está**, con seis historias generadas y validadas
contra el catálogo por `scripts/genera_lecturas.py`. Falta la pasada de
TTS por capítulo: mientras `audio` sea null, el botón de escuchar no se
pinta.

## Navegación

```
  Boot  →  Auth  →  Main (tabs)
                      ├── Hoy         HomeScreen
                      ├── Vocabulario ExploreScreen
                      ├── Practicar   PracticeScreen
                      └── Progreso    ProgressScreen

  Modales, entran desde abajo:
      Study, SessionEnd, Judge, JudgeEnd, EarMode, Cazala,
      Colmena, Pares, Caida, Dulces, GameEnd, MinimalPairs

  Push normal, desde la derecha:
      Detail, PackDetail, WorldDetail, Pronunciation,
      Contractions, Errors, ErrorDetail, Downloads,
      Settings, Stuck, Deck, Niveles, Lecturas, Lectura,
      Phrasal, Azar, Diagnostics
```

Las de sesión y juego entran desde abajo a propósito: se siente como
entrar a un modo, no como navegar a otra sección.
