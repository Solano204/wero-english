/**
 * Prueba lo puro de Gramática sobre los 80 temas reales:
 *
 *   npm run check:gramatica
 *
 *  - el parser de fórmulas (renglones por «·», fichas por «+», negritas de los datos);
 *  - el diff de «En qué te vas a equivocar» (por palabra y por letra) y cuántos errores se transforman y cuántos
 *    van con un fundido;
 *  - que cada tema traiga lo que las pantallas dibujan (niveles, tres ejemplos con audio, el error con su audio);
 *  - el botón «Detener»: su ícono existe y el botón se monta de nuevo al cambiar de variante.
 *
 * diff.ts y gramatica.ts no importan nada: se transpilan en memoria con typescript, sin jest.
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
const cargar = async (rel) => {
  const js = ts.transpileModule(leer(rel), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};

const { diffFrase, numerarCambios, MIN_COMPARTIDAS, MAX_TRAMOS } = await cargar('src/domain/diffFrase.ts');
const { partirFormula, segmentos, nivelMaximo } = await cargar('src/domain/gramatica.ts');
const temas = JSON.parse(leer('assets/data/gramatica.json')).temas;

let total = 0;
const prueba = (nombre, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nombre}`);
};

const clave = (p) =>
  p
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/[^\p{L}\p{N}']/gu, '');
const palabras = (f) => f.split(/\s+/).filter(Boolean);

/* ---------- fórmulas ---------- */

const unir = (f) =>
  f.renglones
    .map((r) => r.map((ficha) => ficha.map((s) => (s.fuerte ? `**${s.texto}**` : s.texto)).join('')).join(' + '))
    .join(' · ');
const normal = (s) => s.replace(/\s*\+\s*/g, ' + ').replace(/\s*·\s*/g, ' · ').replace(/\s+/g, ' ').trim();

prueba('fórmulas: renglones por «·», fichas por «+», y un «+» dentro de una negrita no separa', () => {
  const f = partirFormula('I / you + verbo · he / she / it + verbo **-s**');
  assert.equal(f.tipo, 'fichas');
  assert.equal(f.renglones.length, 2);
  assert.deepEqual(f.renglones[0].map((ficha) => ficha.map((s) => s.texto).join('')), ['I / you', 'verbo']);
  assert.deepEqual(f.renglones[1][1], [
    { texto: 'verbo ', fuerte: false },
    { texto: '-s', fuerte: true },
  ]);
  assert.equal(partirFormula('a + **b + c** + d').renglones[0].length, 3);
  assert.equal(partirFormula('had + participio').renglones.length, 1);
  assert.deepEqual(partirFormula('opinión → tamaño → edad'), {
    tipo: 'texto',
    segmentos: [{ texto: 'opinión → tamaño → edad', fuerte: false }],
  });
  assert.deepEqual(segmentos('verbo **-ing**'), [
    { texto: 'verbo ', fuerte: false },
    { texto: '-ing', fuerte: true },
  ]);
});

prueba('fórmulas: las 80 se parten sin perder nada y las que no tienen «·» ni «+» quedan como texto', () => {
  let conPunto = 0;
  let conMas = 0;
  let texto = 0;
  let resaltadas = 0;
  for (const t of temas) {
    const f = partirFormula(t.formula);
    if (t.formula.includes('·')) conPunto++;
    if (t.formula.includes('+')) conMas++;
    if (f.tipo === 'texto') {
      texto++;
      assert.ok(!t.formula.includes('·') && !t.formula.includes('+'), `${t.id}: tiene separador y quedó como texto`);
      assert.equal(f.segmentos.map((s) => (s.fuerte ? `**${s.texto}**` : s.texto)).join(''), t.formula);
      continue;
    }
    assert.ok(f.renglones.length >= 1, `${t.id}: sin renglones`);
    assert.equal(f.renglones.length, t.formula.split('·').length, `${t.id}: renglones ≠ alternativas`);
    for (const r of f.renglones) {
      assert.ok(r.length >= 1, `${t.id}: renglón vacío`);
      for (const ficha of r) assert.ok(ficha.length >= 1 && ficha.every((s) => s.texto.trim() !== ''), `${t.id}: ficha vacía`);
    }
    assert.equal(normal(unir(f)), normal(t.formula), `${t.id}: no se reconstruye`);
    const pares = (t.formula.match(/\*\*/g) ?? []).length / 2;
    const fuertes = f.renglones.flat().flat().filter((s) => s.fuerte).length;
    assert.equal(fuertes, pares, `${t.id}: negritas`);
    if (fuertes > 0) resaltadas++;
  }
  assert.equal(temas.length, 80);
  assert.equal(texto, temas.filter((t) => !t.formula.includes('·') && !t.formula.includes('+')).length);
  console.log(`      ${conPunto} con «·», ${conMas} con «+», ${texto} como texto, ${resaltadas} con partes resaltadas`);
});

