import { format } from "prettier";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { SHELL_COMPONENT_NAMES } from "../../client/shell/components.ts";
import { REX_DATA_STATES, requiredStateExports } from "../../core/states.ts";
import { DESIGNX_ITEMS, DESIGNX_MAP, type DesignxItemName } from "../../designx/index.ts";
import { REX_VERSION } from "../../index.ts";
import { rexPrettierConfig } from "../../prettier.ts";
import type { PlannedEntry } from "../commands/make.ts";
import { HOME_PAGE, HOME_PART, NEW_APP_HOME, baseAppPlan } from "../commands/new.ts";
import {
  DESIGNX_CONFIG_FILE,
  DESIGNX_REGISTRY,
  DESIGNX_STYLESHEET_HREF,
  DESIGNX_THEME_FILE,
  DESIGNX_UI_DIR,
  TAILWIND_PACKAGES,
  TAILWIND_VERSION,
  designxConfig,
  designxDependencies,
  designxFiles,
  parseDesignxItem,
  type DesignxInstall,
  type DesignxItem,
} from "../designx.ts";
import { CLIENT_IMPORT, CORE_IMPORT, appPaths, configTemplate } from "../templates.ts";
import {
  DEFAULT_UI,
  DESIGNX_BUTTON,
  DESIGNX_CONFIG,
  DESIGNX_SHELL,
  designxButtonTemplate,
  designxGenerator,
  designxOf,
  designxPartPath,
  designxPartTemplate,
  designxShellTemplate,
  designxStatesPath,
  designxStatesTemplate,
  designxTemplatePaths,
  formatDesignxTemplates,
  isUiKit,
  withDesignxUi,
  type DesignxNewContext,
} from "./designx.ts";

const BUTTON_SOURCE = [
  'import type { ReactNode } from "react";',
  "",
  "export function Button(props: { readonly children?: ReactNode }) {",
  '  return <button type="button">{props.children}</button>;',
  "}",
  "",
].join("\n");
const THEME_SOURCE = ":root {\n  --radius: 0.5rem;\n}\n";

function registryItem(
  name: DesignxItemName,
  content: string,
  dependencies: readonly string[] = [],
): DesignxItem {
  const kind = DESIGNX_ITEMS[name];
  const type = `registry:${kind}`;
  const path =
    kind === "style" ? `styles/${name}.css` : `ui/${name}.${kind === "hook" ? "ts" : "tsx"}`;
  return parseDesignxItem({ name, type, dependencies, files: [{ path, type, content }] }, name);
}

function installOf(items: readonly DesignxItem[]): DesignxInstall {
  return {
    registry: DESIGNX_REGISTRY,
    items,
    provided: [],
    files: [
      ...designxFiles(items),
      { kind: "file", path: DESIGNX_CONFIG_FILE, content: designxConfig(items, DESIGNX_REGISTRY) },
    ],
    dependencies: designxDependencies(items),
    devDependencies: {},
  };
}

const install = installOf([
  registryItem("button", BUTTON_SOURCE, ["class-variance-authority@^0.7.1"]),
  registryItem("theme", THEME_SOURCE),
]);

function contextOf(designx: DesignxInstall | null): DesignxNewContext {
  return { name: "dx-app", ui: "designx", designx, home: NEW_APP_HOME };
}

function shape(code: string, fileName: string) {
  const output = ts.transpileModule(code, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
  });
  expect(
    (output.diagnostics ?? []).map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    ),
  ).toEqual([]);
  expect(code.endsWith("\n")).toBe(true);
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.ES2022, true);
  const named: string[] = [];
  const imports: string[] = [];
  let defaultName: string | null = null;
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      imports.push(statement.moduleSpecifier.text);
    }
    if (!ts.isFunctionDeclaration(statement) || statement.name === undefined) continue;
    const modifiers = ts.getModifiers(statement) ?? [];
    if (!modifiers.some((item) => item.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (modifiers.some((item) => item.kind === ts.SyntaxKind.DefaultKeyword)) {
      defaultName = statement.name.text;
    } else {
      named.push(statement.name.text);
    }
  }
  return { named, defaultName, imports };
}

function contentOf(plan: readonly PlannedEntry[], path: string): string {
  const entry = plan.find((candidate) => candidate.path === path);
  if (entry === undefined || entry.kind !== "file")
    throw new Error(`${path} is not a planned file`);
  return entry.content;
}

