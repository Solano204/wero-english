/**
 * Prueba lo puro de Dulces: las formas de las piezas y el contraste de su símbolo.
 *
 *   npm run check:dulces
 *
 * piezas.ts no importa nada, así que se transpila en memoria con typescript y se carga como módulo, sin jest.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const cargar = async (rel) => {
  const fuente = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const js = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};
const P = await cargar('src/features/juegos/dulces/logic/piezas.ts');
const { FORMAS, COLORES_MAX, NOMBRE_FORMA, NOMBRE_COLOR, TRAZOS, formaDe, nombreColor, etiquetaPieza, indiceMasCercana } = P;

let total = 0;
const prueba = (nombre, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nombre}`);
};

const niveles = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/niveles.json'), 'utf8')).juegos.dulces.niveles;
const tokens = fs.readFileSync(path.join(ROOT, 'src/theme/tokens.ts'), 'utf8');

prueba('cada color lleva su propia forma y su propio nombre', () => {
  assert.equal(COLORES_MAX, 6);
  assert.equal(new Set(FORMAS).size, COLORES_MAX, 'seis formas distintas');
  assert.equal(new Set(NOMBRE_COLOR).size, COLORES_MAX, 'seis nombres de color distintos');
  assert.equal(new Set(FORMAS.map((f) => NOMBRE_FORMA[f])).size, COLORES_MAX, 'seis nombres de forma distintos');
  for (let c = 0; c < COLORES_MAX; c++) assert.equal(formaDe(c), FORMAS[c]);
});

prueba('el ejemplo del prompt: «Amarillo, círculo, fila 2, columna 3»', () => {
  assert.equal(etiquetaPieza(0, 1, 2), 'Amarillo, círculo, fila 2, columna 3');
  assert.equal(etiquetaPieza(4, 0, 0), 'Rosa, estrella, fila 1, columna 1');
  assert.equal(etiquetaPieza(5, 8, 7), 'Azul, hexágono, fila 9, columna 8');
});

prueba('un color fuera de rango da la vuelta: nunca hay una pieza sin forma ni nombre', () => {
  assert.equal(formaDe(6), formaDe(0));
  assert.equal(formaDe(-1), formaDe(5));
  assert.equal(nombreColor(7), nombreColor(1));
  assert.ok(/^[A-ZÁÉÍÓÚ]/.test(etiquetaPieza(99, 0, 0)), 'empieza con el nombre del color, con mayúscula');
});

prueba('los niveles reales piden a lo más los colores que hay (antes el sexto salía gris y sin forma)', () => {
  const colores = new Set(niveles.map((n) => n.colores));
  assert.deepEqual([...colores].sort(), [4, 5, 6]);
  for (const n of niveles) assert.ok(n.colores <= COLORES_MAX, `nivel ${n.n}`);
  assert.ok(niveles.some((n) => n.colores === 6), 'hay niveles de seis colores');
  for (const n of niveles) {
    const formas = new Set(Array.from({ length: n.colores }, (_, c) => formaDe(c)));
    assert.equal(formas.size, n.colores, `nivel ${n.n}: una forma distinta por color`);
  }
});

prueba('los trazos son bien formados y distintos', () => {
  const formas = Object.keys(TRAZOS);
  assert.equal(formas.length, COLORES_MAX);
  for (const f of formas) {
    const d = TRAZOS[f];
    assert.ok(d.startsWith('M') && d.trim().endsWith('Z'), `${f} abre y cierra`);
    const numeros = d.match(/-?\d+(\.\d+)?/g).map(Number);
    assert.ok(numeros.length >= 6 && numeros.every(Number.isFinite), `${f}: números finitos`);
    // Cabe en la caja de 24 (los arcos del círculo son relativos: no se miden).
    if (f !== 'circulo') assert.ok(numeros.every((v) => v >= 0 && v <= P.CAJA), `${f} cabe en la caja`);
  }
  assert.equal(new Set(formas.map((f) => TRAZOS[f])).size, COLORES_MAX, 'ningún trazo se repite');
});

prueba('la meta más cerca de llenarse: la que ya avanzó y aún no se llena', () => {
  const m = (llevas, meta) => ({ llevas, meta });
  assert.equal(indiceMasCercana([]), -1);
  assert.equal(indiceMasCercana([m(0, 7), m(0, 7), m(0, 7)]), -1, 'nadie avanzó: ninguna lleva filo');
  assert.equal(indiceMasCercana([m(2, 7), m(5, 7), m(3, 7)]), 1);
  assert.equal(indiceMasCercana([m(7, 7), m(4, 7), m(0, 7)]), 1, 'una llena ya no cuenta: pasó a la pregunta');
  assert.equal(indiceMasCercana([m(3, 7), m(3, 7)]), 0, 'en un empate gana la primera');
  assert.equal(indiceMasCercana([m(2, 7), m(4, 9), m(3, 11)]), 1, 'se compara el avance, no las piezas');
  assert.equal(indiceMasCercana([m(1, 0)]), -1, 'una meta de 0 no rompe la cuenta');
});

// --- el símbolo blanco al 70 % contra el tono medio de cada tinte (WCAG 1.4.11: 3:1 para gráficos)
const lineal = (v) => {
  v /= 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminancia = ([r, g, b]) => 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const tintes = [
  ...tokens.matchAll(
    /\{ claro: '(#[0-9A-Fa-f]{6})', medio: '(#[0-9A-Fa-f]{6})', oscuro: '(#[0-9A-Fa-f]{6})', simbolo: '(#[0-9A-Fa-f]{6})' \}/g
  ),
].map((m) => ({ claro: m[1], medio: m[2], oscuro: m[3], simbolo: m[4] }));

prueba('hay un tinte por color y cada uno es un degradado del mismo tono, del claro al oscuro', () => {
  assert.equal(tintes.length, COLORES_MAX);
  for (const t of tintes) {
    const [c, m, o] = [t.claro, t.medio, t.oscuro].map((h) => luminancia(hex(h)));
    assert.ok(c > m && m > o, `${t.medio}: claro > medio > oscuro`);
  }
});

prueba('el símbolo (un tono más oscuro del mismo color, no blanco) se distingue (3:1) de la cara', () => {
  for (const t of tintes) {
    const c = contraste(hex(t.simbolo), hex(t.medio));
    assert.ok(c >= 3, `${t.medio} / ${t.simbolo}: ${c.toFixed(2)}:1`);
  }
});

prueba('los seis colores se distinguen incluso en escala de grises (0.08 mínimo de luminancia entre cada par)', () => {
  for (let i = 0; i < tintes.length; i++) {
    for (let j = i + 1; j < tintes.length; j++) {
      const d = Math.abs(luminancia(hex(tintes[i].medio)) - luminancia(hex(tintes[j].medio)));
      assert.ok(d >= 0.08, `${tintes[i].medio} / ${tintes[j].medio}: ${d.toFixed(3)}`);
    }
  }
});

// ── la resolución por pasos contra `resolve` ─────────────────────────────
// Carga módulos puros que importan a otros módulos puros (match3Pasos importa match3), como check-srs.mjs.
const cache = new Map();
function resolver(spec, desde) {
  const base = spec.startsWith('@/') ? path.join(ROOT, 'src', spec.slice(2)) : path.resolve(path.dirname(desde), spec);
  for (const c of [`${base}.ts`, path.join(base, 'index.ts')]) if (fs.existsSync(c)) return c;
  throw new Error(`no se pudo resolver ${spec} desde ${path.relative(ROOT, desde)}`);
}
function cargarConImports(archivo) {
  if (cache.has(archivo)) return cache.get(archivo);
  let js = ts.transpileModule(fs.readFileSync(archivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  js = js.replace(/(from\s+|import\()\s*(["'])([^"']+)\2/g, (_, pre, q, spec) => {
    if (!spec.startsWith('.') && !spec.startsWith('@/')) {
      throw new Error(`${path.relative(ROOT, archivo)} importa el paquete ${spec}: no es un módulo puro`);
    }
    return `${pre}"${cargarConImports(resolver(spec, archivo))}"`;
  });
  const url = `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
  cache.set(archivo, url);
  return url;
}
const importar = (rel) => import(cargarConImports(path.join(ROOT, rel)));
const M3 = await importar('src/domain/match3.ts');
const PS = await importar('src/domain/match3Pasos.ts');

/** Un azar con semilla (mulberry32): el mismo número de llamadas da la misma secuencia. */
function semilla(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAMANOS = [
  [6, 7, 4],
  [6, 7, 5],
  [7, 8, 5],
  [8, 9, 6],
  [8, 9, 4],
];
/** Un tablero al azar SIN cuidar que no haya líneas: resolverlo da cascadas de todos los tamaños. */
function tableroCrudo(cols, rows, colores, azar) {
  return { cols, rows, cells: Array.from({ length: cols * rows }, () => Math.floor(azar() * colores)) };
}

/** Repite el paso sobre un tablero aparte y devuelve el resultado, comprobando que sea coherente. */
function reproducir(cells, cols, rows, pasos) {
  let ids = cells.map((_, i) => i);
  let siguienteId = cells.length;
  let actual = [...cells];
  for (const [n, paso] of pasos.entries()) {
    const etiqueta = `paso ${n + 1}`;
    // Lo que se quita está donde dice y es del color que dice.
    paso.quitar.forEach((i, k) => assert.equal(actual[i], paso.colores[k], `${etiqueta}: el color de lo quitado`));
    assert.equal(paso.quitar.length, paso.colores.length);
    for (const i of paso.quitar) actual[i] = M3.VACIA;
    // Las piezas que quedan bajan por su columna, siempre hacia abajo.
    const mover = paso.caidas.map((c) => ({ ...c, valor: actual[c.desde] }));
    for (const c of paso.caidas) {
      assert.equal(c.desde % cols, c.hasta % cols, `${etiqueta}: baja por su columna`);
      assert.ok(c.hasta > c.desde, `${etiqueta}: solo baja`);
      assert.notEqual(actual[c.desde], M3.VACIA, `${etiqueta}: lo que baja es una pieza`);
    }
    for (const c of paso.caidas) actual[c.desde] = M3.VACIA;
    for (const m of mover) actual[m.hasta] = m.valor;
    // Lo que queda vacío se llena con las nuevas: tantas como piezas se quitaron.
    assert.equal(paso.nuevas.length, paso.quitar.length, `${etiqueta}: entran tantas como salen`);
    const porColumna = new Map();
    for (const nva of paso.nuevas) {
      assert.equal(actual[nva.indice], M3.VACIA, `${etiqueta}: entra en un hueco`);
      actual[nva.indice] = nva.color;
      const col = nva.indice % cols;
      porColumna.set(col, (porColumna.get(col) ?? 0) + 1);
    }
    for (const nva of paso.nuevas) {
      const fila = Math.floor(nva.indice / cols);
      assert.equal(fila - nva.desde, porColumna.get(nva.indice % cols), `${etiqueta}: todas caen lo mismo en su columna`);
      assert.ok(nva.desde < 0, `${etiqueta}: entran desde arriba del tablero`);
    }
    assert.deepEqual(actual, paso.tablero, `${etiqueta}: el tablero de la vuelta`);
    assert.ok(actual.every((v) => v !== M3.VACIA && v >= 0), `${etiqueta}: no queda ningún hueco`);
    // Los ids: ninguno se repite ni se pierde.
    ids = PS.idsTrasPaso(ids, paso, () => siguienteId++);
    assert.equal(ids.length, cells.length);
    assert.equal(new Set(ids).size, ids.length, `${etiqueta}: ids únicos`);
    assert.ok(ids.every((v) => v !== PS.SIN_ID), `${etiqueta}: cada celda tiene su pieza`);
  }
  assert.equal(rows * cols, actual.length);
  return { cells: actual, ids };
}

prueba('la resolución por pasos deja LO MISMO que resolve con la misma semilla (tablero, conteos y azar gastado)', () => {
  let conDos = 0;
  let conTres = 0;
  let conMasDeTres = 0;
  const casos = 1200;
  for (let s = 1; s <= casos; s++) {
    const [cols, rows, colores] = TAMANOS[s % TAMANOS.length];
    const azarJuego = semilla(s);
    // Mitad: un tablero de partida normal con un intercambio libre (vecinas o no, como el juego).
    // Mitad: un tablero crudo, con muchas líneas, para que haya cascadas largas.
    const base = s % 2 === 0 ? M3.createBoard(cols, rows, colores, azarJuego) : tableroCrudo(cols, rows, colores, azarJuego);
    if (s % 2 === 0) {
      const a = Math.floor(azarJuego() * base.cells.length);
      const c = (a + 1 + Math.floor(azarJuego() * (base.cells.length - 1))) % base.cells.length;
      M3.swap(base, a, c);
    }
    const inicial = [...base.cells];

    const A = M3.clone(base);
    const azarA = semilla(s * 7919);
    const resA = M3.resolve(A, colores, azarA);

    const B = M3.clone(base);
    const azarB = semilla(s * 7919);
    const resB = PS.resolverPorPasos(B, colores, azarB);

    assert.deepEqual(B.cells, A.cells, `semilla ${s}: el tablero`);
    assert.deepEqual(resB.porColor, resA.porColor, `semilla ${s}: porColor`);
    assert.equal(resB.total, resA.total, `semilla ${s}: total`);
    assert.equal(resB.cascadas, resA.cascadas, `semilla ${s}: cascadas`);
    assert.equal(azarB(), azarA(), `semilla ${s}: gastan el azar igual`);

    // Los pasos cuentan lo mismo que el resultado.
    assert.equal(resB.pasos.length, resB.cascadas);
    assert.ok(resB.pasos.length <= 20, 'el tope de veinte vueltas');
    assert.equal(resB.pasos.reduce((t, p) => t + p.quitar.length, 0), resB.total);
    const suma = {};
    for (const p of resB.pasos) for (const [k, v] of Object.entries(p.porColor)) suma[k] = (suma[k] ?? 0) + v;
    assert.deepEqual(suma, resB.porColor, `semilla ${s}: los porColor de los pasos suman el total`);

    // Y reproducidos sobre el tablero de antes dejan el de después.
    const rep = reproducir(inicial, cols, rows, resB.pasos);
    assert.deepEqual(rep.cells, A.cells, `semilla ${s}: reproducir los pasos`);

    if (resB.cascadas >= 2) conDos++;
    if (resB.cascadas >= 3) conTres++;
    if (resB.cascadas > 3) conMasDeTres++;
  }
  console.log(`      (${casos} jugadas: ${conDos} con cascada x2 o más, ${conTres} con x3 o más, ${conMasDeTres} con más de x3)`);
  assert.ok(conDos >= 100 && conTres >= 30, 'la prueba cubre cascadas x2 y x3 de verdad');
});

prueba('un intercambio que no arma nada no pasa por ningún paso ni gasta azar', () => {
  const azarJuego = semilla(42);
  const base = M3.createBoard(6, 7, 4, azarJuego);
  const A = M3.clone(base);
  const B = M3.clone(base);
  const azarA = semilla(5);
  const azarB = semilla(5);
  assert.equal(M3.findMatches(A).length, 0, 'createBoard no deja líneas');
  const resA = M3.resolve(A, 4, azarA);
  const resB = PS.resolverPorPasos(B, 4, azarB);
  assert.equal(resB.pasos.length, 0);
  assert.equal(resB.cascadas, 0);
  assert.equal(resB.total, resA.total);
  assert.deepEqual(B.cells, A.cells);
  assert.deepEqual(B.cells, base.cells, 'el tablero queda como estaba');
  assert.equal(azarB(), azarA());
});

prueba('las piezas que bajan conservan su id y solo las nuevas estrenan uno', () => {
  const azarJuego = semilla(7);
  const b = tableroCrudo(6, 7, 4, azarJuego);
  const inicial = [...b.cells];
  const res = PS.resolverPorPasos(b, 4, semilla(9));
  assert.ok(res.pasos.length >= 1);
  let siguiente = inicial.length;
  let ids = inicial.map((_, i) => i);
  for (const paso of res.pasos) {
    const antes = ids;
    ids = PS.idsTrasPaso(ids, paso, () => siguiente++);
    for (const c of paso.caidas) assert.equal(ids[c.hasta], antes[c.desde], 'la pieza que baja es la misma');
    for (const i of paso.quitar) assert.ok(!ids.includes(antes[i]), 'lo quitado ya no está');
    for (const nva of paso.nuevas) assert.ok(ids[nva.indice] >= inicial.length, 'la nueva estrena id');
  }
});

prueba('rebarajar: cada celda queda con una pieza de su color, sin repetir ni perder ninguna', () => {
  for (let s = 1; s <= 300; s++) {
    const [cols, rows, colores] = TAMANOS[s % TAMANOS.length];
    const azar = semilla(s);
    const b = M3.createBoard(cols, rows, colores, azar);
    const antes = [...b.cells];
    const ids = antes.map((_, i) => i);
    M3.rebarajar(b, colores, semilla(s * 31));
    const despues = [...b.cells];
    let siguiente = antes.length;
    const r = PS.idsTrasRebaraje(antes, ids, despues, () => siguiente++);
    assert.equal(r.ids.length, despues.length);
    assert.equal(new Set(r.ids).size, r.ids.length, `semilla ${s}: ids únicos`);
    assert.ok(r.ids.every((v) => v !== PS.SIN_ID));
    // La pieza que queda en cada celda tenía el color que ahora le toca (las nuevas nacen con él).
    r.ids.forEach((id, i) => {
      if (id < antes.length) assert.equal(antes[id], despues[i], `semilla ${s}: la pieza ${id} conserva su color`);
    });
    assert.equal(r.nuevas.length, r.sobran.length, 'las que se crean son tantas como las que se van');
    for (const i of r.nuevas) assert.ok(r.ids[i] >= antes.length);
    for (const id of r.sobran) assert.ok(!r.ids.includes(id));
    // Lo que no cambió de color no se mueve.
    antes.forEach((c, i) => {
      if (c === despues[i]) assert.equal(r.ids[i], ids[i], `semilla ${s}: la celda ${i} no cambió`);
    });
  }
});

prueba('rebarajar con la misma mezcla de colores nunca crea ni descarta piezas', () => {
  for (let s = 1; s <= 200; s++) {
    const b = M3.createBoard(7, 8, 5, semilla(s));
    const antes = [...b.cells];
    const copia = M3.clone(b);
    // Un barajado a mano, que conserva las piezas (no el tablero nuevo de rebarajar tras 30 fallos).
    const azar = semilla(s + 1000);
    for (let i = copia.cells.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [copia.cells[i], copia.cells[j]] = [copia.cells[j], copia.cells[i]];
    }
    let siguiente = antes.length;
    const r = PS.idsTrasRebaraje(antes, antes.map((_, i) => i), copia.cells, () => siguiente++);
    assert.deepEqual(r.nuevas, []);
    assert.deepEqual(r.sobran, []);
  }
});

// ── la geometría del tablero ─────────────────────────────────────────────
const T = await importar('src/features/juegos/dulces/logic/tablero.ts');
const motion = fs.readFileSync(path.join(ROOT, 'src/theme/motion.ts'), 'utf8');

prueba('los números de tablero.ts son los de motionDulces y escalon (no se desfasan)', () => {
  const de = (clave) => Number(motion.match(new RegExp(`${clave}: (\\d+)`))[1]);
  assert.equal(T.CAIDA_BASE_MS, de('caidaBase'));
  assert.equal(T.CAIDA_POR_FILA_MS, de('caidaPorFila'));
  assert.equal(T.REBOTE_MS, de('reboteMs'));
  assert.equal(T.REBOTE_DP, de('reboteDp'));
  const escalon = motion.match(/export const motionEscalon = \{\s*ms: (\d+),[\s\S]*?max: (\d+),/);
  for (let col = 0; col < 10; col++) {
    assert.equal(T.retrasoDeColumna(col), Math.min(col, Number(escalon[2]) - 1) * Number(escalon[1]), `columna ${col}`);
  }
});

prueba('qué celda hay bajo un punto del tablero', () => {
  const paso = 50;
  assert.equal(T.celdaEn(10, 10, paso, 6, 7), 0);
  assert.equal(T.celdaEn(60, 10, paso, 6, 7), 1);
  assert.equal(T.celdaEn(10, 60, paso, 6, 7), 6);
  assert.equal(T.celdaEn(299, 349, paso, 6, 7), 41, 'la última celda');
  assert.equal(T.celdaEn(-1, 10, paso, 6, 7), -1);
  assert.equal(T.celdaEn(300, 10, paso, 6, 7), -1);
  assert.equal(T.celdaEn(10, 350, paso, 6, 7), -1);
  assert.equal(T.celdaEn(10, 10, 0, 6, 7), -1);
  assert.deepEqual(T.posicionDe(2, 3, 50), { x: 150, y: 100 });
});

prueba('un deslizamiento apunta a la vecina del eje que más recorrió, y hacia fuera del tablero no hay celda', () => {
  const v = (origen, dx, dy, solo = false) => T.vecinaHacia(origen, dx, dy, 6, 7, solo);
  assert.equal(v(8, 30, 5).celda, 9, 'a la derecha');
  assert.equal(v(8, -30, 5).celda, 7, 'a la izquierda');
  assert.equal(v(8, 4, 30).celda, 14, 'hacia abajo');
  assert.equal(v(8, 4, -30).celda, 2, 'hacia arriba');
  assert.equal(v(0, -30, 0).celda, -1, 'hacia fuera por la izquierda');
  assert.equal(v(0, 0, -30).celda, -1, 'hacia fuera por arriba');
  assert.equal(v(5, 30, 0).celda, -1, 'la última columna no tiene derecha');
  assert.equal(v(41, 0, 30).celda, -1, 'la última fila no tiene abajo');
  assert.equal(v(8, 4, 30, true), null, 'si el tablero scrollea, lo vertical no es un intercambio');
  assert.equal(v(8, 30, 4, true).celda, 9, 'y lo horizontal sí');
  assert.equal(v(8, 30, 30).celda, 9, 'con empate manda lo horizontal');
});

prueba('la caída acelera con la distancia y el paso espera a la pieza que más tarda', () => {
  assert.equal(T.duracionCaida(1), 160);
  assert.equal(T.duracionCaida(3), 240);
  assert.ok(T.duracionCaida(5) > T.duracionCaida(2));
  const paso = {
    caidas: [{ desde: 0, hasta: 12 }, { desde: 1, hasta: 7 }], // 2 filas y 1 fila (6 columnas)
    nuevas: [{ indice: 0, color: 1, desde: -2 }, { indice: 5, color: 2, desde: -1 }],
  };
  // La nueva de la columna 5 entra con su escalón (5 * 40) y cae 1 fila: 200 + 160; la de la columna 0 cae 2 filas.
  assert.equal(T.esperaDeCaida(paso, 6), Math.max(T.duracionCaida(2), T.duracionCaida(2), 200 + T.duracionCaida(1)) + T.REBOTE_MS);
  assert.equal(T.esperaDeCaida({ caidas: [], nuevas: [] }, 6), T.REBOTE_MS);
  assert.equal(T.umbralDeslizar(20), 12, 'un mínimo');
  assert.equal(T.umbralDeslizar(60), 24);
});

prueba('nunca hay más de 60 trozos vivos: cada paso suelta a lo más 30', () => {
  assert.equal(T.MAX_VIVAS, 60);
  assert.equal(T.MAX_POR_PASO * 2, T.MAX_VIVAS);
  assert.equal(T.trozosPorPieza(0), 0);
  assert.equal(T.trozosPorPieza(3), 3, 'una línea de tres suelta 9');
  assert.equal(T.trozosDelPaso(3), 9);
  for (let piezas = 0; piezas <= 72; piezas++) {
    assert.ok(T.trozosDelPaso(piezas) <= T.MAX_POR_PASO, `${piezas} piezas`);
    if (piezas > 0) assert.ok(T.trozosPorPieza(piezas) >= 1, 'cada pieza suelta al menos uno (hasta el tope)');
  }
  assert.equal(T.trozosDelPaso(72), T.MAX_POR_PASO);
});

prueba('la dispersión de los trozos es la misma cada vez y no gasta Math.random', () => {
  const antes = Math.random;
  let llamadas = 0;
  Math.random = () => {
    llamadas++;
    return antes();
  };
  try {
    for (let i = 0; i < 500; i++) {
      const v = T.azarFijo(i);
      assert.ok(v >= 0 && v < 1, `azarFijo(${i}) = ${v}`);
      assert.equal(T.azarFijo(i), v, 'siempre igual para el mismo número');
    }
    assert.notEqual(T.azarFijo(1), T.azarFijo(2));
    assert.equal(llamadas, 0, 'no toca Math.random: el azar del juego queda como estaba');
  } finally {
    Math.random = antes;
  }
  assert.equal(T.TROZOS_RETRASO_MS, 60);
});

console.log(`\ncheck:dulces ${total} pruebas ok`);
