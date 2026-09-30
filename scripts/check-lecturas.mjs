/**
 * Prueba lo puro de Lecturas sobre las 24 historias reales (29 capítulos):
 *
 *   npm run check:lecturas
 *
 *  - la división en oraciones (diálogos, abreviaturas, párrafos) y que cada oración se pueda recuperar del texto
 *    por su posición;
 *  - los tiempos de cada oración: la estimación por caracteres y las marcas de oración de Polly;
 *  - el reparto de las frases del catálogo (subrayadas) entre las oraciones;
 *  - el generador: que ninguna frase del catálogo vaya con mayúscula a media oración.
 *
 * oraciones.ts y lectura.ts no importan nada (solo tipos): se transpilan en memoria con typescript, sin jest.
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

const O = await cargar('src/domain/oraciones.ts');
const { partirTexto, nivelDificultad, etiquetaDificultad, destacarLectura } = await cargar('src/domain/lectura.ts');
const lecturas = JSON.parse(leer('assets/data/lecturas.json')).lecturas;
const catalogo = new Map(JSON.parse(leer('assets/data/catalogo.json')).entries.map((e) => [e.id, e]));
const capitulos = lecturas.flatMap((l) => l.capitulos.map((c) => ({ l, c })));

let total = 0;
const prueba = (nombre, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nombre}`);
};
const sinComentarios = (codigo) => codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const textos = (t) => O.dividirOraciones(t).map((o) => o.texto);

/* ---------- oraciones ---------- */

prueba('oraciones: un punto, una interrogación y una exclamación cierran; las acotaciones de diálogo no', () => {
  assert.deepEqual(textos('Wero is a dog. He waits! Why?'), ['Wero is a dog.', 'He waits!', 'Why?']);
  assert.deepEqual(textos('"How\'s it going?" says Don Beto, the man who makes tacos. Wero moves.'), [
    '"How\'s it going?" says Don Beto, the man who makes tacos.',
    'Wero moves.',
  ]);
  assert.deepEqual(textos('"That\'s it?" the boy says. "My taco?"'), ['"That\'s it?" the boy says.', '"My taco?"']);
  assert.deepEqual(textos('"Stop," she says. "Now."'), ['"Stop," she says.', '"Now."']);
});

prueba('oraciones: abreviaturas, puntos suspensivos, decimales y comillas de cierre', () => {
  assert.deepEqual(textos('Mr. Smith is here. He waits.'), ['Mr. Smith is here.', 'He waits.']);
  assert.deepEqual(textos('Well... maybe not. Go.'), ['Well... maybe not.', 'Go.']);
  assert.deepEqual(textos('It costs 3.5 dollars. Ok.'), ['It costs 3.5 dollars.', 'Ok.']);
  assert.deepEqual(textos('She said "no." Then she left.'), ['She said "no."', 'Then she left.']);
  assert.deepEqual(textos(''), []);
  assert.deepEqual(textos('   \n\n  '), []);
});

prueba('oraciones: los párrafos se separan con una línea en blanco y cada oración lleva su posición exacta', () => {
  const t = 'One two.  Three.\n\nFour five.\n\n\nSix.';
  const o = O.dividirOraciones(t);
  assert.deepEqual(o.map((x) => x.parrafo), [0, 0, 1, 2]);
  for (const x of o) assert.equal(t.slice(x.inicio, x.fin), x.texto);
});

prueba('oraciones: en los 29 capítulos reales cada una se recupera por su posición y no se pierde nada', () => {
  let n = 0;
  let cortas = 0;
  let largas = 0;
  for (const { l, c } of capitulos) {
    const o = O.dividirOraciones(c.texto);
    assert.ok(o.length >= 3, `${l.id} cap ${c.n}: solo ${o.length} oraciones`);
    let cursor = 0;
    for (const x of o) {
      assert.equal(c.texto.slice(x.inicio, x.fin), x.texto, `${l.id} cap ${c.n}: posición`);
      assert.ok(x.inicio >= cursor, `${l.id} cap ${c.n}: se solapan`);
      assert.ok(/^\s*$/.test(c.texto.slice(cursor, x.inicio)), `${l.id} cap ${c.n}: se perdió texto «${c.texto.slice(cursor, x.inicio)}»`);
      assert.ok(!/^[a-z]/.test(x.texto), `${l.id} cap ${c.n}: empieza en minúscula «${x.texto.slice(0, 40)}»`);
      assert.ok(x.texto.length >= 2, `${l.id} cap ${c.n}: oración vacía`);
      cursor = x.fin;
      n++;
      if (x.texto.length < 12) cortas++;
      if (x.texto.length > 220) largas++;
    }
    assert.ok(/^\s*$/.test(c.texto.slice(cursor)), `${l.id} cap ${c.n}: se perdió el final`);
  }
  console.log(`      ${n} oraciones en ${capitulos.length} capítulos (${cortas} de menos de 12 caracteres, ${largas} de más de 220)`);
});

