#!/usr/bin/env bash
# Memoria de la app en el teléfono (docs/PLAN-MEMORIA.md). Usa `dumpsys meminfo`: no necesita Android Studio.
#
#   scripts/medir-memoria.sh foto <etiqueta>          # una lectura: «al abrir», «tras 20 veces Estudio»…
#   scripts/medir-memoria.sh resistencia [min=30]     # lee cada 30 s mientras usas la app; al final dice si hubo
#                                                      # cierres (el proceso cambió o desapareció), ANR o FATAL
#
# Cada lectura se agrega a memoria.csv (fecha, etiqueta, PSS total, Java, nativa, gráficos, en KB).
# Cómo leerla: la memoria de una pantalla es fuga si, después de salir, no regresa cerca de lo que había antes de
# entrar. Entra y sal 20 veces, espera 10 s, y compara «antes» contra «después».
set -euo pipefail
PAQUETE=app.wero.mobile
CSV=${CSV:-memoria.csv}
[ -f "$CSV" ] || echo "fecha,etiqueta,pss_total_kb,java_kb,nativa_kb,graficos_kb" > "$CSV"

lectura() {
  local etiqueta=$1 salida
  salida=$(adb shell dumpsys meminfo "$PAQUETE" | tr -d '\r')
  local total java nativa graficos
  total=$(echo "$salida" | awk '/TOTAL PSS:/ {print $3; exit} /^ *TOTAL / {print $2; exit}')
  java=$(echo "$salida" | awk '/Java Heap:/ {print $3; exit}')
  nativa=$(echo "$salida" | awk '/Native Heap:/ {print $3; exit}')
  graficos=$(echo "$salida" | awk '/Graphics:/ {print $2; exit}')
  echo "$(date +%FT%T),$etiqueta,${total:-},${java:-},${nativa:-},${graficos:-}" >> "$CSV"
  printf '%-28s PSS %6s MB · Java %5s MB · nativa %5s MB · gráficos %5s MB\n' "$etiqueta" \
    "$(( ${total:-0} / 1024 ))" "$(( ${java:-0} / 1024 ))" "$(( ${nativa:-0} / 1024 ))" "$(( ${graficos:-0} / 1024 ))"
}

case "${1:-}" in
  foto)
    lectura "${2:-sin etiqueta}"
    ;;
  resistencia)
    MIN=${2:-30}
    adb logcat -c
    pid=$(adb shell pidof "$PAQUETE" | tr -d '\r')
    [ -n "$pid" ] || { echo "Abre la app primero."; exit 1; }
    echo "Usa la app $MIN min (estudio, juegos, lecturas, pestañas, segundo plano y regreso). Proceso $pid."
    fin=$(( $(date +%s) + MIN * 60 ))
    cierres=0
    while [ "$(date +%s)" -lt "$fin" ]; do
      ahora=$(adb shell pidof "$PAQUETE" | tr -d '\r')
      if [ "$ahora" != "$pid" ]; then
        cierres=$((cierres + 1))
        echo "!! el proceso cambió ($pid → ${ahora:-ninguno}): cierre o reinicio"
        pid=$ahora
      fi
      [ -n "$ahora" ] && lectura "resistencia"
      sleep 30
    done
    echo
    echo "cierres/reinicios del proceso: $cierres"
    echo "FATAL en logcat: $(adb logcat -d | grep -c 'FATAL EXCEPTION' || true)"
    echo "ANR en logcat: $(adb logcat -d | grep -c "ANR in $PAQUETE" || true)"
    echo "errores de JS: $(adb logcat -d -s ReactNativeJS:E | grep -c . || true)"
    ;;
  *)
    sed -n '2,11p' "$0"
    exit 1
    ;;
esac
