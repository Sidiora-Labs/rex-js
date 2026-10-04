# Architecture

Rex owns conventions, generators, the checker and the agent contract. It does not own a router, bundler or renderer: Vite, Hono, oRPC, TanStack Query, Drizzle and wouter are used as they are. This page follows the code from the app folder to the browser and back.

## Package exports

`packages/rex/package.json` exports source TypeScript inside the workspace and built files when published (`publishConfig.exports`):

| Specifier | Workspace entry | Published entry | Contents |
| --- | --- | --- | --- |
| `@sidioralabs/rex` | `src/index.ts` | `dist/index.js` | core primitives (`entity`, `action`, `page`, `policy`, `flow`, field helpers, stores, registry, journal), the wire protocol constants, manifest types, `buildManifest`, the sidecar schema, `REX_VERSION` |
| `@sidioralabs/rex/client` | `src/client/index.ts` | `dist/client/index.js` | `createRexApp`, `createRexEntry`, router, navigation, `useAct`, outcome store, data states, `view`, `region`, `PageHost`, `Page` layout primitives, `Shell`, `overlay`, and the agent modules (address, sidecar, outcome region, palette, shortcuts, URL invocation, confirmation, density, flow) |
| `@sidioralabs/rex/client/interop` | `src/client/interop/index.ts` | `dist/client/interop/index.js` | `defineElement`, `mountRexPage` and `Native`, for custom elements and mounting Rex pages into foreign apps |
| `@sidioralabs/rex/client/media` | `src/client/media/index.ts` | `dist/client/media/index.js` | `Img`, `Script` and `loadScript` |
| `@sidioralabs/rex/client/i18n` | `src/client/i18n/index.ts` | `dist/client/i18n/index.js` | `useT`, `useLocale`, `t`, `formatMessage`, the locale resolution helpers and `defineI18n` |
| `@sidioralabs/rex/server` | `src/server/index.ts` | `dist/server/index.js` | `createRexServer`, the audit ledger, the action router, the request context, flow procedures |
| `@sidioralabs/rex/vite` | `src/vite/index.ts` | `dist/vite/index.js` | the `rex()` Vite plugin and the virtual module generators |
| `@sidioralabs/rex/check` | `src/check/index.ts` | `dist/check/index.js` | the checker engine, rule helpers, formatters, `defaultRules` and `runCheck` |
| `rex` (bin) | | `dist/cli/index.js` | the CLI |

`@sidioralabs/rex/client` holds what every app needs: the runtime, router, `useAct`, loaders, data states, shell, sidecar, forms and screen classification. Interop, media and i18n message formatting are optional capabilities behind their own entries, so an app that does not import them never ships them; `registerI18n`, which the generated `rex:app` module calls when the app has `app/locales`, stays in `@sidioralabs/rex/client`. `rex migrate --from 0.1` moves those names out of `@sidioralabs/rex/client` imports (the `0.1-schema-entry` codemod).

Budgets are measured on the fully minified production entry chunk alone (`bundleBudgetEntry` in `src/vite/budgets.ts`): core 15 KB gzip, client 30 KB, edge 40 KB. Every chunk an entry loads lazily (the palette menu, devtools, overlay hosts) is measured on its own against 10 KB, since it never ships before first use. `src/size.test.ts` prints and asserts both.

The build (`pnpm -C packages/rex build`) runs `tsc -p tsconfig.build.json`, copies `client/tokens.css`, `client/agent/density.css` and `vite/rex-app.d.ts` into `dist/`, and reinstalls the workspace offline so the demo's `rex` bin links to `dist/cli/index.js`. `src/server/node.ts` (the Node server used by `rex build`) and `src/store/drizzle.ts` are not re-exported by any entry; `rex build` imports `node.ts` by file path.

## The wire protocol

`packages/rex/src/core/protocol.ts` holds the names both sides use:

| Constant | Value |
| --- | --- |
| `REX_RPC_PREFIX` | `/rex/rpc` |
| `REX_MANIFEST_PATH` | `/rex/manifest` |
| `CONFIRM_PROCEDURE` | `_confirm` |
| `REX_CONFIRM_HEADER` | `x-rex-confirm` |
| `REX_ACTOR_HEADER` | `x-rex-actor` |
| `REX_DENSITY_HEADER` | `x-rex-density` |
| `RESERVED_QUERY_KEYS` | `act`, `input`, `draft`, `density` |

The server adds `HEALTH_PATH` (`/rex/health`) and `FLOW_RPC_PREFIX` (`/rex/flow`).

## Server

`createRexServer(options)` in `packages/rex/src/server/index.ts` returns a Hono app.

