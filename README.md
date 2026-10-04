<p align="center">
  <img src="assets/mark_rex_js.png" alt="Rex" width="480" height="200">
</p>

# Rex

Rex is Sidiora Labs' framework for building web application interfaces that AI agents can write and that AI agents can operate. It ships as one package, `@sidioralabs/rex`, with a CLI named `rex`. Its site, [rex.sidioralabs.com](https://rex.sidioralabs.com), is built with Rex and carries the documentation, the error catalog, the API reference and the changelog.

Rex is built around four rules:

- **One declaration per capability.** Entities, actions, pages, policies and flows are each declared once with `entity()`, `action()`, `page()`, `policy()` and `flow()` from `@sidioralabs/rex`. The server procedures, client hooks, routes, palette entries, sidecar entries, manifest and audit records are derived from those declarations.
- **One folder convention per page.** Every page lives in `app/pages/<page>/` with fixed file names (`page.ts`, `view.tsx`, `states.tsx`, `hooks/`, `regions/`, `overlays/`, `test/`).
- **One checker.** `rex check` runs the typecheck and the convention rules and exits 1 on any error finding. `rex dev` and `rex build` run it first unless you pass `--no-check`.
- **One DOM that humans and agents operate.** There is no separate agent view. Every action control carries a `data-rex` address, every page embeds a machine-readable sidecar, and every action is reachable by click, keyboard shortcut, URL and command palette.

Version: 0.2.0 (`REX_VERSION` in `packages/rex/src/index.ts`).

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
| Storage adapter | Drizzle ORM on libsql via `@sidioralabs/rex/store/drizzle` (in-memory store by default) |
| Routing | wouter |
| Command palette | cmdk |
| UI kit | DesignX registry components (`https://dxuireact.com/r`) on Tailwind 4 (`tailwindcss`, `@tailwindcss/vite`), installed into `app/components/ui/` by `rex new --ui designx` (the default); `--ui none` writes a plain `<button>` wrapper and no Tailwind |
| CLI | a built-in argument parser (`RexCommand` in `packages/rex/src/cli/args.ts`); no commander dependency |

DesignX is the standard UI vocabulary: `@sidioralabs/rex/designx` maps every Rex surface to one registry item, `rex new --ui designx` (the default) installs the standard set into `app/components/ui/`, and the demo uses it everywhere (`ui: { kit: "designx", components: "app/components/Shell.tsx" }` in `examples/demo/rex.config.ts`).

Rex does not use Next.js, React Server Components or server actions. Server code is Hono plus oRPC procedures; client code is React components; the boundary between them is the Action declaration.

## Quick start

Rex requires Node 22.19 or later (the React Compiler, on by default through the optional peers `@babel/core` 8 and `babel-plugin-react-compiler`, needs Node ^22.18.0 || >=24.11.0) and pnpm (the workspace pins `pnpm@10.27.0` and, through its own tooling, Node ^22.19.0 || ^24.11.0 || >=26.0.0). The `rex` bin is `dist/cli/index.js` of the package, so inside this repository build it first:

```sh
pnpm install                    # install the workspace
pnpm -C packages/rex build      # emit packages/rex/dist, including the rex bin
```

Then, with `rex` on your path:

```sh
rex new my-app                  # write a complete app into ./my-app; by default (--ui designx) it fetches the DesignX set from https://dxuireact.com/r and runs the package manager install itself (--no-install skips the install; --ui none writes a plain Button and runs no install)
cd my-app
pnpm install                    # only after --ui none or --no-install; the generated package.json depends on @sidioralabs/rex ^0.2.0
rex make page orders --regions list,detail --overlays FilterSheet
rex dev                         # Vite client and the app's Hono server on one port (default 5173)
rex check                       # typecheck and convention rules; exit 1 on any error
rex build                       # dist/client/ and dist/server.js
node dist/server.js             # serve the built app (PORT defaults to 3000)
```

The demo in `examples/demo` calls the same bin through its package scripts (`pnpm -C examples/demo check`, `dev`, `build`). See [docs/cli.md](docs/cli.md) for every command and flag.

