import { describe, expect, it } from "vitest";
import { action } from "../core/action.ts";
import { RexError } from "../core/errors.ts";
import type { StandardSchemaV1 } from "../core/standard.ts";
import { entity } from "../core/entity.ts";
import { page } from "../core/page.ts";
import { always, policy } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { boolean, enumOf, id, integer, money, ref, text, timestamp, z } from "../core/schema.ts";
import { buildManifest, stableStringify, type ManifestSource } from "./build.ts";
import {
  SIDECAR_ELEMENT_ID,
  SIDECAR_MIME_TYPE,
  sidecarJsonSchema,
  validateSidecar,
  type SidecarPayload,
} from "./sidecar.schema.ts";
import { MANIFEST_VERSION } from "./types.ts";

const DRAFT = "https://json-schema.org/draft/2020-12/schema";

const wallet = policy("wallet", {
  permissions: ["view", "send"],
  resolve: (actor) => (actor.roles.includes("owner") ? ["view", "send"] : ["view"]),
});
const viewer = policy("viewer", { permissions: ["view"], resolve: () => ["view"] });

const account = entity("account", {
  fields: { id: id(), name: text({ min: 1 }), balance: money(), openedAt: timestamp() },
  label: (record) => record.name,
});
const token = entity("token", {
  fields: {
    symbol: text({ min: 1 }),
    decimals: integer({ min: 0 }),
    account: ref(account),
    network: enumOf(["paxeer", "ethereum"]),
    dust: boolean().optional(),
  },
  key: "symbol",
  label: (record) => record.symbol,
});

const send = action("send", {
  input: z.object({ to: ref("contact"), amount: money(), memo: text().optional() }),
  output: z.object({ txId: text() }),
  policy: wallet.requires({ unlocked: true, permissions: ["send"] }),
  effect: "irreversible",
  label: "Send",
  shortcut: "mod+enter",
  invalidates: ["token", "account"],
  handler: () => ({ txId: "tx-1" }),
});
const pickToken = action("pick-token", {
  input: z.object({ symbol: text({ min: 1 }) }),
  output: z.object({ symbol: text() }),
  policy: always(),
  effect: "reversible",
  label: "Pick token",
  handler: (input) => input,
});
const toggleHideDust = action("toggle-hide-dust", {
  input: z.object({ hide: boolean().default(false) }),
  output: z.object({ hide: boolean() }),
  policy: viewer.can("view"),
  effect: "reversible",
  label: "Hide dust",
  shortcut: "shift+d",
  handler: (input) => input,
});

const portfolio = page("portfolio", {
  route: "/",
  params: z.object({ hideDust: boolean().optional() }),
  actions: [toggleHideDust],
  regions: ["hero", "actions", "holdings"],
  overlays: [{ id: "HoldingsFilterSheet", dismiss: "both", binding: "url" }],
});
const sendPage = page("send", {
  route: "/send/:account",
  params: z.object({ account: text({ min: 1 }), token: text().optional() }),
  policy: wallet.can("send"),
  recovery: "portfolio",
  draft: "route",
  actions: [send, pickToken],
  chrome: { back: "portfolio", nav: false },
  regions: ["form", "confirm", "success"],
  overlays: [
    { id: "TokenSelectorSheet", dismiss: "both", binding: "url" },
    { id: "ContactPickerSheet", dismiss: "escape", binding: "region" },
  ],
  states: ["ready", "loading", "empty", "permission-denied", "terminal-error"],
});

const declarations = [
  wallet,
  viewer,
  account,
  token,
  send,
  pickToken,
  toggleHideDust,
  portfolio,
  sendPage,
] as const;

function snapshotOf(order: readonly (typeof declarations)[number][]) {
  const registry = createRegistry();
  for (const declared of order) registry.register(declared);
  return registry.freeze();
}

