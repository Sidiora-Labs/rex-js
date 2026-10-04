import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono/tiny";
import { describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { action } from "../../core/action.ts";
import { actor, anonymousActor, type Actor } from "../../core/actor.ts";
import { always } from "../../core/policy.ts";
import { buildManifest, stableStringify } from "../../manifest/build.ts";
import { boolean, text } from "../../schema/index.ts";
import { createRexServer, type RegistryRouterClient, type RexServerSetup } from "../app.ts";
import { memoryLedger, type Ledger } from "../audit.ts";
import {
  DEV_AUDIT_PATH as EXPORTED_DEV_AUDIT_PATH,
  installDevRoute as exportedInstallDevRoute,
  isDevServer as exportedIsDevServer,
} from "../index.ts";
import { buildActionRouter } from "../router.ts";
import { REX_ROUTES } from "../routes.ts";
import {
  DEV_AUDIT_DEFAULT_LIMIT,
  DEV_AUDIT_MAX_LIMIT,
  DEV_AUDIT_PATH,
  installDevRoute,
  isDevServer,
  parseAuditLimit,
} from "./dev.ts";

const APP = "dev-route";
const ORIGIN = "http://rex.test";

const toggleDust = action("toggle-dust", {
  input: z.object({ hide: boolean() }),
  output: z.object({ hide: boolean(), by: text() }),
  policy: always(),
  effect: "reversible",
  handler: (input, ctx) => ({ hide: input.hide, by: ctx.actor.id }),
});

const registry = { entities: [], actions: [toggleDust], pages: [], policies: [] };

function resolveActor(request: Request): Actor {
  const name = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return name === "" ? anonymousActor : actor({ id: name });
}

function setupFor(ledger: Ledger, dev: boolean | undefined): RexServerSetup {
  const manifest = buildManifest(registry, { app: APP });
  return {
    options: {
      registry,
      ledger,
      actor: resolveActor,
      app: APP,
      manifest,
      ...(dev === undefined ? {} : { dev }),
    },
    handler: new RPCHandler(buildActionRouter(registry, { ledger })),
    manifestBody: stableStringify(manifest),
  };
}

function clientFor(
  app: ReturnType<typeof createRexServer>,
  as: string,
): RegistryRouterClient<typeof registry> {
  return createORPCClient(
    new RPCLink({
      url: `${ORIGIN}/rex/rpc`,
      headers: { authorization: `Bearer ${as}`, origin: ORIGIN },
      fetch: async (request) => app.fetch(request),
    }),
  );
}

describe("parseAuditLimit", () => {
  it("defaults to 50, accepts whole numbers from 1 to 500 and refuses anything else", () => {
    expect(DEV_AUDIT_DEFAULT_LIMIT).toBe(50);
    expect(DEV_AUDIT_MAX_LIMIT).toBe(500);
    expect(parseAuditLimit(undefined)).toBe(DEV_AUDIT_DEFAULT_LIMIT);
    expect(parseAuditLimit("1")).toBe(1);
    expect(parseAuditLimit("25")).toBe(25);
    expect(parseAuditLimit("500")).toBe(500);
    for (const value of ["0", "501", "-1", "1.5", " 5", "5 ", "abc", "", "1e2", "0x10"]) {
      expect(parseAuditLimit(value), JSON.stringify(value)).toBeNull();
    }
  });
});

describe("isDevServer", () => {
  it("honours an explicit dev flag and refuses a non-boolean one", () => {
    expect(exportedIsDevServer).toBe(isDevServer);
    expect(isDevServer({ dev: true })).toBe(true);
    expect(isDevServer({ dev: false })).toBe(false);
    expect(() => isDevServer({ dev: "yes" as unknown as boolean })).toThrow(
      expect.objectContaining({ name: "RexError", code: "REX400" }),
    );
  });

  it("falls back to NODE_ENV being development when the flag is absent", () => {
    const previous = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "development";
      expect(isDevServer({})).toBe(true);
      process.env.NODE_ENV = "production";
      expect(isDevServer({})).toBe(false);
      delete process.env.NODE_ENV;
      expect(isDevServer({})).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });
});

describe("installDevRoute", () => {
  it("installs the audit route only for a dev server", async () => {
    expect(DEV_AUDIT_PATH).toBe("/rex/dev/audit");
    expect(EXPORTED_DEV_AUDIT_PATH).toBe(DEV_AUDIT_PATH);
    expect(exportedInstallDevRoute).toBe(installDevRoute);
    expect(REX_ROUTES).toContain(installDevRoute);
    const ledger = memoryLedger();
    const dev = new Hono();
    installDevRoute(dev, setupFor(ledger, true));
    const served = await dev.request(DEV_AUDIT_PATH);
    expect(served.status).toBe(200);
    expect(served.headers.get("cache-control")).toBe("no-store");
    expect(await served.json()).toEqual({ records: [] });
    const production = new Hono();
    installDevRoute(production, setupFor(ledger, false));
    expect((await production.request(DEV_AUDIT_PATH)).status).toBe(404);
    expect(process.env.NODE_ENV).not.toBe("development");
    const unset = new Hono();
    installDevRoute(unset, setupFor(ledger, undefined));
    expect((await unset.request(DEV_AUDIT_PATH)).status).toBe(404);
  });

  it("tails the ledger records written by real action calls with a bounded limit", async () => {
    const ledger = memoryLedger();
    const app = createRexServer({ registry, ledger, actor: resolveActor, app: APP, dev: true });
    for (const [as, hide] of [
      ["alice", true],
      ["bob", false],
      ["carol", true],
    ] as const) {
      await expect(clientFor(app, as)["toggle-dust"]({ hide })).resolves.toEqual({ hide, by: as });
    }
    const records = await ledger.list();
    expect(records.map((record) => record.actor)).toEqual(["alice", "bob", "carol"]);
    const all = await app.request(DEV_AUDIT_PATH);
    expect(all.status).toBe(200);
    expect(all.headers.get("cache-control")).toBe("no-store");
    expect(await all.json()).toEqual({ records });
    const tail = await app.request(`${DEV_AUDIT_PATH}?limit=2`);
    expect(tail.status).toBe(200);
    expect(await tail.json()).toEqual({ records: records.slice(-2) });
    const max = await app.request(`${DEV_AUDIT_PATH}?limit=${DEV_AUDIT_MAX_LIMIT}`);
    expect(await max.json()).toEqual({ records });
    for (const limit of ["0", "501", "two"]) {
      const invalid = await app.request(`${DEV_AUDIT_PATH}?limit=${limit}`);
      expect(invalid.status, limit).toBe(400);
      expect(await invalid.json()).toEqual({
        code: "BAD_REQUEST",
        message: `limit must be a whole number from 1 to ${DEV_AUDIT_MAX_LIMIT}`,
      });
    }
    const posted = await app.request(`${ORIGIN}${DEV_AUDIT_PATH}`, {
      method: "POST",
      headers: { origin: ORIGIN },
    });
    expect(posted.status).toBe(404);
  });
});
