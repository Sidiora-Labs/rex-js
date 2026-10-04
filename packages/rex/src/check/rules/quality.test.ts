import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { discoverApp, runRules } from "../engine.ts";
import { namingRule } from "./naming.ts";
import { ARBITRARY_VALUE_CLASS, RAW_COLOR_CLASS, tokensRule } from "./tokens.ts";
import { trapsRule } from "./traps.ts";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/quality");
const passRoot = path.join(fixtures, "pass");
const failRoot = path.join(fixtures, "fail");
const rules = [namingRule, trapsRule, tokensRule];

describe("naming, traps and tokens on the pass fixture", () => {
  it("reports zero findings", async () => {
    const result = await runRules(discoverApp(passRoot), rules);
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("exempts app/components from the token rule but not from traps", async () => {
    const app = discoverApp(passRoot);
    expect(app.byRole("component").map((file) => file.file)).toEqual(["app/components/Chart.tsx"]);
    expect((await runRules(app, [tokensRule])).findings).toEqual([]);
  });
});

describe("naming, traps and tokens on the fail fixture", () => {
  it("reports every violation with its rule and position", async () => {
    const result = await runRules(discoverApp(failRoot), rules);
    expect(
      result.findings.map((entry) => [entry.file, entry.line, entry.column, entry.rule]),
    ).toEqual([
      ["app/pages/home/hooks/holdings.ts", 1, 1, "naming/hook-name"],
      ["app/pages/home/hooks/useFilters.ts", 5, 14, "naming/hook-exports"],
      ["app/pages/home/overlays/contactSheet.tsx", 1, 1, "naming/overlay-name"],
      ["app/pages/home/page.ts", 6, 14, "traps/overlay-dismiss"],
      ["app/pages/home/regions/list/List.tsx", 1, 1, "naming/region-file"],
      ["app/pages/home/regions/list/parts/Badge.tsx", 5, 14, "naming/part-exports"],
      ["app/pages/home/regions/list/parts/Chart.tsx", 2, 10, "traps/canvas"],
      ["app/pages/home/regions/list/parts/Pill.tsx", 1, 1, "naming/part-exports"],
      ["app/pages/home/regions/list/parts/Pill.tsx", 1, 17, "naming/part-exports"],
      ["app/pages/home/regions/list/parts/holdingRow.tsx", 1, 1, "naming/part-name"],
      ["app/pages/home/regions/list/region.tsx", 5, 20, "tokens/raw-color"],
      ["app/pages/home/regions/list/region.tsx", 5, 31, "tokens/arbitrary-value"],
      ["app/pages/home/regions/list/region.tsx", 6, 7, "traps/hover-only"],
      ["app/pages/home/regions/list/region.tsx", 7, 7, "traps/drag-only"],
      ["app/pages/home/regions/list/region.tsx", 8, 20, "tokens/inline-color"],
      ["app/pages/home/states.tsx", 4, 10, "traps/motion-only"],
      ["app/pages/home/utils.ts", 1, 1, "naming/unclassified"],
      ["app/pages/index.ts", 1, 1, "naming/barrel"],
    ]);
    expect(result.exitCode).toBe(1);
  });

  it("names each problem and the fix", async () => {
    const result = await runRules(discoverApp(failRoot), rules);
    const first = (rule: string) => {
      const found = result.findings.find((entry) => entry.rule === rule);
      if (!found) throw new Error(`no ${rule} finding`);
      return found;
    };
    expect(first("naming/part-name").message).toBe("part file holdingRow.tsx is not PascalCase");
    expect(first("naming/part-name").hint).toContain("HoldingRow.tsx");
    expect(first("naming/part-exports").message).toBe(
      "part Badge.tsx exports size besides its default export",
    );
    expect(first("naming/hook-name").hint).toContain("useHoldings.ts");
    expect(first("naming/hook-exports").message).toBe(
      "hook useFilters exports DEFAULT_FILTERS in addition to its hook",
    );
    expect(first("naming/region-file").message).toBe(
      "List.tsx is not a region file; regions/list holds region.tsx and parts/",
    );
    expect(first("naming/overlay-name").hint).toContain("ContactSheet.tsx");
    expect(first("naming/barrel").message).toBe(
      "app/pages/index.ts is a barrel; app/pages has no index files",
    );
    expect(first("naming/unclassified").hint).toContain("app/pages/home/");
    expect(first("traps/hover-only").message).toBe("<li> handles onMouseEnter without onFocus");
    expect(first("traps/drag-only").message).toBe("draggable <li> has no data-rex-alternative");
    expect(first("traps/canvas").message).toBe("<canvas> has no data-rex-alternative");
    expect(first("traps/motion-only").message).toBe(
      '<div> conveys state only through "animate-spin"',
    );
    expect(first("traps/overlay-dismiss").message).toBe(
      'overlay "ContactSheet" of page home declares no dismiss',
    );
    expect(first("tokens/raw-color").message).toBe(
      'raw color utility "bg-red-500" outside app/components',
    );
    expect(first("tokens/arbitrary-value").message).toBe(
      'arbitrary value utility "p-[3px]" outside app/components',
    );
    expect(first("tokens/inline-color").message).toBe(
      'inline style color uses the raw value "#ff0000"',
    );
    for (const entry of result.findings) expect(entry.hint.length).toBeGreaterThan(10);
  });

  it("classifies Tailwind class tokens", () => {
    for (const token of [
      "bg-red-500",
      "text-white",
      "hover:border-slate-200",
      "md:focus:ring-blue-600/50",
      "from-emerald-950",
      "border-t-gray-100",
      "!text-black",
    ]) {
      expect(RAW_COLOR_CLASS.test(token), token).toBe(true);
    }
    for (const token of [
      "bg-surface",
      "text-fg",
      "border",
      "text-sm",
      "ring-2",
      "bg-transparent",
    ]) {
      expect(RAW_COLOR_CLASS.test(token), token).toBe(false);
    }
    expect(ARBITRARY_VALUE_CLASS.test("w-[13px]")).toBe(true);
    expect(ARBITRARY_VALUE_CLASS.test("bg-[#fff]")).toBe(true);
    expect(ARBITRARY_VALUE_CLASS.test("p-4")).toBe(false);
  });
});
