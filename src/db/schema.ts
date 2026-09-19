/**
 * Esquema SQLite. Se aplica en orden por número de versión, así que
 * NUNCA edites una migración ya publicada: agrega una nueva al final.
 */

export const SCHEMA_VERSION = 6;

export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
    /* ---------- catálogo, sembrado desde JSON ---------- */
    CREATE TABLE IF NOT EXISTS entrada (
      id                     INTEGER PRIMARY KEY,
      phrase                 TEXT    NOT NULL,
      phrase_tts             TEXT    NOT NULL,
      phrase_alt             TEXT,
      ipa                    TEXT    NOT NULL,
      ipa_note               TEXT,
      spanish                TEXT    NOT NULL,
      spanish_main           TEXT    NOT NULL,
      es_neutro              TEXT    NOT NULL,
      note                   TEXT,
      topic                  TEXT    NOT NULL,
      block                  TEXT    NOT NULL,
      volume                 INTEGER NOT NULL,
      tipo                   TEXT    NOT NULL,
      nivel                  INTEGER NOT NULL,
      vigencia               TEXT    NOT NULL,
      registro               TEXT    NOT NULL,
      tiempo_verbal          TEXT    NOT NULL,
      word_count             INTEGER NOT NULL,
      vulgaridad             INTEGER NOT NULL,
      vulgaridad_en          INTEGER NOT NULL,
      vulgaridad_es          INTEGER NOT NULL,
      vulgar_marks           TEXT    NOT NULL DEFAULT '[]',
      no_usar_cuando         TEXT,
      pack_id                TEXT    NOT NULL,
      mundo                  TEXT    NOT NULL,
      pack_final             TEXT    NOT NULL,
      duplicate_of           INTEGER,
      is_canonical           INTEGER NOT NULL DEFAULT 1,
      revisar                INTEGER NOT NULL DEFAULT 0,
      escena_imagen          TEXT,
      completar_palabra      TEXT,
      completar_distractores TEXT    NOT NULL DEFAULT '[]',
      regla_grupo            TEXT,
      palabras_practica      TEXT    NOT NULL DEFAULT '[]',
      audio                  TEXT,
      imagen                 TEXT
    );

    /* El orden de estos índices importa: son las consultas del camino caliente. */
    CREATE INDEX IF NOT EXISTS ix_entrada_pack   ON entrada(pack_final);
    CREATE INDEX IF NOT EXISTS ix_entrada_mundo  ON entrada(mundo);
    CREATE INDEX IF NOT EXISTS ix_entrada_nivel  ON entrada(nivel);
    CREATE INDEX IF NOT EXISTS ix_entrada_vulg   ON entrada(vulgaridad);
    CREATE INDEX IF NOT EXISTS ix_entrada_grupo  ON entrada(regla_grupo);
    CREATE INDEX IF NOT EXISTS ix_entrada_tiempo ON entrada(tiempo_verbal);

    /* ---------- usuarios locales ---------- */
    CREATE TABLE IF NOT EXISTS usuario (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT    NOT NULL UNIQUE,
      pass_hash    TEXT    NOT NULL,
      pass_salt    TEXT    NOT NULL,
      created_at   INTEGER NOT NULL,
      last_login   INTEGER
    );

    /* ---------- estado SM-2 por usuario y entrada ---------- */
    CREATE TABLE IF NOT EXISTS tarjeta (
      usuario_id    INTEGER NOT NULL,
      entry_id      INTEGER NOT NULL,
      repeticiones  INTEGER NOT NULL DEFAULT 0,
      intervalo     INTEGER NOT NULL DEFAULT 0,
      facilidad     REAL    NOT NULL DEFAULT 2.5,
      vence_en      INTEGER NOT NULL DEFAULT 0,
      ultimo_repaso INTEGER,
      fallos        INTEGER NOT NULL DEFAULT 0,
      aciertos      INTEGER NOT NULL DEFAULT 0,
      dominada      INTEGER NOT NULL DEFAULT 0,
      favorito      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (usuario_id, entry_id),
      FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE,
      FOREIGN KEY (entry_id)   REFERENCES entrada(id)  ON DELETE CASCADE
    );

    /* La cola del día es un rango sobre vence_en: sin este índice
       la consulta escanea las 1524 filas en cada arranque. */
    CREATE INDEX IF NOT EXISTS ix_tarjeta_cola
      ON tarjeta(usuario_id, vence_en);
    CREATE INDEX IF NOT EXISTS ix_tarjeta_fav
      ON tarjeta(usuario_id, favorito);
    CREATE INDEX IF NOT EXISTS ix_tarjeta_fallos
      ON tarjeta(usuario_id, fallos DESC);

    /* ---------- progreso general ---------- */
    CREATE TABLE IF NOT EXISTS progreso (
      usuario_id      INTEGER PRIMARY KEY,
      racha           INTEGER NOT NULL DEFAULT 0,
      racha_max       INTEGER NOT NULL DEFAULT 0,
      ultimo_dia      TEXT,
      total_sesiones  INTEGER NOT NULL DEFAULT 0,
      total_respuestas INTEGER NOT NULL DEFAULT 0,
      total_aciertos  INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
    );

    /* ---------- ajustes por usuario ---------- */
    CREATE TABLE IF NOT EXISTS ajuste (
      usuario_id INTEGER NOT NULL,
      clave      TEXT    NOT NULL,
      valor      TEXT    NOT NULL,
      PRIMARY KEY (usuario_id, clave),
      FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
    );

    /* ---------- packs descargados ---------- */
    CREATE TABLE IF NOT EXISTS pack_estado (
      usuario_id  INTEGER NOT NULL,
      pack_id     TEXT    NOT NULL,
      descargado  INTEGER NOT NULL DEFAULT 0,
      activo      INTEGER NOT NULL DEFAULT 0,
      bytes       INTEGER NOT NULL DEFAULT 0,
      version     INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (usuario_id, pack_id)
    );

    /* ---------- historial de sesiones, para P-13 ---------- */
    CREATE TABLE IF NOT EXISTS sesion (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id  INTEGER NOT NULL,
      dia         TEXT    NOT NULL,
      inicio      INTEGER NOT NULL,
      fin         INTEGER,
      respuestas  INTEGER NOT NULL DEFAULT 0,
      aciertos    INTEGER NOT NULL DEFAULT 0,
      nuevas      INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS ix_sesion_dia ON sesion(usuario_id, dia);

    /* ---------- notificaciones ya mandadas, para no repetir ---------- */
    CREATE TABLE IF NOT EXISTS notif_log (
      usuario_id  INTEGER NOT NULL,
      plantilla   TEXT    NOT NULL,
      entry_id    INTEGER,
      enviado_en  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_notif_log
      ON notif_log(usuario_id, enviado_en DESC);

    /* ---------- progreso de los módulos extra ---------- */
    CREATE TABLE IF NOT EXISTS extra_visto (
      usuario_id INTEGER NOT NULL,
      modulo     TEXT    NOT NULL,
      item_id    TEXT    NOT NULL,
      visto_en   INTEGER NOT NULL,
      PRIMARY KEY (usuario_id, modulo, item_id)
    );
    `,
  },

  /* ------------------------------------------------------------------
     v2 - Arcade, monedas y micrófono.

     Nada de esta migración toca una tabla existente: solo agrega tres.
     Un usuario que ya tenía la v1 instalada conserva su progreso, sus
     favoritos y su racha intactos, y arranca la v2 con la cartera en
     cero. Por eso se agrega como migración nueva y no se edita la 1.
     ------------------------------------------------------------------ */
  {
    version: 2,
    sql: `
    /* ---------- monedas y colección ----------
       El saldo nunca baja salvo al gastar una pista, y las monedas no
       se compran ni desbloquean contenido: eso es una regla del
       producto, y por eso no hay columna de compras ni de caducidad. */
    CREATE TABLE IF NOT EXISTS cartera (
      usuario_id      INTEGER PRIMARY KEY,
      saldo           INTEGER NOT NULL DEFAULT 0,
      ganadas         INTEGER NOT NULL DEFAULT 0,
      gastadas        INTEGER NOT NULL DEFAULT 0,
      coleccion       INTEGER NOT NULL DEFAULT 0,
      cosmeticos      TEXT    NOT NULL DEFAULT '[]',
      cosmetico_activo TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
    );

    /* ---------- una fila por partida terminada ----------
       Guarda partidas, no rachas ni ligas: el mejor puntaje que se
       muestra en el arcade es del propio usuario contra sí mismo. */
    CREATE TABLE IF NOT EXISTS juego_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      juego      TEXT    NOT NULL,
      dia        TEXT    NOT NULL,
      rondas     INTEGER NOT NULL DEFAULT 0,
      aciertos   INTEGER NOT NULL DEFAULT 0,
      jugado_en  INTEGER NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS ix_juego_mejor
      ON juego_log(usuario_id, juego, aciertos DESC);
    CREATE INDEX IF NOT EXISTS ix_juego_dia
      ON juego_log(usuario_id, dia);

    /* ---------- intentos de pronunciación ----------
       Se guarda lo que el reconocedor oyó, no el audio. El audio nunca
       sale del teléfono y nunca se escribe en disco. */
    CREATE TABLE IF NOT EXISTS habla_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      par_id     TEXT    NOT NULL,
      objetivo   TEXT    NOT NULL,
      oido       TEXT,
      acierto    INTEGER NOT NULL DEFAULT 0,
      creado_en  INTEGER NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS ix_habla_par
      ON habla_log(usuario_id, par_id);
    `,
  },

  /* ------------------------------------------------------------------
     v3 - Niveles de los juegos.

     Una fila por nivel jugado, no por nivel existente: con 800 niveles
     y una fila prellenada por cada uno, cada usuario nuevo arrancaría
     escribiendo 800 filas antes de ver la primera pantalla. Un nivel
     sin fila es un nivel sin jugar.
     ------------------------------------------------------------------ */
  {
    version: 3,
    sql: `
    CREATE TABLE IF NOT EXISTS nivel_juego (
      usuario_id INTEGER NOT NULL,
      juego      TEXT    NOT NULL,
      nivel      INTEGER NOT NULL,
      estrellas  INTEGER NOT NULL DEFAULT 0,
      mejor      INTEGER NOT NULL DEFAULT 0,
      intentos   INTEGER NOT NULL DEFAULT 0,
      jugado_en  INTEGER NOT NULL,
      PRIMARY KEY (usuario_id, juego, nivel),
      FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS ix_nivel_juego
      ON nivel_juego(usuario_id, juego, nivel);
    `,
  },

  /* ------------------------------------------------------------------
     v4 · desbloqueo por anuncio

     Una fila por cosa desbloqueada. El trato con el usuario es: ves el
     anuncio UNA vez y esa parte queda abierta para siempre, tambien sin
     internet. Por eso vive en la base local y no en un servidor: si el
     desbloqueo dependiera de la red, el usuario que ya pago con su
     atencion volveria a encontrarse el muro en el metro.

     `clave` es del tipo 'pack:calle_01', 'juego:dulces', 'lectura:l_07',
     'gramatica:g_12'. Un solo espacio de nombres para no crear una tabla
     por cada cosa desbloqueable que se invente despues.

     No se prellena nada: una fila que no existe es algo que no se ha
     desbloqueado.
     ------------------------------------------------------------------ */
  {
    version: 4,
    sql: `
    CREATE TABLE IF NOT EXISTS desbloqueo (
      usuario_id    INTEGER NOT NULL,
      clave         TEXT    NOT NULL,
      desbloqueado_en INTEGER NOT NULL,
      PRIMARY KEY (usuario_id, clave),
      FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS ix_desbloqueo
      ON desbloqueo(usuario_id, clave);
    `,
  },

  /* ------------------------------------------------------------------
     v5 · audio en inglés y español por separado

     La columna `audio` vieja se queda donde está, sin usar: SQLite no
     borra columnas sin recrear la tabla y no vale la pena el riesgo.
     ------------------------------------------------------------------ */
  {
    version: 5,
    sql: `
    ALTER TABLE entrada ADD COLUMN audio_en TEXT;
    ALTER TABLE entrada ADD COLUMN audio_es TEXT;
    `,
  },

  /* ------------------------------------------------------------------
     v6 · metadatos globales de la app

     Clave/valor sin usuario_id: hace falta un lugar para marcas como
     "catalog_version" que se leen ANTES de que exista ningún usuario
     (el sembrado corre en BootScreen antes de restore()), y que no
     desaparezcan si se borra una cuenta. La tabla `ajuste` no sirve
     para esto porque su clave foránea exige un usuario_id existente.
     ------------------------------------------------------------------ */
  {
    version: 6,
    sql: `
    CREATE TABLE IF NOT EXISTS app_meta (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
    `,
  },
];
