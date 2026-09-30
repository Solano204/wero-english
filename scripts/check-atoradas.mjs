/**
 * Prueba lo puro de Mi mazo y Se me atoran:
 *
 *   npm run check:atoradas
 *
 *  - Mi mazo: cuándo un deslizamiento cuenta como «Quitar», y que quitar y deshacer dejan la lista como estaba;
 *  - lo que se puede revisar sin teléfono de las pantallas y de sus piezas (aviso de 5 s, acciones del lector,
 *    reducir movimiento, sin rojo) y que no se toca lo que no debe (el orden, `toggleFavorite`, SM-2).
 *
 * guardadas.ts no importa nada: se transpila en memoria con typescript, sin jest.
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
const existe = (rel) => fs.existsSync(path.join(ROOT, rel));
const cargar = async (rel) => {
  const js = ts.transpileModule(leer(rel), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};
const sinComentarios = (codigo) => codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const G = await cargar('src/domain/guardadas.ts');

let total = 0;
const prueba = async (nombre, fn) => {
  await fn();
  total++;
  console.log(`  ok  ${nombre}`);
};

/* ---------- Mi mazo: el gesto ---------- */

await prueba('quitar: pasa por distancia (96 dp) o por velocidad (800 dp/s), lo que llegue primero; a la derecha regresa', () => {
  assert.equal(G.decidirQuitar(-95, 0), 'volver');
  assert.equal(G.decidirQuitar(-96, 0), 'quitar');
  assert.equal(G.decidirQuitar(-140, -50), 'quitar', 'lento pero lejos');
  assert.equal(G.decidirQuitar(-30, -800), 'quitar', 'corto pero rápido');
  assert.equal(G.decidirQuitar(-30, -799), 'volver');
  assert.equal(G.decidirQuitar(200, 2000), 'volver', 'a la derecha nunca quita');
  assert.equal(G.decidirQuitar(0, 0), 'volver');
});

await prueba('mientras se arrastra: el avance sube a 1 en el umbral, a la derecha es 0 y la derecha solo cede un cuarto', () => {
  assert.equal(G.avanceQuitar(-48), 0.5);
  assert.equal(G.avanceQuitar(-300), 1);
  assert.equal(G.avanceQuitar(40), 0);
  assert.equal(G.avanceQuitar(0), 0);
  assert.equal(G.amortiguarQuitar(-80), -80);
  assert.equal(G.amortiguarQuitar(80), 20);
  assert.equal(G.QUITAR.activa, 12);
  assert.equal(G.QUITAR.falla, 10);
});

/* ---------- Mi mazo: quitar y deshacer ---------- */

const mazo = (n) => Array.from({ length: n }, (_, i) => ({ id: 100 + i, frase: `frase ${i}` }));

await prueba('quitar de la lista: sale solo esa, dice dónde estaba y no modifica la lista de entrada', () => {
  const original = mazo(5);
  const copia = original.map((e) => e.id);
  const r = G.quitarDeLista(original, 102);
  assert.deepEqual(r.lista.map((e) => e.id), [100, 101, 103, 104]);
  assert.equal(r.indice, 2);
  assert.equal(r.elemento.id, 102);
  assert.deepEqual(original.map((e) => e.id), copia, 'la lista original queda igual');
  const noEsta = G.quitarDeLista(original, 999);
  assert.equal(noEsta.indice, -1);
  assert.equal(noEsta.elemento, null);
  assert.deepEqual(noEsta.lista.map((e) => e.id), copia);
});

await prueba('deshacer: quitar y reinsertar deja la lista como estaba, con 2 y con 30 frases y en cualquier lugar', () => {
  for (const n of [1, 2, 30]) {
    const original = mazo(n);
    for (let i = 0; i < n; i++) {
      const { lista, indice, elemento } = G.quitarDeLista(original, original[i].id);
      assert.equal(lista.length, n - 1);
      const vuelta = G.reinsertar(lista, elemento, indice);
      assert.deepEqual(vuelta.map((e) => e.id), original.map((e) => e.id), `n=${n}, i=${i}`);
    }
  }
});

