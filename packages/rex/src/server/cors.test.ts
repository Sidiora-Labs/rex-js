import type { AddressInfo } from "node:net";
import { serve, type ServerType } from "@hono/node-server";
import { Browser, type BrowserPage } from "happy-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as z from "zod/mini";
import { API_CREDENTIALS, apiFetch, credentialedFetch, type ApiFetch } from "../client/context.ts";
import { action } from "../core/action.ts";
import { actor, anonymousActor, type Actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { always } from "../core/policy.ts";
import { text } from "../core/schema.ts";
import { API_FETCH_EXPORT, generateEntryModule } from "../vite/entry-module.ts";
import {
  CORS_ALLOW_HEADERS,
  CORS_EXPOSE_HEADERS,
  CORS_MAX_AGE_SECONDS,
  createRexServer,
  memoryLedger,
} from "./index.ts";
import type { SecurityConfig } from "../core/config.ts";

const STATIC_ORIGIN = "http://app.rex.test";
const DESKTOP_ORIGIN = "http://tauri.localhost";
const FOREIGN_ORIGIN = "http://evil.rex.test";
const SESSION_COOKIE = "rex-session";

const rename = action("rename", {
  input: z.object({ title: text({ min: 1 }) }),
  output: z.object({ title: text(), by: text() }),
  policy: always(),
  effect: "reversible",
  label: "Rename",
  handler: (input, ctx) => ({ title: input.title, by: ctx.actor.id }),
});

const home = page("home", { route: "/", actions: [rename], regions: ["main"] });

const registry = { entities: [], actions: [rename], pages: [home], policies: [] };

const actors: Record<string, Actor> = {
  alice: actor({ id: "alice", permissions: ["notes.edit"] }),
};

function resolveActor(request: Request): Actor {
  const cookies = request.headers.get("cookie") ?? "";
  const session = cookies
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === SESSION_COOKIE)?.[1];
  return (session === undefined ? undefined : actors[session]) ?? anonymousActor;
}

function serverWith(security?: SecurityConfig) {
  return createRexServer({
    registry,
    ledger: memoryLedger(),
    actor: resolveActor,
    app: "remote",
    ...(security === undefined ? {} : { security }),
  });
}

function decodedActor(response: { headers: { get(name: string): string | null } }): string {
  const header = response.headers.get("x-rex-actor");
  if (header === null) throw new Error("the response exposes no actor header");
  return (JSON.parse(decodeURIComponent(header)) as { id: string }).id;
}

const rpcBody = JSON.stringify({ json: { title: "Remote" } });

