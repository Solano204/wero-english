# QA en teléfono Android

Rama `diseno-fase-b`, 28 commits desde `master` (hasta `5b7f1`). Nada de esto se ha visto en un dispositivo.
Cubre: fuentes, contraste, áreas táctiles, Practicar, íconos, repaso espaciado (SRS), textos, avisos, cargas y errores, listas, audio, movimiento, color y espaciado.

Antes de empezar: instalar la build, aceptar micrófono y notificaciones, tener una cuenta con frases vistas y algunas vencidas. Pendiente tuyo: regenerar `aud/phrasal/5_ejemplo_en_lento.mp3` (ver sección e).

Marca cada casilla al probarla. Si algo falla, anótalo en "Cómo reportar".

## a) Arranque y navegación

- [ ] Arranque: abre sin pantalla en blanco ni error y termina en Practicar (o en Onboarding o acceso si es cuenta nueva)
- [ ] Fuentes: títulos en Bricolage Grotesque, cuerpo en Instrument Sans, IPA en Charis SIL; ningún texto en Roboto (mirar Practicar, Estudiar, Ajustes y Sonidos)
- [ ] Pestañas: Vocabulario, Practicar y Progreso; la activa se enciende y el ícono no cambia de forma
- [ ] Al tocar una pestaña se siente el toque leve y no sale el ripple de Android
- [ ] La barra de pestañas flota y el final de cada lista se puede leer y tocar; nada queda tapado
- [ ] Flecha atrás del encabezado: vuelve a la pantalla anterior desde cada pantalla abierta desde Practicar
- [ ] Swipe atrás y botón atrás de Android: vuelven igual que la flecha
- [ ] Onboarding y acceso: textos legibles, botón "Siguiente", ojo "Ver/Ocultar" de la contraseña y errores en español que dicen qué hacer

## b) Practicar

- [ ] Título "Practicar" y cuatro bloques con aire entre ellos (Hoy, Destacados, Todo lo demás, Esta semana)
- [ ] Bloque Hoy al abrir: no muestra datos falsos; si tarda más de 300 ms se ve un esqueleto quieto, y luego el contenido
- [ ] El botón de Hoy dice qué hará ("Repasar N frases", "Corregir N errores", "Seguir con X" o "Empezar") y abre ese modo
- [ ] Con más vencidas que la meta: "Tienes N pendientes"; además "Llevas N frases hoy" y "Racha: N días"
- [ ] Tres destacados con portada neutra; tocar cada uno abre su modo
- [ ] Portadas neutras: ¿Practicar se ve plano? Anotar sí o no (si sí: probar tinte con croma ≤ 0.03)
- [ ] Grupos Juegos, Oír y hablar y Leer y repasar: abren y cierran con animación suave y se recuerdan al salir y volver
- [ ] Una fila de cada grupo abre su modo; cada fila se toca cómoda (48 dp) y muestra nombre, dato y flecha

## c) Estudiar

- [ ] Desde Hoy con vencidas: primero salen las vencidas y luego las nuevas; hay al menos 3 nuevas reservadas
- [ ] "Frases por sesión" del ajuste es el tamaño de la sesión; el contador y la barra de progreso avanzan
- [ ] Acierto con opciones: la opción se pone verde y pulsa, salen cubitos y la banda dice una felicitación distinta cada vez
- [ ] Fallo a propósito: la opción tiembla y se pone ámbar (nunca roja); la banda dice "Era esta"
- [ ] La frase fallada vuelve entre 3 y 5 tarjetas después, una sola vez (si se falla de nuevo no se repite más)
- [ ] Una frase acertada no vuelve a salir en la misma sesión
- [ ] Tarjeta de armar o escribir: el bloque pulsa si aciertas y tiembla si fallas; el teclado no tapa "Revisar"
- [ ] Panel de cierre con vencidas pendientes: "Seguir repasando (N restantes)" continúa y "Terminar" sale
- [ ] Sin nada vencido: "Ya repasaste todo por hoy" con "Vuelve mañana."; "Ir a Practicar" vuelve a Practicar

## d) Juegos

