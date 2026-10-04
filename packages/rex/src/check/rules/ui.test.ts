import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";
import { REX_ERROR_CATALOG } from "../../core/errors.ts";
import { REX_ERROR_DOCS } from "../../core/errors.docs.ts";
import { DESIGNX_MAP } from "../../designx/index.ts";
import { discoverApp, runRules } from "../engine.ts";
import { createSourceLoader } from "../rule.ts";
import { defaultRules } from "./index.ts";
import {
  DESIGNX_PRIMITIVE_CODE,
  DESIGNX_PRIMITIVE_ERROR,
  DESIGNX_PRIMITIVE_ROLES,
  RAW_PRIMITIVE_TAGS,
  designxPrimitive,
  rawPrimitiveSites,
  readUiConfig,
  uiRule,
} from "./ui.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, "../fixtures/ui");
const passRoot = path.join(fixtures, "pass");
const failRoot = path.join(fixtures, "fail");
const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function parse(text: string): ts.SourceFile {
  return ts.createSourceFile("probe.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function failCopyWithConfig(config: string): string {
  const root = mkdtempSync(path.join(tmpdir(), "rex-ui-"));
  temporary.push(root);
  cpSync(failRoot, root, { recursive: true });
  writeFileSync(path.join(root, "rex.config.ts"), config);
  return root;
}

const configWith = (ui: string) =>
  [
    'import { defineConfig } from "@sidioralabs/rex/config";',
    'import app from "rex:app";',
    "",
    `export default defineConfig({ app${ui} });`,
    "",
  ].join("\n");

describe("ui/designx-primitive", () => {
  it("is registered after the format rule and covers regions, parts and overlays", () => {
    expect(defaultRules).toContain(uiRule);
    expect(uiRule.id).toBe("ui");
    const ids = defaultRules.map((rule) => rule.id);
    expect(ids.indexOf("ui")).toBeGreaterThan(ids.indexOf("format"));
    expect(DESIGNX_PRIMITIVE_ROLES).toEqual(["region", "part", "overlay"]);
    expect(RAW_PRIMITIVE_TAGS).toEqual([
      "button",
      "input",
      "select",
      "textarea",
      "table",
      "dialog",
    ]);
  });

  it("documents its code in the error catalog", () => {
    expect(DESIGNX_PRIMITIVE_ERROR).toBe("REX509");
    expect(REX_ERROR_CATALOG[DESIGNX_PRIMITIVE_ERROR]).toBe(
      "Raw element where the DesignX kit has a primitive",
    );
    expect(REX_ERROR_DOCS[DESIGNX_PRIMITIVE_ERROR].hint).toContain("app/components/ui");
  });

  it("reports zero findings when regions, parts and overlays use the DesignX primitives", async () => {
    const result = await runRules(discoverApp(passRoot), [uiRule]);
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("reports every raw primitive element in a region, part or overlay with its position", async () => {
    const result = await runRules(discoverApp(failRoot), [uiRule]);
    expect(
      result.findings.map((entry) => [entry.file, entry.line, entry.column, entry.rule]),
    ).toEqual([
      ["app/pages/shop/overlays/Checkout.tsx", 3, 5, DESIGNX_PRIMITIVE_CODE],
      ["app/pages/shop/overlays/Checkout.tsx", 4, 7, DESIGNX_PRIMITIVE_CODE],
      ["app/pages/shop/regions/cart/parts/Quantity.tsx", 7, 7, DESIGNX_PRIMITIVE_CODE],
      ["app/pages/shop/regions/cart/parts/Quantity.tsx", 9, 7, DESIGNX_PRIMITIVE_CODE],
      ["app/pages/shop/regions/cart/parts/Quantity.tsx", 10, 7, DESIGNX_PRIMITIVE_CODE],
      ["app/pages/shop/regions/cart/parts/Quantity.tsx", 11, 8, DESIGNX_PRIMITIVE_CODE],
      ["app/pages/shop/regions/cart/region.tsx", 6, 7, DESIGNX_PRIMITIVE_CODE],
      ["app/pages/shop/regions/cart/region.tsx", 15, 7, DESIGNX_PRIMITIVE_CODE],
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.errors).toBe(8);
  });

  it("names the role and the primitive the rex/designx map gives each surface", async () => {
    const result = await runRules(discoverApp(failRoot), [uiRule]);
    expect(result.findings.map((entry) => entry.message)).toEqual([
      "<dialog> in an overlay bypasses the DesignX dialog or sheet primitive",
      "<textarea> in an overlay bypasses the DesignX textarea primitive",
      "<input> in a part bypasses the DesignX number-field primitive",
      "<input> in a part bypasses the DesignX checkbox primitive",
      "<input> in a part bypasses the DesignX input primitive",
      'createElement("select") in a part bypasses the DesignX select primitive',
      "<table> in a region bypasses the DesignX card or data-table primitive",
      "<button> in a region bypasses the DesignX button primitive",
    ]);
    const [dialog, , numberField, , , , table, button] = result.findings;
    expect(dialog?.hint).toContain("dialog (app/components/ui/dialog.tsx) for dialog");
    expect(dialog?.hint).toContain("sheet (app/components/ui/sheet.tsx) for bottom-sheet");
    expect(numberField?.hint).toContain("number-field (app/components/ui/number-field.tsx)");
    expect(table?.hint).toContain("card (app/components/ui/card.tsx) for phone");
    expect(table?.hint).toContain(
      "data-table (app/components/ui/data-table.tsx) for tablet, desktop, wide",
    );
    expect(button?.hint).toBe(
      "Replace the raw <button> with the DesignX button (app/components/ui/button.tsx) primitive that rex/designx maps the button surface to; rex new installs it into app/components/ui from https://dxuireact.com/r/button.json. Docs: https://rex.sidioralabs.com/errors/REX509",
    );
    for (const entry of result.findings) expect(entry.severity).toBe("error");
  });

  it("leaves views, states, components and hidden inputs alone", async () => {
    const app = discoverApp(failRoot);
    expect(app.byRole("view").map((file) => file.file)).toEqual(["app/pages/shop/view.tsx"]);
    expect(app.byRole("states").map((file) => file.file)).toEqual(["app/pages/shop/states.tsx"]);
    expect(app.byRole("component").map((file) => file.file)).toEqual([
      "app/components/RawButton.tsx",
    ]);
    const result = await runRules(app, [uiRule]);
    const reported = result.findings.map((entry) => entry.file);
    expect(reported).not.toContain("app/pages/shop/view.tsx");
    expect(reported).not.toContain("app/pages/shop/states.tsx");
    expect(reported).not.toContain("app/components/RawButton.tsx");
    expect(
      result.findings.filter((entry) => entry.file.endsWith("Quantity.tsx") && entry.line === 8),
    ).toEqual([]);
  });

  it("reports nothing when ui.kit is none or absent", async () => {
    for (const ui of ["", ', ui: "none"', ', ui: { kit: "none" }', ", ui: {}"]) {
      const root = failCopyWithConfig(configWith(ui));
      expect(readUiConfig(root, createSourceLoader()).kit).toBe("none");
      expect((await runRules(discoverApp(root), [uiRule])).findings).toEqual([]);
    }
    const root = failCopyWithConfig(configWith(', ui: "designx"'));
    expect(readUiConfig(root, createSourceLoader())).toEqual({ kit: "designx", findings: [] });
    expect((await runRules(discoverApp(root), [uiRule])).findings).toHaveLength(8);
  });

  it("reports a ui field it cannot read instead of guessing the kit", async () => {
    const root = failCopyWithConfig(
      [
        'import { defineConfig } from "@sidioralabs/rex/config";',
        'import app from "rex:app";',
        "",
        'const kit = "designx" as const;',
        "",
        "export default defineConfig({ app, ui: { kit } });",
        "",
      ].join("\n"),
    );
    const result = await runRules(discoverApp(root), [uiRule]);
    expect(
      result.findings.map((entry) => [
        entry.rule,
        entry.file,
        entry.line,
        entry.column,
        entry.message,
      ]),
    ).toEqual([
      [
        "ui/config",
        "rex.config.ts",
        6,
        42,
        "ui.kit in rex.config.ts is not a static literal, so rex check cannot read it",
      ],
    ]);
    expect(result.exitCode).toBe(1);

    const invalid = failCopyWithConfig(configWith(', ui: "material"'));
    const read = readUiConfig(invalid, createSourceLoader());
    expect(read.kit).toBe("none");
    expect(read.findings.map((entry) => entry.message)).toEqual([
      'ui.kit "material" in rex.config.ts is not one of designx, none',
    ]);
  });

  it("maps each raw tag to its surface, reading static input types", () => {
    const sites = rawPrimitiveSites(
      parse(
        [
          'import React, { createElement } from "react";',
          'import { Button } from "./ui/button.tsx";',
          'export const a = <button type="button">A</button>;',
          "export const b = <Button>B</Button>;",
          'export const c = <input type={"radio"} name="c" />;',
          'export const d = <input type="hidden" name="d" />;',
          'export const e = React.createElement("input", { type: "hidden" });',
          'export const f = createElement("dialog", null);',
          "export const g = <svg><rect /></svg>;",
          'export const h = <input type={kind} name="h" />;',
        ].join("\n"),
      ),
    );
    expect(sites.map((site) => [site.tag, site.surface, site.form])).toEqual([
      ["button", "button", "jsx"],
      ["input", "radioGroup", "jsx"],
      ["dialog", "sheet", "createElement"],
      ["input", "input", "jsx"],
    ]);
  });

  it("derives the primitive and its screen forms from the rex/designx map", () => {
    expect(designxPrimitive("button")).toEqual({ surface: "button", items: ["button"], forms: {} });
    expect(designxPrimitive("sheet")).toEqual({
      surface: "sheet",
      items: [DESIGNX_MAP.sheet.dialog, DESIGNX_MAP.sheet["bottom-sheet"]],
      forms: { dialog: ["dialog"], sheet: ["bottom-sheet"] },
    });
    expect(designxPrimitive("list").forms).toEqual({
      card: ["phone"],
      "data-table": ["tablet", "desktop", "wide"],
    });
  });
});
