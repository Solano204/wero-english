/**
 * Verificación de la lógica de dominio sin emulador.
 *
 * Reimplementa lo mínimo de SM-2 y del juez para comprobar que las
 * reglas se cumplen. No sustituye probar en el teléfono, pero atrapa
 * los errores de lógica antes de que lleguen ahí.
 */

let pass = 0;
let fail = 0;

function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FALLA ${name} ${extra}`); }
}

const MS_DAY = 86400000;
const EASE_MIN = 1.3, EASE_MAX = 2.8, EASE_START = 2.5;
const LEARN = [1, 10];

function startOfDay(ts) { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }
function clamp(v) { return Math.min(EASE_MAX, Math.max(EASE_MIN, Number(v.toFixed(3)))); }
function delta(g) { return g === 2 ? -0.15 : g === 4 ? 0.1 : 0; }

function review(prev, grade, now) {
  const s = { ...prev, ultimo_repaso: now };
  if (grade === 1) {
    s.fallos++; s.repeticiones = 0; s.intervalo = 0; s.dominada = 0;
    s.facilidad = clamp(prev.facilidad - 0.2);
    s.vence_en = now + LEARN[0] * 60000;
    return { state: s, requeue: true };
  }
  s.aciertos++; s.repeticiones = prev.repeticiones + 1;
  s.facilidad = clamp(prev.facilidad + delta(grade));
  if (s.repeticiones <= LEARN.length) {
    s.intervalo = 0;
    s.vence_en = now + LEARN[s.repeticiones - 1] * 60000;
    return { state: s, requeue: true };
  }
  if (s.repeticiones === LEARN.length + 1) s.intervalo = grade === 4 ? 3 : 1;
  else s.intervalo = Math.max(1, Math.round(prev.intervalo * (grade === 2 ? 1.2 : s.facilidad)));
  s.intervalo = Math.min(s.intervalo, 180);
  s.vence_en = startOfDay(now + s.intervalo * MS_DAY);
  s.dominada = (s.repeticiones >= 4 && s.intervalo >= 21) ? 1 : 0;
  return { state: s, requeue: false };
}

function fresh(id) {
  return { entry_id: id, repeticiones: 0, intervalo: 0, facilidad: EASE_START,
           vence_en: 0, ultimo_repaso: null, fallos: 0, aciertos: 0,
           dominada: 0, favorito: 0 };
}

console.log('\nSM-2');
const now = Date.now();

let s = fresh(1);
let r = review(s, 3, now);
check('primera acertada vuelve en la sesión', r.requeue && r.state.intervalo === 0);

r = review(r.state, 3, now);
check('segunda sigue en pasos de aprendizaje', r.requeue && r.state.repeticiones === 2);

r = review(r.state, 3, now);
check('tercera gradúa a 1 día', !r.requeue && r.state.intervalo === 1, `int=${r.state.intervalo}`);

r = review(r.state, 3, now);
check('cuarta multiplica por facilidad', r.state.intervalo === Math.round(1 * 2.5), `int=${r.state.intervalo}`);

// Fallo tras estar graduada
let g = fresh(2);
for (let i = 0; i < 5; i++) g = review(g, 3, now).state;
const antes = g.intervalo;
const tras = review(g, 1, now);
check('fallar reinicia el intervalo', tras.state.intervalo === 0 && tras.requeue, `antes=${antes}`);
check('fallar baja la facilidad', tras.state.facilidad < g.facilidad);
check('fallar cuenta el fallo', tras.state.fallos === 1);

// Piso de facilidad
let p = fresh(3);
for (let i = 0; i < 40; i++) p = review(p, 1, now).state;
check('la facilidad no baja de 1.3', p.facilidad === EASE_MIN, `ease=${p.facilidad}`);

// Techo de intervalo
let t = fresh(4);
for (let i = 0; i < 40; i++) t = review(t, 4, now).state;
check('el intervalo topa en 180 días', t.intervalo === 180, `int=${t.intervalo}`);
check('la facilidad no sube de 2.8', t.facilidad === EASE_MAX, `ease=${t.facilidad}`);

// Dominada
let d = fresh(5);
for (let i = 0; i < 8; i++) d = review(d, 3, now).state;
check('se marca dominada', d.dominada === 1, `reps=${d.repeticiones} int=${d.intervalo}`);

// vence_en cae en medianoche
check('vence_en es medianoche', d.vence_en === startOfDay(d.vence_en));

console.log('\nJuez del juego');

function isSafe(entry, arq) {
  return entry.vulgaridad <= arq.max_vulgaridad && arq.registros_ok.includes(entry.registro);
}

const bar = { max_vulgaridad: 2, registros_ok: ['formal','neutro','informal','muy_informal'] };
const jefe = { max_vulgaridad: 0, registros_ok: ['formal','neutro'] };
const entrevista = { max_vulgaridad: 0, registros_ok: ['formal'] };

const grosera = { vulgaridad: 2, registro: 'muy_informal' };
const limpia  = { vulgaridad: 0, registro: 'neutro' };
const jergaLimpia = { vulgaridad: 0, registro: 'muy_informal' };
const formal = { vulgaridad: 0, registro: 'formal' };

check('grosera pasa en el bar', isSafe(grosera, bar));
check('grosera NO pasa con el jefe', !isSafe(grosera, jefe));
check('limpia pasa con el jefe', isSafe(limpia, jefe));
check('limpia neutra NO pasa en entrevista', !isSafe(limpia, entrevista));
check('formal pasa en entrevista', isSafe(formal, entrevista));
check('jerga sin groserías NO pasa con el jefe', !isSafe(jergaLimpia, jefe),
      'el registro también manda, no solo la vulgaridad');

console.log('\nTexto');

function norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/['’`]/g,"'").replace(/[^\p{L}\p{N}' ]/gu,'')
    .replace(/\s+/g,' ').trim();
}
function lev(a,b){
  if(a===b)return 0; if(!a.length)return b.length; if(!b.length)return a.length;
  let prev=Array.from({length:b.length+1},(_,i)=>i), cur=new Array(b.length+1);
  for(let i=1;i<=a.length;i++){cur[0]=i;
    for(let j=1;j<=b.length;j++){const c=a[i-1]===b[j-1]?0:1;
      cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+c);}
    [prev,cur]=[cur,prev];}
  return prev[b.length];
}
function close(g,e){const a=norm(g),b=norm(e);
  if(a===b)return true; if(!a.length)return false;
  return lev(a,b) <= Math.max(1, Math.floor(b.length/8));}

