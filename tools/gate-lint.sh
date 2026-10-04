#!/usr/bin/env sh
# Release lint gate: typecheck every package, run the Rex checker on the demo,
# audit production dependencies and review their licenses.
set -eu
cd "$(dirname "$0")/.."
pnpm -r typecheck
if [ -f examples/demo/rex.config.ts ]; then
  pnpm -C packages/rex build
  pnpm -C examples/demo exec rex check
fi
pnpm audit --prod
node tools/license-review.mjs
cg spec render --check
