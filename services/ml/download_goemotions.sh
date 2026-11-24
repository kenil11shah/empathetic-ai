#!/usr/bin/env bash
# Downloads the GoEmotions splits (CC BY 4.0) into data/goemotions.
set -euo pipefail
mkdir -p data/goemotions
base=https://raw.githubusercontent.com/google-research/google-research/master/goemotions/data
for f in train.tsv dev.tsv test.tsv emotions.txt; do
  curl -sSfL "$base/$f" -o "data/goemotions/$f"
done
echo "Downloaded to data/goemotions"
