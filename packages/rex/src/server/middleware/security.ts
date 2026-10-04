import type { Context, Hono } from "hono";
import type { AnyAction } from "../../core/action.ts";
import {
  resolveOptions,
  type ClientConfig,
  type CspMode,
  type ResolvedSecurity,
  type RexOptionsConfig,
  type SecurityConfig,
} from "../../core/config.ts";
import type { RexServerSetup } from "../app.ts";
import { createNonce } from "../context.ts";

declare module "../app.ts" {
  interface RexServerOptions<A extends AnyAction> {
    readonly security?: SecurityConfig;
    readonly client?: ClientConfig;
  }
}

export const REX_PATH_PREFIX = "/rex";
export const ORIGIN_HEADER = "origin";
export const CSP_HEADER = "content-security-policy";
export const CSP_REPORT_ONLY_HEADER = "content-security-policy-report-only";

export const DEFAULT_SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
});

const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

export interface SecurityPolicy {
  readonly security: ResolvedSecurity;
  readonly apiOrigin: string | null;
}

export interface SecurityPolicyInput {
  readonly security?: SecurityConfig;
  readonly client?: ClientConfig;
}

export function resolveSecurityPolicy(input: SecurityPolicyInput = {}): SecurityPolicy {
  const options: { -readonly [K in keyof RexOptionsConfig]: RexOptionsConfig[K] } = {};
  if (input.security !== undefined) options.security = input.security;
  if (input.client !== undefined) options.client = input.client;
  const resolved = resolveOptions(options);
  return Object.freeze({ security: resolved.security, apiOrigin: resolved.client.apiOrigin });
}

const NONCES = new WeakMap<Request, string>();

export function requestNonce(request: Request): string {
  let nonce = NONCES.get(request);
  if (nonce === undefined) {
    nonce = createNonce();
    NONCES.set(request, nonce);
  }
  return nonce;
}

export function isRexPath(path: string): boolean {
  return path === REX_PATH_PREFIX || path.startsWith(`${REX_PATH_PREFIX}/`);
}

export function isAllowedOrigin(
  origin: string | null,
  requestUrl: string,
  origins: readonly string[],
): boolean {
  if (origin === null || origin === "" || origin === "null") return false;
  return origin === new URL(requestUrl).origin || origins.includes(origin);
}

export function contentSecurityPolicy(nonce: string, apiOrigin: string | null): string {
  const connect = apiOrigin === null ? "'self'" : `'self' ${apiOrigin}`;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connect}`,
    "img-src 'self' data: blob:",
  ].join("; ");
}

export function cspHeaderName(mode: CspMode): string | null {
  if (mode === "strict") return CSP_HEADER;
  if (mode === "report") return CSP_REPORT_ONLY_HEADER;
  return null;
}

export function securityHeaders(policy: SecurityPolicy, nonce: string): Record<string, string> {
  const headers: Record<string, string> = { ...DEFAULT_SECURITY_HEADERS };
  const name = cspHeaderName(policy.security.csp);
  if (name !== null) headers[name] = contentSecurityPolicy(nonce, policy.apiOrigin);
  return { ...headers, ...policy.security.headers };
}

function rejectOrigin(c: Context, origin: string | null): Response {
  const shown = origin === null || origin === "" ? "a missing Origin" : `Origin ${origin}`;
  return c.json(
    {
      code: "FORBIDDEN",
      message: `${c.req.method} ${c.req.path} was refused for ${shown}; same-origin requests and origins listed in security.origins are allowed`,
    },
    403,
  );
}

export function installSecurityMiddleware(app: Hono, setup: RexServerSetup): void {
  const policy = resolveSecurityPolicy(setup.options);
  app.use("*", async (c, next) => {
    const request = c.req.raw;
    const nonce = requestNonce(request);
    const origin = request.headers.get(ORIGIN_HEADER);
    if (
      !SAFE_METHODS.has(request.method) &&
      isRexPath(c.req.path) &&
      !isAllowedOrigin(origin, request.url, policy.security.origins)
    ) {
      c.res = rejectOrigin(c, origin);
    } else {
      await next();
    }
    c.res = new Response(c.res.body, c.res);
    for (const [name, value] of Object.entries(securityHeaders(policy, nonce))) {
      c.res.headers.set(name, value);
    }
  });
}
