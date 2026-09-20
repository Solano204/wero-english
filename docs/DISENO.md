> **Documento histórico. El sistema vigente está en `DESIGN.md`.** No se edita más.

# WERO · DISEÑO

Referencia del sistema visual v4.0. Si vas a tocar UI, léelo antes.
Formato `DESIGN.md`: cualquier agente de código lo lee como documento de
restricciones.

---

## 1. Tema visual y atmósfera

**Neón nocturno.**

Wero enseña el inglés que no está en los libros: jerga de calle, AAVE,
hip-hop, oficina. Ese idioma se aprende de oído y vive de noche, en
letreros y bocinas. De ahí sale la dirección: tinta azul profunda y un
cian eléctrico que suena a señal de audio.

Tinta `#0A0F16`, no negro puro: el negro absoluto produce halo en paneles
OLED y hace vibrar el texto claro en sesiones largas.

---

## 2. Por qué el acento es cian y no ámbar

Esto no es gusto, es una restricción que sale del propio producto.

El sistema ya reservaba el ámbar para el **fallo**, con esta razón escrita
en `tokens.ts`:

> El fallo es ámbar, nunca rojo: el usuario va a fallar cientos de veces
> por diseño y cómo se siente eso decide si sigue en la semana 4.

Es una decisión correcta y se mantiene intacta. Pero implica que el ámbar
está ocupado: **si la marca fuera ámbar, el color de "te equivocaste"
sería el color de la app.**

El cian queda libre, contrasta con todo el resto de la semántica y encaja
con el tema. Se queda.

---

## 3. Paleta y roles

| Rol | Token | Hex |
|---|---|---|
| Base | `bg` | `#0A0F16` |
| Fondo hondo | `bgFin` | `#06090D` |
| Tarjetas | `surface` | `#141D28` |
| Superficie alta | `surfaceAlt` | `#1A2532` |
| Superficie máxima | `surfaceHigh` | `#22303F` |
| Texto | `text` | `#EAF2F9` |
| Texto 2 | `textMuted` | `#B4C2CE` |
| Texto 3 | `textFaint` | `#90A2B4` |
| **Acento** | `accent` | `#45D9FF` |
| Sobre acento | `onAccent` | `#04141C` |
| Contraste | `contraste` | `#0B3A50` |
| Acierto | `correct` | `#4ADE9B` |
| **Fallo** | `wrong` | `#F2B33D` (ámbar, nunca rojo) |
| Explícito | `riskStrong` | `#FF7A66` (el único rojo) |

Texto encima del cian: **tinta, nunca blanco**. Blanco sobre cian no pasa
contraste y se ve lavado.

### Tabla de contrastes (AA, ratio ≥ 4.5)

| Texto | sobre `bg` | sobre `surface` | sobre `surfaceAlt` | sobre `surfaceHigh` | sobre `contraste` |
|---|---|---|---|---|---|
| `text` | 17.0 | — | — | — | — |
| `textMuted` | 10.6 | — | — | — | 6.7 |
| `textFaint` | 7.3 | — | — | — | 4.6 |
| `accent` | 11.6 | — | — | — | — |
| `correct` | 11.2 | — | — | — | — |
| `wrong` | 10.3 | — | — | — | — |
| `riskStrong` | 7.5 | — | — | — | — |
| `onAccent` sobre `accent` | 11.3 | | | | |

Los ocho colores de `world` van de 6.3 a 11.2 sobre `bg` y de 5.6 a 5.9 sobre
`surface`: pasan. **Cautela:** `accentDeep` sobre `contraste` da 4.37 — solo
para elementos no textuales ahí. Blanco puro sobre `accent` da 1.66: si
aparece en algún sitio es un bug, usa siempre `onAccent`.

### La superficie de contraste

Hay **una sola** en toda la app: la tarjeta de "frases que ya te sabes"
en Home. Antes era la única oscura sobre crema; ahora es la única con
color sobre tinta. Mismo papel, invertido. Si hubiera dos, dejaría de
funcionar.

---

## 4. La luz: una sola fuente

Todo brillo de canto y toda sombra obedecen al mismo ángulo: **arriba a
la izquierda**. Está en `sol` y se pasa como `start`/`end` de cada
`LinearGradient`. `Screen` pinta ese sol como un resplandor cian visible
en la esquina.

Cuando cada tarjeta inventa su propia luz, el ojo detecta la mentira
aunque no sepa nombrarla.

### Filo de luz

`filoLuz` es un degradado de tres paradas. Se pinta como envoltura de 1px
por detrás de la superficie: brilla del lado del sol y se apaga del
opuesto.

