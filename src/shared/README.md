# shared

Lo reutilizable: `ui/` (Button, Card, Screen, Presionable, íconos, esqueletos, `fx/` y lo que usan varias features), `hooks/` (useCarga, useVisibilidad, useMovimientoReducido…), `navegacion/` y `utils/`.
Solo importa `services` sin estado de pantalla, `domain`, `theme`, `config` y `types`: nunca `features`, `data`, `estado` ni `app`.
