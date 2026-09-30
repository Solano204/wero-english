# Play Console: qué contestar

*Uso interno: **no** publicar. Respuestas para Play Console → Contenido de la app. Si la app cambia (anuncios, servidor, analítica), se revisan antes de publicar esa versión.*

## Por qué casi todo es «No»

Play define **recopilar** como *transmitir datos fuera del dispositivo* desde tu app, y **compartir** como mandarlos a un tercero. Los datos que solo se procesan y guardan en el teléfono **no se declaran**. Wero no tiene servidor: el nombre, correo y foto que da Google, y todo el avance, se guardan solo en SQLite en el teléfono y nunca se envían a un servidor propio.

Dos cosas salen del teléfono sin que Wero guarde ni reciba datos: la foto de perfil se carga desde los servidores de Google (una imagen de internet), y los paquetes de audio e imágenes se descargan del servicio de archivos (una descarga sin datos del usuario).

## Seguridad de los datos

| Pregunta | Respuesta |
|---|---|
| ¿Tu app recopila o comparte alguno de los tipos de datos del usuario requeridos? | **Sí**, solo por el audio del micrófono (ver abajo) |
| ¿Todos los datos del usuario que recopila tu app están encriptados en tránsito? | **Sí** (el audio va cifrado al servicio de voz) |
| ¿Proporcionas una forma para que los usuarios soliciten que se borren sus datos? | **Sí**: dentro de la app (Ajustes, sección Legal: «Borrar cuenta y datos» y «Borrar todos mis datos») y la página web https://solano204.github.io/wero-legal/borrar-cuenta/ (de `docs/ELIMINAR_CUENTA.md`) |
| Cuentas | La app permite crear una cuenta (con Google o sin cuenta). Método: **Sign in with Google** (y cuentas locales antiguas con usuario y contraseña) |

### Micrófono: se declara (el reconocimiento va en el teléfono solo cuando se puede)

`src/services/speech.ts` usa el reconocedor del dispositivo (sin conexión) cuando el teléfono tiene Android 13+ y el paquete de inglés en-US instalado; si no, usa el servicio de voz del sistema, que (normalmente Google) puede mandar el audio a sus servidores. Como en muchos teléfonos será el segundo caso, la app sí puede entregar el audio a un servicio que lo saca del teléfono (Wero no lo recibe ni lo guarda), así que se declara:

- **Audio → Grabaciones de voz o sonido**: *Recopilados*: **Sí**. *Compartidos*: **No** (Google actúa como proveedor de servicios). *Procesamiento efímero*: **Sí**. *Obligatorio u opcional*: **Opcional** (solo «Di la palabra», con su hoja de consentimiento). *Finalidad*: **Funcionalidad de la app**.
- Con eso, a «¿Tu app recopila o comparte alguno de los tipos de datos?» la respuesta es **Sí** (solo por el audio), y a «¿Están encriptados en tránsito?» **Sí** (el servicio de voz de Google usa conexiones cifradas).

Los textos de permiso de `app.json` y la hoja de consentimiento ya dicen esto mismo.

### Registro de errores: no se declara (no sale del teléfono)

Desde el prompt 6 de rendimiento, la app guarda en el teléfono los últimos 50 errores (pantalla, mensaje, pila y fecha;
`src/services/fallas.ts`, en AsyncStorage). **No se manda a ningún servidor**: el usuario puede copiarlo a mano desde
Ajustes → Acerca de → «Copiar reporte de errores» y mandarlo él mismo si soporte se lo pide. Como no se transmite desde
la app, no es «recopilación» para Play ni cambia el aviso de privacidad.

**Si algún día se agrega Sentry, Crashlytics u otro servicio que envíe errores**, antes de publicar esa versión se
actualizan: el aviso de privacidad (`docs/legal/`, que genera `features/cuenta/legal/textos.ts`), esta sección de
Seguridad de los datos («Información y rendimiento de la app → Registros de fallos / Diagnóstico»: recopilados) y la
hoja de consentimiento si hiciera falta.

## Otras secciones de Contenido de la app

| Sección | Respuesta |
|---|---|
| Política de privacidad | https://solano204.github.io/wero-legal/privacidad/ (de `docs/PRIVACIDAD.md`) |
| Anuncios | **No** contiene anuncios (`ANUNCIOS_ACTIVOS = false`). Si se prenden, cambia esta respuesta y la política antes de publicar |
| Eliminación de cuentas | https://solano204.github.io/wero-legal/borrar-cuenta/ (de `docs/ELIMINAR_CUENTA.md`) |
| Acceso a la app | «Todas las funciones están disponibles sin restricciones de acceso»: se puede entrar sin cuenta |
