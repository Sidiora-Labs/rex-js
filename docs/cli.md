# The rex CLI

The `rex` binary is `dist/cli/index.js` of `@sidioralabs/rex` (the `bin` entry in `packages/rex/package.json`). It is built on commander. `packages/rex/src/cli/index.ts` registers a `version` command and then loads every module in `cli/commands/` (`build`, `check`, `dev`, `make`, `manifest`, `new`, `promote`); each module exports `register(program, io)`.

All commands work on the current directory.

## Global options and exit codes

| Option | Effect |
| --- | --- |
| `-v`, `--version` | print the rex version (`0.1.0`) |
| `-h`, `--help` | print help (commander default) |

| Exit code | Constant | Meaning |
| --- | --- | --- |
| 0 | `EXIT_OK` | success |
| 1 | `EXIT_FAILURE` | the command failed: check errors, refused writes, a missing page, a manifest scan error, an unexpected error (printed as `rex: <message>`) |
| 2 | `EXIT_USAGE` | usage error: unknown command or option, missing or extra argument, invalid argument value such as an invalid name or port |

## rex version

Prints the version followed by a newline.

## rex new

```
rex new <name>
```

Writes a complete app into `./<name>`. The name must be a valid Rex name (lowercase letters, digits, dot and dash, starting with a letter); otherwise exit 2. If `./<name>` exists and is not an empty folder, it refuses with exit 1. Each written file is printed as `wrote <name>/<path>`.

Files written (`newApp` and `newAppPlan` in `packages/rex/src/cli/commands/new.ts`):

| Path | Content |
| --- | --- |
| `package.json` | `type: module`, scripts `dev`, `build`, `check`, `manifest` (all `rex ...`) and `start` (`node dist/server.js`); dependencies `@sidioralabs/rex` `^0.1.0`, `@tanstack/react-query`, `react`, `react-dom`; dev dependencies `@types/node`, `@types/react`, `@types/react-dom`, `typescript`, with versions copied from the Rex package |
| `tsconfig.json` | strict compiler options and `include` of `app`, `rex.config.ts` and the `rex-app.d.ts` typings inside `node_modules/@sidioralabs/rex`, which declare the `rex:app` module |
| `index.html` | `<div id="root">` and `<script type="module" src="/@rex/entry">` |
| `rex.config.ts` | default export `createRexServer({ registry: app.registry, ledger: memoryLedger(), actor: () => anonymousActor, app: app.name })` |
| `app/entities/note.ts` | entity `note` with `id` and `name` |
| `app/policies/viewer.ts` | policy `viewer` with permission `viewer.read` |
| `app/actions/ping.ts` | reversible action `ping` with `policy: always()` |
| `app/data/notes.ts` | `notes = bind(note, memoryStore(note, [{ id: "welcome", name: "Welcome to Rex" }]))` |
| `app/components/Button.tsx` | a `<button type="button">` component |
| `app/pages/home/page.ts` | page `home` at route `/` with action `ping` and region `welcome` |
| `app/pages/home/view.tsx` | `view()` rendering the welcome region in `Page.Stack` |
| `app/pages/home/states.tsx` | all eight non-ready state exports |
| `app/pages/home/hooks/useNotes.ts` | a TanStack query over `notes.list()` |
| `app/pages/home/regions/welcome/region.tsx` | binds `useNotes` and `act(ping)` to the part |
| `app/pages/home/regions/welcome/parts/Welcome.tsx` | lists notes and renders the action button |
| `app/pages/home/test/` | empty folder |

## rex make

Writes canonical skeletons (`makePage`, `makeRegion`, `makePart`, `makeOverlay`, `makeHook` and `makeDeclaration` in `packages/rex/src/cli/commands/make.ts`, with the templates in `packages/rex/src/cli/templates.ts`). Every `make` command refuses to overwrite an existing file: it lists the files under "refusing to overwrite existing files:" and exits 1 without writing anything. An invalid name exits 2. Commands that add a file to a page exit 1 when the page (or region) does not exist. Each written path is printed as `wrote <path>`.

| Command | Writes |
| --- | --- |
| `rex make page <id> [--regions a,b] [--overlays X,Y]` | `app/pages/<id>/page.ts` (route `/<id>`, the regions, the overlays with `dismiss: "both"` and `binding: "region"`), `view.tsx` (the regions in `Page.Stack`), `states.tsx` (eight non-ready exports), `hooks/`, `regions/<r>/region.tsx` per region, `overlays/<X>.tsx` per overlay, `test/` |
| `rex make region <page> <name>` | `app/pages/<page>/regions/<name>/region.tsx` |
| `rex make part <page> <Name> --region <region>` | `app/pages/<page>/regions/<region>/parts/<Name>.tsx` (`--region` is required) |
| `rex make overlay <page> <Name>` | `app/pages/<page>/overlays/<Name>.tsx` with `dismiss: "both"`, `binding: "region"` |
| `rex make hook <page> <useName>` | `app/pages/<page>/hooks/<useName>.ts` |
| `rex make action <name>` | `app/actions/<name>.ts`: reversible, `policy: always()`, label from the name, empty input, output `{ ok: boolean }` |
| `rex make entity <name>` | `app/entities/<name>.ts` with fields `id` and `name` |
| `rex make policy <name>` | `app/policies/<name>.ts` with permission `<name>.read` |
| `rex make flow <name>` | `app/flows/<name>.ts` with one approval gate `review` and `memoryJournal()` |

