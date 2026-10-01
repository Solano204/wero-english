# Pendientes

El código no tiene TODO/FIXME vivos: las coincidencias de «TODO» en `src/` son la palabra en español («corta TODO el
audio»). Lo pendiente de verdad:

## Medición (serie de rendimiento)

- Llenar en `docs/RENDIMIENTO.md` lo que necesita el teléfono: APK/AAB, `am start -W`, cronómetro `[medir]`,
  Flashlight y Profiler.

## Scripts rotos en `package.json`

- `lint` (eslint), `format` (prettier) y `test` (jest) llaman binarios que no están instalados. Decidir si se instalan
  o se quitan los scripts.

## Configuración

- `app.json` pide `userInterfaceStyle: "light"`; en Android eso solo se aplica con `expo-system-ui`, que no está
  instalado (lo señala knip). Hoy la app se ve bien porque todos los fondos son explícitos.
- `assetBundlePatterns` en `app.json` ya no tiene efecto en builds de desarrollo ni de EAS (solo se empaqueta lo que se
  `require`).
- `.claude/skills/` está en `.gitignore`, pero hay archivos suyos ya versionados.