`rex new` writes `package.json`, `tsconfig.json`, `index.html`, `rex.config.ts`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `app/locales/en.json` and an `app/` with one entity (`note`), one policy (`viewer`), one action (`ping`), a data module, a `Button` component and a `home` page at `/` with one region (`welcome`). With the default `--ui designx` it also writes `dx.json`, the DesignX standard set into `app/components/ui/`, `app/theme.css` (Tailwind 4, linked from `index.html`), `app/components/Shell.tsx` (the `ShellComponents` override named by `ui.components` in `rex.config.ts`) and DesignX-based `states.tsx` and home part, and `Button.tsx` wraps `app/components/ui/button.tsx`; with `--ui none`, `Button.tsx` is a plain `<button>` wrapper.

## Command line

One line per command with every flag it accepts, as `rex --help --json` reports them; `tools/freshness.mjs --check` fails this section when it drifts.

```sh
rex version                                          # print the rex version
rex build --target <target> --no-check               # build the client into dist/client and, unless the target is static, the server into dist/server.js; for static, every page as HTML (prerendered or the shell), index.md beside each prerendered page, 404.html and dist/client/rex/manifest
rex check --json --runtime                           # run typecheck, boundaries, states, parity, naming, traps, tokens and manifest freshness
rex dev --port <port> --host <host> --no-check       # serve the Vite client and the app's Hono server on one port with hot reload
rex make page <id> --regions <names> --overlays <names> # write a page folder: page.ts, view.tsx, states.tsx, hooks/, regions, overlays and test/
rex make region <page> <name>                        # write regions/<name>/region.tsx in a page
rex make part <page> <name> --region <region>        # write regions/<region>/parts/<Name>.tsx in a page
rex make overlay <page> <name>                       # write overlays/<Name>.tsx in a page
rex make hook <page> <name>                          # write hooks/<useName>.ts in a page
rex make action <name>                               # write app/actions/name.ts
rex make entity <name>                               # write app/entities/name.ts
rex make policy <name>                               # write app/policies/name.ts
rex make flow <name>                                 # write app/flows/name.ts
rex manifest                                         # write .rex/manifest.json and AGENTS.md from the app declarations
rex migrate --from <version> --list                  # list and apply the codemods that move an app from an earlier Rex version
rex new <name> --ui <kit> --no-install               # write a complete Rex app into a new folder
rex promote <part>                                   # move a page part to app/components and rewrite the imports that use it
```

`rex -v` (`--version`) prints the version like `rex version`.

## The page folder convention

| Path | Role |
| --- | --- |
| `app/pages/<page>/page.ts` | The page declaration: route, params, render, revalidate, paths, load, cache, transition, policy, recovery, draft, actions, chrome, regions, overlays, states. Never imports React. |
| `app/pages/<page>/view.tsx` | Layout of regions only. The ready state. |
| `app/pages/<page>/states.tsx` | One export per declared non-ready state (`Loading`, `Empty`, `Stale`, `Partial`, `Offline`, `PermissionDenied`, `RecoverableError`, `TerminalError`). |
| `app/pages/<page>/hooks/use<Name>.ts` | Page-private state and queries. |
| `app/pages/<page>/regions/<region>/region.tsx` | Binds hooks to parts. The only place that calls hooks and actions. |
| `app/pages/<page>/regions/<region>/parts/<Part>.tsx` | Pure components: props in, events out, one default export. |
| `app/pages/<page>/overlays/<Overlay>.tsx` | Sheets and dialogs with declared dismissal. |
| `app/pages/<page>/test/` | Page tests. |
| `app/actions`, `app/entities`, `app/policies`, `app/flows` | One declaration per file. |
| `app/components` | Shared components (parts moved here by `rex promote`), the DesignX copies under `app/components/ui/`, and the app-wide shell override module (`Shell.tsx`, named by `ui.components` in `rex.config.ts` and exporting `ShellComponents`). |
| `app/data` | Stores and queries. |

The full import table, naming rules and checker rules are in [docs/convention.md](docs/convention.md).

## Declaring an action

This is the demo's `send` action (`examples/demo/app/actions/send.ts`, handler body shortened):