```tsx
<LinearGradient colors={filoLuz} start={sol.start} end={sol.end}
                style={{ borderRadius: 28, padding: 1 }}>
  <View style={{ borderRadius: 27, backgroundColor: color.surface }}>
    {contenido}
  </View>
</LinearGradient>
```

React Native no tiene `mask-composite`, así que el borde degradado se
consigue con este anidamiento. `Card` ya lo hace: **no armes tarjetas a
mano.**

**Un borde sólido de 1px no es equivalente.** El punto es que brille de un
lado y se apague del otro. Un borde parejo convierte una lista en una
reja; el filo la convierte en capas de vidrio.

---

## 5. Profundidad

En claro la sombra separaba por sí sola. En oscuro no hay contraste de
luminancia que aprovechar: **la separación la hace el filo, la sombra da
altura.** Por eso pasaron de tintadas y suaves a negras y densas.

- `soft` — controles
- `card` — tarjetas
- `raised` — la que manda
- ~~`glow`~~ — halo cian; se eliminó (IA-3: sin sombras de color). La acción principal usa `soft`

Regla: una sombra negra bajo un botón encendido no se ve. Lo que le da
volumen es el halo de su propio color.

---

## 6. Desenfoque

`BlurView` cuesta una vista nativa y en Android se siente al hacer scroll.
Va **solo donde hay algo detrás que se mueve**: la barra de pestañas.

Para una tarjeta, el filo de luz da el mismo efecto de vidrio a coste
cero. `tint="dark"` siempre: un desenfoque claro sobre tinta produce
niebla lechosa que ensucia el texto.

---

## 7. Movimiento

Todo con reanimated, en el hilo de UI, para que no se trabe cuando el
hilo de JS está ocupado montando una pantalla.

- `Button` — escala con muelle al presionar
- `ProgressBar` — crece con `Easing.out(cubic)`; **nunca retrocede**
- `TabNavigator` — pastilla de cian que crece bajo la pestaña activa

Duraciones en `duration`: instant 120 · fast 180 · base 240 · slow 380 ·
reveal 520.

---

## 8. Reglas duras

- **Un acento.** El cian es lo más encendido de la pantalla. Los colores
  de mundo van un paso por debajo en saturación a propósito.
- Semántica intocable: acierto verde, **fallo ámbar (nunca rojo)**, rojo
  solo para lenguaje explícito.
- Tarjetas sin borde parejo: filo de luz.
- Texto sobre acento: `onAccent`, nunca blanco.
- Todo estilo de texto declara `color`, o lo recibe por merge. Un
  `fontSize` sin `color` renderiza en el negro por defecto de React
  Native: sobre crema apenas se notaba, sobre tinta es invisible.
- Todo par texto/fondo pasa AA.

---

## 8 bis. Errores ya cometidos (no repetir)

**`style` aplicado a la envoltura del filo.** Al introducir el filo de
luz, el `style` que pasan las pantallas se movió a la envoltura exterior.
Pero varios de esos estilos traen `padding` (`hero` lleva
`paddingVertical: xl`; la tarjeta de Modo oído lleva `xxxl`). Aplicado a
la envoltura, ese padding se convierte en un marco visible alrededor del
cuerpo: **se ve una tarjeta dentro de otra**.

`Card` ahora reparte el `style`: lo que sitúa la tarjeta en la página
(margen, ancho, alineación, posición) va a la envoltura; lo que ordena su
contenido (padding, gap, alineación interna) va al cuerpo. Si añades una
envoltura nueva a cualquier componente, haz el mismo reparto.

**El acento en la envoltura.** La línea de categoría quedaba 1px por
fuera del cuerpo y se leía despegada. Va dentro.

**Huecos de imagen sin tratar.** Un `View` gris de 200×200 se lee como un
error de carga, no como una imagen pendiente. `SceneImage` y la portada
de `Card` dibujan ahora un marcador con filo de luz y la inicial en
grande: mientras no exista el archivo la pantalla se ve terminada, y
cuando lo metas ocupa el mismo espacio sin mover nada.

**`textFaint` fallaba AA en las cinco superficies.** `#68798B` daba entre
2.71 (sobre `contraste`) y 4.30 (sobre `bg`): nunca pasaba 4.5, y lo usaba
`text.tiny` a 11 px, el texto más pequeño de la app con el peor contraste.
Subió a `#90A2B4` (7.3 sobre `bg`, 4.6 sobre `contraste`) y `textMuted` subió
en la misma proporción a `#B4C2CE`, manteniendo los saltos de luminancia
entre los tres niveles de jerarquía. Ver la tabla de arriba.

