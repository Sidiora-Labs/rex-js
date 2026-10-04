import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono/tiny";
import { describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { action } from "../../core/action.ts";
import { actor, anonymousActor, type Actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { always } from "../../core/policy.ts";
import { REX_MANIFEST_PATH } from "../../core/protocol.ts";
import { buildManifest, stableStringify } from "../../manifest/build.ts";
import { boolean } from "../../schema/index.ts";
import { createRexServer, type RexServerSetup } from "../app.ts";
import { memoryLedger } from "../audit.ts";
import {
  ACTOR_HEADER,
  DENSITY_HEADER,
  encodeActorHeaderValue,
  type ActorResolver,
} from "../context.ts";
import {
  MANIFEST_PATH as EXPORTED_MANIFEST_PATH,
  installManifestRoute as exportedInstallManifestRoute,
} from "../index.ts";
import { buildActionRouter } from "../router.ts";
import { REX_ROUTES } from "../routes.ts";
import { MANIFEST_PATH, installManifestRoute } from "./manifest.ts";

const APP = "manifest-route";

const toggleDust = action("toggle-dust", {
  input: z.object({ hide: boolean() }),
  output: z.object({ hide: boolean() }),
  policy: always(),
  effect: "reversible",
  handler: (input) => ({ hide: input.hide }),
});

const portfolio = page("portfolio", { route: "/portfolio", actions: [toggleDust] });

const registry = { entities: [], actions: [toggleDust], pages: [portfolio], policies: [] };
const manifest = buildManifest(registry, { app: APP });

const alice = actor({
  id: "alice",
  roles: ["owner"],
  permissions: ["dust"],
  attributes: { tier: "gold" },
});

function resolveActor(request: Request): Actor {
  return request.headers.get("authorization") === "Bearer alice" ? alice : anonymousActor;
}

function setupFor(resolve: ActorResolver): RexServerSetup {
  const ledger = memoryLedger();
  return {
    options: { registry, ledger, actor: resolve, app: APP, manifest },
    handler: new RPCHandler(buildActionRouter(registry, { ledger })),
    manifestBody: stableStringify(manifest),
  };
}

function mount(resolve: ActorResolver = resolveActor) {
  const app = new Hono();
  installManifestRoute(app, setupFor(resolve));
  return app;
}

describe("installManifestRoute", () => {
  it("serves the setup's manifest body verbatim with the resolved actor encoded in a header", async () => {
    expect(MANIFEST_PATH).toBe(REX_MANIFEST_PATH);
    const app = mount();
    const response = await app.request(MANIFEST_PATH, {
      headers: { authorization: "Bearer alice" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await response.text()).toBe(stableStringify(manifest));
    const encoded = response.headers.get(ACTOR_HEADER);
    expect(encoded).toBe(encodeActorHeaderValue(alice));
    expect(JSON.parse(decodeURIComponent(encoded as string))).toEqual({
      id: "alice",
      roles: ["owner"],
      permissions: ["dust"],
      attributes: { tier: "gold" },
    });
    expect(response.headers.has(DENSITY_HEADER)).toBe(false);
    const anonymous = await app.request(MANIFEST_PATH);
    expect(anonymous.status).toBe(200);
    expect(anonymous.headers.get(ACTOR_HEADER)).toBe(encodeActorHeaderValue(anonymousActor));
    expect(await anonymous.text()).toBe(stableStringify(manifest));
  });

  it("echoes the density header only when the request carries one and refuses an unknown density before resolving the actor", async () => {
    let resolved = 0;
    const app = mount((request) => {
      resolved += 1;
      return resolveActor(request);
    });
    const agent = await app.request(MANIFEST_PATH, { headers: { [DENSITY_HEADER]: "agent" } });
    expect(agent.status).toBe(200);
    expect(agent.headers.get(DENSITY_HEADER)).toBe("agent");
    const plain = await app.request(MANIFEST_PATH, { headers: { [DENSITY_HEADER]: "default" } });
    expect(plain.headers.get(DENSITY_HEADER)).toBe("default");
    expect(resolved).toBe(2);
    const invalid = await app.request(MANIFEST_PATH, { headers: { [DENSITY_HEADER]: "compact" } });
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get("content-type")).toContain("application/json");
    expect(await invalid.json()).toEqual({
      code: "BAD_REQUEST",
      message: 'REX321 x-rex-density must be one of default, agent, received "compact"',
    });
    expect(invalid.headers.has(ACTOR_HEADER)).toBe(false);
    expect(resolved).toBe(2);
  });

  it("lets any other failure of the actor resolver reach the app's error handler", async () => {
    const seen: unknown[] = [];
    const app = mount(() => {
      throw new Error("the directory is offline");
    });
    app.onError((error, c) => {
      seen.push(error);
      return c.text("directory unavailable", 503);
    });
    const response = await app.request(MANIFEST_PATH);
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("directory unavailable");
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(Error);
    expect((seen[0] as Error).message).toBe("the directory is offline");
  });

  it("is the first route createRexServer mounts and the one the server entry exports", async () => {
    expect(REX_ROUTES[0]).toBe(installManifestRoute);
    expect(exportedInstallManifestRoute).toBe(installManifestRoute);
    expect(EXPORTED_MANIFEST_PATH).toBe(MANIFEST_PATH);
    const app = createRexServer({
      registry,
      ledger: memoryLedger(),
      actor: resolveActor,
      app: APP,
    });
    const response = await app.request(MANIFEST_PATH, {
      headers: { authorization: "Bearer alice", [DENSITY_HEADER]: "agent" },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(stableStringify(manifest));
    expect(response.headers.get(ACTOR_HEADER)).toBe(encodeActorHeaderValue(alice));
    expect(response.headers.get(DENSITY_HEADER)).toBe("agent");
  });
});
