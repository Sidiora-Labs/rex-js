import { ORPCError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono/tiny";
import { describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { action, type AnyAction } from "../../core/action.ts";
import { actor, anonymousActor, type Actor } from "../../core/actor.ts";
import type { SecurityConfig } from "../../core/config.ts";
import { always } from "../../core/policy.ts";
import { buildManifest, stableStringify } from "../../manifest/build.ts";
import { text } from "../../schema/index.ts";
import { createRexServer, type RexServerSetup } from "../app.ts";
import { memoryLedger, type Ledger } from "../audit.ts";
import { DENSITY_HEADER } from "../context.ts";
import {
  CSRF_COOKIE,
  CSRF_FIELD,
  FORM_PREFIX,
  OUTCOME_COOKIE,
  createCsrfToken,
  decodeFormOutcome,
  formPath,
  type FormOutcome,
} from "../form.ts";
import {
  FORM_ROUTE as EXPORTED_FORM_ROUTE,
  installFormRoute as exportedInstallFormRoute,
} from "../index.ts";
import { buildActionRouter } from "../router.ts";
import { REX_ROUTES } from "../routes.ts";
import { FORM_ROUTE, installFormRoute } from "./form.ts";

const APP = "form-route";
const ORIGIN = "http://rex.test";

const rename = action("rename", {
  input: z.object({ name: text({ min: 1 }) }),
  output: z.object({ name: text() }),
  policy: always(),
  effect: "reversible",
  label: "Rename",
  handler: (input) => ({ name: input.name }),
});

const queue = action("queue", {
  input: z.object({}),
  output: z.object({}),
  policy: always(),
  effect: "reversible",
  label: "Queue job",
  handler: () => {
    throw new ORPCError("CONFLICT", { message: "a job is already queued" });
  },
});

const crash = action("crash", {
  input: z.object({}),
  output: z.object({}),
  policy: always(),
  effect: "reversible",
  label: "Open vault",
  handler: () => {
    throw new Error("the vault is sealed");
  },
});

const registry = { entities: [], actions: [rename, queue, crash], pages: [], policies: [] };

function resolveActor(request: Request): Actor {
  return request.headers.get("authorization") === "Bearer alice"
    ? actor({ id: "alice" })
    : anonymousActor;
}

interface SetupOptions {
  readonly security?: SecurityConfig;
  readonly listed?: readonly AnyAction[];
}

function setupFor(ledger: Ledger, extra: SetupOptions = {}): RexServerSetup {
  const manifest = buildManifest(
    { ...registry, actions: extra.listed ?? registry.actions },
    { app: APP },
  );
  return {
    options: {
      registry,
      ledger,
      actor: resolveActor,
      app: APP,
      manifest,
      ...(extra.security === undefined ? {} : { security: extra.security }),
    },
    handler: new RPCHandler(buildActionRouter(registry, { ledger })),
    manifestBody: stableStringify(manifest),
  };
}

function mount(ledger: Ledger, extra: SetupOptions = {}) {
  const app = new Hono();
  installFormRoute(app, setupFor(ledger, extra));
  return app;
}

interface PostOptions {
  readonly origin?: string | null;
  readonly cookie?: string;
  readonly referer?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

function post(
  app: ReturnType<typeof createRexServer>,
  actionId: string,
  body: URLSearchParams | string,
  options: PostOptions = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  const origin = options.origin === undefined ? ORIGIN : options.origin;
  if (origin !== null) headers.set("origin", origin);
  if (options.cookie !== undefined) headers.set("cookie", options.cookie);
  if (options.referer !== undefined) headers.set("referer", options.referer);
  return Promise.resolve(
    app.request(`${ORIGIN}${formPath(actionId)}`, { method: "POST", headers, body }),
  );
}

function setCookies(response: Response): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const line of response.headers.getSetCookie()) {
    const pair = line.split(";")[0] as string;
    const index = pair.indexOf("=");
    cookies.set(pair.slice(0, index), decodeURIComponent(pair.slice(index + 1)));
  }
  return cookies;
}

function outcomeOf(response: Response): FormOutcome {
  const outcome = decodeFormOutcome(setCookies(response).get(OUTCOME_COOKIE));
  expect(outcome).not.toBeNull();
  return outcome as FormOutcome;
}

function fields(entries: Readonly<Record<string, string>>, csrf: string): URLSearchParams {
  return new URLSearchParams({ [CSRF_FIELD]: csrf, ...entries });
}

describe("installFormRoute", () => {
  it("is mounted under /rex/form/:action by createRexServer and exported from the server entry", () => {
    expect(FORM_ROUTE).toBe(`${FORM_PREFIX}/:action`);
    expect(REX_ROUTES).toContain(installFormRoute);
    expect(exportedInstallFormRoute).toBe(installFormRoute);
    expect(EXPORTED_FORM_ROUTE).toBe(FORM_ROUTE);
  });

  it("refuses to install when the manifest body omits a registered action", () => {
    const ledger = memoryLedger();
    expect(() =>
      installFormRoute(new Hono(), setupFor(ledger, { listed: [rename, queue] })),
    ).toThrow(
      expect.objectContaining({
        name: "RexError",
        code: "REX308",
        message: expect.stringContaining('"crash"'),
      }),
    );
    expect(() => installFormRoute(new Hono(), setupFor(ledger))).not.toThrow();
  });

  it("checks the posting origin against the setup's security origins on its own", async () => {
    const ledger = memoryLedger();
    const csrf = createCsrfToken();
    const cookie = `${CSRF_COOKIE}=${csrf}`;
    const app = mount(ledger, { security: { origins: ["https://app.test"] } });
    const same = await post(app, "rename", fields({ name: "ledger" }, csrf), {
      cookie,
      referer: `${ORIGIN}/settings`,
    });
    expect(same.status).toBe(303);
    expect(same.headers.get("location")).toBe("/settings");
    expect(outcomeOf(same)).toMatchObject({
      actionId: "rename",
      ok: true,
      message: "Rename succeeded",
      code: null,
      fields: {},
    });
    const listed = await post(app, "rename", fields({ name: "ledger" }, csrf), {
      cookie,
      origin: "https://app.test",
    });
    expect(listed.status).toBe(303);
    expect(listed.headers.get("location")).toBe("/");
    const foreign = await post(app, "rename", fields({ name: "ledger" }, csrf), {
      cookie,
      origin: "https://evil.test",
      referer: `${ORIGIN}/settings`,
    });
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get("content-type")).toContain("text/html");
    const html = await foreign.text();
    expect(html).toContain('<main data-rex-form-error="">');
    expect(html).toContain("<h1>Form rejected</h1>");
    expect(html).toContain('<a href="/settings" data-rex-form-back="">Go back</a>');
    const missing = await post(app, "rename", fields({ name: "ledger" }, csrf), {
      cookie,
      origin: null,
    });
    expect(missing.status).toBe(403);
    expect((await ledger.list()).map((record) => record.outcome)).toEqual(["ok", "ok"]);
  });

  it.each(["//evil.test/phish", "/\\evil.test/phish", "///evil.test/phish"])(
    "keeps form outcomes on this origin for Referer path %s",
    async (path) => {
      const ledger = memoryLedger();
      const app = createRexServer(setupFor(ledger).options);
      const csrf = createCsrfToken();
      const cookie = `${CSRF_COOKIE}=${csrf}`;
      const referer = `${ORIGIN}${path}`;
      for (const name of ["ledger", ""]) {
        const response = await post(app, "rename", fields({ name }, csrf), { cookie, referer });
        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toBe("/");
        expect(new URL(response.headers.get("location") as string, ORIGIN).origin).toBe(ORIGIN);
        expect(outcomeOf(response).ok).toBe(name !== "");
      }
      const foreign = await post(app, "rename", fields({ name: "ledger" }, csrf), {
        cookie,
        referer,
        origin: "https://evil.test",
      });
      expect(foreign.status).toBe(403);
      expect(foreign.headers.get("location")).toBeNull();
      const expired = await post(app, "rename", fields({ name: "ledger" }, createCsrfToken()), {
        cookie,
        referer,
      });
      expect(expired.status).toBe(403);
      expect(expired.headers.get("location")).toBeNull();
      expect(await expired.text()).toContain('<a href="/" data-rex-form-back="">Go back</a>');
      expect((await ledger.list()).filter((entry) => entry.outcome === "ok")).toHaveLength(1);
    },
  );

  it("retains local Referer paths and query strings on real form responses", async () => {
    const ledger = memoryLedger();
    const app = createRexServer(setupFor(ledger).options);
    const csrf = createCsrfToken();
    const path = "/reports/%2Fteam?tab=recent&next=https://example.com/path";
    const response = await post(app, "rename", fields({ name: "ledger" }, csrf), {
      cookie: `${CSRF_COOKIE}=${csrf}`,
      referer: `${ORIGIN}${path}`,
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(path);
    expect(outcomeOf(response).ok).toBe(true);
  });

  it("renders each refusal as an HTML error page that links back to the same-origin Referer", async () => {
    const ledger = memoryLedger();
    const csrf = createCsrfToken();
    const cookie = `${CSRF_COOKIE}=${csrf}`;
    const app = mount(ledger);
    const unknown = await post(app, "missing", fields({}, csrf), {
      cookie,
      referer: `${ORIGIN}/settings?tab=jobs`,
    });
    expect(unknown.status).toBe(404);
    const unknownHtml = await unknown.text();
    expect(unknownHtml).toContain("<h1>Unknown action</h1>");
    expect(unknownHtml).toContain("No action &quot;missing&quot; exists.");
    expect(unknownHtml).toContain('<a href="/settings?tab=jobs" data-rex-form-back="">Go back</a>');
    const unsupported = await post(app, "rename", JSON.stringify({ name: "x" }), {
      cookie,
      headers: { "content-type": "application/json" },
      referer: "https://evil.test/phish",
    });
    expect(unsupported.status).toBe(415);
    const unsupportedHtml = await unsupported.text();
    expect(unsupportedHtml).toContain("<h1>Unsupported form encoding</h1>");
    expect(unsupportedHtml).toContain('<a href="/" data-rex-form-back="">Go back</a>');
    const expired = await post(app, "rename", fields({ name: "x" }, createCsrfToken()), {
      cookie,
    });
    expect(expired.status).toBe(403);
    expect(await expired.text()).toContain("<h1>Form expired</h1>");
    expect(setCookies(expired).has(CSRF_COOKIE)).toBe(false);
    const fresh = await post(app, "rename", fields({ name: "x" }, csrf));
    expect(fresh.status).toBe(403);
    expect(setCookies(fresh).get(CSRF_COOKIE)).toMatch(/^[0-9a-f]{64}$/);
    expect(await ledger.list()).toEqual([]);
  });

  it("answers an unknown density header with the 400 error page before the action runs", async () => {
    const ledger = memoryLedger();
    const csrf = createCsrfToken();
    const app = mount(ledger);
    const response = await post(app, "rename", fields({ name: "x" }, csrf), {
      cookie: `${CSRF_COOKIE}=${csrf}`,
      headers: { [DENSITY_HEADER]: "compact" },
      referer: `${ORIGIN}/rename`,
    });
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("<h1>Invalid density</h1>");
    expect(html).toContain("REX321");
    expect(html).toContain('<a href="/rename" data-rex-form-back="">Go back</a>');
    expect(await ledger.list()).toEqual([]);
  });

  it("writes handler failures into the outcome cookie, keeping ORPC codes and marking plain errors internal", async () => {
    const ledger = memoryLedger();
    const csrf = createCsrfToken();
    const cookie = `${CSRF_COOKIE}=${csrf}`;
    const app = mount(ledger);
    const conflict = await post(app, "queue", fields({}, csrf), {
      cookie,
      referer: `${ORIGIN}/jobs`,
    });
    expect(conflict.status).toBe(303);
    expect(conflict.headers.get("location")).toBe("/jobs");
    expect(outcomeOf(conflict)).toMatchObject({
      actionId: "queue",
      ok: false,
      code: "CONFLICT",
      message: "Queue job failed: a job is already queued",
      fields: {},
    });
    const sealed = await post(app, "crash", fields({}, csrf), { cookie });
    expect(sealed.status).toBe(303);
    expect(sealed.headers.get("location")).toBe("/");
    expect(outcomeOf(sealed)).toMatchObject({
      actionId: "crash",
      ok: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Open vault failed: the vault is sealed",
      fields: {},
    });
    expect((await ledger.list()).map((record) => [record.actionId, record.outcome])).toEqual([
      ["queue", "CONFLICT"],
      ["crash", "INTERNAL_SERVER_ERROR"],
    ]);
  });
});
