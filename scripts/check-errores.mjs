/**
 * Prueba lo puro de Errores que te delatan sobre los 194 errores reales:
 *
 *   npm run check:errores
 *
 *  - los filtros con su cuenta y el orden (que solo reordena, nunca filtra);
 *  - el encabezado («194 errores» / «32 de 194»), las etiquetas de gravedad y lo que se anuncia y se comparte;
 *  - lo que se puede revisar sin teléfono de la lista y del detalle (sin rojo, sin badges de gravedad sueltos).
 *
 * errores.ts solo importa tipos: se transpila en memoria con typescript, sin jest.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const existe = (rel) => fs.existsSync(path.join(ROOT, rel));
const cargar = async (rel) => {
  const js = ts.transpileModule(leer(rel), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};
const sinComentarios = (codigo) => codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const E = await cargar('src/domain/errores.ts');
const datos = JSON.parse(leer('assets/data/errores.json'));
const errores = datos.errores;

let total = 0;
const prueba = async (nombre, fn) => {
  await fn();
  total++;
  console.log(`  ok  ${nombre}`);
};

/* ---------- filtros, cuenta y orden ---------- */

await prueba('los 194 errores: cada chip lleva su cuenta y todas suman el total', () => {
  assert.equal(errores.length, 194);
  assert.equal(datos.total, 194);
  const cuenta = E.conteoPorCategoria(errores);
  assert.equal(cuenta.todos, 194);
  const categorias = E.CATEGORIAS_ERRORES.filter((c) => c.id !== 'todos');
  assert.equal(categorias.reduce((s, c) => s + cuenta[c.id], 0), 194, 'las cuentas de las categorías suman el total');
  for (const c of categorias) {
    assert.equal(cuenta[c.id], errores.filter((e) => e.categoria === c.id).length, c.label);
    assert.ok(cuenta[c.id] > 0, `${c.label} tiene errores`);
  }
  assert.ok(errores.every((e) => E.CATEGORIAS_ERRORES.some((c) => c.id === e.categoria)), 'ninguna categoría queda sin chip');
  assert.deepEqual(E.CATEGORIAS_ERRORES.map((c) => c.label), ['Todos', 'Falsos amigos', 'Calcos', 'Gramática', 'Preposiciones', 'Pronunciación', 'Tono', 'Escritura']);
});

await prueba('filtrar: cada chip deja solo su categoría; «Todos» deja los 194; el orden no cambia lo que queda', () => {
  for (const c of E.CATEGORIAS_ERRORES) {
    const g = E.filtrarYOrdenar(errores, c.id, 'graves');
    const o = E.filtrarYOrdenar(errores, c.id, 'orden');
    assert.ok(g.every((e) => c.id === 'todos' || e.categoria === c.id), `${c.label}: solo lo suyo`);
    assert.deepEqual(new Set(g.map((e) => e.id)), new Set(o.map((e) => e.id)), `${c.label}: los dos órdenes muestran lo mismo`);
    assert.equal(g.length, E.conteoPorCategoria(errores)[c.id], `${c.label}: la cuenta del chip es lo que se ve`);
  }
});

await prueba('«Más graves primero»: la gravedad baja de 3 a 1 y, a igual gravedad, se respeta el orden del contenido', () => {
  const l = E.filtrarYOrdenar(errores, 'todos', 'graves');
  for (let i = 1; i < l.length; i++) {
    assert.ok(l[i - 1].gravedad >= l[i].gravedad, `#${i}: la gravedad no sube`);
    if (l[i - 1].gravedad === l[i].gravedad) assert.ok(l[i - 1].orden < l[i].orden, `#${i}: a igual gravedad, por orden`);
  }
  assert.equal(l[0].gravedad, 3);
  assert.equal(l.filter((e) => e.gravedad === 3).length, 16);
});

await prueba('«En orden»: sale por el campo `orden`, sin importar la gravedad', () => {
  const l = E.filtrarYOrdenar(errores, 'todos', 'orden');
  for (let i = 1; i < l.length; i++) assert.ok(l[i - 1].orden < l[i].orden, `#${i}`);
});

