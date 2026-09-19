#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Arma assets/data/niveles.json: doscientos niveles por juego.

Un nivel NO es una lista fija de tarjetas. Es un tramo del catálogo más
los parámetros de dificultad de ese tramo. La diferencia importa: si el
nivel amarrara ids concretos, el juego dejaría de jalar las tarjetas que
al usuario le tocan hoy y el arcade volvería a competir con la sesión en
vez de alimentarla.

Lo que sí fija el nivel:
  - de qué bolsa salen las entradas (banda de dificultad)
  - cuántas rondas, cuántas jugadas, cuánto tiempo, cuántos señuelos
  - qué se necesita para tres estrellas

Dentro de esa bolsa, el juego sigue prefiriendo lo que ya venció.
"""

import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CATALOGO = RAIZ / "assets" / "data" / "catalogo.json"
SALIDA = RAIZ / "assets" / "data" / "niveles.json"

NIVELES_POR_JUEGO = 200


def norm_palabra(p: str | None) -> str:
    return re.sub(r"[^a-z']", "", (p or "").strip().lower())


def curva(n: int, total: int, desde: float, hasta: float) -> float:
    """Interpola de `desde` a `hasta` a lo largo de los niveles."""
    if total <= 1:
        return hasta
    t = (n - 1) / (total - 1)
    return desde + (hasta - desde) * t


def escalon(n: int, cortes: list[tuple[int, int]], final: int) -> int:
    """Valor por tramos: el primero cuyo corte no se ha pasado."""
    for hasta, valor in cortes:
        if n <= hasta:
            return valor
    return final


# --------------------------------------------------------------------
# Bandas: cómo se parte el catálogo en tramos de dificultad creciente
# --------------------------------------------------------------------


def bandas_colmena(entradas):
    """Por largo de la palabra que hay que deletrear."""
    usables = [
        e
        for e in entradas
        if 3 <= len(norm_palabra(e.get("completar_palabra"))) <= 9
        and norm_palabra(e["completar_palabra"]) in e["phrase_tts"].lower()
    ]
    return [
        {
            "id": "corta",
            "nombre": "Palabras cortas",
            "desde": 1,
            "hasta": 60,
            "ids": [
                e["id"] for e in usables
                if len(norm_palabra(e["completar_palabra"])) <= 5
            ],
        },
        {
            "id": "media",
            "nombre": "Palabras medianas",
            "desde": 61,
            "hasta": 140,
            "ids": [
                e["id"] for e in usables
                if 6 <= len(norm_palabra(e["completar_palabra"])) <= 7
            ],
        },
        {
            "id": "larga",
            "nombre": "Palabras largas",
            "desde": 141,
            "hasta": 200,
            "ids": [
                e["id"] for e in usables
                if len(norm_palabra(e["completar_palabra"])) >= 8
            ],
        },
    ]


def bandas_pares(entradas):
    """Por nivel del catálogo, que es lo que decide si la frase se reconoce."""
    usables = [
        e
        for e in entradas
        if e["word_count"] <= 4
        and len(e["phrase"]) <= 26
        and len(e["spanish_main"]) <= 30
    ]
    return [
        {
            "id": "facil",
            "nombre": "Frases fáciles",
            "desde": 1,
            "hasta": 70,
            "ids": [e["id"] for e in usables if e["nivel"] == 1],
        },
        {
            "id": "media",
            "nombre": "Frases medianas",
            "desde": 71,
            "hasta": 150,
            "ids": [e["id"] for e in usables if e["nivel"] == 2],
        },
        {
            "id": "dificil",
            "nombre": "Frases difíciles",
            "desde": 151,
            "hasta": 200,
            "ids": [e["id"] for e in usables if e["nivel"] == 3],
        },
    ]


def bandas_caida(entradas):
    usables = [e for e in entradas if len(e["spanish_main"]) <= 32]
    return [
        {
            "id": "facil",
            "nombre": "Calentando",
            "desde": 1,
            "hasta": 70,
            "ids": [e["id"] for e in usables if e["nivel"] == 1],
        },
        {
            "id": "media",
            "nombre": "En serio",
            "desde": 71,
            "hasta": 150,
            "ids": [e["id"] for e in usables if e["nivel"] == 2],
        },
        {
            "id": "dificil",
            "nombre": "Sin piedad",
            "desde": 151,
            "hasta": 200,
            "ids": [e["id"] for e in usables if e["nivel"] == 3],
        },
    ]


def bandas_dulces(entradas):
    usables = [
        e
        for e in entradas
        if e["word_count"] <= 6 and len(e["spanish_main"]) <= 34
    ]
    return [
        {
            "id": "facil",
            "nombre": "Tablero chico",
            "desde": 1,
            "hasta": 70,
            "ids": [e["id"] for e in usables if e["nivel"] == 1],
        },
        {
            "id": "media",
            "nombre": "Tablero normal",
            "desde": 71,
            "hasta": 150,
            "ids": [e["id"] for e in usables if e["nivel"] == 2],
        },
        {
            "id": "dificil",
            "nombre": "Tablero grande",
            "desde": 151,
            "hasta": 200,
            "ids": [e["id"] for e in usables if e["nivel"] == 3],
        },
    ]


# --------------------------------------------------------------------
# Parámetros por nivel
# --------------------------------------------------------------------


def nivel_colmena(n: int, banda: str) -> dict:
    rondas = escalon(n, [(20, 8), (60, 10), (140, 12)], 15)
    senuelos = escalon(n, [(30, 2), (100, 3)], 4)
    pistas = escalon(n, [(10, 3), (50, 2), (120, 1)], 0)
    # Segundos por ronda. No baja de 12: menos de eso no alcanza a leer
    # la pista y tocar seis letras, y el nivel deja de medir si sabes la
    # frase para medir qué tan rápido tienes el pulgar.
    # Subido tras probarlo en el teléfono: armar una frase entera
    # letra por letra es más lento de lo que parece en la hoja.
    segundos = round(curva(n, NIVELES_POR_JUEGO, 60, 22))
    return {
        "n": n,
        "banda": banda,
        "rondas": rondas,
        "senuelos": senuelos,
        "pistasGratis": pistas,
        "segundosRonda": max(20, segundos),
        # Tres estrellas pide casi perfecto; una, la mitad. Nunca cero:
        # terminar el nivel siempre lo pasa.
        "estrellas": [
            max(1, round(rondas * 0.5)),
            max(2, round(rondas * 0.75)),
            max(3, round(rondas * 0.95)),
        ],
    }


def nivel_pares(n: int, banda: str) -> dict:
    pares = escalon(n, [(15, 4), (50, 5), (110, 6), (170, 7)], 8)
    # El colchón de jugadas se va cerrando: al principio sobran cuatro,
    # al final apenas una. Es la única palanca de dificultad que no
    # castiga con reloj.
    colchon = escalon(n, [(20, 5), (70, 4), (140, 3)], 2)
    # El reloj de Pares es del tablero entero, no de cada pareja: parar
    # el cronómetro ocho veces por partida rompería el ritmo, que es lo
    # único que este juego tiene.
    segundos = max(60, round(pares * escalon(n, [(40, 20), (120, 16)], 13)))
    return {
        "n": n,
        "banda": banda,
        "pares": pares,
        "jugadas": pares + colchon,
        "segundosTablero": segundos,
        "estrellas": [
            max(1, round(pares * 0.5)),
            max(2, round(pares * 0.75)),
            pares,
        ],
    }


def nivel_caida(n: int, banda: str) -> dict:
    rondas = escalon(n, [(20, 6), (70, 8), (140, 10)], 12)
    inicio = round(curva(n, NIVELES_POR_JUEGO, 7000, 4200) / 100) * 100
    minimo = round(curva(n, NIVELES_POR_JUEGO, 4200, 2800) / 100) * 100
    acelera = escalon(n, [(50, 100), (120, 140)], 180)
    return {
        "n": n,
        "banda": banda,
        "rondas": rondas,
        "caidaInicialMs": inicio,
        "caidaMinimaMs": minimo,
        "aceleraMs": acelera,
        "estrellas": [
            max(1, round(rondas * 0.5)),
            max(2, round(rondas * 0.75)),
            rondas,
        ],
    }


def nivel_dulces(n: int, banda: str) -> dict:
    cols = escalon(n, [(40, 6), (120, 7)], 8)
    rows = escalon(n, [(40, 7), (120, 8)], 9)
    colores = escalon(n, [(30, 4), (130, 5)], 6)
    frases = escalon(n, [(25, 3), (80, 4), (150, 5)], 6)
    jugadas = escalon(n, [(20, 26), (60, 24), (120, 22), (170, 20)], 18)
    meta = escalon(n, [(40, 7), (120, 9)], 11)
    # Dulces no lleva reloj: se limita por jugadas. Meterle las dos cosas
    # convierte un juego de pensar en uno de picar rápido.
    return {
        "n": n,
        "banda": banda,
        "cols": cols,
        "rows": rows,
        "colores": colores,
        "frases": frases,
        "jugadas": jugadas,
        "metaPorFrase": meta,
        "estrellas": [
            max(1, frases - 2),
            max(2, frases - 1),
            frases,
        ],
    }


JUEGOS = {
    "colmena": (bandas_colmena, nivel_colmena, "Colmena"),
    "pares": (bandas_pares, nivel_pares, "Pares"),
    "caida": (bandas_caida, nivel_caida, "Caída"),
    "dulces": (bandas_dulces, nivel_dulces, "Dulces"),
}


def main() -> int:
    catalogo = json.loads(CATALOGO.read_text(encoding="utf-8"))
    entradas = [
        e
        for e in catalogo["entries"]
        if e.get("is_canonical") and not e.get("revisar") and e.get("tipo") != "regla_fonetica"
    ]

    errores: list[str] = []
    salida: dict = {}

    for juego, (fn_bandas, fn_nivel, nombre) in JUEGOS.items():
        bandas = fn_bandas(entradas)

        for b in bandas:
            if len(b["ids"]) < 12:
                errores.append(
                    f"{juego}: la banda '{b['id']}' solo tiene {len(b['ids'])} entradas, "
                    "no alcanza para llenar sus niveles"
                )

        niveles = []
        for n in range(1, NIVELES_POR_JUEGO + 1):
            banda = next(
                (b for b in bandas if b["desde"] <= n <= b["hasta"]), bandas[-1]
            )
            niveles.append(fn_nivel(n, banda["id"]))

        # Las estrellas nunca pueden pedir más de lo que el nivel da.
        for nv in niveles:
            tope = nv.get("rondas") or nv.get("pares") or nv.get("frases") or 0
            if nv["estrellas"][2] > tope:
                errores.append(
                    f"{juego} nivel {nv['n']}: tres estrellas piden "
                    f"{nv['estrellas'][2]} y el nivel solo da {tope}"
                )
            if not (nv["estrellas"][0] <= nv["estrellas"][1] <= nv["estrellas"][2]):
                errores.append(
                    f"{juego} nivel {nv['n']}: las estrellas no van en orden"
                )
            # Un reloj imposible no es dificultad, es un muro.
            if "segundosRonda" in nv and nv["segundosRonda"] < 20:
                errores.append(
                    f"{juego} nivel {nv['n']}: {nv['segundosRonda']}s por ronda es muy poco"
                )
            if "segundosTablero" in nv and nv["segundosTablero"] < 60:
                errores.append(
                    f"{juego} nivel {nv['n']}: {nv['segundosTablero']}s de tablero es injugable"
                )

        salida[juego] = {
            "nombre": nombre,
            "total": len(niveles),
            "bandas": [
                {
                    "id": b["id"],
                    "nombre": b["nombre"],
                    "desde": b["desde"],
                    "hasta": b["hasta"],
                    "ids": sorted(b["ids"]),
                }
                for b in bandas
            ],
            "niveles": niveles,
        }

    if errores:
        print("NO SE ESCRIBIÓ NADA. Errores:")
        for e in errores:
            print("  -", e)
        return 1

    doc = {
        "version": 1,
        "nivelesPorJuego": NIVELES_POR_JUEGO,
        "nota": (
            "Un nivel es un tramo del catálogo más sus parámetros, no una "
            "lista fija de tarjetas. Dentro de su banda, el juego sigue "
            "prefiriendo lo que ya venció, así que jugar niveles adelanta "
            "la cola de repaso."
        ),
        "juegos": salida,
    }

    SALIDA.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")

    print(f"ok: {SALIDA.name}")
    for juego, d in salida.items():
        bandas = " · ".join(
            f"{b['id']} {len(b['ids'])}" for b in d["bandas"]
        )
        print(f"  {juego:<9} {d['total']} niveles   bolsas: {bandas}")
    total = sum(d["total"] for d in salida.values())
    print(f"  {'TOTAL':<9} {total} niveles")
    return 0


if __name__ == "__main__":
    sys.exit(main())