- [ ] Muro de juego: pide "Ver anuncio y abrir" una vez y el juego queda abierto; el anuncio no aparece por sorpresa
- [ ] Niveles: cerrados atenuados, se baja hasta el nivel actual y solo el primer cerrado ofrece abrir con anuncio
- [ ] Acierto en cualquier juego: la pieza pulsa en verde con háptico y sonido; cubitos solo en Estudiar, Colmena, Pares, Caída y Dulces
- [ ] Fallo en cualquier juego: la pieza tiembla 3 veces en ámbar con háptico y sonido; sin partículas y sin rojo
- [ ] Fin bueno (2 o más estrellas, o 5 rondas y 70 %): confeti, sonido de nivel completo y el resumen sube
- [ ] Fin malo: el resumen entra solo con fundido, sin confeti y sin ningún sonido
- [ ] Estrellas de un nivel: probar 1, 2 y 3; son doradas (distintas del ámbar de fallo) y "Nivel N+1" abre el siguiente
- [ ] Colmena: letra correcta se agrega; letra equivocada hace temblar los huecos en ámbar; palabra completa los pone verdes con pulso y suena la frase
- [ ] Pares: par correcto, las dos fichas se ponen verdes, pulsan y se apagan mientras suenan EN y ES (Saltar funciona); par incorrecto, las dos tiemblan en ámbar y se sueltan
- [ ] Caída: ficha correcta verde con pulso; incorrecta tiembla en ámbar y termina; si la frase cae hay pausa con voz y "Siguiente"
- [ ] Dulces, pregunta: la opción elegida pulsa o tiembla y se marca la correcta; en el tablero solo salen cubitos (sin estrellas) y las 5 piezas son de colores distintos
- [ ] Cázala: elegir 3 y "Revisar"; las opciones correctas pulsan y las incorrectas tiemblan; suena la frase
- [ ] Di la palabra: pide micrófono; la tarjeta de veredicto pulsa si aciertas y tiembla si confundes; si no te entiende, solo el mensaje
- [ ] Preguntas de Lectura: ver la sección j) (una a la vez, con veredicto como en Estudio y cierre sin puntaje)

## e) Audio

- [ ] Gramática, un tema: "Escuchar todos los ejemplos" suena EN y ES en orden y "Detener" corta todo al instante
- [ ] Gramática: Inglés, Lento y Español de cada ejemplo suenan; tocar otro corta el que sonaba
- [ ] Gramática, «Escuchar todos los ejemplos»: al tocarlo el botón dice «Detener» con su ícono y el texto se lee (no una píldora cian vacía); al terminar o al tocar «Detener» vuelve a «Escuchar todos los ejemplos». Es el fallo reportado y la causa no se pudo reproducir sin teléfono: confirmar aquí y, si sigue vacío, mandar captura
- [ ] Gramática, «Escuchar todos»: cada ejemplo enciende su tarjeta (filo cian) y su karaoke, y la pantalla baja sola para mantenerlo a la vista; tocar la pantalla con el dedo suelta ese scroll
- [ ] Phrasal verbs: Escuchar y Lento de frase y ejemplo suenan; el ejemplo lento del verbo 5 suena si ya lo regeneraste, o el botón se ve apagado sin fallar
- [ ] Cázala con audio automático: tras revisar suena la frase en inglés y luego en español
- [ ] Pares: al acertar un par suenan las dos frases aunque "Audio automático" esté apagado
- [ ] Estudiar con "Audio automático": suena al aparecer la tarjeta y no se repite al mostrar el resultado
- [ ] Lecturas: "Escuchar el capítulo", Pausar, Reanudar y Detener funcionan
- [ ] Lectura: salir (atrás, cambiar de pestaña o abrir una frase subrayada) corta la voz al instante
- [ ] Sonidos: "Solo el sonido" repite en bucle; abrir otro fonema o salir lo corta; el botón Lento suena
- [ ] Botón de audio sin archivo: se ve apagado y no falla en silencio; apagar Efectos de sonido o Música en Ajustes los calla

## f) Listas y fichas

