import type { Hono } from "hono";
import { REX_RPC_PREFIX } from "../../core/protocol.ts";
import type { RexServerSetup } from "../app.ts";
import {
  DENSITY_HEADER,
  RexDensityError,
  createRexContext,
  type RexContext,
} from "../context.ts";

export const RPC_PREFIX = REX_RPC_PREFIX;

export function installRpcRoute(app: Hono, setup: RexServerSetup): void {
  app.use(`${RPC_PREFIX}/*`, async (c, next) => {
    let context: RexContext;
    try {
      context = await createRexContext(c.req.raw, setup.options.actor);
    } catch (error) {
      if (error instanceof RexDensityError) {
        return c.json({ code: "BAD_REQUEST", message: error.message }, 400);
      }
      throw error;
    }
    const { matched, response } = await setup.handler.handle(c.req.raw, {
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
}
