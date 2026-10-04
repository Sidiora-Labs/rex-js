# Migration guide

This guide covers three moves: adopting Rex inside an existing Vite app, adopting it next to an existing Next.js app, and upgrading a Rex 0.1 app to 0.2. The versioning, deprecation and codemod policy behind the upgrade is in [versioning.md](versioning.md).

## Adopting Rex in an existing Vite app

A React app built with Vite can take Rex one page at a time without changing the rest of the app:

1. Install `@sidioralabs/rex` and its peers.
2. Put the Rex declarations and pages in an `app/` folder at the project root, generated with `rex make`.
3. Create the Rex server (`createRexServer`) in its own module.
4. Add `rex()` from `@sidioralabs/rex/vite` to `vite.config.ts` (it includes `@vitejs/plugin-react`, so remove the app's own `react()`), and forward `/rex` to the Rex server in dev with `mountServer`.
5. Mount each Rex page into a DOM node of the existing app with `mountRexPage(element, app, pageId)`, using `app` from `rex:app`; it returns the unmount function.

Each step, with the code, is in the recipe [Adopt Rex one page at a time](recipes/incremental-adoption.md). Single widgets, rather than whole pages, can be exported as custom elements with `defineElement` ([Export a part as a web component](recipes/web-component.md)).

`rex check` checks the `app/` folder only, so the existing code is not reported. When most of the app has moved, create a fresh app with `rex new`, move `app/` into it and let `rex dev` and `rex build` own the entry, the server and the build.

## Adopting Rex in a Next.js app

Rex does not run inside Next.js: it uses no React Server Components and no server actions, and its pages are built by Vite through the `rex:app` module, which the Next.js bundler cannot resolve. A Next.js app adopts Rex by running the Rex app beside it and routing paths to it, one page at a time.

1. Create the Rex app in its own folder of the repository:

   ```sh
   rex new wallet
   cd wallet
   rex make page orders --regions list,detail
   ```

   Give the Rex pages routes that the Next.js app does not serve, or move a route over by deleting it from the Next.js app in the same change.

2. Build and run it as its own server:

   ```sh
   rex build
   PORT=3001 node dist/server.js
   ```

3. Route the Rex paths from Next.js to it with rewrites in `next.config.mjs`: the Rex API under `/rex`, the built client assets under `/assets`, and each migrated page route:

   ```js
   const REX = "http://localhost:3001";

   export default {
     async rewrites() {
       return [
         { source: "/rex/:path*", destination: `${REX}/rex/:path*` },
         { source: "/assets/:path*", destination: `${REX}/assets/:path*` },
         { source: "/orders", destination: `${REX}/orders` },
         { source: "/orders/:path*", destination: `${REX}/orders/:path*` },
       ];
     },
   };
   ```

   Requests reach the Rex server through the same origin, so the Origin check on `/rex` posts passes. If the browser talks to the Rex server on its own origin instead, pass that origin to `createRexServer` as `security: { origins: [...] }`.

4. Share the session. The Rex server resolves the actor from the request in the `actor` option of `createRexServer`; read the same cookie the Next.js app sets, as the demo reads `demo-actor` in `examples/demo/server.ts`.

Links between the two apps are plain `<a href>` links: a Next.js `Link` to `/orders` becomes a full page load served by Rex, and a Rex page navigates back with an ordinary link. Every migrated page keeps the Rex agent contract (addresses, sidecar, palette, outcome region) from the moment it moves.

For a Rex widget inside a Next.js page, export the part with `defineElement`, bundle that entry with Vite, and load it from the Next.js page with a script tag; the element is a client-side custom element and needs no Next.js integration ([Export a part as a web component](recipes/web-component.md)).

## Upgrading from 0.1 to 0.2

Rex 0.2 keeps every 0.1 concept: the six primitives, the page folder convention, the nine data states, the agent contract and one DOM. The breaking changes are mechanical and three codemods apply them.

### 1. Update the packages

Set `"@sidioralabs/rex": "^0.2.0"` in `package.json`. Rex 0.2 declares React, TanStack Query, Vite, zod and TypeScript as peer dependencies, and the libraries only some apps use as optional peers, so the app installs them itself. An app made by `rex new` 0.1 already lists most of them; add what is missing:

```sh
pnpm add @tanstack/react-query @hono/node-server @vitejs/plugin-react cmdk wouter zod react react-dom vite
pnpm add -D typescript @types/node @types/react @types/react-dom
```

Rex no longer depends on `tsx` or `commander`: the CLI parses its own arguments and loads `rex.config.ts` and the app through Vite's module runner. Node 22 or later is required.

### 2. Run the codemods

```sh
rex migrate --list
rex migrate
```

`rex migrate` (default `--from 0.1`) applies, in order:

| Codemod | What it changes |
| --- | --- |
| `0.1-config` | Wraps the bare server default export of `rex.config.ts` in `defineConfig({ app, server: (app) => ... })`. A 0.1 config still works in 0.2 but warns `REX101` once. |
| `0.1-page-render` | Adds `render: "csr"` to pages that read browser globals (`window`, `document`, `localStorage` and others) while rendering, because 0.2 renders pages on the server by default. Other pages take the new default. |
| `0.1-raw-img` | Converts `<img>` in regions and parts to `<Img>` from `@sidioralabs/rex/client`, which requires `width` and `height`. |

The report lists every changed file. Codemods are idempotent; a second run reports `no changes`. The details of each codemod are in [versioning.md](versioning.md#01-codemods).

### 3. Replace the placeholders

`0.1-raw-img` writes a placeholder where `width`, `height` or `alt` was missing and reports each one as `REX610` with file, line and column:

```
REX610 app/pages/gallery/regions/cover/region.tsx:6:5 Img width, height are placeholders; set the real values (https://rex.sidioralabs.com/errors/REX610)
```

Replace each `/* REX610 placeholder */` value with the real one.

### 4. Review what 0.2 changes at run time

- **Server rendering.** Pages render on the server (`render: "ssr"`) and hydrate, with loader data in the HTML. A page can choose `csr`, `ssg` or `static` with `render` in `page.ts` ([Ship a static page](recipes/static-page.md)).
- **Origin check.** The server refuses a non-GET request under `/rex` whose `Origin` is neither the server's own origin nor listed in `security: { origins }` of `createRexServer`. Scripts and tests that post to `/rex/rpc` from Node must send an `Origin` header.
- **Content-Security-Policy.** `security.csp` defaults to `strict`: `script-src 'self'` plus a per-request nonce that Rex applies to the inline scripts it emits. Move other inline scripts into modules, or use `csp: "report"` while you do.
- **Schemas.** Field helpers are built on `zod/mini`. Import `z` from `zod/mini` in declarations and hooks, as the 0.2 demo does; any library implementing Standard Schema v1 also works for `input`, `output`, `fields` and `params`.
- **Forms.** Every action is also reachable as a form post at `/rex/form/<action>`; `ActionForm` renders it ([A form that works without JavaScript](recipes/form-without-js.md)).

### 5. Fix the new checker findings

`rex check` gains rules in 0.2. Run it and fix what it reports; each finding carries a hint:

| Rule ids | Reports |
| --- | --- |
| `a11y/img-alt`, `a11y/control-name`, `a11y/label-for`, `a11y/heading-order`, `a11y/no-positive-tabindex`, `a11y/no-autofocus-outside-overlay` | missing text alternatives and names, unlabelled inputs, skipped heading levels, positive `tabIndex`, `autoFocus` outside an overlay |
| `security/unsafe-html` | `dangerouslySetInnerHTML` anywhere except through `unsafeHtml()` |
| `media/no-raw-img` | `<img>` in parts and regions |
| `render/static-needs-js` | static pages with shortcuts or region-bound overlays |
| `traps/infinite-list`, `traps/custom-element` | lists that load more on scroll without `Page.List`, custom elements no keyboard reaches |
| `i18n/literal` | literal labels and titles, only when `i18n` is configured |
| `format/prettier`, `format/unavailable` (warnings) | files Prettier would rewrite (with the app's `.prettierrc`, or the `@sidioralabs/rex/prettier` preset when there is none), and a missing `prettier` install |

`rex check --runtime` additionally mounts every page and reports `parity/runtime` when the sidecar and the visible controls disagree.

### 6. Build and verify

```sh
rex check
rex build
node dist/server.js
```

`rex build` now also prerenders `ssg` and `static` pages, enforces the page budgets from `rex.config.ts`, and takes `--target node | edge | bun | deno | static`.