**`text.tiny` en mayúsculas sostenidas.** Llevaba `textTransform: 'uppercase'`
y `letterSpacing: 0.7` a 11 px: las versalitas a ese tamaño se leen peor, no
mejor, y son el tic más reconocible de plantilla. Ahora va en sentence case,
sin tracking, a 12 px (`font.size.xs` subió de 11 a 12: 11 es el suelo de
legibilidad) y en `textMuted` en vez de `textFaint`.

**22 colores sueltos fuera de `tokens.ts`.** La guía decía "un único hex
suelto"; con el tiempo se acumularon 22 entre hex y `rgba(` repartidos en
ocho archivos (bandas de FeedbackBand, marcador de SceneImage, velos de
Card/MuroDesbloqueo/TabNavigator, resplandor de Screen, carril de
ProgressBar, bisel de una pieza de Dulces, e icono de notificación de
Android). Todos subieron a `color` con nombre semántico
(`correctFondo`/`wrongFondo`, `textSobrePortada`, `veloPortada`,
`veloMuro`, `veloBarra`, `accentBorde`, `trackFondo`, `biselSombra`,
`shadow`, `notifAndroid`) o se unificaron con un token que ya existía
(`gradiente.neutro`). `npm run check:color` ahora falla si aparece un hex o
`rgba(` fuera de `src/theme/`.

**`state` nulo desde la base de datos.** `getSessionCards` hace LEFT JOIN
contra `tarjeta`, así que devuelve `state: null` para toda entrada nunca
estudiada. Con el plan diario casi no pasaba; desde que son frases al
azar de las 1,524, en una cuenta nueva vienen **todas** así, y
`StudyCardView` reventaba al leer `card.state.repeticiones`.

El estado inicial se materializa ahora con `newCardState()` en
`useSessionStore`, en el borde entre la base de datos y el motor: de ahí
hacia dentro `state` siempre existe y nadie más tiene que comprobar null.
El error de tipos que avisaba de esto llevaba ahí desde antes del
rediseño.

---

## 8 ter. Desbloqueo por anuncio

El trato, y está escrito porque decide cada detalle de `db/unlock.ts`:

> Ves un anuncio **una** vez y esa parte queda abierta **para siempre**,
> también sin internet. No se vuelve a pedir.

Vive en la base local, no en un servidor: si dependiera de la red, quien
ya pagó con su atención volvería a encontrarse el muro en el metro. Eso
es cobrar dos veces.

Las claves llevan prefijo (`pack:`, `juego:`, `lectura:`, `gramatica:`,
`mundo:`) en un solo espacio de nombres, así que abrir algo nuevo es una
clave nueva y ni una migración.

**Lo que NUNCA va detrás del muro:** la sesión de frases al azar, el
progreso propio y los ajustes. Se cobra por contenido extra, no por usar
la app. Los primeros tres temas de cada bloque de gramática también van
abiertos: quien llega ahí trae una duda concreta y tiene que poder
resolver algo antes de que se le pida nada.

---

## 8 quater. Errores de cabecera y de aire

**`right` anulaba el botón de salir.** `Header` pinta
`right ?? (onClose ? … : null)`. Al pasar `right`, el `onClose`
simplemente no existía: en la sesión de estudio y en varios juegos no
había NINGUNA forma de volver. La regla ahora es **`onBack` a la
izquierda** siempre; `right` es para lo demás y no compite con nada.

**El lado derecho recortaba su contenido.** Tenía `width: 56` fijo, así
que "Saltar" se leía "S…". Ahora crece con su contenido y solo reserva
un mínimo.

**Aire dentro de las tarjetas.** `Card` no tenía `gap`, así que título,
cuerpo y etiqueta quedaban pegados y cada tarjeta se leía como un
párrafo en vez de como tres cosas distintas. El `gap` por defecto vive
en `Card`, no en cada pantalla: era el mismo problema repetido en todas
las secciones. Una pantalla que necesite otro aire lo pasa en `style` y
gana, porque el estilo propio se aplica después.

**Listas de opciones.** Pasaron de `gap: sm` a `gap: md`. Con cuatro
pastillas altas pegadas, la lista se lee como un bloque y el dedo tiene
que apuntar.

---

## 8 quinquies. Reacción al acertar y al fallar

Tres piezas en `components/feedback`, compartidas por los cinco juegos y
por la sesión de estudio:

