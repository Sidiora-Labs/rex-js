#!/usr/bin/env sh
# Release lint gate: typecheck every package, lint and check formatting, run
# the Rex checker with the runtime pass on the demo and the site, audit
# production dependencies and review their licenses. Every step runs; the
# gate fails if any failed.
set -u
cd "$(dirname "$0")/.."
pnpm -C packages/rex build || exit 1
pnpm install --frozen-lockfile --offline || exit 1
failed=""
gate() {
  name="$1"
  shift
  "$@" || failed="$failed $name"
}
gate typecheck pnpm -r typecheck
gate lint pnpm lint
gate format pnpm format:check
gate demo-check pnpm -C examples/demo exec rex check --runtime
gate site-check pnpm -C site exec rex check --runtime
gate audit pnpm audit --prod
gate licenses node tools/license-review.mjs
gate spec-render cg spec render --check
if [ -n "$failed" ]; then
  echo "gate-lint: failed:$failed" >&2
  exit 1
fi
