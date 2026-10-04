import type { ClientContext } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import type { AnyAction } from "../core/action.ts";
import type { Actor } from "../core/actor.ts";
import { buildManifest, stableStringify, type ManifestSource } from "../manifest/build.ts";
import type { Ledger } from "./audit.ts";
import {
  CONFIRM_HEADER,
  DEFAULT_DENSITY,
  DENSITY_HEADER,
  REX_DENSITIES,
  isRexDensity,
  type RexContext,
  type RexDensity,
} from "./context.ts";
import { buildActionRouter, type ActionRouter } from "./router.ts";

export * from "./audit.ts";
export * from "./context.ts";
export * from "./router.ts";

export const RPC_PREFIX = "/rex/rpc";
export const MANIFEST_PATH = "/rex/manifest";
export const HEALTH_PATH = "/rex/health";

export type ActorResolver = (request: Request) => Actor | Promise<Actor>;

export type RexServerRegistry<A extends AnyAction> = ManifestSource & {
  readonly actions: readonly A[];
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

export class RexDensityError extends Error {
  readonly value: string;

  constructor(value: string) {
    super(`${DENSITY_HEADER} must be one of ${REX_DENSITIES.join(", ")}, received "${value}"`);
    this.name = "RexDensityError";
    this.value = value;
  }
}

export async function createRexContext(
  request: Request,
  resolveActor: ActorResolver,
): Promise<RexContext> {
  const header = request.headers.get(DENSITY_HEADER);
  let density: RexDensity = DEFAULT_DENSITY;
  if (header !== null) {
    if (!isRexDensity(header)) throw new RexDensityError(header);
    density = header;
  }
  const confirm = request.headers.get(CONFIRM_HEADER);
  const actor = await resolveActor(request);
  return confirm === null || confirm === "" ? { actor, density } : { actor, density, confirm };
}

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
  const manifestBody = stableStringify(
    buildManifest(options.registry, options.app === undefined ? {} : { app: options.app }),
  );
  const handler = new RPCHandler(router);
  const app = new Hono();

  app.get(MANIFEST_PATH, (c) =>
    c.body(manifestBody, 200, { "content-type": "application/json; charset=utf-8" }),
  );

  app.get(HEALTH_PATH, (c) => c.json({ status: "ok" }));

  app.use(`${RPC_PREFIX}/*`, async (c, next) => {
    let context: RexContext;
    try {
      context = await createRexContext(c.req.raw, options.actor);
    } catch (error) {
      if (error instanceof RexDensityError) {
        return c.json({ code: "BAD_REQUEST", message: error.message }, 400);
      }
      throw error;
    }
    const { matched, response } = await handler.handle(c.req.raw, {
      prefix: RPC_PREFIX,
      context,
    });
    if (!matched) {
      await next();
      return;
    }
    const result = c.newResponse(response.body, response);
    result.headers.set(DENSITY_HEADER, context.density);
    return result;
  });

  return app;
}
