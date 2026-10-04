# Ship a static page

Each page declares how it renders with `render` in `page.ts`:

| `render` | What the browser gets |
| --- | --- |
| `ssr` (default) | HTML rendered per request on the server, streamed, then hydrated |
| `csr` | the shell only; the page renders in the browser |
| `ssg` | HTML prerendered by `rex build`, hydrated in the browser, optionally regenerated after `revalidate` seconds |
| `static` | HTML prerendered by `rex build` with no page chunk and no hydration script: zero page JavaScript |

Routing, loaders and the sidecar behave the same in every mode. This recipe adds a static help page and a prerendered token page.

## A static page

```sh
rex make page help --regions faq,contact
```

```ts
import { page } from "@sidioralabs/rex";
import { requestCallback } from "../../actions/request-callback.ts";

export default page("help", {
  route: "/help",
  render: "static",
  actions: [requestCallback],
  regions: ["faq", "contact"],
});
```

A static page ships no JavaScript of its own, so every action it declares must work as a plain form. Render each one with `ActionForm` (see [A form that works without JavaScript](form-without-js.md)):

```tsx
import { ActionForm, region } from "@sidioralabs/rex/client";
import { requestCallback } from "../../../../actions/request-callback.ts";

export default region("contact", () => <ActionForm action={requestCallback} submitLabel="Call me back" />);
```

The prerendered HTML keeps the sidecar (`<script type="application/rex+json" id="rex-page">`) as static JSON, so agents read the page's actions as on any other page, and invoke them through the form route.

## A prerendered page with regeneration

`ssg` prerenders at build and hydrates. A page with route params lists the params to prerender with `paths`; `revalidate` (seconds) makes the server regenerate the page after that window:

```ts
import { page } from "@sidioralabs/rex";
import { id } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { readToken } from "../../actions/read-token.ts";

export default page("token", {
  route: "/tokens/:token",
  params: z.object({ token: id() }),
  render: "ssg",
  revalidate: 60,
  paths: () => [{ token: "eth" }, { token: "pax" }, { token: "usdc" }],
  load: { token: { action: readToken, input: (params) => ({ id: String(params.token) }) } },
  regions: ["detail"],
});
```

`page()` validates the combination: `render` must be one of the four modes (`REX200`), `revalidate` is allowed only with `ssg` and must be a positive whole number (`REX201`), and `paths` must be a function, only with `ssg` or `static`, and only on a route with params (`REX202`).

## Build and serve

```sh
rex build
node dist/server.js
```

`rex build` renders every `ssg` and `static` page through the server renderer (expanding `paths` for dynamic routes) into `dist/client/<route>/index.html`, lists them in `dist/prerender.json`, and prints one line per page:

```
rex build: prerendered /help -> dist/client/help/index.html (help, static)
rex build: prerendered /tokens/eth -> dist/client/tokens/eth/index.html (token, ssg, revalidate 60s)
```

The built Node server serves the prerendered files. For a page with `revalidate`, a request after the window still gets the cached HTML immediately while the server regenerates it in the background; the next request gets the new HTML. If regeneration fails, the server logs `rex: regenerating <path> (page "<id>") failed; serving the cached page` and keeps the old file.

`rex build --target static` builds no server and writes `dist/client` as a complete static deployment: the same prerendered pages, `index.md` beside each one (the page's text rendering for terminal agents), `rex/manifest` (the manifest JSON), the shell document at the route of every `ssr` and `csr` page without route params, and `404.html` (the shell for every other path), plus `dist/prerender.json`:

```
rex build: prerendered /help -> dist/client/help/index.html (help, static)
rex build: wrote dist/client/rex/manifest
rex build: wrote dist/client/help/index.md
rex build: wrote dist/client/index.html (home, the shell document for /)
rex build: wrote dist/client/404.html (the shell document for unknown routes)
```

Without `client.apiOrigin` the client reads the manifest inlined at build time and never requests `/rex/manifest`. To call a Rex server elsewhere, set `client.apiOrigin` in `rex.config.ts` and list the static host in the `security: { origins }` option of that server's `createRexServer`.

## Navigation on a static host

A static host answers files, not the Rex protocol, so a build without `client.apiOrigin` navigates by documents and never calls a server:

- `nav.to`, `nav.replace` and `nav.back`, the shell navigation links (sidebar, dock and bar), the command palette's page entries, the header's back control and the recovery link load the target route as a new document (`location.assign`, or `location.replace` for `nav.replace`) instead of a router transition. Each page then starts from its own prerendered HTML and dehydrated loader data, so its loaders never run through `/rex/rpc`. Every `data-rex-nav` address and sidecar entry stays the same.
- The client does not intercept Navigation API events, so links and history traversal are ordinary document loads.
- Loader queries keep the data they were hydrated with: `staleTime` is `Infinity` and they never refetch on window focus, reconnect or mount.

With `client.apiOrigin` set the client routes in place as on a server deployment and calls that origin, and every `ActionForm` posts to `<apiOrigin>/rex/form/<action>` once the page has hydrated.

A static host answers no `POST`, so an action that changes data needs `client.apiOrigin`. `rex check` reports a page that declares a mutating action (`effect` `reversible` or `irreversible`) in an app whose `package.json` has a script running `rex build --target static`, whose `rex.config.ts` declares no `server` and sets no `client.apiOrigin`:

```
app/pages/help/page.ts
  7:13  error    render/static-post  page "help" declares mutating action "request-callback" (effect "reversible"), but the app builds for a static host (script "build:static" runs rex build --target static) and rex.config.ts sets no client.apiOrigin, so the action posts to a host that answers no POST (declared in app/actions/request-callback.ts)
          hint: Set client: { apiOrigin: "https://api.example.com" } in rex.config.ts to the Rex server that runs action "request-callback", or remove the action from page "help".
```

An app that declares `server` in `rex.config.ts` is deployed with that server; its static build is a secondary output and the check leaves it alone.

## Checks

| Check | Reports |
| --- | --- |
| `render/static-needs-js` | a static page that declares an action with a shortcut, or an overlay bound to region state; both need JavaScript |
| `render/static-post` | a mutating action on a page of an app built with `rex build --target static`, with no `server` and no `client.apiOrigin` in `rex.config.ts` |
| `rex build` | a static page that does not render one of its actions as a form: `renders static but action "<id>" is not rendered as a form; render it with ActionForm so it works without JavaScript` |

Related: [cli.md](../cli.md#rex-build), [Load page data with a loader](loader.md).
