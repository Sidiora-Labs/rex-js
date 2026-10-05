import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { Hono } from "hono/tiny";
import { describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { action } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import { policy } from "../core/policy.ts";
import { createRexServer, memoryLedger, type RegistryRouterClient } from "./index.ts";

describe("native extension contract", () => {
  it("isolates Hono wrappers while preserving Action policy and audit", async () => {
    const access = policy("access", {
      permissions: ["inspect"],
      resolve: (subject) => subject.permissions,
    });
    const inspect = action("inspect", {
      input: z.object({}),
      output: z.object({ actor: z.string() }),
      policy: access.requires({ permissions: ["inspect"] }),
      effect: "read",
      handler: (_, context) => ({ actor: context.actor.id }),
    });
    const registry = { actions: [inspect], policies: [access], entities: [], pages: [] };
    function application(name: string, permissions: readonly string[]) {
      const ledger = memoryLedger();
      const subject = actor({ id: name, permissions: [...permissions] });
      const server = createRexServer({ registry, ledger, actor: () => subject });
      const wrapper = new Hono();
      let requests = 0;
      wrapper.use("*", async (context, next) => {
        requests += 1;
        await next();
        context.header("x-application", name);
      });
      wrapper.get("/extension-status", (context) => context.json({ name, requests }));
      wrapper.route("/", server);
      const client: RegistryRouterClient<typeof registry> = createORPCClient(
        new RPCLink({
          url: "http://rex.test/rex/rpc",
          headers: { origin: "http://rex.test" },
          fetch: async (request) => wrapper.fetch(request),
        }),
      );
      return { wrapper, server, client, ledger, requests: () => requests };
    }

    const allowed = application("allowed", ["inspect"]);
    const denied = application("denied", []);
    expect(await allowed.client.inspect({})).toEqual({ actor: "allowed" });
    expect(allowed.requests()).toBe(1);
    expect(denied.requests()).toBe(0);
    await expect(denied.client.inspect({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(allowed.requests()).toBe(1);
    expect(denied.requests()).toBe(1);

    for (const [app, name] of [
      [allowed, "allowed"],
      [denied, "denied"],
    ] as const) {
      const response = await app.wrapper.request("/extension-status");
      expect(response.headers.get("x-application")).toBe(name);
      expect(await response.json()).toEqual({ name, requests: 2 });
      const direct = await app.server.request("/rex/health");
      expect(direct.headers.get("x-application")).toBeNull();
      expect(app.requests()).toBe(2);
    }
    expect(await allowed.ledger.list()).toMatchObject([
      { actor: "allowed", actionId: "inspect", outcome: "ok" },
    ]);
    expect(await denied.ledger.list()).toMatchObject([
      { actor: "denied", actionId: "inspect", outcome: "FORBIDDEN" },
    ]);
  });
});
