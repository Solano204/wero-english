/**
 * Prueba los distractores de Reconocer y Escuchar sobre el catálogo real:
 *
 *   npm run check:distractores
 *
 *  a) que ni un número, ni un nombre propio, ni un cognado delate cuál es la correcta;
 *  b) que un distractor no se repita en una sesión mientras haya otros disponibles;
 *  c) que nunca salga una traducción igual o casi igual a la correcta;
 *  d) que todo tipo de ejercicio tenga su instrucción y la tarjeta la muestre.
 *
 * distractores.ts solo importa dos funciones de utils/text.ts: se transpilan en memoria con typescript y se cargan
 * como módulos, sin jest. Imprime cuántas frases del catálogo tenían la pista regalada con el algoritmo anterior.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fuenteDePantalla } from './lib/pantallas.mjs';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
// Una pantalla se lee con lo que es suyo (su hook y su logic): la lógica de las pantallas delgadas vive ahí.
const leer = (rel) =>
  /\/screens\/\w+Screen\.tsx$/.test(rel) ? fuenteDePantalla(path.join(ROOT, rel), ROOT) : fs.readFileSync(path.join(ROOT, rel), 'utf8');
const cargar = async (rel, sustituir = (s) => s) => {
  const js = ts.transpileModule(sustituir(leer(rel)), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};

globalThis.__texto = await cargar('src/domain/texto.ts');
const D = await cargar('src/domain/distractores.ts', (s) =>
  s.replace(/import \{ levenshtein, mismoTexto \} from '@\/domain\/texto';/, 'const { levenshtein, mismoTexto } = globalThis.__texto;')
);

let total = 0;
const prueba = (nombre, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nombre}`);
};

/** Un generador pseudoaleatorio con semilla: las pruebas dan lo mismo cada vez. */
const semilla = (n) => () => {
  n |= 0;
  n = (n + 0x6d2b79f5) | 0;
  let t = Math.imul(n ^ (n >>> 15), 1 | n);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const catalogo = JSON.parse(leer('assets/data/catalogo.json')).entries;
const entradas = catalogo
  .filter((e) => e.is_canonical && !e.revisar)
  .map((e) => ({ id: e.id, phrase: e.phrase, spanish: e.spanish_main, wordCount: e.word_count, pack: e.pack_final, mundo: e.mundo }));
const pool = D.prepararPool(entradas);

/* ---------- detección ---------- */

prueba('números: dígitos y palabras, en inglés y en español, sin contar «one» ni «un»', () => {
  assert.ok(D.tieneDigitos('To be fined 240 a day'));
  assert.ok(!D.tieneDigitos('To be fined a lot'));
  for (const t of ['twenty bucks', 'a hundred times', 'two of them', 'a thousand']) assert.ok(D.tienePalabraNumero(t, 'en'), t);
  for (const t of ['no one knows', 'at once', 'a few eggs']) assert.ok(!D.tienePalabraNumero(t, 'en'), t);
  for (const t of ['veinte pesos', 'doscientos', 'cien por ciento', 'mil gracias', 'dieciséis años', 'veintitrés']) {
    assert.ok(D.tienePalabraNumero(t, 'es'), t);
  }
  for (const t of ['un día', 'uno solo', 'nada de nada', 'ciencia']) assert.ok(!D.tienePalabraNumero(t, 'es'), t);
});

prueba('nombres propios: con mayúscula y no al inicio, sin dígitos ni palabras de función', () => {
  assert.deepEqual(D.nombresPropios('You got a Hellcat'), ['Hellcat']);
  assert.deepEqual(D.nombresPropios('So they would rather see Kendrick in that spot'), ['Kendrick']);
  assert.deepEqual(D.nombresPropios('Hello there'), []);
  assert.deepEqual(D.nombresPropios("I'm a D1 rage baiter"), []);
  assert.deepEqual(D.nombresPropios('Neighborhood / The hood'), []);
  assert.deepEqual(D.nombresPropios('It ends. Then Netflix calls'), ['Netflix']);
  assert.deepEqual(D.nombresPropios('¿Crees que Puff ya valió? No estoy seguro'), ['Puff']);
  assert.deepEqual(D.nombresPropios('Estoy en Zúrich con Ana'), ['Zúrich', 'Ana']);
  assert.deepEqual(D.nombresPropios('Nos vemos mañana'), []);
});

prueba(`cognados: letras parecidas (umbral ${D.UMBRAL_COGNADO}, mínimo ${D.MIN_LETRAS_COGNADO} letras)`, () => {
  assert.equal(D.UMBRAL_COGNADO, 0.75);
  assert.ok(D.tieneCognado('It is very important', 'Es muy importante'));
  assert.ok(D.tieneCognado('a different plan', 'un plan diferente'));
  assert.ok(D.tieneCognado('an innocent question', 'una pregunta inocente'));
  assert.ok(!D.tieneCognado('the table is big', 'la mesa es grande'));
  assert.ok(!D.tieneCognado('I am here now', 'Estoy aquí ahora'));
  // «tomb» tiene 4 letras: por debajo del mínimo dos palabras se parecen por casualidad.
  assert.ok(!D.tieneCognado('tomb', 'tumba'));
});

prueba('traducciones casi iguales: mayúsculas, acentos, puntuación y diferencias mínimas', () => {
  assert.ok(D.casiIgual('Ser multado con 240 al día', 'ser multado con 240 al dia.'));
  assert.ok(D.casiIgual('Nos vemos mañana', '¡Nos vemos mañana!'));
  assert.ok(D.casiIgual('Estoy muy cansado hoy', 'Estoy muy cansado hoy.'));
  assert.ok(!D.casiIgual('Nos vemos mañana', 'Nos vemos luego'));
  assert.ok(!D.casiIgual('La cuenta', 'La cuenta de la casita para pájaros'));
});

/* ---------- el catálogo antes y después ---------- */

const tiene = {
  numero: (t) => {
    const f = D.firmaDe(t);
    return f.digitos || f.palabras;
  },
  nombre: (t) => D.firmaDe(t).nombre,
};

/** Cuántos elementos cumplen `pred`, sin pasar de `tope`: para saber si «hay suficientes» sin recorrer todo el pool. */
function hasta(tope, lista, pred) {
  let n = 0;
  for (const x of lista) {
    if (pred(x) && ++n >= tope) break;
  }
  return n;
}

/** La selección anterior: mismo pack y tamaño parecido al azar, y si faltan, del mismo mundo. */
function seleccionAnterior(e, azar) {
  const tomar = (lista, n) => {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia.slice(0, n);
  };
  const cerca = tomar(entradas.filter((x) => x.id !== e.id && x.pack === e.pack && Math.abs(x.wordCount - e.wordCount) <= 3), 3);
  if (cerca.length >= 3) return cerca.map((x) => x.spanish);
  const ya = new Set(cerca.map((x) => x.id));
  const mundo = tomar(entradas.filter((x) => x.mundo === e.mundo && x.id !== e.id && !ya.has(x.id)), 3 - cerca.length);
  return [...cerca, ...mundo].map((x) => x.spanish);
}

const conPistas = entradas
  .map((e) => ({ e, pistas: D.pistasDe(e.phrase, e.spanish) }))
  .filter(({ pistas }) => D.regalaPista(pistas));
const cuenta = (clave) => conPistas.filter(({ pistas }) => pistas[clave]).length;
const numeroONombre = conPistas.filter(({ pistas }) => pistas.numero || pistas.nombre);
const conCognado = conPistas.filter(({ pistas }) => pistas.cognado);

prueba('catálogo: cuántas frases regalaban la respuesta con un número, un nombre o un cognado', () => {
  console.log(
    `      ${conPistas.length} de ${entradas.length} frases: ${cuenta('numero')} con número, ${cuenta('nombre')} con nombre propio, ${cuenta('cognado')} con cognado`
  );
  assert.ok(conPistas.length > 0);
});

prueba('el caso «To be fined 240 a day»: ahora las tres falsas también traen un número', () => {
  const e = entradas.find((x) => x.phrase === 'To be fined 240 a day');
  assert.ok(e, 'la frase no está en el catálogo');
  const azar = semilla(7);
  for (let i = 0; i < 200; i++) {
    const d = D.elegirDistractores(e, pool, 3, new Set(), azar);
    assert.equal(d.length, 3);
    for (const x of d) assert.ok(tiene.numero(x), `sin número: ${x}`);
  }
});

prueba('a) con el algoritmo anterior la correcta delataba; ahora ya no (números, nombres y cognados)', () => {
  const SORTEOS = 10;
  const azar = semilla(11);
  const nuevo = (e) => D.elegirDistractores(e, pool, 3, new Set(), azar);
  const viejo = (e) => seleccionAnterior(e, azar);

  // Número y nombre: la correcta delata si es la única opción con el elemento que la frase le regala.
  const numNom = (elegir) => {
    let delatadas = 0;
    let sorteos = 0;
    for (const { e, pistas } of numeroONombre) {
      for (let k = 0; k < SORTEOS; k++) {
        sorteos++;
        const d = elegir(e);
        if ((pistas.numero && !d.some(tiene.numero)) || (pistas.nombre && !d.some(tiene.nombre))) delatadas++;
      }
    }
    return (100 * delatadas) / sorteos;
  };
  // Cognado: delata si ninguna falsa comparte un cognado con la frase.
  const cogs = (elegir) => {
    let delatadas = 0;
    let sorteos = 0;
    for (const { e } of conCognado) {
      for (let k = 0; k < SORTEOS; k++) {
        sorteos++;
        if (!elegir(e).some((x) => D.tieneCognado(e.phrase, x))) delatadas++;
      }
    }
    return (100 * delatadas) / sorteos;
  };

  const antesNN = numNom(viejo);
  const ahoraNN = numNom(nuevo);
  const antesC = cogs(viejo);
  const ahoraC = cogs(nuevo);
  console.log(
    `      número o nombre (${numeroONombre.length} frases x ${SORTEOS} sorteos): la correcta era la única con el elemento en ${antesNN.toFixed(1)} % antes y en ${ahoraNN.toFixed(1)} % ahora`
  );
  console.log(
    `      cognado (${conCognado.length} frases): ${antesC.toFixed(1)} % antes y ${ahoraC.toFixed(1)} % ahora (el cognado de la correcta no se puede quitar: solo se buscan falsas que también lo compartan)`
  );
  assert.ok(antesNN > 50, 'el algoritmo anterior debía delatar casi siempre');
  assert.ok(ahoraNN < 2, `todavía delata: ${ahoraNN.toFixed(1)} %`);
  assert.ok(ahoraC < antesC, 'con cognado tampoco debe empeorar');
});

prueba('a) toda opción falsa tiene la misma firma (dígitos, palabras, nombre) que la correcta, si el catálogo alcanza', () => {
  const azar = semilla(5);
  const sinSuficientes = [];
  for (const e of entradas) {
    const firma = D.firmaDe(e.spanish);
    // Con 6 de sobra (por si dos se parecen entre sí) el catálogo alcanza.
    const iguales = hasta(6, pool, (c) => c.id !== e.id && D.mismaFirma(firma, c.firma) && !D.casiIgual(e.spanish, c.spanish));
    const d = D.elegirDistractores(e, pool, 3, new Set(), azar);
    assert.equal(d.length, 3, `${e.phrase}: no salieron tres`);
    if (iguales < 6) {
      sinSuficientes.push(e.phrase);
      continue;
    }
    for (const x of d) assert.ok(D.mismaFirma(firma, D.firmaDe(x)), `${e.phrase}: «${x}» no tiene la firma de «${e.spanish}»`);
  }
  console.log(`      ${sinSuficientes.length} frases sin seis falsas con su firma en el catálogo (se completa con las más cercanas): ${sinSuficientes.join(' | ')}`);
  assert.ok(sinSuficientes.length <= 12);
});

prueba('c) nunca sale una traducción igual o casi igual a la correcta, ni dos iguales entre sí', () => {
  const azar = semilla(3);
  for (const e of entradas) {
    const d = D.elegirDistractores(e, pool, 3, new Set(), azar);
    assert.equal(new Set(d).size, d.length);
    for (let i = 0; i < d.length; i++) {
      assert.ok(!D.casiIgual(e.spanish, d[i]), `${e.phrase}: «${d[i]}» es casi «${e.spanish}»`);
      assert.ok(!globalThis.__texto.mismoTexto(e.spanish, d[i]));
      for (let j = i + 1; j < d.length; j++) assert.ok(!D.casiIgual(d[i], d[j]), `«${d[i]}» y «${d[j]}»`);
    }
  }
});

prueba('c) las traducciones repetidas o casi iguales se excluyen entre sí', () => {
  const base = { id: 1, phrase: 'See you tomorrow', spanish: 'Nos vemos mañana', wordCount: 3, pack: 'p', mundo: 'm' };
  const otros = [
    { id: 2, phrase: 'x', spanish: 'nos vemos mañana.', wordCount: 3, pack: 'p', mundo: 'm' },
    { id: 3, phrase: 'x', spanish: '¡Nos vemos mañana!', wordCount: 3, pack: 'p', mundo: 'm' },
    { id: 4, phrase: 'x', spanish: 'Voy al banco', wordCount: 3, pack: 'p', mundo: 'm' },
    { id: 5, phrase: 'x', spanish: 'Voy al banco.', wordCount: 3, pack: 'p', mundo: 'm' },
    { id: 6, phrase: 'x', spanish: 'Me duele la cabeza', wordCount: 4, pack: 'p', mundo: 'm' },
  ];
  const d = D.elegirDistractores(base, D.prepararPool(otros), 3);
  assert.equal(d.length, 2, 'solo hay dos falsas distintas de verdad');
  assert.ok(d.includes('Me duele la cabeza'));
  assert.equal(d.filter((x) => x.startsWith('Voy al banco')).length, 1);
});

/* ---------- la sesión ---------- */

prueba('b) en una sesión un distractor no se repite mientras haya otros disponibles', () => {
  const azar = semilla(21);
  const barajadas = [...entradas].sort(() => azar() - 0.5);
  // Una sesión normal y una larguísima, que agota los números y los nombres para ver que solo entonces se repite.
  for (const tamano of [60, 900]) {
    const usados = new Set();
    let repetidos = 0;
    let obligadas = 0;
    for (const e of barajadas.slice(0, tamano)) {
      const firma = D.firmaDe(e.spanish);
      const libres = hasta(
        6,
        pool,
        (c) => c.id !== e.id && D.mismaFirma(firma, c.firma) && !usados.has(c.spanish) && !D.casiIgual(e.spanish, c.spanish)
      );
      const d = D.elegirDistractores(e, pool, 3, usados, azar);
      const yaSalio = d.filter((x) => usados.has(x)).length;
      repetidos += yaSalio;
      // Con varias libres de sobra (por si dos se parecen entre sí) no puede salir ninguna repetida.
      if (libres >= 6) assert.equal(yaSalio, 0, `${e.phrase}: repite habiendo ${libres} libres con su firma`);
      else obligadas += yaSalio;
      for (const x of d) usados.add(x);
    }
    console.log(`      sesión de ${tamano}: ${repetidos} repetidos (solo cuando ya no quedaban libres con esa firma: ${obligadas})`);
    if (tamano === 60) assert.equal(repetidos, 0);
  }
});

prueba('b) si ya se usaron todas, se permite repetir (no se queda sin opciones)', () => {
  const chico = D.prepararPool(
    [1, 2, 3, 4, 5].map((i) => ({ id: i, phrase: 'x', spanish: `Frase distinta ${'a'.repeat(i * 4)}`, wordCount: 4, pack: 'p', mundo: 'm' }))
  );
  const usados = new Set(chico.map((c) => c.spanish));
  const d = D.elegirDistractores({ id: 1, phrase: 'x', spanish: chico[0].spanish, wordCount: 4, pack: 'p', mundo: 'm' }, chico, 3, usados);
  assert.equal(d.length, 3);
});

prueba('rendimiento: elegir los distractores de una tarjeta es barato (la sesión precarga 60 al arrancar)', () => {
  const muestra = (lista) => {
    for (const e of lista) D.elegirDistractores(e, pool, 3, new Set()); // calentamiento del motor
    const t = performance.now();
    for (const e of lista) D.elegirDistractores(e, pool, 3, new Set());
    return (performance.now() - t) / lista.length;
  };
  const cog = conCognado.slice(0, 100).map(({ e }) => e);
  const sin = entradas.filter((e) => !D.tieneCognado(e.phrase, e.spanish)).slice(0, 100);
  const msCog = muestra(cog);
  const msSin = muestra(sin);
  console.log(`      ${msCog.toFixed(2)} ms por tarjeta con cognado y ${msSin.toFixed(2)} ms sin él (en esta computadora)`);
  assert.ok(msCog < 8 && msSin < 5, 'demasiado lento para precargar 60 tarjetas en un teléfono de gama media');
});

/* ---------- la instrucción ---------- */

prueba('d) cada tipo de ejercicio tiene su instrucción y la tarjeta la muestra arriba, sin condición', () => {
  const definicion = leer('src/types/study.ts').match(/export type ExerciseKind =([^;]+);/)?.[1] ?? '';
  const tipos = [...definicion.matchAll(/'(\w+)'/g)].map((m) => m[1]);
  assert.equal(tipos.length, 6, `tipos de ejercicio: ${tipos}`);
  const ejercicio = leer('src/domain/exercise.ts');
  const funcion = ejercicio.slice(ejercicio.indexOf('export function instructionFor'), ejercicio.indexOf('export function answerMode'));
  for (const k of tipos) {
    assert.match(funcion, new RegExp(`case '${k}':\\s*return '[^']+';`), `falta la instrucción de ${k}`);
  }
  const tarjeta = leer('src/features/estudio/components/StudyCardView.tsx');
  const arriba = tarjeta.indexOf('<View style={styles.top}>');
  const instruccion = tarjeta.indexOf('{instructionFor(card.kind)}');
  const escena = tarjeta.indexOf('<View style={[styles.stage');
  assert.ok(arriba > 0 && instruccion > arriba && instruccion < escena, 'la instrucción va en el bloque de arriba, antes de la frase');
  assert.ok(!/&&|\?/.test(tarjeta.slice(arriba, instruccion)), 'la instrucción no depende de una condición');
});

console.log(`\ncheck:distractores ${total} pruebas ok\n`);