describe("buildManifest", () => {
  const manifest = buildManifest(snapshotOf(declarations), { app: "demo" });

  it("describes every declaration kind sorted by id", () => {
    expect(manifest.version).toBe(MANIFEST_VERSION);
    expect(manifest.app).toEqual({ name: "demo" });
    expect(manifest.entities.map((item) => item.id)).toEqual(["account", "token"]);
    expect(manifest.actions.map((item) => item.id)).toEqual([
      "pick-token",
      "send",
      "toggle-hide-dust",
    ]);
    expect(manifest.pages.map((item) => item.id)).toEqual(["portfolio", "send"]);
    expect(manifest.policies).toEqual([
      { id: "viewer", permissions: ["view"] },
      { id: "wallet", permissions: ["view", "send"] },
    ]);
    expect(manifest.flows).toEqual([]);
  });

  it("is byte-identical regardless of registration order", () => {
    const reversed = buildManifest(snapshotOf([...declarations].reverse()), { app: "demo" });
    const shuffled = buildManifest(
      snapshotOf([
        sendPage,
        token,
        viewer,
        send,
        portfolio,
        account,
        toggleHideDust,
        wallet,
        pickToken,
      ]),
      { app: "demo" },
    );
    const text = stableStringify(manifest);
    expect(stableStringify(reversed)).toBe(text);
    expect(stableStringify(shuffled)).toBe(text);
    expect(stableStringify(buildManifest(snapshotOf(declarations), { app: "demo" }))).toBe(text);
  });

  it("describes pages with route, params schema, chrome, regions, overlays, states and actions", () => {
    const described = manifest.pages.find((item) => item.id === "send");
    expect(described).toEqual({
      id: "send",
      route: "/send/:account",
      routeParams: ["account"],
      params: {
        $schema: DRAFT,
        type: "object",
        properties: {
          account: { type: "string", minLength: 1, "x-rex-field": "text" },
          token: { type: "string", "x-rex-field": "text" },
        },
        required: ["account"],
      },
      policy: { kind: "can", permission: "send", policy: "wallet" },
      recovery: "portfolio",
      draft: "route",
      render: "ssr",
      revalidate: null,
      paths: false,
      loaders: [],
      cache: null,
      transition: "none",
      chrome: { header: true, nav: false, back: "portfolio", title: "Send", components: [] },
      regions: ["form", "confirm", "success"],
      overlays: [
        { id: "ContactPickerSheet", dismiss: "escape", binding: "region" },
        { id: "TokenSelectorSheet", dismiss: "both", binding: "url" },
      ],
      states: ["loading", "empty", "permission-denied", "terminal-error", "ready"],
      actions: ["pick-token", "send"],
    });
    expect(manifest.pages[0]?.states).toHaveLength(9);
  });

  it("emits input and output JSON schemas for actions", () => {
    const described = manifest.actions.find((item) => item.id === "send");
    expect(described?.input).toEqual({
      $schema: DRAFT,
      type: "object",
      properties: {
        to: {
          type: "string",
          minLength: 1,
          pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
          "x-rex-field": "ref",
          "x-rex-ref": "contact",
        },
        amount: {
          type: "string",
          pattern: "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$",
          format: "decimal",
          "x-rex-field": "money",
        },
        memo: { type: "string", "x-rex-field": "text" },
      },
      required: ["to", "amount"],
    });
    expect(described?.output.required).toEqual(["txId"]);
    expect(described?.effect).toBe("irreversible");
    expect(described?.label).toBe("Send");
    expect(described?.shortcut).toBe("mod+enter");
    expect(described?.invalidates).toEqual(["account", "token"]);
    expect(described?.form).toBeNull();
    expect(described?.policy).toEqual({
      kind: "requires",
      unlocked: true,
      account: false,
      custody: null,
      permissions: ["send"],
      policy: "wallet",
    });
    const toggle = manifest.actions.find((item) => item.id === "toggle-hide-dust");
    expect(toggle?.input.required).toBeUndefined();
  });

  it("describes entity fields, key and schema", () => {
    expect(manifest.entities[1]).toEqual({
      id: "token",
      key: "symbol",
      fields: [
        { name: "symbol", kind: "text", ref: null, required: true },
        { name: "decimals", kind: "integer", ref: null, required: true },
        { name: "account", kind: "ref", ref: "account", required: true },
        { name: "network", kind: "enum", ref: null, required: true },
        { name: "dust", kind: "boolean", ref: null, required: false },
      ],
      schema: token.jsonSchema,
    });
  });

  it("describes flows from a flow source", () => {
    const source: ManifestSource = {
      ...snapshotOf(declarations),
      flows: [
        {
          id: "payout",
          steps: [
            { kind: "action", action: pickToken },
            {
              kind: "approval",
              id: "review",
              label: "Review payout",
              approvers: wallet.can("send"),
            },
            { kind: "action", action: send },
          ],
        },
        { id: "audit", steps: [{ kind: "action", action: toggleHideDust }] },
      ],
    };
    expect(buildManifest(source).flows).toEqual([
      { id: "audit", steps: [{ kind: "action", action: "toggle-hide-dust" }] },
      {
        id: "payout",
        steps: [
          { kind: "action", action: "pick-token" },
          {
            kind: "approval",
            id: "review",
            label: "Review payout",
            approvers: { kind: "can", permission: "send", policy: "wallet" },
          },
          { kind: "action", action: "send" },
        ],
      },
    ]);
    expect(buildManifest(source).app).toEqual({ name: "app" });
  });

  it("rejects pages that reference unregistered actions or pages", () => {
    expect(() => buildManifest(snapshotOf([portfolio, sendPage, send]))).toThrow(
      'page "portfolio" declares action "toggle-hide-dust" that is not registered',
    );
    expect(() => buildManifest(snapshotOf([sendPage, send, pickToken]))).toThrow(
      'page "send" recovery names unknown page "portfolio"',
    );
    const orphan = page("orphan", { route: "/orphan", chrome: { back: "home" } });
    expect(() => buildManifest(snapshotOf([orphan] as never))).toThrow(
      'page "orphan" chrome.back names unknown page "home"',
    );
    expect(() => buildManifest(snapshotOf([]), { app: " " })).toThrow("app");
  });
});