describe("designx kit constants and paths", () => {
  it("names the default kit and the files the designx kit replaces in the home page", () => {
    expect(DEFAULT_UI).toBe("designx");
    expect(DESIGNX_BUTTON).toBe("app/components/Button.tsx");
    expect(DESIGNX_SHELL).toBe("app/components/Shell.tsx");
    expect(DESIGNX_CONFIG).toBe("rex.config.ts");
    expect(designxStatesPath(NEW_APP_HOME)).toBe(appPaths.states(HOME_PAGE));
    expect(designxPartPath(NEW_APP_HOME)).toBe("app/pages/home/regions/welcome/parts/Welcome.tsx");
    expect(designxTemplatePaths(NEW_APP_HOME)).toEqual([
      DESIGNX_BUTTON,
      DESIGNX_SHELL,
      "app/pages/home/states.tsx",
      "app/pages/home/regions/welcome/parts/Welcome.tsx",
    ]);
    expect(() => designxPartPath({ page: "home", region: "welcome", part: "welcome" })).toThrow(
      /PascalCase/,
    );
  });

  it("isUiKit accepts the declared kits only", () => {
    expect(isUiKit("designx")).toBe(true);
    expect(isUiKit("none")).toBe(true);
    expect(isUiKit("bootstrap")).toBe(false);
    expect(isUiKit(42)).toBe(false);
    expect(isUiKit(undefined)).toBe(false);
  });

  it("designxOf finds the fetched install only for a designx context", () => {
    expect(designxOf({ name: "plain" })).toBeNull();
    const none: DesignxNewContext = {
      name: "plain",
      ui: "none",
      designx: null,
      home: NEW_APP_HOME,
    };
    expect(designxOf(none)).toBeNull();
    expect(designxOf(contextOf(install))).toBe(install);
    expect(() => designxOf(contextOf(null))).toThrow(
      "rex new: ui designx needs the DesignX registry items fetched first",
    );
  });

  it("withDesignxUi declares the kit and shell once after the app line", () => {
    const configured = withDesignxUi(configTemplate());
    expect(configured).toContain(
      '  app,\n  ui: { kit: "designx", components: "app/components/Shell.tsx" },\n',
    );
    expect(configured.split("ui:")).toHaveLength(2);
    expect(withDesignxUi(configured)).toBe(configured);
    expect(withDesignxUi("export default defineConfig({});\n")).toBe(
      "export default defineConfig({});\n",
    );
  });
});

describe("designx templates", () => {
  it("writes a shell exporting every shell component on the mapped DesignX items", () => {
    const shell = shape(designxShellTemplate(), DESIGNX_SHELL);
    expect(shell.named).toEqual(["Button", "Sheet", "PaletteItem", "Outcome", "Nav"]);
    for (const name of shell.named) expect(SHELL_COMPONENT_NAMES).toContain(name);
    expect(shell.defaultName).toBeNull();
    expect(shell.imports).toEqual([
      CLIENT_IMPORT,
      ...[
        DESIGNX_MAP.outcome.default,
        DESIGNX_MAP.badge.default,
        DESIGNX_MAP.button.default,
        DESIGNX_MAP.paletteItem.default,
        DESIGNX_MAP.sheet.dialog,
        DESIGNX_MAP.kbd.default,
        DESIGNX_MAP.nav.bar,
        DESIGNX_MAP.sheet["bottom-sheet"],
        DESIGNX_MAP.nav.sidebar,
        DESIGNX_MAP.nav.dock,
      ].map((item) => `./ui/${item}.tsx`),
    ]);
    expect(designxShellTemplate()).toContain("data-rex-nav={link.address}");
    expect(designxShellTemplate()).toContain("data-rex-sheet-form={form}");
  });

  it("writes states for every non-ready state on the mapped items with the page title", () => {
    const states = shape(designxStatesTemplate(HOME_PAGE), "states.tsx");
    expect(states.named).toEqual([...requiredStateExports(REX_DATA_STATES)]);
    expect(states.imports).toEqual([
      CORE_IMPORT,
      ...[
        DESIGNX_MAP.states["terminal-error"],
        DESIGNX_MAP.states.stale,
        DESIGNX_MAP.button.default,
        DESIGNX_MAP.states.empty,
        DESIGNX_MAP.states.loading,
      ].map((item) => `../../components/ui/${item}.tsx`),
    ]);
    const wallet = designxStatesTemplate("my-wallet");
    expect(wallet).toContain('aria-label="Loading my wallet"');
    expect(wallet).toContain("<EmptyTitle>Nothing in my wallet yet</EmptyTitle>");
    expect(wallet).toContain("<AlertTitle>My wallet is unavailable</AlertTitle>");
  });

  it("writes the home part and the Button wrapper on the DesignX primitives", () => {
    const part = shape(designxPartTemplate(HOME_PART), `${HOME_PART}.tsx`);
    expect(part.defaultName).toBe(HOME_PART);
    expect(part.named).toEqual([]);
    expect(part.imports).toEqual([
      "react",
      CLIENT_IMPORT,
      ...[
        DESIGNX_MAP.button.default,
        DESIGNX_MAP.region.default,
        DESIGNX_MAP.field.default,
        DESIGNX_MAP.input.default,
      ].map((item) => `../../../../../components/ui/${item}.tsx`),
    ]);
    const button = shape(designxButtonTemplate(), "Button.tsx");
    expect(button).toEqual({
      named: [],
      defaultName: "Button",
      imports: ["react", `./ui/${DESIGNX_MAP.button.default}.tsx`],
    });
  });
});

