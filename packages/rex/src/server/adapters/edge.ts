import type { ExecutionContext } from "hono";
import type { AnyAction } from "../../core/action.ts";
import { RexError } from "../../core/errors.ts";
import { mountRexServer, type PrebuiltRexServerOptions } from "../app.ts";

export interface EdgeFetchApp {
  fetch(
    request: Request,
    env?: unknown,
    executionCtx?: ExecutionContext,
  ): Response | Promise<Response>;
}

export type EdgeFetchHandler = (
  request: Request,
  env?: unknown,
  executionCtx?: ExecutionContext,
) => Promise<Response>;

export interface EdgeHandler {
  readonly fetch: EdgeFetchHandler;
}

export function createEdgeHandler(app: EdgeFetchApp): EdgeHandler {
  if (typeof app?.fetch !== "function") {
    throw new RexError("REX400", "createEdgeHandler: app must have a fetch(request) method");
  }
  return {
    fetch: async (request, env, executionCtx) => app.fetch(request, env, executionCtx),
  };
}

export type EdgeServerOptions<A extends AnyAction> = PrebuiltRexServerOptions<A>;

export function createEdgeServer<A extends AnyAction>(options: EdgeServerOptions<A>): EdgeHandler {
  return createEdgeHandler(mountRexServer(options));
}
