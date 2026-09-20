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
- [ ] Preguntas de Lectura: la opción elegida pulsa en verde o tiembla en ámbar y se marca la correcta; sin partículas ni puntaje

## e) Audio

- [ ] Gramática, un tema: "Escuchar todos los ejemplos" suena EN y ES en orden y "Detener" corta todo al instante
- [ ] Gramática: Inglés, Lento y Español de cada ejemplo suenan; tocar otro corta el que sonaba
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

- [ ] Repetir las secciones a) a g) con la opción activa; nada debe romperse ni quedar sin mostrar
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

## Cómo reportar

Una línea por problema, en este formato:

`pantalla | qué hice | qué pasó | qué esperaba`

Ejemplo:

`Pares | fallé un par | las fichas no temblaron | que temblaran en ámbar`

Agregar el modelo del teléfono, la versión de Android y si estaba activo Reducir movimiento.
