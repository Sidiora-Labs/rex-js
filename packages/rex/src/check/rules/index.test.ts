import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { isRexError } from "../../core/errors.ts";
import { formatHuman, formatJson } from "../report.ts";
import { a11yRule } from "./a11y.ts";
import { boundariesRule } from "./boundaries.ts";
import { formatRule } from "./format.ts";
import { i18nRule } from "./i18n.ts";
import { defaultRules, runCheck } from "./index.ts";
import { layoutRule } from "./layout.ts";
import { manifestRule } from "./manifest.ts";
import { mediaRule } from "./media.ts";
import { namingRule } from "./naming.ts";
import { parityRule } from "./parity.ts";
import { renderRule } from "./render.ts";
import { securityRule } from "./security.ts";
import { statesRule } from "./states.ts";
import { tokensRule } from "./tokens.ts";
import { trapsRule } from "./traps.ts";
import { typecheckRule } from "./typecheck.ts";
import { uiRule } from "./ui.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const enginePass = path.join(here, "../fixtures/engine/pass");
const qualityFail = path.join(here, "../fixtures/quality/fail");
const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

describe("defaultRules", () => {
  it("lists each rule module once in execution order", () => {
    const expected = [
      typecheckRule,
      boundariesRule,
      statesRule,
      parityRule,
      namingRule,
      trapsRule,
      tokensRule,
      manifestRule,
      securityRule,
      a11yRule,
      renderRule,
      i18nRule,
      mediaRule,
      formatRule,
      uiRule,
      layoutRule,
    ];
    expect(defaultRules).toHaveLength(expected.length);
    expected.forEach((rule, index) => expect(defaultRules[index]).toBe(rule));
    expect(new Set(defaultRules.map((rule) => rule.id)).size).toBe(expected.length);
    expect(Object.isFrozen(defaultRules)).toBe(true);
  });

  it("holds rules that defineRule accepted", () => {
    for (const rule of defaultRules) {
      expect(Object.isFrozen(rule), rule.id).toBe(true);
      expect(rule.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(rule.description.trim(), rule.id).not.toBe("");
      expect(typeof rule.check, rule.id).toBe("function");
    }
  });
});

describe("runCheck", () => {
  it("runs only the given rules and formats their findings for humans", async () => {
    const result = await runCheck(qualityFail, { rules: [namingRule] });
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings.every((entry) => entry.rule.startsWith("naming/"))).toBe(true);
    expect(result.output).toBe(formatHuman(result.findings));
    expect(result.exitCode).toBe(1);
    expect(result.errors + result.warnings).toBe(result.findings.length);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("formats the same findings as json when asked", async () => {
    const human = await runCheck(qualityFail, { rules: [namingRule] });
    const json = await runCheck(qualityFail, { rules: [namingRule], json: true });
    expect(json.findings).toEqual(human.findings);
    expect(json.output).toBe(formatJson(human.findings));
    expect(JSON.parse(json.output)).toEqual(human.findings);
  });

  it("reports no findings on a clean app", async () => {
    const result = await runCheck(enginePass, { rules: [namingRule, tokensRule] });
    expect(result).toEqual({
      findings: [],
      errors: 0,
      warnings: 0,
      exitCode: 0,
      output: "No findings.\n",
    });
    const json = await runCheck(enginePass, { rules: [namingRule], json: true });
    expect(json.output).toBe("[]\n");
  });

  it("rejects a root without an app directory with REX460", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "rex-rules-"));
    temporary.push(root);
    await expect(runCheck(root, { rules: [namingRule] })).rejects.toSatisfy(
      (error: unknown) => isRexError(error) && error.code === "REX460",
    );
  });

  it("rejects a rule listed twice with REX505", async () => {
    await expect(runCheck(enginePass, { rules: [namingRule, namingRule] })).rejects.toSatisfy(
      (error: unknown) =>
        isRexError(error) &&
        error.code === "REX505" &&
        error.message === 'REX505 runRules: rule "naming" is listed twice',
    );
  });
});