await prueba('reinsertar no duplica, no se sale de la lista y quitar varias seguidas se puede deshacer en orden inverso', () => {
  const l = mazo(4);
  assert.equal(G.reinsertar(l, l[1], 1).length, 4, 'si ya está, no la duplica');
  assert.deepEqual(G.reinsertar(mazo(2), { id: 7 }, 99).map((e) => e.id), [100, 101, 7], 'un lugar de más va al final');
  assert.deepEqual(G.reinsertar(mazo(2), { id: 7 }, -3).map((e) => e.id), [7, 100, 101], 'uno de menos va al principio');
  const a = G.quitarDeLista(l, 101);
  const b = G.quitarDeLista(a.lista, 103);
  const sinB = G.reinsertar(b.lista, b.elemento, b.indice);
  const sinA = G.reinsertar(sinB, a.elemento, a.indice);
  assert.deepEqual(sinA.map((e) => e.id), [100, 101, 102, 103]);
  assert.deepEqual(G.quitarDeLista([], 1), { lista: [], indice: -1, elemento: null }, 'un mazo vacío no se rompe');
});

/* ---------- Mi mazo: lo que no se toca y lo que se puede revisar sin teléfono ---------- */

await prueba('lo que no se toca: `toggleFavorite`, el orden de `getFavorites` y SM-2 quedan como estaban', () => {
  const q = leer('src/data/repos/tarjetas.ts') + leer('src/data/repos/frases.ts');
  assert.match(q, /DO UPDATE SET favorito = 1 - favorito;/, 'toggleFavorite sigue alternando');
  assert.match(q, /WHERE \$\{f\.sql\} AND t\.favorito = 1\s*ORDER BY t\.ultimo_repaso DESC NULLS LAST, e\.id ASC;/, 'el orden de siempre: aún no se guarda la fecha en que se guardó');
  assert.ok(!/guardada_en|fecha_guardado/.test(leer('src/data/esquema.ts')), 'no se agregó ninguna columna');
  const mazoScreen = sinComentarios(leer('src/features/mazo/screens/DeckScreen.tsx'));
  assert.ok(!/upsertCardState|useSessionStore|calificar|Repasar/.test(mazoScreen), 'Mi mazo no toca SM-2 ni ofrece «Repasar»');
});

