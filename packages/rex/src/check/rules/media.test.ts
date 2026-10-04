import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { discoverApp, runRules } from "../engine.ts";
import { defaultRules } from "./index.ts";
import { RAW_IMG_ROLES, mediaRule, rawImgSites } from "./media.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, "../fixtures/media");
const passRoot = path.join(fixtures, "pass");
const failRoot = path.join(fixtures, "fail");

function parse(text: string): ts.SourceFile {
  return ts.createSourceFile("probe.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

describe("media/no-raw-img", () => {
  it("is part of the default rule set and covers regions and parts", () => {
    expect(defaultRules).toContain(mediaRule);
    expect(mediaRule.id).toBe("media");
    expect(RAW_IMG_ROLES).toEqual(["region", "part"]);
  });

  it("reports zero findings when regions and parts render images through Img", async () => {
    const result = await runRules(discoverApp(passRoot), [mediaRule]);
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("reports every raw img in a region or part with its position", async () => {
    const result = await runRules(discoverApp(failRoot), [mediaRule]);
    expect(
      result.findings.map((entry) => [entry.file, entry.line, entry.column, entry.rule]),
    ).toEqual([
      ["app/pages/gallery/regions/grid/parts/Tile.tsx", 4, 10, "media/no-raw-img"],
      ["app/pages/gallery/regions/grid/region.tsx", 6, 7, "media/no-raw-img"],
      ["app/pages/gallery/regions/hero/region.tsx", 4, 7, "media/no-raw-img"],
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.errors).toBe(3);
  });

  it("names the role and the Img fix", async () => {
    const result = await runRules(discoverApp(failRoot), [mediaRule]);
    expect(result.findings.map((entry) => entry.message)).toEqual([
      'createElement("img") in a part bypasses Img',
      "<img> in a region bypasses Img",
      "<img> in a region bypasses Img",
    ]);
    for (const entry of result.findings) {
      expect(entry.severity).toBe("error");
      expect(entry.hint).toContain("Img from @sidioralabs/rex/client");
      expect(entry.hint).toContain("width and height");
    }
  });

  it("leaves components, overlays and tests alone", async () => {
    const app = discoverApp(failRoot);
    expect(app.byRole("component").map((file) => file.file)).toEqual(["app/components/Logo.tsx"]);
    expect(app.byRole("overlay").map((file) => file.file)).toEqual([
      "app/pages/gallery/overlays/Lightbox.tsx",
    ]);
    expect(app.byRole("test").map((file) => file.file)).toEqual([
      "app/pages/gallery/test/render.test.tsx",
    ]);
    const result = await runRules(app, [mediaRule]);
    const reported = result.findings.map((entry) => entry.file);
    expect(reported).not.toContain("app/components/Logo.tsx");
    expect(reported).not.toContain("app/pages/gallery/overlays/Lightbox.tsx");
    expect(reported.some((file) => file.includes("/test/"))).toBe(false);
  });

  it("finds JSX and createElement images but not Img or other elements", () => {
    const sites = rawImgSites(
      parse(
        [
          'import React, { createElement } from "react";',
          'import { Img } from "@sidioralabs/rex/client";',
          "export const a = <img src=\"/a.png\" alt=\"\" />;",
          "export const b = <Img src=\"/b.png\" alt=\"\" width={1} height={1} />;",
          'export const c = React.createElement("img", { src: "/c.png" });',
          'export const d = createElement("picture", null);',
          "export const e = <svg><image href=\"/e.png\" /></svg>;",
        ].join("\n"),
      ),
    );
    expect(sites.map((site) => site.form)).toEqual(["jsx", "createElement"]);
  });
});
