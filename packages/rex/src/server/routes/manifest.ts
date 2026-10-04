import type { Hono } from "hono";
import { REX_MANIFEST_PATH } from "../../core/protocol.ts";
import type { RexServerSetup } from "../app.ts";
import {
  ACTOR_HEADER,
  DENSITY_HEADER,
  RexDensityError,
  createRexContext,
  encodeActorHeaderValue,
  type RexContext,
} from "../context.ts";

export const MANIFEST_PATH = REX_MANIFEST_PATH;

export function installManifestRoute(app: Hono, setup: RexServerSetup): void {
  app.get(MANIFEST_PATH, async (c) => {
    let context: RexContext;
    try {
      context = await createRexContext(c.req.raw, setup.options.actor);
    } catch (error) {
      if (error instanceof RexDensityError) {
        return c.json({ code: "BAD_REQUEST", message: error.message }, 400);
      }
      throw error;
    }
    const headers: Record<string, string> = {
      "content-type": "application/json; charset=utf-8",
      [ACTOR_HEADER]: encodeActorHeaderValue(context.actor),
    };
    if (c.req.raw.headers.get(DENSITY_HEADER) !== null) headers[DENSITY_HEADER] = context.density;
    return c.body(setup.manifestBody, 200, headers);
  });
}
