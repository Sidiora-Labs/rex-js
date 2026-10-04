import { describe, expect, expectTypeOf, it } from "vitest";
import {
  RexNameError,
  actionAddress,
  actionId,
  isValidName,
  overlayAddress,
  pageAddress,
  pageId,
  regionAddress,
  validateComponentName,
  validateName,
} from "./ids.ts";

describe("validateName", () => {
  it.each(["portfolio", "send", "pick-token", "toggle-hide-dust", "wallet.send", "a1", "x-2.b"])(
    "accepts %s",
    (name) => {
      expect(validateName(name)).toBe(name);
      expect(isValidName(name)).toBe(true);
    },
  );

  it.each([
    ["", "non-empty"],
    ["1send", "digit"],
    ["9", "digit"],
    ["Send", "lowercase"],
    ["pick_token", "lowercase"],
    ["pick token", "lowercase"],
    ["-send", "lowercase"],
    [".send", "lowercase"],
    ["send/now", "lowercase"],
    ["sénd", "lowercase"],
  ])("rejects %j", (name, rule) => {
    expect(() => validateName(name)).toThrow(RexNameError);
    expect(() => validateName(name)).toThrow(rule);
    expect(isValidName(name)).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(() => validateName(42 as unknown as string)).toThrow(RexNameError);
    expect(isValidName(42)).toBe(false);
    expect(isValidName(undefined)).toBe(false);
  });

  it("names the kind and value in the error", () => {
    try {
      pageId("Bad");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RexNameError);
      const nameError = error as RexNameError;
      expect(nameError.kind).toBe("page id");
      expect(nameError.value).toBe("Bad");
      expect(nameError.message).toContain('invalid page id "Bad"');
    }
    expect(() => actionId("2fa")).toThrow('invalid action id "2fa"');
  });
});

describe("validateComponentName", () => {
  it.each(["TokenSelectorSheet", "HoldingsFilterSheet", "X", "Sheet2"])("accepts %s", (name) => {
    expect(validateComponentName(name)).toBe(name);
  });

  it.each(["tokenSheet", "Token-Sheet", "Token_Sheet", "", "1Sheet"])("rejects %j", (name) => {
    expect(() => validateComponentName(name)).toThrow(RexNameError);
  });
});

describe("addresses", () => {
  it("derive from names", () => {
    expect(pageAddress("portfolio")).toBe("portfolio");
    expect(actionAddress("send", "pick-token")).toBe("send/pick-token");
    expect(regionAddress("portfolio", "holdings")).toBe("portfolio/holdings");
    expect(overlayAddress("send", "TokenSelectorSheet")).toBe("send/TokenSelectorSheet");
    expect(pageId("portfolio")).toBe("portfolio");
    expect(actionId("toggle-hide-dust")).toBe("toggle-hide-dust");
  });

  it("are stable across calls", () => {
    const first = [
      pageAddress("send"),
      actionAddress("send", "send"),
      regionAddress("send", "form"),
      overlayAddress("send", "ContactPickerSheet"),
    ];
    for (let i = 0; i < 5; i++) {
      expect([
        pageAddress("send"),
        actionAddress("send", "send"),
        regionAddress("send", "form"),
        overlayAddress("send", "ContactPickerSheet"),
      ]).toEqual(first);
    }
  });

  it("reject invalid parts", () => {
    expect(() => actionAddress("Send", "send")).toThrow('invalid page id "Send"');
    expect(() => actionAddress("send", "Send")).toThrow('invalid action id "Send"');
    expect(() => regionAddress("send", "Form")).toThrow('invalid region name "Form"');
    expect(() => overlayAddress("send", "token-sheet")).toThrow(
      'invalid overlay name "token-sheet"',
    );
    expect(() => pageAddress("")).toThrow(RexNameError);
  });

  it("carry literal types", () => {
    expectTypeOf(actionAddress("send", "pick-token")).toEqualTypeOf<"send/pick-token">();
    expectTypeOf(regionAddress("portfolio", "hero")).toEqualTypeOf<"portfolio/hero">();
    expectTypeOf(
      overlayAddress("send", "TokenSelectorSheet"),
    ).toEqualTypeOf<"send/TokenSelectorSheet">();
    expectTypeOf(pageAddress("send")).toEqualTypeOf<"send">();
  });
});
