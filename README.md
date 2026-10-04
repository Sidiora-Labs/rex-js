# Rex

Rex is Sidiora Labs' framework for building web application interfaces that AI agents can write and that AI agents can operate. It ships as one package, `@sidioralabs/rex`, with a CLI named `rex`.

Rex is built around four rules:

- **One declaration per capability.** Entities, actions, pages, policies and flows are each declared once with `entity()`, `action()`, `page()`, `policy()` and `flow()` from `@sidioralabs/rex`. The server procedures, client hooks, routes, palette entries, sidecar entries, manifest and audit records are derived from those declarations.
- **One folder convention per page.** Every page lives in `app/pages/<page>/` with fixed file names (`page.ts`, `view.tsx`, `states.tsx`, `hooks/`, `regions/`, `overlays/`, `test/`).
- **One checker.** `rex check` runs the typecheck and the convention rules and exits 1 on any error finding. `rex dev` and `rex build` run it first unless you pass `--no-check`.
- **One DOM that humans and agents operate.** There is no separate agent view. Every action control carries a `data-rex` address, every page embeds a machine-readable sidecar, and every action is reachable by click, keyboard shortcut, URL and command palette.

Version: 0.1.0 (`REX_VERSION` in `packages/rex/src/index.ts`).

## Stack

Rex uses these libraries as they are and does not wrap them in its own router, bundler or renderer:

| Concern | Library |
| --- | --- |
| Language | TypeScript (strict settings in `tsconfig.base.json`) |
| UI | React 19 (peer dependency) |
| Build and dev server | Vite, with `@vitejs/plugin-react` |
| HTTP server | Hono, served on Node by `@hono/node-server` |
| RPC | oRPC (`@orpc/server`, `@orpc/client`) |
| Client data | TanStack Query |
| Schemas | zod |
| Storage adapter | Drizzle ORM on libsql (in-memory store by default) |
| Routing | wouter |
| Command palette | cmdk |
| CLI | commander |

Rex does not use Next.js, React Server Components or server actions. Server code is Hono plus oRPC procedures; client code is React components; the boundary between them is the Action declaration.

## Quick start

Rex requires Node 22 or later and pnpm (the workspace pins `pnpm@10.27.0`). The `rex` bin is `dist/cli/index.js` of the package, so inside this repository build it first:

```sh
pnpm install                    # install the workspace
pnpm -C packages/rex build      # emit packages/rex/dist, including the rex bin
```

Then, with `rex` on your path:

```sh
rex new my-app                  # write a complete app into ./my-app
cd my-app
pnpm install                    # the generated package.json depends on @sidioralabs/rex ^0.1.0
rex make page orders --regions list,detail --overlays FilterSheet
rex dev                         # Vite client and the app's Hono server on one port (default 5173)
rex check                       # typecheck and convention rules; exit 1 on any error
rex build                       # dist/client/ and dist/server.js
node dist/server.js             # serve the built app (PORT defaults to 3000)
```

The demo in `examples/demo` calls the same bin through its package scripts (`pnpm -C examples/demo check`, `dev`, `build`). See [docs/cli.md](docs/cli.md) for every command and flag.

`rex new` writes `package.json`, `tsconfig.json`, `index.html`, `rex.config.ts` and an `app/` with one entity (`note`), one policy (`viewer`), one action (`ping`), a data module, a `Button` component and a `home` page at `/` with one region (`welcome`).

## The page folder convention

| Path | Role |
| --- | --- |
| `app/pages/<page>/page.ts` | The page declaration: route, params, policy, recovery, draft, actions, chrome, regions, overlays, states. Never imports React. |
| `app/pages/<page>/view.tsx` | Layout of regions only. The ready state. |
| `app/pages/<page>/states.tsx` | One export per declared non-ready state (`Loading`, `Empty`, `Stale`, `Partial`, `Offline`, `PermissionDenied`, `RecoverableError`, `TerminalError`). |
| `app/pages/<page>/hooks/use<Name>.ts` | Page-private state and queries. |
| `app/pages/<page>/regions/<region>/region.tsx` | Binds hooks to parts. The only place that calls hooks and actions. |
| `app/pages/<page>/regions/<region>/parts/<Part>.tsx` | Pure components: props in, events out, one default export. |
| `app/pages/<page>/overlays/<Overlay>.tsx` | Sheets and dialogs with declared dismissal. |
| `app/pages/<page>/test/` | Page tests. |
| `app/actions`, `app/entities`, `app/policies`, `app/flows` | One declaration per file. |
| `app/components` | Shared components (parts moved here by `rex promote`). |
| `app/data` | Stores and queries. |

