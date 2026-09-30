# Play Console: qué contestar

*Uso interno: **no** publicar. Respuestas para Play Console → Contenido de la app. Si la app cambia (anuncios, servidor, analítica), se revisan antes de publicar esa versión.*

## Por qué casi todo es «No»

Play define **recopilar** como *transmitir datos fuera del dispositivo* desde tu app, y **compartir** como mandarlos a un tercero. Los datos que solo se procesan y guardan en el teléfono **no se declaran**. Wero no tiene servidor: el nombre, correo y foto que da Google, y todo el avance, se guardan solo en SQLite en el teléfono y nunca se envían a un servidor propio.

Dos cosas salen del teléfono sin que Wero guarde ni reciba datos: la foto de perfil se carga desde los servidores de Google (una imagen de internet), y los paquetes de audio e imágenes se descargan del servicio de archivos (una descarga sin datos del usuario).

## Seguridad de los datos

| Pregunta | Respuesta |
|---|---|
| ¿Tu app recopila o comparte alguno de los tipos de datos del usuario requeridos? | **No** (ver la nota sobre el micrófono abajo) |
| ¿Todos los datos del usuario que recopila tu app están encriptados en tránsito? | No aplica: no se recopila nada |
| ¿Proporcionas una forma para que los usuarios soliciten que se borren sus datos? | **Sí**: dentro de la app (Ajustes → Cuenta → Eliminar cuenta) y la página web de `docs/ELIMINAR_CUENTA.md` |
| Cuentas | La app permite crear una cuenta (con Google o sin cuenta). Método: **Sign in with Google** (y cuentas locales antiguas con usuario y contraseña) |

### Nota sobre el micrófono (decídelo antes de contestar)

El reconocimiento de voz usa el servicio de voz del teléfono con `requiresOnDeviceRecognition: false` (`src/services/speech.ts`). Según el teléfono, ese servicio puede mandar el audio a los servidores de Google para entenderlo. Wero no recibe ni guarda el audio, pero la app sí lo entrega a un servicio que puede sacarlo del teléfono. Hay dos caminos:

1. **Forzar el reconocimiento en el teléfono** (`requiresOnDeviceRecognition: true`): el audio nunca sale y el «No» de arriba queda exacto. Contra: en teléfonos sin el paquete de idioma sin conexión, esos ejercicios no funcionan.
2. **Dejarlo como está y declararlo**: en «Audio → Grabaciones de voz o sonido»: *Recopilados*: Sí; *Compartidos*: No (Google actúa como proveedor de servicios); *Procesamiento efímero*: Sí; *Obligatorio u opcional*: Opcional; *Finalidad*: Funcionalidad de la app.

Además, los textos de permiso de `app.json` (iOS) dicen hoy que «el audio no sale de tu teléfono». Con la opción 2 eso deja de ser exacto y habría que corregirlos.

## Otras secciones de Contenido de la app

| Sección | Respuesta |
|---|---|
| Política de privacidad | URL de la página publicada a partir de `docs/PRIVACIDAD.md` |
| Anuncios | **No** contiene anuncios (`ANUNCIOS_ACTIVOS = false`). Si se prenden, cambia esta respuesta y la política antes de publicar |
| Eliminación de cuentas | URL de la página publicada a partir de `docs/ELIMINAR_CUENTA.md` |
| Acceso a la app | «Todas las funciones están disponibles sin restricciones de acceso»: se puede entrar sin cuenta |