/* ---------- tiempos ---------- */

prueba('tiempos estimados: empiezan en 0, crecen, no pasan de la duración y son proporcionales a los caracteres', () => {
  for (const { l, c } of capitulos) {
    const o = O.dividirOraciones(c.texto);
    const t = O.inicioEstimado(o, 90);
    assert.equal(t[0], 0);
    for (let i = 1; i < t.length; i++) assert.ok(t[i] >= t[i - 1], `${l.id}: retrocede`);
    assert.ok(t[t.length - 1] < 90);
  }
  const o = O.dividirOraciones('Aa. Bbbbbbbb.');
  const t = O.inicioEstimado(o, 10);
  assert.ok(Math.abs(t[1] - (10 * 3) / 12) < 1e-9);
  assert.deepEqual(O.inicioEstimado(o, 0), [0, 0]);
  assert.deepEqual(O.inicioEstimado(o, Number.NaN), [0, 0]);
  assert.deepEqual(O.inicioEstimado([], 10), []);
});

prueba('marcas de Polly: se usan si son de este texto, se colocan por su posición y nunca retroceden', () => {
  const texto = 'One two. Three four. Five six.';
  const o = O.dividirOraciones(texto);
  const marcas = { n: texto.length, s: [[0, 0, 8], [1500, 9, 20], [3200, 21, 30]] };
  assert.deepEqual(O.inicioDeMarcas(o, marcas, texto.length, 5), [0, 1.5, 3.2]);
  // Polly junta dos oraciones en una marca: la segunda queda entre esa marca y la siguiente.
  const junta = { n: texto.length, s: [[0, 0, 20], [3000, 21, 30]] };
  const tj = O.inicioDeMarcas(o, junta, texto.length, 5);
  assert.equal(tj[0], 0);
  assert.ok(tj[1] > 0 && tj[1] < 3 && tj[2] === 3);
  // Se ignoran si son de otro texto, están vacías, mal formadas o fuera de orden.
  assert.equal(O.inicioDeMarcas(o, { ...marcas, n: texto.length + 1 }, texto.length, 5), null);
  assert.equal(O.inicioDeMarcas(o, { n: texto.length, s: [] }, texto.length, 5), null);
  assert.equal(O.inicioDeMarcas(o, undefined, texto.length, 5), null);
  assert.equal(O.inicioDeMarcas(o, { n: texto.length, s: [[2000, 0, 8], [1000, 9, 20]] }, texto.length, 5), null);
  assert.equal(O.inicioDeMarcas(o, { n: texto.length, s: [[0, 8, 8]] }, texto.length, 5), null);
  // Con una duración más corta que las marcas, no pasa de la duración.
  assert.ok(O.inicioDeMarcas(o, marcas, texto.length, 2).every((x) => x <= 2));
});

prueba('la oración que suena: la última que ya empezó; antes de la primera, la primera', () => {
  const inicios = [0, 2, 5, 9];
  assert.equal(O.indiceEn(inicios, -1), 0);
  assert.equal(O.indiceEn(inicios, 0), 0);
  assert.equal(O.indiceEn(inicios, 1.99), 0);
  assert.equal(O.indiceEn(inicios, 2), 1);
  assert.equal(O.indiceEn(inicios, 8.9), 2);
  assert.equal(O.indiceEn(inicios, 100), 3);
  assert.equal(O.indiceEn([0], 3), 0);
  assert.equal(O.indiceEn([], 3), 0);
});

/* ---------- frases del catálogo dentro de las oraciones ---------- */