describe("CORS for security.origins", () => {
  let app: ReturnType<typeof createRexServer>;

  beforeEach(() => {
    app = serverWith({ origins: [STATIC_ORIGIN, DESKTOP_ORIGIN] });
  });

  it("answers a preflight from a listed origin with credentials allowed", async () => {
    const response = await app.request("http://api.rex.test/rex/rpc/rename", {
      method: "OPTIONS",
      headers: {
        origin: STATIC_ORIGIN,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,x-rex-confirm",
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(STATIC_ORIGIN);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("access-control-allow-methods")?.split(",")).toEqual([
      "GET",
      "HEAD",
      "POST",
    ]);
    expect(response.headers.get("access-control-allow-headers")?.split(",")).toEqual([
      ...CORS_ALLOW_HEADERS,
    ]);
    expect(response.headers.get("access-control-max-age")).toBe(String(CORS_MAX_AGE_SECONDS));
    expect(response.headers.get("vary")).toContain("Origin");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("allows every listed origin, including a desktop shell scheme", async () => {
    const response = await app.request("http://api.rex.test/rex/manifest", {
      headers: { origin: DESKTOP_ORIGIN },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(DESKTOP_ORIGIN);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("exposes the actor and density headers on a cross-origin manifest read", async () => {
    const response = await app.request("http://api.rex.test/rex/manifest", {
      headers: {
        origin: STATIC_ORIGIN,
        cookie: `${SESSION_COOKIE}=alice`,
        "x-rex-density": "agent",
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(STATIC_ORIGIN);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("access-control-expose-headers")?.split(",")).toEqual([
      ...CORS_EXPOSE_HEADERS,
    ]);
    expect(CORS_EXPOSE_HEADERS).toEqual(["x-rex-actor", "x-rex-density"]);
    expect(response.headers.get("vary")).toContain("Origin");
    expect(decodedActor(response)).toBe("alice");
    expect(response.headers.get("x-rex-density")).toBe("agent");
  });

  it("runs a cross-origin action post from a listed origin", async () => {
    const response = await app.request("http://api.rex.test/rex/rpc/rename", {
      method: "POST",
      headers: {
        origin: STATIC_ORIGIN,
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=alice`,
      },
      body: rpcBody,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(STATIC_ORIGIN);
    expect(((await response.json()) as { json: unknown }).json).toEqual({
      title: "Remote",
      by: "alice",
    });
  });

  it("gives an unlisted origin no CORS grant and keeps refusing its posts", async () => {
    const read = await app.request("http://api.rex.test/rex/manifest", {
      headers: { origin: FOREIGN_ORIGIN },
    });
    expect(read.status).toBe(200);
    expect(read.headers.get("access-control-allow-origin")).toBeNull();
    expect(read.headers.get("access-control-allow-credentials")).toBeNull();
    expect(read.headers.get("vary")).toContain("Origin");

    const preflight = await app.request("http://api.rex.test/rex/rpc/rename", {
      method: "OPTIONS",
      headers: { origin: FOREIGN_ORIGIN, "access-control-request-method": "POST" },
    });
    expect(preflight.status).not.toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
    expect(preflight.headers.get("access-control-allow-methods")).toBeNull();

    const post = await app.request("http://api.rex.test/rex/rpc/rename", {
      method: "POST",
      headers: { origin: FOREIGN_ORIGIN, "content-type": "application/json" },
      body: rpcBody,
    });
    expect(post.status).toBe(403);
    expect(post.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("adds no CORS grant to same-origin requests", async () => {
    const response = await app.request("http://api.rex.test/rex/rpc/rename", {
      method: "POST",
      headers: { origin: "http://api.rex.test", "content-type": "application/json" },
      body: rpcBody,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("is not installed when security.origins is empty", async () => {
    const closed = serverWith();
    const preflight = await closed.request("http://api.rex.test/rex/rpc/rename", {
      method: "OPTIONS",
      headers: { origin: STATIC_ORIGIN, "access-control-request-method": "POST" },
    });
    expect(preflight.status).not.toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
    const read = await closed.request("http://api.rex.test/rex/manifest", {
      headers: { origin: STATIC_ORIGIN },
    });
    expect(read.headers.get("access-control-allow-origin")).toBeNull();
    expect(read.headers.get("vary")).toBeNull();
  });
});

describe("a static client on another origin talking to the remote server", () => {
  let server: ServerType;
  let apiOrigin: string;
  let browser: Browser;

  beforeAll(async () => {
    const app = serverWith({ origins: [STATIC_ORIGIN] });
    server = await new Promise<ServerType>((resolveServer, reject) => {
      const running = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, () =>
        resolveServer(running),
      );
      running.once("error", reject);
    });
    apiOrigin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    browser = new Browser();
    browser.defaultContext.cookieContainer.addCookies([
      { key: SESSION_COOKIE, value: "alice", originURL: new URL(apiOrigin) },
    ]);
  });

  afterAll(async () => {
    await browser.close();
    await new Promise<void>((done, fail) =>
      server.close((error) => (error ? fail(error) : done())),
    );
  });

  function pageAt(origin: string): BrowserPage {
    const opened = browser.newPage();
    opened.url = `${origin}/`;
    return opened;
  }

  function browserFetch(opened: BrowserPage): ApiFetch {
    const { window } = opened.mainFrame;
    return (input, init) =>
      window.fetch(String(input), init as never) as unknown as Promise<Response>;
  }

  it("sends the session cookie only through the credentialed client fetch", async () => {
    const opened = pageAt(STATIC_ORIGIN);
    const plain = browserFetch(opened);
    const credentialed = credentialedFetch(plain);

    const signedIn = await credentialed(`${apiOrigin}/rex/manifest?read=1`, {
      headers: { accept: "application/json" },
    });
    expect(signedIn.status).toBe(200);
    expect(signedIn.headers.get("access-control-allow-origin")).toBe(STATIC_ORIGIN);
    expect(decodedActor(signedIn)).toBe("alice");
    expect(((await signedIn.json()) as { app: { name: string } }).app.name).toBe("remote");

    const anonymous = await plain(`${apiOrigin}/rex/manifest?read=2`, {
      headers: { accept: "application/json" },
    });
    expect(anonymous.status).toBe(200);
    expect(decodedActor(anonymous)).toBe(anonymousActor.id);
    await opened.close();
  });

  it("invokes an action across origins with a preflight, the Origin check and the cookie", async () => {
    const opened = pageAt(STATIC_ORIGIN);
    const response = await credentialedFetch(browserFetch(opened))(`${apiOrigin}/rex/rpc/rename`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: rpcBody,
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { json: unknown }).json).toEqual({
      title: "Remote",
      by: "alice",
    });
    await opened.close();
  });

  it("is blocked by the browser when the page origin is not listed", async () => {
    const opened = pageAt(FOREIGN_ORIGIN);
    await expect(
      credentialedFetch(browserFetch(opened))(`${apiOrigin}/rex/manifest?read=3`),
    ).rejects.toThrow(/Cross-Origin Request Blocked/);
    await opened.close();
  });
});

describe("client.apiOrigin in the client entry", () => {
  const client = "/rex/client/index.ts";

  it("bakes the remote base URL and the credentialed fetch into a static entry", () => {
    const entry = generateEntryModule({ client, apiOrigin: "https://api.example.com" });
    expect(entry).toContain(`import { ${API_FETCH_EXPORT} } from ${JSON.stringify(client)};`);
    expect(entry).toContain(
      'startRexEntry(container, app, { dev: import.meta.env.DEV, baseUrl: "https://api.example.com", fetch: apiFetch });',
    );
    expect(entry).toContain(
      'createRexEntry(app, { baseUrl: "https://api.example.com", fetch: apiFetch });',
    );
  });

  it("leaves a same-origin entry without a base URL or a credentialed fetch", () => {
    for (const entry of [
      generateEntryModule({ client }),
      generateEntryModule({ client, apiOrigin: null }),
    ]) {
      expect(entry).not.toContain(API_FETCH_EXPORT);
      expect(entry).not.toContain("baseUrl");
      expect(entry).toContain("createRexEntry(app);");
    }
  });

  it("exports the credentialed fetch the entry imports", () => {
    expect(API_FETCH_EXPORT).toBe("apiFetch");
    expect(typeof apiFetch).toBe("function");
    expect(API_CREDENTIALS).toBe("include");
  });
});
