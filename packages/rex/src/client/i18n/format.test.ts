import { describe, expect, it } from "vitest";
import { isRexError } from "../../core/errors.ts";
import { MessageFormatError, formatMessage, parseMessage } from "./format.ts";

function failure(pattern: string): unknown {
  try {
    parseMessage(pattern);
  } catch (error) {
    return error;
  }
  return null;
}

describe("parseMessage", () => {
  it("parses text, arguments, number, plural and select nodes", () => {
    expect(parseMessage("Hi {name}, you have {n, number} in {cart}")).toEqual([
      { kind: "text", value: "Hi " },
      { kind: "arg", name: "name" },
      { kind: "text", value: ", you have " },
      { kind: "number", name: "n" },
      { kind: "text", value: " in " },
      { kind: "arg", name: "cart" },
    ]);
    expect(parseMessage("{n, plural, offset:1 =0 {none} one {# other} other {# others}}")).toEqual(
      [
        {
          kind: "plural",
          name: "n",
          ordinal: false,
          offset: 1,
          options: {
            "=0": [{ kind: "text", value: "none" }],
            one: [{ kind: "pound" }, { kind: "text", value: " other" }],
            other: [{ kind: "pound" }, { kind: "text", value: " others" }],
          },
        },
      ],
    );
    expect(parseMessage("{p, selectordinal, one {#st} other {#th}}")).toEqual([
      {
        kind: "plural",
        name: "p",
        ordinal: true,
        offset: 0,
        options: {
          one: [{ kind: "pound" }, { kind: "text", value: "st" }],
          other: [{ kind: "pound" }, { kind: "text", value: "th" }],
        },
      },
    ]);
    expect(parseMessage("{g, select, she {her} other {their}}")).toEqual([
      {
        kind: "select",
        name: "g",
        options: {
          she: [{ kind: "text", value: "her" }],
          other: [{ kind: "text", value: "their" }],
        },
      },
    ]);
    expect(parseMessage("")).toEqual([]);
  });

  it("treats # as text outside plurals and as the count inside, through a nested select", () => {
    expect(parseMessage("# tag")).toEqual([{ kind: "text", value: "# tag" }]);
    expect(parseMessage("{n, plural, other {{g, select, other {# left}}}}")).toEqual([
      {
        kind: "plural",
        name: "n",
        ordinal: false,
        offset: 0,
        options: {
          other: [
            {
              kind: "select",
              name: "g",
              options: { other: [{ kind: "pound" }, { kind: "text", value: " left" }] },
            },
          ],
        },
      },
    ]);
  });

  it("honours apostrophe quoting of braces, pounds and doubled apostrophes", () => {
    expect(parseMessage("It''s '{not an arg}' and '#'")).toEqual([
      { kind: "text", value: "It's {not an arg} and '#'" },
    ]);
    expect(parseMessage("{n, plural, other {'#' is #}}")).toEqual([
      {
        kind: "plural",
        name: "n",
        ordinal: false,
        offset: 0,
        options: { other: [{ kind: "text", value: "# is " }, { kind: "pound" }] },
      },
    ]);
    expect(parseMessage("'{a''b}' '{open")).toEqual([{ kind: "text", value: "{a'b} {open" }]);
  });

  it("caches parsed patterns as frozen node lists", () => {
    const first = parseMessage("Hello {name}");
    expect(parseMessage("Hello {name}")).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(parseMessage("Hello {name}!")).not.toBe(first);
  });

  it("reports malformed patterns with the position and REX317", () => {
    const unmatched = failure("Hello {name");
    expect(unmatched).toBeInstanceOf(MessageFormatError);
    expect(isRexError(unmatched)).toBe(true);
    expect(unmatched).toMatchObject({
      name: "MessageFormatError",
      code: "REX317",
      pattern: "Hello {name",
      position: 11,
      message: 'REX317 rex: message "Hello {name" at 11: expected ","',
    });
    expect(failure("Hello }")).toMatchObject({ position: 6, detail: expect.stringContaining("unmatched }") });
    expect(failure("{1st}")).toMatchObject({
      detail: expect.stringContaining('invalid argument name "1st"'),
    });
    expect(failure("{n, date}")).toMatchObject({
      detail: expect.stringContaining('unsupported argument type "date"'),
    });
    expect(failure("{n, plural, one {x} one {y} other {z}}")).toMatchObject({
      detail: expect.stringContaining("duplicate selector one"),
    });
    expect(failure("{n, plural, one {x}}")).toMatchObject({
      detail: expect.stringContaining('plural needs an "other" option'),
    });
    expect(failure("{g, select, she {x}}")).toMatchObject({
      detail: expect.stringContaining('select needs an "other" option'),
    });
    expect(failure("{n, plural, offset:x other {x}}")).toMatchObject({
      detail: expect.stringContaining('invalid plural offset "x"'),
    });
    expect(failure("{n, select, other {x}")).toMatchObject({
      detail: expect.stringContaining("unterminated argument"),
    });
    expect(failure("{n, select, {x}}")).toMatchObject({
      detail: expect.stringContaining("expected a selector"),
    });
    expect(failure("{n, plural, one x other {y}}")).toMatchObject({
      detail: expect.stringContaining('expected "{"'),
    });
    expect(failure("{")).toMatchObject({
      position: 1,
      detail: expect.stringContaining('invalid argument name ""'),
    });
  });
});

