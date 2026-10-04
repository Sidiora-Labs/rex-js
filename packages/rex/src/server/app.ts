import type { ClientContext } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import type { AnyAction } from "../core/action.ts";
import type { AnyFlow } from "../core/flow.ts";
import { buildManifest, stableStringify, type ManifestSource } from "../manifest/build.ts";
import type { Ledger } from "./audit.ts";
import type { ActorResolver, RexContext } from "./context.ts";
import { REX_MIDDLEWARE } from "./middleware.ts";
import { buildActionRouter, type ActionRouter } from "./router.ts";
import { REX_ROUTES } from "./routes.ts";

export type RexServerRegistry<A extends AnyAction> = ManifestSource & {
  readonly actions: readonly A[];
  readonly flows?: readonly AnyFlow[];
};

export interface RexServerOptions<A extends AnyAction> {
  readonly registry: RexServerRegistry<A>;
  readonly ledger: Ledger;
  readonly actor: ActorResolver;
  readonly app?: string;
  readonly confirmTtlMs?: number;
}

export type RexRouter<A extends AnyAction> = ActionRouter<A>;

export type RexRouterClient<
  A extends AnyAction,
  C extends ClientContext = Record<never, never>,
> = RouterClient<ActionRouter<A>, C>;

export type RegistryRouterClient<
  R extends { readonly actions: readonly AnyAction[] },
  C extends ClientContext = Record<never, never>,
> = RexRouterClient<R["actions"][number], C>;

export interface RexServerSetup {
  readonly options: RexServerOptions<AnyAction>;
  readonly handler: RPCHandler<RexContext>;
  readonly manifestBody: string;
}

export type RexServerInstaller = (app: Hono, setup: RexServerSetup) => void;

export interface RexServerComposition {
  readonly middleware: readonly RexServerInstaller[];
  readonly routes: readonly RexServerInstaller[];
}

export const REX_SERVER_COMPOSITION: RexServerComposition = {
  middleware: REX_MIDDLEWARE,
  routes: REX_ROUTES,
};

export function createRexServer<A extends AnyAction>(options: RexServerOptions<A>): Hono {
  if (typeof options.actor !== "function") {
    throw new TypeError("createRexServer: actor must be a function from request to actor");
  }
  const router = buildActionRouter(
    options.registry,
    options.confirmTtlMs === undefined
      ? { ledger: options.ledger }
      : { ledger: options.ledger, confirmTtlMs: options.confirmTtlMs },
  );
  const setup: RexServerSetup = {
    options,
    handler: new RPCHandler(router),
    manifestBody: stableStringify(
      buildManifest(options.registry, options.app === undefined ? {} : { app: options.app }),
    ),
  };
  const app = new Hono();
  for (const install of REX_SERVER_COMPOSITION.middleware) install(app, setup);
  for (const install of REX_SERVER_COMPOSITION.routes) install(app, setup);
  return app;
}
