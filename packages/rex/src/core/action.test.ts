import { describe, expect, expectTypeOf, it } from "vitest";
import {
  ACTION_CACHE_SCOPES,
  ACTION_HTTP_METHODS,
  action,
  actionContext,
  httpPathProblem,
  parseShortcut,
  validateShortcut,
  type ActionContext,
  type ActionInput,
  type ActionOutput,
  type ActionParsedInput,
} from "./action.ts";
import { actor } from "./actor.ts";
import { RexDeclarationError } from "./entity.ts";
import { RexDeclarationOptionError, RexError, type RexErrorCode } from "./errors.ts";
import { always, policy } from "./policy.ts";
import { boolean, money, ref, text } from "../schema/index.ts";
import { z } from "zod/mini";
import { validateStandardSync, type StandardSchemaV1 } from "./standard.ts";
import { buildManifest } from "../manifest/build.ts";

function manifestAction(declared: Parameters<typeof buildManifest>[0]["actions"][number]) {
  const built = buildManifest({ entities: [], actions: [declared], pages: [], policies: [] });
  return built.actions[0] as (typeof built.actions)[number];
}

function manifestError(declared: Parameters<typeof buildManifest>[0]["actions"][number]): RexError {
  try {
    manifestAction(declared);
  } catch (error) {
    expect(error).toBeInstanceOf(RexError);
    return error as RexError;
  }
  throw new Error("expected buildManifest to fail");
}

const wallet = policy("wallet", { permissions: ["send"], resolve: () => ["send"] });

const send = action("send", {
  input: z.object({ to: ref("contact"), amount: money(), memo: text().optional() }),
  output: z.object({ txId: text(), status: z.enum(["pending", "confirmed"]) }),
  policy: wallet.requires({ unlocked: true, permissions: ["send"] }),
  effect: "irreversible",
  label: "Send",
  shortcut: "mod+enter",
  invalidates: ["account", "token"],
  handler: async (input) => ({
    txId: `tx-${input.to}-${input.amount}`,
    status: "pending" as const,
  }),
});

const toggle = action("toggle-hide-dust", {
  input: z.object({ hide: boolean().default(false) }),
  output: z.object({ hide: boolean() }),
  policy: always(),
  effect: "reversible",
  handler: (input) => ({ hide: !input.hide }),
});

const ctx: ActionContext = {
  actor: actor({ id: "u-1" }),
  env: null,
  locale: null,
  density: "default",
};

function fieldOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(RexDeclarationError);
    return (error as RexDeclarationError).field;
  }
  throw new Error("expected a RexDeclarationError");
}

const base = {
  input: z.object({}),
  output: z.object({}),
  policy: always(),
  effect: "read" as const,
  handler: () => ({}),
};

describe("action", () => {
  it("returns a frozen declaration with a stable id", () => {
    expect(send.kind).toBe("action");
    expect(send.id).toBe("send");
    expect(send.name).toBe("send");
    expect(send.effect).toBe("irreversible");
    expect(send.label).toBe("Send");
    expect(send.shortcut).toBe("mod+enter");
    expect(send.invalidates).toEqual(["account", "token"]);
    expect(Object.isFrozen(send)).toBe(true);
    expect(Object.isFrozen(send.invalidates)).toBe(true);
  });

  it("defaults optional fields", () => {
    expect(toggle.label).toBeNull();
    expect(toggle.shortcut).toBeNull();
    expect(toggle.invalidates).toEqual([]);
  });

  it("runs the handler with parsed input and context", async () => {
    expect(await send.handler({ to: "c-1", amount: "2.5" }, ctx)).toEqual({
      txId: "tx-c-1-2.5",
      status: "pending",
    });
    expect(await toggle.handler(toggle.input.parse({}), ctx)).toEqual({ hide: true });
  });

  it("keeps the declared schemas and leaves JSON Schema to the manifest", () => {
    expect(Object.hasOwn(send, "inputJsonSchema")).toBe(false);
    expect(Object.hasOwn(send, "outputJsonSchema")).toBe(false);
    const sent = manifestAction(send);
    expect(sent.input.type).toBe("object");
    expect(sent.input.required).toEqual(["to", "amount"]);
    expect(sent.output.required).toEqual(["txId", "status"]);
    expect(manifestAction(toggle).input.required).toBeUndefined();
  });

  it("infers input and output types", () => {
    expectTypeOf<ActionInput<typeof send>>().toEqualTypeOf<{
      to: string;
      amount: string;
      memo?: string | undefined;
    }>();
    expectTypeOf<ActionOutput<typeof send>>().toEqualTypeOf<{
      txId: string;
      status: "pending" | "confirmed";
    }>();
    expectTypeOf<ActionInput<typeof toggle>>().toEqualTypeOf<{ hide?: boolean | undefined }>();
    expectTypeOf<ActionParsedInput<typeof toggle>>().toEqualTypeOf<{ hide: boolean }>();
    expectTypeOf(send.id).toEqualTypeOf<"send">();
  });

  it("contains no React dependency", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(new URL("./action.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from "react/);
  });
});