- [ ] Mi mazo: guardar una frase con la estrella la muestra ahí; vacío dice "Tu mazo está vacío"; al abrir no parpadea vacío
- [ ] Explorar: 8 mundos con punto de color, barra fina y portada neutra; el buscador con 2 o más letras muestra resultados
- [ ] Mundo: cada pack con el punto del mundo y su barra; tocar un pack abre su lista
- [ ] Pack: lista con "N frases" y "Estudiar este pack"; el scroll de 100 o más filas es fluido
- [ ] Gramática, lista: 9 bloques como tarjetas (solo uno abierto a la vez), los renglones entran escalonados; cada uno con su medidor de barras y, del cuarto de cada bloque en adelante, con candado y «Anuncio»; el lector dice «Nivel 2 de 5»
- [ ] Gramática, tema cerrado: ver el anuncio (o que falle) y volver a la lista; con éxito el candado gira y se desvanece y el renglón queda como los demás; con fallo sigue cerrado
- [ ] Gramática, tema: título grande y gancho en gris; «Cómo se arma» en fichas (una fila por cada «·») y la de «adjetivos» como texto; «Ojo» con ícono y filo cian
- [ ] Gramática, «El error que se corrige»: al llegar a la vista la frase incorrecta se tacha de izquierda a derecha y se transforma en la correcta (probar «He work in a bank» y «There is three options»); «Ver otra vez» y «Escuchar» la repiten; con frases muy distintas («I come for tourism») se ve un fundido; el lector dice «Incorrecta: … Correcta: …»
- [ ] Gramática con Reducir movimiento: las fichas aparecen ya en su lugar, el candado no gira, el karaoke solo cambia de color y el error muestra las dos frases a la vez, sin «Ver otra vez»
- [ ] Phrasal verbs, lista (360 px): los 55 verbos se mueven sin tirones; cada renglón con el verbo, «N formas» y sus partículas en una fila que se funde al final (nada de «…» a media palabra); el buscador filtra por verbo («take»), por partícula («away with») y por significado («levantarse», sin acentos ni mayúsculas); un texto sin resultados dice «Ningún verbo coincide…» y «Borrar búsqueda» la limpia
- [ ] Phrasal verbs, abrir un verbo: el verbo viaja del renglón a su lugar grande y la página entra con un fundido; abrir varios seguidos no deja tarjetas encimadas (el fallo de antes) y atrás vuelve a la lista donde estaba
- [ ] Phrasal verbs, `get` (14 formas): girar la ruleta despacio (se asienta en la que queda al centro, con un háptico) y rápido de un golpe (avanza varias y frena sin pasarse de la primera ni de la última); tocar una vecina la trae al centro; el significado da un giro vertical y la tarjeta cambia con un leve desplazamiento hacia donde giras; el scroll de abajo no se mueve al girar
- [ ] Phrasal verbs, audio: en una sesión nueva la ruleta no habla sola; después de tocar «Escuchar» (o cualquier botón de audio) cada partícula nueva suena al aparecer y su karaoke se enciende; el ejemplo resalta la partícula en cian y tocar la frase suena
- [ ] Phrasal verbs, chips y deslizar: los chips (48 dp) cambian de forma y la ruleta gira hasta ella; deslizar la tarjeta a los lados pasa a la anterior o la siguiente sin mover el scroll vertical; «N de 14» arriba a la derecha siempre coincide
- [ ] Phrasal verbs, pocas formas: `catch` (dos) funciona igual; `figure` (una) no lleva ruleta, chips ni «N de M»; `check` muestra «out (1)» y «out (2)» y `make`, «up (1)» y «up (2)», en la ruleta y en los chips
- [ ] Phrasal verbs, «Cuidado» y «Fuerte»: `put down` (dentro de `put`) lleva «Cuidado» junto a la frase; `piss off` lleva «Fuerte» y, con Modo limpio, el verbo `piss` desaparece de la lista
- [ ] Phrasal verbs con Reducir movimiento: no hay ruleta, los chips suben bajo el verbo y son el control principal, el contenido cambia sin desplazarse ni girar y el verbo no viaja
- [ ] Phrasal verbs con lector de pantalla: la ruleta se anuncia como ajustable («Partícula de get», «get up, levantarse de la cama, 1 de 14») y aumentar y disminuir cambian de partícula; los chips se leen como opciones con una elegida
- [ ] Detail: riesgo, variantes, audio y estrella funcionan; una frase inexistente dice "No se encontró la frase."
- [ ] Errores que te delatan: los chips de categoría filtran, las 194 tarjetas se mueven sin tirones y tocar una abre su ficha
- [ ] Se me atoran: lista de frases falladas 3 veces; sin ninguna dice "Ninguna por ahora"
- [ ] Progreso: racha, "N de M frases vistas" y gráfica de 21 días; al abrir no aparecen ceros falsos
- [ ] Niveles: rejilla de 5 por fila, estrellas doradas en los hechos y el número legible
- [ ] Lecturas y Sonidos: Lecturas separa Para niños y Para todos con las cerradas en "te faltan N"; Sonidos abre y cierra fonemas y filtra con sus chips
- [ ] Carga en cualquiera de estas: nada parpadea vacío; si tarda más de 300 ms se ve un esqueleto y no un espacio en blanco

