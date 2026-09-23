#!/usr/bin/env bash
# Cut a release: the `release` branch is `main` plus the built UI (ui/dist),
# which the source branch ignores. The app catalog installs by plain git clone
# with no build step, so its entry points at `release`; every other checkout
# builds from source.
#
#   tools/release.sh            # release the current main HEAD
#
# Steps: verify main is clean and pushed-ready, build the UI, switch to
# `release` (created from main on first use), merge main, force-add ui/dist,
# commit, tag v<version> from app.json, switch back to main. Nothing is pushed;
# push `release` and the tag yourself:
#
#   git push origin release --tags
set -euo pipefail
cd "$(dirname "$0")/.."

[ "$(git branch --show-current)" = "main" ] || { echo "run from main"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "main has uncommitted changes"; exit 1; }

version=$(python3 -c 'import json;print(json.load(open("app.json"))["version"])')
py_version=$(sed -nE 's/^APP_VERSION = "([^"]+)"/\1/p' backend/server.py)
[ "$version" = "$py_version" ] || { echo "app.json ($version) and backend ($py_version) versions differ"; exit 1; }
if git rev-parse -q --verify "refs/tags/v$version" >/dev/null; then
  echo "tag v$version exists: bump the version first"; exit 1
fi

echo "== build ui"
(cd ui && npm run build --silent)
for f in ui/dist/index.mjs ui/dist/icons/nav.svg ui/dist/icons/nav-inactive.svg; do
  [ -f "$f" ] || { echo "missing $f"; exit 1; }
done

echo "== release branch"
main_sha=$(git rev-parse --short HEAD)
if git rev-parse -q --verify release >/dev/null; then
  git switch -q release
  git merge -q --no-edit -X theirs main
else
  git switch -q -c release
fi
# The built files are ignored on main; on release they are the point.
git add -f ui/dist
git commit -q -m "Release v$version" -m "main $main_sha plus the built UI (ui/dist) for catalog installs." || echo "(dist unchanged)"
git tag -a "v$version" -m "HTML Studio v$version"
rel_sha=$(git rev-parse --short HEAD)
git switch -q main

echo "released v$version: release@$rel_sha (main@$main_sha)"
echo "next: git push origin main release --tags"
