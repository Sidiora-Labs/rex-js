import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { discoverApp, runRules } from "../engine.ts";
import type { Finding } from "../rule.ts";
import { defaultRules } from "./index.ts";
import { HOOK_NAME, PASCAL_CASE, namingRule } from "./naming.ts";

const PAGE = [
  'import { page } from "@sidioralabs/rex";',
  "",
  'export default page("home", { route: "/" });',
  "",
].join("\n");
const REGION = "export default function ListRegion() {\n  return <ul />;\n}\n";
const HELPERS = "export const widths = [1, 2];\n";
const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function writeApp(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "rex-naming-"));
  temporary.push(root);
  for (const [file, content] of Object.entries(files)) {
    const full = path.join(root, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

function run(files: Record<string, string>) {
  return runRules(discoverApp(writeApp(files)), [namingRule]);
}

const summary = (entry: Finding) => [entry.file, entry.line, entry.column, entry.rule];

describe("naming patterns", () => {
  it("accept PascalCase components and use-prefixed hooks", () => {
    for (const name of ["Badge", "HoldingRow", "A1"])
      expect(PASCAL_CASE.test(name), name).toBe(true);
    for (const name of ["badge", "holding-row", "Holding_Row", ""]) {
      expect(PASCAL_CASE.test(name), name).toBe(false);
    }
    for (const name of ["useHoldings", "useA", "useFilters2"]) {
      expect(HOOK_NAME.test(name), name).toBe(true);
    }
    for (const name of ["use", "useholdings", "holdings", "Use", "use-holdings"]) {
      expect(HOOK_NAME.test(name), name).toBe(false);
    }
  });

  it("belong to the naming rule of the default set", () => {
    expect(namingRule.id).toBe("naming");
    expect(defaultRules).toContain(namingRule);
  });
});

describe("naming rule", () => {
  it("reports nothing for a conventional page folder", async () => {
    const result = await run({
      "app/actions/ping.ts": "export const ping = 1;\n",
      "app/components/rowHelpers.ts": HELPERS,
      "app/pages/home/page.ts": PAGE,
      "app/pages/home/view.tsx": "export default function HomeView() {\n  return <p>Home</p>;\n}\n",
      "app/pages/home/hooks/useTotals.ts": "export function useTotals() {\n  return 0;\n}\n",
      "app/pages/home/overlays/FilterSheet.tsx":
        "export default function FilterSheet() {\n  return <div />;\n}\n",
      "app/pages/home/regions/list/region.tsx": REGION,
      "app/pages/home/regions/list/parts/Row.tsx":
        "export default function Row() {\n  return <li />;\n}\n",
    });
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("checks hook files for their name and single named function", async () => {
    const result = await run({
      "app/components/rowHelpers.ts": HELPERS,
      "app/pages/home/page.ts": PAGE,
      "app/pages/home/hooks/filters.tsx": "export function useFilters() {\n  return [];\n}\n",
      "app/pages/home/hooks/useAll.ts": 'export * from "../../../components/rowHelpers.ts";\n',
      "app/pages/home/hooks/useFoo.ts": "export function useBar() {\n  return 1;\n}\n",
      "app/pages/home/hooks/useNothing.ts":
        "const noop = () => undefined;\n\nexport type Nothing = typeof noop;\n",
      "app/pages/home/hooks/useTotals.ts":
        "export default function useTotals() {\n  return 0;\n}\n",
    });
    expect(result.findings.map(summary)).toEqual([
      ["app/pages/home/hooks/filters.tsx", 1, 1, "naming/hook-name"],
      ["app/pages/home/hooks/useAll.ts", 1, 1, "naming/hook-exports"],
      ["app/pages/home/hooks/useFoo.ts", 1, 17, "naming/hook-exports"],
      ["app/pages/home/hooks/useNothing.ts", 1, 1, "naming/hook-exports"],
      ["app/pages/home/hooks/useTotals.ts", 1, 1, "naming/hook-exports"],
    ]);
    expect(result.findings.map((entry) => entry.message)).toEqual([
      "hook file filters is not camelCase starting with use",
      'hook useAll re-exports everything from "../../../components/rowHelpers.ts"',
      "hook useFoo exports useBar instead of useFoo",
      "hook useNothing exports no function",
      "hook useTotals has a default export",
    ]);
    expect(result.findings[0]?.hint).toBe(
      "Rename the file to useFilters.tsx and export a function of the same name.",
    );
    expect(result.findings[2]?.hint).toBe(
      "Name the exported function after its file: export function useFoo().",
    );
  });

  it("checks parts for PascalCase names and a single default export", async () => {
    const result = await run({
      "app/components/rowHelpers.ts": HELPERS,
      "app/pages/home/page.ts": PAGE,
      "app/pages/home/regions/list/region.tsx": REGION,
      "app/pages/home/regions/list/parts/Cell.tsx":
        "export function Cell() {\n  return <td />;\n}\n",
      "app/pages/home/regions/list/parts/Row.tsx": [
        "export default function Row() {",
        "  return <tr />;",
        "}",
        "",
        'export * from "../../../../../components/rowHelpers.ts";',
        "",
      ].join("\n"),
      "app/pages/home/regions/list/parts/holdingRow.tsx":
        "export default function HoldingRow() {\n  return <tr />;\n}\n",
    });
    expect(result.findings.map(summary)).toEqual([
      ["app/pages/home/regions/list/parts/Cell.tsx", 1, 1, "naming/part-exports"],
      ["app/pages/home/regions/list/parts/Cell.tsx", 1, 17, "naming/part-exports"],
      ["app/pages/home/regions/list/parts/Row.tsx", 5, 1, "naming/part-exports"],
      ["app/pages/home/regions/list/parts/holdingRow.tsx", 1, 1, "naming/part-name"],
    ]);
    expect(result.findings.map((entry) => entry.message)).toEqual([
      "part Cell.tsx has no default export",
      "part Cell.tsx exports Cell besides its default export",
      'part Row.tsx exports everything from "../../../../../components/rowHelpers.ts" besides its default export',
      "part file holdingRow.tsx is not PascalCase",
    ]);
    expect(result.findings[0]?.hint).toBe(
      "Export the component as the single default export: export default function Cell(props).",
    );
    expect(result.findings[3]?.hint).toBe(
      "Rename the part to HoldingRow.tsx; parts are PascalCase components.",
    );
  });

  it("checks page, region and overlay folder and file names", async () => {
    const result = await run({
      "app/pages/Home/page.ts": PAGE,
      "app/pages/home/page.ts": PAGE,
      "app/pages/home/overlays/filterSheet.tsx":
        "export default function FilterSheet() {\n  return <div />;\n}\n",
      "app/pages/home/regions/Main/region.tsx": REGION,
      "app/pages/home/regions/list/region.tsx": REGION,
      "app/pages/home/regions/list/Extra.tsx":
        "export default function Extra() {\n  return <li />;\n}\n",
    });
    expect(result.findings.map(summary)).toEqual([
      ["app/pages/Home", 1, 1, "naming/page-folder"],
      ["app/pages/home/overlays/filterSheet.tsx", 1, 1, "naming/overlay-name"],
      ["app/pages/home/regions/Main", 1, 1, "naming/region-folder"],
      ["app/pages/home/regions/list/Extra.tsx", 1, 1, "naming/region-file"],
    ]);
    expect(result.findings.map((entry) => entry.message)).toEqual([
      "page folder Home is not a valid page id",
      "overlay file filterSheet.tsx is not PascalCase",
      "region folder Main of page home is not a valid region name",
      "Extra.tsx is not a region file; regions/list holds region.tsx and parts/",
    ]);
    expect(result.findings[1]?.hint).toBe(
      "Rename the overlay to FilterSheet.tsx and use the same id in page.ts overlays.",
    );
    expect(result.findings[3]?.hint).toBe(
      "Name the region component regions/list/region.tsx and move other components into regions/list/parts/.",
    );
  });

  it("explains files outside the Rex file roles", async () => {
    const result = await run({
      "app/actions/ping.tsx": "export const ping = <p />;\n",
      "app/lib/util.ts": "export const util = 1;\n",
      "app/pages/home/page.ts": PAGE,
      "app/pages/home/helpers/format.ts":
        "export const format = (value: number) => String(value);\n",
      "app/pages/home/index.ts": 'export { default } from "./page.ts";\n',
      "app/pages/index.tsx": "export default function Pages() {\n  return null;\n}\n",
    });
    expect(result.findings.map(summary)).toEqual([
      ["app/actions/ping.tsx", 1, 1, "naming/unclassified"],
      ["app/lib/util.ts", 1, 1, "naming/unclassified"],
      ["app/pages/home/helpers/format.ts", 1, 1, "naming/unclassified"],
      ["app/pages/home/index.ts", 1, 1, "naming/barrel"],
      ["app/pages/index.tsx", 1, 1, "naming/barrel"],
    ]);
    expect(result.findings.map((entry) => entry.message)).toEqual([
      "app/actions/ping.tsx does not match any Rex file role",
      "app/lib/util.ts does not match any Rex file role",
      "app/pages/home/helpers/format.ts does not match any Rex file role",
      "app/pages/home/index.ts is a barrel; app/pages has no index files",
      "app/pages/index.tsx is a barrel; app/pages has no index files",
    ]);
    expect(result.findings[0]?.hint).toBe(
      "Move ping.tsx to app/pages, app/actions (at any depth, as a .ts file), app/entities, app/policies, app/flows, app/components, app/data or app/server.",
    );
    expect(result.findings[2]?.hint).toBe(
      "A page folder holds page.ts, view.tsx, states.tsx, hooks/, regions/<region>/region.tsx, regions/<region>/parts/, overlays/ and test/; move format.ts into one of them under app/pages/home/.",
    );
    expect(result.findings[3]?.hint).toBe(
      "Delete the index file and import each file by its conventional path.",
    );
    expect(result.findings.every((entry) => entry.severity === "error")).toBe(true);
    expect(result.exitCode).toBe(1);
  });
});
