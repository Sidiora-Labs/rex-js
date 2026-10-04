import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { discoverApp, runRules } from "./engine.ts";
import { formatHuman } from "./report.ts";
import { defaultRules, runCheck } from "./rules/index.ts";
import { typecheckRule } from "./rules/typecheck.ts";
import type { Finding } from "./rule.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "../..");
const enginePass = path.join(here, "fixtures/engine/pass");
const allFail = path.join(here, "fixtures/all/fail");
const CHECK_TEST_TIMEOUT_MS = 60_000;
const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function link(root: string, name: string, target: string): void {
  const destination = path.join(root, "node_modules", name);
  mkdirSync(path.dirname(destination), { recursive: true });
  symlinkSync(realpathSync(target), destination, "dir");
}

function tempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "rex-check-"));
  temporary.push(root);
  return root;
}

function copyAllFail(): string {
  const root = tempRoot();
  cpSync(allFail, root, { recursive: true });
  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "all-fail", private: true, type: "module" })}\n`,
  );
  link(root, "@sidioralabs/rex", packageRoot);
  link(root, "react", path.join(packageRoot, "node_modules/react"));
  link(root, "@types/react", path.join(packageRoot, "node_modules/@types/react"));
  mkdirSync(path.join(root, ".rex"));
  writeFileSync(path.join(root, ".rex/manifest.json"), "{}\n");
  return root;
}

const ruleOf = (entry: Finding) => entry.rule.split("/")[0];

describe("default rule set", { timeout: CHECK_TEST_TIMEOUT_MS }, () => {
  it("runs the rules in execution order", () => {
    expect(defaultRules.map((rule) => rule.id)).toEqual([
      "typecheck",
      "boundaries",
      "states",
      "parity",
      "naming",
      "traps",
      "tokens",
      "manifest",
    ]);
  });

  it("reports zero findings on the engine pass fixture", async () => {
    const human = await runCheck(enginePass);
    expect(human.findings).toEqual([]);
    expect(human.exitCode).toBe(0);
    expect(human.output).toBe("No findings.\n");
    const json = await runCheck(enginePass, { json: true });
    expect(json.output).toBe("[]\n");
    expect(json.exitCode).toBe(0);
  });

  it("reports findings from every rule on the combined fail fixture", async () => {
    const root = copyAllFail();
    const started = performance.now();
    const result = await runCheck(root, { json: true });
    expect(performance.now() - started).toBeLessThan(30_000);
    expect(result.exitCode).toBe(1);
    expect(new Set(result.findings.map(ruleOf))).toEqual(
      new Set(defaultRules.map((rule) => rule.id)),
    );
    expect(JSON.parse(result.output)).toEqual(result.findings);

    const pick = (rule: string) =>
      result.findings
        .filter((entry) => entry.rule === rule)
        .map((entry) => [entry.file, entry.line, entry.column]);
    expect(result.findings.filter((entry) => ruleOf(entry) === "typecheck")).toEqual([
      {
        rule: "typecheck/ts2322",
        severity: "error",
        file: "app/data/count.ts",
        line: 1,
        column: 14,
        message: "TS2322: Type 'string' is not assignable to type 'number'.",
        hint: "Fix the type error; rex check type-checks the app with its tsconfig.json.",
      },
    ]);
    expect(pick("boundaries/import-table")).toEqual([["app/pages/home/view.tsx", 1, 1]]);
    expect(pick("states/missing-export")).toHaveLength(7);
    expect(pick("parity/region-undeclared")).toEqual([
      ["app/pages/home/regions/extra/region.tsx", 1, 1],
    ]);
    expect(pick("naming/part-name")).toEqual([
      ["app/pages/home/regions/main/parts/badge.tsx", 1, 1],
    ]);
    expect(pick("traps/canvas")).toEqual([["app/pages/home/regions/main/region.tsx", 7, 7]]);
    expect(pick("tokens/raw-color")).toEqual([["app/pages/home/regions/main/region.tsx", 5, 25]]);
    expect(pick("manifest/manifest-stale")).toEqual([[".rex/manifest.json", 1, 1]]);
    expect(pick("manifest/agents-missing")).toEqual([["AGENTS.md", 1, 1]]);

    const human = await runCheck(root);
    expect(human.output).toBe(formatHuman(result.findings));
    expect(human.output).toContain("app/data/count.ts\n");
  });
});

describe("typecheck rule", { timeout: CHECK_TEST_TIMEOUT_MS }, () => {
  it("type-checks with the Rex defaults when the app has no tsconfig.json", async () => {
    const root = tempRoot();
    mkdirSync(path.join(root, "app/data"), { recursive: true });
    writeFileSync(
      path.join(root, "app/data/sum.ts"),
      "export function sum(a, b) {\n  return a + b;\n}\n",
    );
    const result = await runRules(discoverApp(root), [typecheckRule]);
    expect(
      result.findings.map((entry) => [entry.rule, entry.file, entry.line, entry.column]),
    ).toEqual([
      ["typecheck/ts7006", "app/data/sum.ts", 1, 21],
      ["typecheck/ts7006", "app/data/sum.ts", 1, 24],
    ]);
  });

  it("uses the app tsconfig.json when present", async () => {
    const root = tempRoot();
    mkdirSync(path.join(root, "app/data"), { recursive: true });
    writeFileSync(
      path.join(root, "app/data/sum.ts"),
      "export function sum(a, b) {\n  return a + b;\n}\n",
    );
    writeFileSync(
      path.join(root, "tsconfig.json"),
      `${JSON.stringify({ compilerOptions: { strict: false, noEmit: true, types: [] }, include: ["app"] })}\n`,
    );
    expect((await runRules(discoverApp(root), [typecheckRule])).findings).toEqual([]);

    writeFileSync(path.join(root, "app/data/wrong.ts"), "export const flag: boolean = 1;\n");
    const result = await runRules(discoverApp(root), [typecheckRule]);
    expect(result.findings.map((entry) => [entry.rule, entry.file, entry.line])).toEqual([
      ["typecheck/ts2322", "app/data/wrong.ts", 1],
    ]);
  });

  it("reports an unreadable tsconfig.json", async () => {
    const root = tempRoot();
    mkdirSync(path.join(root, "app"), { recursive: true });
    writeFileSync(path.join(root, "tsconfig.json"), '{ "compilerOptions": { ');
    const result = await runRules(discoverApp(root), [typecheckRule]);
    expect(result.exitCode).toBe(1);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings.every((entry) => entry.file === "tsconfig.json")).toBe(true);
  });
});
