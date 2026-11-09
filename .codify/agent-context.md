# rex-js — Agent Context

<!-- hyperfide-owned: graph-agent-context v1 -->

_Generated graph context owned by `hyperfide agentmd`. Regenerate with `hyperfide agentmd --write` after significant changes. Workflow instructions remain owned by `hyperfide spec render`._

## Languages

| Language | Files | Lines |
|---|---:|---:|
| typescript | 1112 | 125547 |
| json | 26 | 12188 |
| javascript | 18 | 3023 |
| yaml | 11 | 7628 |
| python | 1 | 317 |

1168 source files, 148703 lines total.

## Directory map

- `.github/` — 9 files, 983 lines (mostly yaml)
- `examples/` — 153 files, 10979 lines (mostly typescript)
- `(root)` — 6 files, 6823 lines (mostly json)
- `packages/` — 784 files, 102534 lines (mostly typescript)
- `site/` — 202 files, 24455 lines (mostly typescript)
- `tools/` — 12 files, 2597 lines (mostly javascript)
- `spec/` — 2 files, 332 lines (mostly python)

## Build & tooling

- `package.json` — npm/node (scripts: `build` `typecheck` `test` `check` `dev` `docs:errors` `docs:api` `docs:check` `freshness` `lint` `format` `format:check` `test:ratio` `smoke`)

## Entry points

- method `main` — `packages/rex/src/test-ratio.test.ts:53`
- function `main` — `spec/rex-v04/tools/validate_spec.py:280`
- function `main` — `tools/check-links.mjs:170`
- function `main` — `tools/docs-api.mjs:98`
- function `main` — `tools/docs-errors.mjs:58`
- function `main` — `tools/freshness.mjs:611`
- function `main` — `tools/site-verify.mjs:370`
- function `main` — `tools/test-ratio.mjs:191`

## HTTP routes

