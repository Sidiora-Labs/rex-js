# Decisions and open qualifications

Status: design, not implementation evidence. Requirements and task statuses are in [spec.kvx](spec.kvx).

## Fixed constraints

| ID | Constraint | Consequence |
|---|---|---|
| D01 | The audit of `5fe1aa2` is the input and stays outside the repository | Tasks cite audit item numbers and state required behaviour. No exploit detail is committed. |
| D02 | One wave manager per wave, one worker per task, one writer to `main` | Work merges upward only: task branch into wave branch, wave branch into `main` behind both gates. |
| D03 | Wave 0 lands alone and first | No later wave can prove anything while the gates on `main` are red. |
| D04 | Shared interfaces are declared before they are built | Each interface in [interfaces.kvx](interfaces.kvx) has one provider. A consumer waits for it. |
| D05 | A worker edits only the paths in its `touches` | A needed path is widened with a reason and reviewed. Shared registries are append-only. |
| D06 | One typecheck and one `verify_cmd` per task, two repair cycles at most | Suites, browser runs and gates run once per wave on the merged head. |
| D07 | No check is weakened | A conflict between code and a check is logged and left intact. |
| D08 | The one-declaration model holds | New capability extends a declaration or the configuration schema. No parallel mechanism, no server components, no file-system routing. |
| D09 | Publication is human-only | Registry changes, tags, branch protection, repository settings and DNS live in [asks.kvx](asks.kvx). |
| D10 | The spec folder and the house commit format stay | Directed by the repository owner. The audit's hygiene items are adopted only as an open contribution path. |
| D11 | The server decides | Authorization, confirmation, the human gate, flow advance and audit are enforced on the server. |
| D12 | The last wave documents what landed | Guides and the changelog are written against merged behaviour. |
| D13 | The server-rendered sidecar of a page whose loaders resolved reports the page data state, and hydration alone never changes it | A declared browser-only affordance that has not registered is listed as not allowed with its reason and holds the state at loading until it registers. This supersedes the pre-hydration loading rule introduced with the hydration flag in the 0.3.0 changelog commit. Decided by rex-main on 2026-11-09 while qualifying task 0.5; flagged for human review. |

## Proposed choices

Each proposal is the starting point for its task. It becomes settled only when the named evidence exists.

| ID | Proposal | Task | Evidence needed |
|---|---|---|---|
| P01 | A `rex-source` export condition gives workspace packages source while the registry sees `dist` | 0.2 | A packed tarball imports every entry; workspace tests still resolve source. |
| P02 | Registry items are vendored and pinned by content hash | 0.6 | The default scaffold succeeds with the registry host unreachable. |
| P03 | A URL may prefill an action surface and never invoke it | 1.1 | A page load with action parameters sends no request. |
| P04 | Actor kind is `human`, `agent` or `service`, set by the resolver | 1.2 | The server rejects a gated action from an agent actor. |
| P05 | The durable ledger and journal are append-only files with rotation | 1.4, 1.6 | Entries survive a restart; two concurrent advances run a step once. |
| P06 | Sessions use Web Crypto so every runtime adapter works | 2.2 | Tamper, rotation and expiry tests pass on the Node adapter; other runtimes are future evidence. |
| P07 | Server rendering streams with the React streaming API; if not qualified, the claim is removed | 2.4 | The first chunk arrives while a suspended loader is pending. |
| P08 | One small key-value interface backs every shared store | 2.7 | Two application instances behave as one for tokens, journal and cache. |
| P09 | Migrations are ordered files with a checksum history | 3.1 | Re-run is a no-op; a changed applied migration is detected. |
| P10 | PostgreSQL is tested against a real server process started by the test | 3.2 | The conformance suite passes against it. |
| P11 | Layouts nest by path prefix through one `layout` declaration | 4.2 | A layout stays mounted across child navigation. |
| P12 | User Vite settings merge through one function that guards invariants | 5.1 | A user plugin runs in dev, both builds and prerender. |
| P13 | Host adapters are validated against documented layouts and a local workerd | 5.4 | Layout tests pass; a live deployment per host is future evidence. |
| P14 | Heuristic checker rules default to warning | 6.1 | The demo and the site still pass `rex check` with no new suppression. |
| P15 | The sidecar schema moves to version 2 with a compatibility rule | 7.1 | The conformance suite passes against the demo. |
| P16 | The public API is trimmed with one minor of deprecated re-exports | 8.1 | The API report gate passes; the demo and the site compile. |

## Open qualifications

These cannot be settled inside this feature and are not claimed anywhere in it.

| ID | Question | Why it stays open |
|---|---|---|
| Q01 | Do the Bun, Deno and workerd smoke jobs pass in CI? | They need hosted runners. Task 0.11 declares them; the first green run is the evidence. |
| Q02 | Do the Windows and macOS matrix legs pass? | Same reason. Local evidence covers Linux only. |
| Q03 | Does each host adapter deploy and serve on its real host? | Needs host accounts. Recorded as future evidence in [verification.md](verification.md). |
| Q04 | Does TypeScript 7 pass the checker? | Task 0.9 records the result per major; a failing major stays out of the peer range. |
| Q05 | Is the published 0.4.0 importable from the registry? | Publication is an Ask. Task 0.11 adds the job that will prove it. |
