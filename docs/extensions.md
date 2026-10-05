# Extension contracts

Rex applications use React components, Hono servers and Vite plugins. Actions remain the single boundary for schema validation, authorization, confirmation and audit. Extensions compose these existing APIs; Rex does not provide a separate plugin lifecycle or a server component runtime.

## Hono composition

`createRexServer(options)` returns a Hono app. Register application middleware and application routes on a new parent Hono app, then mount Rex at `/`:

```ts
import { Hono } from "hono";
import { createRexServer } from "@sidioralabs/rex/server";

const server = createRexServer(options);
const app = new Hono();
app.use("*", async (context, next) => {
  await next();
  context.header("x-application", "inventory");
});
app.get("/application-status", (context) => context.json({ ready: true }));
app.route("/", server);
export default app;
```

Here `options` is the application's existing server configuration, including its registry, actor resolver and ledger. Middleware registered on the parent before mounting runs around Rex handlers. Keep application routes outside `/rex`; replacing protocol routes can bypass Rex validation, security and agent contracts. Authorization belongs in the Action policy even when the parent authenticates requests. Pass an actor resolver explicitly; parent Hono context variables are not automatically Action context fields.

Create the wrapper and its mutable state separately for each application. The wrapper owns its middleware, routes and closures; Rex owns its registered protocol routes. A request's Action context is derived from its server's actor resolver. Shared stores, ledgers, declarations or other objects supplied by the application remain shared by the application's choice. Hono wrapping is not a sandbox for untrusted extensions.

`REX_SERVER_COMPOSITION`, `REX_MIDDLEWARE` and `REX_ROUTES` are exported assembly values used by Rex. They are process-global, not per-application configuration. Do not mutate them to customize an individual server. Their public export status does not promise isolation for such mutations. `extension-contract.test.ts` exercises two real Hono wrappers with separate actors and ledgers, including a forbidden Action invocation and audit recording.

## Vite composition

Add application plugins alongside the complete result of `rex()` in an ordinary Vite configuration:

```ts
import { rex } from "@sidioralabs/rex/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    ...rex(),
    {
      name: "inventory-build-metadata",
      configResolved(config) {
        config.logger.info(`inventory build mode: ${config.mode}`);
      },
    },
  ],
});
```

Vite owns hook ordering, including `enforce` and hook-specific ordering; array position alone does not override those rules. Preserve Rex's compiler, boundary, nonce and other hooks. Filtering or replacing them changes the framework guarantees and is not a supported way to disable security checks.

Each `rex()` call creates a new hook context. `assemblePlugins(context, hooks)` and `createHookContext(options)` are exported lower-level assembly functions, and `REX_HOOKS` is the default ordered list. Custom assembly must preserve the complete default sequence and each hook's prerequisites. Do not mutate `REX_HOOKS`; supplying a fresh context does not isolate mutable objects or plugin instances that an application deliberately shares. Rex does not discover third-party plugins or negotiate plugin compatibility versions. Use Vite's lifecycle hooks to release resources owned by a Vite plugin.

## Adapter responsibilities and limits

An adapter connects the existing request/response application to a host. Keep the original Request, including its body and abort signal, and the returned Response, including its status, headers and streaming body, intact unless an intentional middleware operation requires a change. Forward host environment and execution context when supported. `createEdgeHandler` delegates all three arguments to the underlying fetch app; it does not translate environment bindings into Action context.

The host or application owns listening sockets, shutdown, connection draining, background work and external client disposal. Rex has no general extension startup/shutdown registry, distributed confirmation storage, automatic resource cleanup or guarantee that aborting a request cancels an Action's external side effects. Streaming, disconnect behavior and deployment permissions require qualification on the actual host. A request-level test does not establish those platform guarantees.

See [platforms](platforms.md) for existing adapters and output layouts, [architecture](architecture.md#the-life-of-an-action) for the Action lifecycle, and [versioning](versioning.md#the-public-api) for compatibility policy. Deep imports into unexported modules have no compatibility guarantee. React Server Components, Next.js server actions and arbitrary remapping of the `/rex` protocol are not supported extension contracts. Base paths and nested layouts remain pending production acceptance; mounting under an arbitrary Hono prefix does not establish support for either.