## g) Ajustes y Diagnóstico

- [ ] "Frases por sesión" y "Nuevas por día" con − y +: cambian el tamaño de la próxima sesión y cuántas nuevas entran
- [ ] Modo limpio esconde las frases con groserías (comprobar en Estudiar y en Explorar)
- [ ] Diagnóstico de datos: "Cola de repaso: vencidas / de aprendizaje / fantasma" con tres números; fantasma es 0
- [ ] Diagnóstico: no existe el botón "Laboratorio de color"
- [ ] Recordatorios: activar "Frases durante el día" y esperar un aviso; el texto sale completo, sin llaves y con el número correcto
- [ ] Vibración apagada: no vibra al acertar ni al fallar; "Cerrar sesión" pide confirmación

## h) Reducir movimiento

Activar en Android: Ajustes > Accesibilidad > Quitar animaciones.

- [ ] Repetir las secciones a) a g), j), k) y l) con la opción activa; nada debe romperse ni quedar sin mostrar
- [ ] Botones, tarjetas, filas y pestañas: al tocar no escalan, solo bajan a 70 % de opacidad
- [ ] Acierto: sin pulso ni cubitos; el verde sí aparece y siguen el háptico y el sonido
- [ ] Fallo: sin temblor; el ámbar sí aparece y siguen el háptico y el sonido
- [ ] Fin bueno: sin confeti; sigue sonando el nivel completo
- [ ] Plegables de Practicar, esqueleto, barra de progreso, banda de resultado y transiciones: cambian al instante sin animar
- [ ] Listas y secciones que entran: aparecen sin deslizarse

## i) Pantalla chica y fuente grande

Ajustes del teléfono > Pantalla > Tamaño de fuente en grande o el máximo.

- [ ] Practicar y Hoy: ningún texto ni botón se corta
- [ ] Estudiar: frase y opciones legibles; se llega a la cuarta opción con scroll y ningún botón queda fuera de pantalla
- [ ] Colmena, Dulces y Pares: tablero y fichas no se desbordan y los botones siguen cómodos de tocar
- [ ] Badges, filas de frases, pestañas, Errores y Sonidos con texto largo: nada se corta ni se encima

## j) Lecturas

Marcas de oración de Polly: sin ellas el seguimiento del audio es una estimación por caracteres (funciona, pero una oración puede adelantarse o atrasarse un poco). Para generarlas: `node scripts/polly.mjs --marcas-oraciones --plan` muestra qué haría y, sin `--plan`, las pide a Polly (necesita tus credenciales de AWS) y las guarda en `assets/data/marcas_oraciones.json`. Repetir este apartado con y sin marcas.

