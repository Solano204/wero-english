#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Arma assets/data/lecturas.json y valida que cada historia esté hecha de
frases que de verdad existen en el catálogo.

La regla del mockup: la historia se escribe A PARTIR de la lista de
frases, nunca al revés. Este script no deja pasar una historia que
mencione una frase que no está en catalogo.json, ni una frase de la
lista que no aparezca literal en el texto. Sin esa doble comprobación,
el lector subraya al aire y el usuario toca una palabra que no abre
nada.
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lecturas_extra import LECTURAS_EXTRA  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
CATALOGO = RAIZ / "assets" / "data" / "catalogo.json"
SALIDA = RAIZ / "assets" / "data" / "lecturas.json"

# --------------------------------------------------------------------
# Las historias. El texto se escribe alrededor de los ids, no al revés.
# --------------------------------------------------------------------

LECTURAS = [
    {
        "id": "lec_ninos_01",
        "titulo": "Wero y el taco perdido",
        "subtitulo": "Un perro, un taco y un plan que sale mal",
        "publico": "ninos",
        "mundo": "dia_a_dia",
        "nivel": 1,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "El plan",
                "texto": (
                    "Wero is a small white dog. Every morning he sits outside the taco "
                    "stand and waits.\n\n"
                    "\"How's it going?\" says Don Beto, the man who makes the tacos.\n\n"
                    "Wero moves his tail. He cannot talk, but he can wait. He waits and "
                    "waits. A boy walks by with a taco in one hand and a Large soda in "
                    "the other. The taco smells like heaven.\n\n"
                    "The boy drops the taco. It falls on the floor. Wero looks at it. He "
                    "looks at the boy. He looks at the taco again.\n\n"
                    "\"That's it?\" the boy says. \"My taco?\"\n\n"
                    "Wero does not move. He is a good dog. He waits.\n\n"
                    "\"You can have it,\" says the boy. \"Don't get worked up. I'll get "
                    "another one.\"\n\n"
                    "Wero eats the taco in two bites. To make a long story short, Wero "
                    "now has a new friend."
                ),
            },
            {
                "n": 2,
                "titulo": "El amigo nuevo",
                "texto": (
                    "The next day the boy comes back. His name is Tono.\n\n"
                    "\"I'd like a word with you,\" Tono says to the dog, very serious. "
                    "Wero sits down.\n\n"
                    "\"You ate my taco. So now you work for me. Deal?\"\n\n"
                    "Wero puts one paw on Tono's shoe.\n\n"
                    "\"Let me know for sure,\" says Tono, laughing.\n\n"
                    "Wero barks once. That means yes.\n\n"
                    "Every day after school, Tono walks to the taco stand and Wero is "
                    "already there. Don Beto says the dog knows the time better than a "
                    "clock. He does it on purpose, Tono thinks. He knows exactly when I "
                    "get out.\n\n"
                    "One day Tono is sick and cannot come. Wero waits all afternoon. "
                    "When Tono finally arrives the next day, the dog runs to him.\n\n"
                    "\"If you ever need me, I'll be there in a heartbeat,\" says Tono.\n\n"
                    "Wero already knew that. Dogs always know."
                ),
            },
        ],
        "frases": [83, 292, 317, 316, 398, 263, 326, 676, 400],
        "preguntas": [
            {
                "pregunta": "¿Por qué Wero espera afuera del puesto de tacos?",
                "opciones": [
                    "Porque ahí vive",
                    "Porque espera que caiga un taco",
                    "Porque le tiene miedo a Don Beto",
                ],
                "correcta": 1,
                "porque": "Wero espera todos los días a que alguien tire comida.",
            },
            {
                "pregunta": "\"To make a long story short\" en la historia significa…",
                "opciones": [
                    "Para no hacerte el cuento largo",
                    "Para contarte una historia corta",
                    "Para acortar el camino",
                ],
                "correcta": 0,
                "porque": "Se usa para saltar los detalles y llegar al final.",
            },
            {
                "pregunta": "Cuando Tono dice \"I'll be there in a heartbeat\", promete…",
                "opciones": [
                    "Que llegará tarde",
                    "Que llegará volando, sin tardarse nada",
                    "Que va a llamar por teléfono",
                ],
                "correcta": 1,
                "porque": "In a heartbeat es al instante, en lo que late el corazón.",
            },
        ],
    },
    {
        "id": "lec_ninos_02",
        "titulo": "La noche de las estrellas",
        "subtitulo": "Wero y Tono suben a la azotea",
        "publico": "ninos",
        "mundo": "dia_a_dia",
        "nivel": 1,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "La azotea",
                "texto": (
                    "It is Friday night. Tono cannot sleep, so he goes up to the roof "
                    "with Wero.\n\n"
                    "The city is loud. Somewhere a dog barks. Somewhere a TV is on too "
                    "loud.\n\n"
                    "\"My mom says we could pawn the TV,\" Tono says. \"She says it every "
                    "month and she never does it.\"\n\n"
                    "Wero puts his head on Tono's leg.\n\n"
                    "\"Don't get worked up,\" says Tono, copying his mother's voice. "
                    "\"Let me soothe your nerves.\"\n\n"
                    "Wero closes his eyes.\n\n"
                    "Above them there are almost no stars, because the city has too many "
                    "lights. But there are three, and Tono finds all three.\n\n"
                    "\"My grandma said everything is already decided up there. It's "
                    "written in the stars, she said.\"\n\n"
                    "Wero does not answer. He is a dog. But he stays. He always stays.\n\n"
                    "\"See you tomorrow, man,\" Tono whispers, and falls asleep on the "
                    "roof with his hand on the dog's back."
                ),
            }
        ],
        "frases": [271, 316, 257, 397, 282],
        "preguntas": [
            {
                "pregunta": "¿Por qué casi no se ven estrellas?",
                "opciones": [
                    "Porque está nublado",
                    "Porque la ciudad tiene demasiadas luces",
                    "Porque es de día",
                ],
                "correcta": 1,
                "porque": "El texto dice que la ciudad tiene demasiadas luces.",
            },
            {
                "pregunta": "\"It's written in the stars\" quiere decir que algo…",
                "opciones": [
                    "Está escrito en un libro",
                    "Ya estaba destinado a pasar",
                    "Pasó hace mucho tiempo",
                ],
                "correcta": 1,
                "porque": "Es la idea de que el destino ya estaba decidido.",
            },
            {
                "pregunta": "\"Let me soothe your nerves\" se usa para…",
                "opciones": [
                    "Calmar a alguien",
                    "Despertar a alguien",
                    "Regañar a alguien",
                ],
                "correcta": 0,
                "porque": "Soothe es calmar, tranquilizar.",
            },
        ],
    },
    {
        "id": "lec_chat_trabajo",
        "titulo": "El chat del trabajo",
        "subtitulo": "Lunes, nueve de la mañana, y nadie contesta",
        "publico": "general",
        "mundo": "dinero",
        "nivel": 2,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "El mensaje",
                "texto": (
                    "Monday morning. My boss drops a message in the group chat and "
                    "nobody answers for six minutes.\n\n"
                    "\"We're brainstorming at ten,\" it says. \"Everyone on camera.\"\n\n"
                    "Dave writes back first, like always. Then Ana. Then the intern, who "
                    "writes \"ok\" and nothing else, which somehow makes it worse.\n\n"
                    "I stare at my screen. My deadline is Friday and I have opened the "
                    "same file four times without writing anything.\n\n"
                    "At ten the call starts. My boss shares his screen. Gather the data "
                    "first, he says, then we talk. There are twelve slides and the "
                    "eleventh one has my name on it.\n\n"
                    "\"If Carl wants to step up, now is the moment,\" he says.\n\n"
                    "Carl does not want to step up. Carl has his camera off."
                ),
            },
            {
                "n": 2,
                "titulo": "La junta",
                "texto": (
                    "So I unmute.\n\n"
                    "\"I'm able to take the second half,\" I say. \"But my full "
                    "intentions are to hand it off to Ana in two weeks. She wrote most "
                    "of it.\"\n\n"
                    "Silence. The kind of silence where you cannot tell if you just "
                    "helped yourself or ended your career.\n\n"
                    "Then my boss says: \"On behalf of all of us, thank you.\" And he "
                    "means it, which is somehow worse.\n\n"
                    "Ana sends me a private message: two key points to lock in before "
                    "Friday, and a coffee emoji.\n\n"
                    "Road to a million, I think. Not now, though. Right now it is just "
                    "Monday, and I have eleven slides to fix."
                ),
            },
        ],
        "frases": [272, 682, 274, 47, 62, 277, 684, 18, 41],
        "preguntas": [
            {
                "pregunta": "¿Qué hace el narrador en la junta?",
                "opciones": [
                    "Se queda callado",
                    "Ofrece tomar la segunda mitad del trabajo",
                    "Culpa a Carl",
                ],
                "correcta": 1,
                "porque": "Dice \"I'm able to take the second half\".",
            },
            {
                "pregunta": "\"On behalf of all of us\" se traduce como…",
                "opciones": [
                    "Detrás de todos nosotros",
                    "En nombre de todos nosotros",
                    "A pesar de todos nosotros",
                ],
                "correcta": 1,
                "porque": "On behalf of es en nombre de, de parte de.",
            },
            {
                "pregunta": "\"Not now, though\" al final indica que…",
                "opciones": [
                    "Ya llegó al millón",
                    "Ese sueño no es para hoy",
                    "Nunca va a pasar",
                ],
                "correcta": 1,
                "porque": "Though al final suaviza: es un pero, no un nunca.",
            },
        ],
    },
    {
        "id": "lec_casero",
        "titulo": "La llamada del casero",
        "subtitulo": "El recibo de la luz y una conversación incómoda",
        "publico": "general",
        "mundo": "dia_a_dia",
        "nivel": 2,
        "desbloquea": None,
        "capitulos": [
            {
                "n": 1,
                "titulo": "El recibo",
                "texto": (
                    "The landlord calls on a Tuesday, which is never good.\n\n"
                    "\"I'd like a word with you,\" he says. Nobody says that when they "
                    "are about to give you money.\n\n"
                    "The heating has been off for eleven days. Eleven. I counted, "
                    "because my sister keeps asking me to put the heat back on, no? like "
                    "it is a switch I am refusing to press out of cruelty.\n\n"
                    "\"So you make minimum wage,\" he says, reading something. \"And you "
                    "are two weeks late.\"\n\n"
                    "\"I know.\"\n\n"
                    "\"I am not the bad guy here.\"\n\n"
                    "But it is what it is. I have heard that sentence so many times this "
                    "year that it has stopped meaning anything.\n\n"
                    "My sister says we could pawn the TV. She has said it every winter "
                    "since we moved in and we have never done it, because then the "
                    "apartment would be cold and quiet, and cold is survivable but "
                    "quiet is not."
                ),
            },
            {
                "n": 2,
                "titulo": "El límite",
                "texto": (
                    "On Thursday I call him back.\n\n"
                    "\"I have to draw a line,\" I tell him. \"Heat first, then the late "
                    "fee. Not the other way around.\"\n\n"
                    "He is quiet for a long time.\n\n"
                    "\"Fine,\" he says. \"Friday.\"\n\n"
                    "I hang up and my hands are shaking, which is stupid, because I won. "
                    "But we have to stick together in this building, and next month it "
                    "will be somebody else's turn to make that call.\n\n"
                    "The heat comes back on Friday at four in the afternoon. My sister "
                    "does not say thank you. She just turns the TV on louder, which is "
                    "the same thing.\n\n"
                    "Save myself a lot of trouble, I think, if I had just called on "
                    "day one."
                ),
            },
        ],
        "frases": [263, 382, 378, 212, 271, 305, 159, 384],
        "preguntas": [
            {
                "pregunta": "¿Qué consigue el narrador al final?",
                "opciones": [
                    "Que le perdonen la renta",
                    "Que vuelva la calefacción antes de pagar el recargo",
                    "Que lo saquen del edificio",
                ],
                "correcta": 1,
                "porque": "Pone la condición: calefacción primero, recargo después.",
            },
            {
                "pregunta": "\"I have to draw a line\" significa…",
                "opciones": [
                    "Tengo que dibujar una raya",
                    "Tengo que marcar un límite",
                    "Tengo que hacer fila",
                ],
                "correcta": 1,
                "porque": "Draw a line es poner un límite en una negociación.",
            },
            {
                "pregunta": "\"But it is what it is\" se usa cuando…",
                "opciones": [
                    "Algo no se puede cambiar y hay que aceptarlo",
                    "Algo es exactamente lo que se pidió",
                    "Alguien está mintiendo",
                ],
                "correcta": 0,
                "porque": "Es la resignación: es lo que hay.",
            },
        ],
    },
    {
        "id": "lec_entrevista",
        "titulo": "La entrevista",
        "subtitulo": "Cuarenta minutos y una pregunta que no esperabas",
        "publico": "general",
        "mundo": "dinero",
        "nivel": 3,
        "desbloquea": {"mundo": "dinero", "dominadas": 15},
        "capitulos": [
            {
                "n": 1,
                "titulo": "Los primeros diez minutos",
                "texto": (
                    "The recruiter looks at my resume for a long time before she says "
                    "anything.\n\n"
                    "\"Tell me about the one you are proudest of.\"\n\n"
                    "My flagship project, then. Eleven months, four people, a pipeline "
                    "that moved data "
                    "from thirteen hundred stores into one place every night. I say the "
                    "word we a lot, because it was true.\n\n"
                    "\"And you had full command of the architecture?\"\n\n"
                    "\"Full command, no. I owned the reconciliation side.\"\n\n"
                    "She writes something down. I cannot tell if honesty just cost me "
                    "the job.\n\n"
                    "\"Walk me through grading metrics before deployment.\"\n\n"
                    "That one I can answer in my sleep."
                ),
            },
            {
                "n": 2,
                "titulo": "La pregunta",
                "texto": (
                    "Then, near the end:\n\n"
                    "\"If you don't mind me asking? Why are you leaving?\"\n\n"
                    "There is a version of this answer that is safe and boring. I have "
                    "practiced it. Growth, new challenges, the usual.\n\n"
                    "I do not use it.\n\n"
                    "\"I'm able to do the work there for another five years and nothing "
                    "would change,\" I say. \"But my full intentions are to build "
                    "something people actually use.\"\n\n"
                    "She smiles for the first time in forty minutes.\n\n"
                    "\"I love that you're pivoting,\" she says. \"Most people say growth "
                    "and I stop listening.\"\n\n"
                    "I get the call two days later. Trustworthy, she wrote in her notes. "
                    "I asked."
                ),
            },
        ],
        "frases": [674, 143, 697, 19, 47, 62, 147, 699],
        "preguntas": [
            {
                "pregunta": "¿Por qué la reclutadora sonríe?",
                "opciones": [
                    "Porque el candidato dio la respuesta segura",
                    "Porque dijo la verdad en vez del discurso ensayado",
                    "Porque se acabó el tiempo",
                ],
                "correcta": 1,
                "porque": "Ella misma dice que deja de escuchar cuando oye la respuesta de siempre.",
            },
            {
                "pregunta": "\"If you don't mind me asking?\" sirve para…",
                "opciones": [
                    "Suavizar una pregunta incómoda",
                    "Pedir permiso para irse",
                    "Cambiar de tema",
                ],
                "correcta": 0,
                "porque": "Es la fórmula educada antes de una pregunta personal.",
            },
            {
                "pregunta": "Decir \"Full command, no\" en una entrevista es…",
                "opciones": [
                    "Un error grave",
                    "Reconocer un límite, y aquí juega a favor",
                    "Una forma de presumir",
                ],
                "correcta": 1,
                "porque": "La historia trata justamente de que la honestidad le funcionó.",
            },
        ],
    },
    {
        "id": "lec_amigos",
        "titulo": "Los que se quedan",
        "subtitulo": "Una amistad que se estira y no se rompe",
        "publico": "general",
        "mundo": "gente",
        "nivel": 2,
        "desbloquea": {"mundo": "gente", "dominadas": 15},
        "capitulos": [
            {
                "n": 1,
                "titulo": "La azotea, otra vez",
                "texto": (
                    "\"I'm drifting away from you guys,\" Nacho says, and nobody argues, "
                    "which is the worst part.\n\n"
                    "He moved across the city in March. Forty minutes on the metro. That "
                    "is all it took.\n\n"
                    "\"You could come on Sundays,\" says Ale.\n\n"
                    "\"I work Sundays.\"\n\n"
                    "\"Then Saturdays.\"\n\n"
                    "\"I'm breaking the habit of smoking and if I come here I smoke.\" "
                    "He laughs when he says it, but it is not a joke.\n\n"
                    "Ale gets loud. Nacho gets quiet. That is how it always goes with "
                    "them.\n\n"
                    "\"Stop screaming at me,\" Nacho says finally.\n\n"
                    "And Ale stops. That is new."
                ),
            },
            {
                "n": 2,
                "titulo": "Lo que quedó",
                "texto": (
                    "Two hours later we are still on the roof and nobody has left.\n\n"
                    "\"I went through with it,\" Nacho says. \"The job. I start Monday.\"\n\n"
                    "\"You didn't tell us.\"\n\n"
                    "\"I'm telling you now.\"\n\n"
                    "Ale opens his mouth, closes it, opens it again.\n\n"
                    "\"I have to draw a line somewhere,\" Nacho says. \"I can't be here "
                    "three nights a week and be there at seven.\"\n\n"
                    "\"Us first, like always,\" Ale says, and it sounds like a joke and "
                    "it is not.\n\n"
                    "But Nacho comes back the next Saturday anyway, and the one after "
                    "that.\n\n"
                    "\"Thanks for the rides,\" he says every time, getting out of the "
                    "car at midnight. Eight months later he is still saying it, and we "
                    "are still driving him."
                ),
            },
        ],
        "frases": [283, 284, 377, 413, 305, 417, 387],
        "preguntas": [
            {
                "pregunta": "¿Qué decide Nacho al final?",
                "opciones": [
                    "Dejar de ver a sus amigos",
                    "Seguir yendo, aunque menos seguido",
                    "Regresar a vivir al barrio",
                ],
                "correcta": 1,
                "porque": "Vuelve el sábado siguiente y el siguiente.",
            },
            {
                "pregunta": "\"I'm drifting away from you guys\" describe…",
                "opciones": [
                    "Un pleito fuerte",
                    "Alejarse poco a poco, sin querer",
                    "Una mudanza de país",
                ],
                "correcta": 1,
                "porque": "Drift away es irse alejando solo, como una corriente.",
            },
            {
                "pregunta": "\"I went through with it\" significa…",
                "opciones": [
                    "Pasé por ahí",
                    "Lo llevé a cabo, no me eché para atrás",
                    "Lo pensé mucho",
                ],
                "correcta": 1,
                "porque": "Go through with it es cumplir algo que costaba trabajo decidir.",
            },
        ],
    },
]


