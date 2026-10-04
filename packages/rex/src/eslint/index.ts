import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import * as typescriptParser from "@typescript-eslint/parser";
import type { ESLint, Linter, Rule as ESLintRule } from "eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import { discoverApp, type RexApp } from "../check/engine.ts";
import { createSourceLoader, type Finding, type Rule, type SourceLoader } from "../check/rule.ts";
import { defaultRules } from "../check/rules/index.ts";
import { REX_VERSION } from "../index.ts";

export const LINT_RULE_IDS = ["boundaries", "naming", "traps", "tokens", "a11y", "media"] as const;

export type LintRuleId = (typeof LINT_RULE_IDS)[number];

export const LINT_FILES = ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"];

export const LINT_IGNORES = ["dist/**", ".rex/**"];

const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist"]);

interface Snapshot {
  readonly signature: string;
  readonly app: RexApp;
  readonly sources: SourceLoader;
  readonly findings: Map<string, ReadonlyMap<string, readonly Finding[]>>;
}

const snapshots = new Map<string, Snapshot>();

function isDirectory(candidate: string): boolean {
  try {
    return statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

export function lintRules(rules: readonly Rule[] = defaultRules): readonly Rule[] {
  return rules.filter((rule) => (LINT_RULE_IDS as readonly string[]).includes(rule.id));
}

export function findAppRoot(file: string): string | null {
  let dir = path.dirname(path.resolve(file));
  for (;;) {
    if (path.basename(dir) === "app" && isDirectory(path.join(dir, "pages"))) {
      return path.dirname(dir);
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function treeSignature(root: string): string {
  const entries: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || SKIPPED_DIRECTORIES.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) {
        const stat = statSync(full);
        entries.push(`${full}\t${stat.size}\t${stat.mtimeMs}\t${stat.ctimeMs}`);
      }
    }
  };
  visit(root);
  for (const config of readdirSync(root, { withFileTypes: true })) {
    if (config.isFile() && config.name.startsWith(".")) {
      const stat = statSync(path.join(root, config.name));
      entries.push(`${config.name}\t${stat.size}\t${stat.mtimeMs}\t${stat.ctimeMs}`);
    }
  }
  return entries.sort().join("\n");
}

function snapshotOf(root: string): Snapshot {
  const signature = treeSignature(root);
  const cached = snapshots.get(root);
  if (cached !== undefined && cached.signature === signature) return cached;
  const snapshot: Snapshot = {
    signature,
    app: discoverApp(root),
    sources: createSourceLoader(),
    findings: new Map(),
  };
  snapshots.set(root, snapshot);
  return snapshot;
}

function findingsByFile(snapshot: Snapshot, rule: Rule): ReadonlyMap<string, readonly Finding[]> {
  const cached = snapshot.findings.get(rule.id);
  if (cached !== undefined) return cached;
  const produced = rule.check({ app: snapshot.app, sources: snapshot.sources });
  if (produced instanceof Promise) {
    throw new TypeError(
      `rex/${rule.id}: the checker rule returned a promise; ESLint rules run synchronously, so only synchronous checker rules can be linted`,
    );
  }
  const grouped = new Map<string, Finding[]>();
  for (const entry of produced) {
    const file = path.resolve(snapshot.app.root, entry.file);
    const group = grouped.get(file);
    if (group) group.push(entry);
    else grouped.set(file, [entry]);
  }
  snapshot.findings.set(rule.id, grouped);
  return grouped;
}

function matchesDisk(file: string, text: string): boolean {
  let disk: string;
  try {
    disk = readFileSync(file, "utf8");
  } catch {
    return false;
  }
  return disk.replace(/^﻿/, "") === text;
}

export function checkerFindings(file: string, rule: Rule): readonly Finding[] {
  const absolute = path.resolve(file);
  const root = findAppRoot(absolute);
  if (root === null) return [];
  return findingsByFile(snapshotOf(root), rule).get(absolute) ?? [];
}

export function eslintRule(rule: Rule): ESLintRule.RuleModule {
  return {
    meta: {
      type: "problem",
      docs: { description: rule.description },
      messages: { finding: "{{message}} [{{code}}] {{hint}}" },
      schema: [],
    },
    create(context) {
      return {
        Program() {
          const file = path.resolve(context.physicalFilename);
          if (!matchesDisk(file, context.sourceCode.text)) return;
          for (const entry of checkerFindings(file, rule)) {
            context.report({
              loc: { line: entry.line, column: entry.column - 1 },
              messageId: "finding",
              data: { message: entry.message, code: entry.rule, hint: entry.hint },
            });
          }
        },
      };
    },
  };
}

export const plugin: ESLint.Plugin = {
  meta: { name: "@sidioralabs/rex/eslint", version: REX_VERSION },
  rules: Object.fromEntries(lintRules().map((rule) => [rule.id, eslintRule(rule)])),
};

export const rexRules: Linter.RulesRecord = Object.fromEntries(
  lintRules().map((rule) => [`rex/${rule.id}`, "error"]),
);

export const config: Linter.Config[] = [
  { name: "rex/ignores", ignores: LINT_IGNORES },
  {
    name: "rex/recommended",
    files: LINT_FILES,
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { rex: plugin, "jsx-a11y": jsxA11y },
    rules: { ...jsxA11y.flatConfigs.recommended.rules, ...rexRules },
  },
];

export default config;
