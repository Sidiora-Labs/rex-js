import { describe, expect, it } from "vitest";
import type { PlannedEntry } from "./commands/make.ts";
import { baseAppPlan, newAppPlan } from "./commands/new.ts";
import { DESIGNX_SHELL, designxGenerator } from "./gen/designx.ts";
import { DEFAULT_APP_LOCALE, i18nGenerator, localeFilePath } from "./gen/i18n.ts";
import { ESLINT_CONFIG_FILE, lintGenerator } from "./gen/lint.ts";
import {
  REX_NEW_GENERATORS,
  appGenerator,
  runGenerators,
  type RexNewContext,
  type RexNewGenerator,
} from "./generators.ts";

const APP_FILES = [
  ".prettierignore",
  ".prettierrc",
  "app/actions/ping.ts",
  "app/components/Button.tsx",
  "app/data/notes.ts",
  "app/entities/note.ts",
  "app/locales/en.json",
  "app/pages/home/hooks/useNotes.ts",
  "app/pages/home/page.ts",
  "app/pages/home/regions/welcome/parts/Welcome.tsx",
  "app/pages/home/regions/welcome/region.tsx",
  "app/pages/home/states.tsx",
  "app/pages/home/view.tsx",
  "app/policies/viewer.ts",
  "eslint.config.js",
  "index.html",
  "package.json",
  "rex.config.ts",
  "tsconfig.json",
];

const writer: RexNewGenerator = {
  id: "writer",
  contribute: (plan, context) => [
    ...plan,
    { kind: "file", path: `${context.name}.txt`, content: "a" },
  ],
};

const suffixer: RexNewGenerator = {
  id: "suffixer",
  contribute: (plan) =>
    plan.map((entry) =>
      entry.kind === "file" ? { ...entry, content: `${entry.content}b` } : entry,
    ),
};

describe("appGenerator and REX_NEW_GENERATORS", () => {
  it("appends the base app plan after whatever came before", () => {
    const context: RexNewContext = { name: "notes-app" };
    const before: PlannedEntry = { kind: "dir", path: "docs" };
    const plan = appGenerator.contribute([before], context);
    expect(appGenerator.id).toBe("app");
    expect(plan[0]).toBe(before);
    expect(plan.slice(1)).toEqual(baseAppPlan("notes-app"));
  });

  it("runs app, designx, i18n and lint in that order", () => {
    expect(REX_NEW_GENERATORS.map((generator) => generator.id)).toEqual([
      "app",
      "designx",
      "i18n",
      "lint",
    ]);
    expect(REX_NEW_GENERATORS[0]).toBe(appGenerator);
    expect(REX_NEW_GENERATORS[1]).toBe(designxGenerator);
    expect(REX_NEW_GENERATORS[2]).toBe(i18nGenerator);
    expect(REX_NEW_GENERATORS[3]).toBe(lintGenerator);
  });
});

describe("runGenerators", () => {
  it("produces the complete rex new plan for a plain app", () => {
    const plan = runGenerators({ name: "notes-app" });
    expect(plan).toEqual(newAppPlan("notes-app"));
    const paths = plan.map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(
      plan
        .filter((entry) => entry.kind === "file")
        .map((entry) => entry.path)
        .sort(),
    ).toEqual(APP_FILES);
    expect(plan.filter((entry) => entry.kind === "dir").map((entry) => entry.path)).toEqual([
      "app/pages/home/test",
    ]);
    expect(paths).not.toContain(DESIGNX_SHELL);
    expect(paths.indexOf("package.json")).toBeLessThan(
      paths.indexOf(localeFilePath(DEFAULT_APP_LOCALE)),
    );
    expect(paths.indexOf(localeFilePath(DEFAULT_APP_LOCALE))).toBeLessThan(
      paths.indexOf(ESLINT_CONFIG_FILE),
    );
  });

  it("threads the plan through the given generators in order", () => {
    expect(runGenerators({ name: "demo" }, [writer, suffixer])).toEqual([
      { kind: "file", path: "demo.txt", content: "ab" },
    ]);
    expect(runGenerators({ name: "demo" }, [suffixer, writer])).toEqual([
      { kind: "file", path: "demo.txt", content: "a" },
    ]);
    expect(runGenerators({ name: "demo" }, [])).toEqual([]);
  });

  it("refuses a plan in which two generators write the same path", () => {
    expect(() => runGenerators({ name: "demo" }, [writer, writer])).toThrow(
      "rex new: two generators write demo.txt",
    );
    expect(() => runGenerators({ name: "demo" }, [appGenerator, appGenerator])).toThrow(
      "rex new: two generators write package.json",
    );
  });
});