| Pieza | Qué hace | Cuándo sale |
|---|---|---|
| `Reaccion` | 👍 sube y gira · 😔 se hunde | En cada respuesta |
| `Trozos` | La caja revienta en 12 cubitos con gravedad | Solo al acertar |
| `Estrellas` | Estallido de 9 estrellas en abanico | Solo al acertar |

`useReaccion()` guarda el estado. **Las animaciones se relanzan cambiando
un número, no con un temporizador que las apague:** así dos aciertos
seguidos no se pisan y no hay nada que limpiar al desmontar.

**Por qué el fallo es una cara triste y no una equis roja.** La equis
corrige, la cara acompaña. Aquí el usuario va a fallar cientos de veces
por diseño, y cómo se siente eso decide si sigue en la semana cuatro. Es
la misma razón por la que el fallo es ámbar y nunca rojo.

La cara triste dura 700 ms y la del acierto 900. La celebración puede
durar; el regaño no.

**Qué NO dispara cara triste.** En Dulces, un intercambio que no arma
línea no es un fallo: no te equivocaste, simplemente no armó. Lleva un
golpecito seco y nada más. Poner cara de pena ahí castigaría explorar,
que es justo lo que el juego pide.

**Presupuesto de partículas.** 12 cubitos y 9 estrellas, no 40 y 30. Cada
una es una vista animada y el estallido tiene que salir en el mismo
fotograma del acierto: si llega tarde, deja de sentirse como consecuencia
de lo que hiciste.

**Todo en píxeles.** Dentro de una vista absoluta no se usan porcentajes
en alto ni en márgenes (ver la sección de errores ya cometidos). El
contenedor del estallido mide 1×1 y no 0×0: en Android una vista sin área
puede no dibujar sus hijos absolutos.

---

## 8 sexies. Tres pestañas, no cuatro

Se quitó **Hoy**. Era la pantalla del plan diario, y sin plan diario ya no
le quedaba trabajo propio: su tarjeta de sesión vive ahora en Practicar,
arriba de todo, que es donde la gente la busca.

Orden de la barra: **Vocabulario · Practicar · Progreso**.

La app arranca en **Practicar**, no en Vocabulario. La primera es donde
está "Frases al azar", que es la acción principal; abrir en una lista de
navegación en vez de en la acción baja el uso. Si se quiere cambiar, es
`initialRouteName` en `TabNavigator`, una línea.

`Main` sigue siendo el navegador de pestañas, así que los destinos de
notificación (`NOTIF_TARGETS`) siguen funcionando sin tocar nada.

### El progreso lo alimentan los cinco juegos

`applyGameGrade` se llama desde Colmena, Pares, Dulces, Caída y Cázala.
Cázala era la única que no lo hacía: se jugaba, se acertaba, y en
Progreso no se movía nada.

Todos entran como `'reconocer'` y no como `'producir'`: marcar una
opción en una lista es más fácil que decir la frase en frío, y el motor
SM-2 tiene que saberlo o la frase se daría por dominada antes de tiempo.

### Qué feedback lleva cada juego

| Juego | Cara | Cubitos | Estrellas |
|---|---|---|---|
| Caída | ✓ | ✓ | |
| Cázala | ✓ | ✓ | |
| Colmena | | ✓ | |
| Pares | | ✓ | |
| Dulces | | ✓ | ✓ |
| Estudio | | ✓ | |

La cara solo sale en Caída y Cázala, que son los dos de ritmo rápido
donde una reacción grande cabe sin estorbar. En los de tablero taparía
justo lo que hay que mirar.

---

## 8 septies. Las barras de abajo no tapan contenido

La barra de pestañas **flota** sobre el contenido, así que la última
tarjeta de cualquier lista quedaba debajo y no se podía leer ni tocar.

`Screen` reserva el hueco leyendo `BottomTabBarHeightContext`. Se usa el
contexto y no `useBottomTabBarHeight()` porque ese **lanza** si no hay
pestañas, y `Screen` se usa en las dos situaciones: dentro de las
pestañas y en pantallas del Stack que las tapan. Fuera de las pestañas
devuelve `undefined` y no se reserva nada, que es lo correcto — reservar
ahí dejaría un agujero muerto al final de cada detalle.

La barra de anuncios va **debajo** del navegador y ya absorbe el inset
del teléfono, así que la de pestañas no lo suma otra vez: solo deja aire
para que las dos no se lean como una sola franja pegada. Una línea fina
las separa.

### Los emojis se quitaron

Estuvieron una versión en los juegos y salieron de toda la app. Un emoji
grande encima del tablero tapa justo lo que hay que mirar, y en los
juegos rápidos llega tarde a su propio acierto. Los cubitos de `Trozos`
hacen el mismo trabajo sin robar la pantalla.

