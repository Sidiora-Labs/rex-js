import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { discoverApp, runRules } from "../engine.ts";
import { createSourceLoader } from "../rule.ts";
import { parityRule, regionActionReferences } from "./parity.ts";
import { statesRule } from "./states.ts";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/parity");
const passRoot = path.join(fixtures, "pass");
const failRoot = path.join(fixtures, "fail");

describe("parity and states rules on the pass fixture", () => {
  it("reports zero findings", async () => {
    const app = discoverApp(passRoot);
    expect(app.pages.map((entry) => entry.id)).toEqual(["portfolio", "send"]);
    const result = await runRules(app, [parityRule, statesRule]);
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("resolves region action references to action ids", () => {
    const app = discoverApp(passRoot);
    const sources = createSourceLoader();
    const form = app.pageOf("send")?.regions.find((region) => region.name === "form");
    expect(form?.file).not.toBeNull();
    const references = regionActionReferences(app, sources, form?.file?.path as string);
    expect(references.map((reference) => [reference.key, reference.line])).toEqual([
      ["action:pick-token", 2],
    ]);
  });
});

describe("parity and states rules on the fail fixture", () => {
  it("reports every mismatch direction once", async () => {
    const result = await runRules(discoverApp(failRoot), [parityRule, statesRule]);
    expect(
      result.findings.map((entry) => [entry.file, entry.line, entry.column, entry.rule]),
    ).toEqual([
      ["app/pages/dynamic/page.ts", 5, 16, "parity/unreadable"],
      ["app/pages/dynamic/page.ts", 8, 23, "states/unknown-state"],
      ["app/pages/orphan/page.ts", 1, 1, "parity/missing-file"],
      ["app/pages/orphan/states.tsx", 1, 1, "parity/missing-file"],
      ["app/pages/send/overlays/StraySheet.tsx", 1, 1, "parity/overlay-undeclared"],
      ["app/pages/send/page.ts", 7, 19, "parity/action-unreferenced"],
      ["app/pages/send/page.ts", 8, 21, "parity/region-missing"],
      ["app/pages/send/page.ts", 8, 32, "parity/region-missing"],
      ["app/pages/send/page.ts", 10, 5, "parity/overlay-missing"],
      ["app/pages/send/regions/extra/region.tsx", 1, 1, "parity/region-undeclared"],
      ["app/pages/send/regions/form/region.tsx", 2, 1, "parity/action-undeclared"],
      ["app/pages/send/states.tsx", 1, 1, "states/missing-export"],
      ["app/pages/send/states.tsx", 35, 17, "states/extra-export"],
      ["app/pages/send/view.tsx", 1, 1, "states/view-default"],
    ]);
    expect(result.exitCode).toBe(1);
  });

  it("explains each mismatch with a fix hint", async () => {
    const result = await runRules(discoverApp(failRoot), [parityRule, statesRule]);
    const message = (rule: string, index = 0) =>
      result.findings.filter((entry) => entry.rule === rule)[index]?.message;

    expect(message("parity/region-missing", 0)).toBe(
      'region "confirm" of page send has a folder but no region.tsx',
    );
    expect(message("parity/region-missing", 1)).toBe(
      'region "summary" is declared in page.ts but regions/summary/region.tsx does not exist',
    );
    expect(message("parity/region-undeclared")).toBe(
      'regions/extra exists but page.ts of page send does not declare region "extra"',
    );
    expect(message("parity/overlay-missing")).toBe(
      'overlay "TokenSheet" is declared in page.ts but overlays/TokenSheet.tsx does not exist',
    );
    expect(message("parity/overlay-undeclared")).toBe(
      'overlays/StraySheet.tsx exists but page.ts of page send does not declare overlay "StraySheet"',
    );
    expect(message("parity/action-unreferenced")).toBe(
      'action "pick-token" is declared on page send but no region references it',
    );
    expect(message("parity/action-undeclared")).toBe(
      'region "form" references action "pick-contact", which page send does not declare',
    );
    expect(message("parity/unreadable")).toBe(
      "page.ts regions of page dynamic is not a literal the checker can read",
    );
    expect(message("parity/missing-file", 0)).toBe("page orphan has no page.ts");
    expect(message("parity/missing-file", 1)).toBe("page orphan has no states.tsx");
    expect(message("states/missing-export")).toBe(
      "states.tsx of page send does not export the Offline component",
    );
    expect(message("states/extra-export")).toBe(
      "states.tsx of page send has the extra export Fancy",
    );
    expect(message("states/view-default")).toBe("view.tsx of page send has no default export");
    expect(message("states/unknown-state")).toBe(
      'page.ts of page dynamic declares the unknown state "busy"',
    );

    for (const entry of result.findings) {
      expect(entry.severity).toBe("error");
      expect(entry.hint.length).toBeGreaterThan(10);
    }
    const regionMissing = result.findings.find((entry) => entry.rule === "parity/region-missing");
    expect(regionMissing?.hint).toContain("rex make region send confirm");
    const missingExport = result.findings.find((entry) => entry.rule === "states/missing-export");
    expect(missingExport?.hint).toContain("export function Offline(props: StateProps)");
  });

  it("checks only declared states when page.ts narrows them", async () => {
    const result = await runRules(discoverApp(passRoot), [statesRule]);
    expect(result.findings).toEqual([]);
    const sources = createSourceLoader();
    const portfolio = discoverApp(passRoot).pageOf("portfolio");
    expect(
      sources.pageDeclaration(portfolio?.page?.path as string)?.states?.map((state) => state.name),
    ).toEqual(["loading", "empty", "ready"]);
  });
});
