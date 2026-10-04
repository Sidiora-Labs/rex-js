# The rex CLI

The `rex` binary is `dist/cli/index.js` of `@sidioralabs/rex` (the `bin` entry in `packages/rex/package.json`). It is built on the in-house argument parser in `packages/rex/src/cli/args.ts` (`RexCommand`: `--long`/`-s` options, `<required>`/`[optional]` arguments, `--no-` flags). `packages/rex/src/cli/index.ts` registers a `version` command and then loads every module in `cli/commands/` (`build`, `check`, `dev`, `make`, `manifest`, `migrate`, `new`, `promote`); each module exports `register(program, io)`.

All commands work on the current directory.

## Global options and exit codes

| Option | Effect |
| --- | --- |
| `-v`, `--version` | print the rex version (`0.1.0`) |
| `-h`, `--help` | print help for the command it follows |
| `--help --json` | print the command tree as JSON instead (`rex --help --json` for every command; `commandListing()` in `packages/rex/src/cli/index.ts` returns the same tree): each command's `name`, `path`, `description`, `arguments` and `options` (`flags`, `long`, `short`, `value`, `negate`, `required`, `default`) and its `commands` |

| Exit code | Constant | Meaning |
| --- | --- | --- |
| 0 | `EXIT_OK` | success |
| 1 | `EXIT_FAILURE` | the command failed: check errors, refused writes, a missing page, a manifest scan error, an invalid `rex.config.ts` (`rex check: REXnnn <message>` / `rex manifest: REXnnn <message>` when the file exists; `rex: REXnnn <message>` from `rex dev` and `rex build`, which also require the file), a `rex build` chunk over its budget, an unexpected error (printed as `rex: <message>`) |
| 2 | `EXIT_USAGE` | usage error: unknown command or option, missing or extra argument, invalid argument value such as an invalid name or port |

## rex version

Prints the version followed by a newline.

## rex new

```
rex new <name> [--ui designx|none] [--no-install]
```

| Option | Default | Effect |
| --- | --- | --- |
| `--ui <kit>` | `designx` | `designx` fetches the DesignX standard set from `https://dxuireact.com/r` into `app/components/ui/` and generates the DesignX shell, states and part; `none` writes the plain templates; any other value exits 2 |
| `--no-install` | | skip the `pnpm`/`yarn`/`bun`/`npm install` (chosen from `npm_config_user_agent`) that runs after a DesignX app is written; a failed install exits 1 with `REX605 rex new: <manager> install failed in <folder> ...` |

Writes a complete app into `./<name>`. The name must be a valid Rex name (lowercase letters, digits, dot and dash, starting with a letter); otherwise exit 2. If `./<name>` exists and is not an empty folder, it refuses with exit 1. Each written file is printed as `wrote <name>/<path>`.

Files written (`newApp` and `newAppPlan` in `packages/rex/src/cli/commands/new.ts`):

| Path | Content |
| --- | --- |
| `package.json` | `type: module`, scripts `dev`, `build`, `check`, `manifest` (all `rex ...`), `start` (`node dist/server.js`), `lint` (`eslint .`) and `format` (`prettier --write .`); dependencies `@sidioralabs/rex` `^0.2.0`, `@hono/node-server`, `@tanstack/react-query`, `@vitejs/plugin-react`, `cmdk`, `react`, `react-dom`, `vite`, `wouter`, `zod` (and, with the default `designx` kit, `tailwindcss`, `@tailwindcss/vite` `^4.3.0` and the dependencies of the installed DesignX items); dev dependencies `@types/node`, `@types/react`, `@types/react-dom`, `typescript`, `@typescript-eslint/parser`, `eslint`, `eslint-plugin-jsx-a11y`, `prettier` (plus any DesignX item dev dependencies), with versions copied from the Rex package's dependencies, devDependencies or peerDependencies |
| `tsconfig.json` | strict compiler options and `include` of `app`, `rex.config.ts` and the `rex-app.d.ts` typings inside `node_modules/@sidioralabs/rex`, which declare the `rex:app` module |
| `index.html` | `<div id="root">` and `<script type="module" src="/@rex/entry">` |
| `rex.config.ts` | `import app from "rex:app"` and default export `defineConfig({ app, server: (bundle) => createRexServer({ registry: bundle.registry, ledger: memoryLedger(), actor: () => anonymousActor, app: bundle.name }) })` from `@sidioralabs/rex/config`; with `--ui designx` it also sets `ui: { kit: "designx", components: "app/components/Shell.tsx" }` |
| `app/entities/note.ts` | entity `note` with `id` and `name` |
| `app/policies/viewer.ts` | policy `viewer` with permission `viewer.read` |
| `app/actions/ping.ts` | reversible action `ping` with `policy: always()` |
| `app/data/notes.ts` | `notes = bind(note, memoryStore(note, [{ id: "welcome", name: "Welcome to Rex" }]))` |
| `app/components/Button.tsx` | with the default `designx` kit, a `Button` that wraps `./ui/button.tsx`; with `--ui none`, a `<button type="button">` component |
| `app/pages/home/page.ts` | page `home` at route `/` with action `ping` and region `welcome` |
| `app/pages/home/view.tsx` | `view()` rendering the welcome region in `Page.Stack` |
| `app/pages/home/states.tsx` | all eight non-ready state exports |
| `app/pages/home/hooks/useNotes.ts` | a TanStack query over `notes.list()` |
| `app/pages/home/regions/welcome/region.tsx` | binds `useNotes` and `act(ping)` to the part |
| `app/pages/home/regions/welcome/parts/Welcome.tsx` | lists notes and renders the action button |
| `app/pages/home/test/` | empty folder |
| `app/locales/en.json` | messages `app.title`, `home.title` |
| `eslint.config.js` | `export default rex` from `@sidioralabs/rex/eslint` |
| `.prettierrc` | `"@sidioralabs/rex/prettier"` |
| `.prettierignore` | `dist`, `.rex`, `AGENTS.md` |
| `app/components/Shell.tsx` | with the default `designx` kit: Button, Sheet, PaletteItem, Outcome and Nav over the installed primitives |
| `app/components/ui/*.tsx`, `app/components/ui/use-screen.ts` | with the default `designx` kit: the DesignX standard set |
| `app/theme.css`, `dx.json` | with the default `designx` kit: the DesignX theme and the registry record |