- [ ] Lista: Para niños y Para todos; la primera de cada una es más grande; cada tarjeta dice «Te sabes N de M frases» y Fácil, Media o Difícil, sin número de 0 a 100; las cerradas dicen «te faltan N»; entran escalonadas sin saltos
- [ ] Lista con TalkBack: cada tarjeta se lee una sola vez y completa («…, te sabes 3 de 9 frases, dificultad 40 de 100, te va a costar tantito»)
- [ ] Lector con audio, seguir: «Escuchar el capítulo»; la oración que suena se resalta y el texto baja solo dejándola en el tercio de arriba, sin saltos bruscos entre oraciones
- [ ] Lector, scroll manual: con el audio sonando, arrastrar el texto con el dedo; el seguimiento se detiene y aparece «Volver a donde va el audio»; tocarlo devuelve el texto a la oración que suena y el botón se va
- [ ] Lector, atrás: con el audio sonando, la flecha y el botón atrás del sistema cortan la voz al instante; al volver a entrar el capítulo empieza arriba
- [ ] Lector, tocar una oración: con el audio sonando o en pausa, salta a ella y sigue desde ahí (en pausa, se reanuda); sin haber empezado el audio no hace nada
- [ ] Frase vista y frase nueva: «ya la viste» (gris, subrayada) y «nueva» (cian, más peso; en Android el subrayado no es punteado); tocar una frase hace pulsar su oración un instante y abre su ficha; la leyenda sale abierta la primera vez y plegada las siguientes
- [ ] Capítulo 2 antes de que cargue el audio: en una historia de varios capítulos, pasar al 2 y tocar «Escuchar» enseguida; no suena el capítulo 1, el tiempo dice «—:—» hasta conocer la duración (nunca «0:00 / 0:00») y el texto empieza arriba
- [ ] Al final del capítulo: al terminar el audio, o al llegar al final del texto, aparece «Capítulo N» o «Ver las preguntas» y el botón circular queda en secundario (nunca dos principales)
- [ ] Preguntas: una a la vez, con tres puntos arriba y la nota «No se guarda calificación…»; al responder, la correcta se enciende en verde con palomita, la elegida mal queda en ámbar con equis, las otras bajan y la explicación entra con fade; «Siguiente» (en la tercera, «Terminar») aparece en el pie; «Salir sin contestar» lleva al cierre
- [ ] Cierre: «Terminaste la historia» y «Tenía N frases nuevas para ti» (N igual a las frases en cian que había en el texto); contestando las tres, un solo destello suave; «Volver a las lecturas» regresa a la lista
- [ ] Reducir movimiento: el resaltado cambia de oración sin deslizarse, el scroll salta, no hay pulso al tocar una frase, la explicación aparece sin fade y el cierre no da destello
- [ ] TalkBack en el lector: cada frase dice «ya la viste» o «nueva, abre su ficha»; las acciones personalizadas de cada oración son «Abrir la ficha de …» y «Escuchar desde aquí»; en las preguntas se oye «Pregunta 2 de 3», la correcta dice «Correcta», la mal elegida «No era esta» y la explicación se anuncia sola
- [ ] 360 px de ancho y fuente grande: el pie no tapa el texto, las cuatro opciones caben o scrollean y «Siguiente» queda a la vista en el pie
- [ ] Consola: entrar al lector, seguir el audio y hacer las preguntas sin ningún aviso de Reanimated. Si sale uno, copiar el texto completo del aviso (el aviso original no se pudo rastrear sin teléfono)

## k) Frases sueltas

- [ ] Entrar: el mazo se baraja (la segunda y la tercera carta se abren en abanico y se juntan en menos de 0.7 s), la primera queda arriba y se asoman dos cartas detrás
- [ ] Deslizar rápido a la izquierda con un golpe corto: la carta sale con un giro leve, la de atrás sube sin parpadear y aparece una nueva al fondo
- [ ] Deslizar lento a la izquierda pasando ~1.5 cm (96 dp): sale al soltar; con menos, regresa con resorte
- [ ] Arrastre corto que regresa, en cualquier dirección; a la derecha y hacia abajo la carta apenas cede
- [ ] Deslizar hacia arriba: aparece «Guardar» arriba, al soltar la carta regresa sin cambiar de frase, el botón pasa a «Guardada» con el anillo dorado y un háptico; hacerlo en una frase que ya estaba guardada no la quita
- [ ] Indicadores: «Siguiente» a la izquierda y «Guardar» arriba aparecen con el arrastre, se iluminan al llegar al umbral y nunca salen los dos a la vez
- [ ] Botones: «Siguiente» hace lo mismo que deslizar a la izquierda; «Guardar» y «Guardada» alternan y arrancan con el estado real (una frase ya guardada en Mi mazo entra como «Guardada»)
- [ ] Audio: Escuchar, Lento, Español e «Inglés y español» suenan y el que suena se enciende; tocar la frase la reproduce con karaoke; al pasar de carta se corta la voz; con «Voz automática» suena sola
- [ ] Frase con y sin imagen: sin imagen no hay hueco ni iniciales; con imagen y si sobra alto, una franja de 96 dp arriba; una frase muy larga se ve completa (más apretada) y solo el IPA o la nota se cortan con «…»
- [ ] Sin contador arriba, IPA centrado, «Guardar» con mayúscula y la nota «Aquí no se lleva cuenta de nada. Solo pasa frases.» abajo
- [ ] Fin de las 60 frases (pasarlas con «Siguiente»): el mazo queda vacío con «Barajando…» y llega uno nuevo con su abanico; el filtro de contenido sigue aplicado
- [ ] Salir con la voz sonando (atrás o cambiar de pestaña) la corta al instante
- [ ] Reducir movimiento: sin abanico, sin arrastre ni indicadores, una sola carta que cambia con un fundido de 150 ms; los botones funcionan
- [ ] TalkBack: la frase con su IPA ofrece las acciones «Siguiente» y «Guardar» («Quitar de Mi mazo» si ya está guardada); las cartas de atrás no se leen; los grupos de audio y los botones del pie se pueden enfocar
- [ ] 360 px de ancho y fuente grande: la carta cabe sin scroll, se ven los dos botones del pie y los grupos de audio no se salen de la carta
- [ ] Consola: entrar, deslizar y guardar sin ningún aviso de Reanimated ni de Gesture Handler