describe("action declaration errors name the field", () => {
  it.each(["Send", "1send", "send now", ""])("invalid id %j", (id) => {
    expect(fieldOf(() => action(id, base))).toBe("id");
  });

  it("config and unknown properties", () => {
    expect(fieldOf(() => action("a", null as never))).toBe("config");
    expect(fieldOf(() => action("a", { ...base, route: "/x" } as never))).toBe("route");
  });

  it("schemas", () => {
    expect(fieldOf(() => action("a", { ...base, input: {} } as never))).toBe("input");
    expect(fieldOf(() => action("a", { ...base, output: "x" } as never))).toBe("output");
    const dated = action("a", { ...base, input: z.object({ at: z.date() }) });
    const error = manifestError(dated);
    expect(error.code).toBe("REX210");
    expect(error.message).toContain('action "a" input');
  });

  it("policy, effect, label, handler", () => {
    expect(fieldOf(() => action("a", { ...base, policy: "wallet" } as never))).toBe("policy");
    expect(fieldOf(() => action("a", { ...base, effect: "write" } as never))).toBe("effect");
    expect(fieldOf(() => action("a", { ...base, label: "  " }))).toBe("label");
    expect(fieldOf(() => action("a", { ...base, handler: undefined } as never))).toBe("handler");
  });

  it("invalidates", () => {
    expect(fieldOf(() => action("a", { ...base, invalidates: "account" } as never))).toBe(
      "invalidates",
    );
    expect(fieldOf(() => action("a", { ...base, invalidates: ["account", "Token"] }))).toBe(
      "invalidates.1",
    );
  });

  it.each([
    "ctrl+s",
    "mod+mod+s",
    "shift+mod+s",
    "mod+",
    "mod+ab",
    "mod+S",
    "hyper+x",
    "mod+k",
    "escape",
    "",
  ])("invalid shortcut %j", (shortcut) => {
    expect(fieldOf(() => action("a", { ...base, shortcut }))).toBe("shortcut");
  });
});

describe("shortcuts", () => {
  it.each([
    ["s", { mod: false, shift: false, alt: false, key: "s" }],
    ["mod+s", { mod: true, shift: false, alt: false, key: "s" }],
    ["mod+shift+alt+enter", { mod: true, shift: true, alt: true, key: "enter" }],
    ["shift+/", { mod: false, shift: true, alt: false, key: "/" }],
    ["alt+f5", { mod: false, shift: false, alt: true, key: "f5" }],
    ["mod+escape", { mod: true, shift: false, alt: false, key: "escape" }],
  ])("parses %s", (shortcut, parsed) => {
    expect(parseShortcut(shortcut)).toEqual(parsed);
    expect(validateShortcut(shortcut)).toBe(shortcut);
  });

  it("reserves the palette and dismissal keys", () => {
    expect(() => validateShortcut("mod+k")).toThrow("reserved");
    expect(() => validateShortcut("escape")).toThrow("reserved");
  });
});

