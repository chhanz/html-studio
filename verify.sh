#!/usr/bin/env bash
# Run every automated check: backend unit tests, UI typecheck + build,
# host-class lint, and the end-to-end harness. Exit non-zero on any failure.
#
#   ./verify.sh          all layers
#   ./verify.sh quick    backend + typecheck + build + lint (no browser)
set -euo pipefail
cd "$(dirname "$0")"

echo "== backend tests"
python3 -W error::ResourceWarning -m unittest backend/tests/test_*.py

echo "== ui typecheck + build"
(cd ui && npx tsc --noEmit && npm run build --silent)

echo "== host class lint"
(cd e2e && npm run --silent shim && node check-classes.mjs)

if [ "${1:-}" = "quick" ]; then
  echo "quick verification passed"
  exit 0
fi

echo "== e2e"
(cd e2e && npx playwright test)
echo "full verification passed"
