#!/usr/bin/env sh
# Release test gate: the whole workspace's tests, once per landing.
set -eu
cd "$(dirname "$0")/.."
pnpm install --frozen-lockfile
pnpm -r test
