import { describe, expect, it } from "vitest";
import { serializeSidecar } from "../client/agent/sidecar.tsx";
import type { SidecarPayload } from "../manifest/sidecar.schema.ts";
import { escapeInlineJson } from "./serialize.ts";

describe("escapeInlineJson", () => {
  it("escapes <, >, & and the line separators so a script element cannot be closed", () => {
    const value = {
      html: "</script><script>alert(1)</script>",
      amp: "a & b",
      lines: "one\u2028two\u2029three",
    };
    const escaped = escapeInlineJson(value);
    expect(escaped).not.toMatch(/[<>&\u2028\u2029]/);
    expect(escaped).toContain("\\u003c/script\\u003e");
    expect(escaped).toContain("a \\u0026 b");
    expect(escaped).toContain("one\\u2028two\\u2029three");
    expect(JSON.parse(escaped)).toEqual(value);
  });

  it("leaves safe JSON unchanged", () => {
    expect(escapeInlineJson({ a: [1, "b", null, true] })).toBe('{"a":[1,"b",null,true]}');
  });

  it("refuses values without a JSON representation", () => {
    expect(() => escapeInlineJson(undefined)).toThrow(TypeError);
  });

  it("is the serialisation the sidecar script uses", () => {
    const payload = { page: "</script>", note: "\u2028" } as unknown as SidecarPayload;
    expect(serializeSidecar(payload)).toBe(escapeInlineJson(payload));
  });
});
