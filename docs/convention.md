# The Rex convention

A Rex app is a directory with an `app/` folder of declarations and React components. The folder tree is the component tree: the Vite plugin, the manifest scanner and the checker all find files by their path, with no barrels and no registration code.

Sources: `packages/rex/src/check/engine.ts` (file roles), `packages/rex/src/check/rules/*.ts` (rules), `packages/rex/src/vite/virtual.ts` (what the runtime loads), `packages/rex/src/manifest/agents-md.ts` (`FOLDER_CONVENTION`).

## App layout

```
app/
  actions/<action>.ts          one action() per file
  entities/<entity>.ts         one entity() per file
  policies/<policy>.ts         one policy() per file
  flows/<flow>.ts              one flow() per file
  components/                  shared components
  data/                        stores and queries
  pages/<page>/
    page.ts                    page() declaration
    view.tsx                   layout of regions (the ready state)
    states.tsx                 one export per declared non-ready state
    hooks/use<Name>.ts         page-private hooks
    regions/<region>/region.tsx
    regions/<region>/parts/<Part>.tsx
    overlays/<Overlay>.tsx
    test/
```

Next to `app/` an app has `package.json`, `tsconfig.json`, `index.html` (with `<div id="root">` and a module script `/@rex/entry`) and `rex.config.ts`, which default-exports the app's Hono server. `rex new` writes all of these.

A page folder is named after its page id. `page.ts`, `view.tsx` and `states.tsx` are required: the Vite plugin refuses to build an app whose page folder lacks one of them (`RexAppScanError`, "`<dir>` is missing ..."), and the checker reports `parity/missing-file`.

## File roles

The checker classifies every `.ts` and `.tsx` file under `app/` (skipping `.d.ts`, dot-folders and `node_modules`) into one of 14 roles (`FILE_ROLES`):

| Role | Path pattern |
| --- | --- |
| `page` | `pages/<page>/page.ts` |
| `view` | `pages/<page>/view.tsx` |
| `states` | `pages/<page>/states.tsx` |
| `hook` | `pages/<page>/hooks/<file>.ts` or `.tsx` (directly in `hooks/`) |
| `region` | `pages/<page>/regions/<region>/region.tsx` |
| `part` | `pages/<page>/regions/<region>/parts/<file>.tsx` |
| `overlay` | `pages/<page>/overlays/<file>.tsx` |
| `test` | anything under `pages/<page>/test/`, and any `*.test.ts` or `*.test.tsx` |
| `action` | `actions/<file>.ts` |
| `entity` | `entities/<file>.ts` |
| `policy` | `policies/<file>.ts` |
| `flow` | `flows/<file>.ts` |
| `component` | anything under `components/` |
| `data` | anything under `data/` |

A file that matches none of these is "unclassified" and is reported by `naming/unclassified`, `naming/barrel` or `naming/region-file`.

The component roles, which may not fetch data directly, are `view`, `states`, `region`, `part`, `overlay` and `component` (`COMPONENT_ROLES`).

### What each file does