The full import table, naming rules and checker rules are in [docs/convention.md](docs/convention.md).

## Declaring an action

This is the demo's `send` action (`examples/demo/app/actions/send.ts`, handler body shortened):

```ts
import { action, money, text, z } from "@sidioralabs/rex";
import { wallet } from "../policies/wallet.ts";

export const send = action("send", {
  input: z.object({ amount: money().default("0.001") }),
  output: z.object({ transfer: text({ min: 1 }), balance: money() }),
  policy: wallet.requires({ unlocked: true, account: true, permissions: ["wallet.send"] }),
  effect: "irreversible",
  label: "Send",
  shortcut: "mod+enter",
  invalidates: ["wallet"],
  handler: async (input, ctx) => {
    // ctx.actor is the resolved actor; return a value matching output
  },
});
```

From this one declaration Rex derives:

- an oRPC procedure named `send` at `/rex/rpc`, which validates input and output with the zod schemas, evaluates the policy before the handler and writes one audit record per call;
- a confirmation step on every invocation route, because `effect` is `"irreversible"` (the server refuses the call without a confirm token);
- a palette entry labelled `Send`, the `mod+enter` shortcut while its page is active, and `?act=send` URL invocation;
- invalidation of the TanStack queries keyed `["wallet"]` after success;
- a manifest entry in `.rex/manifest.json` and a row in the generated `AGENTS.md`.

## The nine data states

Every page is in exactly one of these states (`REX_DATA_STATES` in `packages/rex/src/core/states.ts`):

`loading`, `empty`, `stale`, `partial`, `offline`, `permission-denied`, `recoverable-error`, `terminal-error`, `ready`.

`ready` renders `view.tsx`; the other eight render the matching export of `states.tsx`, which receives `params`, `retry` and `error`. The runtime resolves the state from the page's observed queries, the page policy and connectivity, using this precedence: permission-denied, offline, loading, terminal-error, recoverable-error, empty, partial, stale, ready (`DATA_STATE_PRECEDENCE` in `packages/rex/src/client/states.ts`). Invalid page params render `terminal-error`.

## The agent contract in one screen

An agent drives a Rex app through the same browser UI a human uses. The full contract is in [docs/agent-contract.md](docs/agent-contract.md).

- **Addressing.** `data-rex-page="<page>"` on the page `<main>`, `data-rex-region="<page>/<region>"` on each region `<section>`, `data-rex-overlay="<page>/<Overlay>"` on each open overlay, `data-rex="<page>/<action>"` on each action control. Addresses come from declaration names, never from markup.
- **Sidecar.** Each page renders exactly one `<script type="application/rex+json" id="rex-page">`. Its JSON lists the page id, params, data state, the actions (id, label, allowed, reason, effect, input JSON schema, routes), the overlays (id, open, dismiss) and the last outcome. The same object is on `window.__rex`.
- **Outcome region.** A persistent `role="status" aria-live="polite"` section labelled `Outcome` states the last action, whether it succeeded, and its message. Rex does not use toasts for action results.
- **Four invocation routes.** Click the `data-rex` control; press the declared shortcut; load `<route>?act=<action>&input=<json>`; or open the palette with mod+k and select the action. Irreversible actions open a confirmation dialog on all four routes.
- **Density.** `?density=agent`, the `x-rex-density` header, or a stored preference sets `data-rex-density="agent"` on the document root, which removes animation and transition time, expands collapsed `<details>`, and gives controls a 44 by 44 CSS pixel minimum.
- **Overlays.** Every overlay declares its dismissal (`escape`, `button` or `both`), traps focus while open and returns focus to its opener.
- **No traps.** The checker reports hover handlers without `onFocus`, draggable elements and canvases without a declared alternative, and animation-only state.

