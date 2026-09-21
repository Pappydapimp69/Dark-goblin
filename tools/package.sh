#!/bin/sh
# Builds and zips the game for itch.io.
#
# itch unpacks the zip and serves index.html from a PATH, not from a domain
# root, so index.html must sit at the top of the archive and every asset
# reference must be relative — which is what `base: './'` in vite.config.ts is
# for. tools/verify-itch.sh proves that rather than trusting it.
set -e
npm run build
rm -f dark-goblin.zip
cd dist && zip -qr ../dark-goblin.zip . && cd ..
echo "dark-goblin.zip  $(du -h dark-goblin.zip | cut -f1)"
unzip -l dark-goblin.zip | sed -n '4,8p'
