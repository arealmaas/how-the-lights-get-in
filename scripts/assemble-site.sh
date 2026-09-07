#!/usr/bin/env sh
# Builds the planner and collects the files GitHub Pages should serve into one folder.
#   scripts/assemble-site.sh _site               # production build
#   scripts/assemble-site.sh _site "PR #12"      # preview build: noindex + ribbon
set -eu
out="${1:-_site}"
label="${2:-}"
cd "$(dirname "$0")/.."
if [ -n "$label" ]; then python3 scripts/build.py --preview "$label"; else python3 scripts/build.py; fi
rm -rf "$out"
mkdir -p "$out"
cp index.html sw.js manifest.webmanifest icon-192.png icon-512.png programme.json .nojekyll "$out"/
cp -R img "$out"/img
echo "site assembled in $out ($(find "$out" -type f | wc -l | tr -d ' ') files)"
