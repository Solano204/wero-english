/**
 * Prueba los casos de "Hoy" y de destacados de Practicar.
 *
 *   npm run check:practicar
 *
 * hoy.ts no importa nada de React Native, así que se transpila en memoria
 * con typescript y se carga como módulo, sin jest.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const fuente = fs.readFileSync(path.join(ROOT, 'src/features/practicar/logic/hoy.ts'), 'utf8');
const js = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { elegirHoy, elegirDestacados, ORDEN, NUM_DESTACADOS } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

// Los módulos puros importan `@/domain/texto`: se resuelve a mano al cargarlos.
const ALIAS = {
  '@/domain/texto': 'src/domain/texto.ts',
  '@/domain/resumenNiveles': 'src/domain/resumenNiveles.ts',
};
const cargarUrl = async (rel) => {
  const fuenteRel = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  let out = ts.transpileModule(fuenteRel, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [alias, destino] of Object.entries(ALIAS)) {
    if (out.includes(`'${alias}'`)) out = out.replaceAll(`'${alias}'`, `'${await cargarUrl(destino)}'`);
  }
  return `data:text/javascript;base64,${Buffer.from(out).toString('base64')}`;
};
const cargar = async (rel) => import(await cargarUrl(rel));
const { energiaOnda, progresoMeta, metaCumplida, etiquetaCorregir, ENERGIA_MIN } = await cargar('src/features/practicar/logic/consola.ts');
const P = await cargar('src/components/progreso/datos.ts');
const { plural, conteo, miles, mismoTexto } = await cargar('src/domain/texto.ts');
const { metaDe, textoMeta } = await cargar('src/features/practicar/logic/metadatos.ts');
const { diasQueQuedan, textoDiasReto } = await cargar('src/features/practicar/logic/reto.ts');
const { resumenNivel, TOTAL_NIVELES } = await cargar('src/domain/resumenNiveles.ts');

const uso = (o) => Object.fromEntries(Object.entries(o).map(([k, [dias, ultimo]]) => [k, { dias, ultimo }]));

// Caso a: los repasos vencidos mandan sobre las atoradas y sobre el último modo.
assert.deepEqual(elegirHoy(850, 5, uso({ colmena: [3, 500] })), { modo: 'study', motivo: 'vencidas' });
assert.deepEqual(elegirHoy(1, 0, {}), { modo: 'study', motivo: 'vencidas' });
// Caso 1: frases atoradas mandan, aunque haya historial.
assert.deepEqual(elegirHoy(0, 5, uso({ colmena: [3, 500] })), { modo: 'atoran', motivo: 'atoradas' });
// Caso 2: sin atoradas, el último modo usado (por marca de tiempo, no por orden).
assert.deepEqual(elegirHoy(0, 0, uso({ colmena: [3, 900], study: [8, 200] })), { modo: 'colmena', motivo: 'ultimo' });
assert.deepEqual(elegirHoy(0, 0, uso({ pares_minimos: [1, 50], caida: [2, 40] })), { modo: 'pares_minimos', motivo: 'ultimo' });
// Caso 3: usuario nuevo, sin historial ni atoradas: Frases al azar.
assert.deepEqual(elegirHoy(0, 0, {}), { modo: 'study', motivo: 'nuevo' });

// Destacados: sin datos, los primeros del orden de siempre, sin el de HOY.
assert.deepEqual(elegirDestacados({}, 'study'), ['gramatica', 'colmena', 'pares']);
assert.deepEqual(elegirDestacados({}, 'colmena'), ['study', 'gramatica', 'pares']);
assert.deepEqual(elegirDestacados({}, 'atoran'), ['study', 'gramatica', 'colmena']);
// Con datos, los de más días de uso; los que no tienen registro rellenan por orden.
assert.deepEqual(elegirDestacados(uso({ caida: [5, 1], colmena: [2, 1] }), 'study'), ['caida', 'colmena', 'gramatica']);
// El de HOY nunca se repite, aunque sea el más usado.
assert.deepEqual(elegirDestacados(uso({ caida: [9, 1] }), 'caida'), ['study', 'gramatica', 'colmena']);

assert.equal(new Set(ORDEN).size, 17, 'ORDEN debe tener los 17 destinos sin repetir');
assert.equal(NUM_DESTACADOS, 3);
// Consola de HOY: la onda, el anillo de meta y el marcador.
assert.equal(energiaOnda(0), ENERGIA_MIN, '0 pendientes: onda casi plana');
assert.equal(energiaOnda(-5), ENERGIA_MIN, 'negativos no bajan del mínimo');
assert.equal(energiaOnda(95), 1, 'muchas pendientes: toda la energía');
assert.ok(energiaOnda(10) > energiaOnda(5) && energiaOnda(5) > energiaOnda(0), 'más pendientes, más energía');
assert.equal(progresoMeta(2, 20), 0.1);
assert.equal(progresoMeta(30, 20), 1, 'el anillo no pasa de lleno');
assert.equal(progresoMeta(5, 0), 0, 'sin meta, anillo vacío');
assert.equal(metaCumplida(20, 20), true);
assert.equal(metaCumplida(19, 20), false);
assert.equal(metaCumplida(3, 0), false);
// Destacados: «Nivel N · E estrellas» y la barra fina de nivel/200.
assert.equal(resumenNivel(undefined), null, 'un modo sin niveles no tiene resumen');
assert.deepEqual(resumenNivel({ jugados: 0, estrellas: 0, siguiente: 1 }), { texto: 'Nivel 1 · 200 niveles', nivel: 1 });
assert.deepEqual(resumenNivel({ jugados: 22, estrellas: 36, siguiente: 23 }), { texto: 'Nivel 23 · 36 estrellas', nivel: 23 });
assert.equal(resumenNivel({ jugados: 3, estrellas: 1, siguiente: 4 }).texto, 'Nivel 4 · 1 estrella', 'singular con una estrella');
assert.equal(resumenNivel({ jugados: 200, estrellas: 500, siguiente: 201 }).nivel, TOTAL_NIVELES, 'la barra no pasa de 200');

// Reto de la semana: los días que quedan contando hoy.
assert.equal(diasQueQuedan('2026-09-21', '2026-09-21'), 7, 'el lunes quedan 7');
assert.equal(diasQueQuedan('2026-09-21', '2026-09-24'), 4);
assert.equal(diasQueQuedan('2026-09-21', '2026-09-27'), 1, 'el domingo es el último día');
assert.equal(diasQueQuedan('2026-09-21', '2026-09-20'), 7, 'un día antes del lunes no pasa de 7');
assert.equal(diasQueQuedan('2026-09-21', '2026-10-05'), 1, 'pasada la semana no baja de 1');
assert.equal(textoDiasReto(1), 'Queda 1 día');
assert.equal(textoDiasReto(4), 'Quedan 4 días');

// Pluralización: «1 estrella», «1 frase», «1 guardada», «1 día».
assert.equal(plural(1, 'frase'), 'frase');
assert.equal(plural(0, 'frase'), 'frases', 'el cero va en plural');
assert.equal(plural(2, 'error', 'errores'), 'errores');
assert.equal(conteo(1, 'estrella'), '1 estrella');
assert.equal(conteo(36, 'estrella'), '36 estrellas');
assert.equal(conteo(1, 'guardada'), '1 guardada');
assert.equal(conteo(1, 'día'), '1 día');
assert.equal(conteo(1, 'frase avanzó', 'frases avanzaron'), '1 frase avanzó');

// Metadatos de los renglones: Badge de nivel, «nuevo», atoradas, guardadas; sin dato, nada.
const fuentes = {
  niveles: { pares: { jugados: 22, estrellas: 36, siguiente: 23 }, colmena: { jugados: 0, estrellas: 0, siguiente: 1 } },
  records: { cazala: { partidas: 3, mejor: 12 } },
  paresLimpios: 0,
  atoradas: 5,
  guardadas: 1,
  frasesPhrasal: 207,
};
assert.deepEqual(metaDe('pares', fuentes), { tipo: 'nivel', nivel: 23, estrellas: 36 });
assert.deepEqual(metaDe('colmena', fuentes), { tipo: 'nivel', nivel: 1, estrellas: 0 }, 'sin jugar arranca en el nivel 1');
assert.equal(metaDe('caida', fuentes), null, 'un juego sin niveles ni partidas no lleva Badge');
assert.deepEqual(metaDe('cazala', fuentes), { tipo: 'texto', texto: 'mejor: 12' });
assert.deepEqual(metaDe('pares_minimos', fuentes), { tipo: 'nuevo' });
assert.deepEqual(metaDe('pares_minimos', { ...fuentes, paresLimpios: 1 }), { tipo: 'texto', texto: '1 par limpio' });
assert.deepEqual(metaDe('atoran', fuentes), { tipo: 'atoradas', n: 5 });
assert.equal(metaDe('atoran', { ...fuentes, atoradas: 0 }), null, 'sin atoradas el renglón queda limpio');
assert.deepEqual(metaDe('mazo', fuentes), { tipo: 'guardadas', n: 1 });
assert.equal(metaDe('oido', fuentes), null);
assert.equal(textoMeta(metaDe('mazo', fuentes)), '1 guardada');
assert.equal(textoMeta({ tipo: 'nivel', nivel: 23, estrellas: 36 }), 'Nivel 23 · 36 estrellas');
assert.equal(textoMeta({ tipo: 'nivel', nivel: 1, estrellas: 0 }), 'Nivel 1');
assert.equal(textoMeta(null), null);

// Detalle: dos traducciones «iguales» aunque cambien mayúsculas, acentos, puntuación o espacios.
assert.equal(mismoTexto('Me encanta ver a mis seres queridos.', 'Me encanta ver a mis seres queridos'), true, 'un punto final no las distingue');
assert.equal(mismoTexto('¿Qué onda, güey?', 'que onda guey'), true, 'mayúsculas, acentos y signos');
assert.equal(mismoTexto('Así  que   podemos…', 'asi que podemos'), true, 'espacios de más y puntos suspensivos');
assert.equal(mismoTexto('(de neta) va', 'de neta va'), true, 'los paréntesis son puntuación');
assert.equal(mismoTexto('año', 'ano'), false, 'la ñ es otra letra');
assert.equal(mismoTexto('Vamos ya', 'Vamos allá'), false, 'palabras distintas');
assert.equal(mismoTexto('', ''), true);
assert.equal(mismoTexto('', 'a'), false);
const rutaCatalogo = path.join(ROOT, 'assets/data/catalogo.json');
if (fs.existsSync(rutaCatalogo)) {
  const { entries } = JSON.parse(fs.readFileSync(rutaCatalogo, 'utf8'));
  const distintas = entries.filter((e) => !mismoTexto(e.spanish, e.spanish_main)).length;
  const estrictas = entries.filter((e) => e.spanish !== e.spanish_main).length;
  assert.ok(distintas < estrictas, 'la comparación normalizada esconde duplicados que la estricta dejaba pasar');
  assert.ok(distintas > 0, 'y sigue habiendo traducciones distintas que mostrar');
  console.log(`  «Otras formas de traducirla»: ${estrictas} con comparación estricta, ${distintas} con la normalizada (de ${entries.length})`);
}

// Miles con coma y el botón de las atoradas.
assert.equal(miles(1436), '1,436');
assert.equal(miles(0), '0');
assert.equal(miles(999), '999');
assert.equal(miles(1234567), '1,234,567');
assert.equal(etiquetaCorregir(1), 'Corregir 1 error');
assert.equal(etiquetaCorregir(7), 'Corregir 7 errores');

// Progreso: medidor, chips, espectrograma, mundos, juegos y detalle.
assert.equal(P.ratio(0, 0), 0, 'sin total no hay razón');
assert.equal(P.ratio(2000, 1436), 1);
assert.ok(Math.abs(P.ratio(128, 1436) - 0.0891) < 0.001);
assert.equal(P.textoDominadas(128, 1436), 'frases dominadas de 1,436');
assert.equal(P.textoDominadas(1, 1436), 'frase dominada de 1,436');
assert.equal(P.textoVistas(128), '128 vistas');
assert.equal(P.textoVistas(1), '1 vista');
assert.equal(P.etiquetaMedidor(128, 1436, 128), '128 frases dominadas de 1,436, 128 vistas');
assert.equal(P.textoRacha(1), '1 día seguido');
assert.equal(P.textoRacha(4), '4 días seguidos');
assert.equal(P.textoRacha(0), null);
assert.equal(P.textoRecord(1, 4), 'Récord: 4 días');
assert.equal(P.textoRecord(4, 4), 'Récord actual');
assert.equal(P.textoRecord(5, 4), 'Récord actual', 'la racha supera el récord');
assert.equal(P.textoRecord(0, 0), null, 'sin récord no hay chip');
assert.equal(P.textoRecord(1, 1), 'Récord actual');
assert.equal(P.esRecordActual(3, 4), false);

const v = P.ventana([{ dia: '2026-09-25', respuestas: 10, aciertos: 8 }, { dia: '2026-09-05', respuestas: 3, aciertos: 5 }], '2026-09-25');
assert.equal(v.length, 21);
assert.equal(v[0].dia, '2026-09-05');
assert.deepEqual([v[0].respuestas, v[0].aciertos], [3, 3], 'los aciertos no pasan de las respuestas');
assert.equal(v[20].dia, '2026-09-25');
assert.equal(v[10].respuestas, 0, 'un día sin registro entra en cero');
assert.equal(P.ventana([], '2026-10-02')[0].dia, '2026-09-12', 'la ventana cruza el cambio de mes');
assert.equal(P.maximo([]), 1);
assert.equal(P.maximo(v), 10);
assert.equal(P.alturaColumna(0, 10, 96), 0);
assert.equal(P.alturaColumna(10, 10, 96), 96);
assert.equal(P.alturaColumna(25, 100, 96), 48, 'raíz cuadrada: 25 % de las respuestas pesa la mitad');
assert.equal(P.alturaColumna(1, 10000, 96), 3, 'un día con actividad nunca desaparece');
assert.equal(P.inicial('2026-09-21'), 'L');
assert.equal(P.inicial('2026-09-23'), 'M');
assert.equal(P.inicial('2026-09-27'), 'D');
assert.equal(P.etiquetaDia({ dia: '2026-09-15', respuestas: 42, aciertos: 30 }), 'Mar 15 · 42 respuestas · 30 aciertos');
assert.equal(P.etiquetaDia({ dia: '2026-09-15', respuestas: 1, aciertos: 1 }), 'Mar 15 · 1 respuesta · 1 acierto');
assert.equal(P.etiquetaDia({ dia: '2026-09-15', respuestas: 0, aciertos: 0 }), 'Mar 15 · sin práctica');
assert.equal(P.resumenAccesible([{ dia: '2026-09-24', respuestas: 10, aciertos: 8 }, { dia: '2026-09-25', respuestas: 2, aciertos: 1 }]), 'Últimas tres semanas: 2 días con práctica, 12 respuestas, 75 % de aciertos.');
assert.equal(P.resumenAccesible([{ dia: '2026-09-25', respuestas: 1, aciertos: 1 }]), 'Últimas tres semanas: 1 día con práctica, 1 respuesta, 100 % de aciertos.');
assert.equal(P.resumenAccesible(P.ventana([], '2026-09-25')), 'Últimas tres semanas: sin días con práctica.');
assert.deepEqual(P.listaAccesible(P.ventana([{ dia: '2026-09-25', respuestas: 4, aciertos: 3 }], '2026-09-25')), ['Vie 25 · 4 respuestas · 3 aciertos']);

const mundos = [{ id: 'a', nombre: 'A', orden: 1 }, { id: 'b', nombre: 'B', orden: 2 }, { id: 'c', nombre: 'C', orden: 3 }, { id: 'z', nombre: 'Z', orden: 4 }];
const filas = P.filasMundo(mundos, { a: { total: 10, dominadas: 15 }, b: { total: 20, dominadas: 5 }, c: { total: 0, dominadas: 0 }, z: { total: 5, dominadas: 0 } });
assert.deepEqual(filas.map((f) => f.id), ['a', 'b', 'z'], 'ordenados por dominadas; sin frases se omiten; con 0 dominadas se quedan');
assert.equal(filas[0].dominadas, 10, 'las dominadas no pasan del total del filtro');
assert.equal(filas[0].fraccion, 1);
assert.equal(P.filasMundo(mundos, {}).length, 0);
assert.equal(P.textoMundo({ total: 1436, dominadas: 128 }), '128 de 1,436');

const niv = { pares: { jugados: 22, estrellas: 36, siguiente: 23 }, colmena: { jugados: 0, estrellas: 0, siguiente: 1 }, dulces: { jugados: 200, estrellas: 500, siguiente: 201 } };
const rec = { cazala: { partidas: 3, mejor: 12 } };
assert.deepEqual(P.resumenJuego('pares', niv, rec), { tipo: 'nivel', nivel: 23, estrellas: 36, fraccion: 23 / 200 });
assert.deepEqual(P.resumenJuego('colmena', niv, rec), { tipo: 'sinJugar' }, 'abierto con anuncio pero sin jugar');
assert.deepEqual(P.resumenJuego('caida', niv, rec), { tipo: 'sinJugar' });
assert.equal(P.resumenJuego('dulces', niv, rec).nivel, 200, 'el nivel no pasa de 200');
assert.deepEqual(P.resumenJuego('cazala', niv, rec), { tipo: 'partidas', partidas: 3, mejor: 12 }, 'Cázala no tiene niveles: su dato real');
assert.deepEqual(P.resumenJuego('cazala', niv, {}), { tipo: 'sinJugar' });
assert.equal(P.textoJuego(P.resumenJuego('pares', niv, rec)), 'Nivel 23 de 200');
assert.equal(P.textoJuego(P.resumenJuego('cazala', niv, rec)), '3 partidas · mejor 12');
assert.equal(P.textoJuego({ tipo: 'partidas', partidas: 1, mejor: 5 }), '1 partida · mejor 5');
assert.equal(P.textoJuego({ tipo: 'sinJugar' }), 'Sin jugar');
assert.equal(P.precisionPct(0.874), 87);
assert.equal(P.precisionPct(1.2), 100);
assert.equal(P.precisionPct(-1), 0);

console.log('check:practicar ok (127 casos)');
