#!/usr/bin/env sh
# Release test gate: every package's tests, once per landing.
# The demo's test is the operability walk; it exists only once wave 6 has
# built the app, so the demo is included when examples/demo/app is present.
set -eu
cd "$(dirname "$0")/.."
pnpm install --frozen-lockfile
pnpm -C packages/rex test
if [ -d examples/demo/app ]; then pnpm -C examples/demo test; fi
