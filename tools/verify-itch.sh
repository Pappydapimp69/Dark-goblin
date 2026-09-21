#!/bin/sh
# Unpacks dark-goblin.zip under a nested path, serves it, and drives the whole
# game there — the way itch.io does, not the way `vite preview` does.
set -e
ROOT="${1:-/tmp/itch-check}"
rm -rf "$ROOT"
mkdir -p "$ROOT/html/2481337"
unzip -q dark-goblin.zip -d "$ROOT/html/2481337"

python3 -m http.server 4174 --directory "$ROOT" > /dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 2

SMOKE_URL="http://localhost:4174/html/2481337/index.html" node tools/smoke.mjs smoke-shots
