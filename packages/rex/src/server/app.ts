import type { ClientContext } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import type { AnyAction } from "../core/action.ts";
import { RexError } from "../core/errors.ts";
import type { AnyFlow } from "../core/flow.ts";
import { buildManifest, stableStringify, type ManifestSource } from "../manifest/build.ts";
import { MANIFEST_VERSION, type Manifest } from "../manifest/types.ts";
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
  readonly manifest?: Manifest;
}

export type PrebuiltRexServerOptions<A extends AnyAction> = RexServerOptions<A> & {
  readonly manifest: Manifest;
};

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

function assertActor(options: RexServerOptions<AnyAction>): void {
  if (typeof options.actor !== "function") {
    throw new RexError("REX400", "createRexServer: actor must be a function from request to actor");
  }
}

export function createRexServer<A extends AnyAction>(options: RexServerOptions<A>): Hono {
  assertActor(options);
  const manifest =
    options.manifest ??
    buildManifest(options.registry, options.app === undefined ? {} : { app: options.app });
  return mountRexServer({ ...options, manifest });
}

export function mountRexServer<A extends AnyAction>(options: PrebuiltRexServerOptions<A>): Hono {
  assertActor(options);
  const manifest: unknown = options.manifest;
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    (manifest as { readonly version?: unknown }).version !== MANIFEST_VERSION
  ) {
    throw new RexError(
      "REX400",
      `createRexServer: manifest must be a version ${MANIFEST_VERSION} Rex manifest as written by rex build`,
    );
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
    manifestBody: stableStringify(options.manifest),
  };
  const app = new Hono();
  for (const install of REX_SERVER_COMPOSITION.middleware) install(app, setup);
  for (const install of REX_SERVER_COMPOSITION.routes) install(app, setup);
  return app;
}