await prueba('ordenar no modifica la lista de entrada y el ajuste guardado se normaliza', () => {
  const copia = errores.map((e) => e.id);
  E.filtrarYOrdenar(errores, 'todos', 'graves');
  E.filtrarYOrdenar(errores, 'calco', 'orden');
  assert.deepEqual(errores.map((e) => e.id), copia);
  assert.equal(E.normalizarOrden('orden'), 'orden');
  assert.equal(E.normalizarOrden('graves'), 'graves');
  for (const raro of [undefined, null, 3, 'otro', '']) assert.equal(E.normalizarOrden(raro), 'graves', String(raro));
  assert.deepEqual(E.ORDENES_ERRORES.map((o) => o.label), ['Más graves primero', 'En orden']);
  assert.match(leer('src/db/settings.ts'), /ordenErrores: 'graves',/, 'el orden de siempre es el que arranca');
});

/* ---------- encabezado, gravedad, anuncio y compartir ---------- */

await prueba('el encabezado: «194 errores» sin filtro y «32 de 194» con filtro', () => {
  assert.deepEqual(E.encabezadoErrores('todos', 194, 194), { numero: 194, resto: 'errores', anuncio: '194 errores' });
  assert.deepEqual(E.encabezadoErrores('calco', 40, 194), { numero: 40, resto: 'de 194', anuncio: '40 de 194 errores' });
  assert.deepEqual(E.encabezadoErrores('registro', 32, 194), { numero: 32, resto: 'de 194', anuncio: '32 de 194 errores' });
});

await prueba('la gravedad se dice con texto: Suena raro, Te delata, Cambia el significado', () => {
  assert.equal(E.etiquetaGravedad(1), 'Suena raro');
  assert.equal(E.etiquetaGravedad(2), 'Te delata');
  assert.equal(E.etiquetaGravedad(3), 'Cambia el significado');
  assert.equal(E.anuncioGravedad(2), 'Gravedad: Te delata, 2 de 3');
  for (const e of errores) assert.ok([1, 2, 3].includes(e.gravedad), `${e.id}: gravedad ${e.gravedad}`);
});

await prueba('el detalle se anuncia en orden y sin doble punto; el texto de compartir trae los tres y la app', () => {
  const e = errores.find((x) => x.id === 'err_001');
  assert.equal(
    E.anuncioDeError(e),
    'Lo que dices: I am constipated. Lo que entienden: Estoy estreñido. Lo correcto: I have a cold.'
  );
  assert.equal(
    E.textoParaCompartir(e),
    'Decía «I am constipated» y lo que entienden es «Estoy estreñido». Se dice «I have a cold».\nLo aprendí con Wero.'
  );
  for (const x of errores) {
    const anuncio = E.anuncioDeError(x);
    assert.ok(!/[?!…]\./.test(anuncio) && !/\.\./.test(anuncio), `${x.id}: doble signo en «${anuncio}»`);
    const compartir = E.textoParaCompartir(x);
    for (const t of [x.lo_que_dices, x.lo_que_entienden, x.lo_correcto]) assert.ok(compartir.includes(t.trim()), `${x.id}: falta «${t}»`);
    assert.ok(compartir.endsWith('Lo aprendí con Wero.'));
  }
});