`--regions` and `--overlays` take comma-separated lists. Region names follow the name rules; overlay and part names are PascalCase; hook names start with `use` followed by an uppercase letter. Declarations are exported under the camelCase form of the name (`pick-token` becomes `pickToken`). `rex make region` and `rex make overlay` write only the file; add the name to `page.ts` yourself or the checker reports `parity/region-undeclared` or `parity/overlay-undeclared`.

## rex promote

```
rex promote <page>/regions/<region>/parts/<Part>
```

Moves a part into shared components (`promotePart` in `packages/rex/src/cli/commands/promote.ts`):

1. checks the path shape (exit 2 if it is not `<page>/regions/<region>/parts/<Part>`);
2. refuses with exit 1 if the part file is missing or `app/components/<Part>.tsx` already exists;
3. rewrites every relative import under `app/` that resolves to the part so it points at `app/components/<Part>.tsx`, keeping the original extension style;
4. rewrites the part's own relative imports for its new location, writes it to `app/components/<Part>.tsx` and deletes the original.

It prints `moved <from> -> <to>` and one `rewrote <file>` line per updated file.

## rex dev

```
rex dev [--port <port>] [--host <host>] [--no-check]
```

| Option | Default | Effect |
| --- | --- | --- |
| `--port <port>` | `5173` | port to listen on; an integer from 0 to 65535 (otherwise exit 2) |
| `--host <host>` | Vite default | host to listen on |
| `--no-check` | | skip `rex check` |

Unless `--no-check` is passed, `rex dev` runs `rex check` first (`ensureCheckPasses`). If the check reports errors it prints the findings, then `rex dev: rex check reported <n> errors; fix the findings above, or pass --no-check to skip rex check`, and exits 1.

It then calls `startDev`, which requires `rex.config.ts` in the current directory (exit 1 with a message if it is missing) and starts one Vite dev server with the Rex plugin. Vite is created with `configFile: false`, so a `vite.config.*` in the app is not read. The plugin loads `rex.config.ts` through Vite's SSR loader and forwards every request under `/rex` to its default export, which must have a `fetch` method (the Hono app from `createRexServer`). The client and the API share one port, and changes to the app are picked up by Vite's hot reload; adding or removing files under `app/` regenerates `rex:app` and reloads the page. It prints `rex dev: serving <url>` for each local and network URL.

## rex build

```
rex build [--no-check]
```

Runs `rex check` first unless `--no-check` is passed (same failure output as `rex dev`). `buildApp` requires `rex.config.ts`, deletes `dist/`, and runs two Vite builds:

1. the client, from `index.html`, into `dist/client/`;
2. the server, an SSR build of a generated entry (`rex:server`) bundled with all dependencies (`ssr.noExternal: true`), unminified, as an ES module at `dist/server.js`.

Output layout:

```
dist/
  client/        index.html and the client assets
  server.js      the server entry
```

It prints `rex build: wrote dist/client/ and dist/server.js` and `rex build: start it with node dist/server.js (<absolute path>)`.

`dist/server.js` imports the default export of `rex.config.ts` and starts it with `startNodeServer`:

- `PORT` sets the port (default `3000`), `HOST` the hostname;
- `GET` and `HEAD` requests outside `/rex` are served from `dist/client/`; a path whose last segment has no dot falls back to `index.html`;
- everything else goes to the app;
- on start it logs `rex: serving <url>`.

## rex check

```
rex check [--json]
```

Runs the eight rules (`typecheck`, `boundaries`, `states`, `parity`, `naming`, `traps`, `tokens`, `manifest`) on the app in the current directory and exits 1 if any finding is an error. The current directory must contain `app/`. The rule ids and messages are listed in [convention.md](convention.md#what-the-checker-reports).

Human output (the default) groups findings by file. For example, a region that imports a hook from another page produces:

```
app/pages/send/regions/form/region.tsx
  12:1  error    boundaries/cross-page  region.tsx of page send imports "../../../portfolio/hooks/useWallet.ts" from page portfolio
        hint: No page imports another page; move the shared code to app/components with rex promote, or to app/data.

1 problem (1 error, 0 warnings) in 1 file
```

With no findings it prints `No findings.` The two formats are produced by `formatHuman` and `formatJson` in `packages/rex/src/check/report.ts`.

`--json` prints an array of findings sorted by file, line, column, rule and message. Each finding has exactly these fields, in this order:

| Field | Type | Meaning |
| --- | --- | --- |
| `rule` | string | `<rule>/<code>`, for example `parity/region-missing` |
| `severity` | `"error"` or `"warning"` | |
| `file` | string | path relative to the app root, with `/` separators |
| `line` | number | 1-based |
| `column` | number | 1-based |
| `message` | string | what is wrong |
| `hint` | string | how to fix it |

The same check is available as a function: `runCheck(root, { json?, rules? })` from `@sidioralabs/rex/check` returns the findings, the error and warning counts, the exit code and the formatted output.

## rex manifest

```
rex manifest
```

Loads the declarations in `app/entities`, `app/policies`, `app/actions`, `app/flows` and every `app/pages/<page>/page.ts` in a child process, then writes `.rex/manifest.json` and `AGENTS.md`. It prints `wrote .rex/manifest.json (<n> pages, <m> actions)` and `wrote AGENTS.md`. A declaration that cannot be loaded exits 1 with `rex manifest: manifest scan of <root> failed: <reason>`.

`AGENTS.md` starts with a "GENERATED by rex manifest" banner and is overwritten on every run. Once `.rex/` exists, `rex check` reports a stale manifest as an error and a stale `AGENTS.md` as a warning.