## The demo and the operability walk

`examples/demo` is a wallet app modelled on the Paxeer wallet widgets. It was generated with `rex new` and `rex make` and then filled in.

| Page | Route | Regions | Overlays | Actions |
| --- | --- | --- | --- | --- |
| `portfolio` | `/` | hero, actions, holdings | HoldingsFilterSheet (URL bound) | toggle-hide-dust |
| `send` | `/send` | form, confirm, success | TokenSelectorSheet, ContactPickerSheet | send, pick-token, pick-contact |

It declares the entities `account`, `token` and `contact`, the policies `wallet` and `viewer`, and a `load-wallet` read action used by the page hooks. Data lives in seeded in-memory stores (`app/data/wallet.ts`). The server (`examples/demo/server.ts`) resolves the actor from a `demo-actor` cookie: `guest` gets the read-only guest actor, anything else gets the owner.

`examples/demo/e2e/operability.spec.ts` is a Playwright walk. It builds the demo with `rex build`, starts `node dist/server.js`, reads `/rex/manifest`, and for every page in both `default` and `agent` density checks the sidecar, the addressed landmarks and sidecar parity, then invokes every declared action by click, shortcut (when declared), URL and palette, accepting the confirmation for `send`. It opens and dismisses every overlay by Escape and by its close control, and checks that each overlay accepts typed input (for the pickers, typing a choice and pressing Enter runs the pick action). A second test logs in as `guest` and checks that disallowed actions are listed with a reason, disabled in the DOM and palette, and refused by URL. It writes one JSON report per page to `examples/demo/e2e/report/`; the committed reports record zero failures.

Run it with `pnpm -C packages/rex build` and then `pnpm -C examples/demo test` (which runs `rex check && playwright test`).

## Known gaps

These parts of the specification are not met or not exercised by the code in this revision:

- **Paged routes for infinite lists.** No page in the demo loads more on scroll, and Rex has no mechanism that derives a paged route for such a list. Store adapters do support `page` and `size` in `list()`.
- **DesignX components.** The demo's `app/components` holds four hand-written components (`Button`, `Card`, `Field`, `Sheet`) styled with Rex token variables. DesignX UI components are not installed.
- **Drizzle adapter export.** `drizzleStore` lives in `packages/rex/src/store/drizzle.ts` and passes the store conformance suite on libsql, but no entry of the package exports map exposes it.
- **Flows in the demo.** The demo declares no flow, so flow approval gates are covered by unit tests only, not by the operability walk. Flow decisions are not written to the audit ledger.
- **Sidecar parity in the checker.** The `parity` rule compares `page.ts` actions with the actions imported by region files. Parity between the rendered sidecar and the visible controls is checked only by the operability walk.
- **Demo page tests.** The demo page folders contain no `test/` directory; `rex make page` creates an empty one, which git does not track.
- **Checker timing.** The requirement that `rex check` completes on the demo in under 30 seconds has no recorded measurement.
- **Color and motion audit.** The requirement for a manual audit showing that the demo conveys no state only by color or motion has no recorded result. The checker's `traps/motion-only` rule covers `animate-*` classes only.

## Documentation

- [docs/convention.md](docs/convention.md): page folder layout, file roles, import table, naming, checker rules.
- [docs/agent-contract.md](docs/agent-contract.md): addressing, sidecar, outcome, palette, URL invocation, confirmation, density, overlays, flow gates, and how an agent operates a Rex app.
- [docs/primitives.md](docs/primitives.md): `entity`, `action`, `page`, `policy`, `flow`, the manifest, store adapters and the audit ledger.
- [docs/cli.md](docs/cli.md): every `rex` command, flag and exit code.
- [docs/architecture.md](docs/architecture.md): Vite plugin, client runtime, server, the life of an action, the package exports.
- [docs/development.md](docs/development.md): working on Rex itself: workspace, tests, gates, the spec-driven workflow.
- [docs/reference.md](docs/reference.md): index of the source types and test helpers.
- [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md).
