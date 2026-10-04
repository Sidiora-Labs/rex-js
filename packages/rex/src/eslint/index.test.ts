import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Linter } from "eslint";
import { afterAll, describe, expect, it } from "vitest";
import { a11yRule } from "../check/rules/a11y.ts";
import { boundariesRule } from "../check/rules/boundaries.ts";
import { formatRule } from "../check/rules/format.ts";
import { defaultRules } from "../check/rules/index.ts";
import { typecheckRule } from "../check/rules/typecheck.ts";
import { REX_VERSION } from "../index.ts";
import {
  LINT_FILES,
  LINT_IGNORES,
  LINT_RULE_IDS,
  checkerFindings,
  config,
  eslintRule,
  lintRules,
  plugin,
  rexRules,
} from "./index.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "fixtures/lint");
const AVATAR = "app/pages/profile/regions/card/parts/Avatar.tsx";
const PAGE = "app/pages/profile/page.ts";
const SERVER_IMPORT = 'import { createRexServer } from "@sidioralabs/rex/server";\n';

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function copyFixture(): string {
  const copy = mkdtempSync(path.join(tmpdir(), "rex-eslint-"));
  temporary.push(copy);
  cpSync(root, copy, { recursive: true });
  return copy;
}

describe("rex/eslint module", () => {
  it("filters any rule list down to the lintable ids in the given order", () => {
    expect(lintRules([])).toEqual([]);
    expect(lintRules([formatRule, a11yRule, boundariesRule, typecheckRule])).toEqual([
      a11yRule,
      boundariesRule,
    ]);
    const defaults = lintRules();
    expect(defaults.length).toBeGreaterThan(0);
    for (const rule of defaults) {
      expect(LINT_RULE_IDS).toContain(rule.id);
      expect(defaultRules).toContain(rule);
    }
    expect(defaults.map((rule) => rule.id)).toEqual(
      defaultRules
        .map((rule) => rule.id)
        .filter((id) => (LINT_RULE_IDS as readonly string[]).includes(id)),
    );
  });

  it("describes the plugin, its rule map and the file globs", () => {
    expect(plugin.meta).toEqual({ name: "@sidioralabs/rex/eslint", version: REX_VERSION });
    expect(Object.keys(plugin.rules ?? {})).toEqual(lintRules().map((rule) => rule.id));
    expect(rexRules).toEqual(
      Object.fromEntries(lintRules().map((rule) => [`rex/${rule.id}`, "error"])),
    );
    expect(LINT_FILES).toEqual(["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"]);
    expect(LINT_IGNORES).toEqual(["dist/**", ".rex/**"]);
    expect(config.map((entry) => entry.name)).toEqual(["rex/ignores", "rex/recommended"]);
    expect(config[1]?.files).toBe(LINT_FILES);
    expect(config[1]?.languageOptions?.parserOptions).toEqual({ ecmaFeatures: { jsx: true } });
  });

  it("wraps a checker rule as a problem rule carrying its description", () => {
    const wrapped = eslintRule(boundariesRule);
    expect(wrapped.meta).toEqual({
      type: "problem",
      docs: { description: boundariesRule.description },
      messages: { finding: "{{message}} [{{code}}] {{hint}}" },
      schema: [],
    });
    expect(typeof wrapped.create).toBe("function");
    expect(plugin.rules?.boundaries?.meta?.docs?.description).toBe(boundariesRule.description);
    expect(plugin.rules?.a11y?.meta?.docs?.description).toBe(a11yRule.description);
  });

  it("returns the checker findings for a file inside an app and none outside", () => {
    const avatar = path.join(root, AVATAR);
    const found = checkerFindings(avatar, boundariesRule);
    expect(found.length).toBeGreaterThan(0);
    for (const entry of found) {
      expect(entry.rule.startsWith("boundaries/")).toBe(true);
      expect(entry.file).toBe(AVATAR);
      expect(entry.line).toBe(1);
    }
    expect(checkerFindings(avatar, boundariesRule)).toBe(found);
    expect(checkerFindings(path.join(root, PAGE), boundariesRule)).toEqual([]);
    expect(checkerFindings(fileURLToPath(import.meta.url), boundariesRule)).toEqual([]);
  });

  it("recomputes the findings once the app tree changes", () => {
    const copy = copyFixture();
    const avatar = path.join(copy, AVATAR);
    const original = readFileSync(avatar, "utf8");
    expect(original.startsWith(SERVER_IMPORT)).toBe(true);
    const before = checkerFindings(avatar, boundariesRule);
    expect(before.map((entry) => entry.rule)).toContain("boundaries/no-fetch");

    writeFileSync(
      avatar,
      original.replace(SERVER_IMPORT, "").replace("typeof createRexServer", '"none"'),
    );
    expect(checkerFindings(avatar, boundariesRule)).toEqual([]);

    writeFileSync(avatar, original);
    const after = checkerFindings(avatar, boundariesRule);
    expect(after.map((entry) => [entry.rule, entry.line, entry.column])).toEqual(
      before.map((entry) => [entry.rule, entry.line, entry.column]),
    );
  });

  it("refuses an asynchronous checker rule when the lint runs", () => {
    const avatar = path.join(root, AVATAR);
    const linter = new Linter({ cwd: root });
    const flat = [
      ...config,
      {
        files: LINT_FILES,
        plugins: { "rex-async": { rules: { format: eslintRule(formatRule) } } },
        rules: { "rex-async/format": "error" as const },
      },
    ];
    expect(() => linter.verify(readFileSync(avatar, "utf8"), flat, { filename: avatar })).toThrow(
      /rex\/format: the checker rule returned a promise/,
    );
    const synchronous = linter.verify(readFileSync(avatar, "utf8"), config, { filename: avatar });
    expect(synchronous.map((message) => message.ruleId)).toContain("rex/boundaries");
  });
});
