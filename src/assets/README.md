# assets

`bundled.ts`: el mapa de medios empaquetados (audio e imágenes), generado por `scripts/build-asset-map.mjs` y fuera de Git.
Se genera, no se edita a mano. Solo lo importa `services/media.ts` (que reexporta `isBundled` y `BUNDLED_COUNT`); los sfx, la música y las fuentes
de la carpeta `assets/` de la raíz se piden con el alias `@assets/`.
