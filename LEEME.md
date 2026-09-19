# Paquete de audio de Wero

Cuatro archivos para generar los 4,220 mp3 con Amazon Polly.

## Qué va dónde

```
wero-app/
├── scripts/polly.mjs          ← copiar aquí
├── assets/medios.json         ← copiar aquí (3.2 MB, el manifiesto)
└── assets/data/catalogo.json  ← REEMPLAZA el tuyo (46 traducciones completadas)
```

`PROMPT_CLAUDE_CODE.md` no va en el repo: es lo que le pegas a Claude Code.

**Respalda tu `catalogo.json` antes de reemplazarlo.**

## Instalación

```bash
npm i -D @aws-sdk/client-polly
```

`polly.mjs` usa sintaxis de módulo y termina en `.mjs`, así que no hace falta
tocar el campo `type` del `package.json`. El repo hoy no lo tiene y los demás
scripts (`verify.mjs`, `check-data.mjs`) funcionan igual.

ffmpeg tiene que estar en el PATH: los 20 audios lentos de Cázala se derivan de
los normales, no se le piden a Polly.

```bash
ffmpeg -version   # si falla:  brew install ffmpeg   /   apt install ffmpeg
```

## Credenciales

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1
```

La región importa. El motor generativo no está en todas; `us-east-1` sí lo
tiene. Si apuntas a otra sin motor generativo, el script se planta **antes** de
gastar un centavo en vez de caerse a una voz peor sin avisarte.

El usuario de IAM solo necesita `polly:SynthesizeSpeech`.

## Scripts opcionales para el package.json

```json
"audio:plan":   "node scripts/polly.mjs --plan",
"audio:prueba": "node scripts/polly.mjs --solo 18 8 1023 1291 1068",
"audio:todo":   "node scripts/polly.mjs --todo",
"audio:revisa": "node scripts/polly.mjs --revisa"
```

## Orden de uso

```bash
node scripts/polly.mjs --plan
# faltan 4220 de 4220 audios
# costo estimado en generative: $3.94

node scripts/polly.mjs --solo 18 8 1023 1291 1068
```

**Párate ahí y escúchalos.** Lo que se revisa con el teléfono en la mano y no
de otra forma: que el español no salga con acento gringo, que el volumen
empareje entre Matthew y Andrés, y cómo lee Polly `y'all`, `finna` y `'em`,
que es donde suele salir raro.

Con eso resuelto:

```bash
node scripts/polly.mjs --grupo "Catálogo EN"
node scripts/polly.mjs --grupo "Catálogo ES"
# ... grupo por grupo
node scripts/polly.mjs --revisa
npm run build:assets
npx expo start -c
```

Es reanudable. Si cortas con Ctrl+C y relanzas el mismo comando, salta lo que
ya está y no lo vuelve a pagar. Los fallos quedan en `.polly-log.json`; basta
con relanzar para reintentarlos.

## Las voces

| Contenido | Voz | Locale |
|---|---|---|
| Inglés del catálogo, fonemas, reglas, errores, cázala | Matthew | en-US |
| Español del catálogo | Andrés | es-MX |
| Narración de las lecturas | Danielle | en-US |

Las tres en motor `generative`. Matthew y Andrés comparten identidad de voz:
las dos mitades de una tarjeta suenan a la misma persona cambiando de idioma.

## Lo que el script NO hace

- **Los 44 fonemas aislados.** Vienen marcados `manual: true` y los salta.
  Ningún TTS pronuncia un fonema suelto: le pides `/iː/` y te lee la letra. Se
  graban o se recortan de la palabra ancla que trae cada fila.
- **Cambiar el código de la app.** Hoy la app espera un audio por entrada
  (`entry.audio`) y ahora hay dos. Eso pide migración de SQLite y tocar tres
  componentes. Está detallado en `PROMPT_CLAUDE_CODE.md`.

## Si algo sale mal

Un mp3 de menos de 3 KB casi nunca es un audio corto: es un fallo silencioso de
la API. El script los rechaza al generarlos y `--revisa` los lista después.
