# Dónde va cada archivo y cómo se llama

Los nombres NO los inventas: ya están escritos dentro de tus JSON. Lo
único que tienes que hacer es generar el archivo con ese nombre exacto.

---

## La estructura completa

```
assets/
├── aud/                          AUDIO
│   ├── 1.mp3 … 1524.mp3            catálogo, uno por entrada
│   ├── rules/
│   │   ├── contraccion_01.mp3 … _120.mp3
│   │   ├── flap_t_01.mp3 … _56.mp3
│   │   ├── fusion_01.mp3 … _44.mp3
│   │   ├── g_perdida_01.mp3 … _40.mp3
│   │   └── aave_01.mp3 … _40.mp3
│   ├── fon/
│   │   ├── fon_001.mp3 … fon_044.mp3        el sonido solo
│   │   ├── fon_001_ej1.mp3 … _ej5.mp3       las 5 palabras
│   │   ├── fon_001_par1a.mp3 / _par1b.mp3   los dos lados del par
│   │   └── …
│   ├── reg/
│   │   └── reg_001_c1_1.mp3 … reg_007_c3_3.mp3
│   ├── err/
│   │   ├── err_001.mp3 … err_194.mp3        la forma correcta
│   │   └── err_156_b.mp3 … err_177_b.mp3    el contraste (solo pronunciación)
│   └── caza/
│       ├── caza_01.mp3 … caza_20.mp3
│       └── caza_01_lento.mp3 … caza_20_lento.mp3
│
└── img/                          IMÁGENES
    ├── 1.webp … 1524.webp          catálogo (unas 1,416, no todas)
    ├── fon/  fon_001.webp … fon_044.webp
    ├── reg/  reg_001.webp … reg_007.webp
    ├── err/  err_001.webp … err_194.webp
    ├── sit/  bar_amigos.webp, chat_trabajo.webp, cena_familiar.webp,
    │         jefe.webp, suegros.webp, doctor.webp, entrevista.webp,
    │         policia.webp
    └── wero/ saludo.webp, pulgar.webp, vacio.webp, racha.webp,
               oido.webp, boca.webp, descarga.webp, sin_red.webp,
               error.webp, lectura.webp, candado.webp
```

---

## De dónde sale cada nombre

| Archivo | Campo del JSON | Lo usa |
|---|---|---|
| `aud/18.mp3` | `entry.audio` | Tarjeta de estudio, modo oído, listas |
| `img/18.webp` | `entry.imagen` | Tarjeta de estudio, ficha P-12 |
| `aud/rules/flap_t_01.mp3` | `entry.palabras_practica[].audio` | P-19 contracciones |
| `aud/fon/fon_002.mp3` | `fonema.audio` | P-10 laboratorio |
| `aud/fon/fon_002_ej1.mp3` | `fonema.ejemplos[].audio` | P-10 |
| `aud/fon/fon_002_par1a.mp3` | `fonema.pares_minimos[].audio_a` | P-10 |
| `img/fon/fon_002.webp` | `fonema.imagen` | P-10 |
| `aud/reg/reg_001_c1_1.mp3` | `regla.casos[].ejemplos[].audio` | P-10 reglas |
| `aud/err/err_001.mp3` | `error.audio` | P-22 detalle |
| `aud/err/err_156_b.mp3` | `error.audio_contraste_archivo` | P-22, solo pronunciación |
| `img/err/err_001.webp` | `error.imagen` | P-22 lista y detalle |
| `aud/caza/caza_01.mp3` | `cazala.audio` | Ejercicio Cázala |
| `aud/caza/caza_01_lento.mp3` | `cazala.audio_lento` | Cázala, tras fallar |
| `img/sit/jefe.webp` | `arquetipo.imagen` | P-08 el juego |

**Los 60 escenarios tienen `imagen: null`** a propósito: usan la del
arquetipo. Puedes lanzar con 8 imágenes de situación en vez de 68.

---

## El formato

**Audio.** mp3, mono, 22050 Hz, unos 48 kbps. Polly ya lo entrega así.
Si grabas tú los 44 fonemas sueltos, exporta con los mismos parámetros
para que no haya saltos de volumen entre uno generado y uno grabado.

**Imágenes.** webp, calidad 80, 640×640 para las de tarjeta y de error,
512×512 para las de fonema y mascota. Apunta a menos de 60 KB por
archivo: con 1,700 imágenes, cada 10 KB de más son 17 MB.

