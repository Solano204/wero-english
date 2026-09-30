# features

Una carpeta por área de la app (practicar, estudio, juegos/…, lecturas, cuenta, ajustes…), cada una con `screens/`, `components/`, `hooks/` y, si aplica, `logic/` (reglas puras de esa área, como la máquina de estados de una partida).
Las pantallas solo pintan: lo que hacen vive en el hook de su feature. Una feature no importa archivos internos de otra: lo compartido sube a `shared/` o a `domain/`. Nunca importa `app/`.