describe("0.2 action options", () => {
  it("defaults form and jsonSchema to null", () => {
    expect(toggle.form).toBeNull();
    expect(toggle.jsonSchema).toBeNull();
  });

  it("records form options", () => {
    const declared = action("send-form", {
      ...base,
      effect: "irreversible",
      form: { redirect: "/sent", confirmTitle: "Send funds?" },
    });
    expect(declared.form).toEqual({ redirect: "/sent", confirmTitle: "Send funds?" });
    expect(Object.isFrozen(declared.form)).toBe(true);
    const partial = action("partial", { ...base, form: {} });
    expect(partial.form).toEqual({ redirect: null, confirmTitle: null });
  });

  it("uses a declared JSON Schema override instead of deriving one", () => {
    const input = { type: "object", properties: { at: { type: "string", format: "date-time" } } };
    const declared = action("schedule", {
      ...base,
      input: z.object({ at: z.date() }),
      jsonSchema: { input },
    });
    expect(declared.jsonSchema).toEqual({ input, output: null });
    const listed = manifestAction(declared);
    expect(listed.input).toEqual(input);
    expect(listed.output.type).toBe("object");
  });

  function optionError(run: () => unknown): { code: RexErrorCode; field: string } {
    try {
      run();
    } catch (error) {
      expect(error).toBeInstanceOf(RexDeclarationOptionError);
      const failure = error as RexDeclarationOptionError;
      expect(failure.declaration).toBe("action");
      return { code: failure.code, field: failure.field };
    }
    throw new Error("expected a RexDeclarationOptionError");
  }

  it.each([
    [{ form: "yes" }, "REX207", "form"],
    [{ form: { redirect: "sent" } }, "REX207", "form.redirect"],
    [{ form: { redirect: "//evil.example.com" } }, "REX207", "form.redirect"],
    [{ form: { confirmTitle: " " } }, "REX207", "form.confirmTitle"],
    [{ form: { method: "get" } }, "REX207", "form.method"],
    [{ jsonSchema: [] }, "REX208", "jsonSchema"],
    [{ jsonSchema: { params: {} } }, "REX208", "jsonSchema.params"],
    [{ jsonSchema: { input: "object" } }, "REX208", "jsonSchema.input"],
    [{ jsonSchema: { output: [] } }, "REX208", "jsonSchema.output"],
  ] as const)("rejects %j with %s naming %s", (extra, code, field) => {
    expect(optionError(() => action("probe", { ...base, ...extra } as never))).toEqual({
      code,
      field,
    });
  });
});

