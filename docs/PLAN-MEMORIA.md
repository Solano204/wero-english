# Plan de memoria, fugas, estabilidad y candados (prompt 6 de 6) — diagnóstico

Estado: **esperando OK**. No se cambió código de la app; solo se agregó `scripts/medir-memoria.sh`.

## 1. Qué se mide y dónde

| Qué | Cómo | Estado |
|---|---|---|
| Memoria al abrir, a los 15 min y tras entrar/salir 20 veces de Estudio, cada juego, Lectura con audio, Sonidos y Detalle con imagen | `scripts/medir-memoria.sh foto "<etiqueta>"` antes y después de cada serie (PSS total, Java, nativa, gráficos a `memoria.csv`); para ver qué objetos quedan vivos, Memory Profiler de Android Studio → «Dump Java heap» o React Native DevTools → Memory → heap snapshot | **en el Xiaomi** |
| Resistencia de 30 min | `scripts/medir-memoria.sh resistencia 30` mientras usas la app (estudio, juegos, lecturas, pestañas, segundo plano y regreso): lee memoria cada 30 s y al final cuenta cierres del proceso, ANR, FATAL y errores de JS | **en el Xiaomi** |
| Fugas en el código | revisión completa de `src/` (listeners, temporizadores, players, animaciones, Skia, base, cachés, cierres, errores) | hecho aquí (abajo) |

Aquí no hay teléfono: la tabla de memoria la llenas tú con el script (o me pasas `memoria.csv` y la anoto). Lo de
abajo es lo que el código dice que puede crecer o romperse, en orden de gravedad.

## 2. Diagnóstico

### Alta

1. **El micrófono puede abrirse sin dueño** (`services/voz.ts` `listenOnce`). Espera 250 ms y pregunta por el
   reconocedor del teléfono **antes** de registrar sus listeners y llamar a `start()`. Si en ese hueco la pantalla se
   desmonta (o el usuario sale), el `cancel()` de `useEscucha` corre antes del `start` y el micrófono se abre igual,
   hasta el tope de 8 s. Arreglo: un número de generación que `cancel()` incrementa y que se revisa después de cada
   `await` y justo antes de `start()`.
2. **Los shaders de la aurora se compilan en cada render** (`FondoAurora.tsx`: `Skia.RuntimeEffect.Make(AURORA)` y
   `(GRANO)`, más `Skia.Color`/arreglos nuevos que rehacen el `useDerivedValue`). Practicar pasa `<FondoAurora />`
   nuevo en cada render y el componente se repinta con foco, segundo plano y cambios de ancho. Arreglo: compilar los
   dos una vez a nivel de módulo (y los colores/arreglos fuera del render).
3. **Las calificaciones de los juegos se escriben sin atrapar errores:** `void applyGameGrade(...)` en Cázala, Pares
   (2), Dulces, Caída y Colmena (y `resolverConAyuda` en Colmena, que lo espera sin catch). Si la base falla es un
   rechazo sin atrapar y el avance de SM-2 se pierde en silencio. Arreglo: registrar el error (ver fase 3) sin frenar el
   juego.
4. **No hay registro de errores ni manejador global:** un solo `ErrorBoundary` alrededor de toda la navegación, que
   enseña el `error.message` crudo («Algo se rompió») y cuyo «Reintentar» vuelve a montar todo el navegador (el mismo
   error vuelve a salir). Nada guarda qué pasó.

### Media

5. **Efectos de sonido: un player nativo por combinación, no por archivo** (`services/audio/efectos.ts`). La llave es
   `paquete:clave:escalón:variante`: `success` tiene 15 combinaciones, así que en el paquete por defecto (8 archivos)
   pueden vivir **hasta 28 players**, 15 de ellos con el mismo `success.wav`, y nunca se liberan (los juegos no llaman
   a `liberarEfectos`). Hoy, en total, pueden vivir **30 players** (1 de frase + 28 de efectos + 1 de música; 31 durante
   el fundido de la música). Propuesta: un conjunto fijo de un player por archivo (8 en el paquete por defecto, 24 en
   A/B/C) → **máximo 10 vivos** (1 frase + 8 efectos + 1 música; 11 en el fundido). **Ojo:** hoy dos `success`
   seguidos de escalones distintos pueden sonar encimados porque son players distintos; con uno por archivo, el
   segundo reinicia al primero. Si prefieres que se sigan encimando, dejo 2 por archivo (16 en el paquete por
   defecto). Además, al cambiar de paquete (solo en dev) quedan referencias a players ya liberados.
