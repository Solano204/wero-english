const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('mp3', 'wav', 'webp', 'db');

// Carpetas de trabajo que no son de la app: Metro no las vigila ni las resuelve.
const path = require('path');
const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Ruta absoluta con cualquier separador (Windows usa la barra invertida; Linux y macOS, «/»).
const aRegex = (carpeta) =>
  new RegExp(`^${path.join(__dirname, carpeta).split(/[\\/]/).map(escapar).join('[\\\\/]')}([\\\\/].*)?$`);
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  ...['SOUNDS ENGLISH', '.agents', '.claude', 'docs', 'android/app/build', 'ios/build'].map(aRegex),
  /[\\/]\.tmp-[^\\/]*$/,
];

// Node en Windows falla con EMFILE pasadas ~8190 aperturas simultáneas por
// proceso, y no se puede subir. Metro (Assets.js) lee TODOS los assets a la
// vez con fs.promises.readFile: con ~7.9k assets en bundled.ts eso es una
// sola ráfaga de ~7.9k lecturas (medido: pico de 7872) que se come casi todo
// el presupuesto; cualquier otra lectura (caché, fuentes, HMR) lo rebasa.
// Se deja pasar un puñado de lecturas/escrituras a la vez en el proceso
// principal. Son operaciones hoja (no esperan a otras), así que no hay
// riesgo de interbloqueo.
const fs = require('fs');

const MAX_ARCHIVOS_ABIERTOS = 64;
let activas = 0;
const enEspera = [];

async function adquirir() {
  if (activas < MAX_ARCHIVOS_ABIERTOS) {
    activas++;
    return;
  }
  // El que libera le pasa su lugar directo: activas no se mueve.
  await new Promise((resolve) => enEspera.push(resolve));
}

function liberar() {
  const siguiente = enEspera.shift();
  if (siguiente) siguiente();
  else activas--;
}

for (const nombre of ['readFile', 'writeFile']) {
  const original = fs.promises[nombre];
  fs.promises[nombre] = async function (...args) {
    await adquirir();
    try {
      return await original.apply(this, args);
    } finally {
      liberar();
    }
  };
}

// Inline requires: cada import se evalúa donde se usa por primera vez, no al cargar el
// módulo que lo importa. Expo lo trae apagado; prendido, el arranque en frío solo evalúa lo
// que Boot y Practicar tocan de verdad (el resto de cada archivo espera a que se use).
// Los imports solo por efecto (`import 'x'`) no se tocan: siguen corriendo en su lugar.
const transformOriginal = config.transformer.getTransformOptions;
config.transformer.getTransformOptions = async (...args) => {
  const opciones = transformOriginal ? await transformOriginal(...args) : {};
  return {
    ...opciones,
    transform: { ...(opciones.transform ?? {}), inlineRequires: true },
  };
};

module.exports = config;