With the default `designx` kit `index.html` also carries a theme `<link rel="stylesheet" href="/app/theme.css" />`, and `states.tsx` and `Welcome.tsx` are the DesignX versions.

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

It then calls `startDev`, which requires `rex.config.ts` in the current directory (exit 1 with a message if it is missing) and starts one Vite dev server with the Rex plugin. Vite is created with `configFile: false`, so a `vite.config.*` in the app is not read. The plugin loads `rex.config.ts` through Vite's SSR loader; its default export is the `defineConfig({ app, server? })` object, and every request under `/rex` goes to the fetch app returned by `server(app)` (or, when `server` is omitted, to a default `createRexServer` with `memoryLedger()` and `anonymousActor`); a `server` that does not return a fetch app is rejected as REX112. A bare Hono app default export still works in 0.2 but prints the REX101 deprecation warning; run `rex migrate` to wrap it. The config's `compiler`, `devtools`, `tailwind`, `ui` (kit and `components`), `security.secretNames`, `fonts` and `i18n` options configure the Vite plugin. The client and the API share one port, and changes to the app are picked up by Vite's hot reload; adding or removing files under `app/` regenerates `rex:app` and reloads the page. It prints `rex dev: serving <url>` for each local and network URL.

## rex build

```
rex build [--target node|edge|bun|deno|static] [--no-check]
```

| Option | Default | Effect |
| --- | --- | --- |
| `--target <target>` | `node` | runtime to build for: `node`, `edge`, `bun`, `deno` or `static` (client only); any other value exits 2 |
| `--no-check` | | skip `rex check` |

Runs `rex check` first unless `--no-check` is passed (same failure output as `rex dev`). `buildApp` requires `rex.config.ts`, reads its budgets and plugin options, deletes `dist/`, builds the client from `index.html` into `dist/client/` (with a Vite manifest) and prints a chunk table checked against the budgets; with `--target static` it bakes the config's `client.apiOrigin` into the client, prerenders every `ssg` and `static` page (expanding `paths`) into `dist/client/<path>/index.html` with the page's text rendering (the body `GET /rex/pages/<page>.md` answers) beside it as `index.md`, writes `dist/prerender.json`, writes the manifest as the JSON file `dist/client/rex/manifest` (the body `GET /rex/manifest` answers), and writes the built `index.html` as the shell document at the route of every `ssr` and `csr` page without route params and as `dist/client/404.html` for every other route. Without `client.apiOrigin` the static client starts from the manifest inlined in its bundle and the anonymous actor and never requests `/rex/manifest`; with it, the client reads the manifest and the actor from that server. For the other targets it then writes `dist/manifest.json`, builds the server entry (`rex:server`) for the target as an unminified ES module at `dist/server.js` (`ssr.noExternal: true`; `webworker` SSR target for `edge`, whose entry default-exports a `{ fetch }` handler), and for `node`, `bun` and `deno` prerenders every `ssg` and `static` page into `dist/client/<path>/index.html` (the root route into `dist/client/index.html`) and writes `dist/prerender.json`.

Output layout:

```
dist/
  client/                 index.html, the client assets, .vite/manifest.json and, for node, bun, deno and static, one <path>/index.html per prerendered page
    <path>/index.md       the text rendering of each prerendered page (static only)
    rex/manifest          the manifest JSON the manifest route answers (static only)
    404.html              the shell document for routes with no file (static only)
  manifest.json           the app manifest, imported into the server entry at build time (not for --target static)
  prerender.json          the prerender list: the server entry reads it on start (node, bun and deno); for static it lists the prerendered files
  server.js               the server entry (not for --target static)
```