Para convertir un lote de png a webp:

```bash
for f in *.png; do
  cwebp -q 80 -resize 640 640 "$f" -o "${f%.png}.webp"
done
```

---

## Qué se empaqueta y qué se descarga

**En el APK** va solo el pack marcado `empaquetado: true` en packs.json
(`dia_a_dia_reacciones`, 73 entradas) más lo que no pertenece a ningún
pack: fonemas, errores, situaciones, cázala y mascota.

Eso son unos 12 MB y hace que la app funcione completa desde el primer
minuto sin internet.

**Se descarga** el resto de los packs: los otros 16, unos 104 MB. Van a
R2 con esta estructura:

```
r2://wero-media/v1/{pack_id}/
    manifest.json
    aud/{id}.mp3
    img/{id}.webp
```

El `manifest.json` de cada pack lleva la lista de archivos con su tamaño
y su sha256. Eso es lo que permite reanudar una descarga cortada sin
volver a bajar todo.

---

## Cuántos son

| Grupo | Audio | Imagen |
|---|---|---|
| Catálogo | 1,524 | ~1,416 |
| Palabras de práctica | 300 | — |
| Fonemas y sus ejemplos | 587 | 51 |
| Errores | 216 | 194 |
| Cázala | 40 | — |
| Situaciones | — | 8 |
| Mascota | — | 11 |
| **Total** | **2,667** | **1,680** |

De los 2,667 audios, **2,623 los genera Polly gratis**. Los 44 restantes
son los fonemas aislados, que Polly no puede pronunciar: esos los grabas
tú o los recortas de la palabra ancla.

---

## Probar con unos pocos, antes de generar los 2,667

No necesitas todo para ver si funciona. Elige cinco entradas y prueba.

**1.** Abre `assets/data/catalogo.json` y anota cinco ids. Estos cinco
cubren casos distintos y son buena prueba:

| id | Por qué sirve |
|---|---|
| 18 | frase normal con imagen |
| 8 | vulgaridad 2: comprueba el badge y el Modo Limpio |
| 1023 | regla fonética: sin imagen, con palabras de práctica |
| 1291 | frase larga: prueba el ejercicio de completar |
| 1068 | una sola palabra: no debe ofrecer completar |

**2.** Nombra los archivos con el id, sin ceros ni prefijos:

```
assets/aud/18.mp3      assets/img/18.webp
assets/aud/8.mp3       assets/img/8.webp
assets/aud/1023.mp3    (esta no lleva imagen)
```

**3.** Comprueba antes de compilar:

```bash
npm run check:media -- 18 8 1023 1291 1068
```

Te dice cuáles faltan, cuáles sobran por un nombre mal escrito, y cuáles
pesan menos de 3 KB, que casi siempre es un fallo silencioso de la API
que los generó.

**4.** Genera el mapa y arranca:

```bash
npm run build:assets
npx expo start -c
```

Las entradas con archivo suenan y muestran imagen. Las demás siguen
funcionando sin ellos: los botones de audio se ven apagados y donde iría
la imagen queda un rectángulo del mismo tamaño, para que la tarjeta no
salte de altura.

---

## Qué revisar en esa primera prueba

Esto es lo que solo se sabe con el teléfono en la mano:

- **Los glifos IPA.** Si `/ˈwɑːɾər/` sale como cuadritos, necesitas una
  fuente con cobertura fonética en `assets/fonts/`.
- **El volumen.** Si un audio suena más fuerte que otro, normaliza el
  lote antes de generar los 1,524.
- **La velocidad de Polly.** Escucha `y'all`, `finna`, `'em` y las
  contracciones. Ahí es donde suele leer raro.
- **El peso de las imágenes.** Si una webp de 640×640 te sale en 150 KB,
  baja la calidad: con 1,700 imágenes eso son 250 MB.
- **Cuánto tarda en cargar la tarjeta.** Si hay un parpadeo entre la
  imagen y el texto, hay que precargar.

---

## Comandos de medios

```bash
npm run check:media              qué falta y qué sobra
npm run check:media -- 18 22     solo esas entradas
npm run check:media -- --list    la lista completa de faltantes
npm run build:assets             regenera el mapa de empaquetados
```

El `build:assets` hay que correrlo **cada vez** que agregues o quites
archivos de `assets/aud` o `assets/img`. Si se te olvida, los medios
nuevos no se encuentran y parece que el audio no funciona.
