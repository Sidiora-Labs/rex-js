# Primitives

Rex has five declarations, all imported from `@sidioralabs/rex`: `entity()`, `action()`, `page()`, `policy()` and `flow()`. Each takes a name and exactly one declaration object, validates it when it is called, and returns a frozen declaration with `kind`, `id` and `name`. A malformed declaration throws `RexDeclarationError`, a `RexError` with a catalogued code (`REX211` to `REX216` by declaration kind, see [errors.md](errors.md)), the declaration kind, the id and the field name, for example `action "send": field "effect" must be one of reversible, irreversible, read`. Unknown keys in the declaration object are rejected. Declarations contain no React code and import from both server and client bundles.

The manifest is the sixth piece: a generated description of all declarations.

Sources: `packages/rex/src/core/*.ts`, `packages/rex/src/manifest/*.ts`, `packages/rex/src/server/audit.ts`, `packages/rex/src/store/drizzle.ts`.

## Client entries

Components, hooks and the runtime come from `@sidioralabs/rex/client`. Optional capabilities have their own entries so the client entry stays within its 30 KB budget: `@sidioralabs/rex/client/interop` (`defineElement`, `mountRexPage`, `Native`), `@sidioralabs/rex/client/media` (`Img`, `Script`, `loadScript`) and `@sidioralabs/rex/client/i18n` (`useT`, `useLocale`, `t`, `formatMessage`). The checker's import table admits each of them wherever it admits `@sidioralabs/rex/client`, with the same rule for hooks. A budget is measured on the first paint of the fully minified production entry, the entry chunk plus every chunk it imports statically; each lazily loaded chunk is measured on its own against 10 KB. The client budget applies to the runtime an app ships (`createRexEntry` and `startRexEntry`), and every surface `@sidioralabs/rex/client` only exports (overlay, flow, address, store, boundary, form, list) tree-shakes away from an app that does not import it, so importing a primitive is what ships it.

## Names and ids

The declaration id is the name you pass. Names must start with a lowercase letter and contain only lowercase letters, digits, dot and dash (`validateName`); otherwise `RexNameError` (code `REX218`) is raised and reported as a `RexDeclarationError` on the `id` field. Overlay ids are PascalCase (`validateComponentName`).

`createRegistry()` collects declarations: `register(...declarations)` adds them (registering the same object twice is a no-op; a different declaration with an existing id throws "is already registered by another `<kind>`"), `has(kind, id)` tests membership, and `freeze()` returns a `RegistrySnapshot` with `entities`, `actions`, `pages`, `policies` and `flows` sorted by id, plus `find(kind, id)` and `get(kind, id)` (which throws for an unknown id). The generated `rex:app` module builds the app's registry this way.

## Field helpers

Field helpers live in `@sidioralabs/rex/schema` (`packages/rex/src/schema/fields.ts`). They are built on zod/mini and tag the schema with a field kind (`x-rex-field` metadata). Apps import `z` from `zod/mini` themselves; the core entry `@sidioralabs/rex` imports no zod and exports neither `z` nor the helpers:

```ts
import { action } from "@sidioralabs/rex";
import { money, text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
```

| Helper | Schema |
| --- | --- |
| `id()` | string, 1 to 128 characters, matching `ID_PATTERN` (`/^[A-Za-z0-9][A-Za-z0-9._:-]*$/`) |
| `text(options?)` | string with optional `min` and `max` length (`TextOptions`) |
| `money()` | decimal string matching `MONEY_PATTERN` (`/^-?(0\|[1-9][0-9]*)(\.[0-9]+)?$/`) |
| `integer(options?)` | integer with optional `min` and `max` (`IntegerOptions`) |
| `boolean()` | boolean |
| `enumOf(values)` | one of the listed strings; duplicates throw |
| `ref(target)` | id string referring to another entity (`target` is an entity name or an object with `id`) |
| `timestamp()` | ISO datetime string |

