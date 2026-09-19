# Prompts de las portadas

Dieciocho imágenes: ocho mundos y diez juegos. Van en `assets/img/mundos/`
y `assets/img/juegos/`, en `.webp`, y las rutas exactas están en
`src/theme/portadas.ts`.

**Mientras no existan, no pasa nada.** La tarjeta usa su degradado y se ve
bien. Se pueden ir metiendo de una en una y aparecen solas.

---

## Antes de generar, lee esto

Las dieciocho tienen que verse como una familia, no como dieciocho
imágenes bonitas sueltas. Lo que las une son cuatro reglas, y van en
**todos** los prompts sin excepción:

1. **Formato apaisado, 3:1.** Son fondos de una fila de lista, no
   cuadros. Una imagen cuadrada recortada a 3:1 pierde justo lo que
   estaba en el centro.

2. **Composición a la derecha, izquierda vacía.** Encima va texto blanco
   alineado a la izquierda. Si el sujeto está centrado, el título le cae
   encima y no se lee ninguno de los dos.

3. **Oscuras de por sí.** La app las oscurece un 34% más con un velo. Si
   generas una imagen clara y brillante, con el velo se ve gris sucia.
   Pide sombras marcadas y fondo oscuro desde el prompt.

4. **Sin texto dentro.** Ninguna letra, ningún número, ningún cartel
   legible. El texto lo pone la app y dos textos encimados se ven a
   error, no a diseño.

**Estilo base** (pégalo al final de cada prompt):

> Ilustración digital editorial, 3D suave con acabado mate, iluminación
> cinematográfica lateral, fondo muy oscuro, sombras profundas, paleta
> reducida a dos o tres colores, sujeto desplazado a la derecha del
> encuadre con el tercio izquierdo casi vacío, sin texto ni letras, sin
> logotipos, relación de aspecto 3:1.

---

## Los ocho mundos

**calle.webp** — Calle y jerga
> Una banqueta de ciudad de noche vista de cerca: tenis desgastados, una
> lata aplastada, luz de neón naranja rebotando en el concreto mojado.
> Nadie de cuerpo entero, solo el detalle a nivel del piso. Dominante
> naranja rojizo sobre negro.

**dinero.webp** — Dinero y trabajo
> Un escritorio de noche visto en diagonal desde arriba: una taza fría, un
> teclado, una libreta cerrada, la luz azulada de un monitor fuera de
> cuadro. Sin manos, sin caras. Dominante verde profundo sobre carbón.

**dia_a_dia.webp** — Día a día
> Una cocina chica al amanecer: una jarra, dos tazas, un trapo colgado,
> la luz entrando de lado por una ventana que no se ve. Íntimo y en
> calma. Dominante azul con un punto de luz cálida.

**gente.webp** — Gente y vínculos
> Dos sillas viejas juntas en una azotea de noche, vacías, con las luces
> de la ciudad borrosas al fondo. La ausencia de personas es el punto.
> Dominante rosa magenta sobre azul muy oscuro.

**cultura.webp** — Cultura y escuela
> Una pila de libros usados y un cuaderno abierto en blanco sobre una
> mesa de madera, luz de lámpara de escritorio en diagonal. Dominante
> violeta sobre café oscuro.

**tech.webp** — Tecnología
> Un cable de red y una placa de circuito fotografiada muy de cerca, con
> profundidad de campo corta y una luz cian pasando por encima. Abstracto,
> casi textura. Dominante cian sobre negro azulado.

**legal.webp** — Legal y trámites
> Un fólder de papel manila abierto con hojas parejas, un sello sin tinta
> y la sombra de una persiana atravesando la mesa. Frío y burocrático.
> Dominante gris azulado sobre gris muy oscuro.

**fonetica.webp** — Pronunciación
> Una onda de sonido tridimensional en material dorado mate flotando
> sobre un fondo negro, iluminada desde un costado. Sin micrófono, sin
> bocina, sin letras. Dominante ámbar dorado sobre negro.

---

## Los diez juegos

**colmena.webp**
> Celdas hexagonales de panal en relieve, en tono ámbar mate, con una de
> ellas levantada un poco sobre las demás. Luz rasante que marca los
> bordes. Dominante ámbar sobre negro.

**pares.webp**
> Fichas rectangulares apiladas en desorden sobre una superficie oscura,
> dos de ellas alineadas una junto a la otra. Dominante azul sobre negro.

**caida.webp**
> Dos bloques cayendo con estela de movimiento hacia una línea roja al
> pie del encuadre. Sensación de velocidad. Dominante rojo sobre gris
> muy oscuro.

**dulces.webp**
> Piezas redondeadas de vidrio de colores apiladas en cuadrícula, una de
> ellas rompiéndose en destellos. Dominante violeta y rosa sobre negro.

**judge.webp** — ¿Lo digo o no?
> Un bocadillo de diálogo tridimensional partido a la mitad, una mitad
> verde y la otra ámbar, flotando sobre fondo negro. Sin texto adentro.

**cazala.webp** — Cázala
> Una red de pescar hecha de líneas de luz atrapando pequeñas esferas
> brillantes en el aire. Dominante violeta sobre negro.

**habla.webp** — Di la palabra
> Una silueta de onda de voz saliendo de un punto de luz, en material
> naranja mate, sobre fondo negro. Sin micrófono visible.

**lecturas.webp**
> Un libro abierto de canto, iluminado desde adentro, con las páginas
> curvándose. Cálido y quieto. Dominante gris azulado con luz cálida.

**phrasal.webp**
> Dos piezas de rompecabezas separándose, una más grande y una chica, con
> luz cian entre ellas. La partícula que cambia todo. Dominante cian
> sobre negro.

**azar.webp**
> Dados de vidrio esmerilado cayendo en el aire, congelados a media
> caída, con destellos rosados. Dominante rosa sobre negro.

---

## Después de generarlas

1. Guárdalas con el nombre exacto de esta lista, en `.webp`, ancho de
   1200 px y alto de 400.
2. Ponlas en `assets/img/mundos/` y `assets/img/juegos/`.
3. Corre `npm run build:assets`. Ese script arma el mapa que Metro
   necesita, porque Metro solo entiende `require()` con ruta literal.
4. Corre `npx expo start -c`. Sin el `-c` sigue sirviendo el mapa viejo.

Si una sale mal, bórrala y la tarjeta vuelve sola a su degradado. No hay
que tocar código para quitar una imagen.
