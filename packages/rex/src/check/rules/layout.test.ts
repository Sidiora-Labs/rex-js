import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { REX_ERROR_CATALOG } from "../../core/errors.ts";
import { REX_ERROR_DOCS } from "../../core/errors.docs.ts";
import { discoverApp, runRules } from "../engine.ts";
import { defaultRules } from "./index.ts";
import {
  FIXED_SIZE_CODE,
  FIXED_SIZE_ERROR,
  FIXED_SIZE_ROLES,
  TOUCH_TARGET_CODE,
  TOUCH_TARGET_ERROR,
  TOUCH_TARGET_PX,
  TOUCH_TARGET_ROLES,
  classSizeDeclarations,
  controlName,
  cssSizeDeclarations,
  isFixedPixelSize,
  layoutRule,
  parseLength,
  touchTargetShortfall,
} from "./layout.ts";
import { jsxElements } from "./tokens.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, "../fixtures/layout");
const passRoot = path.join(fixtures, "pass");
const failRoot = path.join(fixtures, "fail");
const parts = "app/pages/wallet/regions/balance/parts";

function parse(text: string): ts.SourceFile {
  return ts.createSourceFile("probe.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function shortfall(classes: string) {
  return touchTargetShortfall(classes.split(" ").flatMap((token) => classSizeDeclarations(token)));
}

describe("layout rule", () => {
  it("is registered after the format and ui rules with its scopes and codes", () => {
    expect(defaultRules).toContain(layoutRule);
    expect(layoutRule.id).toBe("layout");
    expect(defaultRules.map((rule) => rule.id).slice(-3)).toEqual(["format", "ui", "layout"]);
    expect(FIXED_SIZE_ROLES).toEqual(["part"]);
    expect(TOUCH_TARGET_ROLES).toEqual(["region", "part", "overlay"]);
    expect(TOUCH_TARGET_PX).toBe(44);
    expect([FIXED_SIZE_ERROR, TOUCH_TARGET_ERROR]).toEqual(["REX510", "REX511"]);
    expect(REX_ERROR_CATALOG.REX510).toBe("Pixel size on a part");
    expect(REX_ERROR_CATALOG.REX511).toBe("Control under the 44 px touch target");
    expect(REX_ERROR_DOCS.REX511.hint).toContain("var(--rex-hit-target)");
  });

  it("reports zero findings on fluid parts and controls that reach the touch target", async () => {
    const result = await runRules(discoverApp(passRoot), [layoutRule]);
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("reports pixel sizes on parts and controls under 44 px with their positions", async () => {
    const result = await runRules(discoverApp(failRoot), [layoutRule]);
    expect(
      result.findings.map((entry) => [entry.file, entry.line, entry.column, entry.rule]),
    ).toEqual([
      ["app/pages/wallet/overlays/Receive.tsx", 4, 59, TOUCH_TARGET_CODE],
      [`${parts}/Chart.module.css`, 3, 3, FIXED_SIZE_CODE],
      [`${parts}/Chart.module.css`, 10, 3, FIXED_SIZE_CODE],
      [`${parts}/Chart.tsx`, 6, 51, FIXED_SIZE_CODE],
      [`${parts}/Chart.tsx`, 6, 51, TOUCH_TARGET_CODE],
      [`${parts}/Total.tsx`, 5, 21, FIXED_SIZE_CODE],
      [`${parts}/Total.tsx`, 5, 31, FIXED_SIZE_CODE],
      [`${parts}/Total.tsx`, 6, 19, FIXED_SIZE_CODE],
      [`${parts}/Total.tsx`, 6, 38, FIXED_SIZE_CODE],
      [`${parts}/Total.tsx`, 7, 26, TOUCH_TARGET_CODE],
      [`${parts}/Total.tsx`, 8, 42, TOUCH_TARGET_CODE],
      ["app/pages/wallet/regions/balance/region.tsx", 9, 40, TOUCH_TARGET_CODE],
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.errors).toBe(12);
  });

  it("names the declaration, the role and the token or primitive to use", async () => {
    const result = await runRules(discoverApp(failRoot), [layoutRule]);
    expect(result.findings.map((entry) => entry.message)).toEqual([
      "<input> in an overlay declares height: 32 (32 px), under the 44 px touch target",
      "CSS module sets width: 480px in pixels on part Chart",
      "CSS module sets min-block-size: 32px in pixels on part Chart",
      'class sets "size-[24px]" in pixels on part Chart',
      '<span role="button"> in a part declares "size-[24px]" (24 px), under the 44 px touch target',
      'class sets "w-[320px]" in pixels on part Total',
      'class sets "min-h-[120px]" in pixels on part Total',
      'inline style sets minWidth: "200px" in pixels on part Total',
      "inline style sets height: 48 in pixels on part Total",
      '<Button> in a part declares "md:h-9" (36 px), under the 44 px touch target',
      '<a href> in a part declares minHeight: "2rem" (32 px), under the 44 px touch target',
      '<button> in a region declares "h-8" (32 px), under the 44 px touch target',
    ]);
    for (const entry of result.findings) {
      expect(entry.severity).toBe("error");
      if (entry.rule === FIXED_SIZE_CODE) {
        expect(entry.hint).toContain("Page.Stack or Page.Grid");
        expect(entry.hint).toContain("https://rex.sidioralabs.com/errors/REX510");
      } else {
        expect(entry.hint).toContain("min-height: var(--rex-hit-target)");
        expect(entry.hint).toContain("pointer-coarse:min-h-11");
        expect(entry.hint).toContain("https://rex.sidioralabs.com/errors/REX511");
      }
    }
  });

  it("leaves views, regions' own sizes, components and hidden inputs out of scope", async () => {
    const result = await runRules(discoverApp(failRoot), [layoutRule]);
    const reported = result.findings.map((entry) => entry.file);
    expect(reported).not.toContain("app/pages/wallet/view.tsx");
    expect(reported).not.toContain("app/components/ui/button.tsx");
    expect(
      result.findings.filter(
        (entry) => entry.rule === FIXED_SIZE_CODE && entry.file.endsWith("region.tsx"),
      ),
    ).toEqual([]);
    expect(
      result.findings.filter((entry) => entry.file.endsWith("Receive.tsx") && entry.line === 5),
    ).toEqual([]);
  });

  it("parses pixel, rem and Tailwind sizes", () => {
    expect(parseLength("48px")).toEqual({ px: 48, pixels: true });
    expect(parseLength("2.5rem !important")).toEqual({ px: 40, pixels: false });
    expect(parseLength("50%")).toBeNull();
    expect(parseLength("var(--rex-measure)")).toBeNull();
    const [width, height] = classSizeDeclarations("md:size-[24px]");
    expect([width?.property, height?.property]).toEqual(["width", "height"]);
    expect(width?.variants).toEqual(["md"]);
    expect(isFixedPixelSize(width!)).toBe(true);
    expect(
      classSizeDeclarations("h-9").map((entry) => [entry.property, entry.px, entry.pixels]),
    ).toEqual([["height", 36, false]]);
    expect(classSizeDeclarations("[min-height:30px]").map((entry) => entry.px)).toEqual([30]);
    expect(classSizeDeclarations("min-h-(--rex-hit-target)")[0]?.hitTarget).toBe(true);
    expect(classSizeDeclarations("max-w-[480px]")).toEqual([]);
    expect(classSizeDeclarations("w-full")).toEqual([]);
    expect(isFixedPixelSize(classSizeDeclarations("w-[0px]")[0]!)).toBe(false);
    expect(
      cssSizeDeclarations(
        ".a { max-width: 10px; border-width: 2px; line-height: 3px; height: 4px }",
      ).map((entry) => entry.text),
    ).toEqual(["height: 4px"]);
  });

  it("accepts a coarse-pointer minimum of 44 px and reports what still applies on touch", () => {
    expect(shortfall("h-9 pointer-coarse:min-h-11")).toBeNull();
    expect(shortfall("h-8 min-h-(--rex-hit-target)")).toBeNull();
    expect(shortfall("pointer-fine:h-7")).toBeNull();
    expect(shortfall("h-12")).toBeNull();
    expect(shortfall("h-9 pointer-coarse:h-12")?.text).toBe("h-9");
    expect(shortfall("h-9 md:min-h-11")?.text).toBe("h-9");
    expect(shortfall("min-h-[40px]")?.px).toBe(40);
  });

  it("treats buttons, linked anchors, fields, interactive roles and DesignX controls as controls", () => {
    const names = jsxElements(
      parse(
        [
          "export const a = (",
          "  <div>",
          '    <button type="button">A</button>',
          '    <a href="/b">B</a>',
          "    <a>C</a>",
          '    <input type="hidden" name="d" />',
          '    <input name="e" />',
          '    <div role="tab">F</div>',
          '    <div role="region">G</div>',
          "    <Button>H</Button>",
          "    <Card>I</Card>",
          "  </div>",
          ");",
        ].join("\n"),
      ),
    ).map(controlName);
    expect(names).toEqual([
      null,
      "<button>",
      "<a href>",
      null,
      null,
      "<input>",
      '<div role="tab">',
      null,
      "<Button>",
      null,
    ]);
  });
});
