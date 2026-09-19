# Arquitectura

## Las cuatro capas

```
  screens/  ──▶  store/  ──▶  db/       SQLite
     │             │      ──▶ services/  audio, notificaciones, red
     │             │
     └─────────────┴──▶  domain/        lógica pura, sin React
```

**La regla:** `domain/` no importa nada de React, de la base ni de Expo.
Recibe datos, devuelve datos. Por eso `scripts/verify.mjs` puede probar
SM-2 y el juez del juego sin abrir un emulador.

Las pantallas no hablan con SQLite directamente. Todo pasa por el store
o por una consulta de `db/queries.ts`.

---

## Flujo de una sesión de estudio

```
  HomeScreen
     │  nav.navigate('Study')
     ▼
  StudyScreen
     │  useSessionStore.start(userId, filter, meta, nuevas)
     ▼
  useSessionStore
     │  getDueCards()   ─▶ SQLite
     │  getNewCards()   ─▶ SQLite
     │  getDistractors() ─▶ SQLite   (todos de golpe, no uno por tarjeta)
     ▼
  new StudySession(...)          domain/session.ts
     │  intercala vencidas y nuevas cada 4
     │  buildCard() elige el ejercicio según repeticiones
     ▼
  StudyCardView                  pinta según kind
     │  el usuario responde
     ▼
  gradeFrom(correct, elapsedMs, usedHint)   →  1, 2, 3 o 4
     │
     ▼
  review(state, grade)           domain/sm2.ts
     │  devuelve estado nuevo + si vuelve en la sesión
     ▼
  upsertCardState()  ─▶ SQLite
     │
     ▼
  FeedbackBand sube desde abajo
     │  "Seguir"
     ▼
  session.current()  →  siguiente tarjeta, o fin
```

---

## SM-2, en concreto

| Repetición | Qué pasa |
|---|---|
| 0 → 1 (acierto) | vuelve en 1 minuto |
| 1 → 2 (acierto) | vuelve en 10 minutos |
| 2 → 3 (acierto) | gradúa: 1 día, o 3 si fue "fácil" |
| 3+ (acierto) | intervalo × facilidad, tope 180 días |
| cualquiera (fallo) | intervalo a 0, vuelve en 1 minuto, facilidad −0.2 |

La facilidad arranca en 2.5 y se mueve entre 1.3 y 2.8.
Dominada = 4 repeticiones y 21 días de intervalo.

El `vence_en` cae en **medianoche** del día objetivo, no a la hora
exacta, para que "las de hoy" signifique lo mismo a las 7 am y a las
11 pm.

---

## Cómo se elige el ejercicio

```
  repeticiones = 0        →  reconocer
  fallos ≥ 3 y va perdiendo →  reconocer   (bajar la exigencia)
  repeticiones = 1        →  escuchar, o reconocer si no hay audio
  repeticiones = 2        →  completar, o reconocer si no aplica
  repeticiones ≥ 3        →  alterna, con más peso a escribir
```

La progresión importa: si la primera vez que ves una frase te piden
escribirla, te rindes. Y si a la décima te siguen dando cuatro opciones,
no aprendes a producirla.

---

## Esquema de la base

```
entrada          el catálogo, sembrado desde JSON
usuario          cuentas locales
tarjeta          estado SM-2 por usuario y entrada
progreso         racha y totales
ajuste           preferencias por usuario
pack_estado      qué packs están descargados
sesion           historial, alimenta la gráfica de P-13
notif_log        qué notificaciones ya se mandaron
extra_visto      progreso de errores, fonemas y demás
```

Los índices están puestos sobre las consultas del camino caliente. El
más importante es `ix_tarjeta_cola (usuario_id, vence_en)`: sin él, la
consulta de la cola escanea las 1,524 filas en cada arranque.

Las migraciones van en `db/schema.ts` numeradas. **Nunca edites una ya
publicada**, agrega una nueva al final.

---

## Filtro de contenido

Todas las consultas de contenido pasan por `buildFilter()`:

```ts
{ modoLimpio: boolean, niveles: Nivel[], packs?: string[], mundos?: string[] }
```

Aplica siempre `is_canonical = 1` y `revisar = 0`, y agrega
`vulgaridad = 0` si el Modo Limpio está encendido.

Si este filtro se replica por pantalla, tarde o temprano una se olvida y
sale una frase de vulgaridad 2 con el Modo Limpio activo. Por eso está
en un solo lugar.

---

## Qué hace cada servicio

**audio.ts** — un solo player reutilizado. Resuelve rutas relativas
(`aud/18.mp3`) contra lo descargado primero y lo empaquetado después,
con caché de existencia para no hacer un stat por toque.

**notifications.ts** — aplica las cinco prohibiciones del JSON en
código: una al día, dentro de la ventana horaria, nunca vulgaridad 2,
nunca mencionar la racha rota, silencio total tras 14 días sin abrir.
Si un token como `{phrase}` no se puede rellenar, **descarta la
notificación** en vez de mandar el literal.

**auth.ts** — SHA-256 con sal por usuario. Protege de que alguien abra
la base y lea contraseñas en claro, y nada más. No es PBKDF2. Para una
app local sin datos sensibles es proporcionado; si algún día hay
servidor, esto se cambia.

**downloads.ts** — archivo por archivo con el manifest como guía, no un
zip. Un zip de 8 MB que se corta al 90% se pierde entero; archivo por
archivo se reanuda donde iba comparando tamaños.

---

## v3

Lo que se agregó al mirar a la competencia está en `docs/V3.md`:
migración 2 de la base, los dos ejercicios nuevos, el arcade, los dos
juegos, el micrófono, las monedas y las notificaciones repartidas.

Tres archivos nuevos concentran casi todo:

- `src/db/economy.ts` — partidas, reto semanal y registro de habla. La
  economía de monedas se eliminó en la v3.5.
- `src/db/games.ts` — el puente que hace que jugar califique en SM-2.
- `src/services/speech.ts` — el reconocedor, con carga perezosa para
  que la app siga corriendo donde el módulo nativo no existe.
