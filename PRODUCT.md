# PRODUCT.md — Wero

## Propósito

Wero enseña el inglés que no viene en los libros: jerga de calle, hip-hop, oficina, dinero, gente. Se aprende de oído, con frases reales que se escuchan, se practican en juegos y se leen en contexto.

La promesa es concreta: entender lo que dicen en una canción, una serie o una junta, y poder decirlo sin sonar a libro de texto.

## Audiencia

- **Quién:** adultos jóvenes en México, hispanohablantes, con inglés básico o medio. Entienden algo, pero el inglés real (rápido, con jerga, con contracciones) se les escapa.
- **Qué quieren:** entender de verdad, hablar sin miedo y no sentirse tontos por equivocarse.
- **Dónde lo usan:** en el teléfono (iOS y Android), en trayectos, en la fila, entre tareas. A veces con audífonos y a veces sin sonido.

## Qué hay hoy

| Sección | Contenido |
|---|---|
| Vocabulario | 1,524 frases con audio en inglés y español, agrupadas en 8 mundos: día a día, calle, dinero, gente, cultura, tech, legal y fonética |
| Practicar | Juegos (Colmena, Pares, Caída, Dulces, Cázala), Modo Oído, pares mínimos, retos |
| Estudio | Repaso espaciado (SM-2) de las frases que ya viste |
| Lecturas | 24 historias con tres preguntas al final, sin calificación |
| Gramática | 80 temas: qué es, cuándo se usa, cómo se arma, ejemplos y el error típico |
| Phrasal verbs | 207 verbos con audio |
| Sonidos | Laboratorio de fonemas (53) con sonido aislado, pares mínimos y cómo producirlos |
| Errores comunes | 194 tarjetas de los errores típicos de un hispanohablante |
| Progreso | Lo que llevas dominado, por mundo y por juego |

Lo gratuito va primero: los primeros temas de cada bloque de gramática están abiertos, y lo demás se desbloquea con un anuncio.

## Tono de voz

**Cercano, mexicano, directo, sin infantilizar.**

- Se tutea. Español de México: "dinero", "chamba", "camión" son válidos; "vosotros", "coger" o "ordenador", no.
- Frases cortas y verbos directos. Se dice qué hacer, no se da vuelta.
- Habla de tú a tú con un adulto. Nada de "¡Muy bien, campeón!", "¡Ups!" ni diminutivos condescendientes.
- Equivocarse no es un fallo moral. El error se explica, no se regaña: el fallo es ámbar, nunca rojo, y nunca se dice "Incorrecto".
- Humor discreto y de calle, sin forzarlo. La mascota Wero acompaña; no da sermones ni celebra en exceso.
- Cada texto se gana su lugar: si se puede quitar sin perder nada, se quita.

**Sí suena a Wero** (copy real de la app):
- "En qué te vas a equivocar"
- "No se guarda calificación. Es para ver si se entendió, no para calificarte."
- "Toca la estrella en cualquier frase para guardarla aquí."
- "Junta cada frase con lo que significa"
- "Se acabaron las jugadas, pero el tablero se queda"

**No suena a Wero:**
- "¡Excelente trabajo, campeón!"
- "¡Ups! Inténtalo de nuevo"
- "Estimado usuario, su sesión ha finalizado"

**Se evita:** desbloquea, potencia, sumérgete, domina (como promesa), viaje de aprendizaje, increíble, épico, exclamaciones y el contraste "no es X, es Y". Los errores dicen qué pasó y qué hacer, en una o dos frases. Las felicitaciones son cortas, con un dato y variadas (`src/utils/frases.ts`).

## Glosario de la interfaz

La misma acción se llama igual en toda la app.

