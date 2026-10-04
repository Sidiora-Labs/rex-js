// @vitest-environment node
import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as z from "zod/mini";
import { action } from "../core/action.ts";
import { actor, anonymousActor, type Actor } from "../core/actor.ts";
import { always, can, never } from "../core/policy.ts";
import { boolean, integer, money, text } from "../schema/index.ts";
import { toJsonSchema } from "../manifest/json-schema.ts";
import { buildManifest } from "../manifest/build.ts";
import { ActionForm } from "../client/form.tsx";
import { region, view } from "../client/page.tsx";
import { page as declarePage } from "../core/page.ts";
import { createRegistry } from "../core/registry.ts";
import { createRexRenderer, registerPageRenderer } from "./ssr.ts";
import {
  ACTION_FIELD,
  CONFIRM_FIELD,
  CSRF_COOKIE,
  CSRF_FIELD,
  FORM_PREFIX,
  FORM_ROUTE,
  OUTCOME_COOKIE,
  REX_ROUTES,
  coerceFormData,
  createCsrfToken,
  createRexServer,
  decodeFormOutcome,
  encodeFormOutcome,
  ensureCsrfToken,
  formPath,
  installFormRoute,
  isAllowedOrigin,
  memoryLedger,
  readFormOutcome,
  verifyCsrf,
  type FormOutcome,
  type Ledger,
} from "./index.ts";

const ORIGIN = "http://rex.test";

const deposits: unknown[] = [];
const sent: unknown[] = [];

const deposit = action("deposit", {
  input: z.object({
    amount: integer({ min: 1 }),
    memo: z.optional(text()),
    express: boolean(),
    tags: z.array(z.string()),
    meta: z.object({ source: text({ min: 1 }), priority: z.int() }),
  }),
  output: z.object({ amount: z.number() }),
  policy: can("deposit"),
  effect: "reversible",
  label: "Deposit",
  form: { redirect: "/done" },
  handler: (input) => {
    deposits.push(input);
    return { amount: input.amount };
  },
});

const toggle = action("toggle", {
  input: z.object({ hide: boolean() }),
  output: z.object({ hide: z.boolean() }),
  policy: always(),
  effect: "reversible",
  label: "Hide dust",
  handler: (input) => ({ hide: input.hide }),
});

const purge = action("purge", {
  input: z.object({}),
  output: z.object({}),
  policy: never(),
  effect: "reversible",
  handler: () => ({}),
});

const send = action("send", {
  input: z.object({ to: text({ min: 1 }), amount: money() }),
  output: z.object({ txId: z.string() }),
  policy: can("send"),
  effect: "irreversible",
  label: "Send",
  form: { confirmTitle: "Send funds?" },
  handler: (input) => {
    sent.push(input);
    return { txId: `tx-${input.to}-${input.amount}` };
  },
});

const source = {
  entities: [],
  actions: [deposit, toggle, purge, send],
  pages: [],
  policies: [],
};

const actors: Record<string, Actor> = {
  alice: actor({ id: "alice", permissions: ["deposit", "send"] }),
};

function resolveActor(request: Request): Actor {
  const name = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return actors[name] ?? anonymousActor;
}

interface PostOptions {
  readonly origin?: string | null;
  readonly cookie?: string | null;
  readonly referer?: string;
  readonly as?: string;
  readonly contentType?: string;
}

