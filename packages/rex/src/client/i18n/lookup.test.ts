import { describe, expect, it } from "vitest";
import { isRexError } from "../../core/errors.ts";
import { formatMessage } from "./format.ts";
import {
  MSG_PREFIX,
  isMessageKey,
  isMessageRef,
  localeChain,
  parseMessageRef,
  resolveMessage,
  resolveText,
  t,
  validateMessages,
  type MessageLookup,
} from "./lookup.ts";

const lookup: MessageLookup = {
  default: "en",
  messages: {
    en: {
      greeting: "Hello {name}",
      "cart.items": "{count, plural, one {# item} other {# items}}",
      only: "English only",
    },
    pt: { greeting: "Olá {name}" },
    "pt-BR": { "cart.items": "{count, plural, one {# item} other {# itens}}" },
  },
};

function thrownBy(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return null;
}

describe("message keys and refs", () => {
  it("accepts non-empty keys without whitespace or a question mark", () => {
    expect(MSG_PREFIX).toBe("msg:");
    expect(isMessageKey("home.title")).toBe(true);
    expect(isMessageKey("a-b_c/d")).toBe(true);
    expect(isMessageKey("")).toBe(false);
    expect(isMessageKey("has space")).toBe(false);
    expect(isMessageKey("why?")).toBe(false);
    expect(isMessageKey("tab\tkey")).toBe(false);
    expect(isMessageKey(42)).toBe(false);
    expect(isMessageRef(`${MSG_PREFIX}home.title`)).toBe(true);
    expect(isMessageRef("home.title")).toBe(false);
    expect(isMessageRef(null)).toBe(false);
  });

  it("encodes values sorted by name and rejects invalid keys with REX316", () => {
    expect(t("home.title")).toBe("msg:home.title");
    expect(t("send.done", { name: "Ana Lu", amount: 5, express: true })).toBe(
      "msg:send.done?amount=5&express=true&name=Ana+Lu",
    );
    expect(t("x", { "a&b": "c=d" })).toBe("msg:x?a%26b=c%3Dd");
    const error = thrownBy(() => t("bad key"));
    expect(isRexError(error) && error.code).toBe("REX316");
    expect(() => t("")).toThrow(/must be non-empty without spaces or "\?"/);
  });

  it("parses refs back, decoding canonical numbers only", () => {
    expect(parseMessageRef("msg:send.done?amount=5&name=Ana+Lu")).toEqual({
      key: "send.done",
      values: { amount: 5, name: "Ana Lu" },
    });
    expect(parseMessageRef("msg:n?a=-1.5&b=05&c=1.&d=007&e=0")).toEqual({
      key: "n",
      values: { a: -1.5, b: "05", c: "1.", d: "007", e: 0 },
    });
    expect(parseMessageRef("msg:plain")).toEqual({ key: "plain", values: {} });
    expect(parseMessageRef("msg:")).toBeNull();
    expect(parseMessageRef("msg:bad key?x=1")).toBeNull();
    expect(parseMessageRef("Literal text")).toBeNull();
    const ref = parseMessageRef("msg:k?x=1");
    expect(Object.isFrozen(ref)).toBe(true);
    expect(Object.isFrozen(ref?.values)).toBe(true);
    expect(parseMessageRef(t("k", { x: 1, y: "two" }))).toEqual({
      key: "k",
      values: { x: 1, y: "two" },
    });
  });
});

describe("validateMessages", () => {
  it("returns a frozen flat map of string patterns", () => {
    const messages = validateMessages("en", { "home.title": "Home", "a.b": "{n, number}" });
    expect(messages).toEqual({ "home.title": "Home", "a.b": "{n, number}" });
    expect(Object.isFrozen(messages)).toBe(true);
  });

  it("rejects non-objects, invalid keys and non-string patterns with REX316", () => {
    expect(() => validateMessages("en", ["Home"])).toThrow(
      /app\/locales\/en\.json must be a flat object of messages/,
    );
    const error = thrownBy(() => validateMessages("en", null));
    expect(isRexError(error) && error.code).toBe("REX316");
    expect(() => validateMessages("pt-BR", { "bad key": "x" })).toThrow(
      /app\/locales\/pt-BR\.json has an invalid key "bad key"/,
    );
    expect(() => validateMessages("en", { nested: { title: "x" } })).toThrow(
      /key "nested" must be a string message/,
    );
  });
});

describe("resolution", () => {
  it("walks the locale, its base language, then the default without repeats", () => {
    expect(localeChain(lookup, "pt-BR")).toEqual(["pt-BR", "pt", "en"]);
    expect(localeChain(lookup, "pt")).toEqual(["pt", "en"]);
    expect(localeChain(lookup, "en")).toEqual(["en"]);
    expect(localeChain(lookup, "en-GB")).toEqual(["en-GB", "en"]);
    expect(localeChain({ default: "pt-BR", messages: {} }, "pt-BR")).toEqual(["pt-BR", "pt"]);
  });

  it("formats the first pattern on the chain in the locale of that candidate", () => {
    expect(resolveMessage(lookup, "pt-BR", "cart.items", { count: 1200 }, formatMessage)).toBe(
      "1.200 itens",
    );
    expect(resolveMessage(lookup, "pt-BR", "greeting", { name: "Ana" }, formatMessage)).toBe(
      "Olá Ana",
    );
    expect(resolveMessage(lookup, "pt-BR", "only", {}, formatMessage)).toBe("English only");
    expect(resolveMessage(lookup, "de-CH", "cart.items", { count: 1200 }, formatMessage)).toBe(
      "1,200 items",
    );
    expect(resolveMessage(lookup, "pt-BR", "missing.key", {}, formatMessage)).toBe("missing.key");
  });

  it("returns the key when there is no lookup or no formatter yet", () => {
    expect(resolveMessage(null, "en", "greeting", { name: "Ana" }, formatMessage)).toBe("greeting");
    expect(resolveMessage(lookup, "en", "greeting", { name: "Ana" }, null)).toBe("greeting");
  });

  it("resolves msg: refs in text, merging values, and leaves other text alone", () => {
    expect(resolveText(lookup, "en", "Plain label", {}, formatMessage)).toBe("Plain label");
    expect(resolveText(lookup, "pt", t("greeting", { name: "Ana" }), {}, formatMessage)).toBe(
      "Olá Ana",
    );
    expect(
      resolveText(lookup, "en", t("greeting", { name: "Ana" }), { name: "Grace" }, formatMessage),
    ).toBe("Hello Grace");
    expect(resolveText(null, "en", "msg:greeting", {}, formatMessage)).toBe("greeting");
    expect(resolveText(lookup, "en", "msg:bad key", {}, formatMessage)).toBe("msg:bad key");
  });
});
