#!/bin/sh
# Publishes the app to GitHub Pages: builds it under /human-anatomy-as-code/ and force-pushes app/dist
# as a single commit on origin's gh-pages branch (no history kept: each deploy weighs ~60 MB).
# Run from the repository root once build/ is filled (npm run data && npm run assets).
set -eu
npm run -w app build:pages
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cp -R app/dist/. "$tmp"
git -C "$tmp" init -q -b gh-pages
git -C "$tmp" add -A
git -C "$tmp" -c user.name="$(git config user.name)" -c user.email="$(git config user.email)" \
  commit -qm "Deploy $(git rev-parse --short HEAD)"
# Fetched into this repository so the push goes through its own remote and credentials.
git fetch -q "$tmp" gh-pages
git push -f origin FETCH_HEAD:refs/heads/gh-pages