LECTURAS = LECTURAS + LECTURAS_EXTRA


def main() -> int:
    catalogo = json.loads(CATALOGO.read_text(encoding="utf-8"))
    por_id = {e["id"]: e for e in catalogo["entries"]}

    errores: list[str] = []
    salida = []

    for lec in LECTURAS:
        texto_completo = "\n\n".join(c["texto"] for c in lec["capitulos"])
        palabras = len(re.findall(r"\b[\w']+\b", texto_completo))

        for eid in lec["frases"]:
            entrada = por_id.get(eid)
            if entrada is None:
                errores.append(f"{lec['id']}: la entrada {eid} no existe en el catálogo")
                continue
            frase = entrada["phrase"]
            # Sin distinguir mayúsculas: una frase a media oración va en
            # minúscula y obligar la capital deformaría el inglés.
            if frase.lower() not in texto_completo.lower():
                errores.append(
                    f"{lec['id']}: la frase {eid} \"{frase}\" no aparece literal en el texto"
                )

        if not 120 <= palabras <= 520:
            errores.append(
                f"{lec['id']}: {palabras} palabras, fuera del rango 120-520"
            )

        for i, p in enumerate(lec["preguntas"]):
            if not 0 <= p["correcta"] < len(p["opciones"]):
                errores.append(f"{lec['id']}: pregunta {i} apunta a una opción que no existe")

        salida.append(
            {
                "id": lec["id"],
                "titulo": lec["titulo"],
                "subtitulo": lec["subtitulo"],
                "publico": lec["publico"],
                "mundo": lec["mundo"],
                "nivel": lec["nivel"],
                "palabras": palabras,
                "desbloquea": lec["desbloquea"],
                "audio": None,
                "capitulos": [
                    {
                        "n": c["n"],
                        "titulo": c["titulo"],
                        "texto": c["texto"],
                        "audio": None,
                    }
                    for c in lec["capitulos"]
                ],
                "frases": lec["frases"],
                "preguntas": lec["preguntas"],
            }
        )

    if errores:
        print("NO SE ESCRIBIÓ NADA. Errores:")
        for e in errores:
            print("  -", e)
        return 1

    doc = {
        "version": 1,
        "total": len(salida),
        "nota_frases": (
            "Cada id de 'frases' aparece literal en el texto. El lector las "
            "busca en tiempo de ejecución y las subraya; no hay posiciones "
            "guardadas, así que corregir una errata en el texto no rompe nada."
        ),
        "nota_audio": (
            "audio en null: falta la pasada de TTS por capítulo. La pantalla "
            "esconde el botón de escuchar mientras sea null."
        ),
        "lecturas": salida,
    }

    SALIDA.write_text(
        json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8"
    )

    print(f"ok: {len(salida)} lecturas escritas en {SALIDA.name}")
    for l in salida:
        print(
            f"  {l['id']:<20} {l['palabras']:>3} palabras  "
            f"{len(l['frases'])} frases  {len(l['capitulos'])} cap.  "
            f"{'bloqueada' if l['desbloquea'] else 'abierta'}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
