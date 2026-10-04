import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { action, type AnyAction } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { always } from "../../core/policy.ts";
import { buildManifest, stableStringify } from "../../manifest/build.ts";
import { text } from "../../schema/index.ts";
import type { RexServerOptions, RexServerSetup } from "../app.ts";
import { memoryLedger } from "../audit.ts";
import { requestNonce as contextRequestNonce } from "../context.ts";
import { buildActionRouter } from "../router.ts";
import {
  CSP_HEADER,
  CSP_REPORT_ONLY_HEADER,
  DEFAULT_CSP_MODE,
  DEFAULT_SECURITY_HEADERS,
  ORIGIN_HEADER,
  REX_PATH_PREFIX,
  contentSecurityPolicy,
  cspHeaderName,
  installSecurityMiddleware,
  isAllowedOrigin,
  isRexPath,
  requestNonce,
  resolveSecurityPolicy,
  securityHeaders,
} from "./security.ts";

const ORIGIN = "http://rex.test";
const PARTNER = "https://partner.example";
const API = "https://api.example";

const echo = action("echo", {
  input: z.object({ text: text({ min: 1 }) }),
  output: z.object({ echoed: text() }),
  policy: always(),
  effect: "read",
  handler: (input) => ({ echoed: input.text }),
});

const home = page("home", { route: "/", actions: [echo], regions: ["main"] });

const source = { entities: [], actions: [echo], pages: [home], policies: [] };

function setupFor(options: Partial<RexServerOptions<AnyAction>> = {}): RexServerSetup {
  const ledger = memoryLedger();
  const resolved: RexServerOptions<AnyAction> = {
    registry: source,
    ledger,
    actor: () => actor({ id: "ada" }),
    ...options,
  };
  return {
    options: resolved,
    handler: new RPCHandler(buildActionRouter(resolved.registry, { ledger: resolved.ledger })),
    manifestBody: stableStringify(buildManifest(resolved.registry, { app: "security" })),
  };
}

function securedApp(setup: RexServerSetup): { readonly app: Hono; readonly reached: string[] } {
  const app = new Hono();
  const reached: string[] = [];
  installSecurityMiddleware(app, setup);
  app.all("/rex/rpc/echo", (c) => {
    reached.push(`${c.req.method} ${c.req.header(ORIGIN_HEADER) ?? "-"}`);
    return c.json({ echoed: "hi" });
  });
  app.post("/hooks/payment", (c) => c.text("received"));
  app.get("/doc", (c) => c.html(`<script nonce="${requestNonce(c.req.raw)}">1</script>`));
  return { app, reached };
}

describe("resolveSecurityPolicy", () => {
  it("fills the defaults and freezes copies of the given lists", () => {
    const policy = resolveSecurityPolicy();
    expect(DEFAULT_CSP_MODE).toBe("strict");
    expect(policy).toEqual({
      security: { csp: "strict", origins: [], headers: {}, secretNames: [] },
      apiOrigin: null,
    });
    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.security)).toBe(true);
    expect(Object.isFrozen(policy.security.origins)).toBe(true);
    expect(Object.isFrozen(policy.security.headers)).toBe(true);
    const origins = [PARTNER];
    const headers = { "x-frame-options": "DENY" };
    const given = resolveSecurityPolicy({
      security: { csp: "report", origins, headers, secretNames: ["TOKEN"] },
      client: { apiOrigin: API },
    });
    expect(given).toEqual({
      security: {
        csp: "report",
        origins: [PARTNER],
        headers: { "x-frame-options": "DENY" },
        secretNames: ["TOKEN"],
      },
      apiOrigin: API,
    });
    origins.push("https://later.example");
    headers["x-frame-options"] = "SAMEORIGIN";
    expect(given.security.origins).toEqual([PARTNER]);
    expect(given.security.headers).toEqual({ "x-frame-options": "DENY" });
    expect(resolveSecurityPolicy({ client: {} }).apiOrigin).toBeNull();
  });
});

describe("request classification", () => {
  it("recognizes the /rex path prefix", () => {
    expect(REX_PATH_PREFIX).toBe("/rex");
    expect(isRexPath("/rex")).toBe(true);
    expect(isRexPath("/rex/")).toBe(true);
    expect(isRexPath("/rex/rpc/echo")).toBe(true);
    expect(isRexPath("/rexy")).toBe(false);
    expect(isRexPath("/")).toBe(false);
    expect(isRexPath("/app/rex")).toBe(false);
  });

  it("allows the request's own origin and the configured ones only", () => {
    const url = `${ORIGIN}/rex/rpc/echo`;
    expect(isAllowedOrigin(null, url, [PARTNER])).toBe(false);
    expect(isAllowedOrigin("", url, [PARTNER])).toBe(false);
    expect(isAllowedOrigin("null", url, [PARTNER])).toBe(false);
    expect(isAllowedOrigin(ORIGIN, url, [])).toBe(true);
    expect(isAllowedOrigin("https://rex.test", url, [])).toBe(false);
    expect(isAllowedOrigin(`${ORIGIN}:8080`, url, [])).toBe(false);
    expect(isAllowedOrigin(PARTNER, url, [PARTNER])).toBe(true);
    expect(isAllowedOrigin(PARTNER, url, [])).toBe(false);
    expect(isAllowedOrigin(PARTNER, url, [`${PARTNER}:8443`])).toBe(false);
    expect(isAllowedOrigin("tauri://localhost", url, ["tauri://localhost"])).toBe(true);
  });
});

