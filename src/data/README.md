# data

El acceso a datos: `cliente.ts` y `esquema.ts` (SQLite y sus migraciones), `repos/` (un repositorio por tema: tarjetas, frases, niveles, usuarios…), `local/` (AsyncStorage) y `contenido.ts` (los JSON del catálogo).
Solo aquí se escribe SQL. Importa `domain`, `config` y `types`; las pantallas llegan a `data` a través del hook de su feature.
Derivados (`npm run build:derivados`, los revisa `check:data`): `resumenContenido.ts` (conteos y huella del catálogo), `assets/data/catalogo.db` (la tabla `entrada` prearmada con la que se siembra) y `assets/data/cazala_entradas.json`.