- **`page.ts`** exports one `page()` declaration (default export in the generated skeleton). The Vite plugin checks that the file exports exactly one page declaration and that its id equals the folder name. The checker reads `route`, `regions`, `overlays`, `actions` and `states` statically, so write them as inline literal lists.
- **`view.tsx`** default-exports `view(render)` from `@sidioralabs/rex/client`. It lays out the page's regions with the `Page` layout primitives and is rendered when the page is `ready`.
- **`states.tsx`** exports one component per declared non-ready state, named `Loading`, `Empty`, `Stale`, `Partial`, `Offline`, `PermissionDenied`, `RecoverableError`, `TerminalError`. Each receives `StateProps`: `params`, `retry` and `error`. When `page.ts` omits `states`, all nine are declared.
- **`hooks/use<Name>.ts`** exports exactly one function named after the file.
- **`regions/<region>/region.tsx`** default-exports `region(name, render)`. The render function receives `page`, `region`, `params`, `state`, `act` and `nav`. Regions call hooks, bind actions with `act(declaration)`, open overlays with `useOverlay`, and pass plain props and callbacks to parts.
- **`regions/<region>/parts/<Part>.tsx`** has a single default export, a PascalCase component. Parts receive props and raise events; they do not fetch, call actions or navigate.
- **`overlays/<Overlay>.tsx`** default-exports `overlay(id, { dismiss, binding }, render)`. The id is PascalCase and must match the file name and a `page.ts` overlay entry with the same `dismiss` and `binding`.
- **`app/actions`, `app/entities`, `app/policies`, `app/flows`** hold declarations, one per file. The manifest scanner and the Vite plugin collect every exported value whose `kind` is the declaration kind.
- **`app/components`** holds shared components. `rex promote` moves a part here.
- **`app/data`** holds stores (`bind(entity, memoryStore(entity, seed))`) and query helpers.

## Import table

The `boundaries` rule enforces this table (`IMPORT_TABLE` in `packages/rex/src/check/rules/boundaries.ts`). The text in the right column is the hint the checker prints.

| Role | Allowed imports |
| --- | --- |
| `page.ts` | page.ts may import app/entities, app/actions, app/policies, @sidioralabs/rex and zod, never React. |
| `view.tsx` | view.tsx may import its page's regions, react types and the layout primitives from @sidioralabs/rex/client; hooks, data and parts belong in region.tsx. |
| `region.tsx` | region.tsx may import its page's hooks, its own parts, its page's overlays, app/actions, app/components, react, @sidioralabs/rex and @sidioralabs/rex/client, never other regions or pages. (Entity imports must be type-only.) |
| part | parts may import app/components, sibling parts of their region, entity and action types, react, @sidioralabs/rex types and non-hook exports of @sidioralabs/rex/client; fetching, actions and navigation belong in region.tsx. |
| hook | hooks may import app/data, app/actions, app/entities, app/policies, sibling hooks, react, @tanstack/react-query, zod, @sidioralabs/rex and @sidioralabs/rex/client, never components. |
| overlay | overlays may import their page's parts, app/components, entity and action types, react, @sidioralabs/rex types and non-hook exports of @sidioralabs/rex/client, never data fetching. |
| `states.tsx` | states.tsx may import its page's parts, app/components, entity and action types, react, @sidioralabs/rex types and non-hook exports of @sidioralabs/rex/client, never hooks. |
| component | app/components may import other app/components, entity types and UI packages, never app data, actions or pages. |
| data | app/data may import app/data, app/entities, app/actions, app/policies and packages. |
| action | actions may import app/entities, app/policies, app/actions, app/data and non-React packages; declarations never import React. |
| entity | entities may import other app/entities and non-React packages. |
| policy | policies may import app/policies, app/entities and non-React packages. |
| flow | flows may import app/actions, app/policies, app/flows, app/entities, app/data and non-React packages. |
| test | tests may import anything within their own page and the shared app folders. |

Further boundary rules:

- **No cross-page imports.** No file under `app/pages/<a>` imports from `app/pages/<b>`.
- **No direct data access from components.** A file with a component role may not import `@tanstack/react-query`, `drizzle-orm`, `@libsql/client`, any `@orpc/*` package or `@sidioralabs/rex/server`; may not import `memoryStore` or `bind` from `@sidioralabs/rex` or `useRexClient` from `@sidioralabs/rex/client`; and may not call `fetch()`, `window.fetch()`, `globalThis.fetch()`, `self.fetch()` or construct `XMLHttpRequest`, `EventSource` or `WebSocket`. Type-only imports are allowed.
- **Declarations never import React.** Actions, entities, policies and flows may not import `react`, `react-dom` or `@sidioralabs/rex/client`.
- **No hooks in views and states.** `view.tsx` and `states.tsx` may not import a `use*` export; parts and overlays may not import `use*` exports of `@sidioralabs/rex/client`.