describe("Standard Schema actions", () => {
  const amountInput: StandardSchemaV1<{ amount: string }, { amount: number }> = {
    "~standard": {
      version: 1,
      vendor: "hand",
      validate: (value) => {
        const raw = (value as { amount?: unknown } | null)?.amount;
        const amount = typeof raw === "string" ? Number(raw) : Number.NaN;
        return Number.isFinite(amount) && amount > 0
          ? { value: { amount } }
          : { issues: [{ message: "must be a positive decimal", path: ["amount"] }] };
      },
    },
  };
  const receipt: StandardSchemaV1<{ id: string }> = {
    "~standard": {
      version: 1,
      vendor: "hand",
      validate: (value) =>
        typeof (value as { id?: unknown } | null)?.id === "string"
          ? { value: value as { id: string } }
          : { issues: [{ message: "must carry an id", path: ["id"] }] },
    },
  };
  const pay = action("pay", {
    input: amountInput,
    output: receipt,
    policy: always(),
    effect: "reversible",
    handler: (input) => ({ id: `pay-${input.amount.toFixed(2)}` }),
  });

  it("accepts a hand-written Standard Schema for input and output", async () => {
    expect(pay.input).toBe(amountInput);
    expect(pay.output).toBe(receipt);
    expect(validateStandardSync(pay.input, { amount: "2.5" })).toEqual({ value: { amount: 2.5 } });
    expect(validateStandardSync(pay.input, { amount: "nope" }).issues).toBeDefined();
    expect(await pay.handler({ amount: 2.5 }, ctx)).toEqual({ id: "pay-2.50" });
  });

  it("types input, parsed input and output from the Standard Schema", () => {
    expectTypeOf<ActionInput<typeof pay>>().toEqualTypeOf<{ amount: string }>();
    expectTypeOf<ActionParsedInput<typeof pay>>().toEqualTypeOf<{ amount: number }>();
    expectTypeOf<ActionOutput<typeof pay>>().toEqualTypeOf<{ id: string }>();
  });

  it("leaves the JSON Schema to the declared override", () => {
    const error = manifestError(pay);
    expect(error.code).toBe("REX210");
    expect(error.message).toContain('action "pay" input');
    const declared = action("pay-declared", {
      input: amountInput,
      output: receipt,
      policy: always(),
      effect: "reversible",
      jsonSchema: {
        input: { type: "object", properties: { amount: { type: "string" } }, required: ["amount"] },
        output: { type: "object", properties: { id: { type: "string" } } },
      },
      handler: () => ({ id: "x" }),
    });
    const listed = manifestAction(declared);
    expect(listed.input.required).toEqual(["amount"]);
    expect(listed.output.properties).toEqual({ id: { type: "string" } });
  });

  it("refuses an input that is not a Standard Schema", () => {
    expect(fieldOf(() => action("a", { ...base, input: { parse: () => ({}) } } as never))).toBe(
      "input",
    );
  });
});

