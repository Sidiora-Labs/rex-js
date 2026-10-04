// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { buildSidecarPayload, serializeSidecar } from "../client/agent/sidecar.tsx";
import { buildManifest } from "../manifest/build.ts";
import {
  SIDECAR_ELEMENT_ID,
  SIDECAR_MIME_TYPE,
  type SidecarPayload,
} from "../manifest/sidecar.schema.ts";
import { action } from "./action.ts";
import { actor } from "./actor.ts";
import { page } from "./page.ts";
import { always } from "./policy.ts";
import { text } from "../schema/index.ts";
import { z } from "zod/mini";
import { escapeInlineJson } from "./serialize.ts";

const UNSAFE_CHARACTERS = ["<", ">", "&", "\u2028", "\u2029"] as const;
const HOSTILE = "</script><!--<script>alert(1)</script>&amp;\u2028\u2029-->";

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
    expect(() => escapeInlineJson(undefined)).toThrow(
      expect.objectContaining({ name: "RexError", code: "REX329" }),
    );
  });

  it("is the serialisation the sidecar script uses", () => {
    const payload = { page: "</script>", note: "\u2028" } as unknown as SidecarPayload;
    expect(serializeSidecar(payload)).toBe(escapeInlineJson(payload));
  });

  it("maps each unsafe character to its JSON unicode escape, in values and in keys", () => {
    for (const character of UNSAFE_CHARACTERS) {
      const code = character.charCodeAt(0).toString(16).padStart(4, "0");
      const escaped = escapeInlineJson({ [`k${character}`]: `v${character}` });
      expect(escaped).toBe(`{"k\\u${code}":"v\\u${code}"}`);
      expect(JSON.parse(escaped)).toEqual({ [`k${character}`]: `v${character}` });
    }
  });

  it("escapes nested arrays, comment openers and repeated sequences", () => {
    const value = { list: [HOSTILE, [HOSTILE, { deep: HOSTILE }]], open: "<!--", close: "-->" };
    const escaped = escapeInlineJson(value);
    expect(escaped).not.toMatch(/[<>&\u2028\u2029]/);
    expect(escaped).not.toContain("</");
    expect(escaped).not.toContain("<!--");
    expect(JSON.parse(escaped)).toEqual(value);
  });
});

describe("the sidecar script Rex emits", () => {
  const hostileAction = action("annotate", {
    input: z.object({ note: text() }),
    output: z.object({ note: text() }),
    policy: always(),
    effect: "reversible",
    label: `Annotate ${HOSTILE}`,
    handler: (input) => ({ note: input.note }),
  });
  const notes = page("notes", {
    route: "/notes",
    params: z.object({ q: z.optional(text()) }),
    actions: [hostileAction],
    states: ["ready"],
  });
  const payload = buildSidecarPayload({
    manifest: buildManifest({
      entities: [],
      actions: [hostileAction],
      pages: [notes],
      policies: [],
    }),
    page: notes,
    params: { q: HOSTILE },
    state: "ready",
    actor: actor({ id: "reader" }),
    openOverlays: [],
    outcome: { actionId: "annotate", ok: false, message: HOSTILE, at: "2026-10-04T00:00:00.000Z" },
  });

  it("serialises params, labels and outcome messages without a raw unsafe character", () => {
    const serialized = serializeSidecar(payload);
    expect(serialized).not.toMatch(/[<>&\u2028\u2029]/);
    expect(JSON.parse(serialized)).toEqual(JSON.parse(JSON.stringify(payload)));
    expect(payload.params).toEqual({ q: HOSTILE });
    expect(payload.actions.map((entry) => entry.label)).toEqual([`Annotate ${HOSTILE}`]);
    expect(payload.outcome?.message).toBe(HOSTILE);
  });

  it("cannot close its script element or open another one when parsed as HTML", () => {
    const serialized = serializeSidecar(payload);
    document.body.innerHTML = `<script type="${SIDECAR_MIME_TYPE}" id="${SIDECAR_ELEMENT_ID}">${serialized}</script><p id="after">after</p>`;
    const scripts = document.body.querySelectorAll("script");
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.textContent).toBe(serialized);
    expect(document.body.lastElementChild?.id).toBe("after");
    expect(JSON.parse(scripts[0]?.textContent ?? "")).toEqual(JSON.parse(JSON.stringify(payload)));
    document.body.innerHTML = "";
  });
});
