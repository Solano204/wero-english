/**
 * Importa los sonidos aislados grabados a mano, les cambia la voz y los
 * mete a la app.
 *
 *   npm run fonemas:importar                     importa
 *   npm run fonemas:importar -- --simular        solo la tabla, no escribe nada
 *   npm run fonemas:importar -- --semitonos 4    más (o menos) cambio de voz
 *
 * Siempre parte de los originales de CARPETA_ORIGEN, que es SOLO LECTURA:
 * se puede correr las veces que haga falta con otro SEMITONOS. Los
 * originales nunca se copian al proyecto; solo entran las versiones
 * procesadas. Lo que se sobrescribe se respalda antes en
 * assets/aud/fon/_respaldo_<AAAAMMDD>/.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ejecuta = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');

// ── constantes configurables ─────────────────────────────────────────────
const CARPETA_ORIGEN = 'C:\\Users\\GAMER\\Documents\\Audacity4';
/** Cuánto sube el tono. Más = voz menos reconocible, pero más artificial. */
const SEMITONOS = 3;
/**
 * rubberband: 'shifted' mueve los formantes junto con el tono (es lo que
 * cambia la identidad de la voz); 'preserved' los deja donde estaban.
 * El respaldo con asetrate siempre los mueve.
 */
const FORMANTE = 'shifted';

const UMBRAL_SILENCIO = '-45dB';
const EXT_AUDIO = /\.(mp3|wav|m4a|flac|ogg)$/i;
const FORMATO_POR_DEFECTO = { sr: 22050, canales: 1, br: 48000 };

/** Archivos cuyo nombre no es un símbolo IPA, pero se sabe cuál es. */
const ALIAS = { 'I CORTA': 'ɪ', 'I LARGA': 'iː', EI: 'eɪ', T: 't' };

const FONEMAS = path.join(ROOT, 'assets/data/fonemas.json');
const MEDIOS = path.join(ROOT, 'assets/medios.json');
const DIR_FON = path.join(ROOT, 'assets/aud/fon');
const LOG = path.join(ROOT, 'scripts/importar-fonemas.log.md');
const GRUPO = 'Fonemas · sonido aislado';
const GRUPO_LENTO = 'Fonemas · sonido aislado · lento';

const args = process.argv.slice(2);
const valorDe = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const SIMULAR = args.includes('--simular');
const semitonos = Number(valorDe('--semitonos') ?? SEMITONOS);
const formante = valorDe('--formante') ?? FORMANTE;
const origen = valorDe('--origen') ?? CARPETA_ORIGEN;