await prueba('la secuencia del detalle: los tres pasos caben en 1.6 s en los 194 pares y el glitch termina cuando arranca «Lo correcto»', async () => {
  const D = await cargar('src/utils/diff.ts');
  const motion = leer('src/theme/motion.ts');
  const num = (patron, nombre) => {
    const m = motion.match(patron);
    assert.ok(m, `no encontré ${nombre} en motion.ts`);
    return Number(m[1]);
  };
  const dur = { rapido: num(/rapido: (\d+),/, 'rapido'), base: num(/base: (\d+),/, 'base'), lento: num(/lento: (\d+),/, 'lento'), escena: num(/escena: (\d+),/, 'escena') };
  const escalonMs = num(/motionEscalon = \{\s*ms: (\d+),/, 'motionEscalon.ms');
  const escalonMax = num(/max: (\d+),\s*\} as const;\s*export function escalon/, 'motionEscalon.max');
  assert.match(motion, /motionError = \{ tacha: motionDuration\.base, pausa: 120, entra: 80 \}/);
  assert.match(motion, /export const entraSube[\s\S]*?\.duration\(motionDuration\.lento\)/, 'la llegada de una palabra dura `lento`');
  const bloque = motion.slice(motion.indexOf('export const motionMalentendido'));
  const cableInicio = Number(bloque.match(/cableInicio: (\d+),/)[1]);
  assert.match(bloque, /cable: motionDuration\.lento,/);
  assert.match(bloque, /interferencia: motionDuration\.rapido,/);
  const glitch = Number(bloque.match(/glitch: (\d+),/)[1]);
  const [cMin, cMax, tope] = [/cMin: (\d+),/, /cMax: (\d+),/, /tope: (\d+),/].map((patron) => Number(bloque.match(patron)[1]));
  assert.equal(tope, 1600);
  const t = {
    tope, cMin, cMax,
    tacha: dur.base, pausa: 120, entra: 80, entraSube: dur.lento, icono: dur.base,
    escena: dur.escena, aparecerSubiendo: dur.lento,
    escalon: (i) => Math.min(i, escalonMax - 1) * escalonMs,
  };
  let morph = 0;
  let masLarga = 0;
  let ultima = 0;
  for (const e of errores) {
    const d = D.diffFrase(e.lo_que_dices, e.lo_correcto);
    const { tachas, entradas } = D.numerarCambios(d.piezas);
    const modo = d.claro ? 'morph' : 'fundido';
    if (d.claro) morph++;
    const duracion = E.duracionCorreccion(modo, tachas, entradas, t);
    const inicio = E.inicioDeCorreccion(duracion, t);
    assert.ok(inicio >= cMin && inicio <= cMax, `${e.id}: el paso c arranca en ${inicio}`);
    assert.ok(inicio + duracion <= tope, `${e.id}: ${inicio} + ${duracion} pasa de ${tope} ms`);
    masLarga = Math.max(masLarga, duracion);
    ultima = Math.max(ultima, inicio + duracion);
  }
  assert.equal(morph + (errores.length - morph), 194);
  // El glitch empieza a medio cable y termina antes de que arranque el paso c en el caso normal.
  const interferencia = cableInicio + dur.lento / 2;
  assert.ok(interferencia + glitch <= cMax, `el glitch termina en ${interferencia + glitch} ms, después de ${cMax}`);
  assert.equal(E.inicioDeCorreccion(0, t), cMax);
  assert.equal(E.inicioDeCorreccion(5000, t), cMin);
  console.log(`        ${morph} pares con morph y ${errores.length - morph} con fundido; la corrección más larga dura ${masLarga} ms y todo termina a los ${ultima} ms`);
});

/* ---------- lo que se puede revisar sin teléfono ---------- */

await prueba('la lista y el detalle no usan rojo ni el badge de gravedad: la gravedad es un medidor con texto, en ámbar', () => {
  for (const rel of ['src/screens/extras/ErrorsScreen.tsx', 'src/screens/extras/ErrorDetailScreen.tsx']) {
    const codigo = sinComentarios(leer(rel));
    assert.ok(!/riskStrong|tone="strong"/.test(codigo), `${rel}: sin rojo`);
    assert.ok(!/label="Cambia el significado"/.test(codigo), `${rel}: la gravedad no es un badge suelto`);
  }
  const detalle = sinComentarios(leer('src/screens/extras/ErrorDetailScreen.tsx'));
  assert.doesNotMatch(detalle, /errImg: \{[^}]*alignSelf/, 'la imagen no se centra encogida: `ancha` la estira');
});

