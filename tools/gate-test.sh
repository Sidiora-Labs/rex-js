#!/usr/bin/env sh
# Release test gate: every workspace package's tests, the test-to-code ratio
# over the results they record, the navigation race walk and the packed CLI
# bootstrap, once per landing. Every step runs; the gate fails if any failed.
set -u
cd "$(dirname "$0")/.."
pnpm install --frozen-lockfile || exit 1
pnpm -C packages/rex build || exit 1
pnpm install --frozen-lockfile --offline || exit 1
failed=""
gate() {
  name="$1"
  shift
  "$@" || failed="$failed $name"
}
gate workspace-tests node tools/run-workspace-tests.mjs
gate test-ratio node tools/test-ratio.mjs --check
gate navigation-races node tools/navigation-races.mjs
gate smoke-cli-bootstrap node tools/smoke-cli-bootstrap.mjs
if [ -n "$failed" ]; then
  echo "gate-test: failed:$failed" >&2
  exit 1
fi