await prueba('el aviso dura 5 s, «Deshacer» regresa la frase y un fallo de la base la regresa sola', () => {
  const motion = leer('src/theme/motion.ts');
  assert.match(motion, /export const motionAviso = \{ duracion: 5000 \} as const;/);
  assert.match(motion, /export const reacomodarResorte = \(\) =>\s*LinearTransition\.springify\(\)\s*\.damping\(motionSpring\.rebote\.damping\)/, 'las de abajo suben con el resorte de rebote');
  const pantalla = sinComentarios(leer('src/features/mazo/screens/DeckScreen.tsx'));
  assert.match(pantalla, /setTimeout\(\(\) => setAviso\(null\), motionAviso\.duracion\)/);
  assert.match(pantalla, /texto=\{aviso\.tipo === 'quitada' \? 'Quitada de tu mazo'/);
  assert.match(pantalla, /onDeshacer=\{aviso\.tipo === 'quitada' \? deshacer : undefined\}/);
  assert.match(pantalla, /reinsertar\(l \?\? \[\], a\.entry, a\.indice\)/, 'deshacer la regresa a su lugar');
  assert.match(pantalla, /catch \{\s*setLista\(\(l\) => reinsertar\(l \?\? \[\], entry, r\.indice\)\);/, 'si la base falla, la frase vuelve');
  assert.match(pantalla, /itemLayoutAnimation=\{reducido \? undefined : REACOMODO\}/, 'sin resorte con reducir movimiento');
  assert.match(pantalla, /keyExtractor=\{claveEntrada\}/);
  assert.match(pantalla, /<Marcador\b/);
  assert.match(pantalla, /useFocusEffect\(|useCortarAudioAlSalir\(/);
  assert.match(pantalla, /actionLabel="Ir a Frases sueltas"/);
  assert.match(pantalla, /body="Toca la estrella en cualquier frase para guardarla aquí\."/, 'el texto vacío ya dice cómo guardar');
  const aviso = sinComentarios(leer('src/features/mazo/components/AvisoDeshacer.tsx'));
  assert.match(aviso, /label="Deshacer"/);
  assert.match(aviso, /accessibilityLiveRegion="polite"/);
  assert.match(aviso, /\{onDeshacer && !reducido \? \(/, 'sin la barra con reducir movimiento');
  assert.ok(!/riskStrong|tone="strong"/.test(aviso));
});

await prueba('la tarjeta: acciones del lector, karaoke en h3, Inglés · Español, chevron, botón al mantener presionado y deslizar sin rojo', () => {
  const t = sinComentarios(leer('src/features/mazo/components/TarjetaGuardada.tsx'));
  assert.match(t, /export const TarjetaGuardada = memo\(/);
  assert.ok(t.includes("label: 'Quitar de mi mazo'"), 'acción «Quitar de mi mazo»');
  const hook = sinComentarios(leer('src/shared/hooks/useAudioFrase.ts'));
  for (const etiqueta of ['Escuchar en inglés', 'Escuchar en español']) assert.ok(hook.includes(`label: '${etiqueta}'`), etiqueta);
  assert.match(hook, /etiqueta: 'Inglés'/);
  assert.match(hook, /etiqueta: 'Español'/);
  assert.match(t, /useAudioFrase\(entry\)/, 'comparte el audio con Se me atoran');
  assert.match(t, /onAccessibilityAction=\{alAccion\}/);
  assert.match(t, /<FraseKaraoke palabras=\{palabras\} voz=\{vozEn\} tamano="h3"/);
  assert.match(t, /name="chevron-right"/);
  assert.match(t, /onLongPress=\{alMantener\}/, 'mantener presionado muestra el botón');
  assert.match(t, /<Button variant="ghost" icon="star" label="Quitar de mi mazo"/);
  assert.match(t, /<DeslizarQuitar onQuitar=\{quitar\}>/);
  const d = sinComentarios(leer('src/features/mazo/components/DeslizarQuitar.tsx'));
  assert.match(d, /\.activeOffsetX\(\[-QUITAR\.activa, QUITAR\.activa\]\)/);
  assert.match(d, /\.failOffsetY\(\[-QUITAR\.falla, QUITAR\.falla\]\)/, 'cede ante el scroll de la lista');
  assert.match(d, /decidirQuitar\(tx\.value, e\.velocityX\)/);
  assert.match(d, /if \(reducido\) return <>\{children\}<\/>;/, 'con reducir movimiento no hay deslizamiento');
  assert.match(d, /name="star"/, 'la estrella en contorno');
  assert.match(d, /color\.wrongSoft/);
  assert.ok(!/riskStrong|tone="strong"/.test(d));
});

/* ---------- Se me atoran ---------- */

const A = await cargar('src/domain/atoradas.ts');

await prueba('el medidor: cinco puntos, tantos encendidos como fallos con tope en cinco, y el número real debajo', () => {
  assert.equal(A.PUNTOS_ATASCO, 5);
  assert.deepEqual([0, 1, 3, 4, 5, 6, 12].map(A.puntosEncendidos), [0, 1, 3, 4, 5, 5, 5]);
  assert.equal(A.puntosEncendidos(-2), 0);
  assert.equal(A.etiquetaFallos(1), '1 fallo');
  assert.equal(A.etiquetaFallos(4), '4 fallos');
  assert.equal(A.etiquetaFallos(7), '7 fallos', 'pasa del tope de puntos, pero el texto dice el número real');
  assert.equal(A.etiquetaFallos(3), '3 fallos');
});

await prueba('las más atoradas van arriba y más grandes; a igual número, por id; sin modificar la lista', () => {
  assert.equal(A.tamanoAtorada(4), 'normal');
  assert.equal(A.tamanoAtorada(5), 'grande');
  assert.equal(A.tamanoAtorada(9), 'grande');
  const lista = [
    { entry: { id: 9 }, fallos: 3 },
    { entry: { id: 4 }, fallos: 6 },
    { entry: { id: 2 }, fallos: 3 },
    { entry: { id: 7 }, fallos: 5 },
    { entry: { id: 1 }, fallos: 4 },
  ];
  const copia = lista.map((x) => x.entry.id);
  const ordenada = A.ordenarAtoradas(lista);
  assert.deepEqual(ordenada.map((x) => x.entry.id), [4, 7, 1, 2, 9]);
  assert.deepEqual(lista.map((x) => x.entry.id), copia, 'la lista original queda igual');
  for (let i = 1; i < ordenada.length; i++) assert.ok(ordenada[i - 1].fallos >= ordenada[i].fallos);
  assert.deepEqual(A.ordenarAtoradas([]), []);
  assert.deepEqual(A.ordenarAtoradas([lista[0]]).length, 1, 'con una sola');
  const seis = Array.from({ length: 6 }, (_, i) => ({ entry: { id: 10 + i }, fallos: 3 + (i % 4) }));
  const o6 = A.ordenarAtoradas(seis);
  assert.equal(o6.length, 6);
  assert.ok(o6.every((x, i) => i === 0 || o6[i - 1].fallos >= x.fallos), 'con seis');
});

await prueba('qué cuenta como atorada no cambió (fallos >= 3 y no dominada) y la pantalla no toca SM-2', () => {
  const q = leer('src/data/repos/frases.ts');
  assert.match(q, /WHERE t\.fallos >= \? AND t\.dominada = 0\s*ORDER BY t\.fallos DESC LIMIT \?;/);
  assert.match(sinComentarios(leer('src/features/atoradas/screens/StuckScreen.tsx')), /getStuckEntries\(user\.id, 3, 30\)/, 'el mismo umbral de siempre');
  const pantalla = sinComentarios(leer('src/features/atoradas/screens/StuckScreen.tsx'));
  assert.ok(!/upsertCardState|useSessionStore|calificar/.test(pantalla), 'Se me atoran no toca SM-2');
  assert.ok(!/<Button\b[^>]*variant="primary"|Corregir/.test(pantalla), 'sin botón principal: «Corregir N errores» lleva a esta misma pantalla');
  const hoy = leer('src/features/practicar/logic/hoy.ts');
  assert.match(hoy, /if \(atoradas > 0\) return \{ modo: 'atoran', motivo: 'atoradas' \};/, 'hoy.ts manda a esta pantalla');
  assert.match(leer('src/shared/navegacion/modos.ts'), /ir: \(nav\) => nav\.navigate\('Stuck'\),/);
  assert.match(leer('src/domain/consolaHoy.ts'), /return `Corregir \$\{conteo\(atoradas, 'error', 'errores'\)\}`;/, 'el verbo de Hoy es el de siempre');
});

await prueba('la lista y la tarjeta: FlatList estable, memo, nota arriba, audio con texto, medidor que anuncia y vacío en correct', () => {
  const p = sinComentarios(leer('src/features/atoradas/screens/StuckScreen.tsx'));
  assert.match(p, /keyExtractor=\{claveAtorada\}/);
  assert.match(p, /Sin cronómetro ni calificación\. Léelas, escúchalas y ya\./, 'la nota se queda');
  assert.match(p, /ordenarAtoradas\(carga\.datos\?\.atoradas \?\? \[\]\)/);
  assert.match(p, /iconColor=\{color\.correct\}/, 'el vacío lleva el check en correct');
  assert.match(p, /body="Cuando falles la misma frase tres veces, aparecerá aquí para que la repases con calma\."/, 'el texto vacío de siempre');
  assert.match(p, /useFocusEffect\(|useCortarAudioAlSalir\(/);
  const t = sinComentarios(leer('src/features/atoradas/components/TarjetaAtorada.tsx'));
  assert.match(t, /export const TarjetaAtorada = memo\(/);
  assert.match(t, /<GrupoAudio controles=\{controles\}/, 'el grupo Inglés · Español en lugar de los dos plays');
  assert.match(t, /<MedidorAtasco fallos=\{fallos\} tamano=\{tamano\} \/>/, 'el medidor va dentro de la misma tarjeta');
  assert.match(t, /\$\{etiquetaFallos\(fallos\)\}/, 'el lector oye los fallos');
  assert.match(t, /tamano=\{tamano === 'grande' \? 'md' : 'h3'\}/, 'las más atoradas, más grandes');
  const m = sinComentarios(leer('src/features/atoradas/components/MedidorAtasco.tsx'));
  assert.match(m, /accessibilityLabel=\{etiquetaFallos\(fallos\)\}/, 'anuncia «4 fallos»');
  assert.match(m, /encendido: \{ backgroundColor: color\.wrong \}/);
  assert.ok(!/riskStrong|tone="strong"/.test(m + t + p));
});

/* ---------- Se me atoran: las que se desatoraron ---------- */

await prueba('lo guardado en ajustes se normaliza: lo que no sirve se descarta y no hay repetidas', () => {
  assert.deepEqual(A.normalizarVistas(undefined), []);
  assert.deepEqual(A.normalizarVistas('x'), []);
  assert.deepEqual(A.normalizarVistas([{ id: 4, fallos: 3 }, null, 7, { id: 'a', fallos: 2 }, { id: 4, fallos: 9 }, { id: 5, fallos: -1 }, { id: 0, fallos: 3 }, { id: 6, fallos: 2.5 }, { id: 8, fallos: 5 }]), [{ id: 4, fallos: 3 }, { id: 8, fallos: 5 }]);
  assert.match(leer('src/data/repos/ajustes.ts'), /atoradasVistas: \[\],/, 'sin visita previa no hay nada que comparar');
  assert.deepEqual(A.vistasDe([{ entry: { id: 3 }, fallos: 4 }]), [{ id: 3, fallos: 4 }]);
  assert.equal(A.mismasVistas([{ id: 1, fallos: 3 }, { id: 2, fallos: 4 }], [{ id: 2, fallos: 4 }, { id: 1, fallos: 3 }]), true, 'sin importar el orden');
  assert.equal(A.mismasVistas([{ id: 1, fallos: 3 }], [{ id: 1, fallos: 4 }]), false, 'un fallo más ya es un cambio');
  assert.equal(A.mismasVistas([], []), true);
});

await prueba('desatoradas: solo las que la base dice que ya no lo están, las de más fallos primero y hasta 3', () => {
  const previas = [
    { id: 1, fallos: 3 },
    { id: 2, fallos: 6 },
    { id: 3, fallos: 4 },
    { id: 4, fallos: 5 },
    { id: 5, fallos: 3 },
  ];
  // Ahora solo la 5 sigue en la lista de atoradas; las otras cuatro salieron de ella.
  const candidatas = A.candidatasDestrabadas(previas, [5, 9]);
  assert.deepEqual(candidatas.map((c) => c.id), [1, 2, 3, 4]);
  const estados = new Map([
    [1, { fallos: 3, dominada: 1 }],
    [2, { fallos: 6, dominada: 1 }],
    [3, { fallos: 4, dominada: 0 }], // sigue atorada: solo salió por el tope de 30
    [4, { fallos: 5, dominada: 1 }],
  ]);
  assert.deepEqual(A.destrabadas(candidatas, estados).map((d) => d.id), [2, 4, 1], 'más fallos primero y sin la que sigue atorada');
  const muchas = Array.from({ length: 6 }, (_, i) => ({ id: 20 + i, fallos: 3 + (i % 3) }));
  const todasDominadas = new Map(muchas.map((m) => [m.id, { fallos: m.fallos, dominada: 1 }]));
  assert.equal(A.destrabadas(muchas, todasDominadas).length, 3, 'hasta 3 a la vez');
  assert.equal(A.MAX_DESATORADAS, 3);
  assert.deepEqual(A.destrabadas([], new Map()), []);
  assert.deepEqual(A.destrabadas([{ id: 1, fallos: 3 }], new Map()), [], 'sin estado en la base no se muestra');
  assert.deepEqual(A.candidatasDestrabadas([], [1, 2]), [], 'primera visita: nada que comparar');
  assert.deepEqual(A.candidatasDestrabadas(previas, previas.map((p) => p.id)), [], 'si siguen todas, ninguna');
  assert.equal(A.sigueAtorada({ fallos: 3, dominada: 0 }), true);
  assert.equal(A.sigueAtorada({ fallos: 2, dominada: 0 }), false);
  assert.equal(A.sigueAtorada({ fallos: 9, dominada: 1 }), false);
  assert.equal(A.MIN_FALLOS, 3);
});

await prueba('desatorar dura poco y una sola vez: una tarjeta ≤ 2.5 s, tres escalonadas ≤ 4 s, sin bucles ni nada fuera de transform, opacity y su alto final', () => {
  const motion = leer('src/theme/motion.ts');
  const num = (patron) => Number(motion.match(patron)[1]);
  const dur = { rapido: num(/rapido: (\d+),/), base: num(/base: (\d+),/), lento: num(/lento: (\d+),/) };
  const bloque = motion.slice(motion.indexOf('export const motionDesatorar'));
  assert.match(bloque, /entra: motionDuration\.base,\s*punto: motionDuration\.rapido,\s*destello: motionDuration\.lento,\s*pausa: 900,\s*sale: motionDuration\.lento,\s*escalon: 600,\s*mantenerReducido: 2500,/);
  const t = { entra: dur.base, punto: dur.rapido, pausa: 900, sale: dur.lento };
  assert.equal(A.duracionDesatorar(5, t), 220 + 5 * 150 + 900 + 320);
  assert.equal(A.duracionDesatorar(9, t), A.duracionDesatorar(5, t), 'el tope de puntos es cinco');
  for (let p = 0; p <= 5; p++) assert.ok(A.duracionDesatorar(p, t) <= 2500, `${p} puntos`);
  assert.ok(2 * 600 + A.duracionDesatorar(5, t) <= 4000, 'las tres escalonadas');
  const d = sinComentarios(leer('src/features/atoradas/components/Desatorar.tsx'));
  assert.ok(!/withRepeat|skia|Shader/i.test(d), 'una sola vez, sin bucles ni shaders');
  assert.match(d, /if \(reducido\) \{\s*entra\.value = 1;\s*apagado\.value = encendidos;/, 'con reducir movimiento los puntos ya están apagados');
  assert.match(d, /etiqueta\.value = withTiming\(1, \{ duration: motionDuration\.base/, 'la etiqueta aparece con fade');
  assert.match(d, /setTimeout\(terminar, t\.mantenerReducido\)/);
  assert.match(d, /Ya no se te atora/);
  assert.match(d, /height: altoMedido\.value \* \(1 - sale\.value\)/, 'al irse el hueco se cierra: la lista no salta');
  assert.match(d, /color: color\.correct|backgroundColor: color\.correct/, 'el destello y la etiqueta en correct');
  assert.match(d, /accessibilityLabel=\{`\$\{entry\.phrase\}\. Ya no se te atora`\}/);
  assert.ok(!/riskStrong|tone="strong"/.test(d));
  const p = sinComentarios(leer('src/features/atoradas/screens/StuckScreen.tsx'));
  assert.match(p, /guardarAjuste\(user\.id, 'atoradasVistas', actuales\)/, 'guarda la lista de esta visita');
  assert.match(p, /normalizarVistas\(useSettingsStore\.getState\(\)\.atoradasVistas\)/, 'compara con la última visita');
  assert.match(p, /getCardStates\(user\.id, candidatas\.map/, 'le pregunta a la base si de verdad se destrabó');
  assert.match(p, /yaMostradas\.current\.add\(d\.entry\.id\)/, 'se muestran una sola vez');
  assert.match(p, /<Desatorar key=\{d\.entry\.id\}/);
});

console.log(`\ncheck:atoradas ${total} pruebas ok\n`);