describe("designxGenerator", () => {
  const base = baseAppPlan("dx-app");
  const plan = designxGenerator.contribute(base, contextOf(install));
  const replaced = new Set([
    "package.json",
    "index.html",
    DESIGNX_CONFIG,
    DESIGNX_BUTTON,
    designxStatesPath(NEW_APP_HOME),
    designxPartPath(NEW_APP_HOME),
  ]);

  it("rewrites the base plan for the kit and appends the shell and the fetched files", () => {
    expect(designxGenerator.id).toBe("designx");
    expect(plan).toHaveLength(base.length + 1 + install.files.length);
    expect(plan.slice(base.length)).toEqual([
      { kind: "file", path: DESIGNX_SHELL, content: designxShellTemplate() },
      ...install.files,
    ]);
    const paths = plan.map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain(`${DESIGNX_UI_DIR}/button.tsx`);
    expect(paths).toContain(DESIGNX_THEME_FILE);
    expect(paths).toContain(DESIGNX_CONFIG_FILE);
    base.forEach((entry, index) => {
      const planned = plan[index];
      if (planned === undefined) throw new Error(`${entry.path} was dropped`);
      expect(planned.path).toBe(entry.path);
      expect(planned.kind).toBe(entry.kind);
      if (replaced.has(entry.path)) expect(planned).not.toBe(entry);
      else expect(planned).toBe(entry);
    });
  });

  it("adds the kit dependencies, stylesheet, ui config and home templates", () => {
    const manifest = JSON.parse(contentOf(plan, "package.json")) as {
      readonly dependencies: Readonly<Record<string, string>>;
    };
    expect(manifest.dependencies["class-variance-authority"]).toBe("^0.7.1");
    for (const name of TAILWIND_PACKAGES) {
      expect(manifest.dependencies[name], name).toBe(TAILWIND_VERSION);
    }
    expect(manifest.dependencies["@sidioralabs/rex"]).toBe(`^${REX_VERSION}`);
    expect(contentOf(plan, "index.html")).toContain(
      `<link rel="stylesheet" href="${DESIGNX_STYLESHEET_HREF}" />`,
    );
    expect(contentOf(plan, DESIGNX_CONFIG)).toBe(withDesignxUi(configTemplate()));
    expect(contentOf(plan, DESIGNX_BUTTON)).toBe(designxButtonTemplate());
    expect(contentOf(plan, designxStatesPath(NEW_APP_HOME))).toBe(designxStatesTemplate(HOME_PAGE));
    expect(contentOf(plan, designxPartPath(NEW_APP_HOME))).toBe(designxPartTemplate(HOME_PART));
    expect(contentOf(plan, DESIGNX_THEME_FILE)).toContain(THEME_SOURCE.trimEnd());
    expect(contentOf(plan, `${DESIGNX_UI_DIR}/button.tsx`)).toBe(BUTTON_SOURCE);
  });

  it("leaves the plan untouched without the designx kit and refuses an incomplete install", () => {
    expect(designxGenerator.contribute(base, { name: "dx-app" })).toBe(base);
    const none: DesignxNewContext = {
      name: "dx-app",
      ui: "none",
      designx: null,
      home: NEW_APP_HOME,
    };
    expect(designxGenerator.contribute(base, none)).toBe(base);
    expect(() => designxGenerator.contribute(base, contextOf(null))).toThrow(
      "rex new: ui designx needs the DesignX registry items fetched first",
    );
    const withoutConfig: DesignxInstall = {
      ...install,
      files: install.files.filter((file) => file.path !== DESIGNX_CONFIG_FILE),
    };
    expect(() => designxGenerator.contribute(base, contextOf(withoutConfig))).toThrow(
      `rex new: the DesignX install has no ${DESIGNX_CONFIG_FILE}`,
    );
  });

  it("formatDesignxTemplates formats only the kit templates with the rex prettier preset", async () => {
    const formatted = await formatDesignxTemplates(plan, NEW_APP_HOME);
    expect(formatted.map((entry) => entry.path)).toEqual(plan.map((entry) => entry.path));
    const targets = new Set(designxTemplatePaths(NEW_APP_HOME));
    const changed: string[] = [];
    for (const [index, entry] of plan.entries()) {
      const result = formatted[index];
      if (result === undefined) throw new Error(`${entry.path} was dropped`);
      if (entry.kind !== "file" || !targets.has(entry.path)) {
        expect(result).toBe(entry);
        continue;
      }
      changed.push(entry.path);
      if (result.kind !== "file") throw new Error(`${entry.path} is no longer a file`);
      const options = { ...rexPrettierConfig, filepath: entry.path };
      expect(result.content).toBe(await format(entry.content, options));
      expect(await format(result.content, options)).toBe(result.content);
    }
    expect(changed.sort()).toEqual([...targets].sort());
  });
});
