import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { REX_PACKAGE } from "../commands/new.ts";
import type { PlannedEntry } from "../commands/make.ts";
import type { RexNewGenerator } from "../generators.ts";

export const ESLINT_CONFIG_FILE = "eslint.config.js";
export const PRETTIER_CONFIG_FILE = ".prettierrc";
export const PRETTIER_IGNORE_FILE = ".prettierignore";

export const LINT_DEV_DEPENDENCIES = [
  "@typescript-eslint/parser",
  "eslint",
  "eslint-plugin-jsx-a11y",
  "prettier",
] as const;

export const LINT_SCRIPTS: Readonly<Record<string, string>> = {
  lint: "eslint .",
  format: "prettier --write .",
};

export const PRETTIER_IGNORED = ["dist", ".rex", "AGENTS.md"] as const;

interface PackageJson {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export function lintDependencyVersions(): Readonly<Record<string, string>> {
  const rex = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as PackageJson;
  return Object.fromEntries(
    LINT_DEV_DEPENDENCIES.map((name) => {
      const version = rex.devDependencies?.[name] ?? rex.peerDependencies?.[name];
      if (version === undefined) {
        throw new Error(`rex new: ${REX_PACKAGE} does not pin a version of ${name}`);
      }
      return [name, version];
    }),
  );
}

function sorted(record: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

export function eslintConfigTemplate(): string {
  return [`import rex from "${REX_PACKAGE}/eslint";`, "", "export default rex;", ""].join("\n");
}

export function prettierConfigTemplate(): string {
  return `${JSON.stringify(`${REX_PACKAGE}/prettier`)}\n`;
}

export function prettierIgnoreTemplate(): string {
  return `${PRETTIER_IGNORED.join("\n")}\n`;
}

export function withLintPackage(packageJson: string): string {
  const manifest = JSON.parse(packageJson) as PackageJson;
  const next: PackageJson = {
    ...manifest,
    scripts: { ...manifest.scripts, ...LINT_SCRIPTS },
    devDependencies: sorted({ ...manifest.devDependencies, ...lintDependencyVersions() }),
  };
  return `${JSON.stringify(next, null, 2)}\n`;
}

export const lintGenerator: RexNewGenerator = {
  id: "lint",
  contribute(plan): readonly PlannedEntry[] {
    if (!plan.some((entry) => entry.kind === "file" && entry.path === "package.json")) {
      throw new Error("rex new: the lint generator needs package.json in the plan");
    }
    return [
      ...plan.map((entry) =>
        entry.kind === "file" && entry.path === "package.json"
          ? { ...entry, content: withLintPackage(entry.content) }
          : entry,
      ),
      { kind: "file", path: ESLINT_CONFIG_FILE, content: eslintConfigTemplate() },
      { kind: "file", path: PRETTIER_CONFIG_FILE, content: prettierConfigTemplate() },
      { kind: "file", path: PRETTIER_IGNORE_FILE, content: prettierIgnoreTemplate() },
    ];
  },
};
