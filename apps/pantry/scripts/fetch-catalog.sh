#!/usr/bin/env bash
# Downloads the product databases and builds Pantry's built-in barcode copy.
#   bash scripts/fetch-catalog.sh <download dir> <output dir>
# Files already in the download dir are reused. Open Food Facts is required; a sister database or
# USDA that cannot be downloaded is left out with a warning. The output dir appears only on success.
set -euo pipefail
work=${1:?download dir}
out=${2:?output dir}
mkdir -p "$work"
get() { [ -s "$2" ] || curl -fsSL --retry 3 --retry-delay 20 -o "$2.part" "$1" && { [ -s "$2" ] || mv "$2.part" "$2"; }; }

get https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz "$work/openfoodfacts.csv.gz"
facts="o=$work/openfoodfacts.csv.gz"
for pair in p:openproductsfacts b:openbeautyfacts f:openpetfoodfacts; do
  letter=${pair%%:*} name=${pair#*:}
  if get "https://world.$name.org/data/en.$name.org.products.csv.gz" "$work/$name.csv.gz"; then facts="$facts,$letter=$work/$name.csv.gz"
  else echo "::warning::Could not download $name; the built-in copy leaves it out this week."; fi
done

usda=()
if [ ! -s "$work/usda/food.csv" ]; then
  zip=$(curl -fsSL --retry 3 https://fdc.nal.usda.gov/download-datasets/ | grep -oE 'FoodData_Central_branded_food_csv_[0-9]{4}-[0-9]{2}-[0-9]{2}\.zip' | sort -u | tail -1 || true)
  if [ -n "$zip" ] && get "https://fdc.nal.usda.gov/fdc-datasets/$zip" "$work/usda.zip"; then
    unzip -o -q -j "$work/usda.zip" '*/branded_food.csv' '*/food.csv' '*/food_nutrient.csv' -d "$work/usda"
  fi
fi
if [ -s "$work/usda/food.csv" ]; then usda=(--usda "$work/usda"); else echo "::warning::Could not download USDA branded foods; the built-in copy leaves them out this week."; fi

rm -rf "$out.tmp"
node --max-old-space-size=8000 "$(dirname "$0")/build-catalog.mjs" --facts "$facts" "${usda[@]}" --out "$out.tmp"
rm -rf "$out"
mv "$out.tmp" "$out"
