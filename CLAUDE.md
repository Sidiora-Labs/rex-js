# rex-js — Agent Context

<!-- codify-owned: graph-agent-context v1 -->

_Generated graph context owned by `cg agentmd`. Regenerate with `cg agentmd --write` after significant changes. Workflow instructions remain owned by `cg spec render`._

## Languages

| Language | Files | Lines |
|---|---:|---:|
| typescript | 1112 | 125547 |
| javascript | 18 | 3023 |

1130 source files, 128570 lines total.

## Directory map

- `examples/` — 141 files, 10056 lines (mostly typescript)
- `(root)` — 1 files, 64 lines (mostly javascript)
- `packages/` — 779 files, 102162 lines (mostly typescript)
- `site/` — 197 files, 13691 lines (mostly typescript)
- `tools/` — 12 files, 2597 lines (mostly javascript)

## Build & tooling

- `package.json` — npm/node (scripts: `build` `typecheck` `test` `check` `dev` `docs:errors` `docs:api` `docs:check` `freshness` `lint` `format` `format:check` `test:ratio` `smoke`)

## Entry points

- function `main` — `tools/docs-api.mjs:98`
- function `main` — `tools/docs-errors.mjs:58`
- function `main` — `tools/freshness.mjs:611`
- function `main` — `tools/site-verify.mjs:370`
- function `main` — `tools/test-ratio.mjs:191`

## HTTP routes

| Method | Pattern | Handler | Where |
|---|---|---|---|
| ALL | `${RPC_PREFIX}/*` | — | `packages/rex/src/server/routes/rpc.test.ts:218` |
| GET | `*` | `async` | `packages/rex/src/server/loaders.ts:99` |
| GET | `*` | — | `packages/rex/src/server/middleware/telemetry.test.ts:401` |
| GET | `*` | — | `packages/rex/src/server/middleware/telemetry.test.ts:421` |
| GET | `*` | `async` | `packages/rex/src/server/routes/render.ts:83` |
| * | `/` | — | `packages/rex/src/cli/commands/build.test.ts:339` |
| * | `/` | — | `packages/rex/src/cli/static-target.test.ts:219` |
| * | `/` | — | `packages/rex/src/client/act.test.tsx:229` |
| * | `/` | — | `packages/rex/src/client/act.test.tsx:294` |
| * | `/` | — | `packages/rex/src/client/agent/flow.test.tsx:148` |
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
| GET | `/` | `async` | `packages/rex/src/server/security.test.ts:334` |
| GET | `/` | `async` | `packages/rex/src/server/security.test.ts:372` |
| * | `/` | — | `packages/rex/src/vite/outputs.test.ts:136` |
| * | `/` | — | `packages/rex/src/vite/prerender.test.ts:767` |
| * | `/a` | — | `packages/rex/src/server/static-cache.test.ts:326` |
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
| * | `/board` | — | `packages/rex/src/client/agent/address.test.tsx:274` |
| * | `/console` | — | `packages/rex/src/cli/static-target.test.ts:220` |
| * | `/console` | — | `packages/rex/src/vite/outputs.test.ts:142` |
| * | `/console` | — | `packages/rex/src/vite/prerender.test.ts:779` |
| GET | `/doc` | — | `packages/rex/src/server/middleware/security.test.ts:72` |
| * | `/elsewhere` | — | `packages/rex/src/client/app.test.tsx:371` |
| GET | `/env` | — | `packages/rex/src/server/adapters/bun.test.ts:210` |
| GET | `/env` | — | `packages/rex/src/server/adapters/deno.test.ts:228` |
| * | `/gone` | — | `packages/rex/src/client/fallback-host.test.tsx:72` |
| * | `/guide` | — | `packages/rex/src/vite/outputs.test.ts:75` |
| POST | `/hooks/payment` | — | `packages/rex/src/server/middleware/security.test.ts:71` |
| POST | `/hooks/payment` | — | `packages/rex/src/server/security.test.ts:198` |
| GET | `/items/:itemId` | — | `packages/rex/src/server/middleware/telemetry.test.ts:397` |
| GET | `/items/settings` | — | `packages/rex/src/server/middleware/telemetry.test.ts:393` |
| * | `/landing` | — | `packages/rex/src/server/adapters/static-cache.test.ts:176` |
| * | `/landing` | — | `packages/rex/src/server/adapters/static-cache.test.ts:200` |
| * | `/landing` | — | `packages/rex/src/server/adapters/static-cache.test.ts:391` |
| * | `/landing` | — | `packages/rex/src/server/adapters/static-cache.test.ts:558` |
| * | `/landing` | — | `packages/rex/src/server/node.test.ts:420` |
| * | `/landing` | — | `packages/rex/src/server/routes/render.test.ts:283` |
| * | `/landing/` | — | `packages/rex/src/server/node.test.ts:358` |

## Load-bearing symbols (most referenced)

- `get` (method, 795 refs) — `packages/rex/src/client/screen.ts:194`
- `push` (function, 688 refs) — `packages/rex/src/check/rule.ts:284`
- `describe` (function, 636 refs) — `packages/rex/src/check/rules/layout.ts:368`
- `text` (function, 524 refs) — `packages/rex/src/cli/frame.ts:25`
- `freeze` (function, 499 refs) — `packages/rex/src/client/store-registry.ts:29`
- `page` (function, 335 refs) — `packages/rex/src/core/page.ts:298`
- `cn` (function, 307 refs) — `examples/demo/app/components/ui/utils.ts:4`
- `RexError` (class, 288 refs) — `packages/rex/src/core/errors.ts:146`
- `mount` (function, 260 refs) — `packages/rex/src/client/agent/address.test.tsx:127`
- `set` (method, 257 refs) — `packages/rex/src/client/app.tsx:220`
- `parse` (function, 249 refs) — `packages/rex/src/check/rules/media.test.ts:14`
- `click` (function, 243 refs) — `examples/demo/app/pages/portfolio/test/actions.test.tsx:39`
- `has` (function, 236 refs) — `packages/rex/src/client/agent/confirm.test.tsx:128`
- `action` (function, 235 refs) — `packages/rex/src/cli/cli.test.ts:618`
- `find` (function, 233 refs) — `packages/rex/src/core/registry.ts:102`

## Querying this codebase

This project is indexed by Codify (SQLite + FTS5, 100% local). Prefer these over grep/file-walking — one call returns definitions, snippets, and call edges:

```bash
cg context <query>      # symbols + snippets + callers/callees + routes
cg search <text>        # instant name/full-text search
cg symbol <name>        # definition + snippet + reference count
cg impact <name> -d 3   # who breaks if this changes
cg routes [filter]      # URL pattern -> handler
cg changes              # impact radius of uncommitted edits
```

All of the above accept `--json`. The graph auto-syncs via `cg watch`, or connect over MCP with `cg mcp-install`.
