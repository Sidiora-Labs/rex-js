import { Hono } from "hono/tiny";
import { describe, expect, it } from "vitest";
import { actor } from "../../core/actor.ts";
import { createRexServer } from "../app.ts";
import { memoryLedger } from "../audit.ts";
import {
  HEALTH_PATH as EXPORTED_HEALTH_PATH,
  installHealthRoute as exportedInstallHealthRoute,
} from "../index.ts";
import { DEFAULT_SECURITY_HEADERS } from "../middleware/security.ts";
import { REX_ROUTES } from "../routes.ts";
import { HEALTH_PATH, installHealthRoute } from "./health.ts";

describe("installHealthRoute", () => {
  it("answers GET /rex/health with an ok status as JSON on a bare Hono app", async () => {
    expect(HEALTH_PATH).toBe("/rex/health");
    const app = new Hono();
    installHealthRoute(app);
    const response = await app.request(HEALTH_PATH);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("serves only GET on the exact path", async () => {
    const app = new Hono();
    installHealthRoute(app);
    expect((await app.request(HEALTH_PATH, { method: "POST" })).status).toBe(404);
    expect((await app.request(HEALTH_PATH, { method: "DELETE" })).status).toBe(404);
    expect((await app.request(`${HEALTH_PATH}z`)).status).toBe(404);
    expect((await app.request("/rex")).status).toBe(404);
  });

  it("is mounted by createRexServer behind the security middleware and exported from the server entry", async () => {
    expect(REX_ROUTES).toContain(installHealthRoute);
    expect(exportedInstallHealthRoute).toBe(installHealthRoute);
    expect(EXPORTED_HEALTH_PATH).toBe(HEALTH_PATH);
    const app = createRexServer({
      registry: { entities: [], actions: [], pages: [], policies: [] },
      ledger: memoryLedger(),
      actor: () => actor({ id: "alice" }),
    });
    const response = await app.request(HEALTH_PATH);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    for (const [name, value] of Object.entries(DEFAULT_SECURITY_HEADERS)) {
      expect(response.headers.get(name), name).toBe(value);
    }
  });
});
