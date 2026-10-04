# Changelog

## 0.2.0 (unreleased)

Rex 0.2 brings the framework to the production standard in `spec/rex-v02` (waves 0 to 9). Items are taken from the task commit titles on `main` and `feature/rex-v02` (`git log --format='%s'`), grouped by spec tag.

### Breaking changes (apply with `rex migrate`; details in docs/migration.md)

- The core entry no longer re-exports `z`: import `z` from `zod/mini`, the field helpers from `@sidioralabs/rex/schema`, `defineConfig` from `@sidioralabs/rex/config` and `buildManifest` from `@sidioralabs/rex/manifest` (codemod `0.1-schema-entry`) [7.2, 7.8].
- `rex.config.ts` default-exports `defineConfig({...})`; a bare Hono app export still works and warns `REX101` once (codemod `0.1-config`) [0.2, 5.4].
- Pages render on the server by default; pages that read browser globals while rendering declare `render: "csr"` (codemod `0.1-page-render`) [1.1, 5.4].
- Raw `<img>` in regions and parts becomes `Img` with `width` and `height`; `media/no-raw-img` reports the rest (codemod `0.1-raw-img`) [5.1, 5.4].
- Interop, media and i18n message formatting move to `@sidioralabs/rex/client/interop`, `/client/media` and `/client/i18n` [7.13].
- Runtime dependencies are hono and @orpc/* only; React, react-dom, TanStack Query, Vite, zod and TypeScript are peers and Drizzle, libsql, @hono/node-server, cmdk, wouter, OpenTelemetry, @vitejs/plugin-react, the React Compiler plugin and @tailwindcss/vite optional peers; tsx and commander are gone; Node 22.12 or later [0.4, 8.4].
- Requests to `/rex` other than GET, HEAD and OPTIONS without an allowed Origin are refused with 403 [4.2]; page `chrome.components` is replaced by app-wide `ui.components` [7.1].

### Package, config and core (wave 0)

- Per-concern Vite plugin, server and client modules with ordered hook, route, middleware, provider and shell-slot lists [0.1].
- `rex/config` with `defineConfig`, the error catalog, inline JSON escaping and the 0.2 page, action and request-context options [0.2].
- Validation through the Standard Schema interface, field helpers on zod/mini, manifest JSON Schema with `REX210` [0.3].
- Four runtime dependencies, MIT, types-first exports, an own argument parser and Vite-based module loading [0.4].
- Every page in its own lazily loaded chunk under Suspense with region error boundaries and a budgeted chunk table [0.5].
- The React Compiler enabled in the Vite plugin [0.6].
- Size budgets resolved from rex.config and measured on the core, client and edge entries [0.7].
- zod/mini as the core `z`, Standard Schema page params and drafts, `real` and `json` field kinds, the manifest scan through the Vite module loader [0.8].

### Rendering, loaders, forms and runtimes (wave 1)

- Streaming SSR with hydration, stylesheet links and preloads, a nonce on every inline script and 403/404/500 mapping [1.1].
- Page loaders (`useLoader`, `useLoaders`) run in process during SSR, dehydrated, deduped and invalidated by actions [1.2].
- Static generation and on-demand regeneration; zero-JavaScript `static` pages; a static cache with stale-while-revalidate [1.3].
- `POST /rex/form/:action` with FormData coercion, double-submit CSRF, Origin check, cookie outcomes and a server-rendered confirmation page [1.4].
- Bun, Deno and edge adapters beside Node; `rex/server` is fetch-only [1.5].
- `ActionForm` posting to the form route, enhanced when JavaScript runs [1.6].
- `rex build --target node | bun | deno | edge | static` [1.7].

### Developer experience (wave 2)

- The REX1xx-REX6xx error catalog with source frames in the Vite overlay and the CLI; `docs/errors.md` generated from it [2.1].
- Verified HMR for parts, regions and page declarations [2.2].
- The dev-only devtools overlay and the dev audit route [2.3].
- `rex/testing`: `createTestApp`, `renderPage`, `renderRegion`, `testServer`, `readSidecar` on the real runtime [2.4].
- The `rex/eslint` plugin and flat config, the `rex/prettier` preset, the format rule and the `rex new` lint setup [2.5].
- The wallet tutorial, eight recipes, the migration guide, the versioning policy and the typedoc API reference with `docs:check` [2.6].
- Real demo page and region tests with `rex/testing` and the demo `test:unit` script [2.7].

### State, interop, accessibility, i18n and styling (wave 3)

- `store()` shared state exposed to the sidecar [3.1].
- `defineElement`, `mountRexPage` and `Native`; the `traps/custom-element` rule [3.2].
- Focus to the page heading, a route announcer, View Transitions and the Navigation API [3.3].
- Accessibility checker rules [3.4].
- Internationalisation: per-locale messages, ICU-subset formatting, locale resolution, `/:locale` routing, the `i18n/literal` rule [3.5].
- Tailwind 4 through the Vite plugin; the token rule limited to raw color and spacing literals [3.6].
- The axe-core audit of every demo page and overlay in both densities [3.7].

### Security, observability and supply chain (wave 4)

- `unsafeHtml` as the only raw-HTML path, the `security/unsafe-html` rule and the escaping audit [4.1].
- Origin checks on `/rex`, a nonce-based Content-Security-Policy and companion headers [4.2].
- The client build boundary: action handlers stripped, `REX440` for server imports, `REX441` for leaked secrets [4.3].
- OpenTelemetry spans, trace ids on audit records, a console logger, `onOutcome` and `onNavigate` hooks [4.4].
- The CI workflow, the v*-tag release workflow with npm provenance, the license review script and the audit and license steps in the lint gate [4.5].

### Media, DesignX, platforms, codemods and governance (wave 5)

- `Img`, `Script` and fonts with preloads; `media/no-raw-img` [5.1].
- DesignX installed by `rex new`; shell component overrides [5.2].
- Pages as markdown at `/rex/pages/<id>.md`, credentialed CORS for `security.origins`, platform docs for Electron, Tauri and Capacitor [5.3].
- `deprecated()` and `rex migrate` with the 0.1 codemods [5.4].
- GOVERNANCE, MAINTAINERS, SECURITY, CODE_OF_CONDUCT and FUNDING files linked from the README [5.5].
- `Page.List` paged lists and the `traps/infinite-list` rule [5.6].
- Catalogued `RexError` codes across server, client, Vite, checker and CLI; hints split into `errors.docs.ts` [5.7].
- An audit record for every flow approval decision [5.8].
- `rex check --runtime`: sidecar and DOM parity in happy-dom [5.9].

### Demo and vitals (wave 6)

- The Core Web Vitals and Lighthouse gate on the built demo [6.1].
- The demo on every 0.2 capability: static About, ssg Tokens, loaders, an `ActionForm` send, a shared store, fonts, images, two locales and an embed page; no-JS, form, text-renderer, stylesheet and CSP walks [6.2].
- The demo redesigned on DesignX: sidebar frame, wallet balance card, holdings data-table, two-column send [6.4].

### Integration and budgets (wave 7)

- Integration repair: green typecheck, one request nonce, one Origin rule, config flags wired, SSR from the node adapter, shell overrides through `useShellComponents` [7.1].
- zod out of the core entry, a prebuilt manifest for `rex build` and the edge server, page chunks limited to their folder [7.2].
- `rex/testing` sends the request Origin; the demo page tests pass [7.4].
- Shell components, fonts and locales wired from rex.config into `rex:app`; loader spans [7.5].
- Loaders declare `invalidatedBy`; the testing mount waits for the page [7.6].
- Catalogued errors from core, the manifest scanner and the CLI arguments; peer and demo license review; app-scheme origins [7.7].
- The core entry as the zod-free declaration surface within 15 KB; `rex/schema`, `rex/config`, `rex/manifest` [7.8].
- Client and edge entries free of server code, zod and the config parser [7.9].
- Generated apps formatted as generated; prerendered pages carry the font preloads [7.10].
- SSR from the built node server; server and client suites green [7.11].
- CLI, manifest, Vite and checker suites green [7.12].
- Budgets measured on minified entry chunks; interop, media and i18n behind subpath entries [7.13].
- Codemod output in prettier form, DesignX files written formatted, catalogued CLI usage and Drizzle store errors [7.14].
- The CSRF token through SSR documents; ssg and static loaders at prerender [7.15].
- Interaction-time surfaces (confirmation, overlay host, flow gate, error and not-found renderers, message formatter) load lazily [7.16].
- `rex build` produces production bundles: the config load no longer leaks a development `NODE_ENV`, the build runs in production mode from the check step through the prerender, and the demo entry chunk falls from 682 KB to 426 KB [7.19].
- The `ActionForm` markup and the `Page.List` window load lazily as type-only leaf modules; docs/architecture.md defines the first paint and names every lazy surface [7.20].
- The client budget measured on the `startRexEntry` runtime; the store registry, page states context, `Page.Outcome` frame and message formatter wiring move out of the surface modules so every exported-only `rex/client` surface tree-shakes away [7.21].

### Freshness (wave 8)

- The tutorial, development, migration and versioning guides and the recipes match the code: loaders, the `ActionForm` send, DesignX parts and the `rex new` output; the codemod tables gain `0.1-schema-entry` [8.7].
- The README, the package manifests and the community files match the code; `@sidioralabs/rex` ships a package README and LICENSE and declares `repository`, `homepage` and `bugs`; `rex new --ui designx` groups the data-table column menu label so the View menu opens on Base UI 1.8 [8.4].

### Shell frame, screen fit and the DesignX standard (wave 9)

- A finished default shell frame with an app bar, addressed navigation and a palette trigger; `Frame` and `Nav` as overridable slots [9.0].
- Screen, pointer and density classified on the document root from Client Hints and matchMedia; fluid tokens with 44 px coarse targets; overlays as dialog or bottom sheet and navigation as bar, sidebar or dock by screen [9.1].
- `rex/designx`: the surface-to-registry map and the standard set installed and generated by `rex new --ui designx` [9.2].
- The `ui/designx-primitive`, `layout/fixed-size` and `layout/touch-target` checker rules after the format rule, with `REX509` to `REX511` in the error catalog and the screen-fit contract in docs/convention.md [9.3].
- Prerendered pages carry the root attributes and the static cache rewrites them per request; the walks fit static and SSR pages [9.5].

### Process

- The Rex 0.2 production-standard spec with every framework standard mapped to an owning task; its restructuring for one worker per task; the integration tasks 7.1-7.21 and the re-qualification of every implemented task on the merged branch [7.3]; requirement 36 and wave 8 (full CI pipeline, coverage, repository lint); requirements 37 and 38 with wave 9 (screen fit, DesignX standard); the zod-boundary and license-scope decisions.

## 0.1.0 (2026-10-04)

The first version of Rex, delivered in waves 0 to 6. Every item below is taken from the commit titles on this branch (`git log --format='%s'`); the task tags are in brackets.

### Workspace

- Scaffold the pnpm workspace and the `@sidioralabs/rex` package [0.1].

### Core primitives (wave 0)

- Deterministic identifiers, address helpers and zod field helpers with JSON Schema output [0.2].
- The Entity primitive, the store adapter interface, the memory store and the store conformance suite [0.3].
- The Actor type, the Policy primitive and pure predicate evaluation with stable reason codes [0.4].
- The Action primitive with shortcut validation and the declaration registry with deterministic ordering [0.5].
- The Page declaration, the nine data states, the states module contract and overlay declarations [0.6].
- Manifest types, the deterministic manifest builder and the sidecar JSON schema with validation [0.7].
- The Flow primitive with the journal interface, the memory journal and approval gates [0.8].

### Server and storage (wave 1)

- The audit ledger with Web Crypto input digests and filtered listing [1.1].
- The oRPC action router with policy gating, confirm tokens for irreversible actions and audit records [1.2].
- `createRexServer` on Hono with the RPC handler, manifest and health routes and header-derived context [1.3].
- The Node server entry serving client assets with an `index.html` fallback beside the `/rex` API [1.4].
- The Drizzle SQLite store adapter mapping entity fields to columns and passing store conformance on libsql [1.5].

### Client runtime (wave 2)

- The client app provider with manifest startup, actor resolution and the oRPC client [2.1].
- The declaration-derived wouter router, typed navigation and URL drafts [2.2].
- The act hook with client policy gating, confirm tokens and query invalidation, and the per-page outcome store [2.3].
- Data state resolution with documented precedence and the `useDataState` hook [2.4].
- `view`, `region`, `Region` and the `PageHost` that resolves data states from observed page queries [2.5].
- Token-only `Page` layout primitives and the token stylesheet with agent density overrides [2.6].
- The derived shell with chrome-driven header, nav, back and recovery controls [2.7].

### Checker and manifest (wave 3)

- The checker engine with app discovery, the rule interface, the source loader and findings formatters [3.1].
- The import boundary rule enforcing the import table, the cross-page ban and direct data access from components [3.2].
- The parity and states rules checking regions, overlays, actions and state exports against `page.ts` [3.3].
- The naming, trap and token rules for file names, single exports, agent traps and token-only styling [3.4].
- Manifest and `AGENTS.md` generation from source through a tsx child process, and the freshness rule [3.5].
- The typecheck rule, the default rule set and `runCheck` for the CLI [3.6].

### Vite plugin and CLI (wave 4)

- The `rex` Vite plugin with the `rex:app` virtual module, the `/@rex/entry` client entry and the `/rex` dev API mount [4.1].
- The `rex` CLI skeleton with commander, command module discovery and the canonical file templates [4.2].
- `rex make` for page folders, page files and declarations with overwrite refusal [4.3].
- `rex new` and `rex promote`, typing of the `rex:app` module, and the client runtime and `runCheck` exports from the package entries [4.4].
- `rex dev`, `rex build`, `rex check` and `rex manifest` with the check gate, and a main guard in place of the CLI's top-level await [4.5].

### Agent contract (wave 5)

- One wire protocol in `core/protocol.ts`, with the actor and density headers sent on the manifest response [5.0].
- `useAddress`, address scopes and attribute helpers for deterministic `data-rex` addressing [5.1].
- The `RexSidecar` affordance payload with the overlay and affordance registries and the `window.__rex` mirror [5.2].
- The `OutcomeRegion` live region with action label, result, message and dismiss for the shell outcome slot [5.3].
- The cmdk palette, declared shortcuts, URL `act` invocation and the confirmation overlay shared by all four routes [5.4].
- Density resolution, the `DensityProvider` root attribute and agent density overrides for motion, groups and hit targets [5.5].
- `overlay()` with registry or URL bound open state, declared dismissal, focus trap and focus restoration [5.6].
- Flow approval gates as sidecar and palette affordances on the owning page, with flow procedures on the server [5.7].

### Runtime assembly, demo and operability walk (wave 6)

- The generated entry mounts the shell, confirmation and agent surfaces; region actions go through confirmation; flows are mounted on the server; the agent modules are exported [6.0].
- The `rex dev` entry assertion updated to the assembled `createRexEntry` mount [6.0].
- The wallet demo built with `rex new` and `rex make`, with its manifest and `AGENTS.md` committed, and the `rex` bin built and linked from `dist` [6.1].
- The Playwright operability walk that builds and serves the demo and drives every action by click, key, URL and palette in both densities [6.2].

### Process

- The Rex spec, the workflow contract and the fleet gates.
- The demo gates keyed on `rex.config.ts` so an empty scaffold directory cannot trigger them; the test gate scoped to built packages.
- Task 5.0 added to unify the wire protocol; task 6.0 added for runtime assembly, with the `rex` bin built in the gates.
- Review findings routed into tasks 4.1, 4.4, 4.5, 5.6 and 5.7.
