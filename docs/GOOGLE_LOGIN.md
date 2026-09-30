# «Continuar con Google» en Wero

Guía paso a paso para dejar funcionando la entrada con Google en el APK. Se hace una vez; después solo se repite el paso 3c cuando la app exista en Play Console.

## Cómo funciona (en corto)

- La entrada usa **Credential Manager** de Android (`androidx.credentials` + `googleid`): sube desde abajo la hoja nativa con las cuentas de Google del teléfono. **Nunca** abre el navegador ni una pestaña personalizada. No se usa `expo-auth-session`.
- No hay servidor. Google solo dice quién es la persona (su identificador `sub`, correo, nombre y foto). Todo el avance se sigue guardando **solo en el teléfono** (SQLite).
- El código nativo vive en `modules/wero-google-auth` (Kotlin, Expo Modules API). En **Expo Go no existe**: ahí el botón dice «Disponible en la app instalada» y todo lo demás funciona igual.

Para que Google acepte a la app, tiene que reconocer **el paquete** (`app.wero.mobile`) **y la huella SHA-1 de la llave que firmó el APK instalado**. Si falta una sola de las huellas, Google responde `DEVELOPER_ERROR` (código 28444). Eso fue lo que pasó en DARENOW: solo estaba registrada la llave de subida y no la de Play App Signing, así que el APK que baja de Play Store (firmado por Google) no era reconocido.

---

## 1. La llave de subida (upload key)

Es la llave con la que **tú** firmas cada release. La misma llave firma también el APK de pruebas, así su SHA-1 es siempre el mismo.

### 1.1 Crearla (una sola vez)

Usa el `keytool` del **JDK 17**. En PowerShell (ajusta la ruta a donde tengas el JDK 17):

```powershell
mkdir C:\Users\$env:USERNAME\llaves\wero
& "C:\Program Files\Eclipse Adoptium\jdk-17.0.12.7-hotspot\bin\keytool.exe" -genkeypair -v `
  -storetype PKCS12 `
  -keystore C:\Users\$env:USERNAME\llaves\wero\wero-upload.jks `
  -alias wero-upload `
  -keyalg RSA -keysize 2048 -validity 10000
```

Te pide una contraseña (la del almacén; con PKCS12 la de la llave es la misma) y tus datos (nombre, organización, país). Anótala en tu gestor de contraseñas **antes** de seguir.

### 1.2 Dónde guardarla

- **Fuera del repo.** Nunca dentro de `wero-english/` (aunque `keys/` está en `.gitignore`, es mejor no arriesgar).
- **Dos respaldos más**: por ejemplo tu gestor de contraseñas (adjunto) y una memoria USB o nube personal cifrada. Con la contraseña aparte.

**Si la pierdes:**
- **Sin** Play App Signing, no podrías volver a actualizar la app: Play solo acepta actualizaciones firmadas con la misma llave. Tocaría publicar una app nueva con otro paquete.
- **Con** Play App Signing (lo normal hoy, y lo recomendado), Google guarda la llave que firma lo que se instala y tú solo tienes la de subida. Si pierdes la de subida, se puede pedir a soporte de Play que la reemplacen, pero tarda días y pide comprobar que eres el dueño. Trátala como si no hubiera segunda oportunidad.

### 1.3 Decirle a Gradle dónde está (sin meterla al repo)

Abre (o crea) `C:\Users\<tú>\.gradle\gradle.properties` y agrega (con diagonales `/`, también en Windows):

```properties
WERO_UPLOAD_STORE_FILE=C:/Users/<tú>/llaves/wero/wero-upload.jks
WERO_UPLOAD_STORE_PASSWORD=<la contraseña>
WERO_UPLOAD_KEY_ALIAS=wero-upload
WERO_UPLOAD_KEY_PASSWORD=<la contraseña>
```

Ese archivo es tuyo, no del proyecto: Git nunca lo ve. El plugin `plugins/withFirmaRelease.js` hace que el release use esos datos cada vez que se genera `android/` (con `expo prebuild`). Si faltan, el build no truena, pero avisa en la consola: `wero: sin WERO_UPLOAD_STORE_FILE, el release se firma con la llave de DEPURACIÓN`. Un APK así **no** sirve para Google.

---

## 2. Sacar las huellas SHA-1

Necesitas tres. Las tres van en el paso 3.6.

### a) La llave de depuración

La trae la plantilla de Expo en `android/app/debug.keystore` (es la misma en cada `prebuild`). Desde la raíz del proyecto, ya con `android/` generado:

```powershell
& "<JDK 17>\bin\keytool.exe" -list -v -keystore android\app\debug.keystore -alias androiddebugkey -storepass android -keypass android
```

O con Gradle, que lista todas las variantes:

```powershell
cd android
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.12.7-hotspot"
.\gradlew signingReport
```

Busca `Variant: debug` → `SHA1:`.

### b) La llave de subida

```powershell
& "<JDK 17>\bin\keytool.exe" -list -v -keystore C:\Users\<tú>\llaves\wero\wero-upload.jks -alias wero-upload
```

(Con el paso 1.3 hecho, `gradlew signingReport` también la muestra en `Variant: release`.)

