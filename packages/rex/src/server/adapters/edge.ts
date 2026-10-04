import type { ExecutionContext } from "hono";

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
    throw new TypeError("createEdgeHandler: app must have a fetch(request) method");
  }
  return {
    fetch: async (request, env, executionCtx) => app.fetch(request, env, executionCtx),
  };
}
