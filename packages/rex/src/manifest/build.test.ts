import { describe, expect, it } from "vitest";
import { action } from "../core/action.ts";
import { RexError } from "../core/errors.ts";
import { validateStandardSync, type StandardSchemaV1 } from "../core/standard.ts";
import { entity } from "../core/entity.ts";
import { page } from "../core/page.ts";
import { always, policy } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { boolean, enumOf, id, integer, money, ref, text, timestamp } from "../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest, stableStringify, type ManifestSource } from "./build.ts";
import {
  SIDECAR_ELEMENT_ID,
  SIDECAR_MIME_TYPE,
  sidecarJsonSchema,
  validateSidecar,
  type SidecarPayload,
} from "./sidecar.schema.ts";
import { MANIFEST_VERSION } from "./types.ts";
import { objectJsonSchema, standardJsonSchema } from "./json-schema.ts";

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
      restParam: null,
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
      pathsAction: null,
      fallback: null,
      loaders: [],
      cache: null,
      transition: "none",
      prefetch: null,
      islands: {},
      chrome: {
        header: true,
        nav: false,
        back: "portfolio",
        title: "Send",
        description: null,
        image: null,
        frame: null,
        order: null,
        icon: null,
      },
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
      schema: objectJsonSchema(token.fields),
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

  it("records render, revalidate, paths, loaders, cache, transition and chrome", () => {
    const manifest = buildManifest(source([statement, plain]));
    const described = manifest.pages.find((item) => item.id === "statement");
    expect(described).toMatchObject({
      render: "ssg",
      revalidate: 300,
      paths: true,
      loaders: [
        { name: "holdings", action: "list-holdings", input: "params", invalidatedBy: [] },
        { name: "quote", action: "quote", input: "mapped", invalidatedBy: [] },
      ],
      cache: { staleTime: 5_000 },
      transition: "view",
      chrome: {
        header: true,
        nav: true,
        back: null,
        title: "Statement",
      },
    });
    expect(described?.chrome).toEqual({
      header: true,
      nav: true,
      back: null,
      title: "Statement",
      description: null,
      image: null,
      frame: null,
      order: null,
      icon: null,
    });
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

  it("carries each loader's invalidatedBy beside its action", () => {
    const refreshed = page("refreshed", {
      route: "/refreshed",
      load: { quote: { action: quote, invalidatedBy: ["send-form", "list-holdings"] } },
      actions: [sendForm],
    });
    const manifest = buildManifest({
      entities: [],
      actions: [listHoldings, quote, sendForm],
      pages: [refreshed],
      policies: [],
    });
    expect(manifest.pages[0]?.loaders).toEqual([
      {
        name: "quote",
        action: "quote",
        input: "params",
        invalidatedBy: ["list-holdings", "send-form"],
      },
    ]);
    let failure: unknown;
    try {
      buildManifest({ entities: [], actions: [quote, sendForm], pages: [refreshed], policies: [] });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(RexError);
    expect((failure as RexError).code).toBe("REX209");
    expect((failure as RexError).message).toContain('loader "quote" names action "list-holdings"');
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

describe("0.3 manifest fields", () => {
  const listDocs = action("list-docs", {
    input: z.object({}),
    output: z.object({ slugs: z.array(text()) }),
    policy: always(),
    effect: "read",
    http: { method: "GET", path: "/docs.json" },
    cache: { maxAge: 60, scope: "shared" },
    handler: () => ({ slugs: [] }),
  });
  const loadWallet = action("load-wallet", {
    input: z.object({}),
    output: z.object({ hide: boolean() }),
    policy: always(),
    effect: "read",
    handler: () => ({ hide: false }),
  });
  const hide = action("hide-dust", {
    input: z.object({ hide: boolean() }),
    output: z.object({ hide: boolean() }),
    policy: always(),
    effect: "reversible",
    invalidates: ["wallet", "list-docs", "doc"],
    optimistic: { wallet: (current, input) => ({ ...(current as object), hide: input.hide }) },
    handler: (input) => input,
  });
  const doc = page("doc", {
    route: "/docs/:slug",
    params: z.object({ slug: text() }),
    render: "static",
    paths: { action: listDocs, map: (output) => output.slugs.map((slug) => ({ slug })) },
    fallback: "render",
    prefetch: "viewport",
    regions: ["article", "toc"],
    islands: { toc: "idle", article: "never" },
    chrome: {
      title: "Doc {slug}",
      description: "The {slug} page",
      image: "/social/doc.png",
      frame: "docs",
      order: 2,
      icon: "book-open",
      back: "home",
    },
  });
  const reference = page("reference", {
    route: "/reference/:path*",
    params: z.object({ path: z.array(text()) }),
    chrome: { frame: "docs", back: "doc" },
  });
  const files = page("files", {
    route: "/files/:path*?",
    params: z.object({ path: z.optional(z.array(text())) }),
  });
  const home = page("home", {
    route: "/",
    load: { wallet: loadWallet },
    actions: [hide],
    chrome: { order: 1, icon: "house" },
  });
  const pages = [doc, reference, files, home];
  const actions = [listDocs, loadWallet, hide];
  const site = {
    origin: "https://rex.sidioralabs.com",
    name: "Rex",
    description: null,
    image: null,
    titleTemplate: "{title} | Rex",
  };
  const manifest = buildManifest(
    { entities: [], actions, pages, policies: [] },
    {
      app: "docs",
      site,
      redirects: [{ source: "/guide/:path*", destination: "/reference/:path*", status: 301 }],
      deploy: { host: "github-pages", target: "static", runtime: null },
      i18n: {
        locales: ["en", "pt"],
        default: "en",
        routing: "prefix",
        direction: { en: "ltr", pt: "ltr" },
      },
    },
  );
  const pageOf = (id: string) => manifest.pages.find((entry) => entry.id === id);
  const actionOf = (id: string) => manifest.actions.find((entry) => entry.id === id);

  it("writes app.site, redirects, deploy and i18n from the options and nothing when they are absent", () => {
    expect(manifest.app).toEqual({ name: "docs", site });
    expect(manifest.redirects).toEqual([
      { source: "/guide/:path*", destination: "/reference/:path*", status: 301 },
    ]);
    expect(manifest.deploy).toEqual({ host: "github-pages", target: "static" });
    expect(manifest.i18n).toEqual({
      locales: ["en", "pt"],
      default: "en",
      routing: "prefix",
      direction: { en: "ltr", pt: "ltr" },
    });
    const bare = buildManifest({ entities: [], actions: [], pages: [], policies: [] });
    expect(bare.app).toEqual({ name: "app" });
    expect([bare.redirects, bare.deploy, bare.i18n]).toEqual([[], null, null]);
    expect(Object.keys(manifest).sort()).toEqual(Object.keys(bare).sort());
  });

  it("writes the page chrome, islands, prefetch, fallback and the paths action", () => {
    expect(pageOf("doc")).toMatchObject({
      paths: true,
      pathsAction: "list-docs",
      fallback: "render",
      prefetch: "viewport",
      islands: { article: "never", toc: "idle" },
      restParam: null,
      chrome: {
        header: true,
        nav: true,
        back: "home",
        title: "Doc {slug}",
        description: "The {slug} page",
        image: "/social/doc.png",
        frame: "docs",
        order: 2,
        icon: "book-open",
      },
    });
    expect(Object.keys(pageOf("doc")?.islands ?? {})).toEqual(["article", "toc"]);
    expect(pageOf("home")).toMatchObject({
      paths: false,
      pathsAction: null,
      fallback: null,
      prefetch: null,
      islands: {},
    });
  });

  it("marks the rest param and describes it as an array of strings", () => {
    const rest = pageOf("reference");
    expect(rest?.routeParams).toEqual(["path"]);
    expect(rest?.restParam).toEqual({ name: "path", optional: false });
    const properties = rest?.params.properties as Record<string, Record<string, unknown>>;
    expect(properties.path?.type).toBe("array");
    expect((properties.path?.items as Record<string, unknown>).type).toBe("string");
    expect(rest?.params.required).toEqual(["path"]);
    expect(pageOf("files")?.restParam).toEqual({ name: "path", optional: true });
    expect(pageOf("files")?.params.required ?? []).not.toContain("path");
  });

  it("writes the action endpoint, cache and optimistic names", () => {
    expect(actionOf("list-docs")).toMatchObject({
      http: { method: "GET", path: "/docs.json", contentType: null, csrf: true },
      cache: { maxAge: 60, scope: "shared" },
      optimistic: [],
    });
    expect(actionOf("hide-dust")).toMatchObject({
      http: null,
      cache: null,
      optimistic: ["wallet"],
      invalidates: ["doc", "list-docs", "wallet"],
    });
  });

  function failure(run: () => unknown): RexError {
    try {
      run();
    } catch (error) {
      expect(error).toBeInstanceOf(RexError);
      return error as RexError;
    }
    throw new Error("expected a RexError");
  }

  it("refuses an invalidates name that names a mutating action rather than a loader, read action or page", () => {
    const mutating = action("mutating", {
      input: z.object({}),
      output: z.object({}),
      policy: always(),
      effect: "reversible",
      invalidates: ["hide-dust"],
      handler: () => ({}),
    });
    const error = failure(() =>
      buildManifest({ entities: [], actions: [...actions, mutating], pages, policies: [] }),
    );
    expect(error.code).toBe("REX212");
    expect(error.message).toContain(
      'action "mutating" invalidates "hide-dust", a reversible action',
    );
    expect(actionOf("hide-dust")?.invalidates).toEqual(["doc", "list-docs", "wallet"]);
  });

  it("refuses an optimistic update keyed by a name that is no loader or read action", () => {
    const board = action("board-move", {
      input: z.object({}),
      output: z.object({}),
      policy: always(),
      effect: "reversible",
      invalidates: ["doc"],
      optimistic: { doc: (current) => current },
      handler: () => ({}),
    });
    const error = failure(() =>
      buildManifest({ entities: [], actions: [...actions, board], pages, policies: [] }),
    );
    expect(error.code).toBe("REX229");
    expect(error.message).toContain('optimistic "doc" names no page loader or read action');
  });

  it("rejects HTTP paths shared by two actions or by a page route", () => {
    const twin = action("twin-docs", {
      input: z.object({}),
      output: z.object({}),
      policy: always(),
      effect: "read",
      http: { method: "GET", path: "/docs.json" },
      handler: () => ({}),
    });
    const collision = failure(() =>
      buildManifest({ entities: [], actions: [...actions, twin], pages, policies: [] }),
    );
    expect(collision.code).toBe("REX227");
    expect(collision.message).toContain('collides with action "list-docs"');
    const shadow = page("docs-json", { route: "/docs.json" });
    const routed = failure(() =>
      buildManifest({ entities: [], actions, pages: [...pages, shadow], policies: [] }),
    );
    expect(routed.code).toBe("REX227");
    expect(routed.message).toContain('page "docs-json"');
  });

  it("rejects a redirect whose source is a page route", () => {
    const error = failure(() =>
      buildManifest(
        { entities: [], actions, pages, policies: [] },
        { redirects: [{ source: "/docs/:id", destination: "/", status: 308 }] },
      ),
    );
    expect(error.code).toBe("REX126");
    expect(error.message).toContain('page "doc"');
  });

  it("rejects a chrome.back cycle", () => {
    const loopA = page("loop-a", { route: "/loop-a", chrome: { back: "loop-b" } });
    const loopB = page("loop-b", { route: "/loop-b", chrome: { back: "loop-c" } });
    const loopC = page("loop-c", { route: "/loop-c", chrome: { back: "loop-a" } });
    const error = failure(() =>
      buildManifest({ entities: [], actions: [], pages: [loopA, loopB, loopC], policies: [] }),
    );
    expect(error.code).toBe("REX225");
    expect(error.message).toContain("loop-a -> loop-b -> loop-c -> loop-a");
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
        input: standardJsonSchema(send.input, "input"),
        via: ["click", "key", "palette", "url"],
      },
      {
        id: "pick-token",
        label: "Pick token",
        allowed: true,
        reason: null,
        effect: "reversible",
        input: standardJsonSchema(pickToken.input, "input"),
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

  it("admits each loader with its invalidatedBy", () => {
    const withLoaders = {
      ...payload,
      loaders: [{ name: "wallet", action: "load-wallet", invalidatedBy: ["send"] }],
    };
    expect(validateSidecar(withLoaders)).toEqual({ valid: true, payload: withLoaders });
    const repeated = validateSidecar({
      ...payload,
      loaders: [
        { name: "wallet", action: "load-wallet", invalidatedBy: ["send", "send"] },
        { name: "wallet", action: "load-wallet", invalidatedBy: [] },
      ],
    });
    expect(repeated.valid).toBe(false);
    const properties = sidecarJsonSchema.properties as Record<string, Record<string, unknown>>;
    const loaderItems = (properties.loaders?.items ?? {}) as Record<string, unknown>;
    expect(Object.keys(loaderItems.properties as object)).toEqual([
      "name",
      "action",
      "invalidatedBy",
      "defer",
    ]);
  });

  it("admits the document, locale, locales, direction, frame and region island and optimistic fields", () => {
    const full = {
      ...payload,
      loaders: [{ name: "wallet", action: "load-wallet", invalidatedBy: ["send"], defer: true }],
      document: {
        title: "Send | Rex",
        description: "Send a token",
        canonical: "https://rex.sidioralabs.com/send/acc-1",
      },
      locale: "pt",
      locales: ["en", "pt"],
      direction: "ltr",
      frame: "docs",
      regions: [
        { id: "form", address: "send/form", state: "ready", island: "visible", optimistic: true },
        { id: "confirm", address: "send/confirm", state: "recoverable-error", code: "REX330" },
      ],
    };
    expect(validateSidecar(full)).toEqual({ valid: true, payload: full });
    const untitled = {
      ...payload,
      document: { title: "Send", description: null, canonical: null },
    };
    expect(validateSidecar(untitled).valid).toBe(true);
    const properties = sidecarJsonSchema.properties as Record<string, Record<string, unknown>>;
    for (const field of ["document", "locale", "locales", "direction", "frame"]) {
      expect(properties[field], field).toBeDefined();
    }
    const regionItems = (properties.regions?.items ?? {}) as Record<string, unknown>;
    expect(Object.keys(regionItems.properties as object)).toEqual([
      "id",
      "address",
      "state",
      "code",
      "island",
      "optimistic",
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
      "a document without a title",
      (p: Record<string, unknown>) => ({
        ...p,
        document: { title: "", description: null, canonical: null },
      }),
      "document.title",
    ],
    [
      "a relative canonical link",
      (p: Record<string, unknown>) => ({
        ...p,
        document: { title: "Send", description: null, canonical: "/send" },
      }),
      "document.canonical",
    ],
    [
      "locales without the active locale",
      (p: Record<string, unknown>) => ({ ...p, locales: ["en"] }),
      "locale",
    ],
    [
      "an active locale outside the locales",
      (p: Record<string, unknown>) => ({ ...p, locale: "fr", locales: ["en"] }),
      "locale",
    ],
    [
      "an unknown direction",
      (p: Record<string, unknown>) => ({ ...p, direction: "up" }),
      "direction",
    ],
    [
      "a frame that is not an export name",
      (p: Record<string, unknown>) => ({ ...p, frame: "Docs Frame" }),
      "frame",
    ],
    [
      "an unknown island mode",
      (p: Record<string, unknown>) => ({
        ...p,
        regions: [{ id: "form", address: "send/form", state: "ready", island: "eager" }],
      }),
      "regions.0.island",
    ],
    [
      "a failed region without its code",
      (p: Record<string, unknown>) => ({
        ...p,
        regions: [{ id: "form", address: "send/form", state: "recoverable-error" }],
      }),
      "regions.0.code",
    ],
    [
      "an optimistic flag set to false",
      (p: Record<string, unknown>) => ({
        ...p,
        regions: [{ id: "form", address: "send/form", state: "ready", optimistic: false }],
      }),
      "regions.0.optimistic",
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
    expect(
      manifest.entities[0]?.fields.map((field) => [field.name, field.kind, field.required]),
    ).toEqual([
      ["id", "id", true],
      ["slug", null, true],
      ["title", "text", true],
    ]);
    const params = manifest.pages[0]?.params as Record<string, unknown>;
    expect(params["x-rex-standard"]).toBe("hand");
    expect(params.required).toEqual(["slug"]);
    expect(validateStandardSync(reader.params, { slug: "intro" }).issues).toBeUndefined();
    expect(validateStandardSync(reader.params, { slug: 3 }).issues).toBeDefined();
  });
});