// ── borradores de los fonemas nuevos ─────────────────────────────────────
// Se marcan "borrador": true para que se revisen. La clave es el ipa ya
// normalizado, sin barras.
const BORRADORES = {
  ɚ: {
    tipo: 'vocal_simple', nombre: 'La e con r sin acento', existe_en_espanol: false,
    dificultad: 3, palabra_ancla: 'teacher',
    como_producirlo:
      'Es la vocal débil del final de teacher o water: una schwa que ya viene con la r pegada. La lengua se recoge hacia atrás o hacia arriba sin tocar el paladar, los labios se redondean apenas y todo sale en un solo sonido corto, sin separar la vocal de la r.',
    el_error_tipico:
      'Separas las dos cosas: dices una e y luego una r española, así que teacher suena tichér con la r vibrando al final. En inglés no hay golpe de r: es un solo sonido corto y relajado.',
  },
  ɝ: {
    tipo: 'vocal_simple', nombre: 'La e con r acentuada', existe_en_espanol: false,
    dificultad: 3, palabra_ancla: 'bird',
    como_producirlo:
      'Es la vocal de bird, word o nurse, la misma de la e con r sin acento pero fuerte y larga. La lengua se recoge hacia atrás sin tocar nada, los labios se redondean un poco y la r está desde el principio: no hay una vocal primero y una r después.',
    el_error_tipico:
      'Dices bérd con una e clara y una r española al final. Empieza ya con la lengua recogida: si la punta toca arriba, estás haciendo el sonido del español y no el del inglés.',
  },
  ɑr: {
    tipo: 'vocal_simple', nombre: 'La a con r', existe_en_espanol: false,
    dificultad: 3, palabra_ancla: 'car',
    como_producirlo:
      'Empieza con la a abierta de father, la boca bien abierta y la lengua baja, y a mitad del sonido la lengua se recoge hacia atrás para formar la r. Es un solo movimiento suave, sin cortar entre la a y la r.',
    el_error_tipico:
      'Pones una a española corta y luego una r vibrante, así que car suena kar con erre fuerte. La r inglesa no vibra: la lengua se recoge y no toca nada.',
  },
  ɔr: {
    tipo: 'vocal_simple', nombre: 'La o con r', existe_en_espanol: false,
    dificultad: 3, palabra_ancla: 'door',
    como_producirlo:
      'Empieza con la o redondeada y abierta de thought, los labios en círculo, y termina recogiendo la lengua hacia atrás para la r. Aparece en door, more, four y horse. La o dura un poco más que en español antes de volverse r.',
    el_error_tipico:
      'Dices una o española cerrada y una r vibrante, así que four suena fór con erre marcada. Abre más la boca en la o y deja que la r llegue sola, sin golpe de lengua.',
  },
  ɛr: {
    tipo: 'vocal_simple', nombre: 'La e con r', existe_en_espanol: false,
    dificultad: 3, palabra_ancla: 'air',
    como_producirlo:
      'Empieza con la e abierta de bed, la boca a media altura, y la lengua se va recogiendo hacia atrás para la r. Es el sonido de air, care, where y there. Se dice todo de corrido, con la r ya metida en la vocal.',
    el_error_tipico:
      'Haces una e española y una r vibrante, así que where suena wére con la r golpeada. Aquí la r no vibra: solo colorea la vocal.',
  },
  ɪr: {
    tipo: 'vocal_simple', nombre: 'La i con r', existe_en_espanol: false,
    dificultad: 3, palabra_ancla: 'ear',
    como_producirlo:
      'Empieza con la i corta y relajada de sit y la lengua se recoge hacia atrás para la r, sin llegar a tocar el paladar. Es el sonido de ear, here, near y beer. La vocal es más floja que la i española y se mezcla con la r.',
    el_error_tipico:
      'Dices una i española tensa y una r vibrante, así que here suena jír con erre. La i es corta y relajada, y la r no se marca: se desliza desde la vocal.',
  },
  aɪr: {
    tipo: 'diptongo', nombre: 'La ai con r', existe_en_espanol: false,
    dificultad: 3, palabra_ancla: 'fire',
    como_producirlo:
      'Es el diptongo de five seguido de la r: empieza con la a abierta, sube hacia la i y remata recogiendo la lengua para la r. Aparece en fire, tire, hire y wire. Muchos hablantes lo dicen casi en una sola sílaba.',
    el_error_tipico:
      'Lo separas en tres golpes, fa-i-er, o cierras con una r vibrante. Junta el diptongo y la r en un solo movimiento fluido y deja la r sin vibración.',
  },
  't\u032C': {
    tipo: 'oclusiva', nombre: 'La t suave', existe_en_espanol: true,
    dificultad: 2, palabra_ancla: 'water',
    como_producirlo:
      'Es la t de water, city o better en inglés americano: entre vocales la lengua da un toque rápido y ligero contra la encía, sin soplido, casi como la r suave de pero. Suena más a una d rápida que a una t.',
    el_error_tipico:
      'Pronuncias una t dura con soplido, así que water suena wáter con la t marcada. Entre vocales, relaja la lengua y tócala una sola vez, rápido, como la r de pero.',
  },
  ʔ: {
    tipo: 'oclusiva', nombre: 'La pausa de garganta', existe_en_espanol: false,
    dificultad: 2, palabra_ancla: 'uh-oh',
    como_producirlo:
      'Es un cierre breve de la garganta que corta el aire, como la pausa entre las dos partes de uh-oh. Las cuerdas vocales se cierran un instante y se sueltan. Los hablantes americanos lo usan en palabras como button o en el no de uh-uh.',
    el_error_tipico:
      'No lo notas y sigues de corrido, o metes una consonante en su lugar, así que uh-oh suena uoh. Practica cortando el aire un instante entre las dos sílabas, como si te atoraras un segundo.',
  },
};

