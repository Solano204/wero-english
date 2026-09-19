# Tarea: generar los 4,220 audios de Wero con Amazon Polly

Pégale esto a Claude Code en la raíz del repo `wero-app`.

---

Trabaja tú solo. **No lances subagentes.** Prefiero que tardes y que cada
archivo quede bien a que se reparta el trabajo y se pierda el control de qué
voz se usó en qué. Ve grupo por grupo y verifica antes de seguir.

## Qué hay ya en el repo

- `assets/medios.json` — el manifiesto. 6,023 filas; las 4,220 de `tipo:
  "audio"` son tu trabajo. Cada fila trae el `archivo` de destino y el `texto`
  exacto a pronunciar.
- `scripts/polly.mjs` — el generador, ya escrito. Es reanudable.
- `assets/data/*.json` — la fuente de verdad del contenido.

**El `texto` del manifiesto es literal.** No lo corrijas, no lo mejores, no le
quites groserías, no lo traduzcas. Si algo se ve raro, para y pregúntame: casi
siempre está así a propósito (`phrase_tts` trae las contracciones ya
desarrolladas para que Polly las pronuncie bien).

## Las voces, que es el punto de todo esto

| Contenido | Voz | Locale | Motor |
|---|---|---|---|
| Inglés del catálogo, fonemas, reglas, errores, cázala | **Matthew** | en-US | generative |
| Español del catálogo | **Andrés** | es-MX | generative |
| Narración de las lecturas | **Danielle** | en-US | generative |

Matthew y Andrés **son la misma identidad de voz** en dos idiomas. Es la
capacidad polyglot del motor generativo de Polly: el inglés suena a
estadounidense nativo y el español suena a mexicano nativo, pero es la misma
persona cambiando de idioma. Eso resuelve el problema que tenía yo pegando
frases a mano: una voz inglesa leyendo español sale con acento gringo.

Nunca uses `standard` ni `neural`. El motor generativo es el más humano que
hay en Polly y la diferencia de costo en este proyecto es de tres dólares.

## Cómo está partido el catálogo

Cada entrada del catálogo genera **dos archivos**:

```
aud/1_en.mp3   Matthew   "Are we gonna slop, bro?"
aud/1_es.mp3   Andrés    "¿Vamos a consumir basura, bro?"
```

Nunca metas las dos mitades en un solo mp3 ni uses `<lang>` para cambiar de
idioma dentro de un archivo. Dos archivos, dos llamadas, dos voces.

## Orden de trabajo

1. `node scripts/polly.mjs --plan` — te dice qué falta y cuánto cuesta. Que no
   sea cero y que la región tenga motor generativo.
2. `node scripts/polly.mjs --solo 18 8 1023 1291 1068` — cinco de prueba.
   **Párate aquí.** Escúchalos tú no puedes, así que pásamelos y espera mi ok
   antes de seguir. Lo que reviso: que el español no suene a gringo, que el
   volumen empareje entre Matthew y Andrés, y cómo lee `y'all`, `finna` y
   `'em`.
3. Con mi ok, grupo por grupo, en este orden:
   `--grupo "Catálogo EN"`, `"Catálogo ES"`, `"Palabras de práctica"`,
   `"Fonemas · ejemplos"`, `"Fonemas · pares mínimos"`,
   `"Reglas de pronunciación"`, `"Tarjetas de error"`,
   `"Tarjetas de error · contraste"`, `"Cázala"`, `"Cázala · lento"`,
   `"Lecturas"`.
4. `node scripts/polly.mjs --revisa` al terminar cada grupo.
5. `npm run build:assets` al final. Sin eso Metro no encuentra nada.

## Cosas que te van a morder

- **Los 44 fonemas aislados no los generes.** Vienen marcados `manual: true`.
  Polly no pronuncia un fonema suelto: le pides `/iː/` y te lee la letra. Esos
  se graban o se recortan de la palabra ancla. El script ya los salta.
- **El audio lento de Cázala no se pide a Polly.** El motor generativo solo da
  soporte parcial a `<prosody>`, así que `rate="slow"` puede salir ignorado sin
  avisar. El script lo deriva del mp3 normal con `ffmpeg atempo=0.72`, que
  conserva el tono. Necesitas ffmpeg instalado.
- **Las lecturas son textos largos.** `SynthesizeSpeech` corta en 3,000
  caracteres facturables. El script parte por oraciones a 2,900 y pega los
  trozos. Revisa que no queden cortes a media frase.
- **Un mp3 de menos de 3 KB casi nunca es un audio corto**, es un fallo
  silencioso de la API. El script los rechaza y `--revisa` los lista.
- **Región.** El motor generativo no está en todas. Usa `us-east-1`. Si
  `AWS_REGION` apunta a otra, el script se planta antes de gastar.

## Lo que falta en el código de la app y tienes que hacer tú

La app hoy espera **un** audio por entrada. Hay que abrirla a dos. Cámbialo
así, y avísame antes de tocar la base de datos:

- `src/types/catalog.ts` — `audio: string` pasa a `audio_en: string` y
  `audio_es: string | null`.
- `src/db/seed.ts` — columna nueva. Es SQLite, así que necesita migración, no
  solo una columna más en el INSERT.
- `src/components/card/PhraseBlock.tsx`, `StudyCardView.tsx`,
  `EntryRow.tsx` — hoy pintan un `AudioButton` con `entry.audio`. Van dos: el
  inglés junto a la frase en inglés, el español junto a la traducción.
- `assets/data/catalogo.json` — hoy `audio` es `"aud/1.mp3"`. Pasa a
  `audio_en: "aud/1_en.mp3"` y `audio_es: "aud/1_es.mp3"`.

Corre `npm run check:data`, `npm run verify` y `npm run check:imports` después
de cada cambio. Los tres pasan en limpio hoy: si uno falla, lo rompiste tú.

## Presupuesto

131,369 caracteres facturables en total, unos **$3.94** a tarifa generative de
$30 por millón. Si tu plan va por encima de $6, algo está mal contado: párate y
dime antes de lanzar.