```ts
createRexServer({
  registry,        // entities, actions, pages, policies, flows (a RegistrySnapshot works)
  ledger,          // Ledger, for example memoryLedger()
  actor,           // (request: Request) => Actor | Promise<Actor>
  app?,            // app name for the manifest
  confirmTtlMs?,   // confirm token lifetime, default 60000
});
```

Routes:

| Route | Behaviour |
| --- | --- |
| `GET /rex/manifest` | the manifest built once from the registry, as stable JSON; header `x-rex-actor` with the resolved actor as URI-encoded JSON; header `x-rex-density` only when the request sent it |
| `GET /rex/health` | `{"status":"ok"}` |
| `/rex/rpc/*` | the oRPC `RPCHandler` over the action router; every matched response carries `x-rex-density` |
| `/rex/flow/*` | the flow procedures `status`, `start` and `decide` (`mountFlows`) |

For each `/rex/rpc` and `/rex/flow` request, `createRexContext` builds the `RexContext`: the actor from the resolver, the density from `x-rex-density` (400 for an unknown value), and the confirm token from `x-rex-confirm`.

`buildActionRouter` (`packages/rex/src/server/router.ts`) creates one procedure per action, named by the action id, plus `_confirm`. An action id equal to `_confirm` or a duplicate id throws. Each action procedure runs, in order:

1. the audit middleware, which times the call and appends one audit record in a `finally` block, with outcome `ok` or the error code;
2. the policy check, which throws `FORBIDDEN` with the reason code in the error data;
3. input validation with the action's input schema;
4. for irreversible actions, consumption of the confirm token (`PRECONDITION_REQUIRED`, HTTP 428, on failure);
5. the handler, called with the parsed input and `{ actor }`;
6. output validation with the output schema.

On Node, `startNodeServer(app, { port, clientDir, hostname? })` (`packages/rex/src/server/node.ts`) wraps the app: static files from `clientDir` for `GET` and `HEAD` outside `/rex`, an `index.html` fallback for paths without a file extension, and everything else to the app.

## The Vite plugin and virtual modules