| Method | Pattern | Handler | Where |
|---|---|---|---|
| MOUNT | `*` | `async` | `packages/rex/src/server/adapters/client-hints.ts:39` |
| MOUNT | `*` | `corsMiddleware` | `packages/rex/src/server/middleware/cors.ts:51` |
| MOUNT | `*` | `async` | `packages/rex/src/server/middleware/security.ts:103` |
| MOUNT | `*` | `async` | `packages/rex/src/server/middleware/telemetry.ts:286` |
| NAV | `/` | — | `packages/rex/src/check/fixtures/boundaries/fail/app/pages/send/regions/form/parts/AmountField.tsx:11` |
| * | `/` | — | `packages/rex/src/cli/commands/build.test.ts:339` |
| * | `/` | — | `packages/rex/src/client/agent/flow.test.tsx:148` |
| * | `/` | — | `packages/rex/src/client/act.test.tsx:229` |
| * | `/` | — | `packages/rex/src/client/act.test.tsx:294` |
| * | `/` | — | `packages/rex/src/client/app.test.tsx:365` |
| * | `/` | — | `packages/rex/src/client/app.test.tsx:382` |
| * | `/` | — | `packages/rex/src/client/entry.test.tsx:175` |
| * | `/` | — | `packages/rex/src/client/form.test.tsx:116` |
| * | `/` | — | `packages/rex/src/client/form.test.tsx:385` |
| * | `/` | — | `packages/rex/src/client/nav-links.test.tsx:30` |
| * | `/` | — | `packages/rex/src/client/providers.test.tsx:58` |
| * | `/` | — | `packages/rex/src/client/screen.test.tsx:211` |
| * | `/` | — | `packages/rex/src/core/protocol.test.ts:83` |
| GET | `/` | — | `packages/rex/src/server/middleware.test.ts:107` |
| * | `/` | — | `packages/rex/src/server/form.ts:255` |
| * | `/` | — | `packages/rex/src/server/form.ts:388` |
| * | `/` | — | `packages/rex/src/server/form.ts:397` |
| * | `/` | — | `packages/rex/src/vite/outputs.test.ts:136` |
| DYNAMIC | `/${RPC_PREFIX}/*` | — | `packages/rex/src/server/routes/rpc.test.ts:218` |
| GET | `/*` | `async` | `packages/rex/src/server/loaders.ts:99` |
| GET | `/*` | `async` | `packages/rex/src/server/routes/render.ts:83` |
| GET | `/*` | — | `packages/rex/src/server/middleware/telemetry.test.ts:401` |
| GET | `/*` | — | `packages/rex/src/server/middleware/telemetry.test.ts:421` |
| * | `/api/hooks/useApiEntries` | — | `site/app/pages/api/hooks/useApiEntries.ts:1` |
| * | `/api/hooks/useApiSearch` | — | `site/app/pages/api/hooks/useApiSearch.ts:1` |
| * | `/api/page` | — | `site/app/pages/api/page.ts:1` |
| * | `/api/regions/entries/parts/EntriesIntro` | — | `site/app/pages/api/regions/entries/parts/EntriesIntro.tsx:1` |
| * | `/api/regions/entries/parts/EntryCard` | — | `site/app/pages/api/regions/entries/parts/EntryCard.tsx:1` |
| * | `/api/regions/entries/region` | — | `site/app/pages/api/regions/entries/region.tsx:1` |
| * | `/api/regions/search/parts/ApiSearch` | — | `site/app/pages/api/regions/search/parts/ApiSearch.tsx:1` |
| * | `/api/regions/search/region` | — | `site/app/pages/api/regions/search/region.tsx:1` |
| * | `/api/states` | — | `site/app/pages/api/states.tsx:1` |
| * | `/api/test/api.test` | — | `site/app/pages/api/test/api.test.tsx:1` |
| * | `/api/view` | — | `site/app/pages/api/view.tsx:1` |
| PAGE | `/app/pages/home` | — | `packages/rex/src/vite/fixtures/app/app/pages/home/page.ts:1` |
| PAGE | `/app/pages/home/overlays/NoteSheet` | — | `packages/rex/src/vite/fixtures/app/app/pages/home/overlays/NoteSheet.tsx:1` |
| PAGE | `/app/pages/home/regions/composer/region` | — | `packages/rex/src/vite/fixtures/app/app/pages/home/regions/composer/region.tsx:1` |
| PAGE | `/app/pages/home/regions/list/parts/NoteRow` | — | `packages/rex/src/vite/fixtures/app/app/pages/home/regions/list/parts/NoteRow.tsx:1` |
| PAGE | `/app/pages/home/regions/list/region` | — | `packages/rex/src/vite/fixtures/app/app/pages/home/regions/list/region.tsx:1` |
| PAGE | `/app/pages/home/states` | — | `packages/rex/src/vite/fixtures/app/app/pages/home/states.tsx:1` |
| PAGE | `/app/pages/home/view` | — | `packages/rex/src/vite/fixtures/app/app/pages/home/view.tsx:1` |
| PAGE | `/app/pages/note` | — | `packages/rex/src/vite/fixtures/app/app/pages/note/page.ts:1` |
| PAGE | `/app/pages/note/regions/detail/region` | — | `packages/rex/src/vite/fixtures/app/app/pages/note/regions/detail/region.tsx:1` |
| PAGE | `/app/pages/note/states` | — | `packages/rex/src/vite/fixtures/app/app/pages/note/states.tsx:1` |
| PAGE | `/app/pages/note/view` | — | `packages/rex/src/vite/fixtures/app/app/pages/note/view.tsx:1` |
| PAGE | `/app/pages/portfolio` | — | `packages/rex/src/manifest/fixtures/app/app/pages/portfolio/page.ts:1` |
| PAGE | `/app/pages/send` | — | `packages/rex/src/manifest/fixtures/app/app/pages/send/page.ts:1` |
| * | `/board` | — | `packages/rex/src/client/agent/address.test.tsx:274` |
| PAGE | `/components/AnimatedNumber` | — | `examples/demo/app/components/AnimatedNumber.tsx:1` |
| PAGE | `/components/Api` | — | `packages/rex/src/check/fixtures/boundaries/fail/app/components/Api.tsx:1` |
| PAGE | `/components/BalanceCard` | — | `examples/demo/app/components/BalanceCard.tsx:1` |
| PAGE | `/components/Button` | — | `examples/demo/app/components/Button.tsx:1` |
| PAGE | `/components/Button` | — | `packages/rex/src/check/fixtures/boundaries/fail/app/components/Button.tsx:1` |
| PAGE | `/components/Button` | — | `packages/rex/src/check/fixtures/boundaries/pass/app/components/Button.tsx:1` |
| PAGE | `/components/Button` | — | `packages/rex/src/cli/fixtures/app-01/app/components/Button.tsx:1` |