## l) Errores que te delatan

- [ ] Lista sin filtro: arriba «194 errores» con el número rodando; los chips dicen su cuenta («Calcos 40» y así) y scrollean con un desvanecido a la derecha; el chip activo en `accentSoft` con borde cian
- [ ] Lista con filtro: al tocar «Calcos» el número pasa a «N de 194» rodando, la lista sale junta y entran las primeras 8 tarjetas escalonadas; el resto aparece directo; cambiar de filtro rápido varias veces no deja la lista a medias
- [ ] Orden: «Más graves primero» deja arriba los de «Cambia el significado»; «En orden» los pone como vienen; cambia el orden, sal de la app y vuelve: el orden se conserva; el orden nunca cambia cuántos hay
- [ ] Tarjeta: ✕ y lo dicho tachado, lo que entienden en ámbar cursiva con el ícono de señal rota, ✓ y lo correcto, «Para contar» en los que se pueden contar y a la derecha el medidor de 3 barras con su etiqueta en texto (sin rojo en ninguna parte)
- [ ] Detalle de un falso amigo (por ejemplo «I am constipated»): entra «Lo que dices» normal, baja el cable, a medio camino vibra y se pone ámbar y «Estoy estreñido» llega con glitch y se asienta; después se tacha «Lo que dices» y en «Lo correcto» la frase se transforma en «I have a cold»; todo en ~1.5 s
- [ ] Detalle de un error de gramática: la transformación deja lo igual en su lugar y solo se mueven las palabras distintas; con una frase muy distinta (por ejemplo «In this moment I'm busy») se ven las dos con un fundido
- [ ] Detalle de un error de pronunciación (por ejemplo «soap» / «soup»): aparece el duelo «Así suena mal» (ámbar) y «Así suena bien» (verde), cada mitad suena al tocarla y se enciende mientras suena
- [ ] «Ver otra vez» repite toda la secuencia sin dejar restos (cable, glitch o tachado a medias); pulsarlo a mitad de la secuencia también la reinicia limpia
- [ ] Karaoke: al terminar la secuencia, tocar «Escuchar» ilumina la frase de «Lo correcto» palabra por palabra; «Lento» también
- [ ] Compartir: solo sale en los que tienen «Para contar»; abre el menú del sistema con «Decía «…» y lo que entienden es «…». Se dice «…». Lo aprendí con Wero.»; cancelar el menú no muestra ningún aviso
- [ ] Error sin imagen: «Lo que entienden» no reserva hueco; con imagen, ocupa todo el ancho de la tarjeta (no una píldora angosta)
- [ ] Salir del detalle, o abrir «Ver la frase completa», con la voz sonando la corta al instante
- [ ] Reducir movimiento: en la lista el número y las tarjetas cambian sin rodar ni entrar; en el detalle no hay cable, glitch, tachado animado ni transformación: las tres tarjetas aparecen completas con un fundido y no hay «Ver otra vez»
- [ ] Lector de pantalla (TalkBack): la tarjeta de la lista se oye como un botón con el malentendido y su gravedad; el detalle dice «Lo que dices: … Lo que entienden: … Lo correcto: …» como un solo elemento y los botones Escuchar y Lento se enfocan aparte; el medidor dice «Gravedad: Te delata, 2 de 3»
- [ ] Ningún rojo salvo lenguaje explícito: el error de un campo (contraseña mal escrita), «Borrar mi cuenta», los mensajes de error de arranque y descargas y el chequeo fallido de Diagnóstico se ven en ámbar, y el texto del botón «Borrar mi cuenta» se lee sobre el ámbar
- [ ] 360 px y fuente grande: las tarjetas de la lista no se cortan (el medidor baja su etiqueta a dos líneas), los chips se pueden tocar y el duelo apila su texto sin encimarse
- [ ] Consola: entrar a la lista, cambiar filtros, abrir varios detalles y usar «Ver otra vez» sin ningún aviso de Reanimated ni de Skia

## Cómo reportar

Una línea por problema, en este formato:

`pantalla | qué hice | qué pasó | qué esperaba`

Ejemplo:

`Pares | fallé un par | las fichas no temblaron | que temblaran en ámbar`

Agregar el modelo del teléfono, la versión de Android y si estaba activo Reducir movimiento.
