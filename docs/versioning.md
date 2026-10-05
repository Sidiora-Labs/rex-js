# Versioning

This page states how `@sidioralabs/rex` is versioned, how a public API is deprecated and removed, and how an app follows a breaking change with a codemod. The migration steps for 0.1 apps are in [migration.md](migration.md#upgrading-from-01-to-02); the release history is in [CHANGELOG.md](../CHANGELOG.md).

## Semantic versioning

`@sidioralabs/rex` follows [Semantic Versioning 2.0.0](https://semver.org). A version is `MAJOR.MINOR.PATCH`; the package version is the `version` field of `packages/rex/package.json`, and a release is the git tag `v<version>`.

| Release     | Before 1.0.0 (`0.y.z`)                                                                                                                                                                       | From 1.0.0                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Patch (`z`) | Bug fixes only. No public API changes; an app upgrades without edits.                                                                                                                        | Same.                                                                                                |
| Minor (`y`) | New capability, and breaking changes when they are needed. Every breaking change ships with a deprecation in an earlier release where that is possible and with a codemod for `rex migrate`. | New capability only. Existing public APIs keep working; they may be deprecated.                      |
| Major (`x`) | Not used before 1.0.0.                                                                                                                                                                       | Breaking changes, each with a codemod. Only APIs deprecated in an earlier minor release are removed. |

An app pins Rex with a caret range. `rex new` writes `"@sidioralabs/rex": "^<version>"`, which for a `0.y.z` version accepts patch releases of the same minor only, so a minor upgrade before 1.0.0 is always an explicit step.

### The public API

The [extension contracts](extensions.md) identify supported native composition and the limits of exported assembly values. Public exports are covered by versioning; their presence does not establish per-application mutation, resource cleanup or platform guarantees.

These parts of Rex are covered by the version number. A change to any of them that makes a working app fail, or makes `rex check` report a new error on an app that passed before, is a breaking change:

- the package entries listed in `exports` of `packages/rex/package.json` and every symbol they export, as documented in the generated [API reference](api/README.md);
- the `rex` CLI: commands, flags, output formats documented as machine-readable (`rex check --json`, `.rex/manifest.json`) and exit codes ([cli.md](cli.md));
- the app layout and file roles of the [convention](convention.md), including the import table;
- the agent contract: `data-rex` addresses, the sidecar schema, the outcome region, the four invocation routes and density ([agent-contract.md](agent-contract.md));
- the `/rex` HTTP surface: `/rex/manifest`, `/rex/rpc`, `/rex/flow`, `/rex/form/<action>`, `/rex/health`, `/rex/pages/<id>.md` and their payloads (`/rex/dev/audit` exists only in dev and is not covered);
- error codes and checker rule ids ([errors.md](errors.md)).

Anything not listed (module paths under `src/` that no export map entry names, test helpers outside `@sidioralabs/rex/testing`, generated virtual module internals other than the `rex:app` types) is internal and may change in any release.

New checker rules are additive: a minor release may add a rule, and a rule that reports an error on code that passed before ships with either a codemod or a migration note in the changelog and [migration.md](migration.md).

## Deprecations

A public API is deprecated before it is removed. A deprecation has an error code in the `REX` catalog ([errors.md](errors.md)), a message naming what to use instead and, when the change is mechanical, a codemod.

At run time Rex reports a deprecation with `deprecated(code, message)` from `@sidioralabs/rex` (`packages/rex/src/core/deprecated.ts`). It warns once per code per process, through `console.warn` unless a warn function is passed, in this form:

```
rex: REX101 deprecated: <message> (https://rex.sidioralabs.com/errors/REX101)
```

`hasWarned(code)` tells whether a code has warned, and `resetDeprecations()` clears the record between tests.

The rules for a deprecated API:

1. It keeps working, unchanged, in the release that deprecates it and in every later release of the same minor line (before 1.0.0) or major line (from 1.0.0).
2. It is removed no earlier than the next minor release (before 1.0.0) or the next major release (from 1.0.0), and the release that removes it lists it in the changelog.
3. Its removal ships with a codemod whenever the replacement can be derived from the source; when it cannot, the codemod flags the location for the author with a code such as `REX610`.

Deprecations in 0.2:

| Code     | Deprecated                                                                                                                     | Replacement                                                                        | Codemod      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------ |
| `REX101` | A `rex.config.ts` whose default export is a bare server (an object with `fetch`, such as the Hono app from `createRexServer`). | `export default defineConfig({ app, server: (app) => createRexServer({ ... }) })`. | `0.1-config` |

## Codemods

A breaking change in Rex ships with a codemod so an app moves to the new version with one command. Codemods live in `packages/rex/src/cli/codemods/`, one module per codemod named `<from>-<name>.ts` (for example `0.1-config.ts`), each exporting `codemod = defineCodemod({ id, from, description, run })` from `cli/codemods/codemod.ts`. The id equals the file name and starts with the version it migrates from. `run(root)` reads the app with the TypeScript compiler API, edits only the source ranges it needs, and returns the changed files and the flags it leaves for the author; it never formats untouched code.

```
rex migrate [--from 0.1] [--list]
```

`rex migrate` (`packages/rex/src/cli/commands/migrate.ts`) loads every codemod for `--from` (default `0.1`) in file-name order and applies them one after another, so each codemod sees the files the previous one wrote. `--list` prints the codemods without applying them. An unknown `--from` exits 2 and names the known versions.

The report lists each codemod with the files it changed, then one line per flag, then a summary:

```
0.1-config: 1 changed
  changed rex.config.ts
0.1-page-render: 1 changed
  changed app/pages/settings/page.ts
0.1-raw-img: 2 changed
  changed app/pages/gallery/regions/cover/parts/Thumb.tsx
  changed app/pages/gallery/regions/cover/region.tsx
0.1-schema-entry: 1 changed
  changed app/entities/note.ts
REX610 app/pages/gallery/regions/cover/region.tsx:6:5 Img width, height are placeholders; set the real values (https://rex.sidioralabs.com/errors/REX610)
migrated from 0.1: 5 files changed, 1 flagged for the author
```

The example is illustrative; a run with nothing to move prints `0.1-schema-entry: no changes`.

Every codemod is idempotent: a second `rex migrate` changes no file and reports `no changes` for each codemod. Flags stay in the report until the author replaces the placeholders, because they are read from the migrated source.

### 0.1 codemods

| Codemod            | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0.1-config`       | Wraps a bare server default export of `rex.config.ts` in `defineConfig({ app, server: (app) => <the old export> })`, importing `defineConfig` from `@sidioralabs/rex/config` and the default export of `rex:app` when they are missing. A config that already default-exports `defineConfig(...)` is left alone. This removes deprecation `REX101`.                                                                                                                                                                                                                                 |
| `0.1-page-render`  | 0.1 rendered every page in the browser; 0.2 renders on the server by default. A page whose view, states, regions, parts, hooks, overlays or the app components and data modules they import read `window`, `document`, `localStorage`, `sessionStorage`, `navigator`, `location`, `history` or `matchMedia` while rendering gets `render: "csr"` after its `route`. Reads inside `useEffect`, `useLayoutEffect`, `useInsertionEffect` or an `on*` event handler, `typeof` guards and locally declared names do not count. Every other page is left alone and takes the 0.2 default. |
| `0.1-raw-img`      | Converts `<img>` in regions and parts to `<Img>` from `@sidioralabs/rex/client/media` and adds the import. Numeric string `width` and `height` become numbers. A missing `width`, `height` or `alt` gets a placeholder marked `/* REX610 placeholder */` (`1` for a size, `""` for alt), and each `Img` carrying a placeholder is reported as `REX610` with its file, line and column. `createElement("img")` is not rewritten and is reported as `REX610`.                                                                                                                         |
| `0.1-schema-entry` | Moves named imports to the 0.2 entries: `z` to `zod/mini`; field helpers, `MONEY_PATTERN` and the schema types to `@sidioralabs/rex/schema`; config names and types to `@sidioralabs/rex/config`; manifest, JSON Schema and sidecar names to `@sidioralabs/rex/manifest`; interop, media and i18n names from `@sidioralabs/rex/client` to `@sidioralabs/rex/client/interop`, `.../media` and `.../i18n`. Type-only imports keep `import type`; it never flags.                                                                                                                      |

`REX610` is not a checker error: the migrated app passes `rex check`. Replace each placeholder with the real value and run `rex check` again.
