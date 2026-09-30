/**
 * Prueba lo puro de Phrasal verbs sobre las 207 formas reales:
 *
 *   npm run check:ruleta
 *
 *  - el buscador (verbo, partícula o significado; sin acentos ni mayúsculas; por principio de palabra);
 *  - el nombre de las partículas repetidas dentro de un verbo y lo que anuncia el lector de pantalla;
 *  - que la partícula se encuentre en su ejemplo (para resaltarla con `rangoEnFrase`);
 *  - la geometría de la ruleta: pose de cada partícula, elasticidad, dónde se asienta al soltar y a dónde lleva un toque.
 *
 * Los módulos no importan nada (cazala.ts solo tipos): se transpilan en memoria con typescript, sin jest.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const cargar = async (rel) => {
  const js = ts.transpileModule(leer(rel), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};

const { normalizar, buscarGrupos, etiquetasParticulas, anunciarForma } = await cargar('src/domain/phrasal.ts');
const R = await cargar('src/domain/ruleta.ts');
const { rangoEnFrase } = await cargar('src/domain/cazala.ts');
const datos = JSON.parse(leer('assets/data/phrasal_verbs.json'));
const porId = new Map(datos.verbos.map((v) => [v.id, v]));
const grupos = datos.grupos;

let total = 0;
const prueba = (nombre, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nombre}`);
};
const cerca = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} y ${b} no son iguales`);

/* ---------- buscador ---------- */

prueba('normalizar: sin mayúsculas, acentos ni signos', () => {
  assert.equal(normalizar('  LEVÁNTARSE  de la cama! '), 'levantarse de la cama');
  assert.equal(normalizar("Don’t give-up"), "don't give up");
  assert.equal(normalizar(''), '');
});

prueba('buscador: vacío devuelve los 55 verbos, y lo que no existe ninguno', () => {
  assert.equal(grupos.length, 55);
  assert.equal(buscarGrupos(grupos, porId, '').length, 55);
  assert.equal(buscarGrupos(grupos, porId, '   ').length, 55);
  assert.equal(buscarGrupos(grupos, porId, 'xyzzy').length, 0);
});

prueba('buscador: por verbo, por partícula y por significado, sin acentos ni mayúsculas', () => {
  const get = buscarGrupos(grupos, porId, 'GET');
  assert.equal(get[0].verbo, 'get');
  const porSignificado = buscarGrupos(grupos, porId, 'LEVÁNTARSE');
  assert.ok(porSignificado.some((g) => g.verbo === 'get' && g.coinciden.includes(1)));
  const frase = buscarGrupos(grupos, porId, 'get up');
  const g = frase.find((x) => x.verbo === 'get');
  assert.ok(g.coinciden.includes(1) && g.coinciden.length < 14);
  const soloLev = buscarGrupos(grupos, porId, 'lev');
  assert.ok(soloLev.some((x) => x.coinciden.includes(1)), 'un principio de palabra basta');
  assert.equal(buscarGrupos(grupos, porId, 'evantarse').length, 0, 'no busca en medio de una palabra');
  const porParticula = buscarGrupos(grupos, porId, 'away with');
  assert.ok(porParticula.some((x) => x.verbo === 'get'));
});

prueba('buscador: cada verbo se encuentra por su nombre y cada forma por su frase', () => {
  for (const g of grupos) {
    assert.ok(buscarGrupos(grupos, porId, g.verbo).some((x) => x.verbo === g.verbo), `${g.verbo}: por su nombre`);
    for (const id of g.ids) {
      const f = porId.get(id);
      const r = buscarGrupos(grupos, porId, f.frase).find((x) => x.verbo === g.verbo);
      assert.ok(r && r.coinciden.includes(id), `${f.frase}: por su frase`);
    }
  }
});

prueba('buscador: respeta el orden de los grupos y no duplica', () => {
  const orden = grupos.map((g) => g.verbo);
  const r = buscarGrupos(grupos, porId, 'up').map((g) => g.verbo);
  assert.deepEqual(r, orden.filter((v) => r.includes(v)));
  assert.equal(new Set(r).size, r.length);
});

/* ---------- partículas ---------- */

