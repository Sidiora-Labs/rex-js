import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { discoverApp, runRules } from "../engine.ts";
import { createSourceLoader } from "../rule.ts";
import { A11Y_RULES, a11yFindings, a11yRule } from "./a11y.ts";
import { defaultRules } from "./index.ts";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/a11y");
const passRoot = path.join(fixtures, "pass");
const failRoot = path.join(fixtures, "fail");
const allFailRoot = path.join(fixtures, "../all/fail");

describe("a11y rule registration", () => {
  it("is part of the default rule set", () => {
    expect(defaultRules).toContain(a11yRule);
    expect(a11yRule.id).toBe("a11y");
  });

  it("declares the six accessibility rules", () => {
    expect([...A11Y_RULES]).toEqual([
      "img-alt",
      "control-name",
      "label-for",
      "heading-order",
      "no-positive-tabindex",
      "no-autofocus-outside-overlay",
    ]);
  });
});

describe("a11y rule on the pass fixture", () => {
  it("reports zero findings", async () => {
    const app = discoverApp(passRoot);
    expect(app.byRole("overlay").map((file) => file.file)).toEqual([
      "app/pages/home/overlays/SearchSheet.tsx",
    ]);
    const result = await runRules(app, [a11yRule]);
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });
});

describe("a11y rule on the fail fixture", () => {
  it("reports every violation with its rule and position", async () => {
    const result = await runRules(discoverApp(failRoot), [a11yRule]);
    expect(
      result.findings.map((entry) => [entry.file, entry.line, entry.column, entry.rule]),
    ).toEqual([
      ["app/pages/home/regions/form/parts/TokenFilter.tsx", 4, 7, "a11y/label-for"],
      ["app/pages/home/regions/form/parts/TokenFilter.tsx", 7, 13, "a11y/no-positive-tabindex"],
      ["app/pages/home/regions/form/region.tsx", 7, 7, "a11y/img-alt"],
      ["app/pages/home/regions/form/region.tsx", 8, 7, "a11y/control-name"],
      ["app/pages/home/regions/form/region.tsx", 11, 7, "a11y/control-name"],
      ["app/pages/home/regions/form/region.tsx", 12, 7, "a11y/control-name"],
      ["app/pages/home/regions/form/region.tsx", 12, 26, "a11y/no-positive-tabindex"],
      ["app/pages/home/regions/form/region.tsx", 13, 7, "a11y/label-for"],
      ["app/pages/home/regions/form/region.tsx", 14, 7, "a11y/label-for"],
      ["app/pages/home/regions/form/region.tsx", 15, 7, "a11y/img-alt"],
      ["app/pages/home/regions/form/region.tsx", 16, 7, "a11y/control-name"],
      ["app/pages/home/regions/form/region.tsx", 17, 14, "a11y/no-autofocus-outside-overlay"],
      ["app/pages/home/view.tsx", 7, 7, "a11y/heading-order"],
    ]);
    expect(result.errors).toBe(13);
    expect(result.exitCode).toBe(1);
  });

  it("covers every declared rule", async () => {
    const result = await runRules(discoverApp(failRoot), [a11yRule]);
    expect(new Set(result.findings.map((entry) => entry.rule))).toEqual(
      new Set(A11Y_RULES.map((code) => `a11y/${code}`)),
    );
  });

  it("names each problem and the fix", async () => {
    const result = await runRules(discoverApp(failRoot), [a11yRule]);
    expect(result.findings.map((entry) => entry.message)).toEqual([
      "<select> has no label",
      "<span> sets tabIndex to 3",
      "<img> has no alt text",
      "<button> has no accessible name",
      "<a href> has no accessible name",
      '<div role="button"> has no accessible name',
      "<div> sets tabIndex to 2",
      "<input> has no label",
      "<label> is not associated with a field",
      '<input type="image"> has no alt text',
      '<input type="button"> has no accessible name',
      "<input> sets autoFocus in a region file",
      "<h3> follows <h1> and skips <h2>",
    ]);
    const hintOf = (rule: string) => {
      const found = result.findings.find((entry) => entry.rule === rule);
      if (!found) throw new Error(`no ${rule} finding`);
      return found.hint;
    };
    expect(hintOf("a11y/img-alt")).toContain('alt=""');
    expect(hintOf("a11y/control-name")).toContain("aria-label");
    expect(hintOf("a11y/label-for")).toContain("htmlFor");
    expect(hintOf("a11y/heading-order")).toContain("<h2>");
    expect(hintOf("a11y/no-positive-tabindex")).toContain("tabIndex={0}");
    expect(hintOf("a11y/no-autofocus-outside-overlay")).toContain("overlays/");
    for (const entry of result.findings) {
      expect(entry.severity).toBe("error");
      expect(entry.hint.length).toBeGreaterThan(10);
    }
  });

  it("checks a single file through the per-file entry point", () => {
    const app = discoverApp(failRoot);
    const view = app.fileAt("app/pages/home/view.tsx");
    if (!view) throw new Error("no view file");
    expect(
      a11yFindings(createSourceLoader(), view).map((entry) => [entry.rule, entry.line]),
    ).toEqual([["a11y/heading-order", 7]]);
  });
});

describe("a11y rule on the combined fail fixture", () => {
  it("reports the image without alt text", async () => {
    const result = await runRules(discoverApp(allFailRoot), [a11yRule]);
    expect(
      result.findings.map((entry) => [entry.file, entry.line, entry.column, entry.rule]),
    ).toEqual([["app/pages/home/regions/extra/region.tsx", 5, 7, "a11y/img-alt"]]);
  });
});