## Load-bearing symbols (most referenced)

- `get` (action, 844 refs) — `examples/demo/e2e/vitals.spec.ts:364`
- `push` (function, 724 refs) — `packages/rex/src/check/rule.ts:284`
- `describe` (function, 638 refs) — `packages/rex/src/check/rules/layout.ts:368`
- `text` (function, 529 refs) — `packages/rex/src/schema/fields.ts:52`
- `freeze` (function, 498 refs) — `packages/rex/src/client/store-registry.ts:29`
- `getAttribute` (method, 489 refs) — `packages/rex/src/server/form.test.tsx:660`
- `filter` (action, 388 refs) — `packages/rex/src/server/node.test.ts:608`
- `RexError` (class, 341 refs) — `packages/rex/src/core/errors.ts:146`
- `page` (action, 333 refs) — `packages/rex/src/cli/templates.ts:70`
- `waitFor` (function, 327 refs) — `packages/rex/src/vite/overlay.test.ts:229`
- `cn` (function, 307 refs) — `examples/demo/app/components/ui/utils.ts:4`
- `set` (method, 262 refs) — `packages/rex/src/client/fixtures/compiler/board.tsx:5`
- `mount` (function, 260 refs) — `packages/rex/src/client/agent/confirm-dialog.test.tsx:44`
- `parse` (function, 250 refs) — `packages/rex/src/check/rules/layout.test.ts:33`
- `has` (method, 247 refs) — `packages/rex/src/client/agent/confirm.tsx:194`

## Querying this codebase

This project is indexed by Hyperfide (SQLite + FTS5, 100% local). Prefer these over grep/file-walking — one call returns definitions, snippets, and call edges:

```bash
hyperfide context <query>      # symbols + snippets + callers/callees + routes
hyperfide search <text>        # instant name/full-text search
hyperfide grep <pattern> [-i]  # line search, each hit in its symbol
hyperfide files <glob|words>   # find files; --dirs maps directories
hyperfide symbol <name>        # definition + snippet + reference count
hyperfide impact <name> -d 3   # who breaks if this changes
hyperfide routes [filter]      # URL pattern -> handler
hyperfide changes              # impact radius of uncommitted edits
```

`cg` remains a compatibility alias for every command above (`cg context <query>` works unchanged).

All of the above accept `--json`. The graph auto-syncs via `hyperfide watch`, or connect over MCP with `hyperfide mcp-install`.

Over MCP, use `grep_code`, `find_files`, `search_code`, and `get_context` before any shell search: `hyperfide grep` and `hyperfide files` answer what grep, rg, and find would, ranked and capped to a token budget.

When another process (an editor's indexer) holds the database, `hyperfide remember`, `hyperfide handoff`, and the bookkeeping behind `hyperfide spec done` say **queued**: the write is kept in `.codegraph/journal/` and the next `hyperfide` command applies it — do not re-run it. Exit 75 (a claim) means nothing changed: re-run the same command. `hyperfide journal` lists what is queued.
