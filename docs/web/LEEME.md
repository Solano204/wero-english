# Publicar los textos legales (gratis)

Esta carpeta la genera `npm run legal:generar` a partir de `docs/PRIVACIDAD.md`, `docs/TERMINOS.md` y `docs/ELIMINAR_CUENTA.md`. No edites los `.html` a mano: edita el `.md`, regenera y vuelve a publicar.

Antes de publicar, llena todo lo que dice **[COMPLETAR]** en los `.md` y revisa con un abogado lo que dice **[REVISAR CON ABOGADO]**. `npm run check:legal` te dice cuántos [COMPLETAR] quedan.

Son cuatro páginas estáticas (`index.html`, `privacidad.html`, `terminos.html`, `eliminar-cuenta.html`), sin JavaScript ni servidor.

## Opción A: Netlify Drop (la más rápida, sin cuenta de GitHub pública)

1. Entra a **app.netlify.com/drop** (crea una cuenta gratis si te la pide).
2. Arrastra la carpeta `docs/web` completa a la página.
3. Netlify te da una dirección como `https://nombre-raro.netlify.app`. En **Site configuration → Change site name** ponle algo como `wero-legal` → `https://wero-legal.netlify.app`.
4. Para actualizar: en tu sitio, **Deploys** → arrastra otra vez la carpeta `docs/web`.

## Opción B: GitHub Pages

GitHub Pages gratis solo publica repositorios **públicos** (y solo desde la raíz o desde `/docs`, no desde `/docs/web`). Como el repo de la app es privado, usa un repo aparte:

1. En GitHub crea un repositorio **público** vacío, por ejemplo `wero-legal`.
2. Sube ahí el contenido de `docs/web` (los `.html`, en la raíz del repo).
3. En ese repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)` → **Save**.
4. En uno o dos minutos queda en `https://<tu-usuario>.github.io/wero-legal/`.

## Opción C: tu dominio

Si `wero.app` es tuyo (ya se usa `media.wero.app` para los paquetes), puedes subir la carpeta a `wero.app/legal/` en el mismo servicio de archivos o apuntar un subdominio a Netlify (Netlify → **Domain management → Add a domain**).

## Después de publicar

Ya están publicadas y puestas en `src/config/legal.ts`:

- Privacidad: https://solano204.github.io/wero-legal/privacidad/
- Términos: https://solano204.github.io/wero-legal/terminos/
- Borrar cuenta: https://solano204.github.io/wero-legal/borrar-cuenta/

1. Con esas URLs, cada texto legal de la app muestra el botón «Ver en la web».
2. Google Cloud → Google Auth Platform → **Branding**: enlace a la política de privacidad y a los términos (las dos de arriba).
3. Play Console → Contenido de la app: **Política de privacidad** (la de privacidad) y **Eliminación de cuentas** (la de borrar cuenta).