`FieldKind` is the union of the field kinds. `fieldKind(schema)` and `refTarget(schema)` read the tags back. Declarations accept any Standard Schema and validate through `~standard.validate`; JSON Schema is derived only when the manifest is built, by `toJsonSchema(schema, io?)` and `buildManifest` in `@sidioralabs/rex/manifest`. `defineConfig` lives in `@sidioralabs/rex/config`.

## entity()

```ts
entity<N, F, K>(name: N, config: EntityConfig<F, K>): EntityDeclaration<N, F, K>

interface EntityConfig<F, K> {
  fields: F;                                  // { [field]: zod schema }, at least one
  label: (record: EntityRecord<F>) => string; // display label for a record
  key?: K;                                    // key field, default "id"
}
```

Field names are camelCase. The key field must be a required string field (`id`, `text`, `ref` or a plain zod string). The declaration exposes `fields` (the declared field schemas), `fieldKinds`, `key`, `schema` (a Standard Schema object validating the fields, with the fields as `shape`), `label(record)`, `parse(value)` and `keyOf(record)`. `InferEntity<typeof myEntity>` is the record type.

```ts
export const token = entity("token", {
  fields: { id: id(), symbol: text({ min: 1, max: 12 }), name: text({ min: 1 }), balance: money(), priceUsd: money() },
  label: (record) => `${record.name} (${record.symbol})`,
});
```

## action()

```ts
action<N, I, O>(name: N, config: ActionConfig<I, O>): ActionDeclaration<N, I, O>

interface ActionConfig<I, O> {
  input: I;                    // zod schema
  output: O;                   // zod schema
  policy: Predicate;           // from always(), never(), can(), requires(), allOf(), anyOf() or a policy
  effect: "reversible" | "irreversible" | "read";
  label?: string;              // non-empty; shown in the palette and outcome
  shortcut?: string;           // for example "shift+t" or "mod+enter"
  invalidates?: string[];      // TanStack query keys to invalidate after success
  handler: (input, ctx: ActionContext) => output | Promise<output>;
}

interface ActionContext { actor: Actor }
```

The declaration adds `label` and `shortcut` as `string | null` and `invalidates` (deduplicated), and keeps the declared `input` and `output` schemas. `buildManifest` derives their JSON Schema, or uses a declared `jsonSchema` override, and throws REX210 naming the action when neither is possible.

Shortcuts are parsed by `parseShortcut`: modifiers from `mod`, `shift`, `alt` in that order, then one key (a lowercase letter, digit, punctuation key or named key such as `enter`, `escape`, `space`, `tab`, `arrowup`, `f1`). `mod+k` and `escape` are reserved (`RESERVED_SHORTCUTS`). `ActionInput<A>`, `ActionParsedInput<A>` and `ActionOutput<A>` extract the types.

