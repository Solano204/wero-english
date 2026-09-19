# -*- coding: utf-8 -*-
"""
Segundo lote de lecturas.

Van agrupadas en series con los mismos personajes: Wero y Tono para los
niños, el edificio, la oficina, la escuela y la banda. Las series no son
un adorno. Escribir la sexta historia de un mismo grupo cuesta la mitad
que escribir la sexta historia suelta, y al lector le pasa lo mismo: ya
sabe quién es Tono, así que puede gastar toda su atención en el inglés.

Cada historia se escribe alrededor de ids del catálogo. El validador de
genera_lecturas.py no deja pasar una que cite una frase inexistente ni
una que no aparezca literal en el texto.
"""

LECTURAS_EXTRA = [
    # ------------------------------------------------------------------
    # Serie: Wero y Tono
    # ------------------------------------------------------------------
    {
        "id": "lec_ninos_03",
        "titulo": "El día que Wero se perdió",
        "subtitulo": "Tres calles, una tienda y un perro asustado",
        "publico": "ninos",
        "mundo": "dia_a_dia",
        "nivel": 1,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "Tres calles",
                "texto": (
                    "Tono opens the door and forgets to close it.\n\n"
                    "\"Shut the door!\" his mother says, but it is too late. Wero is "
                    "already outside.\n\n"
                    "The dog runs three streets. Then he stops. Nothing smells like "
                    "home anymore.\n\n"
                    "A woman with a bag of oranges looks at him.\n\n"
                    "\"You are lost, little one.\"\n\n"
                    "Wero sits down. When you are lost, sitting is the smartest thing "
                    "a dog can do.\n\n"
                    "Tono runs out of the house. He looks under cars. He asks at the "
                    "taco stand. Don Beto has not seen him.\n\n"
                    "\"Let me know for sure if he comes back,\" says Tono, almost "
                    "crying.\n\n"
                    "\"Do not despair,\" says Don Beto. \"That dog knows this street "
                    "better than you do.\"\n\n"
                    "Two hours later Wero walks home by himself, slowly, like nothing "
                    "happened.\n\n"
                    "\"Don't push your luck,\" Tono tells him, hugging him too hard.\n\n"
                    "Wero does it again the next month."
                ),
            }
        ],
        "frases": [528, 326, 419, 401],
        "preguntas": [
            {
                "pregunta": "¿Cómo regresa Wero a la casa?",
                "opciones": ["Tono lo encuentra", "Solo, caminando", "Lo lleva la señora"],
                "correcta": 1,
                "porque": "El texto dice que camina de regreso él solo, dos horas después.",
            },
            {
                "pregunta": "\"Don't push your luck\" se le dice a alguien que…",
                "opciones": [
                    "Está tentando a la suerte",
                    "Tiene mucha suerte",
                    "Perdió algo",
                ],
                "correcta": 0,
                "porque": "Es la advertencia de no abusar de la buena suerte.",
            },
            {
                "pregunta": "\"Do not despair\" quiere decir…",
                "opciones": ["No corras", "No te desesperes", "No grites"],
                "correcta": 1,
                "porque": "Despair es desesperarse, perder la esperanza.",
            },
        ],
    },
    {
        "id": "lec_ninos_04",
        "titulo": "La lluvia",
        "subtitulo": "Un perro mojado y una tarde sin salir",
        "publico": "ninos",
        "mundo": "dia_a_dia",
        "nivel": 1,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "Adentro",
                "texto": (
                    "It rains all afternoon. Wero hates the rain.\n\n"
                    "He sits by the window and watches the water. Every few minutes he "
                    "looks at Tono, like Tono could turn it off.\n\n"
                    "\"Don't get worked up,\" says Tono. \"It always stops.\"\n\n"
                    "Tono's mother comes home wet and tired. She sits down and does not "
                    "move for ten minutes.\n\n"
                    "\"This heat drains your energy,\" she said this morning. Now it is "
                    "cold and she is tired anyway. Some days are just like that.\n\n"
                    "Tono makes her a coffee. It is not very good. She drinks all of it.\n\n"
                    "\"Let me soothe your nerves,\" he says, copying her voice, and she "
                    "laughs for the first time since Monday.\n\n"
                    "The rain stops at seven. Wero stands up immediately, like he knew.\n\n"
                    "\"Another one doesn't hurt,\" says his mother, holding out her cup."
                ),
            }
        ],
        "frases": [316, 552, 257, 544],
        "preguntas": [
            {
                "pregunta": "¿Qué hace Tono por su mamá?",
                "opciones": ["Le hace un café", "La lleva al trabajo", "Le presta el perro"],
                "correcta": 0,
                "porque": "Le prepara un café que no le queda muy bueno.",
            },
            {
                "pregunta": "\"This heat drains your energy\" significa que el calor…",
                "opciones": ["Te da energía", "Te quita las energías", "Te da sueño de noche"],
                "correcta": 1,
                "porque": "Drain es drenar, vaciar.",
            },
            {
                "pregunta": "\"Another one doesn't hurt\" se usa para…",
                "opciones": ["Pedir uno más", "Rechazar algo", "Quejarse de un dolor"],
                "correcta": 0,
                "porque": "Es la forma de pedir otro sin pedirlo directamente.",
            },
        ],
    },
    {
        "id": "lec_ninos_05",
        "titulo": "El llavero",
        "subtitulo": "Wero encuentra algo que no debía",
        "publico": "ninos",
        "mundo": "dia_a_dia",
        "nivel": 1,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "Debajo del sillón",
                "texto": (
                    "Wero finds a keychain under the couch. It is small, it is shiny, "
                    "and it is not his.\n\n"
                    "\"Give it here,\" says Tono.\n\n"
                    "Wero runs. Wero always runs.\n\n"
                    "\"Imma rip your keychain off,\" Tono's older sister yells from the "
                    "kitchen, which is not even the right expression, but she is angry "
                    "and it is her keychain.\n\n"
                    "They chase the dog around the table four times.\n\n"
                    "\"Shut the door!\" says their mother, who has said that sentence "
                    "nine thousand times in her life.\n\n"
                    "Wero drops the keychain by himself, in the middle of the room, and "
                    "sits next to it.\n\n"
                    "\"It's a collectible,\" says the sister, picking it up. \"My friend "
                    "brought it from Monterrey.\"\n\n"
                    "\"That's it?\" says Tono. \"All of that for a keychain?\"\n\n"
                    "Wero moves his tail. For him it was a great afternoon."
                ),
            }
        ],
        "frases": [538, 528, 461, 317],
        "preguntas": [
            {
                "pregunta": "¿De quién es el llavero?",
                "opciones": ["De Tono", "De la hermana", "De la mamá"],
                "correcta": 1,
                "porque": "La hermana lo reclama desde la cocina y luego lo recoge.",
            },
            {
                "pregunta": "\"It's a collectible\" quiere decir que la cosa es…",
                "opciones": ["De colección", "Muy cara", "Muy vieja"],
                "correcta": 0,
                "porque": "Collectible es un objeto de colección.",
            },
            {
                "pregunta": "\"That's it?\" se usa cuando…",
                "opciones": [
                    "Algo resultó menos de lo esperado",
                    "Algo se acabó bien",
                    "Alguien tiene razón",
                ],
                "correcta": 0,
                "porque": "Es la decepción: ¿eso es todo?",
            },
        ],
    },
    {
        "id": "lec_ninos_06",
        "titulo": "El gato de la azotea",
        "subtitulo": "Un enemigo nuevo, del tamaño de un zapato",
        "publico": "ninos",
        "mundo": "dia_a_dia",
        "nivel": 1,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "El enemigo",
                "texto": (
                    "There is a cat on the roof next door. Gray, small, and completely "
                    "sure of himself.\n\n"
                    "Every morning at seven the cat walks along the wall, very slowly, "
                    "right in front of Wero.\n\n"
                    "\"He does it on purpose,\" says Tono.\n\n"
                    "Wero barks. The cat does not even look at him. That is the worst "
                    "part.\n\n"
                    "One Saturday the cat sits down on the wall and stays there for an "
                    "hour. Wero sits below and stays there too. Neither one moves.\n\n"
                    "\"Do not despair,\" Tono tells his dog, laughing.\n\n"
                    "At noon the cat jumps down into the yard, walks past Wero without "
                    "hurrying, drinks from his water bowl, and leaves.\n\n"
                    "Wero does nothing. Absolutely nothing.\n\n"
                    "\"It could have fooled me,\" says Tono's sister from the window. "
                    "\"I thought he was brave.\"\n\n"
                    "The next morning at seven, they are both back on the wall."
                ),
            }
        ],
        "frases": [676, 419, 391],
        "preguntas": [
            {
                "pregunta": "¿Qué hace Wero cuando el gato baja?",
                "opciones": ["Lo persigue", "No hace nada", "Se esconde"],
                "correcta": 1,
                "porque": "El texto dice que no hace absolutamente nada.",
            },
            {
                "pregunta": "\"He does it on purpose\" significa que lo hace…",
                "opciones": ["Sin querer", "A propósito", "Por costumbre"],
                "correcta": 1,
                "porque": "On purpose es a propósito, con intención.",
            },
            {
                "pregunta": "\"It could have fooled me\" se dice cuando…",
                "opciones": [
                    "Algo parecía otra cosa",
                    "Alguien te mintió de verdad",
                    "Algo te dio risa",
                ],
                "correcta": 0,
                "porque": "Es un comentario irónico: pues me tenía engañado.",
            },
        ],
    },
    {
        "id": "lec_ninos_07",
        "titulo": "El corte de pelo",
        "subtitulo": "La hermana de Tono y una decisión de las diez de la noche",
        "publico": "ninos",
        "mundo": "dia_a_dia",
        "nivel": 1,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "Las tijeras",
                "texto": (
                    "At ten at night, Tono's sister decides to cut her own hair.\n\n"
                    "\"Get your hair done,\" their mother told her last week. \"With a "
                    "professional. Please.\"\n\n"
                    "She did not.\n\n"
                    "Tono watches from the door with the dog. Neither of them says "
                    "anything, because both of them know better.\n\n"
                    "First she cuts the left side. Then she cuts the right side, to make "
                    "it even. Then the left side again.\n\n"
                    "\"Your bangs,\" says Tono, very quietly.\n\n"
                    "\"I know.\"\n\n"
                    "\"That's it?\" he asks, when she puts down the scissors.\n\n"
                    "She looks in the mirror for a long time. Wero looks at her too, "
                    "with his head to one side.\n\n"
                    "\"You look fly,\" says Tono, and he means it, because she is his "
                    "sister and because it is eleven at night and nobody can fix "
                    "anything now.\n\n"
                    "She laughs. Then she cries a little. Then she laughs again."
                ),
            }
        ],
        "frases": [471, 473, 317, 475],
        "preguntas": [
            {
                "pregunta": "¿Qué le había dicho la mamá?",
                "opciones": [
                    "Que se cortara el pelo ella misma",
                    "Que fuera con un profesional",
                    "Que no se lo cortara",
                ],
                "correcta": 1,
                "porque": "Le dijo get your hair done, con un profesional.",
            },
            {
                "pregunta": "\"You look fly\" es un…",
                "opciones": ["Insulto", "Cumplido", "Regaño"],
                "correcta": 1,
                "porque": "Fly aquí es que te ves muy bien.",
            },
            {
                "pregunta": "\"Your bangs\" se refiere a…",
                "opciones": ["El fleco", "Las tijeras", "El espejo"],
                "correcta": 0,
                "porque": "Bangs es el fleco.",
            },
        ],
    },
    {
        "id": "lec_ninos_08",
        "titulo": "Sábado en la azotea",
        "subtitulo": "Cinco chavos, un balón y un perro que no juega",
        "publico": "ninos",
        "mundo": "dia_a_dia",
        "nivel": 1,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "El partido",
                "texto": (
                    "Five kids, one ball, and a roof that is too small for both teams.\n\n"
                    "Tono is the goalkeeper because he is the slowest. Nobody says it "
                    "like that, but everybody knows.\n\n"
                    "Wero watches from the corner. He never chases the ball. Not once, "
                    "in three years.\n\n"
                    "\"That's the weird part about me,\" Tono says when they ask why his "
                    "dog does not play. \"My dog is lazier than I am.\"\n\n"
                    "The game ends two to two, which means they need a tiebreaker, which "
                    "means somebody has to shoot from the water tank.\n\n"
                    "Tono shoots. The ball goes over the wall and into the street.\n\n"
                    "Silence.\n\n"
                    "\"We gonna put it all together tomorrow,\" says Ale, who says that "
                    "about everything.\n\n"
                    "They go down to look for the ball. Wero goes first, like he always "
                    "does when everybody finally decides to move."
                ),
            }
        ],
        "frases": [541, 537, 474],
        "preguntas": [
            {
                "pregunta": "¿Por qué Tono es el portero?",
                "opciones": ["Porque es el más lento", "Porque es el más alto", "Porque es su balón"],
                "correcta": 0,
                "porque": "El texto lo dice: es el más lento y todos lo saben.",
            },
            {
                "pregunta": "\"Tiebreaker\" es…",
                "opciones": ["Un empate", "Un desempate", "Una falta"],
                "correcta": 1,
                "porque": "Tie es empate y breaker lo rompe.",
            },
            {
                "pregunta": "\"That's the weird part about me\" introduce…",
                "opciones": [
                    "Algo raro de uno mismo",
                    "Una queja de otro",
                    "Una disculpa",
                ],
                "correcta": 0,
                "porque": "Es la forma de presentar la propia rareza.",
            },
        ],
    },
    # ------------------------------------------------------------------
    # Serie: El edificio
    # ------------------------------------------------------------------
    {
        "id": "lec_edificio_01",
        "titulo": "El elevador",
        "subtitulo": "Cuatro pisos y una llave que no aparece",
        "publico": "general",
        "mundo": "dia_a_dia",
        "nivel": 2,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "Cuarto piso",
                "texto": (
                    "The elevator has been broken since February and it is now June.\n\n"
                    "I meet the neighbor from 4B on the stairs, both of us carrying "
                    "groceries, both of us pretending we are not out of breath.\n\n"
                    "\"I was locked out of your room once,\" she says, which makes no "
                    "sense until I remember she used to sublet the place before me.\n\n"
                    "\"The lock still sticks.\"\n\n"
                    "\"It always did.\"\n\n"
                    "On the third floor somebody is playing music too loud and somebody "
                    "else is yelling about it.\n\n"
                    "\"Don't slam the door,\" she says to nobody in particular, and we "
                    "both laugh, because in this building that sentence is a joke.\n\n"
                    "At my floor she stops.\n\n"
                    "\"We can swing by his house on Sunday,\" she says. \"The "
                    "administrator. Four of us. He answers when there are four of us.\"\n\n"
                    "I say yes. Four is not many, but it is more than one."
                ),
            }
        ],
        "frases": [620, 585, 542],
        "preguntas": [
            {
                "pregunta": "¿Qué proponen hacer el domingo?",
                "opciones": [
                    "Arreglar el elevador ellos mismos",
                    "Ir en grupo con el administrador",
                    "Llamar a la policía",
                ],
                "correcta": 1,
                "porque": "Ella propone pasar a casa del administrador entre cuatro.",
            },
            {
                "pregunta": "\"We can swing by his house\" es…",
                "opciones": ["Podemos pasar a su casa", "Podemos mudarnos ahí", "Podemos llamarle"],
                "correcta": 0,
                "porque": "Swing by es pasar de rápido por un lugar.",
            },
            {
                "pregunta": "\"I was locked out\" significa que…",
                "opciones": [
                    "Se quedó afuera sin poder entrar",
                    "La encerraron adentro",
                    "Perdió la casa",
                ],
                "correcta": 0,
                "porque": "Locked out es quedarse fuera, normalmente sin llave.",
            },
        ],
    },
    {
        "id": "lec_edificio_02",
        "titulo": "La vecina que teje",
        "subtitulo": "Doña Lupe, su porche y una lección que nadie pidió",
        "publico": "general",
        "mundo": "dia_a_dia",
        "nivel": 2,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "El porche",
                "texto": (
                    "Doña Lupe is always in the same place.\n\n"
                    "\"Sittin' on my porch, knitting,\" she says, when anybody asks what "
                    "she did today. She has been saying it for eleven years.\n\n"
                    "Last winter she taught my sister. Two afternoons a week, no charge, "
                    "no lessons, just sitting there until something worked.\n\n"
                    "\"I wanna knit,\" I told her once, half joking.\n\n"
                    "\"So knit.\"\n\n"
                    "\"I don't have time.\"\n\n"
                    "She looked at me the way people look at you when they have already "
                    "decided you are wrong.\n\n"
                    "\"It's a matter of you wanting to,\" she said, and went back to her "
                    "hands.\n\n"
                    "That was in November. In March I bought the needles. In April I "
                    "made something that was almost a scarf.\n\n"
                    "\"It's a collectible,\" said my sister, holding it up. She was being "
                    "cruel and she was also right.\n\n"
                    "Doña Lupe never said anything about it. She just moved over on the "
                    "step so I could sit down."
                ),
            }
        ],
        "frases": [459, 460, 396, 461],
        "preguntas": [
            {
                "pregunta": "¿Qué hace Doña Lupe cuando el narrador aprende a tejer?",
                "opciones": [
                    "Lo felicita mucho",
                    "No dice nada y le hace lugar",
                    "Se ríe de la bufanda",
                ],
                "correcta": 1,
                "porque": "Solo se recorre en el escalón para que se siente.",
            },
            {
                "pregunta": "\"It's a matter of you wanting to\" quiere decir…",
                "opciones": [
                    "Es cuestión de que tú quieras",
                    "Es un asunto importante",
                    "No importa lo que quieras",
                ],
                "correcta": 0,
                "porque": "A matter of es cuestión de.",
            },
            {
                "pregunta": "\"I wanna knit\" es la forma hablada de…",
                "opciones": ["I will knit", "I want to knit", "I won't knit"],
                "correcta": 1,
                "porque": "Wanna es la reducción de want to.",
            },
        ],
    },
    {
        "id": "lec_edificio_03",
        "titulo": "El wifi del vecino",
        "subtitulo": "Una contraseña débil y una conversación incómoda",
        "publico": "general",
        "mundo": "tech",
        "nivel": 2,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "La contraseña",
                "texto": (
                    "The kid from 2A knocks on my door on a Tuesday.\n\n"
                    "\"Your security is kind of off,\" he says, before hello.\n\n"
                    "\"My what?\"\n\n"
                    "\"Your wifi. The password is the name of the building and the year. "
                    "Everyone on this floor is on it.\"\n\n"
                    "I stand there with the door half open.\n\n"
                    "\"How do you know that?\"\n\n"
                    "\"I've been hammerin' at these things all summer. It's a hobby.\"\n\n"
                    "He is sixteen. His hobby is breaking into things and then telling "
                    "people about it, which is somehow both a crime and a favor.\n\n"
                    "\"Change it now,\" he says. \"Don't push that off to later. Later "
                    "means never.\"\n\n"
                    "So I change it while he stands there, and he reads the new one over "
                    "my shoulder and shakes his head.\n\n"
                    "\"Better. Not good. Better.\"\n\n"
                    "Then he goes back downstairs to tell 2C."
                ),
            }
        ],
        "frases": [623, 622, 624],
        "preguntas": [
            {
                "pregunta": "¿Qué hace el chavo después de avisarle al narrador?",
                "opciones": ["Se conecta a su wifi", "Va a avisarle a otro vecino", "Se va a su casa"],
                "correcta": 1,
                "porque": "Baja a decirle lo mismo a 2C.",
            },
            {
                "pregunta": "\"Push that off to later\" significa…",
                "opciones": ["Dejarlo para después", "Empujarlo", "Terminarlo rápido"],
                "correcta": 0,
                "porque": "Push off es posponer.",
            },
            {
                "pregunta": "\"Your security is kind of off\" quiere decir que…",
                "opciones": [
                    "La seguridad está apagada por completo",
                    "Está medio fallando",
                    "Está perfecta",
                ],
                "correcta": 1,
                "porque": "Kind of off es medio mal, no del todo apagado.",
            },
        ],
    },
    # ------------------------------------------------------------------
    # Serie: La oficina
    # ------------------------------------------------------------------
    {
        "id": "lec_oficina_01",
        "titulo": "El nuevo",
        "subtitulo": "Tres meses para caerle bien a un equipo",
        "publico": "general",
        "mundo": "dinero",
        "nivel": 2,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "La primera semana",
                "texto": (
                    "The new guy does not talk for four days.\n\n"
                    "On the fifth, in the middle of a meeting where nobody asked him "
                    "anything, he says: \"Ain't good with people. Sorry. I'll get "
                    "there.\"\n\n"
                    "Nobody knows what to do with that, so we move on.\n\n"
                    "He is very good. That becomes obvious in week two, when he finds a "
                    "bug that three of us had walked past for a month.\n\n"
                    "\"I gotta give you props,\" says Ana, and he goes red and looks at "
                    "his screen.\n\n"
                    "By week eight he eats lunch with us. By week twelve he argues in "
                    "meetings, which is how you know somebody has stopped being new.\n\n"
                    "\"Now we have built trust,\" he says one Friday, half joking, "
                    "raising a paper cup.\n\n"
                    "It is a strange sentence. It is also exactly right, and none of us "
                    "would have said it out loud."
                ),
            }
        ],
        "frases": [337, 131, 533],
        "preguntas": [
            {
                "pregunta": "¿Cómo se nota que el nuevo ya dejó de ser nuevo?",
                "opciones": [
                    "Porque llega temprano",
                    "Porque discute en las juntas",
                    "Porque encuentra un error",
                ],
                "correcta": 1,
                "porque": "El texto dice que así se sabe: cuando empieza a discutir.",
            },
            {
                "pregunta": "\"I gotta give you props\" es…",
                "opciones": ["Un reclamo", "Un reconocimiento", "Una orden"],
                "correcta": 1,
                "porque": "Give props es reconocer el mérito de alguien.",
            },
            {
                "pregunta": "\"Ain't good with people\" es inglés…",
                "opciones": ["Formal", "Hablado, informal", "Incorrecto siempre"],
                "correcta": 1,
                "porque": "Ain't es muy común al hablar, pero no se escribe en un correo de trabajo.",
            },
        ],
    },
    {
        "id": "lec_oficina_02",
        "titulo": "La junta larga",
        "subtitulo": "Noventa minutos que cabían en diez",
        "publico": "general",
        "mundo": "dinero",
        "nivel": 2,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "Minuto cuarenta",
                "texto": (
                    "\"If I could just have everybody's attention,\" says the director, "
                    "at minute forty of a meeting scheduled for thirty.\n\n"
                    "Four people unmute at the same time. Nobody speaks. Then everybody "
                    "speaks.\n\n"
                    "\"Please, go on,\" says the director, to all four at once, which "
                    "helps nobody.\n\n"
                    "I have a document open in another window with the two things I "
                    "actually need from this call. Both of them take one sentence.\n\n"
                    "At minute seventy I get one. At minute eighty-eight I get the "
                    "other, by writing it in the chat where the director cannot see it.\n\n"
                    "\"We'll push that off to later,\" he says about the third topic, "
                    "which was the only important one.\n\n"
                    "Ana sends me a message: two words and a face.\n\n"
                    "The call ends at ninety-four minutes. I sit for a second before I "
                    "open anything else, because opening something else right away is "
                    "how a Tuesday disappears."
                ),
            }
        ],
        "frases": [1291, 190, 624],
        "preguntas": [
            {
                "pregunta": "¿Qué pasa con el tercer tema?",
                "opciones": ["Se resuelve", "Se deja para después", "Se cancela"],
                "correcta": 1,
                "porque": "El director dice que lo dejan para más tarde.",
            },
            {
                "pregunta": "\"If I could just have everybody's attention\" se usa para…",
                "opciones": [
                    "Pedir la palabra con educación",
                    "Regañar al equipo",
                    "Terminar una junta",
                ],
                "correcta": 0,
                "porque": "Es la fórmula educada para callar a la sala.",
            },
            {
                "pregunta": "\"Please, go on\" invita a…",
                "opciones": ["Que siga hablando", "Que se vaya", "Que se apure"],
                "correcta": 0,
                "porque": "Go on es continúa.",
            },
        ],
    },
    {
        "id": "lec_oficina_03",
        "titulo": "El aumento",
        "subtitulo": "Un número, dos versiones y una pregunta que nadie contesta",
        "publico": "general",
        "mundo": "dinero",
        "nivel": 3,
        "desbloquea": {"mundo": "dinero", "dominadas": 25},
        "capitulos": [
            {
                "n": 1,
                "titulo": "El número",
                "texto": (
                    "They offer me twelve percent.\n\n"
                    "\"A little bit after taxes,\" says my manager, \"it's less, "
                    "obviously.\"\n\n"
                    "Obviously.\n\n"
                    "I do the math that night at the kitchen table and the number is "
                    "smaller than it sounded in the room, which is the whole point of "
                    "saying it as a percentage.\n\n"
                    "\"Is this what the market pays?\" I ask on Thursday.\n\n"
                    "\"That's the golden question.\"\n\n"
                    "That is not an answer. He knows it is not an answer. We both sit "
                    "with it for a second.\n\n"
                    "\"Look,\" he says finally. \"Twelve is what I can sign today. "
                    "Staying quiet is only gonna get you so far, and you have been very "
                    "quiet for two years.\"\n\n"
                    "That one lands. I have been quiet for two years.\n\n"
                    "I take the twelve. I also start answering recruiter messages that "
                    "week, for the first time since I got here."
                ),
            }
        ],
        "frases": [436, 527, 488],
        "preguntas": [
            {
                "pregunta": "¿Qué hace el narrador al final?",
                "opciones": [
                    "Rechaza el aumento",
                    "Lo acepta y empieza a buscar",
                    "Renuncia",
                ],
                "correcta": 1,
                "porque": "Toma el doce y empieza a contestarles a los reclutadores.",
            },
            {
                "pregunta": "\"That's the golden question\" se dice cuando…",
                "opciones": [
                    "La pregunta es la buena y no hay respuesta",
                    "La pregunta es tonta",
                    "Ya se sabe la respuesta",
                ],
                "correcta": 0,
                "porque": "Es reconocer que dio en el clavo, casi siempre para no contestar.",
            },
            {
                "pregunta": "\"Only gonna get you so far\" quiere decir que algo…",
                "opciones": [
                    "Te lleva muy lejos",
                    "Te lleva solo hasta cierto punto",
                    "No sirve de nada",
                ],
                "correcta": 1,
                "porque": "So far marca un tope, no un cero.",
            },
        ],
    },
    {
        "id": "lec_oficina_04",
        "titulo": "La línea de corte",
        "subtitulo": "Un modelo, dos métricas y una decisión de viernes",
        "publico": "general",
        "mundo": "tech",
        "nivel": 3,
        "desbloquea": {"mundo": "tech", "dominadas": 15},
        "capitulos": [
            {
                "n": 1,
                "titulo": "Viernes",
                "texto": (
                    "\"Gather the data first,\" Ana says. \"Then we argue.\"\n\n"
                    "So we spend Wednesday and Thursday gathering, and on Friday we "
                    "argue anyway, because the data does not decide anything by itself. "
                    "It never does.\n\n"
                    "The model is better than the old one on nine metrics and worse on "
                    "one. The one it is worse on is the one that reaches customers.\n\n"
                    "\"We draw the cutoff line at zero point eight,\" says the lead.\n\n"
                    "\"That drops fourteen percent of real cases.\"\n\n"
                    "\"And at zero point six we send garbage to four hundred people a "
                    "day.\"\n\n"
                    "Nobody is wrong, which is the worst kind of meeting.\n\n"
                    "In the end we ship at zero point seven five and write down exactly "
                    "why, in a document with both names on it.\n\n"
                    "\"Trustworthy,\" Ana says, looking at the doc. \"That's the whole "
                    "job. Not right. Trustworthy.\""
                ),
            }
        ],
        "frases": [682, 698, 699],
        "preguntas": [
            {
                "pregunta": "¿Cómo termina la discusión?",
                "opciones": [
                    "Gana el líder",
                    "Se van a un punto intermedio y lo documentan",
                    "Se cancela el modelo",
                ],
                "correcta": 1,
                "porque": "Salen con 0.75 y escriben el porqué con los dos nombres.",
            },
            {
                "pregunta": "\"We draw the cutoff line\" es…",
                "opciones": ["Trazamos la línea de corte", "Dibujamos una gráfica", "Cortamos el presupuesto"],
                "correcta": 0,
                "porque": "Cutoff line es el umbral donde se corta.",
            },
            {
                "pregunta": "Según Ana, el trabajo no es ser correcto sino…",
                "opciones": ["Rápido", "Confiable", "Barato"],
                "correcta": 1,
                "porque": "Trustworthy es confiable.",
            },
        ],
    },
    # ------------------------------------------------------------------
    # Serie: La escuela
    # ------------------------------------------------------------------
    {
        "id": "lec_escuela_01",
        "titulo": "El examen de admisión",
        "subtitulo": "Seis meses estudiando para una mañana",
        "publico": "general",
        "mundo": "cultura",
        "nivel": 2,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "La mañana",
                "texto": (
                    "\"Your entrance exam is at seven,\" my mother says, at five in the "
                    "morning, standing in my doorway with coffee.\n\n"
                    "I know. I have known for six months.\n\n"
                    "On the bus there are forty kids with the same folder. Some of them "
                    "are reading. Most of them are pretending to read.\n\n"
                    "The girl next to me has her notes in three colors.\n\n"
                    "\"Well studied,\" I say, pointing at them.\n\n"
                    "\"Not really. It just looks like it.\"\n\n"
                    "That makes me feel better than anything my mother said all week.\n\n"
                    "The exam is ninety questions. I know maybe seventy. I guess on "
                    "twelve and I leave eight blank because guessing costs points here.\n\n"
                    "Outside, afterward, nobody wants to talk about it and everybody "
                    "talks about it.\n\n"
                    "\"Ambitious,\" says the girl with the three colors, when I tell her "
                    "which program I put first.\n\n"
                    "\"Too ambitious?\"\n\n"
                    "\"I didn't say that.\""
                ),
            }
        ],
        "frases": [568, 534, 525],
        "preguntas": [
            {
                "pregunta": "¿Por qué deja ocho preguntas en blanco?",
                "opciones": [
                    "Porque se le acabó el tiempo",
                    "Porque adivinar resta puntos",
                    "Porque no las entendió",
                ],
                "correcta": 1,
                "porque": "El texto dice que aquí adivinar cuesta puntos.",
            },
            {
                "pregunta": "\"Well studied\" aquí es…",
                "opciones": ["Un elogio", "Una queja", "Una pregunta"],
                "correcta": 0,
                "porque": "Le está diciendo que se ve bien preparada.",
            },
            {
                "pregunta": "\"Ambitious\" como respuesta corta puede ser…",
                "opciones": [
                    "Un elogio o una advertencia, según el tono",
                    "Siempre un insulto",
                    "Siempre un elogio",
                ],
                "correcta": 0,
                "porque": "La historia termina justo en esa ambigüedad.",
            },
        ],
    },
    {
        "id": "lec_escuela_02",
        "titulo": "La cruda del lunes",
        "subtitulo": "Una clase de ocho y una noche que no se planeó",
        "publico": "general",
        "mundo": "cultura",
        "nivel": 2,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "Ocho de la mañana",
                "texto": (
                    "\"Are you hungover?\" the professor asks, without looking up.\n\n"
                    "Half the room laughs. The kid in the third row does not.\n\n"
                    "\"A little.\"\n\n"
                    "\"Then you already know how this goes.\"\n\n"
                    "He does. He gets called on four times in fifty minutes, which is "
                    "more than the whole semester put together.\n\n"
                    "\"I gotta take this on the chin,\" he says at the break, holding a "
                    "coffee with both hands like it is medicine.\n\n"
                    "\"You could just not come.\"\n\n"
                    "\"Then he wins.\"\n\n"
                    "That is not really how it works, but at eight in the morning "
                    "everything feels like a fight.\n\n"
                    "By the second hour he is answering correctly, which somehow annoys "
                    "everyone more.\n\n"
                    "\"Gotta chill out on here,\" he tells us afterward, meaning the "
                    "parties, meaning Sundays, meaning everything.\n\n"
                    "He says it again the following Monday."
                ),
            }
        ],
        "frases": [508, 509, 469],
        "preguntas": [
            {
                "pregunta": "¿Qué pasa en la segunda hora?",
                "opciones": [
                    "Se sale del salón",
                    "Empieza a contestar bien",
                    "Se duerme",
                ],
                "correcta": 1,
                "porque": "Contesta correctamente, y eso molesta más a todos.",
            },
            {
                "pregunta": "\"I gotta take this on the chin\" significa…",
                "opciones": [
                    "Tengo que aguantar el golpe",
                    "Me van a pegar",
                    "Voy a pelear",
                ],
                "correcta": 0,
                "porque": "Take it on the chin es aguantarse sin quejarse.",
            },
            {
                "pregunta": "\"Are you hungover?\" pregunta si…",
                "opciones": ["Estás crudo", "Tienes hambre", "Estás colgado"],
                "correcta": 0,
                "porque": "Hungover es la resaca del día siguiente.",
            },
        ],
    },
    # ------------------------------------------------------------------
    # Serie: La banda
    # ------------------------------------------------------------------
    {
        "id": "lec_banda_01",
        "titulo": "El rolón",
        "subtitulo": "Una canción, un carro y cuatro personas gritando",
        "publico": "general",
        "mundo": "calle",
        "nivel": 2,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "El carro",
                "texto": (
                    "Kevin puts on a song nobody has heard and everybody hates for "
                    "eleven seconds.\n\n"
                    "Then the chorus hits.\n\n"
                    "\"That's a banger,\" says Ale, from the back seat, and that is the "
                    "end of the argument.\n\n"
                    "We play it four times between the gas station and the house.\n\n"
                    "Kevin found it in a playlist from a stream at three in the morning. "
                    "Kevin finds everything at three in the morning, which is why nobody "
                    "questions where his music comes from anymore.\n\n"
                    "\"Shout out to Kevin,\" says Nacho, very seriously, like he is on "
                    "the radio.\n\n"
                    "Kevin does not answer. He just turns it up.\n\n"
                    "Later, outside the house, he tells me he has not been sleeping.\n\n"
                    "\"Nobody checked up on me all month,\" he says. \"Except you, "
                    "Tuesday.\"\n\n"
                    "I do not remember what I wrote him on Tuesday. He does. That is "
                    "usually how it works."
                ),
            }
        ],
        "frases": [529, 467, 468],
        "preguntas": [
            {
                "pregunta": "¿Qué le dice Kevin al narrador afuera de la casa?",
                "opciones": [
                    "Que no ha estado durmiendo",
                    "Que quiere cambiar de música",
                    "Que se va de la ciudad",
                ],
                "correcta": 0,
                "porque": "Le dice que no ha dormido y que casi nadie lo buscó.",
            },
            {
                "pregunta": "\"That's a banger\" quiere decir que la canción…",
                "opciones": ["Está horrible", "Es un rolón", "Es muy vieja"],
                "correcta": 1,
                "porque": "Banger es un temazo.",
            },
            {
                "pregunta": "\"Checked up on me\" significa que alguien…",
                "opciones": [
                    "Se preocupó por él, le escribió",
                    "Lo revisó en un examen",
                    "Lo criticó",
                ],
                "correcta": 0,
                "porque": "Check up on someone es ver cómo está alguien.",
            },
        ],
    },
    {
        "id": "lec_banda_02",
        "titulo": "Desahogarse",
        "subtitulo": "Una discusión que no era sobre lo que parecía",
        "publico": "general",
        "mundo": "gente",
        "nivel": 3,
        "desbloquea": {"mundo": "gente", "dominadas": 25},
        "capitulos": [
            {
                "n": 1,
                "titulo": "Afuera",
                "texto": (
                    "Ale is yelling about a parking spot and it is not about the parking "
                    "spot.\n\n"
                    "We all know it. Nacho knows it best, which is why he does not "
                    "answer.\n\n"
                    "\"Let him trip,\" Nacho tells me quietly. \"He needs it out.\"\n\n"
                    "So we stand there in the street for eleven minutes while Ale says "
                    "eleven minutes of things that are only half about us.\n\n"
                    "His father has been in the hospital since Thursday. He has not "
                    "mentioned that once tonight.\n\n"
                    "When he finally stops, he is out of breath and a little "
                    "embarrassed.\n\n"
                    "\"Blow off some steam,\" he says, half apology, half explanation.\n\n"
                    "\"We know.\"\n\n"
                    "\"You don't know.\"\n\n"
                    "\"We know about your dad, Ale.\"\n\n"
                    "Silence. Then he sits down on the curb, and we sit down too, all "
                    "four of us, on a street where we are absolutely in the way.\n\n"
                    "\"We don't cut and run,\" says Nacho. Nobody argues with that one."
                ),
            }
        ],
        "frases": [1264, 1263, 595],
        "preguntas": [
            {
                "pregunta": "¿De qué se trataba realmente el pleito?",
                "opciones": [
                    "Del lugar de estacionamiento",
                    "Del papá de Ale, que está en el hospital",
                    "De Nacho",
                ],
                "correcta": 1,
                "porque": "El texto lo dice: su papá lleva en el hospital desde el jueves.",
            },
            {
                "pregunta": "\"Blow off some steam\" es…",
                "opciones": ["Desahogarse", "Echar humo del carro", "Salir corriendo"],
                "correcta": 0,
                "porque": "Es soltar la presión acumulada.",
            },
            {
                "pregunta": "\"We don't cut and run\" quiere decir…",
                "opciones": [
                    "Nosotros no salimos huyendo",
                    "No corremos rápido",
                    "No cortamos la amistad",
                ],
                "correcta": 0,
                "porque": "Cut and run es abandonar cuando se pone difícil.",
            },
        ],
    },
    {
        "id": "lec_banda_03",
        "titulo": "El aventón de la una",
        "subtitulo": "Cuarenta minutos de ciudad vacía",
        "publico": "general",
        "mundo": "gente",
        "nivel": 2,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "La ciudad vacía",
                "texto": (
                    "At one in the morning the city belongs to whoever is still driving.\n\n"
                    "Nacho lives forty minutes away now. Every Saturday somebody takes "
                    "him, and every Saturday he says the same thing getting out of the "
                    "car.\n\n"
                    "\"Thanks for the rides.\"\n\n"
                    "Not ride. Rides. All of them, going back two years.\n\n"
                    "Tonight it is my turn. We do not talk much. The radio does most of "
                    "it.\n\n"
                    "At a red light on an empty avenue he says: \"We can swing by his "
                    "house next week. Kevin's. He's been weird.\"\n\n"
                    "\"He's been weird since March.\"\n\n"
                    "\"Yeah.\"\n\n"
                    "The light turns green and neither of us moves for a second.\n\n"
                    "\"If he calls you, go,\" Nacho says.\n\n"
                    "\"I'll be there in a heartbeat.\"\n\n"
                    "He nods, gets out, and hits the roof of the car twice, which in this "
                    "group has meant goodbye since we were seventeen."
                ),
            }
        ],
        "frases": [387, 542, 400],
        "preguntas": [
            {
                "pregunta": "¿De qué hablan en el semáforo?",
                "opciones": ["De Kevin", "Del trabajo", "Del carro"],
                "correcta": 0,
                "porque": "Nacho propone ir a ver a Kevin, que anda raro.",
            },
            {
                "pregunta": "¿Por qué dice \"rides\" en plural?",
                "opciones": [
                    "Porque agradece todos los aventones, no solo este",
                    "Porque son varias personas",
                    "Es un error del inglés hablado",
                ],
                "correcta": 0,
                "porque": "El texto lo aclara: todos, de dos años para acá.",
            },
            {
                "pregunta": "\"I'll be there in a heartbeat\" promete…",
                "opciones": ["Llegar volando", "Llegar mañana", "Llamar por teléfono"],
                "correcta": 0,
                "porque": "In a heartbeat es al instante.",
            },
        ],
    },
]