describe("0.2 manifest options", () => {
  const listHoldings = action("list-holdings", {
    input: z.object({ account: text() }),
    output: z.object({ symbols: z.array(text()) }),
    policy: always(),
    effect: "read",
    handler: () => ({ symbols: [] }),
  });
  const quote = action("quote", {
    input: z.object({}),
    output: z.object({ price: money() }),
    policy: always(),
    effect: "read",
    handler: () => ({ price: "1" }),
  });
  const sendForm = action("send-form", {
    input: z.object({ amount: money() }),
    output: z.object({ txId: text() }),
    policy: always(),
    effect: "irreversible",
    form: { redirect: "/", confirmTitle: "Send funds?" },
    handler: () => ({ txId: "tx" }),
  });
  function Button() {
    return null;
  }
  const statement = page("statement", {
    route: "/statement/:account",
    params: z.object({ account: text() }),
    render: "ssg",
    revalidate: 300,
    paths: () => [{ account: "main" }],
    load: { quote: { action: quote, input: () => ({}) }, holdings: listHoldings },
    cache: { staleTime: 5_000 },
    transition: "view",
    actions: [sendForm],
    chrome: { components: { Outcome: Button, Button } },
  });
  const plain = page("plain", { route: "/" });

  function source(pages: readonly (typeof statement | typeof plain)[]): ManifestSource {
    return {
      entities: [],
      actions: [listHoldings, quote, sendForm],
      pages,
      policies: [],
    };
  }

  it("records render, revalidate, paths, loaders, cache, transition and chrome components", () => {
    const manifest = buildManifest(source([statement, plain]));
    const described = manifest.pages.find((item) => item.id === "statement");
    expect(described).toMatchObject({
      render: "ssg",
      revalidate: 300,
      paths: true,
      loaders: [
        { name: "holdings", action: "list-holdings", input: "params" },
        { name: "quote", action: "quote", input: "mapped" },
      ],
      cache: { staleTime: 5_000 },
      transition: "view",
      chrome: {
        header: true,
        nav: true,
        back: null,
        title: "Statement",
        components: ["Button", "Outcome"],
      },
    });
    expect(stableStringify(manifest)).toContain('"components"');
  });

  it("uses the configured default render mode for pages that declare none", () => {
    expect(buildManifest(source([plain])).pages[0]?.render).toBe("ssr");
    expect(buildManifest(source([plain]), { render: "csr" }).pages[0]?.render).toBe("csr");
    expect(buildManifest(source([statement]), { render: "csr" }).pages[0]?.render).toBe("ssg");
  });

  it("records the action form options", () => {
    const manifest = buildManifest(source([plain]));
    expect(manifest.actions.find((item) => item.id === "send-form")?.form).toEqual({
      redirect: "/",
      confirmTitle: "Send funds?",
    });
    expect(manifest.actions.find((item) => item.id === "quote")?.form).toBeNull();
  });

  it("rejects a loader whose action is not registered with REX209", () => {
    const unregistered: ManifestSource = {
      entities: [],
      actions: [sendForm, listHoldings],
      pages: [statement],
      policies: [],
    };
    let failure: unknown;
    try {
      buildManifest(unregistered);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(RexError);
    expect((failure as RexError).code).toBe("REX209");
    expect((failure as RexError).message).toContain('loader "quote" names action "quote"');
  });
});

describe("stableStringify", () => {
  it("sorts object keys recursively and keeps array order", () => {
    expect(stableStringify({ b: 1, a: { d: [3, 1], c: null } }, 0)).toBe(
      '{"a":{"c":null,"d":[3,1]},"b":1}',
    );
    expect(stableStringify({ z: 1, a: 2 })).toBe('{\n  "a": 2,\n  "z": 1\n}');
  });

  it("drops undefined properties and rejects unsupported values", () => {
    expect(stableStringify({ a: undefined, b: [undefined] }, 0)).toBe('{"b":[null]}');
    expect(() => stableStringify({ a: Number.NaN })).toThrow("$.a is not finite");
    expect(() => stableStringify({ f: () => 1 })).toThrow("unsupported type function");
    expect(() => stableStringify({ big: 1n })).toThrow("unsupported type bigint");
  });
});

describe("sidecar schema", () => {
  const payload: SidecarPayload = {
    version: 1,
    page: "send",
    params: { account: "acc-1" },
    state: "ready",
    actions: [
      {
        id: "send",
        label: "Send",
        allowed: false,
        reason: "locked",
        effect: "irreversible",
        input: send.inputJsonSchema,
        via: ["click", "key", "palette", "url"],
      },
      {
        id: "pick-token",
        label: "Pick token",
        allowed: true,
        reason: null,
        effect: "reversible",
        input: pickToken.inputJsonSchema,
        via: ["click", "palette", "url"],
      },
    ],
    overlays: [{ id: "TokenSelectorSheet", open: true, dismiss: "both" }],
    outcome: { action: "pick-token", ok: true, message: "Picked PAX", at: "2026-10-04T12:00:00Z" },
  };

  it("publishes the element contract and a draft 2020-12 JSON schema", () => {
    expect(SIDECAR_MIME_TYPE).toBe("application/rex+json");
    expect(SIDECAR_ELEMENT_ID).toBe("rex-page");
    expect(sidecarJsonSchema.$schema).toBe(DRAFT);
    expect(sidecarJsonSchema.type).toBe("object");
    expect(sidecarJsonSchema.required).toEqual([
      "version",
      "page",
      "params",
      "state",
      "actions",
      "overlays",
      "outcome",
    ]);
    const properties = sidecarJsonSchema.properties as Record<string, Record<string, unknown>>;
    expect(properties.state?.enum).toEqual([
      "loading",
      "empty",
      "stale",
      "partial",
      "offline",
      "permission-denied",
      "recoverable-error",
      "terminal-error",
      "ready",
    ]);
    const actionItems = (properties.actions?.items ?? {}) as Record<string, unknown>;
    const via = (actionItems.properties as Record<string, Record<string, unknown>>).via;
    expect(via?.uniqueItems).toBe(true);
    expect((via?.items as Record<string, unknown>).enum).toEqual([
      "click",
      "key",
      "palette",
      "url",
    ]);
  });

  it("accepts a valid payload", () => {
    expect(validateSidecar(payload)).toEqual({ valid: true, payload });
    expect(validateSidecar({ ...payload, outcome: null, actions: [], overlays: [] }).valid).toBe(
      true,
    );
  });

  it.each([
    ["a missing field", (p: Record<string, unknown>) => ({ ...p, state: undefined }), "state"],
    ["an unknown state", (p: Record<string, unknown>) => ({ ...p, state: "error" }), "state"],
    ["an extra field", (p: Record<string, unknown>) => ({ ...p, extra: 1 }), ""],
    ["a wrong version", (p: Record<string, unknown>) => ({ ...p, version: 2 }), "version"],
    [
      "an unknown route",
      (p: Record<string, unknown>) => ({
        ...p,
        actions: [{ ...payload.actions[1], via: ["hover"] }],
      }),
      "actions.0.via.0",
    ],
    [
      "repeated routes",
      (p: Record<string, unknown>) => ({
        ...p,
        actions: [{ ...payload.actions[1], via: ["click", "click"] }],
      }),
      "actions.0.via",
    ],
    [
      "a disallowed action without a reason",
      (p: Record<string, unknown>) => ({
        ...p,
        actions: [{ ...payload.actions[0], reason: null }],
      }),
      "actions.0.reason",
    ],
    [
      "an allowed action with a reason",
      (p: Record<string, unknown>) => ({
        ...p,
        actions: [{ ...payload.actions[1], reason: "locked" }],
      }),
      "actions.0.reason",
    ],
    [
      "duplicate actions",
      (p: Record<string, unknown>) => ({
        ...p,
        actions: [payload.actions[1], payload.actions[1]],
      }),
      "actions.1.id",
    ],
    [
      "an overlay without dismissal",
      (p: Record<string, unknown>) => ({ ...p, overlays: [{ id: "Sheet", open: false }] }),
      "overlays.0.dismiss",
    ],
    [
      "an outcome without a timestamp",
      (p: Record<string, unknown>) => ({
        ...p,
        outcome: { action: "send", ok: false, message: "Locked", at: "now" },
      }),
      "outcome.at",
    ],
  ])("rejects %s", (_name, mutate, path) => {
    const result = validateSidecar(mutate(payload as unknown as Record<string, unknown>));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.map((issue) => issue.path)).toContain(path);
  });

  it("rejects non-objects", () => {
    expect(validateSidecar(null).valid).toBe(false);
    expect(validateSidecar("{}").valid).toBe(false);
  });
});

