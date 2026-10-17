#!/usr/bin/env bash
# Download the old-city test area from the OpenStreetMap API in small tiles (the API caps each call).
# Data © OpenStreetMap contributors, ODbL. Output goes to tools/raw/ (not committed).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p raw
LAT0=18.7780 LAT1=18.7985 LON0=98.9750 LON1=98.9970 N=3
for i in $(seq 0 $((N - 1))); do
  for j in $(seq 0 $((N - 1))); do
    read -r a b c d < <(python3 -c "
la=$LAT0+($LAT1-$LAT0)*$i/$N; la2=$LAT0+($LAT1-$LAT0)*($i+1)/$N
lo=$LON0+($LON1-$LON0)*$j/$N; lo2=$LON0+($LON1-$LON0)*($j+1)/$N
print(f'{lo:.5f} {la:.5f} {lo2:.5f} {la2:.5f}')")
    curl -sS --fail -m 120 -o "raw/tile_${i}_${j}.osm" \
      "https://api.openstreetmap.org/api/0.6/map?bbox=$a,$b,$c,$d"
    echo "tile $i,$j ok"
    sleep 1
  done
done