prueba('frases del catálogo: los trozos se reparten entre las oraciones sin perder ni repetir texto', () => {
  let frases = 0;
  let cruzan = 0;
  for (const { l, c } of capitulos) {
    const conocidas = l.frases
      .map((id) => catalogo.get(id))
      .filter(Boolean)
      .map((e) => ({ id: e.id, phrase: e.phrase, nueva: false }));
    const trozos = partirTexto(c.texto, conocidas);
    assert.equal(trozos.map((t) => t.texto).join(''), c.texto, `${l.id}: partirTexto no reconstruye el capítulo`);
    const o = O.dividirOraciones(c.texto);
    O.trozosPorOracion(o, trozos).forEach((delaOracion, i) => {
      assert.equal(delaOracion.map((t) => t.texto).join(''), o[i].texto, `${l.id} cap ${c.n}: oración ${i}`);
    });
    let desde = 0;
    for (const t of trozos) {
      const hasta = desde + t.texto.length;
      if (t.entryId !== null) {
        frases++;
        if (!o.some((x) => x.inicio <= desde && hasta <= x.fin)) cruzan++;
      }
      desde = hasta;
    }
  }
  console.log(`      ${frases} frases del catálogo repartidas; ${cruzan} cruzan el límite de una oración`);
  assert.equal(cruzan, 0, 'una frase del catálogo no debería cruzar dos oraciones');
});

/* ---------- la lista ---------- */

prueba('dificultad: tres franjas con los cortes de siempre y las mismas etiquetas largas', () => {
  assert.deepEqual([0, 25, 26, 55, 56, 100].map(nivelDificultad), [1, 1, 2, 2, 3, 3]);
  assert.equal(etiquetaDificultad(10), 'fácil para ti');
  assert.equal(etiquetaDificultad(40), 'te va a costar tantito');
  assert.equal(etiquetaDificultad(90), 'todavía pesada');
});

prueba('destacada: la abierta con más frases dominadas va primero; con empate gana la que ya iba primero; sin ninguna, nada', () => {
  const f = (id, dominadas, abierta = true) => ({ id, dominadas, abierta });
  const ids = (r) => r.map((x) => x.fila.id);
  const r = destacarLectura([f('a', 1), f('b', 4), f('c', 4), f('d', 2)]);
  assert.deepEqual(ids(r), ['b', 'a', 'c', 'd']);
  assert.deepEqual(r.map((x) => x.destacada), [true, false, false, false]);
  assert.deepEqual(ids(destacarLectura([f('a', 9, false), f('b', 2)])), ['b', 'a'], 'una cerrada nunca se destaca');
  const nadie = destacarLectura([f('a', 0), f('b', 0)]);
  assert.deepEqual(ids(nadie), ['a', 'b']);
  assert.ok(nadie.every((x) => !x.destacada));
  assert.deepEqual(destacarLectura([]), []);
  assert.ok(destacarLectura([f('a', 5, false)]).every((x) => !x.destacada));
});