6. **La conexión a la base no se reintenta:** si abrir o migrar falla una vez, `getDb()` guarda la promesa rechazada y
   todas las llamadas siguientes fallan hasta reiniciar la app. Además `PRAGMA user_version` se escribe fuera de la
   transacción de la migración.
7. **Errores tragados** que esconden fallas reales: `trasArranque` descarta el error de cada tarea diferida (incluida
   la carga de desbloqueos); `useSessionStore` convierte un fallo de la base en «no hay frases nuevas»; `useAuthStore`
   convierte un fallo al arrancar en «sin sesión»; `filas.ts` devuelve el valor por defecto si una fila trae JSON
   corrupto; `loadSettings` y ~10 `void settings.set(...)`/`.then` sin manejo de rechazo.
8. **Esperas sin tope** fuera del reproductor (que ya usa `conTope`): `seekTo` al saltar de frase en Lecturas;
   permisos, idiomas y descarga del modelo del reconocedor de voz.
9. **Skia en el hilo de UI:** `Skia.Path.Make()` nuevo en cada cuadro en `AnilloRadio` (60 barras), `OndaVoz` y la
   onda de HOY (`onda.ts`). No es fuga (lo recoge el GC), pero es basura por cuadro; se puede reutilizar un path con
   `reset()`.

### Baja (se arreglan en los mismos commits)

- **Temporizadores:** 79 `setTimeout`, 5 `setInterval` y 4 `requestAnimationFrame`. Los 5 intervalos se limpian;
  quedan ~6 que pueden disparar después de desmontar (`RenglonVerbo`, rAF en `PaginaFonema` y `useScrollNivel`, el mínimo
  de esqueleto de `useCarga`, el sondeo de `esperarSfx`). No hay `useTimeout`/`useInterval`: cada pantalla repite a mano
  ref + `clearTimeout`. Se crean los dos hooks y se usan donde hoy está el patrón a mano.
- **Listeners:** los 20 (AppState, AccessibilityInfo, BackHandler, Keyboard, navegación, notificaciones) se quitan
  bien. Cada `useSenalActiva` agrega su propio listener de AppState (15+): se puede compartir uno.
- **Animaciones:** ningún bucle infinito sin cancelar (el esqueleto ya se arregló en el prompt 5). Animaciones finitas
  sin `cancelAnimation` al desmontar: MedidorVU, AnilloMeta, GraficaEspectrograma, TransicionHoy, Estallidos.
- **Música:** `isPlaying()` lee `player.playing` de forma síncrona (bloquea el hilo de JS un instante).
- **Cachés:** ninguna está repartida en LRU, pero todas están acotadas por el catálogo: rutas de medios (miles de
  entradas chicas, se vacían al descargar), JSON de contenido (~3 MB si se abren todos, nunca se vacían), marcas de
  audio y el pool de distractores (~1,500 filas, no se refresca si cambia el catálogo). El catálogo completo **no** está
  dos veces en memoria.
- **Cierres:** el motor de la sesión de Estudio guarda mapas del tamaño de la sesión y se libera al salir. Ningún
  store guarda listas de pantalla en callbacks.
- **Base:** no hay sentencias preparadas (nada que finalizar), las 4 transacciones usan `withTransactionAsync` (se
  deshacen solas si fallan) y hay una sola conexión. El `ATTACH` de la siembra tiene su `DETACH` en `finally`.