It prints the chunk table (`chunk  raw  gzip  budget`, with `OVER` on a chunk above its budget), `rex build: wrote dist/client/ and dist/server.js for the <target> target` (`wrote dist/client/ for the static target`), `rex build: wrote dist/manifest.json`, one `rex build: prerendered <path> -> dist/client/<file> (<page>, <render>[, revalidate <n>s])` line per prerendered page (or `rex build: no ssg or static pages to prerender`), for the static target `rex build: wrote dist/client/rex/manifest`, one `rex build: wrote dist/client/<path>/index.md` line per prerendered page, one `rex build: wrote dist/client/<file> (<page>, the shell document for <route>)` line per shell route and `rex build: wrote dist/client/404.html (the shell document for unknown routes)`, and a start hint per target: `start it with node dist/server.js (<absolute path>)`, `start it with bun dist/server.js (...)`, `start it with deno run --allow-net --allow-read --allow-env dist/server.js (...)`, `deploy dist/server.js as the worker module (export default { fetch }) and dist/client/ as its static assets`, or `serve dist/client/ from any static host; the client calls <apiOrigin or the origin it is served from>`. A chunk over its budget exits 1 with `rex build: <chunk> (<n> KB gzip, budget <m> KB) over budget`.

`dist/server.js` reads the default export of `rex.config.ts` (`defineConfig` or the deprecated bare app), carries the manifest built into `dist/manifest.json`, installs the prerendered pages listed in `dist/prerender.json` and starts the app with `startPrerenderedNodeServer`:

- `PORT` sets the port (default `3000`), `HOST` the hostname;
- a `GET` or `HEAD` request for a page route (last segment without a dot) outside `/rex` is first given to the app, which answers server-rendered and prerendered pages; otherwise a matching file under `dist/client/` is served, and finally `index.html` (with Client Hints headers);
- everything else goes to the app;
- on start it logs `rex: serving <url>`.

## rex check

```
rex check [--json] [--runtime]
```

`--runtime` also mounts every page in happy-dom per actor and state and compares the sidecar with the visible controls (`parity/runtime` findings); if the runtime check cannot run it exits 1 with `rex check --runtime: <message>`. When `rex.config.ts` exists it is loaded first, and a config error exits 1 with `rex check: REXnnn <message>`.

Runs the sixteen rules (`typecheck`, `boundaries`, `states`, `parity`, `naming`, `traps`, `tokens`, `manifest`, `security`, `a11y`, `render`, `i18n`, `media`, `format`, `ui`, `layout`) on the app in the current directory and exits 1 if any finding is an error. The current directory must contain `app/`. The rule ids and messages are listed in [convention.md](convention.md#what-the-checker-reports).

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

Loads `rex.config.ts` (a config error exits 1 with `rex manifest: REXnnn <message>`), loads the declarations in `app/entities`, `app/policies`, `app/actions`, `app/flows` and every `app/pages/<page>/page.ts` through an in-process Vite SSR module loader, then writes `.rex/manifest.json` and `AGENTS.md`. It prints `wrote .rex/manifest.json (<n> pages, <m> actions)` and `wrote AGENTS.md`. A declaration that cannot be loaded exits 1 with `rex manifest: REX500 manifest scan of <root> failed: <reason>`.

`AGENTS.md` starts with a "GENERATED by rex manifest" banner and is overwritten on every run. Once `.rex/` exists, `rex check` reports a stale manifest as an error and a stale `AGENTS.md` as a warning.

## rex migrate

```
rex migrate [--from <version>] [--list]
```

| Option | Default | Effect |
| --- | --- | --- |
| `--from <version>` | `0.1` | the Rex version the app was written for; an unknown version exits 2 with `REX605 rex migrate: no codemods migrate from "<version>"; known versions: ...` |
| `--list` | | print `<id>  <description>` for the codemods of that version without applying them |

Runs every codemod registered for the version (`packages/rex/src/cli/codemods/<version>-<name>.ts`, built on the TypeScript compiler API) against the app in the current directory, writes the changed files and prints, per codemod, `<id>: <n> changed` (or `no changes`) with one `changed <file>` line per file, one `REX610 <file>:<line>:<column> <message> (<docs link>)` line per placeholder left for the author, and `migrated from <version>: <n> files changed, <m> flagged for the author`.

| Codemod | Change |
| --- | --- |
| `0.1-config` | wrap a bare Hono app default export of `rex.config.ts` in `defineConfig({ app, server })` |
| `0.1-page-render` | keep client rendering with `render: "csr"` on pages that read browser globals while rendering; every other page takes the 0.2 default |
| `0.1-raw-img` | convert `img` elements in regions and parts to `Img`, flagging width, height and alt placeholders as REX610 |
| `0.1-schema-entry` | move `z` to `zod/mini` and the field helpers, config and manifest names from `@sidioralabs/rex` to `@sidioralabs/rex/schema`, `@sidioralabs/rex/config` and `@sidioralabs/rex/manifest`, and the interop, media and i18n names from `@sidioralabs/rex/client` to `@sidioralabs/rex/client/interop`, `/client/media` and `/client/i18n` |