function post(
  app: ReturnType<typeof createRexServer>,
  actionId: string,
  body: URLSearchParams | FormData | string,
  options: PostOptions = {},
): Promise<Response> {
  const headers = new Headers();
  const origin = options.origin === undefined ? ORIGIN : options.origin;
  if (origin !== null) headers.set("origin", origin);
  if (options.cookie !== undefined && options.cookie !== null)
    headers.set("cookie", options.cookie);
  if (options.referer !== undefined) headers.set("referer", options.referer);
  if (options.as !== undefined) headers.set("authorization", `Bearer ${options.as}`);
  if (options.contentType !== undefined) headers.set("content-type", options.contentType);
  return Promise.resolve(
    app.request(`${ORIGIN}${formPath(actionId)}`, {
      method: "POST",
      headers,
      body,
    }),
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

function cookiePair(response: Response, name: string): string {
  const line = response.headers.getSetCookie().find((entry) => entry.startsWith(`${name}=`));
  expect(line).toBeDefined();
  return (line as string).split(";")[0] as string;
}

function outcomeOf(response: Response): FormOutcome {
  const outcome = decodeFormOutcome(setCookies(response).get(OUTCOME_COOKIE));
  expect(outcome).not.toBeNull();
  return outcome as FormOutcome;
}

function fields(
  entries: Record<string, string | readonly string[]>,
  csrf: string,
): URLSearchParams {
  const params = new URLSearchParams();
  params.append(CSRF_FIELD, csrf);
  for (const [name, value] of Object.entries(entries)) {
    for (const item of typeof value === "string" ? [value] : value) params.append(name, item);
  }
  return params;
}

describe("coerceFormData", () => {
  const schema = toJsonSchema(deposit.input, "input");

  it("coerces numbers, booleans, repeated names and nested dotted names with the input schema", () => {
    const form = new FormData();
    form.append(CSRF_FIELD, "x");
    form.append(ACTION_FIELD, "deposit");
    form.append(CONFIRM_FIELD, "y");
    form.append("amount", "12");
    form.append("memo", "rent");
    form.append("express", "on");
    form.append("tags", "a");
    form.append("tags", "b");
    form.append("meta.source", "web");
    form.append("meta.priority", "2");
    expect(coerceFormData(form, schema)).toEqual({
      amount: 12,
      memo: "rent",
      express: true,
      tags: ["a", "b"],
      meta: { source: "web", priority: 2 },
    });
  });

  it("maps unchecked boxes to false, missing repeats to an empty list and empty optional fields to absent", () => {
    const form = new FormData();
    form.append("amount", "3");
    form.append("memo", "");
    form.append("meta.source", "web");
    form.append("meta.priority", "1");
    expect(coerceFormData(form, schema)).toEqual({
      amount: 3,
      express: false,
      tags: [],
      meta: { source: "web", priority: 1 },
    });
  });

  it("keeps values that do not coerce so validation reports them and maps empty nullable values to null", () => {
    const form = new FormData();
    form.append("amount", "twelve");
    form.append("express", "maybe");
    expect(coerceFormData(form, schema)).toEqual({
      amount: "twelve",
      express: "maybe",
      tags: [],
      meta: {},
    });
    const nullable = toJsonSchema(
      z.object({ limit: z.nullable(z.number()), off: boolean() }),
      "input",
    );
    const empty = new FormData();
    empty.append("limit", "");
    empty.append("off", "false");
    expect(coerceFormData(empty, nullable)).toEqual({
      limit: null,
      off: false,
    });
  });
});

describe("form protocol helpers", () => {
  it("issues and verifies double-submit tokens", () => {
    const token = createCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyCsrf(token, token)).toBe(true);
    expect(verifyCsrf(token, createCsrfToken())).toBe(false);
    expect(verifyCsrf(null, token)).toBe(false);
    expect(verifyCsrf(token, null)).toBe(false);
    const fresh = ensureCsrfToken(new Request(`${ORIGIN}/send`));
    expect(fresh.setCookie).toContain(`${CSRF_COOKIE}=${fresh.token}`);
    expect(fresh.setCookie).toContain("SameSite=Lax");
    const kept = ensureCsrfToken(
      new Request(`${ORIGIN}/send`, {
        headers: { cookie: `${CSRF_COOKIE}=${token}` },
      }),
    );
    expect(kept).toEqual({ token, setCookie: null });
  });

  it("accepts only the request origin or a listed origin", () => {
    const url = `${ORIGIN}${formPath("toggle")}`;
    expect(isAllowedOrigin(ORIGIN, url, [])).toBe(true);
    expect(isAllowedOrigin(null, url, [])).toBe(false);
    expect(isAllowedOrigin("", url, [])).toBe(false);
    expect(isAllowedOrigin("null", url, [])).toBe(false);
    expect(isAllowedOrigin("https://evil.test", url, [])).toBe(false);
    expect(isAllowedOrigin("https://app.test", url, ["https://app.test"])).toBe(true);
  });

  it("round-trips the outcome cookie payload and rejects malformed payloads", () => {
    const outcome: FormOutcome = {
      actionId: "deposit",
      ok: false,
      message: "Deposit: invalid input",
      at: new Date(0).toISOString(),
      code: "BAD_REQUEST",
      fields: { amount: ["Too small"] },
    };
    expect(decodeFormOutcome(encodeFormOutcome(outcome))).toEqual(outcome);
    expect(decodeFormOutcome("not json")).toBeNull();
    expect(decodeFormOutcome(JSON.stringify({ ...outcome, ok: "yes" }))).toBeNull();
    expect(decodeFormOutcome(JSON.stringify({ ...outcome, fields: { amount: "x" } }))).toBeNull();
    const cookie = `${OUTCOME_COOKIE}=${encodeURIComponent(encodeFormOutcome(outcome))}`;
    expect(readFormOutcome(new Request(`${ORIGIN}/`, { headers: { cookie } }))).toEqual(outcome);
  });
});

describe("POST /rex/form/<action>", () => {
  let ledger: Ledger;
  let app: ReturnType<typeof createRexServer>;
  let csrf: string;
  let cookie: string;

  beforeEach(() => {
    deposits.length = 0;
    sent.length = 0;
    ledger = memoryLedger();
    app = createRexServer({
      registry: source,
      ledger,
      actor: resolveActor,
      app: "forms",
    });
    csrf = createCsrfToken();
    cookie = `${CSRF_COOKIE}=${csrf}`;
  });

  it("is registered in the ordered route list under /rex/form", () => {
    expect(REX_ROUTES).toContain(installFormRoute);
    expect(FORM_ROUTE).toBe(`${FORM_PREFIX}/:action`);
    expect(formPath("deposit")).toBe("/rex/form/deposit");
  });

  it("rejects a post without an Origin or from a foreign origin with 403 and runs nothing", async () => {
    const body = () => fields({ hide: "on" }, csrf);
    const missing = await post(app, "toggle", body(), { origin: null, cookie });
    expect(missing.status).toBe(403);
    const foreign = await post(app, "toggle", body(), {
      origin: "https://evil.test",
      cookie,
    });
    expect(foreign.status).toBe(403);
    expect(await foreign.text()).toContain("origin");
    expect(await ledger.list()).toEqual([]);
  });

  it("accepts a post from an origin listed in security.origins and still refuses an unlisted one", async () => {
    const listed = createRexServer({
      registry: source,
      ledger,
      actor: resolveActor,
      app: "forms",
      security: { origins: ["https://app.test"] },
    });
    const accepted = await post(listed, "toggle", fields({ hide: "on" }, csrf), {
      origin: "https://app.test",
      cookie,
      referer: `${ORIGIN}/settings`,
    });
    expect(accepted.status).toBe(303);
    expect(accepted.headers.get("location")).toBe("/settings");
    expect(outcomeOf(accepted)).toMatchObject({ actionId: "toggle", ok: true });
    const foreign = await post(listed, "toggle", fields({ hide: "on" }, csrf), {
      origin: "https://evil.test",
      cookie,
    });
    expect(foreign.status).toBe(403);
    expect((await ledger.list()).map((record) => record.outcome)).toEqual(["ok"]);
  });

  it("rejects a post whose _csrf field does not match the rex-csrf cookie with 403", async () => {
    const noCookie = await post(app, "toggle", fields({ hide: "on" }, csrf), {
      cookie: null,
    });
    expect(noCookie.status).toBe(403);
    expect(setCookies(noCookie).get(CSRF_COOKIE)).toMatch(/^[0-9a-f]{64}$/);
    const mismatch = await post(app, "toggle", fields({ hide: "on" }, createCsrfToken()), {
      cookie,
    });
    expect(mismatch.status).toBe(403);
    expect(setCookies(mismatch).has(CSRF_COOKIE)).toBe(false);
    const missingField = new URLSearchParams({ hide: "on" });
    expect((await post(app, "toggle", missingField, { cookie })).status).toBe(403);
    expect(await ledger.list()).toEqual([]);
  });

  it("answers 404 for an unknown action, 415 for a non-form body and 400 for a mismatched action field", async () => {
    expect((await post(app, "missing", fields({}, csrf), { cookie })).status).toBe(404);
    const json = await post(app, "toggle", JSON.stringify({ hide: true }), {
      cookie,
      contentType: "application/json",
    });
    expect(json.status).toBe(415);
    const body = fields({ hide: "on" }, csrf);
    body.append(ACTION_FIELD, "purge");
    expect((await post(app, "toggle", body, { cookie })).status).toBe(400);
    expect(await ledger.list()).toEqual([]);
  });

  it("runs a multipart post with coerced input, redirects to form.redirect and writes an ok outcome and audit record", async () => {
    const form = new FormData();
    form.append(CSRF_FIELD, csrf);
    form.append(ACTION_FIELD, "deposit");
    form.append("amount", "25");
    form.append("express", "on");
    form.append("tags", "rent");
    form.append("tags", "march");
    form.append("meta.source", "web");
    form.append("meta.priority", "3");
    const response = await post(app, "deposit", form, {
      cookie,
      as: "alice",
      referer: `${ORIGIN}/deposit`,
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/done");
    expect(deposits).toEqual([
      {
        amount: 25,
        express: true,
        tags: ["rent", "march"],
        meta: { source: "web", priority: 3 },
      },
    ]);
    const outcome = outcomeOf(response);
    expect(outcome).toMatchObject({
      actionId: "deposit",
      ok: true,
      message: "Deposit succeeded",
      code: null,
      fields: {},
    });
    const cookieLine = response.headers
      .getSetCookie()
      .find((line) => line.startsWith(`${OUTCOME_COOKIE}=`));
    expect(cookieLine).toContain("Path=/");
    expect(cookieLine).toContain("SameSite=Lax");
    expect(cookieLine).not.toContain("HttpOnly");
    const records = await ledger.list();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      actor: "alice",
      actionId: "deposit",
      outcome: "ok",
      effect: "reversible",
    });
  });

  it("redirects an urlencoded post back to the same-origin Referer when the action declares no redirect", async () => {
    const response = await post(app, "toggle", fields({ hide: "on" }, csrf), {
      cookie,
      referer: `${ORIGIN}/settings?tab=display`,
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/settings?tab=display");
    expect(outcomeOf(response)).toMatchObject({ actionId: "toggle", ok: true });
    const foreign = await post(app, "toggle", fields({}, csrf), {
      cookie,
      referer: "https://evil.test/phish",
    });
    expect(foreign.headers.get("location")).toBe("/");
    expect((await ledger.list()).map((record) => record.outcome)).toEqual(["ok", "ok"]);
  });

  it("redirects back with field errors in the outcome cookie when validation fails", async () => {
    const response = await post(
      app,
      "deposit",
      fields({ amount: "0", "meta.source": "", "meta.priority": "1" }, csrf),
      { cookie, as: "alice", referer: `${ORIGIN}/deposit` },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/deposit");
    const outcome = outcomeOf(response);
    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe("BAD_REQUEST");
    expect(outcome.message).toMatch(/^Deposit: invalid input: /);
    expect(Object.keys(outcome.fields).sort()).toEqual(["amount", "meta.source"]);
    expect(outcome.fields.amount?.length).toBeGreaterThan(0);
    expect(deposits).toEqual([]);
    const records = await ledger.list();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      actionId: "deposit",
      outcome: "BAD_REQUEST",
    });
  });

  it("evaluates policy and reports a denial in the outcome cookie and the audit ledger", async () => {
    const response = await post(app, "purge", fields({}, csrf), {
      cookie,
      referer: `${ORIGIN}/`,
    });
    expect(response.status).toBe(303);
    const outcome = outcomeOf(response);
    expect(outcome).toMatchObject({
      actionId: "purge",
      ok: false,
      code: "FORBIDDEN",
    });
    expect(outcome.message).toBe("purge: not allowed (never)");
    const denied = await post(app, "deposit", fields({ amount: "5" }, csrf), {
      cookie,
    });
    expect(outcomeOf(denied).code).toBe("FORBIDDEN");
    expect((await ledger.list()).map((record) => [record.actionId, record.outcome])).toEqual([
      ["purge", "FORBIDDEN"],
      ["deposit", "FORBIDDEN"],
    ]);
  });

  it("renders a server-side confirmation page for an irreversible action and runs it when the page is confirmed", async () => {
    const page = await post(app, "send", fields({ to: "bob", amount: "12.50" }, csrf), {
      cookie,
      as: "alice",
      referer: `${ORIGIN}/send`,
    });
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(sent).toEqual([]);
    expect(await ledger.list()).toEqual([]);

    const window = new Window({ url: ORIGIN });
    try {
      const document = new window.DOMParser().parseFromString(await page.text(), "text/html");
      expect(document.title).toBe("Send funds?");
      expect(document.querySelector("h1")?.textContent).toBe("Send funds?");
      const dialog = document.querySelector('[data-rex-confirm="send"]');
      expect(dialog?.getAttribute("role")).toBe("alertdialog");
      const listed = [...document.querySelectorAll("[data-rex-confirm-field]")].map((row) => [
        row.getAttribute("data-rex-confirm-field"),
        row.querySelector("dd")?.textContent,
      ]);
      expect(listed).toEqual([
        ["amount", "12.50"],
        ["to", "bob"],
      ]);
      const form = document.querySelector('form[data-rex-form="send"]');
      expect(form?.getAttribute("method")).toBe("post");
      expect(form?.getAttribute("action")).toBe("/rex/form/send");
      expect(document.querySelector('[data-rex-confirm-cancel="send"]')?.getAttribute("href")).toBe(
        "/send",
      );
      expect(document.querySelector('[data-rex-confirm-accept="send"]')?.textContent).toBe(
        "Confirm Send",
      );
      const submitted = new URLSearchParams();
      for (const input of form?.querySelectorAll("input") ?? []) {
        submitted.append(input.getAttribute("name") ?? "", input.getAttribute("value") ?? "");
      }
      expect(submitted.get(CSRF_FIELD)).toBe(csrf);
      expect(submitted.get(ACTION_FIELD)).toBe("send");
      expect(submitted.get(CONFIRM_FIELD)).toMatch(/^[0-9a-f]{64}$/);

      const confirmed = await post(app, "send", submitted, {
        cookie,
        as: "alice",
        referer: `${ORIGIN}${FORM_PREFIX}/send`,
      });
      expect(confirmed.status).toBe(303);
      expect(outcomeOf(confirmed)).toMatchObject({
        actionId: "send",
        ok: true,
        message: "Send succeeded",
      });
      expect(sent).toEqual([{ to: "bob", amount: "12.50" }]);
      const records = await ledger.list();
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        actor: "alice",
        actionId: "send",
        outcome: "ok",
        effect: "irreversible",
      });

      const replay = await post(app, "send", submitted, {
        cookie,
        as: "alice",
      });
      expect(outcomeOf(replay)).toMatchObject({
        ok: false,
        code: "PRECONDITION_REQUIRED",
      });
      expect(sent).toHaveLength(1);
    } finally {
      await window.happyDOM.close();
    }
  });

  it("refuses a confirmation token reused with different input", async () => {
    const page = await post(app, "send", fields({ to: "bob", amount: "1" }, csrf), {
      cookie,
      as: "alice",
    });
    const token = /name="_confirm" value="([0-9a-f]{64})"/.exec(await page.text())?.[1];
    expect(token).toBeDefined();
    const tampered = fields({ to: "mallory", amount: "1000" }, csrf);
    tampered.append(CONFIRM_FIELD, token as string);
    const response = await post(app, "send", tampered, { cookie, as: "alice" });
    expect(outcomeOf(response)).toMatchObject({
      ok: false,
      code: "PRECONDITION_REQUIRED",
    });
    expect(sent).toEqual([]);
    expect((await ledger.list()).map((record) => record.outcome)).toEqual([
      "PRECONDITION_REQUIRED",
    ]);
  });

  it("does not render a confirmation page for invalid or forbidden irreversible input", async () => {
    const invalid = await post(app, "send", fields({ to: "", amount: "lots" }, csrf), {
      cookie,
      as: "alice",
      referer: `${ORIGIN}/send`,
    });
    expect(invalid.status).toBe(303);
    expect(Object.keys(outcomeOf(invalid).fields).sort()).toEqual(["amount", "to"]);
    const forbidden = await post(app, "send", fields({ to: "bob", amount: "1" }, csrf), {
      cookie,
    });
    expect(forbidden.status).toBe(303);
    expect(outcomeOf(forbidden).code).toBe("FORBIDDEN");
  });

  it("escapes input on the confirmation page", async () => {
    const page = await post(
      app,
      "send",
      fields({ to: '<script>alert("x")</script>', amount: "1" }, csrf),
      { cookie, as: "alice" },
    );
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });
});

