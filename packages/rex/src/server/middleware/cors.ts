import type { Hono, MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { REX_ACTOR_HEADER, REX_CONFIRM_HEADER, REX_DENSITY_HEADER } from "../../core/protocol.ts";
import type { RexServerSetup } from "../app.ts";
import { ORIGIN_HEADER, resolveSecurityPolicy } from "./security.ts";

export const CORS_ALLOW_METHODS: readonly string[] = Object.freeze(["GET", "HEAD", "POST"]);

export const CORS_ALLOW_HEADERS: readonly string[] = Object.freeze([
  "content-type",
  "authorization",
  "accept-language",
  REX_CONFIRM_HEADER,
  REX_DENSITY_HEADER,
]);

export const CORS_EXPOSE_HEADERS: readonly string[] = Object.freeze([
  REX_ACTOR_HEADER,
  REX_DENSITY_HEADER,
]);

export const CORS_MAX_AGE_SECONDS = 600;

export function isCorsOrigin(
  origin: string | null | undefined,
  origins: readonly string[],
): boolean {
  return typeof origin === "string" && origin !== "" && origins.includes(origin);
}

export function corsMiddleware(origins: readonly string[]): MiddlewareHandler {
  const allowed = Object.freeze([...origins]);
  const handler = cors({
    origin: (origin) => (isCorsOrigin(origin, allowed) ? origin : null),
    allowMethods: [...CORS_ALLOW_METHODS],
    allowHeaders: [...CORS_ALLOW_HEADERS],
    exposeHeaders: [...CORS_EXPOSE_HEADERS],
    maxAge: CORS_MAX_AGE_SECONDS,
    credentials: true,
  });
  return async (c, next) => {
    if (isCorsOrigin(c.req.header(ORIGIN_HEADER), allowed)) return handler(c, next);
    await next();
    c.header("Vary", "Origin", { append: true });
  };
}

export function installCorsMiddleware(app: Hono, setup: RexServerSetup): void {
  const { security } = resolveSecurityPolicy(setup.options);
  if (security.origins.length === 0) return;
  app.use("*", corsMiddleware(security.origins));
}
