#!/usr/bin/env bash
# Arranque en frío en el teléfono (docs/RENDIMIENTO.md, «Arranque»). Necesita un release armado con
# EXPO_PUBLIC_MEDIR=1 para leer las marcas; sin eso solo sale el TotalTime del sistema.
#
#   scripts/medir-arranque.sh [veces=5]
#
# Por cada vuelta: force-stop, limpia logcat, am start -W (TotalTime) y espera la línea [medir] de la app.
# Al final imprime la mediana de TotalTime y de cada marca.
set -euo pipefail
VECES=${1:-5}
PAQUETE=app.wero.mobile
ACTIVIDAD=$PAQUETE/.MainActivity
tmp=$(mktemp -d)

for i in $(seq 1 "$VECES"); do
  adb shell am force-stop "$PAQUETE"
  sleep 2
  adb logcat -c
  total=$(adb shell am start -W -n "$ACTIVIDAD" | tr -d '\r' | awk -F': ' '/TotalTime/ {print $2}')
  echo "$total" >> "$tmp/total"
  linea=""
  for _ in $(seq 1 30); do
    linea=$(adb logcat -d -s ReactNativeJS | tr -d '\r' | grep -o '\[medir\].*' | tail -1 || true)
    [ -n "$linea" ] && break
    sleep 1
  done
  echo "vuelta $i · TotalTime ${total} ms · ${linea:-(sin marcas: ¿release sin EXPO_PUBLIC_MEDIR=1?)}"
  [ -n "$linea" ] && echo "$linea" >> "$tmp/marcas"
done

mediana() { sort -n | awk '{a[NR]=$1} END {if (NR==0) {print "-"; exit} print (NR%2 ? a[(NR+1)/2] : (a[NR/2]+a[NR/2+1])/2)}'; }
echo
echo "mediana TotalTime: $(mediana < "$tmp/total") ms"
if [ -f "$tmp/marcas" ]; then
  for m in app base catalogo fuentes splash primerRender interactivo; do
    v=$(grep -o "$m [0-9]*" "$tmp/marcas" | awk '{print $2}' | mediana)
    echo "mediana $m: $v ms"
  done
  echo "bloqueo máx (peor vuelta): $(grep -o 'bloqueo máx [0-9]*' "$tmp/marcas" | awk '{print $3}' | sort -n | tail -1) ms"
fi
rm -rf "$tmp"