| Acción o cosa | Se dice | No se dice |
|---|---|---|
| Oír el audio de una frase | Escuchar; a menor velocidad, Lento (el ícono va siempre con el texto) | Reproducir |
| Controlar una reproducción larga | Pausar, Reanudar, Detener | Reproducir, Parar |
| Pasar a la siguiente tarjeta, pregunta o paso | Siguiente | Seguir, Continuar, Avanzar |
| Retomar lo que ya empezó | Seguir repasando, Seguir estudiando, Seguir con (modo) | Continuar |
| Volver atrás | Volver (botón), flecha de atrás | Regresar |
| Guardar una frase en la lista propia | Guardar, Mi mazo; ya guardada, «Guardada» | Favoritos, Marcar |
| Qué tan formal o informal es una frase | Registro: Formal, Neutro, Informal, Muy informal, Solo con amigos | Nivel de lenguaje, Jerga |
| Sesión de repaso con frases nuevas | Estudiar | Frases al azar |
| Pasar frases sin repaso ni cuenta | Frases sueltas | Al azar |
| Repaso que toca hoy | Repasar N frases; el total aparte: "N pendientes" | tarjetas listas, cola de repaso |
| Aciertos seguidos en una sesión | N seguidas | racha |
| Aciertos de la sesión | N frases atinadas (en el chip, «N atinadas») | correctas, aciertos |
| Cuándo vuelve la tarjeta que acabas de responder | «Vuelve en esta sesión» (solo si de verdad se reinserta), «La vuelves a ver pronto», «La vuelves a ver mañana» | Volverá, repetición |
| Veredicto de una tarjeta | «Eso es» al acertar, «Era esta» al fallar | Incorrecto, Error, Mal |
| Días seguidos entrando | Racha: N días | streak |
| Frase que ya se sabe | dominada | aprendida |
| Frase que se falla seguido | atorada (Se me atoran) | difícil |
| Ver el resultado de una partida | Ver cómo me fue | Ver cómo te fue |
| Ver un anuncio para abrir contenido | Ver anuncio y abrir, Ver anuncio y descargar (en la celda de un nivel basta «Anuncio») | desbloquear |
| Jugar el nivel que sigue | Jugar nivel N (con el número real) | Empezar nivel, Continuar |
| Los tres tramos del mapa de niveles | «Niveles 1–70»; bloqueado: «Se abre al terminar el nivel N» | Fase, Mundo, Etapa |
| Lo que queda de un tablero de Pares | «Te quedan N jugadas», «Dejarlo aquí», «Saltar»; las fichas llevan «EN» y «ES»; el progreso, solo para el lector de pantalla: «N de M pares» | Vidas, intentos, Skip |
| Volver a jugar una partida perdida de Caída | Otra vez | Reintentar, Otra partida |
| El mejor puntaje de un nivel | Récord: N; Récord nuevo | Highscore, Mejor marca |
| Qué tan rápido va la ronda de Caída | Ritmo N de 5 (solo para el lector de pantalla) | Nivel de dificultad, Velocidad |
| Cuando una cascada arma otra línea en Dulces | Cascada ×2, Cascada ×3 (sin exclamaciones) | Combo, ¡Increíble!, Chain |
| Cuando un tablero de Dulces no tiene jugadas posibles | Rebarajando el tablero | Sin movimientos, Mezclando |
| Lo que queda de un tablero de Dulces | «N jugadas» (1: «1 jugada»), «Dejarlo aquí»; la pieza se lee «Pieza naranja, círculo, fila 2 columna 3» | Movimientos, Turnos, Vidas |
| La pregunta que sale al llenar una meta de Dulces | Llenaste esta, ¿Qué significa?, Siguiente | Bonus, Reto, Desafío |
| Oír la frase de una ronda de Colmena | Escuchar · quedan N; Sin escuchas | Reproducir, Te quedan N usos |
| Pedir ayuda en una ronda de Colmena | Pista N; No me sale | Rendirse, Revelar, Skip |
| Cuando se acaba el reloj de una ronda de Colmena | Se acabó el tiempo | ¡Tiempo!, Perdiste, Fallaste |
| Pasar a la ronda que sigue | Siguiente; Terminar (en la última) | Continuar, Next |
| Los botones del laboratorio de sonidos | «Solo el sonido» (repite hasta tocarlo otra vez; mientras tanto dice «Repitiendo…»), «Lento», «Escuchar las dos», «Practicar estos pares»; el índice marca «No existe en español» | Reproducir, Repetir, Practicar pares |
| Los controles de Modo oído | «Empezar» (la primera vez), «Pausar», «Reanudar»; «Anterior» y «Siguiente» para cambiar de frase; «Repetición N de 3» (solo para el lector de pantalla) | Play, Parar, Atrás, Saltar |
| Lo que dice el pie de Cázala | «N de 3 marcadas» y «Revisar»; ya revisada, «Siguiente» (en la ronda 20, «Terminar») | Comprobar, Enviar, Corregir |
| El resultado de una ronda de Cázala | «Las tres» o «N de 3»; cada reducción: «La cazaste», «Esta sí iba», «No iba» | Correcto, Incorrecto, Fallaste |

**Idioma:** la interfaz va en español; el contenido de aprendizaje va en inglés con su traducción al español.

**Plural:** todo conteo se escribe con `plural()` y `conteo()` de `src/utils/text.ts`, nunca con un ternario suelto: «1 estrella», «1 frase», «1 guardada», «1 día», «Queda 1 día».

## Restricciones

- **Móvil primero.** Se diseña para una pantalla de teléfono; nada depende de tener un mouse ni una pantalla grande.
- **Uso con una mano.** Las acciones frecuentes deben quedar al alcance del pulgar, y todo objetivo táctil mide al menos 48×48 dp.
- **Sesiones cortas.** Una sesión útil dura de 1 a 5 minutos: una tarjeta, un par, una ronda. Nada exige una sesión larga ni castiga interrumpirla.
- **Audio primero.** El contenido de estudio se oye. Debe funcionar bien con audífonos, y también con el sonido apagado cuando haga falta.
- **Todo en el dispositivo.** El contenido y el progreso viven en el teléfono (SQLite y audio empaquetado o descargado); el estudio no debe depender de la conexión.
- **Sin derrota.** Quedarse sin jugadas no acaba una partida y una lectura nunca se califica. El progreso alimenta el repaso, no una tabla de castigos.
- **Accesible.** Contraste mínimo AA, movimiento reducido respetado, y acierto o fallo nunca se comunican solo con color.
