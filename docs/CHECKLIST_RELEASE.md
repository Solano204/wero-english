# Antes de subir una versión a Play

En orden. Si un paso falla, no se sigue: se arregla y se vuelve a empezar desde ese paso.

## 1. Verificar (obligatorio)

```bash
npm run verificar
```

Corre typecheck, lint, todos los `check:*` (incluido `check:perf`), la verificación de dominio y la auditoría de
diseño. Tiene que terminar en «verde». No se arma un build con algo en rojo.

## 2. Medios

- `npm run build:assets` y `npm run check:media`: el mapa de medios al día y ningún audio o imagen faltante.
- Si entraron audios o imágenes nuevos: `node scripts/optimiza-audio.mjs` y `node scripts/optimiza-imagenes.mjs`
  (sin `--aplicar` solo reportan; con `--aplicar` los originales van a `medios-originales/`, fuera de Git).

## 3. Versión

En `app.json`:

- [ ] `expo.version` sube (lo que ve el usuario: `1.2.0` → `1.2.1` arreglos, `1.3.0` algo nuevo).
- [ ] `expo.android.versionCode` sube en 1. Play rechaza un AAB con un `versionCode` que ya subiste.

## 4. Build firmado

```bash
npx expo prebuild --platform android   # si cambió app.json o una dependencia nativa
cd android
./gradlew bundleRelease                # AAB para Play
./gradlew assembleRelease              # APK para probar en el teléfono
```

- [ ] Firmado con la llave de subida (`wero-upload.jks`, ver `docs/GOOGLE_LOGIN.md`). La carpeta `keys/` y los
      `.jks` **nunca** entran a Git ni al APK.
- [ ] `npm run presupuesto -- --aab android/app/build/outputs/bundle/release/app-release.aab`: bundle de JS, assets y
      AAB dentro del presupuesto (`scripts/presupuestos.json`).

## 5. Probar el APK release en el Xiaomi

- [ ] **Maestro:** `maestro test e2e` (cómo, en `e2e/LEEME.md`). Las 5 en verde.
- [ ] **Flashlight, los 3 flujos clave** (`docs/RENDIMIENTO.md` → «Flashlight»), en release, con los presupuestos de
      `RENDIMIENTO.md` → «Presupuestos y candados»:
  1. Arranque → Practicar (y scroll de Practicar con la consola a la vista).
  2. Estudio: 10 tarjetas.
  3. Un juego (Colmena) y una lista larga (Errores) con scroll rápido.
- [ ] **Arranque:** `scripts/medir-arranque.sh 5` (release con `EXPO_PUBLIC_MEDIR=1`).
- [ ] **Memoria:** `scripts/medir-memoria.sh resistencia 30` mientras se usa la app 30 min: 0 cierres, sin crecimiento
      sostenido.
- [ ] Ajustes → Acerca de → «Copiar reporte de errores»: que no haya errores nuevos de esta prueba.
- [ ] Iniciar sesión con Google en el APK de Play (firmado por Google) al menos una vez por versión
      (`docs/GOOGLE_LOGIN.md`).

## 6. Play Console

- [ ] Subir el AAB a la pista que toque (prueba interna primero).
- [ ] **Notas de la versión** en español: qué cambió para el usuario, en una o dos frases por punto, en el tono de
      `PRODUCT.md` (sin «increíble», sin signos de exclamación).
- [ ] Si la versión cambia qué datos salen del teléfono (un servicio de errores, analítica, anuncios nuevos): antes de
      publicar, actualizar el aviso de privacidad y Seguridad de los datos (`docs/PLAY_SEGURIDAD_DATOS.md`).
- [ ] Etiquetar el commit publicado: `git tag v<versión> && git push origin v<versión>`.