describe("headers", () => {
  it("writes the content security policy around the nonce and the api origin", () => {
    expect(contentSecurityPolicy("abc", null)).toBe(
      "default-src 'self'; script-src 'self' 'nonce-abc'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:",
    );
    expect(contentSecurityPolicy("abc", API)).toBe(
      `default-src 'self'; script-src 'self' 'nonce-abc'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${API}; img-src 'self' data: blob:`,
    );
  });

  it("maps each csp mode to its header", () => {
    expect(CSP_HEADER).toBe("content-security-policy");
    expect(CSP_REPORT_ONLY_HEADER).toBe("content-security-policy-report-only");
    expect(cspHeaderName("strict")).toBe(CSP_HEADER);
    expect(cspHeaderName("report")).toBe(CSP_REPORT_ONLY_HEADER);
    expect(cspHeaderName("off")).toBeNull();
  });

  it("adds the companion headers and lets configured headers override them", () => {
    expect(DEFAULT_SECURITY_HEADERS).toEqual({
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
    });
    expect(Object.isFrozen(DEFAULT_SECURITY_HEADERS)).toBe(true);
    expect(securityHeaders(resolveSecurityPolicy(), "abc")).toEqual({
      ...DEFAULT_SECURITY_HEADERS,
      [CSP_HEADER]: contentSecurityPolicy("abc", null),
    });
    const report = securityHeaders(
      resolveSecurityPolicy({ security: { csp: "report" }, client: { apiOrigin: API } }),
      "abc",
    );
    expect(report[CSP_REPORT_ONLY_HEADER]).toBe(contentSecurityPolicy("abc", API));
    expect(report).not.toHaveProperty(CSP_HEADER);
    const off = securityHeaders(
      resolveSecurityPolicy({
        security: {
          csp: "off",
          headers: { "referrer-policy": "no-referrer", "x-frame-options": "DENY" },
        },
      }),
      "abc",
    );
    expect(off).toEqual({
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      "x-frame-options": "DENY",
    });
  });
});

describe("installSecurityMiddleware", () => {
  it("refuses unsafe cross-origin requests under /rex before the route runs and stamps every response", async () => {
    const { app, reached } = securedApp(setupFor({ security: { origins: [PARTNER] } }));
    const post = (origin?: string) =>
      app.request(`${ORIGIN}/rex/rpc/echo`, {
        method: "POST",
        headers: origin === undefined ? {} : { [ORIGIN_HEADER]: origin },
        body: "{}",
      });
    const missing = await post();
    expect(missing.status).toBe(403);
    expect(await missing.json()).toEqual({
      code: "FORBIDDEN",
      message:
        "POST /rex/rpc/echo was refused for a missing Origin; same-origin requests and origins listed in security.origins are allowed",
    });
    expect(missing.headers.get(CSP_HEADER)).toMatch(/'nonce-[0-9a-f]{32}'/);
    expect(missing.headers.get("x-content-type-options")).toBe("nosniff");
    const foreign = await post("https://evil.example");
    expect(foreign.status).toBe(403);
    expect(((await foreign.json()) as { message: string }).message).toContain(
      "refused for Origin https://evil.example",
    );
    expect((await post("null")).status).toBe(403);
    expect(reached).toEqual([]);
    expect((await post(ORIGIN)).status).toBe(200);
    expect((await post(PARTNER)).status).toBe(200);
    const preflight = await app.request(`${ORIGIN}/rex/rpc/echo`, {
      method: "OPTIONS",
      headers: { [ORIGIN_HEADER]: "https://evil.example" },
    });
    expect(preflight.status).toBe(200);
    const read = await app.request(`${ORIGIN}/rex/rpc/echo`, {
      headers: { [ORIGIN_HEADER]: "https://evil.example" },
    });
    expect(read.status).toBe(200);
    const hook = await app.request(`${ORIGIN}/hooks/payment`, { method: "POST", body: "{}" });
    expect(hook.status).toBe(200);
    expect(await hook.text()).toBe("received");
    expect(hook.headers.get(CSP_HEADER)).toMatch(/'nonce-[0-9a-f]{32}'/);
    expect(reached).toEqual([
      `POST ${ORIGIN}`,
      `POST ${PARTNER}`,
      "OPTIONS https://evil.example",
      "GET https://evil.example",
    ]);
  });

  it("writes the request nonce shared with SSR into the policy and keeps the route's body", async () => {
    expect(requestNonce).toBe(contextRequestNonce);
    const { app } = securedApp(setupFor());
    const request = new Request(`${ORIGIN}/doc`);
    const nonce = requestNonce(request);
    const response = await app.fetch(request);
    expect(response.status).toBe(200);
    expect(response.headers.get(CSP_HEADER)).toBe(contentSecurityPolicy(nonce, null));
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toBe(`<script nonce="${nonce}">1</script>`);
    const other = await app.fetch(new Request(`${ORIGIN}/doc`));
    expect(other.headers.get(CSP_HEADER)).not.toBe(response.headers.get(CSP_HEADER));
  });

  it("applies the csp mode, header overrides and api origin from the setup options", async () => {
    const { app } = securedApp(
      setupFor({
        security: {
          csp: "report",
          headers: { "x-frame-options": "DENY", "Referrer-Policy": "no-referrer" },
        },
        client: { apiOrigin: API },
      }),
    );
    const response = await app.request(`${ORIGIN}/doc`);
    expect(response.headers.get(CSP_HEADER)).toBeNull();
    expect(response.headers.get(CSP_REPORT_ONLY_HEADER)).toContain(`connect-src 'self' ${API}`);
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("permissions-policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
    const { app: off } = securedApp(setupFor({ security: { csp: "off" } }));
    const bare = await off.request(`${ORIGIN}/doc`);
    expect(bare.headers.get(CSP_HEADER)).toBeNull();
    expect(bare.headers.get(CSP_REPORT_ONLY_HEADER)).toBeNull();
    expect(bare.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
