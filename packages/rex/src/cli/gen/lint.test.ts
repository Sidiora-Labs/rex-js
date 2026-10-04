import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { PlannedEntry } from "../commands/make.ts";
import { REX_PACKAGE, baseAppPlan } from "../commands/new.ts";
import {
  ESLINT_CONFIG_FILE,
  LINT_DEV_DEPENDENCIES,
  LINT_SCRIPTS,
  PRETTIER_CONFIG_FILE,
  PRETTIER_IGNORED,
  PRETTIER_IGNORE_FILE,
  eslintConfigTemplate,
  lintDependencyVersions,
  lintGenerator,
  prettierConfigTemplate,
  prettierIgnoreTemplate,
  withLintPackage,
} from "./lint.ts";

const here = dirname(fileURLToPath(import.meta.url));
const rexPackage = JSON.parse(
  readFileSync(join(here, "..", "..", "..", "package.json"), "utf8"),
) as {
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
};

interface Manifest {
  readonly name?: string;
  readonly scripts?: Readonly<Record<string, string>>;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

describe("lintDependencyVersions", () => {
  it("pins every lint dev dependency to the version the rex package declares", () => {
    const versions = lintDependencyVersions();
    expect(Object.keys(versions)).toEqual([...LINT_DEV_DEPENDENCIES]);
    for (const name of LINT_DEV_DEPENDENCIES) {
      expect(versions[name], name).toBe(
        rexPackage.devDependencies[name] ?? rexPackage.peerDependencies[name],
      );
      expect(versions[name], name).toMatch(/^\^\d+\.\d+\.\d+$/);
    }
  });
});

describe("lint config templates", () => {
  it("point the app at the rex eslint and prettier presets", () => {
    expect(ESLINT_CONFIG_FILE).toBe("eslint.config.js");
    expect(PRETTIER_CONFIG_FILE).toBe(".prettierrc");
    expect(PRETTIER_IGNORE_FILE).toBe(".prettierignore");
    expect(eslintConfigTemplate()).toBe(
      `import rex from "${REX_PACKAGE}/eslint";\n\nexport default rex;\n`,
    );
    expect(prettierConfigTemplate()).toBe(`"${REX_PACKAGE}/prettier"\n`);
    expect(JSON.parse(prettierConfigTemplate())).toBe(`${REX_PACKAGE}/prettier`);
    expect(prettierIgnoreTemplate()).toBe("dist\n.rex\nAGENTS.md\n");
    expect(prettierIgnoreTemplate().trimEnd().split("\n")).toEqual([...PRETTIER_IGNORED]);
  });
});

describe("withLintPackage", () => {
  it("adds the lint and format scripts and the sorted dev dependencies to a manifest", () => {
    const input = JSON.stringify(
      {
        name: "notes-app",
        scripts: { dev: "rex dev", lint: "custom" },
        dependencies: { react: "^19.0.0" },
        devDependencies: { typescript: "^5.9.3", eslint: "^1.0.0" },
      },
      null,
      2,
    );
    const output = withLintPackage(input);
    expect(output.endsWith("\n")).toBe(true);
    const manifest = JSON.parse(output) as Required<Manifest>;
    expect(manifest.name).toBe("notes-app");
    expect(manifest.dependencies).toEqual({ react: "^19.0.0" });
    expect(manifest.scripts).toEqual({
      dev: "rex dev",
      lint: "eslint .",
      format: "prettier --write .",
    });
    expect(manifest.scripts).toMatchObject(LINT_SCRIPTS);
    const versions = lintDependencyVersions();
    expect(manifest.devDependencies).toEqual({ ...versions, typescript: "^5.9.3" });
    expect(manifest.devDependencies.eslint).toBe(versions.eslint);
    const keys = Object.keys(manifest.devDependencies);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
    expect(keys.indexOf("eslint")).toBeLessThan(keys.indexOf("typescript"));
  });

  it("creates the scripts and dev dependencies of a manifest that has none", () => {
    expect(JSON.parse(withLintPackage('{"name":"bare"}')) as Manifest).toEqual({
      name: "bare",
      scripts: LINT_SCRIPTS,
      devDependencies: lintDependencyVersions(),
    });
  });
});

describe("lintGenerator", () => {
  it("rewrites package.json in place and appends the three lint files", () => {
    const base = baseAppPlan("lint-app");
    const plan = lintGenerator.contribute(base, { name: "lint-app" });
    expect(lintGenerator.id).toBe("lint");
    expect(plan).toHaveLength(base.length + 3);
    expect(plan.slice(-3)).toEqual([
      { kind: "file", path: ESLINT_CONFIG_FILE, content: eslintConfigTemplate() },
      { kind: "file", path: PRETTIER_CONFIG_FILE, content: prettierConfigTemplate() },
      { kind: "file", path: PRETTIER_IGNORE_FILE, content: prettierIgnoreTemplate() },
    ]);
    base.forEach((entry, index) => {
      const planned = plan[index];
      if (entry.kind === "file" && entry.path === "package.json") {
        expect(planned).toEqual({ ...entry, content: withLintPackage(entry.content) });
        if (planned === undefined || planned.kind !== "file") throw new Error("no package.json");
        const manifest = JSON.parse(planned.content) as Required<Manifest>;
        expect(manifest.scripts.lint).toBe("eslint .");
        expect(manifest.scripts.dev).toBe("rex dev");
        expect(manifest.devDependencies.prettier).toBe(lintDependencyVersions().prettier);
      } else {
        expect(planned).toBe(entry);
      }
    });
  });

  it("needs package.json as a planned file", () => {
    const without: readonly PlannedEntry[] = [
      { kind: "dir", path: "app" },
      { kind: "file", path: "index.html", content: "<!doctype html>\n" },
    ];
    expect(() => lintGenerator.contribute(without, { name: "x" })).toThrow(
      "rex new: the lint generator needs package.json in the plan",
    );
    expect(() =>
      lintGenerator.contribute([{ kind: "dir", path: "package.json" }], { name: "x" }),
    ).toThrow(/needs package.json/);
  });
});