describe("0.3 action options", () => {
  function optionError(run: () => unknown): { code: RexErrorCode; field: string } {
    try {
      run();
    } catch (error) {
      expect(error).toBeInstanceOf(RexDeclarationOptionError);
      const failure = error as RexDeclarationOptionError;
      expect(failure.declaration).toBe("action");
      expect(failure.message).toContain(`field "${failure.field}"`);
      return { code: failure.code, field: failure.field };
    }
    throw new Error("expected a RexDeclarationOptionError");
  }

  it("defaults http, cache and optimistic to null", () => {
    expect(toggle.http).toBeNull();
    expect(toggle.cache).toBeNull();
    expect(toggle.optimistic).toBeNull();
  });

  it("records an HTTP endpoint with its defaults", () => {
    expect(ACTION_HTTP_METHODS).toEqual(["GET", "POST"]);
    const feed = action("list-feed", {
      ...base,
      http: { method: "GET", path: "/feed.xml", contentType: "application/rss+xml" },
    });
    expect(feed.http).toEqual({
      method: "GET",
      path: "/feed.xml",
      contentType: "application/rss+xml",
      csrf: true,
    });
    const hook = action("receive-hook", {
      ...base,
      effect: "reversible",
      http: { method: "POST", path: "/hooks/payments", csrf: false },
    });
    expect(hook.http).toEqual({
      method: "POST",
      path: "/hooks/payments",
      contentType: null,
      csrf: false,
    });
    expect(manifestAction(feed).http).toEqual(feed.http);
    expect(httpPathProblem("/tokens.json")).toBeNull();
    expect(httpPathProblem("/rex/tokens")).toContain("/rex");
    expect(httpPathProblem("/rex")).toContain("/rex");
    expect(httpPathProblem("/")).not.toBeNull();
    expect(httpPathProblem("/a/../b")).not.toBeNull();
  });

  it("records a server cache on a read action with the actor scope by default", () => {
    expect(ACTION_CACHE_SCOPES).toEqual(["shared", "actor", "locale"]);
    const cached = action("load-quote", { ...base, cache: { maxAge: 30 } });
    expect(cached.cache).toEqual({ maxAge: 30, scope: "actor" });
    const shared = action("load-prices", { ...base, cache: { maxAge: 60, scope: "shared" } });
    expect(shared.cache).toEqual({ maxAge: 60, scope: "shared" });
    expect(manifestAction(shared).cache).toEqual({ maxAge: 60, scope: "shared" });
  });

  it("records optimistic updates keyed by invalidated names", () => {
    const hide = action("hide-dust", {
      ...base,
      input: z.object({ hide: boolean() }),
      effect: "reversible",
      invalidates: ["wallet", "token"],
      optimistic: { wallet: (current, input) => ({ ...(current as object), hide: input.hide }) },
    });
    expect(Object.keys(hide.optimistic ?? {})).toEqual(["wallet"]);
    expect(hide.optimistic?.wallet?.({ total: 1 }, { hide: true })).toEqual({
      total: 1,
      hide: true,
    });
    expect(Object.isFrozen(hide.optimistic)).toBe(true);
  });

  it.each([
    [{ http: "GET /x" }, "REX227", "http"],
    [{ http: { method: "PUT", path: "/x" } }, "REX227", "http.method"],
    [{ http: { method: "GET", path: "x" } }, "REX227", "http.path"],
    [{ http: { method: "GET", path: "/rex/x" } }, "REX227", "http.path"],
    [{ http: { method: "GET", path: "/a b" } }, "REX227", "http.path"],
    [{ http: { method: "GET", path: "/x", contentType: "xml" } }, "REX227", "http.contentType"],
    [{ http: { method: "GET", path: "/x", csrf: false } }, "REX227", "http.csrf"],
    [{ http: { method: "GET", path: "/x", cors: true } }, "REX227", "http.cors"],
    [{ effect: "reversible", http: { method: "GET", path: "/x" } }, "REX227", "http.method"],
    [
      { effect: "reversible", http: { method: "POST", path: "/x", csrf: "no" } },
      "REX227",
      "http.csrf",
    ],
    [{ effect: "reversible", cache: { maxAge: 10 } }, "REX228", "cache"],
    [{ cache: 10 }, "REX228", "cache"],
    [{ cache: { maxAge: 0 } }, "REX228", "cache.maxAge"],
    [{ cache: { maxAge: 1.5 } }, "REX228", "cache.maxAge"],
    [{ cache: { maxAge: 10, scope: "global" } }, "REX228", "cache.scope"],
    [{ cache: { maxAge: 10, tags: [] } }, "REX228", "cache.tags"],
    [{ optimistic: { wallet: () => null }, invalidates: ["wallet"] }, "REX229", "optimistic"],
    [
      { effect: "reversible", invalidates: ["wallet"], optimistic: { token: () => null } },
      "REX229",
      "optimistic.token",
    ],
    [
      { effect: "reversible", invalidates: ["wallet"], optimistic: { wallet: 1 } },
      "REX229",
      "optimistic.wallet",
    ],
    [{ effect: "reversible", optimistic: [] }, "REX229", "optimistic"],
  ] as const)("rejects %j with %s naming %s", (extra, code, field) => {
    expect(optionError(() => action("probe", { ...base, ...extra } as never))).toEqual({
      code,
      field,
    });
  });

  it("hands the handler the actor, env, locale and density with the defaults filled", async () => {
    const seen: ActionContext[] = [];
    const probe = action("probe-context", {
      ...base,
      handler: (_input, context) => {
        seen.push(context);
        return {};
      },
    });
    const owner = actor({ id: "owner" });
    await probe.handler({}, { actor: owner });
    await probe.handler(
      {},
      { actor: owner, env: { API_KEY: "k" }, locale: "pt", density: "agent" },
    );
    expect(seen).toEqual([
      { actor: owner, env: null, locale: null, density: "default" },
      { actor: owner, env: { API_KEY: "k" }, locale: "pt", density: "agent" },
    ]);
    expect(actionContext({ actor: owner })).toEqual(seen[0]);
    let failure: unknown;
    try {
      actionContext({ actor: owner, density: "dense" as never });
    } catch (error) {
      failure = error;
    }
    expect((failure as RexError).code).toBe("REX321");
  });
});
