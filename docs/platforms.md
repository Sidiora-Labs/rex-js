# Platforms and build targets

The [extension and adapter contract](extensions.md#adapter-responsibilities-and-limits) describes request forwarding, resource ownership and host qualification limits for custom integrations.

`rex build --target <target>` builds one app for a runtime. The target picks the server adapter and the layout of `dist/`; the client bundle in `dist/client/` is the same Vite build for every target. `--target` defaults to `node`; any other value exits 2 with the list of targets.

| Target   | Command                     | Writes                                                                                                                             | Start or deploy                                                                      |
| -------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `node`   | `rex build`                 | `dist/client/`, `dist/server.js`, `dist/prerender.json` (the prerendered page list)                                                | `node dist/server.js`                                                                |
| `bun`    | `rex build --target bun`    | `dist/client/`, `dist/server.js`, `dist/prerender.json` (the prerendered page list)                                                | `bun dist/server.js`                                                                 |
| `deno`   | `rex build --target deno`   | `dist/client/`, `dist/server.js`, `dist/prerender.json` (the prerendered page list)                                                | `deno run --allow-net --allow-read --allow-env dist/server.js`                       |
| `edge`   | `rex build --target edge`   | `dist/client/`, `dist/server.js` (a webworker bundle)                                                                              | deploy `dist/server.js` as the worker module and `dist/client/` as its static assets |
| `static` | `rex build --target static` | `dist/client/` (every page as HTML, `index.md` beside each prerendered page, `rex/manifest`, `404.html`) and `dist/prerender.json` | serve `dist/client/` from any static host; the client calls `client.apiOrigin`       |

After a build, `rex build` prints the layout it wrote and the start hint for the target.

`rex/server` itself is fetch-only: `createRexServer` returns a Hono app whose `fetch(request)` answers a `Request` with a `Response` and imports nothing from `node:`. The adapters live in their own entry points:

| Entry point                    | Exports                                                                                                                | Used by                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `@sidioralabs/rex/server/node` | `startNodeServer`, `createNodeApp`, `startPrerenderedNodeServer`, `createPrerenderedNodeApp`, `installNodeStaticPages` | `node`, and the static file serving of `bun` and `deno` |
| `@sidioralabs/rex/server/bun`  | `startBunServer`                                                                                                       | `bun`                                                   |
| `@sidioralabs/rex/server/deno` | `startDenoServer`                                                                                                      | `deno`                                                  |
| `@sidioralabs/rex/server/edge` | `createEdgeHandler`                                                                                                    | `edge`                                                  |

Every server entry builds the app server from `rex.config.ts`: the `server(app)` factory when the config declares one, otherwise `createRexServer` with an in-memory ledger, the anonymous actor and the config's `security` and `client` options, so `security.origins`, the CSP mode and `client.apiOrigin` apply without a factory.

## node

The default target. `dist/server.js` serves `dist/client/` assets first, renders page paths through SSR, serves prerendered `ssg` and `static` pages from `dist/client/<route>/index.html` through the static cache (with `revalidate` regeneration), and hands every `/rex/*` request to the app server. It listens on `PORT` (default `3000`) and `HOST` when set, and prints `rex: serving <url>`.

```sh
rex build
PORT=8080 node dist/server.js
```

## bun

`dist/server.js` serves the same site as the node target through `startBunServer`, which hands the fetch handler to `Bun.serve`. Run it with Bun; under another runtime `startBunServer` throws `REX450` naming Bun.

```sh
rex build --target bun
bun dist/server.js
```

## deno

`dist/server.js` serves the same site through `startDenoServer`, which hands the fetch handler to `Deno.serve`. It reads `dist/client/` and the environment, so Deno needs the net, read and env permissions; under another runtime `startDenoServer` throws `REX450` naming Deno.

```sh
rex build --target deno
deno run --allow-net --allow-read --allow-env dist/server.js
```

## edge

`dist/server.js` is built for the webworker platform with no Node built-ins. Its default export is `createEdgeHandler(server)`, an object with `fetch(request, env, ctx)`, which is the module worker shape of Cloudflare Workers and other edge runtimes. The edge target does not prerender; `ssg` and `static` pages render on request. Configure the platform to serve `dist/client/` as static assets in front of the worker.

```sh
rex build --target edge
```

## static

The static target builds no server. It writes `dist/client/` as a complete static deployment:

- every `ssg` and `static` page prerendered to `dist/client/<path>/index.html` (with `paths` expanded), a `static` page with zero page JavaScript and an `ssg` page hydrating;
- `dist/client/<path>/index.md` beside each prerendered page, the same text rendering `GET /rex/pages/<page>.md` answers, for terminal agents;
- `dist/client/rex/manifest`, the manifest JSON `GET /rex/manifest` answers, so an agent on the static host reads the same manifest;
- the built `index.html` as the shell document at the route of every `ssr` and `csr` page without route params, where the client renders the page, and as `dist/client/404.html`, which static hosts such as GitHub Pages serve for every other path so the client boots and routes it;
- `dist/prerender.json` listing the prerendered pages.

Without `client.apiOrigin` the client starts from the manifest inlined in its bundle and the anonymous actor, and never requests `/rex/manifest`, so a page with no actions makes no request at all on load. It also navigates by documents: `nav.to`, the shell navigation, the palette's page entries, the back control and the recovery link load the target route's prerendered HTML with `location.assign` instead of a router transition, Navigation API events are left to the browser, and loader queries keep their dehydrated data (`staleTime: Infinity`, no refetch on focus, reconnect or mount), so no loader ever calls `/rex/rpc` on the static host. `rex check` reports a mutating action on a page of such an app as `render/static-post` (see [Ship a static page](recipes/static-page.md#navigation-on-a-static-host)). With `client.apiOrigin` the client talks to a Rex server that runs elsewhere. `client.apiOrigin` in `rex.config.ts` names that server, and `rex build --target static` bakes it into the client entry as the base URL for `GET /rex/manifest`, `/rex/rpc` and the rest of the Rex protocol, together with a fetch that sends credentials (`credentials: "include"`), so the session cookie of the API origin travels with every call. Without `client.apiOrigin` the static client calls the origin it is served from. With it, the client routes in place as on a server deployment and every hydrated `ActionForm` posts to `<apiOrigin>/rex/form/<action>`.

```ts
// rex.config.ts of the static client
import { defineConfig } from "@sidioralabs/rex/config";
import app from "rex:app";

export default defineConfig({
  app,
  client: { apiOrigin: "https://api.example.com" },
});
```

The remote server is the same app built for the `node`, `bun`, `deno` or `edge` target. It must allow the client's origin: list it in `security.origins` in its `rex.config.ts`. The default server of the built entry passes `security` and `client` to `createRexServer` itself; a `server` factory passes them to `createRexServer` as in the example below. With origins listed, the server answers CORS for exactly those origins with credentials:

- a preflight (`OPTIONS`) from a listed origin answers `204` with `Access-Control-Allow-Origin` set to that origin, `Access-Control-Allow-Credentials: true`, the methods `GET, HEAD, POST`, the headers `content-type`, `authorization`, `accept-language`, `x-rex-confirm` and `x-rex-density`, and a ten minute max age;
- every response to a listed origin carries the same origin and credentials grant and exposes `x-rex-actor` and `x-rex-density`, which the client reads from the manifest response;
- an unlisted origin gets no CORS headers, so the browser blocks it, and its posts to `/rex/*` are still refused with `403` by the Origin check;
- responses vary on `Origin`; with `security.origins` empty no CORS middleware is installed.

```ts
// rex.config.ts of the API server
import { defineConfig } from "@sidioralabs/rex/config";
import { createRexServer, memoryLedger } from "@sidioralabs/rex/server";
import app from "rex:app";
import { sessionActor } from "./app/server/session.ts";

const security = {
  origins: [
    "https://app.example.com",
    "http://tauri.localhost",
    "tauri://localhost",
    "capacitor://localhost",
  ],
};

export default defineConfig({
  app,
  security,
  server: (bundle) =>
    createRexServer({
      registry: bundle.registry,
      ledger: memoryLedger(),
      actor: sessionActor,
      app: bundle.name,
      security,
    }),
});
```

A cookie set by the API origin reaches it from another site only with `SameSite=None; Secure`, so serve the API over HTTPS when the client and the API are on different sites. `security.origins` accepts URL origins: `http` and `https` origins and app-scheme origins of desktop and mobile webviews such as `tauri://localhost` and `capacitor://localhost`, each a scheme and a host with no path. `ftp`, `ws`, `wss` and `file` URLs and schemes without a host are refused with `REX115`. `client.apiOrigin` names the API server and stays an `http` or `https` origin.

## Desktop and mobile shells

Electron, Tauri and Capacitor wrap a web client in a native window. Each one uses the outputs above; pick by where the server runs.

### Electron

Electron ships Node, so the app can run its own Rex server in the main process and load it like a website. Build the `node` target, start `dist/server.js` from the main process on a local port, and point the window at it. Client and API share one origin, so no CORS or `client.apiOrigin` is needed and SSR, forms and prerendered pages all work.

```js
// main.js
import { app, BrowserWindow } from "electron";

process.env.PORT = "47615";
process.env.HOST = "127.0.0.1";
await import("./dist/server.js");

app.whenReady().then(() => {
  const window = new BrowserWindow({ width: 1200, height: 800 });
  window.loadURL("http://127.0.0.1:47615/");
});
```

When the data lives on a shared server instead, build the `static` target with `client.apiOrigin` set to that server and load `dist/client/index.html` from an `http://127.0.0.1:<port>` origin served by the main process, then list that origin in the server's `security.origins`.

### Tauri

Tauri has no Node runtime, so the window loads the `static` build and calls a remote Rex server. Set `build.frontendDist` in `tauri.conf.json` to the app's `dist/client`, set `client.apiOrigin` to the server, and list the webview origin in the server's `security.origins`. On Windows and Android Tauri serves the frontend from `http://tauri.localhost`; on macOS, Linux and iOS it uses `tauri://localhost`. List the origins of the platforms you ship in `security.origins`.

```sh
rex build --target static
cargo tauri build
```

### Capacitor

Capacitor copies a web build into the native project. Set `webDir` in `capacitor.config.ts` to `dist/client`, build the `static` target with `client.apiOrigin` set to the server, and run `npx cap sync`. On Android the webview origin is `https://localhost` (or `http://localhost` with `androidScheme: "http"`); list it in `security.origins`. On iOS the origin is `capacitor://localhost`; list it too. Alternatively set `server.url` in `capacitor.config.ts` to the app's deployed node, bun, deno or edge build so the webview loads the client from the server's own origin and needs no CORS.

```sh
rex build --target static
npx cap sync
```

## Terminal agents

Every Rex server also serves each page as markdown at `GET /rex/pages/<id>.md`, for agents without a browser. The text names the page title and route, the data state for the requesting actor (loaders run in process), the regions with their `data-rex-region` addresses, every action with its label, effect, whether the actor may run it, its control address, its input fields and how to invoke it by URL (`<route>?act=<action>&input=<json>`) and by form (`POST /rex/form/<action>`), the overlays, and the page sidecar JSON in a fenced block. Route and page params come from the query string, for example `GET /rex/pages/note.md?id=n1`. A page the actor may not open answers `403` with the `permission-denied` state, and an unknown id answers `404` with the list of pages.