await prueba('la lista: encabezado con marcador, chips con cuenta y orden guardado en ajustes', () => {
  const p = sinComentarios(leer('src/screens/extras/ErrorsScreen.tsx'));
  assert.match(p, /<Marcador\b/, 'el número rueda con el Marcador');
  assert.match(p, /encabezadoErrores\(/);
  assert.match(p, /conteoPorCategoria\(/);
  assert.match(p, /filtrarYOrdenar\(/);
  assert.match(p, /useSettingsStore\(\(s\) => s\.ordenErrores\)/);
  assert.match(p, /'ordenErrores'/, 'el orden se guarda');
  assert.match(p, /<TarjetaError\b/);
  assert.match(p, /keyExtractor=\{claveError\}/);
  assert.match(p, /removeClippedSubviews/);
  assert.ok(existe('src/components/errores/TarjetaError.tsx') && existe('src/components/errores/MedidorGravedad.tsx'));
  const tarjeta = sinComentarios(leer('src/components/errores/TarjetaError.tsx'));
  assert.match(tarjeta, /<MedidorGravedad\b/);
  assert.match(tarjeta, /color\.wrong/, 'la ✕ y lo dicho van en ámbar');
  assert.match(tarjeta, /color\.correct/, 'la ✓ va en verde');
  assert.match(tarjeta, /Para contar/);
  assert.match(tarjeta, /export const TarjetaError = memo\(/);
  const medidor = sinComentarios(leer('src/components/errores/MedidorGravedad.tsx'));
  assert.match(medidor, /anuncioGravedad\(/);
  assert.match(medidor, /etiquetaGravedad\(/);
});

await prueba('el héroe: cable de Pares, glitch solo con transform y opacity, la corrección de Gramática y reducir movimiento sin nada de eso', () => {
  const sec = sinComentarios(leer('src/components/errores/SecuenciaMalentendido.tsx'));
  assert.match(sec, /<CableTrazo\b/, 'el cable es el de Pares');
  assert.match(sec, /desvio=\{desvio\}/, 'el cable vibra');
  assert.match(sec, /useCorreccion\(e\.lo_que_dices, e\.lo_correcto\)/, 'el diff es el de Gramática');
  assert.match(sec, /<VistaCorreccion\b/);
  assert.match(sec, /<SenalRota\b/);
  assert.match(sec, /duracionCorreccion\(modo, correccion\.tachas, correccion\.entradas, TIEMPOS\)/, 'el paso c sale de la línea de tiempo probada');
  assert.match(sec, /inicioDeCorreccion\(duracion, TIEMPOS\)/);
  assert.match(sec, /accessibilityLabel=\{anuncioDeError\(e\)\}/, 'el lector oye el malentendido completo, en orden');
  assert.match(sec, /Ver otra vez/);
  assert.match(sec, /\{reducido \? null : \(\s*<View style=\{styles\.otraVez\}>/, 'sin animación no hay «Ver otra vez»');
  const reducido = sec.slice(sec.indexOf('if (reducido) {'), sec.indexOf('v1.value = 0;'));
  assert.ok(/setFinal\(true\)/.test(reducido) && !/soltarCable|jugarCorreccion|setGlitch|programar/.test(reducido), 'con reducir movimiento: los tres pasos con fundido, sin cable, glitch ni morph');
  assert.ok(!/riskStrong|tone="strong"/.test(sec));
  const rota = sinComentarios(leer('src/components/errores/SenalRota.tsx'));
  assert.ok(!/skia|Shader|RuntimeEffect|withRepeat/i.test(rota), 'sin shaders ni bucles: dura una sola vez');
  assert.equal((rota.match(/withTiming\(/g) ?? []).length, 1);
  assert.match(rota, /duration: motionMalentendido\.glitch/);
  for (const bloque of rota.match(/useAnimatedStyle\(\(\) => \{[\s\S]*?\n  \}\);/g) ?? []) {
    const claves = [...bloque.matchAll(/^\s{4,6}(\w+):/gm)].map((m) => m[1]);
    for (const k of claves) assert.ok(['opacity', 'transform', 'color', 'translateX'].includes(k), `el glitch solo mueve transform y opacity (color en la base), no ${k}`);
  }
  assert.match(rota, /if \(reducido\) return <Text/, 'con reducir movimiento es solo el texto');
  const trazo = leer('src/components/fx/CableTrazo.tsx');
  assert.match(trazo, /desvio\?: SharedValue<number>;/);
  assert.match(sinComentarios(leer('src/components/juegos/pares/CableSenal.tsx')), /<CableTrazo\b/, 'Pares usa el mismo dibujo');
  assert.ok(!/Canvas/.test(sinComentarios(leer('src/components/juegos/pares/CableSenal.tsx'))));
  const gram = sinComentarios(leer('src/components/gramatica/ErrorQueSeCorrige.tsx'));
  assert.match(gram, /useCorreccion\(mal, bien\)/, 'Gramática usa el mismo núcleo');
  assert.ok(!/function Tacha|function FraseTransformada/.test(gram));
  assert.match(sinComentarios(leer('src/components/gramatica/CorreccionFrase.tsx')), /export function useCorreccion\(/);
  const detalle = sinComentarios(leer('src/screens/extras/ErrorDetailScreen.tsx'));
  assert.match(detalle, /<SecuenciaMalentendido key=\{err\.id\} error=\{err\} \/>/);
  assert.match(detalle, /useFocusEffect\(/);
  assert.match(detalle, /audio\.stop\(\)/, 'salir corta la voz');
});

await prueba('el detalle: el duelo solo sale con audio de contraste (los 22 de pronunciación), «Por qué pasa» con NotaInfo y Compartir solo si se puede contar', () => {
  const conContraste = errores.filter((e) => e.audio_contraste_archivo);
  assert.equal(conContraste.length, 22);
  assert.ok(conContraste.every((e) => e.categoria === 'pronunciacion' && e.audio_contraste && e.audio), 'todos son de pronunciación y traen texto y audio');
  assert.equal(errores.filter((e) => e.categoria === 'pronunciacion').length, 22, 'y todos los de pronunciación lo traen');
  assert.equal(errores.filter((e) => e.compartible).length, 112);
  const d = sinComentarios(leer('src/screens/extras/ErrorDetailScreen.tsx'));
  assert.match(d, /<DueloContraste error=\{err\} \/>/);
  assert.match(d, /<NotaInfo>\s*<Text style=\{styles\.whyBody\}>\{err\.por_que\}<\/Text>\s*<\/NotaInfo>/, '«Por qué pasa» lleva el ícono info y el filo accent de NotaInfo');
  assert.match(d, /<MedidorGravedad gravedad=\{err\.gravedad\} disposicion="fila" animado/);
  assert.match(d, /\{err\.compartible \? <Badge label="Para contar" tone="accent" small \/> : null\}/);
  assert.match(d, /\{err\.compartible \? \(\s*<View style=\{styles\.compartir\}>/, 'Compartir solo si se puede contar');
  assert.match(d, /<Button variant="secondary" icon="share" label="Compartir"/, 'Compartir es secondary: no compite con la acción principal');
  assert.match(d, /Share\.share\(\{ message: textoParaCompartir\(err\) \}\)/, 'abre el menú del sistema con el texto armado');
  assert.match(d, /setFalloCompartir\(true\)/, 'si el menú no abre se avisa: no se traga el error');
  assert.ok(!/GenerarImagen|captureRef|ViewShot/.test(d), 'sin imagen generada por ahora');
  const duelo = sinComentarios(leer('src/components/errores/DueloContraste.tsx'));
  assert.match(duelo, /if \(!e\.audio_contraste_archivo\) return null;/);
  assert.match(duelo, /titulo="Así suena mal"/);
  assert.match(duelo, /titulo="Así suena bien"/);
  assert.match(duelo, /tono === 'mal' \? color\.wrong : color\.correct/, 'ámbar contra verde, nunca rojo');
  assert.match(duelo, /name=\{tono === 'mal' \? 'signal-broken' : 'check'\}/, 'cada mitad lleva su ícono: el color no es lo único');
  assert.ok(!/riskStrong|tone="strong"/.test(duelo));
});

console.log(`\ncheck:errores ${total} pruebas ok\n`);