afterEach(() => {
  deposits.length = 0;
  sent.length = 0;
});

describe("an ActionForm on an ssr page without JavaScript", () => {
  const sendPage = declarePage("send", {
    route: "/send",
    actions: [send],
    chrome: { title: "Send" },
    regions: ["form"],
  });
  const SendForm = region("form", () => <ActionForm action={send} />);
  const registry = createRegistry().register(send, sendPage).freeze();
  const states = {
    Loading: () => <p>Loading</p>,
    Empty: () => <p>Empty</p>,
    Stale: () => <p>Stale</p>,
    Partial: () => <p>Partial</p>,
    Offline: () => <p>Offline</p>,
    PermissionDenied: () => <p>Denied</p>,
    RecoverableError: () => <p>Failed</p>,
    TerminalError: () => <p>Unavailable</p>,
  };
  registerPageRenderer(
    registry,
    createRexRenderer({
      bundle: {
        registry,
        manifest: buildManifest(registry, { app: "forms-ssr" }),
        pages: [
          {
            page: sendPage,
            view: view(() => <SendForm />),
            states,
            regions: { form: SendForm },
            overlays: {},
          },
        ],
      },
    }),
  );

  function submittedFields(
    inputs: Iterable<{ getAttribute(name: string): string | null }>,
    values: Readonly<Record<string, string>>,
  ): URLSearchParams {
    const submitted = new URLSearchParams();
    for (const input of inputs) {
      const name = input.getAttribute("name") ?? "";
      submitted.append(name, values[name] ?? input.getAttribute("value") ?? "");
    }
    return submitted;
  }

  it("renders the rex-csrf cookie's token into the form so the send flow posts, confirms and runs", async () => {
    const ledger = memoryLedger();
    const app = createRexServer({
      registry,
      ledger,
      actor: resolveActor,
      app: "forms-ssr",
    });
    const rendered = await app.request(`${ORIGIN}/send`, {
      headers: { accept: "text/html", authorization: "Bearer alice" },
    });
    expect(rendered.status).toBe(200);
    const token = setCookies(rendered).get(CSRF_COOKIE);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const cookie = `${CSRF_COOKIE}=${token as string}`;

    const window = new Window({ url: ORIGIN });
    try {
      const parsed = new window.DOMParser().parseFromString(await rendered.text(), "text/html");
      const form = parsed.querySelector(`form[action="${formPath("send")}"]`);
      expect(form?.getAttribute("method")).toBe("post");
      expect(form?.querySelector(`input[name="${CSRF_FIELD}"]`)?.getAttribute("value")).toBe(token);
      const submitted = submittedFields(form?.querySelectorAll("input") ?? [], {
        to: "bob",
        amount: "7.25",
      });
      expect(submitted.get(CSRF_FIELD)).toBe(token);
      expect(submitted.get(ACTION_FIELD)).toBe("send");

      const confirmation = await post(app, "send", submitted, {
        cookie,
        as: "alice",
        referer: `${ORIGIN}/send`,
      });
      expect(confirmation.status).toBe(200);
      expect(sent).toEqual([]);
      const confirmPage = new window.DOMParser().parseFromString(
        await confirmation.text(),
        "text/html",
      );
      const confirmForm = confirmPage.querySelector('form[data-rex-form="send"]');
      const confirmed = await post(
        app,
        "send",
        submittedFields(confirmForm?.querySelectorAll("input") ?? [], {}),
        { cookie, as: "alice", referer: `${ORIGIN}${FORM_PREFIX}/send` },
      );
      expect(confirmed.status).toBe(303);
      expect(outcomeOf(confirmed)).toMatchObject({
        actionId: "send",
        ok: true,
      });
      expect(sent).toEqual([{ to: "bob", amount: "7.25" }]);
      expect(
        (await ledger.list()).map((record) => [record.actor, record.actionId, record.outcome]),
      ).toEqual([["alice", "send", "ok"]]);
    } finally {
      await window.happyDOM.close();
    }
  });

  it("renders the posted outcome into the page the confirmed send redirects to and consumes the cookie", async () => {
    const app = createRexServer({
      registry,
      ledger: memoryLedger(),
      actor: resolveActor,
      app: "forms-ssr",
    });
    const rendered = await app.request(`${ORIGIN}/send`, {
      headers: { accept: "text/html", authorization: "Bearer alice" },
    });
    const csrfCookie = cookiePair(rendered, CSRF_COOKIE);
    const window = new Window({ url: ORIGIN });
    try {
      const parsed = new window.DOMParser().parseFromString(await rendered.text(), "text/html");
      expect(parsed.querySelector('[data-rex-outcome="none"]')).not.toBeNull();
      const form = parsed.querySelector(`form[action="${formPath("send")}"]`);
      const confirmation = await post(
        app,
        "send",
        submittedFields(form?.querySelectorAll("input") ?? [], { to: "bob", amount: "7.25" }),
        { cookie: csrfCookie, as: "alice", referer: `${ORIGIN}/send` },
      );
      expect(confirmation.status).toBe(200);
      const confirmForm = new window.DOMParser()
        .parseFromString(await confirmation.text(), "text/html")
        .querySelector('form[data-rex-form="send"]');
      const confirmed = await post(
        app,
        "send",
        submittedFields(confirmForm?.querySelectorAll("input") ?? [], {}),
        { cookie: csrfCookie, as: "alice", referer: `${ORIGIN}/send` },
      );
      expect(confirmed.status).toBe(303);
      const location = confirmed.headers.get("location");
      expect(location).toBe("/send");

      const landed = await app.request(new URL(location as string, ORIGIN).toString(), {
        headers: {
          accept: "text/html",
          authorization: "Bearer alice",
          cookie: `${csrfCookie}; ${cookiePair(confirmed, OUTCOME_COOKIE)}`,
        },
      });
      expect(landed.status).toBe(200);
      expect(setCookies(landed).get(OUTCOME_COOKIE)).toBe("");
      const page = new window.DOMParser().parseFromString(await landed.text(), "text/html");
      const outcome = page.querySelector('[data-rex-outcome="send"]');
      expect(outcome).not.toBeNull();
      expect(outcome?.getAttribute("data-rex-outcome-ok")).toBe("true");
      expect(outcome?.getAttribute("data-rex-outcome-at")).toBe(outcomeOf(confirmed).at);
      expect(outcome?.textContent).toContain("Send succeeded");
      expect(page.querySelector('[data-rex-outcome="none"]')).toBeNull();

      const later = await app.request(`${ORIGIN}/send`, {
        headers: { accept: "text/html", authorization: "Bearer alice", cookie: csrfCookie },
      });
      expect(setCookies(later).has(OUTCOME_COOKIE)).toBe(false);
      const again = new window.DOMParser().parseFromString(await later.text(), "text/html");
      expect(again.querySelector('[data-rex-outcome="send"]')).toBeNull();
      expect(again.querySelector('[data-rex-outcome="none"]')).not.toBeNull();
    } finally {
      await window.happyDOM.close();
    }
  });

  it("refuses the same post when the form carries no rendered token", async () => {
    const app = createRexServer({
      registry,
      ledger: memoryLedger(),
      actor: resolveActor,
      app: "forms-ssr",
    });
    const rendered = await app.request(`${ORIGIN}/send`, {
      headers: { accept: "text/html", authorization: "Bearer alice" },
    });
    const token = setCookies(rendered).get(CSRF_COOKIE) as string;
    const refused = await post(app, "send", fields({ to: "bob", amount: "7.25" }, ""), {
      cookie: `${CSRF_COOKIE}=${token}`,
      as: "alice",
    });
    expect(refused.status).toBe(403);
    expect(sent).toEqual([]);
  });
});