## Naming rules

- Page ids, region names, action ids, entity ids, policy ids, flow ids and permission names start with a lowercase letter and contain only lowercase letters, digits, dot and dash (`validateName` in `packages/rex/src/core/ids.ts`). A leading digit is rejected.
- Overlay ids and part names are PascalCase: an uppercase letter followed by letters and digits (`validateComponentName`).
- Hook names match `use` followed by an uppercase letter, such as `useFilter` (`validateHookName` in `packages/rex/src/cli/templates.ts`).
- Entity field names are camelCase starting with a lowercase letter.
- Route segments are lowercase letters, digits, dot, dash and underscore, or `:camelCaseParam`; a route starts with `/` and does not end with `/` unless it is `/`.
- Shortcuts are an ordered set of modifiers from `mod`, `shift`, `alt` joined with `+`, then one key: a lowercase letter, a digit, a punctuation key, or a named key (`enter`, `escape`, `space`, `tab`, arrow keys, `f1` to `f12` and others). `mod+k` and `escape` are reserved by Rex.
- `app/pages` contains no `index.ts` or `index.tsx` files.

## What the checker reports

`rex check` runs eight rules in this order (`defaultRules` in `packages/rex/src/check/rules/index.ts`): `typecheck`, `boundaries`, `states`, `parity`, `naming`, `traps`, `tokens`, `manifest`. Each finding has a rule id of the form `<rule>/<code>`, a severity (`error` unless noted), a file, a line and column, a message and a hint. The command exits 1 when any finding is an error. Output formats are described in [cli.md](cli.md#rex-check).

### typecheck

| Rule id | Reports |
| --- | --- |
| `typecheck/ts<code>` | Every TypeScript diagnostic from a program built from the app's `tsconfig.json` (or Rex's default compiler options when there is none), as `TS<code>: <message>`. TypeScript warnings become `warning` findings. Hint: "Fix the type error; rex check type-checks the app with its tsconfig.json." |

### boundaries

| Rule id | Message |
| --- | --- |
| `boundaries/unresolved` | `<file> imports "<specifier>", which does not resolve to a file` |
| `boundaries/cross-page` | `<file> of page <a> imports "<specifier>" from page <b>` |
| `boundaries/import-table` | `<file> imports "<specifier>" (<target>)`, `<file> imports "<specifier>"; declarations never import React or the client runtime`, `<file> imports the package "<specifier>", which the import table does not allow`, or `<file> imports the hook "<name>" from "<specifier>"` |
| `boundaries/no-fetch` | `<file> imports <what>; components never fetch or touch stores directly` or `<file> calls <call>; components never fetch directly` |

### states

| Rule id | Message |
| --- | --- |
| `states/view-default` | `view.tsx of page <page> has no default export` |
| `states/unknown-state` | `page.ts of page <page> declares the unknown state "<state>"` |
| `states/missing-export` | `states.tsx of page <page> does not export the <Name> component` |
| `states/extra-export` | `states.tsx of page <page> has the extra export <name>` (or a re-export) |

### parity

| Rule id | Message |
| --- | --- |
| `parity/missing-file` | `page <page> has no page.ts` (or `view.tsx`, `states.tsx`) |
| `parity/unreadable` | `page.ts of page <page> does not export a page() declaration`, `page.ts <field> of page <page> is not a literal the checker can read`, or `page.ts action <local> of page <page> is not imported from app/actions` |
| `parity/region-missing` | `region "<name>" is declared in page.ts but regions/<name>/region.tsx does not exist` (or the folder has no `region.tsx`) |
| `parity/region-undeclared` | `regions/<name> exists but page.ts of page <page> does not declare region "<name>"` |
| `parity/overlay-missing` | `overlay "<Id>" is declared in page.ts but overlays/<Id>.tsx does not exist` |
| `parity/overlay-undeclared` | `overlays/<Id>.tsx exists but page.ts of page <page> does not declare overlay "<Id>"` |
| `parity/action-undeclared` | `region "<region>" references action <id>, which page <page> does not declare` |
| `parity/action-unreferenced` | `action <id> is declared on page <page> but no region references it` |