describe("formatMessage", () => {
  it("substitutes arguments, formats numbers per locale and keeps missing placeholders", () => {
    expect(formatMessage("Hello {name}!", { name: "Ada" })).toBe("Hello Ada!");
    expect(formatMessage("{n} coins", { n: 1234567.5 })).toBe("1,234,567.5 coins");
    expect(formatMessage("{n} coins", { n: 1234567.5 }, "de")).toBe("1.234.567,5 coins");
    expect(formatMessage("{n, number}", { n: "42" }, "en")).toBe("42");
    expect(formatMessage("{n, number}", { n: "abc" }, "en")).toBe("NaN");
    expect(formatMessage("{flag} {n}", { flag: true }, "en")).toBe("true {n}");
    expect(formatMessage("{n, number} left", {}, "en")).toBe("{n} left");
    expect(formatMessage("plain")).toBe("plain");
  });

  it("selects plural branches by exact value, offset and Intl.PluralRules", () => {
    const guests =
      "{n, plural, offset:1 =0 {nobody} =1 {{host}} one {{host} and # other} other {{host} and # others}}";
    expect(formatMessage(guests, { n: 0, host: "Ana" }, "en")).toBe("nobody");
    expect(formatMessage(guests, { n: 1, host: "Ana" }, "en")).toBe("Ana");
    expect(formatMessage(guests, { n: 2, host: "Ana" }, "en")).toBe("Ana and 1 other");
    expect(formatMessage(guests, { n: 1001, host: "Ana" }, "en")).toBe("Ana and 1,000 others");
    const days = "{n, plural, one {# day} other {# days}}";
    expect(formatMessage(days, { n: "1" }, "en")).toBe("1 day");
    expect(formatMessage(days, { n: "soon" }, "en")).toBe("NaN days");
    expect(formatMessage(days, {}, "en")).toBe("{n}");
    expect(
      formatMessage("{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}", { n: 22 }, "en"),
    ).toBe("22nd");
    expect(
      formatMessage(
        "{n, plural, one {# plik} few {# pliki} many {# plików} other {# pliku}}",
        { n: 22 },
        "pl",
      ),
    ).toBe("22 pliki");
  });

  it("selects branches by value, falls back to other and nests plurals with the outer count", () => {
    const pattern =
      "{who, select, she {She has {count, plural, one {# file} other {# files}}} other {They have #}}";
    expect(formatMessage(pattern, { who: "she", count: 1 }, "en")).toBe("She has 1 file");
    expect(formatMessage(pattern, { who: "they", count: 3 }, "en")).toBe("They have #");
    expect(formatMessage(pattern, { count: 3 }, "en")).toBe("{who}");
    expect(
      formatMessage("{n, plural, other {{g, select, other {# left}}}}", { n: 4000, g: "x" }, "de"),
    ).toBe("4.000 left");
    expect(formatMessage("It''s '{literal}' {v}", { v: 1 }, "en")).toBe("It's {literal} 1");
  });

  it("throws MessageFormatError for malformed patterns at format time", () => {
    expect(() => formatMessage("{n, plural, one {x}}", { n: 1 })).toThrow(MessageFormatError);
    expect(() => formatMessage("{", {})).toThrow(/at 1: invalid argument name ""/);
  });
});