```ts
import { action } from "@sidioralabs/rex";
import { money, text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { wallet } from "../policies/wallet.ts";

export const send = action("send", {
  input: z.object({ amount: z._default(money(), "0.001") }),
  output: z.object({ transfer: text({ min: 1 }), balance: money() }),
  policy: wallet.requires({ unlocked: true, account: true, permissions: ["wallet.send"] }),
  effect: "irreversible",
  label: "Send",
  shortcut: "mod+enter",
  form: { redirect: "/send" },
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
- **Sidecar.** Each page renders exactly one `<script type="application/rex+json" id="rex-page">`. Its JSON carries `version`, the page id, params, data state, the actions (id, label, allowed, reason, effect, input JSON schema, `via` routes), the overlays (id, open, dismiss), the last outcome and, when present, the regions, stores, loaders and the `screen`, `pointer` and `density` classification. The same object is on `window.__rex`.
- **Outcome region.** A persistent `role="status" aria-live="polite"` section labelled `Outcome` states the last action, whether it succeeded, and its message. Rex does not use toasts for action results.
- **Four invocation routes.** Click the `data-rex` control; press the declared shortcut; load `<route>?act=<action>&input=<json>`; or open the palette with mod+k and select the action. Irreversible actions open a confirmation dialog on all four routes.
- **Density.** `?density=agent`, the `x-rex-density` header, or a stored preference (`localStorage` key `rex:density`) sets `data-rex-density="agent"` on the document root (`comfortable` is the default and `compact` the third value), which removes animation and transition time, expands collapsed `<details>`, and gives controls a 44 by 44 CSS pixel minimum.
- **Screen.** The runtime classifies the screen (`phone`, `tablet`, `desktop`, `wide`), the pointer (`coarse`, `fine`) and the density (`comfortable`, `compact`, `agent`) and writes them on the document root as `data-rex-screen`, `data-rex-pointer` and `data-rex-density`: on the server (`screenFromRequest` in `packages/rex/src/server/ssr.ts`) from the `Sec-CH-UA-Mobile` and `Sec-CH-Viewport-Width` Client Hints (every HTML response sends `Accept-CH`) with a user-agent fallback, on the client from `matchMedia` and a `ResizeObserver`. `useScreen()` returns all three and the sidecar carries them. Overlays render as a dialog on tablet and larger screens and as a bottom sheet on phone; navigation is a dock on phone, a bar on tablet and a sidebar on desktop and wide screens.
- **Overlays.** Every overlay declares its dismissal (`escape`, `button` or `both`), traps focus while open and returns focus to its opener.
- **No traps.** The checker reports hover handlers without `onFocus`, draggable elements, canvases and custom elements without a declared alternative (or `tabIndex`), scroll-loading lists that do not use `Page.List`, and animation-only state.

## The demo and the operability walk

`examples/demo` is a wallet app modelled on the Paxeer wallet widgets. It was generated with `rex new` and `rex make` and then filled in.

| Page | Route | Regions | Overlays | Actions |
| --- | --- | --- | --- | --- |
| `portfolio` | `/` | hero, actions, holdings | HoldingsFilterSheet (URL bound) | toggle-hide-dust |
| `send` | `/send` | form, confirm, success | TokenSelectorSheet, ContactPickerSheet | send, pick-token, pick-contact |
| `about` | `/about` (static) | intro, feedback | - | send-feedback |
| `embed` | `/embed` | widget, locale | - | - (loads `list-tokens`) |
| `tokens` | `/tokens` (ssg, revalidate 60) | prices | - | - |

It declares the entities `account`, `token` and `contact`, the policies `wallet` and `viewer`, the read actions `load-wallet` and `list-tokens` used as page loaders (`load` in `page.ts`), and `send-feedback` on the about page. Data lives in seeded in-memory stores (`app/data/wallet.ts`, `app/data/watchlist.ts`, `app/data/feedback.ts`); messages live in `app/locales/en.json` and `de.json`. The server (`examples/demo/server.ts`) resolves the actor from a `demo-actor` cookie: `guest` gets the read-only guest actor, anything else gets the owner.

`examples/demo/e2e/operability.spec.ts` is a Playwright walk. It builds the demo with `rex build`, starts `node dist/server.js`, reads `/rex/manifest`, and for every page in both `default` and `agent` density checks the sidecar, the addressed landmarks and sidecar parity, then invokes every declared action by click, shortcut (when declared), URL and palette, accepting the confirmation for `send`. It opens and dismisses every overlay by Escape and by its close control, and checks that each overlay accepts typed input (for the pickers, typing a choice and pressing Enter runs the pick action). A second test logs in as `guest` and checks that disallowed actions are listed with a reason, disabled in the DOM and palette, and refused by URL. It writes one JSON report per walked page plus `guest.json`, `vitals.json`, `lighthouse.json` and `screenshots/` to `examples/demo/e2e/report/`. The committed `portfolio.json` records one failure (`window.__rex differs from the sidecar script` in default density) and `lighthouse.json` records `performance 66 is under 90` for the portfolio page; no `tokens.json` is committed.

Run it with `pnpm -C packages/rex build` and then `pnpm -C examples/demo test`, which runs `rex check` and then the Playwright operability walk, the no-JS walk (`e2e/nojs.spec.ts`), the axe pass (`e2e/axe.spec.ts`), the Core Web Vitals gate (`e2e/vitals.spec.ts`), Lighthouse (`e2e/lighthouse.ts`) and the screenshots spec; `pnpm -C examples/demo test:unit` runs the page tests with Vitest.

## Documentation

- [docs/convention.md](docs/convention.md): page folder layout, file roles, import table, naming, checker rules.
- [docs/agent-contract.md](docs/agent-contract.md): addressing, sidecar, outcome, palette, URL invocation, confirmation, density, screen, overlays, flow gates, and how an agent operates a Rex app.
- [docs/primitives.md](docs/primitives.md): the client entries, the field helpers, `entity`, `action`, `page`, `policy`, `flow`, stores, the audit ledger, the manifest and shell components.
- [docs/cli.md](docs/cli.md): every `rex` command, flag and exit code.
- [docs/architecture.md](docs/architecture.md): Vite plugin, client runtime, server, the life of an action, the package exports.
- [docs/development.md](docs/development.md): working on Rex itself: workspace, tests, gates, the spec-driven workflow.
- [docs/reference.md](docs/reference.md): index of the source types and test helpers.
- [docs/tutorial.md](docs/tutorial.md): build the wallet demo step by step.
- [docs/recipes/README.md](docs/recipes/README.md): loaders, forms without JavaScript, overlays, flow approval, static pages, i18n, web components, incremental adoption and the DesignX map.
- [docs/platforms.md](docs/platforms.md): the node, bun, deno, edge and static build targets, desktop and mobile shells, terminal agents.
- [docs/errors.md](docs/errors.md): the REX1xx to REX6xx error codes.
- [docs/migration.md](docs/migration.md): adopting Rex in a Vite or Next.js app and upgrading from 0.1 to 0.2.
- [docs/versioning.md](docs/versioning.md): semantic versioning, deprecations and codemods (`rex migrate`).
- [docs/releasing.md](docs/releasing.md): deploying the site to rex.sidioralabs.com through GitHub Pages.
- [docs/api/README.md](docs/api/README.md): the generated API reference, one page per package entry.
- [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md).

## Governance and community

Rex is MIT licensed ([LICENSE](LICENSE)) and stewarded by Sidiora Labs.

- [GOVERNANCE.md](GOVERNANCE.md): roles, how decisions and spec changes are made, release authority, continuity and funding.
- [MAINTAINERS.md](MAINTAINERS.md): the current maintainers, release managers and contacts.
- [SECURITY.md](SECURITY.md): supported versions, how to report a vulnerability privately, and the disclosure timeline.
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md): the standards for everyone taking part, how to report a violation, and enforcement.
- [.github/FUNDING.yml](.github/FUNDING.yml): sponsorship channels, which GitHub shows as the Sponsor button once Sidiora Labs' GitHub Sponsors profile is live.