// ── JSON que conserva su formato ─────────────────────────────────────────
function leeJson(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const final = raw.endsWith(eol);
  const data = JSON.parse(raw);
  const back = JSON.stringify(data, null, 1).replace(/\n/g, eol) + (final ? eol : '');
  if (back !== raw) throw new Error(`${file}: no se puede reescribir sin reformatearlo`);
  return { data, eol, final, file };
}

function guardaJson({ data, eol, final, file }) {
  fs.writeFileSync(file, JSON.stringify(data, null, 1).replace(/\n/g, eol) + (final ? eol : ''));
}

// ── emparejar archivos con fonemas ───────────────────────────────────────
const canon = (s) =>
  s.normalize('NFC').replace(/\//g, '').replace(/g/g, 'ɡ').replace(/:/g, 'ː').replace(/ɹ/g, 'r').trim();
const sinLargo = (s) => s.replace(/ː/g, '');
const pareceIPA = (s) => !/[\sA-Z0-9_-]/.test(s) && [...s].length <= 5;
const PRIORIDAD = { exacto: 0, alias: 1, 'sin-largo': 2 };

function agrupa(lista, clave) {
  const m = new Map();
  for (const x of lista) m.set(clave(x), [...(m.get(clave(x)) ?? []), x]);
  return m;
}

function clasifica(archivo, porIpa, porBase) {
  const base = archivo.normalize('NFC').replace(EXT_AUDIO, '');
  const alias = ALIAS[base];
  if (!alias && !pareceIPA(base)) {
    return { archivo, base, tipo: 'IGNORADO', nota: 'no parece un símbolo IPA' };
  }
  const ipa = canon(alias ?? base);
  const exactos = porIpa.get(ipa) ?? [];
  if (exactos.length === 1) {
    return { archivo, base, ipa, destino: exactos[0], tipo: alias ? 'alias' : 'exacto' };
  }
  const candidatos = exactos.length ? exactos : porBase.get(sinLargo(ipa)) ?? [];
  if (candidatos.length === 1) {
    return { archivo, base, ipa, destino: candidatos[0], tipo: 'sin-largo' };
  }
  if (candidatos.length > 1) {
    return { archivo, base, ipa, tipo: 'AMBIGUO-saltado', nota: 'varios fonemas posibles' };
  }
  return { archivo, base, ipa, tipo: 'NUEVO' };
}

/** Dos archivos para el mismo destino: gana el de mejor prioridad; un empate se salta. */
function resuelveDuplicados(filas) {
  const porDestino = agrupa(filas.filter((f) => f.destino), (f) => f.destino.id);
  for (const grupo of porDestino.values()) {
    if (grupo.length < 2) continue;
    const mejor = Math.min(...grupo.map((f) => PRIORIDAD[f.tipo]));
    const ganadores = grupo.filter((f) => PRIORIDAD[f.tipo] === mejor);
    for (const f of grupo) {
      if (ganadores.length === 1 && f === ganadores[0]) continue;
      f.tipo = 'AMBIGUO-saltado';
      f.nota = `compite con ${grupo.map((g) => g.archivo).join(' / ')}`;
      f.destino = null;
    }
  }
  const nuevos = agrupa(filas.filter((f) => f.tipo === 'NUEVO'), (f) => f.ipa);
  for (const grupo of nuevos.values()) {
    if (grupo.length < 2) continue;
    for (const f of grupo) Object.assign(f, { tipo: 'AMBIGUO-saltado', nota: 'símbolo repetido' });
  }
}

function asignaIds(filas, fonemas) {
  let siguiente = Math.max(...fonemas.map((f) => Number(f.id.slice(4)))) + 1;
  const nuevos = filas.filter((f) => f.tipo === 'NUEVO').sort((a, b) => a.ipa.localeCompare(b.ipa));
  for (const f of nuevos) f.destino = { id: `fon_${String(siguiente++).padStart(3, '0')}`, ipa: `/${f.ipa}/` };
}

function empareja(archivos, fonemas) {
  const porIpa = agrupa(fonemas, (f) => canon(f.ipa));
  const porBase = agrupa(fonemas, (f) => sinLargo(canon(f.ipa)));
  const filas = archivos.map((a) => clasifica(a, porIpa, porBase));
  resuelveDuplicados(filas);
  asignaIds(filas, fonemas);
  return filas;
}

// ── ffmpeg ───────────────────────────────────────────────────────────────
function leeFactorLento() {
  const fuente = fs.readFileSync(path.join(ROOT, 'scripts/polly.mjs'), 'utf8');
  const m = fuente.match(/const\s+FACTOR_LENTO\s*=\s*([0-9.]+)\s*;/);
  if (!m) throw new Error('no encontré FACTOR_LENTO en scripts/polly.mjs');
  return Number(m[1]);
}

async function tieneRubberband() {
  const { stdout } = await ejecuta('ffmpeg', ['-hide_banner', '-filters']);
  return /\brubberband\b/.test(stdout);
}

async function sondea(file) {
  const { stdout } = await ejecuta('ffprobe', [
    '-v', 'error', '-select_streams', 'a:0',
    '-show_entries', 'stream=sample_rate,channels,bit_rate:format=duration',
    '-of', 'json', file,
  ]);
  const j = JSON.parse(stdout);
  const s = j.streams[0];
  return {
    sr: Number(s.sample_rate),
    canales: Number(s.channels),
    br: Number(s.bit_rate),
    dur: Number(j.format.duration),
  };
}

/** Mismo formato que los mp3 que ya hay (Polly): se toma de uno de fon_021–fon_044. */
async function formatoDestino() {
  for (let n = 21; n <= 44; n++) {
    const f = path.join(DIR_FON, `fon_0${n}.mp3`);
    if (fs.existsSync(f)) {
      const { sr, canales, br } = await sondea(f);
      return { sr, canales, br };
    }
  }
  return FORMATO_POR_DEFECTO;
}

function cadenaFiltros(sr, conRubberband) {
  const f = 2 ** (semitonos / 12);
  const tono = conRubberband
    ? `rubberband=pitch=${f.toFixed(4)}:formant=${formante}`
    : `asetrate=${Math.round(sr * f)},aresample=${sr},atempo=${(1 / f).toFixed(4)}`;
  // El silencio se recorta por los dos extremos (con areverse) y no por
  // silenceremove con stop_periods: eso también borraría las pausas de en
  // medio o cortaría todo lo que sigue a la primera.
  const recorte = `silenceremove=start_periods=1:start_threshold=${UMBRAL_SILENCIO}`;
  return [
    recorte, 'areverse', recorte, 'areverse',
    'afftdn=nf=-25',
    tono,
    'equalizer=f=200:t=q:w=1:g=-4',
    'equalizer=f=1200:t=q:w=1.5:g=2',
    'equalizer=f=3500:t=q:w=1:g=3',
    'equalizer=f=7000:t=q:w=1:g=-3',
    'chorus=0.6:0.8:25:0.25:0.3:2',
    'loudnorm=I=-18:TP=-2:LRA=7',
    'adelay=150|150',
    'apad=pad_dur=0.2',
  ].join(',');
}

const salidaMp3 = (fmt) => [
  '-ar', String(fmt.sr), '-ac', String(fmt.canales), '-b:a', `${Math.round(fmt.br / 1000)}k`,
  '-codec:a', 'libmp3lame', '-map_metadata', '-1',
];

async function picoDeVolumen(file) {
  const { stderr } = await ejecuta('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const m = stderr.match(/max_volume:\s*(-?[0-9.]+|-inf)\s*dB/);
  return m ? Number(m[1]) : -Infinity;
}

/** Procesa un original y su versión lenta en `tmp`. Nunca escribe en el origen. */
async function procesa(entrada, tmp, ctx) {
  const info = await sondea(entrada);
  const normal = path.join(tmp, 'normal.mp3');
  const lento = path.join(tmp, 'lento.mp3');
  await ejecuta('ffmpeg', ['-y', '-v', 'error', '-i', entrada,
    '-af', cadenaFiltros(info.sr, ctx.rubberband), ...salidaMp3(ctx.fmt), normal]);
  const final = await sondea(normal);
  if (final.dur < 0.3 || (await picoDeVolumen(normal)) < -50) {
    throw new Error(`resultado sospechoso (${final.dur.toFixed(2)} s)`);
  }
  await ejecuta('ffmpeg', ['-y', '-v', 'error', '-i', normal,
    '-filter:a', `atempo=${ctx.factorLento}`, ...salidaMp3(ctx.fmt), lento]);
  return { normal, lento, durOrigen: info.dur, durFinal: final.dur };
}

// ── respaldo y escritura ─────────────────────────────────────────────────
function estampa() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function respalda(destinos, carpeta) {
  for (const dest of destinos) {
    if (!fs.existsSync(dest)) continue;
    fs.mkdirSync(carpeta, { recursive: true });
    const copia = path.join(carpeta, path.basename(dest));
    // Nunca se pisa un respaldo: la primera copia del día es la original.
    if (!fs.existsSync(copia)) fs.copyFileSync(dest, copia);
  }
}

function instala(res, id, carpetaRespaldo) {
  const normal = path.join(DIR_FON, `${id}.mp3`);
  const lento = path.join(DIR_FON, `${id}_lento.mp3`);
  if (path.resolve(normal).toLowerCase().startsWith(path.resolve(origen).toLowerCase())) {
    throw new Error('el destino cae dentro de la carpeta de origen');
  }
  respalda([normal, lento], carpetaRespaldo);
  fs.copyFileSync(res.normal, normal);
  fs.copyFileSync(res.lento, lento);
}

// ── actualizar datos ─────────────────────────────────────────────────────
function borradorDe(destino, ipa) {
  const b = BORRADORES[ipa] ?? {
    tipo: 'vocal_simple', nombre: `El sonido ${destino.ipa}`, existe_en_espanol: false,
    dificultad: 3, palabra_ancla: '',
    como_producirlo: 'Pendiente de redactar.', el_error_tipico: 'Pendiente de redactar.',
  };
  return {
    id: destino.id, ipa: destino.ipa, tipo: b.tipo, nombre: b.nombre,
    existe_en_espanol: b.existe_en_espanol, dificultad: b.dificultad,
    como_producirlo: b.como_producirlo, el_error_tipico: b.el_error_tipico,
    ejemplos: [], pares_minimos: [], escena_imagen: null, orden: 0,
    audio: `aud/fon/${destino.id}.mp3`, audio_manual: false,
    audio_lento: `aud/fon/${destino.id}_lento.mp3`, imagen: null,
    palabra_ancla: b.palabra_ancla, borrador: true,
  };
}

function actualizaFonemas(json, hechos) {
  const lista = json.data.fonemas;
  for (const h of hechos) {
    const existente = lista.find((f) => f.id === h.destino.id);
    if (existente) {
      existente.audio_manual = false;
      existente.audio_lento = `aud/fon/${h.destino.id}_lento.mp3`;
    } else {
      lista.push({ ...borradorDe(h.destino, h.ipa), orden: lista.length + 1 });
    }
  }
  json.data.total_fonemas = lista.length;
}

function filaManual(id, ipa, lento) {
  return {
    archivo: `aud/fon/${id}${lento ? '_lento' : ''}.mp3`, tipo: 'audio',
    grupo: lento ? GRUPO_LENTO : GRUPO, recurso: id, texto: ipa.replace(/\//g, ''),
    ...(lento ? { derivado_de: `aud/fon/${id}.mp3` } : {}), manual: true,
  };
}

function actualizaMedios(json, hechos) {
  const filas = json.data;
  const nuevas = { normal: [], lento: [] };
  for (const h of hechos) {
    const { id, ipa } = h.destino;
    for (const lento of [false, true]) {
      const archivo = `aud/fon/${id}${lento ? '_lento' : ''}.mp3`;
      const fila = filas.find((r) => r.archivo === archivo);
      if (fila) fila.manual = true;
      else nuevas[lento ? 'lento' : 'normal'].push(filaManual(id, ipa, lento));
    }
  }
  // Primero el lento, que va después: así no se corren los índices.
  const despuesDe = (grupo) => filas.map((r) => r.grupo).lastIndexOf(grupo) + 1;
  filas.splice(despuesDe(GRUPO_LENTO), 0, ...nuevas.lento);
  filas.splice(despuesDe(GRUPO), 0, ...nuevas.normal);
}

// ── reporte ──────────────────────────────────────────────────────────────
const celda = (f) => (f.destino ? `${f.destino.id} ${f.destino.ipa}` : '—');

function tabla(filas) {
  const lineas = filas.map((f) =>
    `| ${f.archivo} | ${celda(f)} | ${f.tipo}${f.nota ? ` (${f.nota})` : ''} | ${f.resultado ?? ''} |`);
  return ['| archivo | fonema destino | tipo | resultado |', '|---|---|---|---|', ...lineas].join('\n');
}

function imprime(filas) {
  const ancho = Math.max(...filas.map((f) => f.archivo.length));
  console.log(`\n${'archivo'.padEnd(ancho)}  ${'fonema destino'.padEnd(16)} tipo`);
  for (const f of filas) {
    console.log(`${f.archivo.padEnd(ancho)}  ${celda(f).padEnd(16)} ${f.tipo}${f.nota ? ` (${f.nota})` : ''}`);
  }
}

function resumen(filas, fonemas, ctx) {
  const cuenta = (t) => filas.filter((f) => f.tipo === t && f.ok).length;
  const conArchivo = new Set(filas.filter((f) => f.ok && f.destino).map((f) => f.destino.id));
  const sin = fonemas.filter((f) => !conArchivo.has(f.id) && !f.borrador).map((f) => `${f.id} ${f.ipa}`);
  const saltados = filas.filter((f) => f.tipo === 'AMBIGUO-saltado' || f.tipo === 'IGNORADO');
  const errores = filas.filter((f) => f.error);
  return {
    texto: [
      `- Reemplazados: ${filas.filter((f) => f.ok && f.destino && f.tipo !== 'NUEVO').length}`,
      `- Nuevos: ${cuenta('NUEVO')}`,
      `- Saltados (ambiguos o no IPA): ${saltados.length}${saltados.length ? ` → ${saltados.map((f) => f.archivo).join(', ')}` : ''}`,
      `- Fonemas de la app sin grabación en esta corrida: ${sin.length}${sin.length ? ` → ${sin.join(', ')}` : ''}`,
      `- Errores de ffmpeg: ${errores.length}${errores.length ? ` → ${errores.map((f) => `${f.archivo}: ${f.error}`).join('; ')}` : ''}`,
      `- Cambio de tono: ${ctx.rubberband ? `rubberband (pitch + formantes ${formante})` : 'respaldo asetrate/aresample/atempo'}, ${semitonos} semitonos`,
    ].join('\n'),
  };
}

// ── main ─────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(origen)) throw new Error(`no existe la carpeta de origen: ${origen}`);
  if (!Number.isFinite(semitonos)) throw new Error('--semitonos debe ser un número');
  if (!['shifted', 'preserved'].includes(formante)) throw new Error('--formante: shifted o preserved');

  const archivos = fs.readdirSync(origen, { withFileTypes: true })
    .filter((e) => e.isFile() && EXT_AUDIO.test(e.name)).map((e) => e.name)
    .sort((a, b) => a.normalize('NFC').localeCompare(b.normalize('NFC')));
  const fon = leeJson(FONEMAS);
  const med = leeJson(MEDIOS);
  const filas = empareja(archivos, fon.data.fonemas);
  imprime(filas);
  if (SIMULAR) return console.log('\n--simular: no se escribió nada.');

  const ctx = { rubberband: await tieneRubberband(), fmt: await formatoDestino(), factorLento: leeFactorLento() };
  const carpetaRespaldo = path.join(DIR_FON, `_respaldo_${estampa()}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fonemas-'));
  try {
    for (const f of filas.filter((x) => x.destino)) {
      try {
        const res = await procesa(path.join(origen, f.archivo), tmp, ctx);
        instala(res, f.destino.id, carpetaRespaldo);
        f.ok = true;
        f.resultado = `${res.durOrigen.toFixed(2)} s → ${res.durFinal.toFixed(2)} s`;
      } catch (e) {
        f.error = String(e.stderr?.split('\n').filter(Boolean).pop() ?? e.message ?? e);
        f.resultado = `ERROR: ${f.error}`;
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  const hechos = filas.filter((f) => f.ok);
  actualizaFonemas(fon, hechos);
  actualizaMedios(med, hechos);
  guardaJson(fon);
  guardaJson(med);

  const { texto } = resumen(filas, fon.data.fonemas, ctx);
  fs.writeFileSync(LOG, `# Importación de fonemas\n\nOrigen: \`${origen}\`\n\n${tabla(filas)}\n\n## Resumen\n\n${texto}\n`);
  console.log(`\n${texto}\n\nTabla completa en ${path.relative(ROOT, LOG)}`);
}

main().catch((e) => {
  console.error(`\nERROR: ${e.message}`);
  process.exit(1);
});
