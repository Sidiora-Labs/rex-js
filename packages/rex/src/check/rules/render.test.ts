import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { discoverApp, runRules } from "../engine.ts";
import { defaultRules } from "./index.ts";
import { renderRule } from "./render.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, "../fixtures/render");
const passRoot = path.join(fixtures, "pass");
const failRoot = path.join(fixtures, "fail");

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function tempApp(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), "rex-render-rule-"));
  temporary.push(root);
  for (const [file, text] of Object.entries(files)) {
    const full = path.join(root, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  return root;
}

describe("render/static-needs-js", () => {
  it("is part of the default rule set", () => {
    expect(defaultRules).toContain(renderRule);
    expect(renderRule.id).toBe("render");
  });

  it("reports zero findings for a static page whose actions and overlays work without JavaScript", async () => {
    const result = await runRules(discoverApp(passRoot), [renderRule]);
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("reports a shortcut action and a region-bound overlay on a static page with their positions", async () => {
    const result = await runRules(discoverApp(failRoot), [renderRule]);
    expect(
      result.findings.map((entry) => [entry.rule, entry.file, entry.line, entry.column]),
    ).toEqual([
      ["render/static-needs-js", "app/pages/about/page.ts", 8, 24],
      ["render/static-needs-js", "app/pages/about/page.ts", 12, 5],
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.errors).toBe(2);
  });

  it("names the page, the action or overlay and the fix", async () => {
    const result = await runRules(discoverApp(failRoot), [renderRule]);
    expect(result.findings.map((entry) => entry.message)).toEqual([
      'static page "about" declares action "add-note" with shortcut "mod+n", which needs JavaScript (declared in app/actions/add-note.ts)',
      'static page "about" declares overlay "NoteSheet" bound to region state, which needs JavaScript',
    ]);
    const [shortcut, overlay] = result.findings;
    expect(shortcut?.hint).toContain('Remove the shortcut from action "add-note"');
    expect(overlay?.hint).toContain('binding: "url"');
    for (const entry of result.findings) {
      expect(entry.severity).toBe("error");
      expect(entry.hint).toContain('"ssg" or "ssr"');
    }
  });

  it("leaves pages that hydrate alone even when they use shortcuts and region overlays", async () => {
    const result = await runRules(discoverApp(failRoot), [renderRule]);
    expect(result.findings.some((entry) => entry.file === "app/pages/home/page.ts")).toBe(false);
  });

  it("reads the render mode through as const and quoted keys", async () => {
    const root = tempApp({
      "app/actions/ping.ts": [
        'import { action, always } from "@sidioralabs/rex";',
        'import { z } from "zod/mini";',
        "",
        'export const ping = action("ping", {',
        "  input: z.object({}),",
        "  output: z.object({}),",
        "  policy: always(),",
        '  effect: "read",',
        '  "shortcut": "p",',
        "  handler: () => ({}),",
        "});",
        "",
      ].join("\n"),
      "app/pages/status/page.ts": [
        'import { page } from "@sidioralabs/rex";',
        'import { ping } from "../../actions/ping.ts";',
        "",
        'export default page("status", {',
        '  route: "/status",',
        '  "render": "static" as const,',
        "  actions: [ping],",
        "});",
        "",
      ].join("\n"),
    });
    const result = await runRules(discoverApp(root), [renderRule]);
    expect(result.findings.map((entry) => [entry.file, entry.line, entry.column])).toEqual([
      ["app/pages/status/page.ts", 7, 13],
    ]);
    expect(result.findings[0]?.message).toContain('shortcut "p"');
  });
});