`rex(options)` from `@sidioralabs/rex/vite` returns the Rex plugin followed by `@vitejs/plugin-react`. Options: `appDir` (default `app`), `name` (default: the `name` in the app's `package.json`, else `app`), and `server`, a fetch app or a function from the Vite dev server to one.

It provides two virtual modules:

- **`rex:app`** (resolved id `\0rex:app`). `scanApp(root, appDir)` lists the declaration files in `entities/`, `actions/`, `policies/` and `flows/` and every page folder (which must hold `page.ts`, `view.tsx` and `states.tsx`), with its `regions/<name>/region.tsx` files and `overlays/*.tsx` files. `generateAppModule` writes a module that imports all of them, collects every exported declaration of the right kind (a declaration file that exports none is an error), checks that each `page.ts` exports exactly one page whose id matches its folder, requires default exports from views, regions and overlays, and exports `entities`, `actions`, `policies`, `flows`, `pages`, `registry` (a frozen registry), `manifest` (`buildManifest(registry, { app: name })`), `app` and a default export of the same bundle (`RexAppBundle`). `rex-app.d.ts` types the module for apps.
- **`/@rex/entry`** (resolved id `\0rex:entry`), the script `index.html` loads. `generateEntryModule` imports `tokens.css` and `agent/density.css`, finds `#root`, and renders `createRexEntry(app)` inside `StrictMode`.

In dev, the plugin watches `app/`: adding or removing a file or folder invalidates `rex:app` and sends a full reload. When `server` is set, requests whose path starts with `/rex` are passed to its `fetch`, after copying a `density` query parameter into the `x-rex-density` header.

## Client runtime

`createRexEntry(bundle, options?)` (`packages/rex/src/client/app.tsx`) is what the generated entry renders:

```
RexApp                         createRexApp({ registry, manifest, density: DensityProvider })
  QueryClientProvider
    RexRuntimeContext          registry, manifest, actor, oRPC client, density header
      DensityProvider          data-rex-density on <html>
        AgentShell
          ConfirmProvider      the confirmation dialog
            Shell              header, nav, back, recovery, outcome slot
              RexRoutes        one wouter <Route> per page, plus not-found
                PageHost       data state, <main data-rex-page>, view or state component
                  view -> Region (<section data-rex-region>) -> parts
                AgentOutcome   OutcomeRegion, RexSidecar, PageInvokers { RexPalette, RexShortcuts, RexUrlInvoke }
```

**Startup.** `createRexApp` builds an oRPC client with an `RPCLink` to `/rex/rpc` that adds `x-rex-confirm` when a call carries a confirm token. Unless both a manifest and an actor are passed in, it fetches `GET /rex/manifest` at mount, takes the actor from `x-rex-actor` (the anonymous actor when the header is absent) and the density from `x-rex-density`, and checks that the manifest and the registry list the same pages and actions. While loading it renders "Loading app"; on failure it shows the error and a Retry button.

**Routing.** `RexRoutes` orders page routes so that longer and more static routes match first and renders one wouter `Route` per page. For the matched page it resolves the params (route params and non-reserved query keys, coerced and validated with the page's params schema) and evaluates the page policy. `useNav()` returns `to(page, params)`, `replace(page, params)`, `href(page, params)` and `back()`, each validated against the target page's params schema and returning a `NavOutcome`; `back()` follows `chrome.back` and carries over params the target accepts.

**Shell.** `Shell` derives everything from page declarations: the header shows `chrome.title` and a back button when `chrome.back` is set; the nav lists pages whose `chrome.nav` is true and whose params accept `{}`; a page whose policy denies the actor gets a recovery button when it declares `recovery`. There is no per-page switch.

**PageHost.** `PageHost` observes the TanStack queries that have observers while the page is mounted (`usePageQueries`), resolves the data state with `useDataState` (which applies `resolveDataState` and the precedence in `DATA_STATE_PRECEDENCE`), and renders the view when `ready`, the matching `states.tsx` export otherwise, or a built-in `DefaultState` for a state the page does not declare. `retry` refetches the observed queries.

**Regions and actions.** `region(name, render)` wraps its body in `Region`, which renders the addressed section, provides the address scope, and supplies a `ConfirmProvider` if none is above it. The render function's `act(declaration)` is `useRegionAct`: it returns the `useAct` handle (allowed, reason, pending, `controlProps`, the TanStack mutation) with `run` routed through the confirmation flow. `useAct` checks the input and the policy on the client, requests a confirm token for irreversible actions, calls the procedure, validates the output, invalidates the declared query keys, and writes the outcome.

**Layout primitives.** `Page.Stack`, `Page.Grid`, `Page.Section` and `Page.Outcome` accept only token steps: `space` from 1 to 8 (default 3) and `columns` from 1 to 4 (default 2). They render classes such as `rex-stack rex-space-4` styled by `tokens.css`.

## The life of an action

Following a click on the demo's Send button (`examples/demo/app/pages/send/regions/confirm/region.tsx`):

1. The confirm region calls `act(send)` and spreads `controlProps` on the button, which renders `data-rex="send/send"`, `data-rex-allowed` and `disabled` from evaluating `send.policy` for the current actor.
2. The click calls `run({ amount })` (or `run({})` when the amount field is empty). A region's `run` without a confirm token calls `invoke`, which validates the input with `send.input` and checks the policy. A failure here writes the outcome and stops. Because `send` is irreversible, `invoke` continues with confirmation.
3. `invoke` asks the `ConfirmProvider` for confirmation. The dialog `data-rex-confirm="send/send"` opens. Cancel writes `Send cancelled`.
4. On accept, the client calls `_confirm` with `{ action: "send", input }`. The server checks the action, policy and input and returns a token bound to the action, the input digest and the actor.
5. The client calls the `send` procedure at `/rex/rpc/send` with the token in `x-rex-confirm`.
6. The server builds the context from the request (actor from the resolver, density, token). The audit middleware starts timing; the policy check passes; the input is parsed; the token is consumed; the handler runs with `{ actor }`; the output is validated.
7. The audit middleware appends `{ actor, actionId: "send", inputDigest, outcome: "ok", effect: "irreversible", durationMs, at }` to the ledger. A failure at any step appends a record with the error code instead.
8. The client validates the output, invalidates the `["wallet"]` query (so the hooks refetch), and writes `Send succeeded` to the page's outcome store.
9. The outcome region and the sidecar's `outcome` field update, and `window.__rex` is replaced with the new payload.

The shortcut, URL and palette routes join this sequence at step 2 through `PageInvokers`, which holds one invoker per declared action of the active page.

## Checker

`runCheck(root)` (`packages/rex/src/check/rules/index.ts`) calls `discoverApp(root)` to classify every file under `app/` by role, then `runRules(app, defaultRules)`, which runs each rule with a shared `SourceLoader` from `createSourceLoader()`. Rules are declared with `defineRule({ id, description, check })`. The loader parses files with the TypeScript compiler API and caches imports, exports, declaration calls and a static reading of each `page()` call. Rules return findings built with `finding()`; `runRules` sorts them and computes the exit code. Rule ids and messages are in [convention.md](convention.md#what-the-checker-reports).

## Manifest generation

`scanManifest(root)` starts a child Node process with the `tsx` loader, imports the declaration files listed by `declarationFiles(root)`, registers every exported declaration and returns `buildManifest(registry, { app })`. Running in a child process keeps the CLI process free of the app's modules. `renderManifestFiles` produces the JSON (via `stableStringify`) and `AGENTS.md` (via `renderAgentsMd`); `writeManifest` writes both. The `manifest` checker rule uses the same functions to detect stale files.
