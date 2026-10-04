# Changelog

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
