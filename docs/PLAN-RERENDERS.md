# Plan de re-renders (prompt 4 de 6) — diagnóstico, espera OK

## Cómo se midió

El Profiler de React Native DevTools con «Highlight updates» corre en el teléfono y aquí no hay dispositivo: los
tiempos de commit por interacción se sacan en el Xiaomi (ver «Cómo medir» al final). Lo de este documento sale de
leer el código camino por camino (qué estado cambia, quién lo lee, qué hijos reciben props nuevas) y de pasar el
**React Compiler** por todo `src/` con su registro de eventos (`babel-plugin-react-compiler` 1.0, el que trae Expo).

**React Compiler: apagado** (ni `experiments.reactCompiler` en `app.json` ni plugin en Babel). Si se prende hoy:
329 funciones se compilan y **92 no** (componentes y hooks que se quedarían sin optimizar):

| Causa (eventos) | Qué es |
|---|---|
| 206 · «Cannot access refs during render» | leer `.current` o `.value` de un shared value en el cuerpo del render |
| 84 · «This value cannot be modified» | `sharedValue.value = …` en manejadores: con el compilador, Reanimated 4 pide `.set()` / `.get()` |
| 39 · «skipped … React ESLint rules were disabled» | los `eslint-disable` de reglas de hooks |
| 14 · «first argument … inline function» | `useCarga(fn, …)` / `useCallback(fn)` con una función que no está escrita ahí |
| 9 · `try` sin `catch` | `try { … } finally { … }` en hooks (el compilador 1.0 no los baja) |
| 2 · otros | variable usada antes de declararse (`PaginaFonema`), `x++` a variable capturada (`CorreccionFrase`) |

Memorización a mano hoy: 141 `useMemo`, 263 `useCallback`, 25 `memo()`. Ningún `memo` usa comparador propio.

## Por interacción

Commits = actualizaciones que React agrupa (todo lo que pasa en un mismo manejador o temporizador cuenta como uno).

### 1. Estudio: tocar una opción y pasar a la siguiente tarjeta — ~6 commits, 5 de pantalla completa

| Commit | Qué lo dispara | Se repinta | ¿Cambió su dato? |
|---|---|---|---|
| 1 | `setChosen` + `celebra` (`useSesionEstudio.ts:129`) | **toda** StudyScreen: Trozos, Confetti, fila de arriba, BarraSesion, la tarjeta, las 4 opciones, MarcoImagen, BloqueVoz, HojaVeredicto oculta | solo la opción elegida y los cubitos |
| 2 | `setOrigenTrozos({x,y})` en el callback de `measureInWindow` (`:144`) | toda la pantalla | solo Trozos |
| 3 | `answer()` del store (`useSessionStore.ts:269`) | toda la pantalla | sí (veredicto, barra) |
| 4 | `setEsperando(true)` (`HojaVeredicto.tsx:90`) | la hoja | nada visible |
| 5 | «Siguiente»: `setChosen(null)`, `setOrigenTrozos(null)`, `next()` (agrupado) | toda la pantalla + tarjeta nueva | sí |
| 6 | 400 ms después `set({avanzando:false})` (`useSessionStore.ts:112`) | **toda la pantalla otra vez** | solo el `disabled` de «Saltar» |

Además: escribir en Dictado/Escribir repinta la tarjeta entera por tecla (`typed` vive en `StudyCardView.tsx:77`), y
`useMovimientoReducido` hace un `setState` asíncrono en cada instancia al montar (con «reducir movimiento» prendido,
un commit más por instancia y por tarjeta).

### 2. Cázala: marcar una casilla — 1 commit (+1 posible por `onLayout`)

Se repintan CazalaScreen, Header, BarraSesion, BloqueEscucha y **los 6 renglones** (sin memo, `onPress` en línea sobre
un `toggle` que cambia de identidad en cada marca, `useRondaCazala.ts:114`), aunque solo cambia uno. `RenglonCaza`
guarda un objeto nuevo en cada `onLayout` aunque el tamaño sea el mismo (`RenglonCaza.tsx:64`).

### 3. Colmena: colocar una letra — 1 commit (acierto) · 4 commits (letra equivocada)

