import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { afterAll, describe, expect, it } from "vitest";
import { discoverApp, runRules } from "../check/engine.ts";
import { boundariesRule } from "../check/rules/boundaries.ts";
import { a11yRule } from "../check/rules/a11y.ts";
import { FORMAT_CODE, formatRule } from "../check/rules/format.ts";
import { defaultRules } from "../check/rules/index.ts";
import { runGenerators } from "../cli/generators.ts";
import {
  ESLINT_CONFIG_FILE,
  LINT_DEV_DEPENDENCIES,
  PRETTIER_CONFIG_FILE,
  lintGenerator,
} from "../cli/gen/lint.ts";
import rexPrettier from "../prettier.ts";
import rexConfig, { LINT_RULE_IDS, config, findAppRoot, lintRules, plugin } from "./index.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/lint");
const pageDir = path.join(root, "app/pages/profile");
const avatar = path.join(pageDir, "regions/card/parts/Avatar.tsx");
const region = path.join(pageDir, "regions/card/region.tsx");
const view = path.join(pageDir, "view.tsx");
const pageFile = path.join(pageDir, "page.ts");
const IMG_LINE = 10;

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function eslint(cwd: string = root): ESLint {
  return new ESLint({ cwd, overrideConfigFile: true, overrideConfig: config });
}

async function lintFixture(): Promise<Map<string, ESLint.LintResult>> {
  const results = await eslint().lintFiles(["app"]);
  return new Map(results.map((result) => [result.filePath, result]));
}

function resultOf(results: Map<string, ESLint.LintResult>, file: string): ESLint.LintResult {
  const result = results.get(file);
  if (result === undefined) throw new Error(`ESLint did not lint ${file}`);
  return result;
}

describe("rex/eslint plugin and flat config", () => {
  it("exposes one ESLint rule per present checker rule among the lint rule ids", () => {
    expect([...LINT_RULE_IDS]).toEqual([
      "boundaries",
      "naming",
      "traps",
      "tokens",
      "a11y",
      "media",
    ]);
    const ids = lintRules().map((rule) => rule.id);
    expect(ids).toEqual(
      defaultRules
        .map((rule) => rule.id)
        .filter((id) => (LINT_RULE_IDS as readonly string[]).includes(id)),
    );
    for (const id of ["boundaries", "naming", "traps", "tokens", "a11y"]) expect(ids).toContain(id);
    expect(ids).not.toContain("format");
    expect(ids).not.toContain("typecheck");
    expect(Object.keys(plugin.rules ?? {})).toEqual(ids);
  });

  it("default-exports the flat config enabling the rex rules and jsx-a11y recommended", () => {
    expect(rexConfig).toBe(config);
    const recommended = config.find((entry) => entry.name === "rex/recommended");
    expect(recommended?.plugins?.rex).toBe(plugin);
    expect(recommended?.plugins?.["jsx-a11y"]).toBeDefined();
    for (const rule of lintRules()) expect(recommended?.rules?.[`rex/${rule.id}`]).toBe("error");
    expect(recommended?.rules?.["jsx-a11y/alt-text"]).toBe("error");
    expect(config.find((entry) => entry.name === "rex/ignores")?.ignores).toEqual([
      "dist/**",
      ".rex/**",
    ]);
  });

  it("finds the app root from any file under app/ and nothing outside an app", () => {
    expect(findAppRoot(avatar)).toBe(root);
    expect(findAppRoot(pageFile)).toBe(root);
    expect(findAppRoot(fileURLToPath(import.meta.url))).toBeNull();
  });
});

