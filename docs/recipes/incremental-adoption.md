# Adopt Rex one page at a time

An existing React app built with Vite can take Rex one page or one widget at a time. The Rex pages live in an `app/` folder next to the existing code, the Rex Vite plugin builds them into the `rex:app` module, and `mountRexPage` mounts a Rex page, with its providers, sidecar, palette and outcome region, into any DOM node of the existing app. The rest of the app does not change. For a Next.js app, see [migration.md](../migration.md#adopting-rex-in-a-nextjs-app).

## 1. Install

```sh
pnpm add @sidioralabs/rex @tanstack/react-query @hono/node-server @vitejs/plugin-react cmdk wouter zod react react-dom vite
```

These are the packages `rex new` lists for an app: Rex itself, its peers and the optional peers the client runtime and dev server use.

## 2. Add the Rex app folder

From the project root, generate the declarations and a page with the CLI; it writes into `./app`:

```sh
rex make policy viewer
rex make action load-wallet
rex make page wallet --regions summary
```

Give the page a route that the existing app does not use, such as `route: "/wallet"`. Declarations, pages and the import table work exactly as in an app made by `rex new` ([convention.md](../convention.md)), and `rex check` checks the `app/` folder.

## 3. Serve the Rex API

Create the Rex server in a module of its own, `rex.server.ts`:

```ts
import { anonymousActor } from "@sidioralabs/rex";
import { createRexServer, memoryLedger } from "@sidioralabs/rex/server";
import app from "rex:app";

export default createRexServer({
  registry: app.registry,
  ledger: memoryLedger(),
  actor: () => anonymousActor,
  app: app.name,
});
```

Resolve the actor from your existing session instead of `anonymousActor` (the `actor` option receives the `Request`).

## 4. Add the plugin to `vite.config.ts`

```ts
import { mountServer, rex } from "@sidioralabs/rex/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    rex(),
    {
      name: "app:rex-api",
      configureServer(vite) {
        mountServer(vite, async (server) => (await server.ssrLoadModule("/rex.server.ts")).default);
      },
    },
  ],
});
```

- `rex()` generates `rex:app` from `./app` and already includes `@vitejs/plugin-react` (with the React Compiler), so remove the app's own `react()` entry.
- `mountServer` forwards only requests under `/rex` (manifest, RPC, flows, forms) to the Rex server; every other request stays with the existing app. Passing `server` to `rex()` instead would make the dev server render every document request with Rex, which is what `rex dev` does for a whole Rex app.
- For TypeScript, add the `rex:app` typings shipped in the package to `include` in `tsconfig.json`: `node_modules/@sidioralabs/rex/dist/vite/rex-app.d.ts`.

## 5. Mount the page

Anywhere in the existing app, mount the Rex page into an element and keep the returned function to unmount it:

```tsx
import { mountRexPage } from "@sidioralabs/rex/client";
import app from "rex:app";
import { useEffect, useRef } from "react";

export function WalletPanel() {
  const slot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (slot.current === null) return;
    return mountRexPage(slot.current, app, "wallet");
  }, []);
  return <div ref={slot} />;
}
```

`mountRexPage(element, app, pageId, options)`:

- renders the page with all Rex providers in its own React root inside `element`, on an in-memory location at the page's route, so the host's URL and router are untouched;
- takes `params` for a route with params (invalid params throw with the issues listed), and the options of `createRexEntry`, such as `baseUrl` and `fetch` for the RPC client or `actor`;
- throws for an element that is not a DOM element or a page id the app does not register;
- returns `unmount`, which is safe to call more than once.

The mounted page carries the full agent contract (`data-rex-page`, region and action addresses, the sidecar script and the outcome region), so agents operate it like a page of a Rex app. The generated Rex entry imports the Rex runtime stylesheets (`tokens.css` and `agent/density.css`); `mountRexPage` does not, and the package export map does not expose them in 0.2.0, so the mounted page uses the host page's styles.

## 6. Production

`vite build` builds the client with `rex:app` as before. Build the server module for Node with Vite's SSR build (`vite build --ssr rex.server.ts`) and route `/rex/*` of your production server to its `fetch`; `rex/server` is fetch-only, so it runs under Node (`@sidioralabs/rex/server/node`), Bun, Deno or an edge runtime. When the API runs on another origin, pass `security: { origins: ["https://app.example.com"] }` to `createRexServer` so the Origin check admits the app's posts.

## Moving on

When most of the app is Rex pages, move to the Rex layout: `rex new` a fresh app, move `app/` into it, and let `rex dev` and `rex build` own the entry, the server and the build.

Related: [Export a part as a web component](web-component.md), [architecture.md](../architecture.md).
