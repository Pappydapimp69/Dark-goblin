#!/bin/sh
# Rebuilds and republishes the static build to the gh-pages branch.
#
# The branch holds ONLY the build — index.html, the bundle, and a .nojekyll so
# Pages serves the files as they are instead of running them through Jekyll. It
# shares no history with the source branch, so it is rebuilt from scratch each
# time and force-pushed; nothing of value ever lives there.
#
# GitHub Pages serves this at a PATH (/Dark-goblin/ — it keeps the repository's
# own casing, and the lowercase form 404s), not at a domain root. That is what
# `base: './'` in vite.config.ts is for and what `npm run verify:itch` proves.
set -e

REMOTE=$(git remote get-url origin)
SOURCE=$(git rev-parse --short HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)

npm run build

WORK=$(mktemp -d)
cp -R dist/. "$WORK/"
touch "$WORK/.nojekyll"

cd "$WORK"
git init -q -b gh-pages
git config user.email "noreply@anthropic.com"
git config user.name "Claude"
git add -A
git commit -q -m "Deploy The Dark Goblin to GitHub Pages

Built from $BRANCH @ $SOURCE."
git remote add origin "$REMOTE"
git push -q -f origin gh-pages

echo "deployed $BRANCH @ $SOURCE -> gh-pages"
