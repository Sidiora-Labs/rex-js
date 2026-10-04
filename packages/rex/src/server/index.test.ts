import { describe, expect, it } from "vitest";
import * as staticCache from "./adapters/static-cache.ts";
import * as app from "./app.ts";
import * as audit from "./audit.ts";
import * as context from "./context.ts";
import * as flow from "./flow.ts";
import * as form from "./form.ts";
import * as server from "./index.ts";
import * as loaders from "./loaders.ts";
import { REX_MIDDLEWARE } from "./middleware.ts";
import * as cors from "./middleware/cors.ts";
import * as security from "./middleware/security.ts";
import * as telemetry from "./middleware/telemetry.ts";
import * as router from "./router.ts";
import { REX_ROUTES } from "./routes.ts";
import * as dev from "./routes/dev.ts";
import * as formRoute from "./routes/form.ts";
import * as health from "./routes/health.ts";
import * as manifest from "./routes/manifest.ts";
import * as pagesText from "./routes/pages-text.ts";
import * as render from "./routes/render.ts";
import * as rpc from "./routes/rpc.ts";

type Exports = Readonly<Record<string, unknown>>;

const index: Exports = server;

const STAR_MODULES: Readonly<Record<string, Exports>> = {
  "audit.ts": audit,
  "context.ts": context,
  "router.ts": router,
  "flow.ts": flow,
  "app.ts": app,
  "form.ts": form,
  "adapters/static-cache.ts": staticCache,
  "middleware/telemetry.ts": telemetry,
  "loaders.ts": loaders,
  "middleware/cors.ts": cors,
  "routes/pages-text.ts": pagesText,
};

const NAMED_MODULES: readonly (readonly [string, Exports, readonly string[]])[] = [
  ["routes/health.ts", health, ["HEALTH_PATH", "installHealthRoute"]],
  ["routes/dev.ts", dev, ["DEV_AUDIT_PATH", "installDevRoute", "isDevServer"]],
  ["routes/manifest.ts", manifest, ["MANIFEST_PATH", "installManifestRoute"]],
  ["routes/rpc.ts", rpc, ["RPC_PREFIX", "installRpcRoute"]],
  [
    "middleware/security.ts",
    security,
    [
      "CSP_HEADER",
      "CSP_REPORT_ONLY_HEADER",
      "DEFAULT_SECURITY_HEADERS",
      "ORIGIN_HEADER",
      "REX_PATH_PREFIX",
      "contentSecurityPolicy",
      "cspHeaderName",
      "installSecurityMiddleware",
      "isAllowedOrigin",
      "isRexPath",
      "requestNonce",
      "resolveSecurityPolicy",
      "securityHeaders",
    ],
  ],
  ["routes/form.ts", formRoute, ["FORM_ROUTE", "installFormRoute"]],
  [
    "routes/render.ts",
    render,
    [
      "RENDER_STATUS",
      "installRenderRoute",
      "isDocumentPath",
      "pageRendererFor",
      "registerPageRenderer",
    ],
  ],
];

const SHADOWED_BY_NAMED_EXPORT = new Set(["middleware/telemetry.ts:REX_PATH_PREFIX"]);

function expectedNames(): string[] {
  const names = new Set<string>(["REX_MIDDLEWARE", "REX_ROUTES"]);
  for (const module of Object.values(STAR_MODULES)) {
    for (const name of Object.keys(module)) names.add(name);
  }
  for (const [, , listed] of NAMED_MODULES) {
    for (const name of listed) names.add(name);
  }
  return [...names].sort();
}

describe("rex/server", () => {
  it("re-exports every runtime export of its star-exported modules by identity", () => {
    for (const [file, module] of Object.entries(STAR_MODULES)) {
      const names = Object.keys(module);
      expect(names.length, file).toBeGreaterThan(0);
      for (const name of names) {
        if (SHADOWED_BY_NAMED_EXPORT.has(`${file}:${name}`)) continue;
        expect(index[name], `${file} ${name}`).toBe(module[name]);
      }
    }
  });

  it("re-exports the listed names of the route and middleware modules by identity", () => {
    for (const [file, module, listed] of NAMED_MODULES) {
      for (const name of listed) {
        expect(module[name], `${file} ${name}`).toBeDefined();
        expect(index[name], `${file} ${name}`).toBe(module[name]);
      }
    }
    expect(index.REX_MIDDLEWARE).toBe(REX_MIDDLEWARE);
    expect(index.REX_ROUTES).toBe(REX_ROUTES);
  });

  it("resolves REX_PATH_PREFIX to the security middleware's prefix over the telemetry one", () => {
    expect(telemetry.REX_PATH_PREFIX).toBe("/rex/");
    expect(security.REX_PATH_PREFIX).toBe("/rex");
    expect(index.REX_PATH_PREFIX).toBe(security.REX_PATH_PREFIX);
    expect(index.requestNonce).toBe(context.requestNonce);
    expect(security.requestNonce).toBe(context.requestNonce);
  });

  it("exports exactly the names its sources contribute", () => {
    expect(Object.keys(index).sort()).toEqual(expectedNames());
  });

  it("keeps the route internals that are not listed private", () => {
    expect(render.RENDER_PAGE_HEADER).toBeDefined();
    expect(render.HTML_CONTENT_TYPE).toBeDefined();
    expect(dev.DEV_AUDIT_MAX_LIMIT).toBeDefined();
    expect(typeof dev.parseAuditLimit).toBe("function");
    for (const name of [
      "RENDER_PAGE_HEADER",
      "HTML_CONTENT_TYPE",
      "DEV_AUDIT_MAX_LIMIT",
      "parseAuditLimit",
    ]) {
      expect(index, name).not.toHaveProperty(name);
    }
  });

  it("offers the public server entry points", () => {
    expect(server.createRexServer).toBe(app.createRexServer);
    expect(server.mountRexServer).toBe(app.mountRexServer);
    expect(server.memoryLedger).toBe(audit.memoryLedger);
    expect(server.createRexContext).toBe(context.createRexContext);
    expect(server.buildActionRouter).toBe(router.buildActionRouter);
    expect(server.buildFlowRouter).toBe(flow.buildFlowRouter);
    expect(server.createStaticCache).toBe(staticCache.createStaticCache);
    expect(server.installTelemetry).toBe(telemetry.installTelemetry);
    expect(server.runPageLoaders).toBe(loaders.runPageLoaders);
    expect(server.corsMiddleware).toBe(cors.corsMiddleware);
    expect(server.renderPageText).toBe(pagesText.renderPageText);
  });
});