prueba('la lista: sin números de 0 a 100 a la vista, «Niños» con ícono neutro y la entrada separada de Presionable', () => {
  const tarjeta = leer('src/features/lecturas/components/TarjetaLectura.tsx');
  assert.match(tarjeta, /Te sabes \$\{fila\.dominadas\} de \$\{conteo\(fila\.total, 'frase'\)\}/);
  assert.match(tarjeta, /<Badge label="Niños" icono="smile" small \/>/);
  assert.match(tarjeta, /<LevelBadge nivel=\{nivelDificultad\(fila\.dificultad\)\} \/>/);
  assert.ok(!/Dificultad \{/.test(tarjeta), 'el número de dificultad no va a la vista');
  assert.match(tarjeta, /Dificultad \$\{fila\.dificultad\} de 100/, 'sí va en el accessibilityLabel');
  assert.match(tarjeta, /<Animated\.View entering=\{reducido \? undefined : aparecerSubiendo\(retraso\)\}>\s*<Presionable/);
  assert.match(leer('src/features/lecturas/screens/LecturasScreen.tsx'), /destacarLectura\(filas\)/);
});

/* ---------- el lector ---------- */

prueba('lector: la leyenda va arriba y se guarda en ajustes, y las frases dicen «ya la viste» o «nueva» sin depender del color', () => {
  const pantalla = leer('src/features/lecturas/screens/LecturaScreen.tsx');
  const iLeyenda = pantalla.indexOf('<LeyendaFrases');
  assert.ok(iLeyenda > 0 && iLeyenda < pantalla.indexOf('<TextoAcompanado'), 'la leyenda va antes del texto');
  assert.ok(!/Toca cualquiera para abrir su ficha/.test(pantalla), 'ya no hay leyenda al final');
  assert.match(leer('src/data/repos/ajustes.ts'), /leyendaLecturaVista: false/);
  const oracion = leer('src/features/lecturas/components/Oracion.tsx');
  assert.match(oracion, /nueva, abre su ficha/);
  assert.match(oracion, /ya la viste/);
  assert.match(oracion, /textDecorationStyle: 'dotted'/);
  assert.ok(!/riskWarn|wrong/.test(oracion), 'el ámbar (color del fallo) ya no marca las frases nuevas');
  assert.match(oracion, /export const Oracion = memo\(/);
  assert.match(leer('src/features/lecturas/components/TextoAcompanado.tsx'), /export const TextoAcompanado = memo\(/);
});

prueba('reproductor: fijo abajo, sin «0:00 / 0:00» antes de conocer la duración, y el botón de seguir aparece con el pie', () => {
  const pie = leer('src/features/lecturas/components/PieReproductor.tsx');
  assert.match(pie, /progreso\.dur > 0 \? mmss\(progreso\.dur\) : '—:—'/);
  assert.match(pie, /variant="ghost"/, 'Detener es ghost');
  assert.match(leer('src/features/lecturas/screens/LecturaScreen.tsx'), /footer=\{capitulo\?\.audio \? pie : undefined\}/);
  const pantalla = leer('src/features/lecturas/screens/LecturaScreen.tsx');
  assert.match(pantalla, /ultimo \? 'Ver las preguntas' : `Capítulo \$\{cap \+ 2\}`/);
  assert.ok(!fs.existsSync(path.join(ROOT, 'src/components/card/ReproductorCapitulo.tsx')), 'el reproductor de arriba se retiró');
  const hook = leer('src/features/lecturas/hooks/useReproductorCapitulo.ts');
  for (const llamada of ['audio.play(path)', 'audio.pauseFrase()', 'audio.resumeFrase()', 'audio.stop()', 'audio.generacionActual()']) {
    assert.ok(hook.includes(llamada), `el reproductor sigue usando ${llamada}`);
  }
});

prueba('lectura acompañada: sigue al audio en el tercio de arriba, se suelta con el dedo, ofrece volver y con reducir movimiento salta', () => {
  const p = leer('src/features/lecturas/screens/LecturaScreen.tsx');
  const linea = Number(p.match(/const LINEA_LECTURA = ([\d.]+);/)?.[1]);
  assert.ok(linea > 0 && linea <= 1 / 3, `la oración queda a ${linea} del alto visible: debe estar en el tercio de arriba`);
  assert.match(p, /soltarScroll=\{siguiendo\}/, 'el dedo suelta el seguimiento');
  assert.match(p, /label="Volver a donde va el audio"/);
  assert.match(p, /if \(reducido\) \{\s*animandoScroll\.value = 0;\s*scrollTo\(scrollRef, 0, objetivo, false\);/, 'con reducir movimiento el scroll salta');
  assert.match(p, /<Animated\.View\s+entering=\{reducido \? undefined : aparecer\(\)\}\s+exiting=\{reducido \? undefined : desaparecer\(motionDuration\.rapido\)\}\s+style=\{styles\.volver\}\s*>\s*<Button/, 'el botón entra en su propio Animated.View');
  const texto = leer('src/features/lecturas/components/TextoAcompanado.tsx');
  assert.match(texto, /useAnimatedReaction\(/);
  assert.match(texto, /if \(reducido \|\| pulso\.value > 0/, 'con reducir movimiento no hay pulso');
  assert.match(texto, /duration: motionDuration\.rapido/, 'el pulso dura 150 ms (rapido)');
  const hook = leer('src/features/lecturas/hooks/useReproductorCapitulo.ts');
  assert.match(hook, /AppState\.addEventListener/, 'pausa al irse a segundo plano');
});

prueba('preguntas: tres por historia, una a la vez, marcadas como en Estudio, sin puntaje, y un cierre con destello único', () => {
  for (const l of lecturas) {
    assert.equal(l.preguntas.length, 3, `${l.id}: son tres preguntas (los tres puntos de arriba)`);
    for (const p of l.preguntas) assert.ok(p.correcta >= 0 && p.correcta < p.opciones.length && p.porque.length > 0, `${l.id}: pregunta mal formada`);
  }
  const una = leer('src/features/lecturas/components/PreguntaUnaAUna.tsx');
  assert.match(una, /export const TOTAL_PREGUNTAS = 3;/);
  assert.match(una, /<PuntosRepeticion\s+ronda=\{\(indice \+ 1\) as 1 \| 2 \| 3\}/, 'los tres puntos de avance son los de Estudio');
  assert.match(una, /No se guarda calificación\./, 'la nota se queda');
  assert.match(una, /<OptionButton/, 'la elegida y la correcta se marcan como en Estudio');
  assert.match(una, /if \(k === correcta\) return 'correct';\s*return k === respuesta \? 'wrong' : 'dimmed';/);
  assert.match(una, /entering=\{reducido \? undefined : aparecer\(\)\}\s+accessibilityLiveRegion="polite"/, 'la explicación entra con fade y se anuncia');
  assert.ok(!/puntaje|score|confeti|confetti/i.test(sinComentarios(una)), 'nada de puntaje ni confeti');
  const puntos = leer('src/shared/ui/fx/PuntosRepeticion.tsx');
  assert.match(puntos, /accessibilityLabel=\{etiqueta \?\? `Repetición \$\{ronda\} de \$\{REPETICIONES\}`\}/, 'Estudio conserva su etiqueta');

  const cierre = leer('src/features/lecturas/components/CierreLectura.tsx');
  assert.match(cierre, /Terminaste la historia/);
  assert.match(cierre, /if \(!todas \|\| reducido\) return;/, 'sin las tres respuestas o con reducir movimiento no hay destello');
  assert.equal((cierre.match(/withTiming\(/g) ?? []).length, 1, 'un solo destello, sin bucles');
  assert.ok(!/withRepeat|confeti|confetti|puntaje|score/i.test(sinComentarios(cierre)));
  assert.ok(!/\bexiting=|\blayout=/.test(cierre) && !/style=\{\[styles\.destello, estiloDestello\]\}[^>]*entering/.test(cierre), 'el destello lleva transform: no comparte nodo con entering');

  const p = leer('src/features/lecturas/screens/LecturaScreen.tsx');
  assert.match(p, /<Button label="Salir sin contestar" variant="ghost"/, '«Salir sin contestar» es ghost');
  assert.match(p, /pregunta \+ 1 >= total \? 'Terminar' : 'Siguiente'/);
  assert.match(p, /todas=\{Object\.keys\(respuestas\)\.length === total\}/);
  assert.match(p, /lectura\.frases\.filter\(\(id\) => !estados\.has\(id\)\)\.length/, 'las nuevas son las que aún no tenía');
  assert.match(p, /label="Volver a las lecturas"/);
  assert.ok(!/label=\{?\s*contestadas/.test(p), 'ya no hay botón «Listo»');
});

/* ---------- generador y datos ---------- */

prueba('generador: ninguna frase del catálogo va con mayúscula a media oración (salvo «I»)', () => {
  for (const l of lecturas) {
    const texto = l.capitulos.map((c) => c.texto).join('\n\n');
    for (const id of l.frases) {
      const f = catalogo.get(id).phrase;
      const re = new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      for (const m of texto.matchAll(re)) {
        const antes = texto.slice(0, m.index).replace(/ +$/, '');
        const abre = antes === '' || /[.?!…]["'”’)]*$/.test(antes) || /[\n"“]$/.test(antes);
        assert.ok(!(/^[A-Z]/.test(m[0]) && !/^I\b/.test(m[0]) && !abre), `${l.id}: «${m[0]}» va con mayúscula a media oración`);
      }
    }
  }
  assert.ok(leer('assets/data/lecturas.json').includes('a large soda'));
});

prueba('los 29 capítulos conservan su audio tras regenerar', () => {
  assert.equal(capitulos.length, 29);
  for (const { l, c } of capitulos) assert.match(c.audio ?? '', /^aud\/lec\/.+\.mp3$/, `${l.id} cap ${c.n}`);
});

prueba('marcas de oración y salto de audio: el índice es un objeto válido, hay quien lo lee y quien lo genera, y el audio puede saltar', () => {
  const indice = JSON.parse(leer('assets/data/marcas_oraciones.json'));
  assert.equal(typeof indice, 'object');
  for (const [ruta, m] of Object.entries(indice)) {
    assert.match(ruta, /^aud\/lec\//);
    assert.ok(Number.isInteger(m.n) && Array.isArray(m.s) && m.s.length > 0, `${ruta}: marcas mal formadas`);
    const texto = capitulos.find(({ c }) => c.audio === ruta)?.c.texto;
    assert.ok(texto !== undefined, `${ruta}: no es el audio de ningún capítulo`);
    assert.equal(m.n, texto.length, `${ruta}: las marcas son de otro texto`);
  }
  assert.match(leer('src/services/marcas.ts'), /export function marcasOracionesDe/);
  assert.match(leer('src/services/audio/reproductor.ts'), /export async function saltarFrase\(seg: number\)/);
  const polly = leer('scripts/polly.mjs');
  assert.match(polly, /--marcas-oraciones/);
  assert.match(polly, /SpeechMarkTypes: \["sentence"\]/);
});

console.log(`\ncheck:lecturas ${total} pruebas ok\n`);
