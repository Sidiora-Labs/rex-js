#!/usr/bin/env sh
# Release test gate: every package's tests, once per landing.
# The demo's test is the operability walk; it exists only once wave 6 has
# built the app, so the demo is included when examples/demo/rex.config.ts
# is present, after building the rex bin it calls.
set -eu
cd "$(dirname "$0")/.."
pnpm install --frozen-lockfile
pnpm -C packages/rex test
if [ -f examples/demo/rex.config.ts ]; then
  pnpm -C packages/rex build
  pnpm -C examples/demo test
fi
