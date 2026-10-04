# Versioning

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
REX610 app/pages/gallery/regions/cover/region.tsx:6:5 Img width, height are placeholders; set the real values (https://rex.sidioralabs.com/errors/REX610)
migrated from 0.1: 4 files changed, 1 flagged for the author
```

Every codemod is idempotent: a second `rex migrate` changes no file and reports `no changes` for each codemod. Flags stay in the report until the author replaces the placeholders, because they are read from the migrated source.

### 0.1 codemods

| Codemod | Change |
| --- | --- |
| `0.1-config` | Wraps a bare server default export of `rex.config.ts` in `defineConfig({ app, server: (app) => <the old export> })`, importing `defineConfig` from `@sidioralabs/rex` and the default export of `rex:app` when they are missing. A config that already default-exports `defineConfig(...)` is left alone. This removes deprecation `REX101`. |
| `0.1-page-render` | 0.1 rendered every page in the browser; 0.2 renders on the server by default. A page whose view, states, regions, parts, hooks, overlays or the app components and data modules they import read `window`, `document`, `localStorage`, `sessionStorage`, `navigator`, `location`, `history` or `matchMedia` while rendering gets `render: "csr"` after its `route`. Reads inside `useEffect`, `useLayoutEffect`, `useInsertionEffect` or an `on*` event handler, `typeof` guards and locally declared names do not count. Every other page is left alone and takes the 0.2 default. |
| `0.1-raw-img` | Converts `<img>` in regions and parts to `<Img>` from `@sidioralabs/rex/client` and adds the import. Numeric string `width` and `height` become numbers. A missing `width`, `height` or `alt` gets a placeholder marked `/* REX610 placeholder */` (`1` for a size, `""` for alt), and each `Img` carrying a placeholder is reported as `REX610` with its file, line and column. `createElement("img")` is not rewritten and is reported as `REX610`. |

`REX610` is not a checker error: the migrated app passes `rex check`. Replace each placeholder with the real value and run `rex check` again.