An action with `effect: "irreversible"` requires confirmation on every invocation route; see [agent-contract.md](agent-contract.md#confirmation-protocol).

## page()

```ts
page<N, P, S, R, O, A>(name: N, config: PageConfig<P, S, R, O, A>): PageDeclaration<N, P, S, R, O, A>

interface PageConfig {
  route: string;                     // "/", "/send", "/orders/:orderId"
  params?: ZodObject;                // must declare every route param as required; default z.object({})
  policy?: Predicate;                // default always()
  recovery?: string;                 // page id offered when the policy denies the actor
  draft?: "route" | "session" | "none"; // default "none"
  actions?: ActionDeclaration[];     // no repeats
  chrome?: { header?: boolean; nav?: boolean; back?: string | null; title?: string };
  regions?: string[];                // region names, no repeats
  overlays?: { id: string; dismiss: "escape" | "button" | "both"; binding: "region" | "url" }[];
  states?: RexDataState[];           // must include "ready"; default all nine
}
```

Chrome defaults: `header: true`, `nav: true`, `back: null`, and a title derived from the id (`titleFromId`: `send-money` becomes "Send money"). `recovery` and `chrome.back` must name a different page; `buildManifest` checks that the target exists. The declaration adds `routeParams` and `states` in canonical order and keeps the declared `params` schema; `buildManifest` derives its JSON Schema. `PageParams<P>`, `PageParamsInput<P>`, `PageStates<P>` and `PageStatesModule<P>` extract types; `PageStatesModule` is the type `states.tsx` must satisfy.

Draft modes, used by `useDraft(schema)` in `@sidioralabs/rex/client`:

- `route`: the draft is JSON in the `draft` query parameter, so a reload restores it;
- `session`: the draft is stored in `sessionStorage` under `rex:draft:<page>`;
- `none`: setting a draft throws.

### Data states

`REX_DATA_STATES` is `loading`, `empty`, `stale`, `partial`, `offline`, `permission-denied`, `recoverable-error`, `terminal-error`, `ready` (`RexDataState`). `NonReadyState` excludes `ready`. `STATE_EXPORT_NAMES` maps each to its `states.tsx` export (`permission-denied` to `PermissionDenied`, and so on); `requiredStateExports(states)` lists the exports a page needs. State components receive `StateProps`: `{ params, retry, error }`.

## policy()

```ts
policy<N, P>(name: N, config: PolicyConfig<P>): PolicyDeclaration<N, P>

interface PolicyConfig<P> {
  permissions: P[];                       // non-empty, unique, valid names
  resolve: (actor: Actor) => Iterable<P>; // the permissions granted to an actor
}
```

The declaration provides `granted(actor)` (throws if `resolve` returns an undeclared permission), `can(permission)` and `requires(clause)`. Predicates can also be built without a policy, in which case permissions are read from `actor.permissions`:

| Builder | Allows when |
| --- | --- |
| `always()` | always |
| `never()` | never (reason `never`) |
| `can(permission)` / `myPolicy.can(permission)` | the permission is granted (reason `missing-permission:<permission>`) |
| `requires({ unlocked?, account?, custody?, permissions? })` / `myPolicy.requires(...)` | `unlocked: true` needs `actor.attributes.unlocked === true` (reason `locked`); `account: true` needs a non-empty `actor.attributes.account` (reason `no-account`); `custody` needs `actor.attributes.custody` to be one of the listed values (reason `custody-mismatch`); then every listed permission |
| `allOf(...predicates)` | every predicate allows; returns the first denial |
| `anyOf(...predicates)` | one predicate allows; otherwise the first denial |

`evaluate(predicate, actor)` returns `PolicyResult`: `{ allowed: true, reason: null }` or `{ allowed: false, reason }`. `predicateToJson` is the form written to the manifest. The server, the client controls, the palette and the sidecar all call the same `evaluate`.

Actors are built with `actor({ id, roles?, permissions?, attributes? })`; `anonymousActor` has id `anonymous`.

## flow()

```ts
flow<N>(name: N, config: FlowConfig): FlowDeclaration<N>

interface FlowConfig {
  steps: (ActionStepConfig | ApprovalStepConfig)[]; // non-empty
  journal: Journal;
}
interface ActionStepConfig { action: ActionDeclaration; input: (ctx: FlowStepContext) => unknown }
interface ApprovalStepConfig { approval: string; label: string; approvers: Predicate }
interface FlowStepContext { actor: Actor; input: unknown; outputs: unknown[] }
```

`runFlow(flow, instanceId, { actor, input? })` opens or resumes an instance in the journal and runs from the first incomplete step. An action step evaluates the action's policy, parses the step input, runs the handler and records the output; an error records a `failed` entry and stops with status `failed`. An approval step records `paused` and returns with the gate. `decide(flow, instanceId, "approve" | "reject", actor)` requires a pending gate (otherwise a `FlowDecisionError`, the `RexError` with code `REX333`) and an actor allowed by `approvers` (otherwise code `REX334`, with the denial `reason`), records the decision, and either resumes the flow or ends it as `rejected`.

Flow statuses are `running`, `paused`, `completed`, `rejected`, `failed`. The `Journal` interface has `open`, `record`, `load` and `list`; journal entries are `step`, `paused`, `decision`, `failed` and `completed`. `memoryJournal()` is the in-memory implementation.

## Stores

`Store<T>` (`packages/rex/src/core/store.ts`):

```ts
interface Store<T> {
  get(id: string): Promise<T | undefined>;
  list(query?: { filter?: Partial<T>; page?: number; size?: number }): Promise<{ items: T[]; page: number; size: number; total: number }>;
  put(record: T): Promise<T>;
  delete(id: string): Promise<boolean>;
}
```

Pages start at 1; `size` defaults to 50 (`DEFAULT_PAGE_SIZE`) and may not exceed 500 (`MAX_PAGE_SIZE`). Filters match fields by equality. `bind(entity, store)` returns an `EntityStore` that validates ids, rejects unknown filter fields, and parses records with the entity schema on `put`.

- **Memory.** `memoryStore(entity, seed?)` keeps records in a map keyed by `entity.keyOf`, returns copies, and lists in key order.
- **Drizzle.** `drizzleStore(entity, db, { table?, createTable? })` in `packages/rex/src/store/drizzle.ts` maps an entity to a SQLite table on an async Drizzle database (libsql in the tests). The table name defaults to the entity id with dots and dashes replaced by underscores. Column types follow the field kind (`id`, `text`, `money`, `enum`, `ref`, `timestamp` as text, `integer` as integer, `boolean` as integer in boolean mode, other numbers as real, other values as JSON text). The key field is the primary key. Unless `createTable` is `false`, it runs `CREATE TABLE IF NOT EXISTS` before the first query. `put` is an upsert. A field that is both optional and nullable and a table name that is not lowercase snake_case are rejected with a `RexError` coded `REX329`, and a list filter on an undeclared field with `REX305`, as in the memory store. This module is not exposed by the package exports map in 0.1.0.

Both adapters are tested against the shared conformance suite in `packages/rex/src/core/store.conformance.ts` (`runStoreConformance`).

## The audit ledger

Every call to an action procedure writes one audit record (`packages/rex/src/server/audit.ts`):

```ts
interface AuditRecord {
  id: string;            // "audit-000001", ... in memoryLedger
  actor: string;         // actor id
  actionId: string;
  inputDigest: string;   // lowercase hex SHA-256 of the canonical JSON of the input
  outcome: string;       // "ok" or an UPPER_SNAKE error code such as FORBIDDEN or BAD_REQUEST
  effect: "reversible" | "irreversible" | "read";
  durationMs: number;
  at: string;            // ISO timestamp of the call start
}
```

Raw input is never stored; `digest(input)` hashes `canonicalJson(input)` (keys sorted) with Web Crypto. The `Ledger` interface is `append(entry)` and `list(filter?)`, where the filter has `actor`, `actionId`, `outcome` (`"ok"`, `"error"` for any failure, or a specific code), `from` (inclusive) and `to` (exclusive). `memoryLedger()` keeps records in memory and lists them by time. A handler failure, a policy denial and a validation error all write a record with the error code.

## The manifest

`buildManifest(source, { app? })` from `@sidioralabs/rex/manifest` turns registered declarations into a `Manifest` (`packages/rex/src/manifest/types.ts`):

```ts
interface Manifest {
  version: 1;
  app: { name: string };
  entities: { id; key; fields: { name; kind; ref; required }[]; schema }[];
  actions: { id; label; shortcut; effect; invalidates; policy; input; output }[];
  pages: { id; route; routeParams; params; policy; recovery; draft; chrome; regions; overlays; states; actions }[];
  policies: { id; permissions }[];
  flows: { id; steps: ({ kind: "action"; action } | { kind: "approval"; id; label; approvers })[] }[];
}
```

Every list is sorted by id, page actions are listed by id, and `stableStringify` writes keys in sorted order, so the output is deterministic. `buildManifest` throws when a page lists an unregistered action or names an unknown page in `recovery` or `chrome.back`.

`rex manifest` writes the manifest to `.rex/manifest.json` and renders `AGENTS.md` from it (pages, actions, entities, policies, flows and the folder convention). `scanManifest(root)` loads the declaration files in a child Node process with `tsx` (60 second timeout); `writeManifest(root)` writes both files. The server serves the same manifest at `GET /rex/manifest`, and the client checks at startup that the manifest and the registry list the same pages and actions.

## Shell components

The derived shell renders through six slots, the `ShellComponents` interface in `packages/rex/src/client/shell/components.ts`. `rex.config.ts` `ui.components` names a module under `app/components` that exports any of them by name; `registerShellComponents` resolves the module app-wide (an export that is not a component, or a module exporting none of the six, is `REX120`) and every slot not exported keeps its token-styled default. `useShellComponents()` and `ShellComponentsProvider` read and scope the resolved set.

| Slot | Props | Default |
| --- | --- | --- |
| `Button` | `ShellButtonProps` (button attributes) | `TokenButton`, a plain `button` |
| `Sheet` | `ShellSheetProps`: `address`, `title`, `titleId`, `form` (`dialog` or `bottom-sheet`), `children` | `TokenSheet`, the overlay title and body |
| `PaletteItem` | `ShellPaletteItemProps`: `kind`, `id`, `label`, `detail`, `shortcut`, `allowed`, `reason` | `TokenPaletteItem` |
| `Outcome` | `ShellOutcomeProps`: `page` | `TokenOutcome`, the outcome message |
| `Frame` | `ShellFrameProps`: `appName`, `links`, `palette`, `children` | `TokenFrame`, the app bar over the content area |
| `Nav` | `ShellNavProps`: `links`, `form` (`bar`, `sidebar` or `dock`) | `TokenNav`, a list of page links |

`Frame` receives the app name from the manifest, the navigation links of the active page, the palette trigger and, as `children`, the page header (the `h1` with the page title and the back control), the outcome region, the page body with its `main` landmark, the recovery control and the route announcer. A `ShellNavLink` is `{ id, label, href, current, address, onClick }`: `current` marks the active page (render it as `aria-current="page"`), `address` is the page id for the `data-rex-nav` attribute (`NAV_ADDRESS_ATTRIBUTE`) and `onClick` performs the client-side navigation. `palette` is `{ label, shortcut, address, onOpen }` when the agent outcome mounts the command palette and `null` otherwise; render it as a button carrying `data-rex-palette-trigger` (`PALETTE_TRIGGER_ATTRIBUTE`) and the visible shortcut (`useShortcutText(shortcut)` gives `Ctrl K`, or `⌘K` on Apple platforms, and `ariaKeyShortcuts(shortcut)` the `aria-keyshortcuts` value). `onOpen` opens the palette through its `mod+k` keyboard path. Pages whose chrome sets `nav: false` receive no links, and the default `Nav` then renders nothing.

The defaults are styled by `tokens.css`: `TokenFrame` renders a sticky `header` banner with the app mark and name, `Nav` in its `bar` form and the palette trigger, over a content column with a 72rem measure and fluid gutters; `TokenNav` renders `nav aria-label="Pages"` with `data-rex-nav-form` set to its form. The token sheet also gives documents that use the default frame a type scale, control, table, section and outcome styles, focus rings and the palette, overlay and confirmation surfaces. Under the agent density the bar is static and the navigation and palette label are laid out flat, in the same DOM.

`rex new --ui designx` (the default) writes `app/components/Shell.tsx` and names it in `ui.components`, mapping the slots to the installed DesignX primitives through the `rex/designx` map: `Button` on `button`, `Sheet` on the `dialog` item in its `dialog` form and on the `sheet` item in its `bottom-sheet` form, `PaletteItem` on the `command` shortcut with `kbd` and `badge`, `Outcome` on `alert`, and `Nav` on `navigation-menu` in its `bar` form, `sidebar` in its `sidebar` form and `toolbar` in its `dock` form, every link keeping `data-rex-nav` and `aria-current`; `Frame` keeps the token default. The map and the installed set are documented in the [DesignX recipe](recipes/designx.md).