prueba('etiquetas: las repetidas llevan número y las demás quedan igual; nunca se repite una etiqueta', () => {
  assert.deepEqual(etiquetasParticulas(['up', 'over']), ['up', 'over']);
  assert.deepEqual(etiquetasParticulas(['out', 'up', 'out']), ['out (1)', 'up', 'out (2)']);
  let conRepetidas = 0;
  for (const g of grupos) {
    const particulas = g.ids.map((id) => porId.get(id).particula);
    const et = etiquetasParticulas(particulas);
    assert.equal(new Set(et).size, et.length, `${g.verbo}: etiquetas repetidas`);
    if (new Set(particulas).size < particulas.length) conRepetidas++;
  }
  assert.equal(conRepetidas, 2);
});

prueba('anuncio de la ruleta: «get up, levantarse de la cama, 1 de 14»', () => {
  assert.equal(anunciarForma(porId.get(1), 0, 14), 'get up, levantarse de la cama, 1 de 14');
});

prueba('resaltado: la partícula está en su ejemplo en las 207 formas', () => {
  let repetidas = 0;
  for (const v of datos.verbos) {
    const r = rangoEnFrase(v.ejemplo, v.particula);
    assert.ok(r, `${v.frase}: no encontré «${v.particula}» en «${v.ejemplo}»`);
    assert.equal(r[1] - r[0] + 1, v.particula.trim().split(/\s+/).length);
    const otra = rangoEnFrase(v.ejemplo.split(/\s+/).slice(r[1] + 1).join(' '), v.particula);
    if (otra) repetidas++;
  }
  console.log(`      ${repetidas} ejemplos repiten la partícula (se resalta la primera)`);
});

/* ---------- ruleta ---------- */

prueba('pose: la del centro va entera y las vecinas más chicas, giradas hacia atrás y más tenues', () => {
  assert.deepEqual(R.poseItem(0), { y: 0, escala: 1, giro: 0, opacidad: 1 });
  const abajo = R.poseItem(1);
  const arriba = R.poseItem(-1);
  assert.equal(abajo.y, R.ALTO_ITEM);
  assert.equal(arriba.y, -R.ALTO_ITEM);
  cerca(abajo.escala, 0.68);
  cerca(abajo.opacidad, 0.55);
  assert.equal(abajo.giro, -arriba.giro);
  assert.ok(abajo.giro < 0 && arriba.giro > 0);
  assert.equal(abajo.escala, arriba.escala);
  assert.equal(abajo.opacidad, arriba.opacidad);
});

prueba('pose: escala y opacidad bajan, el giro sube y no hay saltos; a partir de 2 lugares no se ve', () => {
  let antes = R.poseItem(0);
  for (let d = 0.05; d <= 3; d += 0.05) {
    const p = R.poseItem(d);
    assert.ok(p.escala <= antes.escala + 1e-9, `escala en ${d}`);
    assert.ok(p.opacidad <= antes.opacidad + 1e-9, `opacidad en ${d}`);
    assert.ok(Math.abs(p.giro) >= Math.abs(antes.giro) - 1e-9, `giro en ${d}`);
    assert.ok(Math.abs(p.escala - antes.escala) < 0.05 && Math.abs(p.opacidad - antes.opacidad) < 0.05, `salto en ${d}`);
    antes = p;
  }
  assert.equal(R.poseItem(R.VISIBLES).opacidad, 0);
  assert.equal(R.poseItem(7).opacidad, 0);
  assert.equal(R.poseItem(-7).opacidad, 0);
});

prueba('elasticidad: igual dentro de la lista, continua en los extremos y más blanda fuera', () => {
  const n = 5;
  assert.equal(R.posElastica(2, n), 2);
  assert.equal(R.posElastica(0, n), 0);
  assert.equal(R.posElastica(4, n), 4);
  cerca(R.posElastica(-1, n), -R.ELASTICIDAD);
  cerca(R.posElastica(5, n), 4 + R.ELASTICIDAD);
  assert.ok(Math.abs(R.posElastica(-1, n)) < 1 && R.posElastica(5, n) - 4 < 1);
});