describe("ESLint on the fixture app", () => {
  it("reports the boundary violation and the a11y violation in the part", async () => {
    const results = await lintFixture();
    const messages = resultOf(results, avatar).messages;
    const summary = messages.map((message) => [message.ruleId, message.line]);
    expect(summary).toContainEqual(["rex/boundaries", 1]);
    expect(summary).toContainEqual(["rex/a11y", IMG_LINE]);
    expect(summary).toContainEqual(["jsx-a11y/alt-text", IMG_LINE]);

    const boundary = messages.find((message) => message.ruleId === "rex/boundaries");
    expect(boundary?.severity).toBe(2);
    expect(boundary?.column).toBe(1);
    expect(boundary?.message).toContain("[boundaries/no-fetch]");
    expect(boundary?.message).toContain('"@sidioralabs/rex/server"');

    const alt = messages.find((message) => message.ruleId === "rex/a11y");
    expect(alt?.severity).toBe(2);
    expect(alt?.message).toContain("[a11y/img-alt]");
  });

  it("reports exactly the checker findings for the linted file", async () => {
    const results = await lintFixture();
    const app = discoverApp(root);
    for (const rule of [boundariesRule, a11yRule]) {
      const checked = (await runRules(app, [rule])).findings.filter(
        (entry) => path.resolve(root, entry.file) === avatar,
      );
      const linted = resultOf(results, avatar).messages.filter(
        (message) => message.ruleId === `rex/${rule.id}`,
      );
      expect(linted.map((message) => [message.line, message.column])).toEqual(
        checked.map((entry) => [entry.line, entry.column]),
      );
      expect(linted.length).toBeGreaterThan(0);
    }
  });

  it("leaves conforming files clean", async () => {
    const results = await lintFixture();
    for (const file of [pageFile, view, region]) {
      expect(resultOf(results, file).messages).toEqual([]);
    }
    expect(results.size).toBe(4);
  });

  it("lints an unsaved buffer with jsx-a11y only, since the checker reads saved files", async () => {
    const edited = readFileSync(avatar, "utf8").replace("<figure", "<figure  ");
    const [result] = await eslint().lintText(edited, { filePath: avatar });
    const rules = (result?.messages ?? []).map((message) => message.ruleId);
    expect(rules).toContain("jsx-a11y/alt-text");
    expect(rules.filter((rule) => rule?.startsWith("rex/"))).toEqual([]);
  });
});

describe("format preset and the format/prettier checker rule", () => {
  it("runs prettier in check mode as a registered checker rule", async () => {
    expect(defaultRules).toContain(formatRule);
    expect(rexPrettier.printWidth).toBe(100);
    const clean = await runRules(discoverApp(root), [formatRule]);
    expect(clean.findings).toEqual([]);
  });

  it("reports a file prettier would rewrite at the first changed line", async () => {
    const copy = mkdtempSync(path.join(tmpdir(), "rex-format-"));
    temporary.push(copy);
    cpSync(root, copy, { recursive: true });
    const target = path.join(copy, "app/pages/profile/page.ts");
    writeFileSync(
      target,
      'import { page } from "@sidioralabs/rex";\n\nexport default page( "profile", { route: "/profile", regions: ["card"] } );\n',
    );
    const result = await runRules(discoverApp(copy), [formatRule]);
    expect(
      result.findings.map((entry) => [entry.rule, entry.file, entry.line, entry.severity]),
    ).toEqual([[FORMAT_CODE, "app/pages/profile/page.ts", 3, "warning"]]);
  });
});

describe("rex new lint generator", () => {
  it("writes eslint.config.js, .prettierrc and the lint and format scripts", () => {
    const plan = runGenerators({ name: "notes" });
    const files = new Map(
      plan.flatMap((entry) => (entry.kind === "file" ? [[entry.path, entry.content]] : [])),
    );
    expect(files.get(ESLINT_CONFIG_FILE)).toBe(
      'import rex from "@sidioralabs/rex/eslint";\n\nexport default rex;\n',
    );
    expect(JSON.parse(files.get(PRETTIER_CONFIG_FILE) ?? "null")).toBe("@sidioralabs/rex/prettier");
    const manifest = JSON.parse(files.get("package.json") ?? "{}") as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(manifest.scripts.lint).toBe("eslint .");
    expect(manifest.scripts.format).toBe("prettier --write .");
    for (const name of LINT_DEV_DEPENDENCIES) {
      expect(manifest.devDependencies[name]).toMatch(/^\^\d+\.\d+\.\d+$/);
    }
    expect(() => lintGenerator.contribute([], { name: "notes" })).toThrow(/package\.json/);
  });
});