prueba('niveles: de 1 a 5 (el medidor tiene 5 barras)', () => {
  for (const t of temas) assert.ok(Number.isInteger(t.nivel) && t.nivel >= 1 && t.nivel <= 5, `${t.id}: nivel ${t.nivel}`);
  assert.equal(nivelMaximo(temas), 5);
  assert.equal(nivelMaximo([]), 1);
});

/* ---------- diff ---------- */

const reconstruye = (d, sinTipo) =>
  d.piezas
    .filter((p) => p.tipo !== sinTipo)
    .map((p) => (p.tipo === 'letras' ? p.partes.filter((x) => x.tipo !== sinTipo).map((x) => x.texto).join('') : p.texto))
    .join(' ');

prueba('diff: una letra que entra («He work» y «He works») y una palabra por otra («is» y «are»)', () => {
  const a = diffFrase('He work in a bank.', 'He works in a bank.');
  assert.deepEqual(a.piezas.map((p) => p.tipo), ['igual', 'letras', 'igual', 'igual', 'igual']);
  assert.deepEqual(a.piezas[1].partes, [
    { texto: 'work', tipo: 'igual' },
    { texto: 's', tipo: 'entra' },
  ]);
  assert.ok(a.claro && a.tramos === 1);

  const b = diffFrase('There is three options.', 'There are three options.');
  assert.deepEqual(b.piezas.map((p) => p.tipo), ['igual', 'sale', 'entra', 'igual', 'igual']);
  assert.ok(b.claro);

  const c = diffFrase('I have seen her yesterday.', 'I saw her yesterday.');
  assert.deepEqual(c.piezas.map((p) => `${p.tipo}:${p.texto ?? ''}`), ['igual:I', 'sale:have', 'sale:seen', 'entra:saw', 'igual:her', 'igual:yesterday.']);
  assert.ok(c.claro);

  const d = diffFrase('I am work right now.', 'I am working right now.');
  assert.deepEqual(d.piezas[2].partes, [
    { texto: 'work', tipo: 'igual' },
    { texto: 'ing', tipo: 'entra' },
  ]);
});

prueba('diff: si se parecen poco, no es claro (van con un fundido); iguales no cambian nada', () => {
  const lejos = diffFrase('I am waiting since one hour.', "I've been waiting for an hour.");
  assert.equal(lejos.claro, false);
  assert.ok(lejos.compartidas < MIN_COMPARTIDAS);
  const igual = diffFrase('See you later.', 'See you later.');
  assert.equal(igual.tramos, 0);
  assert.equal(igual.compartidas, 1);
  assert.ok(igual.claro);
  assert.deepEqual(diffFrase('', '').piezas, []);
});

prueba('diff: en los 80 errores reales la incorrecta y la correcta se reconstruyen palabra por palabra', () => {
  let claros = 0;
  let conLetras = 0;
  let conPalabras = 0;
  let fundidos = 0;
  for (const t of temas) {
    const { mal, bien } = t.error_tipico;
    const d = diffFrase(mal, bien);
    assert.deepEqual(reconstruye(d, 'entra').split(' ').map(clave), palabras(mal).map(clave), `${t.id}: la incorrecta no se reconstruye`);
    assert.deepEqual(reconstruye(d, 'sale').split(' ').map(clave), palabras(bien).map(clave), `${t.id}: la correcta no se reconstruye`);
    assert.ok(d.tramos >= 0 && d.compartidas >= 0 && d.compartidas <= 1);
    assert.equal(d.claro, d.compartidas >= MIN_COMPARTIDAS && d.tramos <= MAX_TRAMOS);
    if (d.claro) {
      claros++;
      if (d.piezas.some((p) => p.tipo === 'letras')) conLetras++;
      if (d.piezas.some((p) => p.tipo === 'sale' || p.tipo === 'entra')) conPalabras++;
    } else fundidos++;
  }
  console.log(`      ${claros} se transforman (${conLetras} con letras que cambian, ${conPalabras} con palabras que salen o entran) y ${fundidos} van con fundido`);
  assert.equal(claros + fundidos, 80);
  assert.ok(claros >= 40, 'se esperaba que la mayoría se transforme');
});