prueba('al soltar: sin velocidad se asienta en la más cercana; con el dedo hacia arriba avanza y no se sale de la lista', () => {
  assert.equal(R.destinoSuelta(3.4, 0, 14), 3);
  assert.equal(R.destinoSuelta(3.6, 0, 14), 4);
  assert.equal(R.destinoSuelta(3, -100, 14), 3);
  assert.equal(R.destinoSuelta(3, -1500, 14), 8);
  assert.equal(R.destinoSuelta(3, 1500, 14), 0);
  assert.equal(R.destinoSuelta(12, -3000, 14), 13);
  assert.equal(R.destinoSuelta(-0.3, 0, 14), 0);
  assert.equal(R.destinoSuelta(13.4, 0, 14), 13);
  assert.equal(R.destinoSuelta(0, -4000, 1), 0);
});

prueba('un toque lleva a la partícula tocada: la de arriba, la de abajo o la misma, sin salirse de la lista', () => {
  const alto = R.ALTO_ITEM * 3;
  const centro = alto / 2;
  assert.equal(R.destinoToque(centro, alto, 5, 14), 5);
  assert.equal(R.destinoToque(centro + R.ALTO_ITEM, alto, 5, 14), 6);
  assert.equal(R.destinoToque(centro - R.ALTO_ITEM, alto, 5, 14), 4);
  assert.equal(R.destinoToque(0, alto, 0, 14), 0);
  assert.equal(R.destinoToque(alto, alto, 13, 14), 13);
  assert.equal(R.destinoToque(centro + R.ALTO_ITEM, alto, 4.6, 14), 6);
});

/* ---------- lo que las pantallas dibujan ---------- */

prueba('la ruta PhrasalVerbo existe y la lista ya no reacomoda tarjetas (era el bug de las tarjetas encimadas)', () => {
  assert.match(leer('src/types/rutas.ts'), /PhrasalVerbo:\s*\{\s*verbo: string/);
  assert.match(leer('src/app/navegacion/RootNavigator.tsx'), /name="PhrasalVerbo"/);
  const lista = leer('src/features/phrasal/screens/PhrasalScreen.tsx');
  assert.match(lista, /<FlatList/);
  assert.match(lista, /Busca un verbo o una partícula/);
  assert.ok(!/reacomodar|layout=\{/.test(lista), 'la lista no debe tener layout transitions');
  assert.ok(!/<ScrollView|Screen scroll/.test(lista), 'la lista no debe ir dentro de un scroll');
});

prueba('la ruleta es un control ajustable, solo renderiza las partículas cercanas y se asienta con háptico', () => {
  const r = leer('src/features/phrasal/components/RuletaParticulas.tsx');
  assert.match(r, /accessibilityRole="adjustable"/);
  assert.match(r, /name: 'increment'/);
  assert.match(r, /name: 'decrement'/);
  assert.match(r, /haptics\.selection\(\)/);
  assert.match(r, /Gesture\.Race\(arrastre, toque\)/);
  assert.match(r, /Math\.min\(n - 1, centro \+ VISIBLES \+ MARGEN_RENDER\)/);
  assert.ok(!/useFrameCallback|withRepeat/.test(r), 'la ruleta no corre bucles');
});

prueba('la página del verbo: «N de M», chips como control principal con reducir movimiento y deslizar de lado', () => {
  const p = leer('src/features/phrasal/screens/PhrasalVerboScreen.tsx');
  assert.match(p, /`\$\{cambio\.indice \+ 1\} de \$\{n\}`/);
  assert.match(p, /const conRuleta = n > 1 && !reducido/);
  assert.match(p, /n > 1 && reducido \? chips : null/);
  assert.match(p, /activeOffsetX\(\[-20, 20\]\)/);
  const d = leer('src/features/phrasal/components/DetalleForma.tsx');
  assert.match(d, /label="Fuerte"/);
  assert.match(d, /label="Cuidado"/);
  assert.match(d, /Separable:/);
  const c = leer('src/features/phrasal/components/ChipsFormas.tsx');
  assert.match(c, /minHeight: layout\.tapMin/);
  assert.match(c, /accessibilityRole="radiogroup"/);
});

console.log(`\ncheck:ruleta ${total} pruebas ok\n`);