Bien: los `Hexagono` y `ContornoHex` son memo y solo se repinta el tocado. Mal: la pantalla entera (Header,
RelojRonda, BloqueEscuchar, PieColmena, `Panal` que rehace su Map) por cada letra; **todas las ranuras** en la primera
letra y con cada pista (`onda` depende de `aterriza`, `RanurasPalabra.tsx:219`). Letra equivocada: `setFalloLetra` →
efecto en Hexagono (`setConAviso`, `setSacude`) → temporizador `setSacude(false)` → temporizador que baja
`falloLetra`: 4 commits, dos de pantalla completa. Al cambiar de ronda, un efecto en `[idx]` repite los reinicios que
ya hizo `avanzarRonda` (`useRondaColmena.ts:144-151`).

### 4. Dulces: intercambiar piezas — 2 commits sin línea · ~2 + 3N con N pasos de cascada

Bien: solo se repintan las 2 `Pieza` intercambiadas. Mal: la pantalla entera por cada paso; el gesto de arrastre se
reconstruye dos veces por jugada (`bloqueado` en las deps del `useMemo`, `TableroDulces.tsx:321`); cada paso de
cascada crea un objeto nuevo para **todas** las metas (`sumarAMetas`, `usePartidaDulces.ts:227`) y rompe el memo de
cada `MetaFrase`, aunque su color no haya sumado nada.

### 5. Practicar: abrir y cerrar un grupo — 1 commit de pantalla completa

La suscripción a `practicarGruposAbiertos` está en la raíz (`usePracticar.ts:61`) y ningún hijo es memo: se repintan
**los 4 lienzos de Skia** (FondoAurora con LuzAurora y GranoFino, OndaSenal, las portadas, MedidorVU), el encabezado,
ConsolaHoy, Destacados, todos los grupos y todas las filas, aunque solo cambia un grupo. Causas: `fondo={<FondoAurora/>}`,
`onIr`, `datoDe`, `onAlternar` y `meta={metaDe(...)}` nuevos en cada render.

### 6. Buscadores — Phrasal por tecla repinta toda la lista

- **Phrasal** (207 verbos en 55 grupos): la consulta filtra en cada tecla sin diferir (`usePhrasal.ts:49`),
  `buscarGrupos` normaliza el texto de las 207 formas cada vez (`domain/phrasal.ts:41`) y crea arreglos nuevos para cada
  grupo, así que el `memo(RenglonVerbo)` no sirve: **todos los renglones montados se repintan por tecla**.
- **Vocabulario**: ya tiene debounce de 150 ms y consulta a SQLite con `LIMIT 30`; aun así `setTerm` repinta la pantalla
  completa (con la cuadrícula de mundos) por tecla.
- **Errores** no tiene buscador de texto: filtra con chips (194 tarjetas, barato). Cada chip recibe un `onPress` en
  línea y la lista se vuelve a montar a propósito por la animación de entrada (`key` de la FlatList).

### 7. Cambiar un ajuste y volver a Practicar — 1 commit (bien acotado)

Cambiar «Sonidos» repinta solo Ajustes. Pero `useAjustes.ts:21` y `usePrimerosPasos.ts:13` leen **el store completo**:
cualquier llave (incluida `practicarGruposAbiertos` o `loaded`) los repinta y rehace sus callbacks. Cambiar la meta
diaria sí repinta Practicar, que está atrás (la usa). Al volver: solo los lienzos que miran el foco (`useSenalActiva`),
que es legítimo; `useCarga` recarga en silencio y no repinta si los datos son iguales.

### 8. Cambiar de pestaña — 1 commit, bien acotado

Las pantallas no se repintan (React Navigation las congela). La barra sí: `screenOptions` rehace `tabBarStyle`,
`tabBarBackground` y `tabBarIcon` para las 3 rutas en cada render y la barra (`BottomTabBar`) no es memo, así que los 6
íconos (activo e inactivo de cada pestaña) se repintan, incluidos los 2 de la pestaña que no cambió.

## Lo que se repinta sin que cambie su dato (resumen)

