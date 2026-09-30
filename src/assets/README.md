# assets

El mapa de medios empaquetados (audio e imágenes), generado por `scripts/build-asset-map.mjs` (`npm run build:assets`)
y fuera de Git: `bundled.ts` sabe qué paquete le toca a cada ruta (por el rango de ids de su pack o por su carpeta) y
`medios/<paquete>.ts` trae los `require()` de ese paquete. Cada módulo de paquete se evalúa la primera vez que se pide
uno de sus medios. Se genera, no se edita a mano.
Solo lo importa `services/media.ts` (que reexporta `isBundled` y `BUNDLED_COUNT`); los sfx, la música y las fuentes
de la carpeta `assets/` de la raíz se piden con el alias `@assets/`.