describe("Standard Schema declarations in the manifest", () => {
  const code: StandardSchemaV1<{ code: string }> = {
    "~standard": {
      version: 1,
      vendor: "hand",
      validate: (value) =>
        typeof (value as { code?: unknown } | null)?.code === "string"
          ? { value: value as { code: string } }
          : { issues: [{ message: "must carry a code", path: ["code"] }] },
    },
  };
  const slug: StandardSchemaV1<string> = {
    "~standard": {
      version: 1,
      vendor: "hand",
      validate: (value) =>
        typeof value === "string" && /^[a-z-]+$/.test(value)
          ? { value }
          : { issues: [{ message: "must be a slug" }] },
    },
  };
  const redeem = action("redeem", {
    input: code,
    output: z.object({ ok: boolean() }),
    policy: always(),
    effect: "reversible",
    handler: () => ({ ok: true }),
  });
  const redeemDeclared = action("redeem-declared", {
    input: code,
    output: code,
    policy: always(),
    effect: "reversible",
    jsonSchema: {
      input: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
      output: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
    },
    handler: (input) => input,
  });
  const article = entity("article", {
    fields: { id: id(), slug, title: text({ min: 1 }) },
    label: (record) => record.title,
  });
  const routeParams: StandardSchemaV1<{ slug: string }> = {
    "~standard": {
      version: 1,
      vendor: "hand",
      validate: (value) =>
        typeof (value as { slug?: unknown } | null)?.slug === "string"
          ? { value: value as { slug: string } }
          : { issues: [{ message: "must name a slug", path: ["slug"] }] },
    },
  };
  const reader = page("reader", { route: "/articles/:slug", params: routeParams });

  function source(actions: ManifestSource["actions"]): ManifestSource {
    return { entities: [article], actions, pages: [reader], policies: [] };
  }

  it("throws REX210 naming the declaration when a Standard Schema has no JSON Schema", () => {
    let failure: unknown;
    try {
      buildManifest(source([redeem]));
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(RexError);
    expect((failure as RexError).code).toBe("REX210");
    expect((failure as RexError).message).toContain('action "redeem" input');
    expect((failure as RexError).message).toContain("jsonSchema.input");
  });

  it("uses the declared JSON Schema for Standard Schema actions", () => {
    const manifest = buildManifest(source([redeemDeclared]));
    const described = manifest.actions.find((item) => item.id === "redeem-declared");
    expect(described?.input).toEqual({
      type: "object",
      properties: { code: { type: "string" } },
      required: ["code"],
    });
  });

  it("marks Standard Schema entity fields and page params with their vendor", () => {
    const manifest = buildManifest(source([redeemDeclared]));
    const properties = manifest.entities[0]?.schema.properties as Record<string, unknown>;
    expect(properties.slug).toEqual({ "x-rex-standard": "hand" });
    expect(manifest.entities[0]?.fields.map((field) => [field.name, field.kind, field.required])).toEqual([
      ["id", "id", true],
      ["slug", null, true],
      ["title", "text", true],
    ]);
    const params = manifest.pages[0]?.params as Record<string, unknown>;
    expect(params["x-rex-standard"]).toBe("hand");
    expect(params.required).toEqual(["slug"]);
    expect(reader.params.safeParse({ slug: "intro" }).success).toBe(true);
    expect(reader.params.safeParse({ slug: 3 }).success).toBe(false);
  });
});