| # | Qué | Causa | Arreglo |
|---|---|---|---|
| 1 | Toda StudyScreen, 5 veces por tarjeta | estado de un hijo (`origenTrozos`, `avanzando`) en la raíz; nada memo; props en línea | compilador + mover ese estado a quien lo pinta + un commit por toque |
| 2 | Los 4 lienzos de Skia de Practicar al abrir un grupo | suscripción en la raíz; `fondo`, `onIr`, `datoDe`, `metaDe()` nuevos | compilador + selector y estado del grupo en el propio grupo |
| 3 | Los 6 renglones de Cázala por marca | sin memo, `toggle` inestable | compilador (o memo + callback estable) |
| 4 | Todas las `MetaFrase` en cada paso de cascada de Dulces | objeto nuevo por meta aunque no cambie | conservar el objeto si no sumó |
| 5 | Todas las ranuras de Colmena en la 1.ª letra y con pistas | `onda` depende de `aterriza` | pasar el dato base, no el derivado |
| 6 | 3 commits de más con letra equivocada en Colmena; efecto `[idx]` que repite reinicios | estado reiniciado en efectos y temporizadores | reiniciar en el manejador o con `key` |
| 7 | Todos los renglones de Phrasal por tecla | arreglos nuevos por grupo + sin diferir | `useDeferredValue` + texto normalizado precalculado + grupos estables |
| 8 | Ajustes y Bienvenida con cualquier ajuste | store completo | `useShallow` con lo que usan |
| 9 | La tarjeta completa por tecla en Dictado/Escribir | `typed` en la tarjeta | el texto vive en `ZonaEscribir` |
| 10 | Íconos de la pestaña que no cambió | `screenOptions` con funciones nuevas | opciones y `tabBar` estables |

Estado y reglas: no hay mutación de estado (ningún `push`/`splice`/asignación sobre estado). Efectos que copian o
reinician estado: `useNivel.ts:21` (copia una prop), `StudyCardView.tsx:130`, `MarcoImagen.tsx:76`,
`useReproductorCapitulo.ts:77`, `useRondaColmena.ts:143`. Keys por índice que pueden dar problema:
`CorreccionFrase.tsx:102` (piezas con animación `exiting`/`layout` que cambian con la frase) y `Oracion.tsx:122`; las
demás son listas fijas por ronda o por tema. Navegación: ninguna pantalla usa `setOptions`; `screenOptions` del
`Stack.Group` y un `options` en línea en `RootNavigator`.

**Dos cosas que no son re-renders pero salieron al leer** (no las toco sin tu OK):
- `shared/ui/Input.tsx:36-44`: `{...rest}` va después de sus `onFocus`/`onBlur`; si una pantalla pasa los suyos, el borde
  de foco deja de funcionar.
- `useSettingsStore(s => s.filter)` es una función estable: las cargas que dependen de `[user, filter]` no se rehacen al
  cambiar niveles o Modo Limpio, solo al volver a enfocar la pantalla.

## Plan (fase 2, en este orden)

- **A · React Compiler y sus reglas.** `experiments.reactCompiler: true` en `app.json`. Codemod con el checador de
  TypeScript: `sv.value = x` → `sv.set(x)` y lecturas fuera de worklets → `sv.get()` (solo donde el tipo es un
  `SharedValue`); refs leídas en render pasan a estado o a efectos; `try/finally` → `try/catch/finally`; los
  `eslint-disable` de hooks se resuelven sin apagar la regla. Meta: **0 funciones sin compilar** y 0 avisos del plugin.
  Luego se quitan los `useMemo`/`useCallback`/`memo` que el compilador ya cubre, dejando los que protegen algo que el
  compilador no ve (worklets, dependencias de gestos de Reanimated, identidades que cruzan a código nativo), con
  comentario.
- **B · Selectores.** `useShallow` en Ajustes y Bienvenida; el estado del grupo abierto baja al grupo; `avanzando` y
  `origenTrozos` salen de la raíz de Estudio.
- **C · Contextos estables.** Solo hay 2 (`IndicePestana`, primitivo, y `EsqueletoContexto`, un shared value estable):
  se revisan y se dejan; `tabBar` y `screenOptions` estables.
- **D · Estado derivado y efectos.** Los reinicios en efectos pasan al manejador o a `key`; `useNivel` deriva en vez de
  copiar; un toque = un commit en Estudio (el origen de los cubitos se mide junto con la elección) y en Colmena.
- **E · Keys y renglones.** `CorreccionFrase` y `Oracion` con key del dato; renglones de Cázala y metas de Dulces
  estables.
- **F · Buscadores.** Phrasal con `useDeferredValue` y texto normalizado precalculado; Vocabulario con
  `useDeferredValue` sobre la lista (el debounce de la consulta ya existe).
- **G · Navegación.** `screenOptions`, `tabBar` y opciones de grupos estables.

## Cómo medir en el Xiaomi (ANTES y DESPUÉS)

Build de desarrollo o de perfilado (el release no trae el Profiler) → React Native DevTools → Profiler → «Highlight
updates when components render» → grabar cada una de las 8 interacciones → anotar el **commit más largo** y qué se
iluminó. Una vez en `antes-de-rendimiento` (o en el commit anterior a este prompt) y otra al terminar.
