#!/usr/bin/env bash
# Met en ligne la page (GitHub Pages, branche gh-pages = contenu de main).
# Usage : bash publier.sh   (après avoir commité tes modifications)
set -euo pipefail
cd "$(dirname "$0")"

if [ -n "$(git status --porcelain)" ]; then
  echo "Des modifications ne sont pas commitées : commite-les d'abord (git add -A && git commit)." >&2
  exit 1
fi
node test-engine.js
git push origin main
git push origin main:gh-pages
echo "Publié : https://maxencebonnetcarrier-ship-it.github.io/elevage-dofus/ (mise à jour en 1 à 2 minutes)"
