import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono/tiny";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { view, type LazyPageModuleSet, type LoadedPageModules } from "../client/page.tsx";
import { action } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import { page, type AnyPage } from "../core/page.ts";
import { always } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { STATE_EXPORT_NAMES } from "../core/states.ts";
import { buildManifest, stableStringify } from "../manifest/build.ts";
import { boolean, text } from "../schema/index.ts";
import { REX_SERVER_COMPOSITION, type RexServerInstaller, type RexServerSetup } from "./app.ts";
import { memoryLedger } from "./audit.ts";
import { installFlowRoutes } from "./flow.ts";
import { REX_ROUTES as EXPORTED_REX_ROUTES } from "./index.ts";
import { buildActionRouter } from "./router.ts";
import { REX_ROUTES } from "./routes.ts";
import { installDevRoute } from "./routes/dev.ts";
import { installFormRoute } from "./routes/form.ts";
import { HEALTH_PATH, installHealthRoute } from "./routes/health.ts";
import { MANIFEST_PATH, installManifestRoute } from "./routes/manifest.ts";
import { MARKDOWN_CONTENT_TYPE, installPagesTextRoute, pageTextPath } from "./routes/pages-text.ts";
import {
  HTML_CONTENT_TYPE,
  RENDER_KIND_HEADER,
  installRenderRoute,
  registerPageRenderer,
} from "./routes/render.ts";
import { installRpcRoute } from "./routes/rpc.ts";
import { createRexRenderer } from "./ssr.ts";

const APP = "routes-order";

const toggleDust = action("toggle-dust", {
  input: z.object({ hide: boolean() }),
  output: z.object({ hide: boolean() }),
  policy: always(),
  effect: "reversible",
  handler: (input) => ({ hide: input.hide }),
});

const portfolio = page("portfolio", {
  route: "/portfolio/:account",
  params: z.object({ account: text({ min: 1 }) }),
  actions: [toggleDust],
  chrome: { title: "Portfolio" },
});

function statesFor(label: string): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.values(STATE_EXPORT_NAMES).map((name) => [
      name,
      () => createElement("p", null, `${label}: ${name}`),
    ]),
  );
}

function lazySet(declared: AnyPage, loaded: LoadedPageModules): LazyPageModuleSet {
  return Object.freeze({
    page: declared,
    chunk: `page-${declared.id}`,
    load: () => Promise.resolve(loaded),
  });
}

const PortfolioView = view<{ account: string }>(({ params }) =>
  createElement("p", null, `Holdings of ${params.account}`),
);

const ORDERED: readonly RexServerInstaller[] = [
  installManifestRoute,
  installHealthRoute,
  installRpcRoute,
  installFlowRoutes,
  installFormRoute,
  installDevRoute,
  installRenderRoute,
  installPagesTextRoute,
];

describe("REX_ROUTES", () => {
  it("lists each route installer once, in mount order", () => {
    expect(REX_ROUTES).toHaveLength(ORDERED.length);
    ORDERED.forEach((install, index) => {
      expect(REX_ROUTES[index], install.name).toBe(install);
    });
    expect(new Set(REX_ROUTES).size).toBe(ORDERED.length);
    for (const install of REX_ROUTES) expect(typeof install).toBe("function");
  });

  it("is the composition createRexServer mounts and the list the server entry exports", () => {
    expect(REX_SERVER_COMPOSITION.routes).toBe(REX_ROUTES);
    expect(EXPORTED_REX_ROUTES).toBe(REX_ROUTES);
    expect(REX_SERVER_COMPOSITION.middleware).not.toBe(REX_ROUTES);
    for (const install of REX_SERVER_COMPOSITION.middleware) {
      expect(REX_ROUTES).not.toContain(install);
    }
  });

  it("installs the Rex endpoints on a bare Hono app with the catch-all render route leaving /rex paths to the pages text route", async () => {
    const registry = createRegistry().register(toggleDust, portfolio).freeze();
    const manifest = buildManifest(registry, { app: APP });
    const ledger = memoryLedger();
    const setup: RexServerSetup = {
      options: { registry, ledger, actor: () => actor({ id: "alice" }), app: APP, manifest },
      handler: new RPCHandler(buildActionRouter(registry, { ledger })),
      manifestBody: stableStringify(manifest),
    };
    const unregister = registerPageRenderer(
      registry,
      createRexRenderer({
        bundle: {
          registry,
          manifest,
          pages: [lazySet(portfolio, { view: PortfolioView, states: statesFor("Portfolio") })],
        },
      }),
    );
    try {
      const app = new Hono();
      for (const install of REX_ROUTES) install(app, setup);
      const health = await app.request(HEALTH_PATH);
      expect(health.status).toBe(200);
      expect(await health.json()).toEqual({ status: "ok" });
      const served = await app.request(MANIFEST_PATH);
      expect(served.status).toBe(200);
      expect(await served.text()).toBe(setup.manifestBody);
      const text = await app.request(`${pageTextPath("portfolio")}?account=acc-1`);
      expect(text.status).toBe(200);
      expect(text.headers.get("content-type")).toBe(MARKDOWN_CONTENT_TYPE);
      expect(text.headers.has(RENDER_KIND_HEADER)).toBe(false);
      expect(await text.text()).toContain("| URL | `/portfolio/acc-1` |");
      const rendered = await app.request("/portfolio/acc-1");
      expect(rendered.status).toBe(200);
      expect(rendered.headers.get("content-type")).toBe(HTML_CONTENT_TYPE);
      expect(rendered.headers.get(RENDER_KIND_HEADER)).toBe("page");
      expect(await rendered.text()).toContain("Holdings of acc-1");
      const unknown = await app.request("/rex/unknown");
      expect(unknown.status).toBe(404);
      expect(unknown.headers.has(RENDER_KIND_HEADER)).toBe(false);
    } finally {
      unregister();
    }
  });
});
