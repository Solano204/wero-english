/**
 * Firma de release con la llave de subida (upload key) de Wero.
 *
 * `android/` no va en Git (se genera con `expo prebuild`), así que la firma
 * no puede escribirse a mano en `android/app/build.gradle`: se perdería en el
 * siguiente `prebuild --clean`. Este plugin la agrega cada vez que se genera.
 *
 * Los datos de la llave NO están en el repo: Gradle los lee de las
 * propiedades del usuario (`~/.gradle/gradle.properties`; en Windows,
 * `C:\Users\<tú>\.gradle\gradle.properties`):
 *
 *   WERO_UPLOAD_STORE_FILE=C:/ruta/a/wero-upload.jks
 *   WERO_UPLOAD_STORE_PASSWORD=...
 *   WERO_UPLOAD_KEY_ALIAS=wero-upload
 *   WERO_UPLOAD_KEY_PASSWORD=...
 *
 * Sin esas propiedades el release se firma con la llave de depuración (como
 * la plantilla de Expo) y Gradle lo avisa: ese APK NO sirve para Google
 * (su SHA-1 es el de depuración). Ver docs/GOOGLE_LOGIN.md.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARCA = '// wero: firma de release (plugins/withFirmaRelease.js)';

const CONFIG_RELEASE = `
        ${MARCA}
        if (project.hasProperty('WERO_UPLOAD_STORE_FILE')) {
            release {
                storeFile file(project.property('WERO_UPLOAD_STORE_FILE'))
                storePassword project.property('WERO_UPLOAD_STORE_PASSWORD')
                keyAlias project.property('WERO_UPLOAD_KEY_ALIAS')
                keyPassword project.property('WERO_UPLOAD_KEY_PASSWORD')
            }
        }`;

const FIRMA_RELEASE = `if (project.hasProperty('WERO_UPLOAD_STORE_FILE')) {
                signingConfig signingConfigs.release
            } else {
                logger.warn('wero: sin WERO_UPLOAD_STORE_FILE, el release se firma con la llave de DEPURACIÓN. Google no va a reconocer ese APK. Ver docs/GOOGLE_LOGIN.md')
                signingConfig signingConfigs.debug
            }`;

function agregarFirma(gradle) {
  if (gradle.includes(MARCA)) return gradle;

  const conConfig = gradle.replace(/signingConfigs\s*\{/, (m) => `${m}${CONFIG_RELEASE}`);
  if (conConfig === gradle) {
    throw new Error('withFirmaRelease: no se encontró `signingConfigs {` en android/app/build.gradle');
  }

  // Solo la línea de firma del build type `release` DENTRO de `buildTypes { ... }`: ni la de
  // `debug { ... }` ni el `release { ... }` de signingConfigs que se acaba de agregar arriba.
  const release = /(buildTypes\s*\{[\s\S]*?\brelease\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!release.test(conConfig)) {
    throw new Error('withFirmaRelease: no se encontró la firma del bloque release en android/app/build.gradle');
  }
  return conConfig.replace(release, `$1${FIRMA_RELEASE}`);
}

module.exports = function withFirmaRelease(config) {
  return withAppBuildGradle(config, (c) => {
    if (c.modResults.language !== 'groovy') {
      throw new Error('withFirmaRelease: se esperaba android/app/build.gradle en Groovy');
    }
    c.modResults.contents = agregarFirma(c.modResults.contents);
    return c;
  });
};

module.exports.agregarFirma = agregarFirma;
