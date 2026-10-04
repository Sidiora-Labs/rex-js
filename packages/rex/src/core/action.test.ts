import { describe, expect, expectTypeOf, it } from "vitest";
import {
  action,
  parseShortcut,
  validateShortcut,
  type ActionContext,
  type ActionInput,
  type ActionOutput,
  type ActionParsedInput,
} from "./action.ts";
import { actor } from "./actor.ts";
import { RexDeclarationError } from "./entity.ts";
import { RexDeclarationOptionError, type RexErrorCode } from "./errors.ts";
import { always, policy } from "./policy.ts";
import { boolean, money, ref, text, z } from "./schema.ts";

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

const ctx: ActionContext = { actor: actor({ id: "u-1" }) };

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

  it("emits JSON schemas for input and output", () => {
    expect(send.inputJsonSchema.type).toBe("object");
    expect(send.inputJsonSchema.required).toEqual(["to", "amount"]);
    expect(send.outputJsonSchema.required).toEqual(["txId", "status"]);
    expect(toggle.inputJsonSchema.required).toBeUndefined();
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
    expect(fieldOf(() => action("a", { ...base, input: z.object({ at: z.date() }) }))).toBe(
      "input",
    );
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
    expect(declared.inputJsonSchema).toEqual(input);
    expect(declared.outputJsonSchema.type).toBe("object");
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