### c) La llave de Play App Signing

Cuando la app ya exista en Play Console: **Play Console → tu app → Probar y publicar → Configuración → Integridad de la app → pestaña «Firma de apps»**. Ahí hay dos certificados: el de la **llave de firma de apps** (este es el nuevo que falta registrar) y el de la **llave de subida** (debe coincidir con tu 2b). Copia el SHA-1 del primero.

Hasta que subas la primera versión a Play Console este certificado no existe; los APK que instalas a mano (firmados con tu llave de subida) funcionan con 2a y 2b.

---

## 3. Google Cloud Console

La sección se llama **Google Auth Platform** (antes «Pantalla de consentimiento de OAuth»).

1. **Proyecto.** En https://console.cloud.google.com crea un proyecto «Wero» (o usa el que ya tengas) y déjalo seleccionado arriba.
2. **Google Auth Platform → Descripción general → Comenzar** (solo la primera vez). Nombre de la app: **Wero**; correo de asistencia: el tuyo.
3. **Branding (Desarrollo de la marca).** Nombre «Wero», correo de asistencia, logo (opcional; si lo pones, Google pide verificar la marca antes de mostrarlo) y los enlaces:
   - Página principal de la app.
   - Política de privacidad: la página publicada a partir de `docs/PRIVACIDAD.md`.
   - Condiciones del servicio (opcional).
   - Dominios autorizados: el dominio donde publiques esas páginas.
4. **Público (Audience).** Tipo de usuario **Externo** → **Publicar app** para pasarla a **En producción**. Como solo pide permisos básicos, no hace falta la verificación larga de Google.
5. **Acceso a datos (Data access).** Deja **solo** `openid`, `.../auth/userinfo.email` y `.../auth/userinfo.profile`. Ningún permiso sensible ni restringido.
6. **Clientes → Crear cliente**, cuatro veces:

   | Tipo de aplicación | Nombre (sugerido) | Qué va |
   |---|---|---|
   | **Aplicación web** | Wero · serverClientId | Nada más: sin orígenes ni URIs de redirección. |
   | **Android** | Wero · depuración | Paquete `app.wero.mobile` + SHA-1 del paso 2a |
   | **Android** | Wero · llave de subida | Paquete `app.wero.mobile` + SHA-1 del paso 2b |
   | **Android** | Wero · Play App Signing | Paquete `app.wero.mobile` + SHA-1 del paso 2c (cuando exista) |

   Los clientes Android no se copian a ningún lado: basta con que existan en el mismo proyecto que el cliente web. El que sí se usa en la app es el **ID del cliente web** (termina en `.apps.googleusercontent.com`).

7. **Espera.** Un cliente recién creado puede tardar de unos minutos a unas horas en funcionar. Un `DEVELOPER_ERROR` justo después de crearlo puede ser solo eso.

---

## 4. El ID de cliente en la app

En la raíz del proyecto, copia `.env.example` como `.env` y pon el ID del **cliente web** del paso 3.6:

```properties
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
```

- `.env` está en `.gitignore`: no se sube a Git.
- Expo lo mete en el JavaScript **al empaquetar**, así que el `.env` tiene que existir antes de `gradlew assembleRelease` (o `expo start`). Si cambias el ID, vuelve a generar el APK.
- Un ID de cliente no es un secreto (queda dentro del APK); va en `.env` para que no quede escrito en el código.
- Sin este valor, la app no truena: el botón de Google se comporta como en Expo Go.

---

## 5. Generar el APK de release

Desde la raíz del proyecto, en PowerShell:

```powershell
npx expo prebuild -p android         # genera android/ con el módulo de Google y la firma de release
cd android
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.12.7-hotspot"
.\gradlew assembleRelease
```

El APK queda en `android\app\build\outputs\apk\release\app-release.apk`.

Para confirmar que salió firmado con tu llave de subida (y no con la de depuración):

```powershell
& "<JDK 17>\bin\keytool.exe" -printcert -jarfile app\build\outputs\apk\release\app-release.apk
```

El SHA-1 tiene que ser el del paso 2b.

---

## 6. Si algo falla

| Lo que ves en la app | Lo que suele ser | Qué revisar |
|---|---|---|
| «Google no está listo todavía en esta versión de la app» | `DEVELOPER_ERROR` / 28444: Google no reconoce paquete + SHA-1 | Que exista un cliente Android con `app.wero.mobile` y el SHA-1 **del APK que instalaste** (`keytool -printcert -jarfile`). Instalado desde Play Store → hace falta el 2c. Que el ID del `.env` sea el del cliente **web** del **mismo** proyecto. Que el APK se haya generado después de poner el `.env`. |
| «Este teléfono no tiene ninguna cuenta de Google» | No hay cuentas en el teléfono | Agregar una en Ajustes del sistema → Cuentas. |
| «Sin internet no se puede entrar con Google» | Sin conexión | Conectarse y reintentar. |
| «Disponible en la app instalada» | Estás en Expo Go, o falta el `.env` | Usar el APK; revisar el paso 4. |

En desarrollo (`__DEV__`), el error técnico completo sale en la consola con el prefijo `[auth] Google`.
