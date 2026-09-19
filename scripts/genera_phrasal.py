#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Arma assets/data/phrasal_verbs.json.

Un phrasal verb no es vocabulario normal y por eso no cabía en el
catálogo: lo que hay que aprender no es una palabra sino que el mismo
verbo cambia de significado por completo según la partícula. `Give up`
no tiene nada que ver con `give in` ni con `give away`, y aprenderlos
como tres entradas sueltas es justo lo que hace que nunca se peguen.

Por eso van agrupados por verbo. El usuario ve las cuatro caras de
`take` juntas y ahí es donde cae el veinte.

Cada uno lleva su nivel de riesgo social, igual que el catálogo:
`hook up` y `piss off` no se dicen en una entrevista, y ninguna otra app
te lo advierte.

vulgaridad: 0 limpio · 1 cuidado · 2 fuerte
separable: si admite objeto en medio (turn it on) o no (look after him)
"""

import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "assets" / "data" / "phrasal_verbs.json"

# (verbo, particula, significado, ejemplo, traduccion, vulgaridad,
#  separable, nota)
VERBOS = [
    # ---------------- GET ----------------
    ("get", "up", "levantarse de la cama", "I get up at six every day.",
     "Me levanto a las seis todos los días.", 0, False,
     "Levantarse de dormir. Para pararse de una silla es stand up."),
    ("get", "over", "superar algo o a alguien", "It took me a year to get over it.",
     "Me tomó un año superarlo.", 0, False,
     "Sirve para una gripa, una ruptura o un susto."),
    ("get", "along", "llevarse bien", "I get along with my boss.",
     "Me llevo bien con mi jefe.", 0, False,
     "Casi siempre con with. Sin with suena a que apenas la libras."),
    ("get", "away with", "salirse con la suya sin castigo",
     "He got away with it because nobody saw him.",
     "Se salió con la suya porque nadie lo vio.", 0, False,
     "Lleva implícito que no debió salirse con la suya."),
    ("get", "rid of", "deshacerse de algo", "I need to get rid of this couch.",
     "Necesito deshacerme de este sillón.", 0, False,
     "Con cosas y con costumbres. Con personas suena feo."),
    ("get", "back to", "responderle a alguien después",
     "Let me check and I'll get back to you.",
     "Déjame revisar y te digo.", 0, False,
     "La frase estándar del trabajo para ganar tiempo sin decir que no."),

    # ---------------- TAKE ----------------
    ("take", "off", "quitarse ropa, o despegar un avión",
     "Take off your jacket, it's hot.",
     "Quítate la chamarra, hace calor.", 0, True,
     "Dos significados que no se parecen. El contexto decide solo."),
    ("take", "over", "quedarse a cargo de algo",
     "She took over the project in March.",
     "Ella se quedó a cargo del proyecto en marzo.", 0, True,
     "Implica que alguien más lo tenía antes."),
    ("take", "care of", "encargarse de algo o cuidar a alguien",
     "I'll take care of it.",
     "Yo me encargo.", 0, False,
     "En el trabajo es la forma más corta de decir yo lo hago."),
    ("take", "up", "empezar un pasatiempo, u ocupar espacio",
     "I took up boxing last year.",
     "Empecé a boxear el año pasado.", 0, True,
     "Con tiempo o espacio: this takes up too much room."),
    ("take", "it out on", "desquitarse con alguien que no tiene culpa",
     "Don't take it out on me, I didn't do anything.",
     "No te desquites conmigo, yo no hice nada.", 0, False,
     "Casi siempre se dice en medio de un pleito."),

    # ---------------- PUT ----------------
    ("put", "off", "posponer algo", "Stop putting it off and just do it.",
     "Deja de dejarlo para después y hazlo.", 0, True,
     "También significa dar asco: that smell puts me off."),
    ("put", "up with", "aguantar algo o a alguien",
     "I can't put up with that noise anymore.",
     "Ya no aguanto ese ruido.", 0, False,
     "Siempre negativo. Nadie put up with algo que le gusta."),
    ("put", "on", "ponerse ropa, o poner música",
     "Put on your shoes, we're leaving.",
     "Ponte los zapatos, ya nos vamos.", 0, True,
     "Con peso significa subir de peso: I put on five kilos."),
    ("put", "down", "menospreciar a alguien",
     "He always puts her down in front of everyone.",
     "Siempre la menosprecia enfrente de todos.", 1, True,
     "Es acusar a alguien de humillar. Fuerte en una conversación."),

    # ---------------- GO ----------------
    ("go", "on", "seguir, o pasar algo",
     "What's going on here?",
     "¿Qué está pasando aquí?", 0, False,
     "What's going on es también un saludo entre amigos."),
    ("go", "through", "pasar por algo difícil",
     "She's going through a lot right now.",
     "Está pasando por muchas cosas ahorita.", 0, False,
     "Se usa para no dar detalles de algo delicado."),
    ("go", "off", "sonar una alarma, o explotar",
     "My alarm went off at five.",
     "Mi alarma sonó a las cinco.", 0, False,
     "Con una persona significa que explotó de coraje."),
    ("go", "for it", "lanzarse a hacer algo",
     "If you want the job, go for it.",
     "Si quieres el trabajo, lánzate.", 0, False,
     "Es el ándale de aliento."),

    # ---------------- COME ----------------
    ("come", "up with", "inventar o encontrar una idea",
     "We need to come up with a better plan.",
     "Necesitamos sacar un mejor plan.", 0, False,
     "En juntas se usa muchísimo. Es idea, no objeto."),
    ("come", "across", "toparse con algo, o dar cierta impresión",
     "I came across an old photo of us.",
     "Me topé con una foto vieja de nosotros.", 0, False,
     "Con as habla de cómo te ves: he comes across as rude."),
    ("come", "over", "ir a casa de alguien",
     "Come over after work.",
     "Cáete por acá saliendo del trabajo.", 0, False,
     "Siempre a casa de quien habla. Ir a otro lado es go over."),
    ("come", "down to", "reducirse a lo esencial",
     "It all comes down to money.",
     "Todo se reduce al dinero.", 0, False,
     "La forma elegante de cerrar una discusión."),

    # ---------------- LOOK ----------------
    ("look", "for", "buscar algo", "I'm looking for my keys.",
     "Estoy buscando mis llaves.", 0, False,
     "Buscar en general. Encontrarlo es find."),
    ("look", "after", "cuidar a alguien",
     "Can you look after the dog this weekend?",
     "¿Puedes cuidar al perro este fin?", 0, False,
     "Más británico. En Estados Unidos oirás más watch."),
    ("look", "up to", "admirar a alguien",
     "I've always looked up to my sister.",
     "Siempre he admirado a mi hermana.", 0, False,
     "Lo contrario es look down on, despreciar."),
    ("look", "into", "investigar algo",
     "I'll look into it and let you know.",
     "Lo reviso y te aviso.", 0, False,
     "En el trabajo suele significar aún no hago nada."),
    ("look", "forward to", "tener ganas de que algo pase",
     "I'm looking forward to the weekend.",
     "Ya quiero que llegue el fin.", 0, False,
     "Lleva -ing después, no infinitivo: looking forward to seeing you."),

    # ---------------- TURN ----------------
    ("turn", "on", "encender algo", "Turn on the light, please.",
     "Prende la luz, por favor.", 0, True,
     "Con una persona significa excitar. Cuidado con a quién se lo dices."),
    ("turn", "down", "rechazar una oferta, o bajar el volumen",
     "They turned down my offer.",
     "Rechazaron mi oferta.", 0, True,
     "Los dos sentidos se usan igual de seguido."),
    ("turn", "up", "aparecerse sin avisar",
     "He turned up at midnight.",
     "Se apareció a medianoche.", 0, False,
     "También subir el volumen. Y en jerga, ir a una fiesta a lo grande."),
    ("turn", "out", "resultar de cierta forma",
     "It turned out better than I thought.",
     "Salió mejor de lo que pensaba.", 0, False,
     "Turns out solo, al principio, es resulta que."),

    # ---------------- BREAK ----------------
    ("break", "up", "terminar una relación",
     "They broke up after four years.",
     "Terminaron después de cuatro años.", 0, False,
     "Solo para parejas. Una amistad se termina con drift apart."),
    ("break", "down", "descomponerse, o derrumbarse emocionalmente",
     "My car broke down on the highway.",
     "Se me descompuso el carro en la carretera.", 0, False,
     "Con una persona es quebrarse a llorar."),
    ("break", "into", "meterse a robar",
     "Somebody broke into the house last night.",
     "Alguien se metió a la casa anoche.", 0, False,
     "Break in sin objeto también funciona."),

    # ---------------- WORK / KEEP ----------------
    ("work", "out", "resolverse bien, o hacer ejercicio",
     "Don't worry, it'll work out.",
     "No te preocupes, se va a arreglar.", 0, False,
     "Los dos sentidos son igual de comunes."),
    ("keep", "up", "mantener el ritmo",
     "Slow down, I can't keep up.",
     "Bájale, no te alcanzo.", 0, False,
     "Con with: keep up with the news."),
    ("keep", "on", "seguir haciendo algo",
     "He keeps on asking me the same thing.",
     "Sigue preguntándome lo mismo.", 0, False,
     "Lleva -ing y suena a fastidio."),
    ("figure", "out", "descifrar algo",
     "I can't figure out how this works.",
     "No logro entender cómo funciona esto.", 0, True,
     "Es el más usado de todos en inglés hablado."),

    # ---------------- SOCIALES ----------------
    ("hang", "out", "pasar el rato con alguien",
     "We should hang out this weekend.",
     "Deberíamos vernos este fin.", 0, False,
     "Sin plan fijo. Si hay plan concreto se dice meet up."),
    ("show", "up", "llegar a un lugar",
     "He didn't show up.",
     "No llegó.", 0, False,
     "Neutro. Turn up suena más a sorpresa."),
    ("catch", "up", "ponerse al día",
     "Let's catch up soon.",
     "A ver cuándo nos ponemos al día.", 0, False,
     "También alcanzar a alguien que va adelante."),
    ("chill", "out", "calmarse", "Chill out, it's not a big deal.",
     "Cálmate, no es para tanto.", 1, False,
     "Decírselo a alguien enojado suele enojarlo más."),
    ("hook", "up", "conectar algo, o acostarse con alguien",
     "They hooked up after the party.",
     "Se enredaron después de la fiesta.", 1, False,
     "El sentido sexual es el más común entre jóvenes. En el trabajo, evítalo."),
    ("call", "off", "cancelar algo", "They called off the wedding.",
     "Cancelaron la boda.", 0, True,
     "Para eventos ya planeados."),
    ("run", "into", "toparse con alguien por casualidad",
     "I ran into your brother downtown.",
     "Me topé a tu hermano en el centro.", 0, False,
     "Solo por casualidad. A propósito es meet."),
    ("drop", "by", "pasar rápido a un lugar",
     "I'll drop by later.",
     "Me caigo un rato al rato.", 0, False,
     "Visita corta y sin avisar mucho."),

    # ---------------- TRABAJO ----------------
    ("carry", "out", "llevar a cabo algo",
     "We carried out the plan as agreed.",
     "Llevamos a cabo el plan como se acordó.", 0, True,
     "Formal. En correos de trabajo se ve seguido."),
    ("bring", "up", "sacar un tema",
     "Don't bring that up at dinner.",
     "No saques ese tema en la cena.", 0, True,
     "También criar a un hijo: I was brought up here."),
    ("point", "out", "señalar algo que otros no vieron",
     "She pointed out a mistake in the report.",
     "Señaló un error en el reporte.", 0, True,
     "Neutro, pero en junta puede sonar a corrección pública."),
    ("back", "up", "respaldar a alguien, o hacer copia",
     "Back me up on this one.",
     "Respáldame en esta.", 0, True,
     "Con archivos es la copia de seguridad."),
    ("lay", "off", "despedir por recorte",
     "They laid off thirty people.",
     "Corrieron a treinta personas.", 0, True,
     "No es por mal desempeño; eso es fire."),
    ("sign", "up", "inscribirse", "I signed up for the course.",
     "Me inscribí al curso.", 0, False,
     "Con for. Sign in es entrar a una cuenta."),
    ("fill", "out", "llenar un formato",
     "Fill out this form, please.",
     "Llene este formato, por favor.", 0, True,
     "En trámites lo vas a oír todo el tiempo."),
    ("follow", "up", "dar seguimiento",
     "I'll follow up with them tomorrow.",
     "Les doy seguimiento mañana.", 0, False,
     "El sustantivo va con guion: a follow-up."),

    # ---------------- FUERTES ----------------
    ("piss", "off", "hacer enojar a alguien",
     "That really pissed me off.",
     "Eso sí me encabronó.", 2, True,
     "Grosería clara. Con amigos pasa; con tu jefe no."),
    ("screw", "up", "regarla feo",
     "I screwed up the presentation.",
     "Regué la presentación.", 1, True,
     "Menos fuerte que su versión con f, pero tampoco es de junta."),
    ("shut", "up", "callarse", "Shut up, I'm trying to listen.",
     "Cállate, estoy tratando de oír.", 1, False,
     "Entre amigos es normal; a un desconocido es una agresión."),
    ("blow", "off", "plantar a alguien",
     "He blew me off again.",
     "Me dejó plantado otra vez.", 1, True,
     "Cancelar sin avisar y sin importarle."),
    ("freak", "out", "ponerse como loco",
     "She freaked out when she saw the bill.",
     "Se puso como loca cuando vio la cuenta.", 1, False,
     "De susto, de coraje o de emoción."),
    ("mess", "up", "arruinar algo",
     "I messed up the order.",
     "Eché a perder el pedido.", 0, True,
     "La versión limpia de screw up."),

    # ---------------- DINERO Y CASA ----------------
    ("pay", "off", "terminar de pagar, o valer la pena",
     "I finally paid off my car.",
     "Por fin acabé de pagar mi carro.", 0, True,
     "It paid off es valió la pena."),
    ("save", "up", "ahorrar para algo",
     "I'm saving up for a trip.",
     "Estoy ahorrando para un viaje.", 0, False,
     "Con for. Save solo es guardar."),
    ("run", "out of", "quedarse sin algo",
     "We ran out of milk.",
     "Se nos acabó la leche.", 0, False,
     "Con tiempo también: I'm running out of time."),
    ("move", "in", "mudarse a vivir a un lugar",
     "They moved in together last month.",
     "Se fueron a vivir juntos el mes pasado.", 0, False,
     "Move out es lo contrario."),
    ("clean", "up", "limpiar y ordenar",
     "Clean up before your mom gets here.",
     "Recoge antes de que llegue tu mamá.", 0, True,
     "Ordenar el desmadre, no trapear."),
    ("throw", "away", "tirar a la basura",
     "Don't throw that away, I need it.",
     "No tires eso, lo necesito.", 0, True,
     "Con oportunidades también: he threw away his chance."),
]


# Las formas en pasado de los irregulares que aparecen en los ejemplos.
# Solo hace falta para la comprobación; no se guarda en el JSON.
IRREGULARES = {
    "get": ["got", "gotten"],
    "take": ["took", "taken"],
    "go": ["went", "gone"],
    "come": ["came"],
    "break": ["broke", "broken"],
    "run": ["ran"],
    "lay": ["laid"],
    "blow": ["blew", "blown"],
    "pay": ["paid"],
    "keep": ["kept"],
    "bring": ["brought"],
    "throw": ["threw", "thrown"],
    "put": ["put"],
    "show": ["showed", "shown"],
    "catch": ["caught"],
    "hang": ["hung"],
    "shut": ["shut"],
    "sign": ["signed"],
}


def main() -> int:
    errores: list[str] = []
    vistos: set[tuple[str, str]] = set()
    salida = []

    for i, (verbo, part, signif, ej, trad, vulg, sep, nota) in enumerate(VERBOS):
        clave = (verbo, part)
        if clave in vistos:
            errores.append(f"duplicado: {verbo} {part}")
        vistos.add(clave)

        frase = f"{verbo} {part}"
        # El ejemplo tiene que contener el phrasal verb de verdad, aunque
        # venga conjugado. Sin esta comprobación se cuela un ejemplo que
        # no enseña la frase que dice enseñar.
        #
        # Comparar solo la raíz no sirve: la mitad de estos verbos son
        # irregulares y en pasado no se parecen a su infinitivo. "Broke"
        # no empieza con "bre" y "went" no tiene nada de "go".
        cuerpo = ej.lower()
        palabras = re.findall(r"[a-z']+", cuerpo)
        raiz = verbo.lower()[:3]
        irregulares = set(IRREGULARES.get(verbo.lower(), []))
        # Dos caminos: o alguna palabra arranca con la raíz del verbo
        # (cubre put/putting, save/saving, look/looked), o es una forma
        # irregular de la lista (broke, went, took).
        usa = any(w.startswith(raiz) for w in palabras) or any(
            w in irregulares for w in palabras
        )
        if not usa:
            errores.append(f"{frase}: el ejemplo no usa el verbo")
        if part.split()[0].lower() not in cuerpo:
            errores.append(f"{frase}: el ejemplo no usa la partícula")
        if vulg not in (0, 1, 2):
            errores.append(f"{frase}: vulgaridad fuera de rango")
        if not re.search(r"[.!?]$", ej):
            errores.append(f"{frase}: el ejemplo no cierra con puntuación")

        salida.append(
            {
                "id": i + 1,
                "verbo": verbo,
                "particula": part,
                "frase": frase,
                "significado": signif,
                "ejemplo": ej,
                "traduccion": trad,
                "vulgaridad": vulg,
                "separable": sep,
                "nota": nota,
            }
        )

    if errores:
        print("NO SE ESCRIBIÓ NADA. Errores:")
        for e in errores:
            print("  -", e)
        return 1

    # Agrupados por verbo: aprender las cuatro caras de take juntas es
    # justo lo que hace que se peguen.
    grupos: dict[str, list[int]] = {}
    for pv in salida:
        grupos.setdefault(pv["verbo"], []).append(pv["id"])

    doc = {
        "version": 1,
        "total": len(salida),
        "nota": (
            "Van agrupados por verbo. Lo que hay que aprender no es una "
            "palabra sino que el mismo verbo cambia de significado por "
            "completo según la partícula."
        ),
        "grupos": [
            {"verbo": v, "cuantos": len(ids), "ids": ids}
            for v, ids in sorted(grupos.items(), key=lambda x: -len(x[1]))
        ],
        "verbos": salida,
    }

    SALIDA.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")

    fuertes = sum(1 for p in salida if p["vulgaridad"] == 2)
    cuidado = sum(1 for p in salida if p["vulgaridad"] == 1)
    print(f"ok: {len(salida)} phrasal verbs en {SALIDA.name}")
    print(f"  {len(doc['grupos'])} verbos distintos")
    print(f"  {cuidado} marcados cuidado, {fuertes} marcados fuerte")
    print(f"  {sum(1 for p in salida if p['separable'])} separables")
    return 0


if __name__ == "__main__":
    sys.exit(main())
