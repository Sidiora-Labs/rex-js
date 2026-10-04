#!/usr/bin/env sh
# Release lint gate: typecheck every package and run the Rex checker on the demo.
set -eu
cd "$(dirname "$0")/.."
pnpm -r typecheck
if [ -f examples/demo/rex.config.ts ]; then pnpm -C examples/demo exec rex check; fi
cg spec render --check