- **Otros:** 3 archivos de más de 400 líneas (`textos.ts`, generado; `usePartidaDulces.ts` 406; `TableroDulces.tsx`
  404); `Modal` solo en `HojaConsentimiento`; ningún `Image` de React Native; las 21 llamadas a `measure*` ya revisan
  null.

## 3. Plan (commits, con tu OK)

1. **`fix: listeners y temporizadores`:** generación en `listenOnce` (1); `useTimeout`/`useInterval` en
   `shared/hooks` y usarlos en los ~6 sin limpiar y donde hoy se repite el patrón; rAF cancelados; un solo listener de
   AppState compartido por `useSenalActiva`.
2. **`fix: players de audio liberados`:** conjunto fijo de efectos (5), limpieza completa al cambiar de paquete, tope
   de players documentado en `docs/ARQUITECTURA.md`; `isPlaying` de la música sin lectura síncrona.
3. **`fix: animaciones y Skia liberados`:** shaders y colores de la aurora una sola vez (2); paths reutilizados en
   el hilo de UI (9); `cancelAnimation` al desmontar en las animaciones finitas.
4. **`fix: base de datos y cachés con límite`:** `getDb()` reintenta si falló (6), `user_version` dentro de la
   transacción; `lru.ts` chico y usado en las cachés de medios; `vaciarCaches()` para los JSON de contenido, marcas y
   distractores (se llama si el sistema avisa memoria baja y al resembrar).
5. **`feat: ErrorBoundary y registro local de errores`:** límite por pantalla y global con «Algo se atoró. Vuelve a
   intentar.», «Reintentar» (vuelve a montar solo esa pantalla) y «Volver a Practicar»; manejador global
   (`ErrorUtils`) y de promesas; tabla `error_log` con los últimos 50 (pantalla, mensaje, pila, fecha), **sin salir del
   teléfono**; Ajustes → Acerca de → «Copiar reporte de errores»; los catch de (3), (7) y (8) registran; esperas con
   `conTope` en voz y `seekTo`. Nota en `docs/PRIVACIDAD.md`/`PLAY_SEGURIDAD_DATOS.md`: si algún día se usa Sentry u
   otro servicio, primero se actualizan el aviso y la sección de Seguridad de los datos.
6. **`chore: check:perf y presupuestos`:** `npm run check:perf` con las 9 reglas del prompt; `scripts/presupuesto.mjs`
   (bundle de JS y, si le pasas la ruta, el AAB) contra `docs/RENDIMIENTO.md`; `npm run verificar` (typecheck, lint,
   todos los `check:*`, `audit:diseno`). Los 2 archivos de Dulces de 400+ líneas se parten (o van a la lista de
   excepciones si partirlos cambia la lógica).
7. **`test: humo con Maestro`:** `e2e/*.yaml` (abrir, entrar sin cuenta, 5 tarjetas de Estudio, una ronda de cada
   juego, Lectura con audio, Sonidos, Gramática, Phrasal, Errores) y cómo correrlas en Windows con el teléfono. Aquí no
   se pueden correr: las corres tú en el APK release.
8. **`docs: checklist de release`:** `docs/CHECKLIST_RELEASE.md`.
9. Cierre: tabla final con todas las columnas y el resumen de una página; el merge a `main` y la etiqueta
   `rendimiento-v1` solo con tu OK (aquí el push de etiquetas devuelve 403: la etiqueta la pones tú o me das otra vía).

Visible para el usuario: solo la pantalla de error (texto nuevo en el tono de PRODUCT.md) y el botón «Copiar reporte
de errores» en Ajustes, que pide el prompt.

## 4. Preguntas

1. ¿OK al diagnóstico y al plan?
2. Efectos: ¿**un player por archivo** (un `success` reinicia al anterior si suenan casi juntos) o **dos por archivo**
   (se siguen encimando como hoy)?
3. Memoria y resistencia: ¿corres `scripts/medir-memoria.sh` en el Xiaomi (antes de los cambios, en esta rama) y me
   pasas `memoria.csv`?