`useReaccion` conserva `falla()` vacío a propósito: si mañana el fallo
vuelve a tener señal propia, se implementa ahí y no hay que tocar cinco
pantallas.

---

## 8 octies. Fuera la pantalla de cierre

Se eliminó **"Listo por hoy"** (`SessionEndScreen`). Era una pantalla
entera para decir "0 respondidas, 0%". Cuando la sesión valía la pena,
el número que importa ya vive en Progreso; cuando no, era una pared
entre el usuario y la salida.

**Lo que esa pantalla también hacía** era programar la siguiente
notificación. Al borrarla eso habría desaparecido sin avisar, así que se
mudó a `StudyScreen`, donde de verdad termina la sesión. Si mañana se
borra otra pantalla, conviene mirar antes qué efectos secundarios tenía
además de pintarse.

Con la pantalla fuera, `salidaManual` dejó de decidir nada y se quitó:
salir y terminar acaban en el mismo sitio.

### La gráfica de tres semanas

`getRecentDays` solo devuelve los días **con** registro. Con un único día
jugado, ese hueco tenía `flex: 1`, se comía el ancho entero y la gráfica
se veía como un rectángulo azul macizo.

Ahora se arma la ventana completa de 21 días y los días sin registro
entran en cero. Una gráfica de tres semanas tiene que enseñar tres
semanas, **incluidas las vacías**: los huecos son justo la información
que se busca ahí. El radio de la barra bajó de 14 a 3, porque con 14
sobre una barra de 12px los extremos se comen la forma.

### Botones de altura distinta en una fila

El pie de "Al azar" tenía un botón fantasma (44 de alto) junto a uno
grande (58). No hay `alignItems` que arregle eso: uno siempre flota.
Cuando dos acciones no comparten altura, **se apilan**.

---

## 8 nonies. Movimiento reducido y accesibilidad

`useMovimientoReducido()` (en `src/utils/accessibility.ts`) envuelve
`AccessibilityInfo` con su listener de cambios. Con movimiento reducido
activado:

- `Trozos`, `Estrellas` y `Confetti` no se montan, ni un cuadro: la señal
  de acierto queda en el cambio de color y el háptico, que ya existían.
- `Button` salta directo a la escala final en vez de pasar por el muelle;
  `TabNavigator` (la pastilla) y `ProgressBar` saltan directo en vez de
  animar con `withTiming`.
- `FeedbackBand` aparece sin desliz ni fundido.

No se tocaron el resto de las piezas de reanimated (los fundidos de
entrada de `Card`, `SceneImage`, `MuroDesbloqueo`, etc.): son fundidos
cortos, no disparan vestíbulo, y recorrer los ~30 archivos que usan
reanimated se quedó fuera de esta fase. Queda como propuesta.

`FeedbackBand` ahora anuncia el resultado con
`accessibilityLiveRegion="polite"` y una `accessibilityLabel` con el
veredicto y la respuesta: antes un lector de pantalla no se enteraba de
si acertaste.

`accessibilityHint` nuevo en `AudioButton`, las fichas de `TileBuilder` y
el botón de `MuroDesbloqueo` (que ahora acepta la prop): los tres tenían
un efecto que el label solo no explicaba.

Las cifras grandes de los juegos (el marcador de `GameEndScreen` y el
marcador/número final de `CaidaScreen`) llevan `maxFontSizeMultiplier={1.2}`
para no romper el layout al 200% de fuente del sistema. Las frases,
traducciones y lecturas no llevan tope: escalan libres.

---

## 9. Guía para el agente

- Usa **solo** tokens de `@/theme`. `npm run check:color` falla si aparece
  un hex o `rgba(` fuera de `src/theme/`; corre en el mismo momento que
  `typecheck` y `verify`.
- Para una tarjeta, `<Card>`. Para una pantalla, `<Screen>`. Ninguna
  pantalla redefine fondo, safe area ni padding.
- Todo `LinearGradient` de superficie lleva `start={sol.start}
  end={sol.end}`.
- Antes de añadir una tarjeta, comprueba que contiene una interacción. Si
  al quitarle filo, sombra y fondo no se pierde nada, era una sección.
- Antes de entregar: quita un elemento.

---

## 10. Volver al tema claro

Todo el color vive en `src/theme/tokens.ts`. La versión crema y ámbar
está en el historial del archivo. Cambiar de vuelta es cambiar ese
archivo y cuatro detalles: `tint` de `BlurView` en `Card`, el velo de
portada, `dark` en `navigation/theme.ts`, y el resplandor de `Screen`.