A region "references" an action when `region.tsx` imports it (non-type-only) from a file with the `action` role.

### naming

| Rule id | Message |
| --- | --- |
| `naming/part-name` | `part file <name>.tsx is not PascalCase` |
| `naming/part-exports` | `part <name>.tsx has no default export`, or `part <name>.tsx exports <name> besides its default export` |
| `naming/hook-name` | `hook file <name> is not camelCase starting with use` |
| `naming/hook-exports` | `hook <name> exports no function`, `hook <name> has a default export`, `hook <name> re-exports everything from "<module>"`, `hook <name> exports <x> instead of <name>`, or `hook <name> exports <x> in addition to its hook` |
| `naming/overlay-name` | `overlay file <name>.tsx is not PascalCase` |
| `naming/barrel` | `<file> is a barrel; app/pages has no index files` |
| `naming/region-file` | `<file> is not a region file; regions/<region> holds region.tsx and parts/` |
| `naming/unclassified` | `<file> does not match any Rex file role` |
| `naming/page-folder` | `page folder <id> is not a valid page id` |
| `naming/region-folder` | `region folder <name> of page <page> is not a valid region name` |

### traps

| Rule id | Message |
| --- | --- |
| `traps/hover-only` | `<tag> handles onMouseEnter without onFocus` (or `onMouseOver`) |
| `traps/drag-only` | `draggable <tag> has no data-rex-alternative` (an element with `draggable` not set to false, or with `onDragStart`) |
| `traps/canvas` | `<canvas> has no data-rex-alternative` |
| `traps/motion-only` | `<tag> conveys state only through "<class>"`: an `animate-*` class (other than `animate-none`) on an element with no text content and no `aria-label`, `aria-labelledby` or `title` |
| `traps/overlay-dismiss` | `overlay "<Id>" of page <page> declares no dismiss`, or declares an unknown dismiss |

The traps rule reads every `.tsx` file that is not a test. The declared alternative is the attribute `data-rex-alternative="<page>/<action>"`.

### tokens

The tokens rule reads every file except components and tests.

| Rule id | Message |
| --- | --- |
| `tokens/raw-color` | `raw color utility "<class>" outside app/components` (Tailwind palette colors such as `bg-red-500`, `text-white`) |
| `tokens/arbitrary-value` | `arbitrary value utility "<class>" outside app/components` (any class with `[...]`) |
| `tokens/inline-color` | `inline style <key> is not a token reference` or `inline style <key> uses the raw value "<value>"` |

Color style keys (`color`, `backgroundColor`, any key ending in `color`, `background`, `fill`, `stroke`) must be `var(--token)` or a keyword (`inherit`, `initial`, `unset`, `revert`, `currentcolor`, `transparent`, `none`). Shorthand keys such as `border` and `boxShadow` may not contain raw colors.

### manifest

The manifest rule runs only once `.rex/` exists (after the first `rex manifest`). It builds a fresh manifest from the declarations and compares it with the committed files.

| Rule id | Severity | Message |
| --- | --- | --- |
| `manifest/load-error` | error | `the declarations cannot be loaded to build a fresh manifest: <error>` |
| `manifest/manifest-missing` | error | `.rex/manifest.json has not been generated` |
| `manifest/manifest-stale` | error | `.rex/manifest.json is stale: it differs from a fresh build of the declarations` |
| `manifest/agents-missing` | warning | `AGENTS.md has not been generated` |
| `manifest/agents-stale` | warning | `AGENTS.md is stale: it differs from a fresh build of the declarations` |

The hint for the missing and stale findings is "Run rex manifest to regenerate .rex/manifest.json and AGENTS.md, then commit both."