prueba('diff: los índices de tacha y de entrada van de izquierda a derecha, sin huecos, y la transformación cabe en 1.5 s', () => {
  const motion = leer('src/theme/motion.ts');
  const numero = (re, nombre) => {
    const m = motion.match(re);
    assert.ok(m, `no encontré ${nombre} en motion.ts`);
    return Number(m[1]);
  };
  const BASE = numero(/base:\s*(\d+)/, 'motionDuration.base');
  const LENTO = numero(/lento:\s*(\d+)/, 'motionDuration.lento');
  const PAUSA = numero(/motionError = \{[^}]*pausa:\s*(\d+)/, 'motionError.pausa');
  const ENTRA = numero(/motionError = \{[^}]*entra:\s*(\d+)/, 'motionError.entra');
  const PASO = numero(/motionEscalon = \{\s*ms:\s*(\d+)/, 'motionEscalon.ms');
  const TOPE = numero(/max:\s*(\d+)/, 'motionEscalon.max');
  const escalon = (i) => Math.min(i, TOPE - 1) * PASO;

  let peor = 0;
  for (const t of temas) {
    const d = diffFrase(t.error_tipico.mal, t.error_tipico.bien);
    const { plan, tachas, entradas } = numerarCambios(d.piezas);
    assert.equal(plan.length, d.piezas.length);
    assert.equal(tachas, d.piezas.filter((p) => p.tipo === 'sale' || p.tipo === 'letras').length, `${t.id}: tachas`);
    assert.deepEqual(
      plan.filter((n) => n.tacha >= 0).map((n) => n.tacha),
      Array.from({ length: tachas }, (_, i) => i),
      `${t.id}: las tachas no van en orden`
    );
    const conEntrada = d.piezas.reduce((n, p) => n + (p.tipo === 'entra' ? 1 : p.tipo === 'letras' ? p.partes.filter((x) => x.tipo === 'entra').length : 0), 0);
    assert.equal(entradas, conEntrada, `${t.id}: entradas`);
    let esperado = 0;
    for (const n of plan) {
      const cuantas = n.pieza.tipo === 'entra' ? 1 : n.pieza.tipo === 'letras' ? n.pieza.partes.filter((x) => x.tipo === 'entra').length : 0;
      assert.equal(n.entra, cuantas > 0 ? esperado : -1, `${t.id}: lugar de entrada`);
      esperado += cuantas;
    }
    if (!d.claro) continue;
    const tacha = tachas === 0 ? 0 : BASE + escalon(tachas - 1);
    const fin = tacha + PAUSA + ENTRA + (entradas === 0 ? 0 : escalon(entradas - 1)) + LENTO;
    peor = Math.max(peor, fin);
  }
  console.log(`      la transformación más larga dura ${peor} ms`);
  assert.ok(peor <= 1500, `la transformación más larga tarda ${peor} ms`);
});

/* ---------- lo que las pantallas dibujan ---------- */

prueba('cada tema trae tres ejemplos con audio y su error con audio', () => {
  for (const t of temas) {
    assert.equal(t.ejemplos.length, 3, `${t.id}: ejemplos`);
    for (const e of t.ejemplos) assert.ok(e.en && e.es && e.audio && e.audio_lento, `${t.id}: ejemplo incompleto`);
    assert.ok(t.error_tipico.mal && t.error_tipico.bien && t.error_tipico.audio_bien, `${t.id}: error incompleto`);
  }
});

prueba('«Detener»: el ícono stop existe y el botón se monta de nuevo al cambiar de variante', () => {
  assert.match(leer('src/shared/ui/Icon.tsx'), /\bstop:\s*\{ Componente: StopIcon \}/);
  assert.match(leer('src/shared/ui/Button.tsx'), /key=\{variant\}/);
  assert.match(leer('src/features/gramatica/screens/GramaticaTemaScreen.tsx'), /'Detener'/);
});

prueba('la regla de temas abiertos no cambió: 3 por bloque, y un tema con clave desbloqueada ya no es cerrado', () => {
  const lista = leer('src/features/gramatica/screens/GramaticaScreen.tsx');
  assert.match(lista, /export const GRATIS_POR_BLOQUE = 3;/);
  assert.match(lista, /n >= GRATIS_POR_BLOQUE && !clavesVistas\.has\(`gramatica:\$\{tema\.id\}`\)/);
  assert.match(leer('src/features/gramatica/screens/GramaticaTemaScreen.tsx'), /GRATIS_POR_BLOQUE/);
  const porBloque = new Map();
  for (const t of temas) porBloque.set(t.bloque, [...(porBloque.get(t.bloque) ?? []), t]);
  assert.equal(porBloque.size, 9);
  for (const lista of porBloque.values()) assert.ok(lista.length > 3, 'cada bloque tiene temas cerrados y abiertos');
});

prueba('el error que se corrige: se anuncia completo, se puede repetir y la pantalla ya no trae la sección vieja', () => {
  const heroe = leer('src/features/gramatica/components/ErrorQueSeCorrige.tsx');
  assert.match(heroe, /`Incorrecta: \$\{mal\}\. Correcta: \$\{bien\}\.`/);
  assert.match(heroe, /label="Ver otra vez"/);
  assert.match(heroe, /modo === 'estatico' \? null/);
  const pantalla = leer('src/features/gramatica/screens/GramaticaTemaScreen.tsx');
  assert.match(pantalla, /titulo="El error que se corrige"/);
  assert.ok(!pantalla.includes('En qué te vas a equivocar'));
});

console.log(`\ncheck:gramatica ${total} pruebas ok\n`);