check('acepta exacto', close('Road to a million','Road to a million'));
check('acepta sin mayúsculas', close('road to a million','Road to a million'));
check('acepta un typo', close('Road to a milion','Road to a million'));
check('acepta apóstrofe curvo', close("I'm gonna go","I’m gonna go"));
check('rechaza otra frase', !close('Hello there','Road to a million'));
check('rechaza vacío', !close('','Road to a million'));

console.log('\nHuecos');
function blank(phrase, word) {
  return phrase.replace(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i'), '______');
}
check('tapa la palabra', blank('Road to a million','million') === 'Road to a ______');
check('respeta mayúsculas', blank('Million dollar idea','million') === '______ dollar idea');
check('no toca subcadenas', blank('The cat scattered','cat') === 'The ______ scattered');

console.log('\nIntercalado');
function interleave(a,b,every){
  if(!b.length)return[...a]; if(!a.length)return[...b];
  const out=[]; let bi=0;
  for(let i=0;i<a.length;i++){out.push(a[i]);
    if((i+1)%every===0 && bi<b.length) out.push(b[bi++]);}
  while(bi<b.length) out.push(b[bi++]);
  return out;
}
const mix = interleave(['d1','d2','d3','d4','d5','d6','d7','d8'],['n1','n2'],4);
check('nueva cada 4', mix[4]==='n1' && mix[9]==='n2', JSON.stringify(mix));
check('no pierde ninguna', mix.length === 10);

console.log('\nFecha');
function dayKey(ts){const d=new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function parseKey(k){const[y,m,d]=k.split('-').map(Number);
  return new Date(y,m-1,d,12,0,0,0).getTime();}
function between(a,b){return Math.round((parseKey(b)-parseKey(a))/MS_DAY);}

check('mismo día es 0', between('2026-03-15','2026-03-15')===0);
check('día siguiente es 1', between('2026-03-15','2026-03-16')===1);
check('cruza mes', between('2026-01-31','2026-02-01')===1);
check('cruza año', between('2025-12-31','2026-01-01')===1);
check('bisiesto', between('2028-02-28','2028-02-29')===1);
check('cruce de horario de verano', between('2026-04-04','2026-04-06')===2);


/* ==================================================================
   v3: escalera de seis ejercicios, juegos y micrófono
   ================================================================== */

console.log('\nEscalera de ejercicios');

function pickKind(entry, state, hasAudio) {
  const reps = state.repeticiones;
  if (reps === 0) return 'reconocer';
  if (state.fallos >= 3 && state.aciertos < state.fallos) return 'reconocer';
  const puedeConstruir = entry.word_count >= 3;
  const puedeCompletar =
    entry.completar_palabra !== null && entry.completar_distractores.length === 3;
  if (reps <= 2) return hasAudio ? 'escuchar' : 'reconocer';
  if (reps === 3) return puedeConstruir ? 'construir' : (puedeCompletar ? 'completar' : 'reconocer');
  if (reps === 4) return puedeCompletar ? 'completar' : (puedeConstruir ? 'construir' : 'escribir');
  if (reps === 5) return hasAudio ? 'dictado' : 'escribir';
  const pool = ['escribir','escribir'];
  if (hasAudio) pool.push('dictado');
  if (puedeConstruir) pool.push('construir');
  if (puedeCompletar) pool.push('completar');
  if (hasAudio) pool.push('escuchar');
  pool.push('reconocer');
  return pool[(reps + state.aciertos) % pool.length] ?? 'reconocer';
}

const rica = { word_count: 6, completar_palabra: 'million', completar_distractores: ['a','b','c'] };
const pobre = { word_count: 2, completar_palabra: null, completar_distractores: [] };
const st = (reps, fallos = 0, aciertos = 0) => ({ repeticiones: reps, fallos, aciertos });

check('primera vez es reconocer', pickKind(rica, st(0), true) === 'reconocer');
check('segunda es escuchar', pickKind(rica, st(1), true) === 'escuchar');
check('tercera es construir', pickKind(rica, st(3), true) === 'construir');
check('cuarta es completar', pickKind(rica, st(4), true) === 'completar');
check('quinta es dictado', pickKind(rica, st(5), true) === 'dictado');
check('frase de 2 palabras nunca construye',
  pickKind(pobre, st(3), true) !== 'construir', pickKind(pobre, st(3), true));
check('sin audio nunca hay dictado',
  pickKind(rica, st(5), false) === 'escribir');
check('se atora y baja a reconocer',
  pickKind(rica, st(5, 4, 1), true) === 'reconocer');

console.log('\nConstruir');
function splitPhrase(p){ return p.split(/\s+/).map(w=>w.trim()).filter(Boolean); }
function fichasDe(phrase, senuelos){
  const palabras = splitPhrase(phrase);
  const propias = new Set(palabras.map(w=>w.toLowerCase()));
  return [...palabras, ...senuelos.filter(w=>!propias.has(w.toLowerCase())).slice(0,3)];
}
const fichas = fichasDe("I gotta be the normal one", ['gotta','should','very','just']);
check('no repite un señuelo que ya está en la frase', !fichas.slice(6).includes('gotta'));
check('mete tres señuelos', fichas.length === 6 + 3, String(fichas.length));
check('la frase se puede rearmar', splitPhrase("I gotta be the normal one").join(' ') === 'I gotta be the normal one');

console.log('\nColmena');
function colmenaUsable(e){
  const p = (e.completar_palabra || '').trim().toLowerCase().replace(/[^a-z']/g,'');
  if (p.length < 3 || p.length > 9) return false;
  return e.phrase_tts.toLowerCase().includes(p);
}
check('acepta palabra de la frase',
  colmenaUsable({ completar_palabra:'million', phrase_tts:'Road to a million' }));
check('rechaza palabra que no está en la frase',
  !colmenaUsable({ completar_palabra:'billion', phrase_tts:'Road to a million' }));
check('rechaza palabra de dos letras',
  !colmenaUsable({ completar_palabra:'up', phrase_tts:'caked up' }));

function vaBien(objetivo, armado){ return objetivo.startsWith(armado); }
check('prefijo correcto va bien', vaBien('caked','cak'));
check('prefijo equivocado no', !vaBien('caked','cab'));
check('completa detecta el final', 'caked' === 'caked');

console.log('\nPares');
function sonPareja(a,b){
  if (a.id === b.id) return false;
  if (a.lado === b.lado) return false;
  return a.entryId === b.entryId;
}
const fa = { id:'en-1', entryId:1, lado:'en' };
const fb = { id:'es-1', entryId:1, lado:'es' };
const fc = { id:'en-2', entryId:2, lado:'en' };
check('inglés con su español es pareja', sonPareja(fa,fb));
check('dos del mismo lado nunca', !sonPareja(fa,fc));
check('la misma ficha consigo no', !sonPareja(fa,fa));

console.log('\nPares mínimos');
function juzgar(objetivo, confusa, oido){
  if (oido === null || oido.trim() === '') return 'silencio';
  const limpio = norm(oido);
  if (limpio === norm(objetivo) || limpio.split(' ').includes(norm(objetivo))) return 'acierto';
  if (limpio === norm(confusa) || limpio.split(' ').includes(norm(confusa))) return 'confusa';
  return 'otra_cosa';
}
check('oye la palabra buena', juzgar('beach','bitch','Beach') === 'acierto');
check('oye la confusa', juzgar('beach','bitch','bitch') === 'confusa');
check('la encuentra dentro de una frase', juzgar('beach','bitch','the beach please') === 'acierto');
check('no entendió nada', juzgar('beach','bitch','peach tree') === 'otra_cosa');
check('silencio no cuenta como fallo', juzgar('beach','bitch','') === 'silencio');
check('null es silencio', juzgar('beach','bitch',null) === 'silencio');

console.log('\nNotificaciones repartidas');
function toMin(h){ const m=/^(\d{1,2}):(\d{2})$/.exec(h); return m ? Number(m[1])*60+Number(m[2]) : 0; }
function repartir(desde, hasta, n){
  const ini = toMin(desde), fin = toMin(hasta);
  if (fin <= ini + 30 || n === 1) { const m = Math.round((ini+fin)/2); return [m]; }
  const margen = Math.min(30, Math.floor((fin-ini)/(n+1)));
  const a = ini + margen, b = fin - margen, paso = (b-a)/(n-1);
  return Array.from({length:n}, (_,i)=>Math.round(a+paso*i));
}
const cuatro = repartir('09:00','21:00',4);
check('reparte cuatro huecos', cuatro.length === 4, JSON.stringify(cuatro));
check('el primero no cae en el borde', cuatro[0] > toMin('09:00'), String(cuatro[0]));
check('el último no cae en el borde', cuatro[3] < toMin('21:00'), String(cuatro[3]));
check('van en orden', cuatro.every((v,i,a)=>i===0||v>a[i-1]));
check('ventana de una hora da una sola', repartir('09:00','09:20',4).length === 1);
check('una sola cae a media ventana', repartir('09:00','21:00',1)[0] === toMin('15:00'));

console.log('\nMonedas');
const PREMIO = { sesion:10, primera_del_dia:5, juego:5, reto_semanal:20 };
function award(saldo, motivo, mult=1){ return saldo + PREMIO[motivo]*Math.max(1,Math.floor(mult)); }
function spend(saldo, costo){ return saldo >= costo ? saldo - costo : saldo; }
check('la sesión paga 10', award(0,'sesion') === 10);
check('el anuncio multiplica lo ya ganado', award(0,'juego',5) === 25);
check('no se puede gastar de más', spend(2,3) === 2);
check('gastar sí baja el saldo', spend(10,3) === 7);
function coleccion(actual){ return (actual + 1) % 3; }
check('el medidor da vuelta al tercero',
  coleccion(coleccion(coleccion(0))) === 0);


/* ==================================================================
   v3.1: tres en línea, caída y lecturas
   ================================================================== */

console.log('\nTres en línea');

const VACIA = -1;
const B = (cols, rows, cells) => ({ cols, rows, cells });
const ix = (b, f, c) => f * b.cols + c;

function findMatches(b) {
  const m = new Set();
  for (let f = 0; f < b.rows; f++) {
    let ini = 0;
    for (let c = 1; c <= b.cols; c++) {
      const act = c < b.cols ? b.cells[ix(b, f, c)] : VACIA;
      const prev = b.cells[ix(b, f, ini)];
      if (act !== prev || act === VACIA || c === b.cols) {
        if (c - ini >= 3 && prev !== VACIA) {
          for (let k = ini; k < c; k++) m.add(ix(b, f, k));
        }
        ini = c;
      }
    }
  }
  for (let c = 0; c < b.cols; c++) {
    let ini = 0;
    for (let f = 1; f <= b.rows; f++) {
      const act = f < b.rows ? b.cells[ix(b, f, c)] : VACIA;
      const prev = b.cells[ix(b, ini, c)];
      if (act !== prev || act === VACIA || f === b.rows) {
        if (f - ini >= 3 && prev !== VACIA) {
          for (let k = ini; k < f; k++) m.add(ix(b, k, c));
        }
        ini = f;
      }
    }
  }
  return [...m];
}

function collapse(b) {
  for (let c = 0; c < b.cols; c++) {
    let w = b.rows - 1;
    for (let f = b.rows - 1; f >= 0; f--) {
      const v = b.cells[ix(b, f, c)];
      if (v !== VACIA) {
        b.cells[ix(b, w, c)] = v;
        if (w !== f) b.cells[ix(b, f, c)] = VACIA;
        w--;
      }
    }
    for (let f = w; f >= 0; f--) b.cells[ix(b, f, c)] = VACIA;
  }
}

// Tres horizontales en la fila de en medio
const tres = B(3, 3, [0, 1, 2, 5, 5, 5, 2, 1, 0]);
check('encuentra tres en línea horizontal', findMatches(tres).length === 3);

const dos = B(3, 3, [0, 1, 2, 5, 5, 1, 2, 1, 0]);
check('dos no cuentan', findMatches(dos).length === 0);

const vertical = B(3, 3, [7, 1, 2, 7, 5, 1, 7, 1, 0]);
check('encuentra tres vertical', findMatches(vertical).length === 3);

const cuatroEnLinea = B(4, 1, [3, 3, 3, 3]);
check('cuatro seguidas cuentan las cuatro', findMatches(cuatroEnLinea).length === 4);

const cruz = B(3, 3, [1, 4, 1, 4, 4, 4, 1, 4, 1]);
check('una cruz marca las cinco', findMatches(cruz).length === 5, String(findMatches(cruz).length));

const conHuecos = B(1, 4, [VACIA, VACIA, 2, 3]);
check('los huecos no cuentan como línea', findMatches(conHuecos).length === 0);

const gravedad = B(2, 3, [1, 2, VACIA, VACIA, 3, 4]);
collapse(gravedad);
check('la gravedad baja las piezas',
  gravedad.cells[ix(gravedad, 2, 0)] === 3 && gravedad.cells[ix(gravedad, 1, 0)] === 1,
  JSON.stringify(gravedad.cells));
check('arriba quedan huecos', gravedad.cells[ix(gravedad, 0, 0)] === VACIA);

function sonVecinas(b, a, c) {
  const fa = Math.floor(a / b.cols), ca = a % b.cols;
  const fc = Math.floor(c / b.cols), cc = c % b.cols;
  return Math.abs(fa - fc) + Math.abs(ca - cc) === 1;
}
const tab = B(3, 3, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
check('celdas de al lado son vecinas', sonVecinas(tab, 0, 1));
check('en diagonal no son vecinas', !sonVecinas(tab, 0, 4));
check('lejanas no son vecinas', !sonVecinas(tab, 0, 8));

function intercambioValido(b, a, c) {
  if (!sonVecinas(b, a, c)) return false;
  const copia = B(b.cols, b.rows, [...b.cells]);
  const t = copia.cells[a]; copia.cells[a] = copia.cells[c]; copia.cells[c] = t;
  return findMatches(copia).length > 0;
}
// Fila 0: [1,1,9]. Cambiar el 9 de (0,2) por el 1 de (1,2) deja [1,1,1].
const paraSwap = B(3, 3, [1, 1, 9, 2, 2, 1, 3, 3, 8]);
check('un intercambio que arma línea es válido',
  intercambioValido(paraSwap, 2, 5), JSON.stringify(paraSwap.cells));
check('un intercambio que no arma nada es inválido',
  !intercambioValido(B(3, 3, [0, 1, 2, 3, 4, 5, 6, 7, 8]), 0, 1));

console.log('\nDesbloqueo de niveles');
/*
 * La cadena de niveles avanza SOLO con niveles jugados. Un nivel abierto
 * con anuncio deja fila pero con intentos en 0, así que no encadena: si
 * contara, un solo video regalaría dos niveles.
 */
function siguienteNivel(filas) {
  const jugados = filas.filter((f) => f.intentos > 0).map((f) => f.nivel);
  return (jugados.length ? Math.max(...jugados) : 0) + 1;
}
function estaAbierto(n, filas) {
  const pagados = filas.filter((f) => f.intentos === 0).map((f) => f.nivel);
  return n <= siguienteNivel(filas) || pagados.includes(n);
}

const sinJugar = [];
check('sin jugar nada, solo el 1 está abierto',
  estaAbierto(1, sinJugar) && !estaAbierto(2, sinJugar));

const jugoUno = [{ nivel: 1, intentos: 1 }];
check('terminar el 1 abre el 2', estaAbierto(2, jugoUno));
check('terminar el 1 NO abre el 3', !estaAbierto(3, jugoUno));

const pago = [{ nivel: 1, intentos: 1 }, { nivel: 2, intentos: 0 }];
check('el anuncio abre el nivel pagado', estaAbierto(2, pago));
check('el anuncio NO abre el siguiente al pagado', !estaAbierto(3, pago),
  'un video regalaba dos niveles');
check('la cadena no avanza con un nivel pagado',
  siguienteNivel(pago) === 2, String(siguienteNivel(pago)));

const jugoElPagado = [{ nivel: 1, intentos: 1 }, { nivel: 2, intentos: 1 }];
check('al jugarlo sí avanza la cadena', estaAbierto(3, jugoElPagado));

console.log('\nSin repetidos');
function buildSinRepetir(pool, total) {
  const cuantas = Math.min(total, pool.length);
  return pool.slice(0, cuantas);
}
check('una bolsa chica da partida corta, no repetida',
  buildSinRepetir(['a', 'b', 'c'], 10).length === 3);
check('no repite ninguna',
  new Set(buildSinRepetir(['a', 'b', 'c'], 10)).size === 3);
check('con bolsa grande respeta el total',
  buildSinRepetir(['a', 'b', 'c', 'd', 'e'], 3).length === 3);

function siguienteFrase(pool, i) { return pool[i]; }
check('al acabarse la bolsa devuelve nada, no da la vuelta',
  siguienteFrase(['a', 'b'], 2) === undefined);

console.log('\nCaída');
const CAIDA_INICIAL = 5000, CAIDA_MINIMA = 2400, ACELERA = 140;
function duracionPara(r) { return Math.max(CAIDA_MINIMA, CAIDA_INICIAL - r * ACELERA); }
check('la primera dura cinco segundos', duracionPara(0) === 5000);
check('la décima ya es más rápida', duracionPara(10) < duracionPara(0));
check('nunca baja del piso', duracionPara(500) === CAIDA_MINIMA);
check('el piso no es imposible', CAIDA_MINIMA >= 2000);

console.log('\nLecturas');
function partirUno(texto, f) {
  const at = texto.toLowerCase().indexOf(f.phrase.toLowerCase());
  if (at < 0) return [{ texto, entryId: null }];
  return [
    { texto: texto.slice(0, at), entryId: null },
    { texto: texto.slice(at, at + f.phrase.length), entryId: f.id },
    ...partirUno(texto.slice(at + f.phrase.length), f),
  ];
}
function partir(texto, frases) {
  let trozos = [{ texto, entryId: null }];
  for (const f of [...frases].sort((a, b) => b.phrase.length - a.phrase.length)) {
    const sig = [];
    for (const t of trozos) {
      if (t.entryId !== null) { sig.push(t); continue; }
      sig.push(...partirUno(t.texto, f));
    }
    trozos = sig;
  }
  return trozos.filter((t) => t.texto.length > 0);
}

const p1 = partir('I have to draw a line here', [{ id: 305, phrase: 'I have to draw a line' }]);
check('subraya la frase', p1.some((t) => t.entryId === 305));
check('conserva el texto completo', p1.map((t) => t.texto).join('') === 'I have to draw a line here');

const p2 = partir('we could pawn the TV again', [{ id: 271, phrase: 'We could pawn the TV' }]);
check('no le importan las mayúsculas', p2.some((t) => t.entryId === 271));

const p3 = partir('Hello. Hello again.', [{ id: 1, phrase: 'Hello' }]);
check('marca las dos apariciones', p3.filter((t) => t.entryId === 1).length === 2);

const p4 = partir('I have to draw a line', [
  { id: 305, phrase: 'I have to draw a line' },
  { id: 999, phrase: 'a line' },
]);
check('la frase larga gana sobre la corta',
  p4.some((t) => t.entryId === 305) && !p4.some((t) => t.entryId === 999));

function dificultad(frases) {
  let peso = 0, max = 0;
  for (const f of frases) {
    max += f.nivel;
    if (f.dominada) continue;
    peso += f.vista ? 1 : f.nivel;
  }
  return max === 0 ? 0 : Math.round((peso / max) * 100);
}
check('todo dominado da cero',
  dificultad([{ nivel: 2, dominada: true }, { nivel: 3, dominada: true }]) === 0);
check('nada visto da cien',
  dificultad([{ nivel: 2, dominada: false, vista: false }, { nivel: 3, dominada: false, vista: false }]) === 100);
check('lo visto pesa menos que lo nuevo',
  dificultad([{ nivel: 3, dominada: false, vista: true }]) <
  dificultad([{ nivel: 3, dominada: false, vista: false }]));

console.log('\nHora del recordatorio');
function toMin2(h) { const m = /^(\d{1,2}):(\d{2})$/.exec(h); return m ? +m[1] * 60 + +m[2] : 0; }
function horaExacta(hora, min, max) {
  return Math.min(max, Math.max(min, toMin2(hora)));
}
check('respeta la hora que puso el usuario',
  horaExacta('20:00', toMin2('06:00'), toMin2('22:00')) === toMin2('20:00'));
check('recorta una hora fuera de la ventana',
  horaExacta('03:00', toMin2('06:00'), toMin2('22:00')) === toMin2('06:00'));
check('recorta también por arriba',
  horaExacta('23:30', toMin2('06:00'), toMin2('22:00')) === toMin2('22:00'));


console.log('\nNiveles');
import { readFileSync } from 'node:fs';
let niveles = null;
try {
  niveles = JSON.parse(readFileSync(new URL('../assets/data/niveles.json', import.meta.url), 'utf8'));
} catch { /* sin archivo se salta la sección */ }

if (!niveles) {
  console.log('  (falta niveles.json, se salta)');
} else {
  const juegos = Object.keys(niveles.juegos);
  check('hay cuatro juegos con niveles', juegos.length === 4, juegos.join(','));
  check('doscientos niveles por juego',
    juegos.every((j) => niveles.juegos[j].niveles.length === 200));

  let ordenOk = true, tapaOk = true, bandaOk = true, subeOk = true;
  for (const j of juegos) {
    const def = niveles.juegos[j];
    for (const nv of def.niveles) {
      const [a, b, c] = nv.estrellas;
      if (!(a <= b && b <= c)) ordenOk = false;
      const tope = nv.rondas ?? nv.pares ?? nv.frases ?? 0;
      if (c > tope) tapaOk = false;
      if (!def.bandas.some((x) => x.id === nv.banda)) bandaOk = false;
    }
    // La dificultad nunca debe bajar: el nivel 200 no puede ser más
    // fácil que el 1 en ninguna de sus palancas.
    const p = def.niveles[0], u = def.niveles[199];
    if (j === 'caida' && u.caidaInicialMs >= p.caidaInicialMs) subeOk = false;
    if (j === 'pares' && u.pares <= p.pares) subeOk = false;
    if (j === 'colmena' && u.rondas <= p.rondas) subeOk = false;
    if (j === 'dulces' && u.jugadas >= p.jugadas) subeOk = false;
  }
  check('las estrellas van en orden', ordenOk);
  check('tres estrellas nunca piden más de lo que hay', tapaOk);
  check('cada nivel apunta a una banda que existe', bandaOk);
  check('la dificultad sube del nivel 1 al 200', subeOk);

  let bolsasOk = true;
  for (const j of juegos) {
    for (const b of niveles.juegos[j].bandas) {
      if (b.ids.length < 12) bolsasOk = false;
    }
  }
  check('toda banda tiene entradas suficientes', bolsasOk);

  // El reloj es presión, no un muro. Un tiempo imposible no mide si
  // sabes la frase, mide qué tan rápido tienes el pulgar.
  const col = niveles.juegos.colmena.niveles;
  const par = niveles.juegos.pares.niveles;
  check('todas las rondas de Colmena traen reloj',
    col.every((n) => typeof n.segundosRonda === 'number'));
  check('ninguna ronda baja de 20 segundos',
    col.every((n) => n.segundosRonda >= 20),
    String(Math.min(...col.map((n) => n.segundosRonda))));
  check('el reloj de Colmena aprieta con el nivel',
    col[199].segundosRonda < col[0].segundosRonda);
  check('todos los tableros de Pares traen reloj',
    par.every((n) => typeof n.segundosTablero === 'number'));
  check('ningún tablero baja de 60 segundos',
    par.every((n) => n.segundosTablero >= 60));
  check('el tiempo por pareja aprieta con el nivel',
    par[199].segundosTablero / par[199].pares <
      par[0].segundosTablero / par[0].pares);
  check('Dulces no lleva reloj, solo jugadas',
    niveles.juegos.dulces.niveles.every((n) => n.segundosRonda === undefined));
}

function estrellasPara(p, u) {
  if (p >= u[2]) return 3;
  if (p >= u[1]) return 2;
  if (p >= u[0]) return 1;
  return 0;
}
check('el puntaje perfecto da tres', estrellasPara(10, [5, 8, 10]) === 3);
check('la mitad da una', estrellasPara(5, [5, 8, 10]) === 1);
check('menos de la mitad da cero', estrellasPara(4, [5, 8, 10]) === 0);
check('cero estrellas no abre el siguiente', estrellasPara(0, [5, 8, 10]) < 1);

console.log(`\n${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
