import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
import { defaultRules, runCheck } from "../check/index.ts";
import { boundariesRule } from "../check/rules/boundaries.ts";
import { REX_VERSION } from "../index.ts";
import { REX_DATA_STATES, STATE_EXPORT_NAMES, type StateProps } from "../core/states.ts";
import { SHELL_COMPONENT_NAMES } from "../client/shell/components.ts";
import { DESIGNX_MAP } from "../designx/index.ts";
import { DESIGNX_SHELL } from "./gen/designx.ts";
import { EXIT_FAILURE, EXIT_OK, EXIT_USAGE, run, type RexCliIO } from "./index.ts";
import { APP_PEERS, appModuleTypesPath } from "./commands/new.ts";
import {
  DESIGNX_BASE,
  DESIGNX_CONFIG_FILE,
  DESIGNX_STYLESHEET_HREF,
  DESIGNX_THEME_FILE,
  DESIGNX_UI_DIR,
  TAILWIND_PACKAGES,
} from "./designx.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const demoRoot = join(packageRoot, "..", "..", "examples", "demo");
const NEW_TEST_TIMEOUT_MS = 240_000;

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

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "rex-new-"));
  temporary.push(dir);
  return dir;
}

function captureIO(cwd: string) {
  const out: string[] = [];
  const err: string[] = [];
  const io: RexCliIO = {
    cwd,
    out: (text) => {
      out.push(text);
    },
    err: (text) => {
      err.push(text);
    },
  };
  return { io, out: () => out.join(""), err: () => err.join("") };
}

function listFiles(root: string, dir = root, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listFiles(root, full, found);
    else found.push(relative(root, full).split("\\").join("/"));
  }
  return found.sort();
}

interface GeneratedPackage {
  readonly name: string;
  readonly type: string;
  readonly scripts: Readonly<Record<string, string>>;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function installDependencies(root: string): void {
  const manifest = readJson<GeneratedPackage>(join(root, "package.json"));
  for (const name of [
    ...Object.keys(manifest.dependencies),
    ...Object.keys(manifest.devDependencies),
  ]) {
    const source =
      name === "@sidioralabs/rex" ? packageRoot : join(packageRoot, "node_modules", name);
    expect(existsSync(source), `${name} is resolvable from the rex package`).toBe(true);
    const destination = join(root, "node_modules", name);
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(realpathSync(source), destination, "dir");
  }
}

function linkFromWorkspace(root: string): void {
  const manifest = readJson<GeneratedPackage>(join(root, "package.json"));
  for (const name of [
    ...Object.keys(manifest.dependencies),
    ...Object.keys(manifest.devDependencies),
  ]) {
    const source =
      name === "@sidioralabs/rex"
        ? packageRoot
        : [packageRoot, demoRoot]
            .map((base) => join(base, "node_modules", name))
            .find((candidate) => existsSync(candidate));
    expect(source, `${name} is installed for the rex package or the demo`).toBeDefined();
    const destination = join(root, "node_modules", name);
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(realpathSync(source ?? ""), destination, "dir");
  }
}

function stateSlot(state: string): string {
  const item = DESIGNX_MAP.states[state as keyof typeof DESIGNX_MAP.states];
  return `data-slot="${item}"`;
}

async function generate(name: string): Promise<{ cwd: string; root: string; out: string }> {
  const cwd = tempDir();
  const captured = captureIO(cwd);
  expect(await run(["new", name, "--ui", "none"], captured.io)).toBe(EXIT_OK);
  expect(captured.err()).toBe("");
  return { cwd, root: join(cwd, name), out: captured.out() };
}

describe("rex new", { timeout: NEW_TEST_TIMEOUT_MS }, () => {
  it("writes a complete app that passes rex check with zero findings", async () => {
    const { root, out } = await generate("notes-app");
    expect(listFiles(root)).toEqual(APP_FILES);
    expect(existsSync(join(root, "app/pages/home/test"))).toBe(true);
    expect(out).toContain("wrote notes-app/package.json\n");
    expect(out).toContain("wrote notes-app/app/pages/home/page.ts\n");
    expect(out).toContain("wrote notes-app/app/pages/home/test/\n");

    const manifest = readJson<GeneratedPackage>(join(root, "package.json"));
    expect(manifest.name).toBe("notes-app");
    expect(manifest.type).toBe("module");
    expect(manifest.dependencies["@sidioralabs/rex"]).toBe(`^${REX_VERSION}`);
    expect(Object.keys(manifest.dependencies).sort()).toEqual(
      ["@sidioralabs/rex", ...APP_PEERS].sort(),
    );
    expect(manifest.dependencies.zod).toBeDefined();
    expect(manifest.scripts).toMatchObject({
      dev: "rex dev",
      build: "rex build",
      check: "rex check",
      manifest: "rex manifest",
    });

    const tsconfig = readJson<{ include: string[] }>(join(root, "tsconfig.json"));
    expect(tsconfig.include).toEqual(["app", "rex.config.ts", appModuleTypesPath()]);
    expect(appModuleTypesPath()).toBe("node_modules/@sidioralabs/rex/src/vite/rex-app.d.ts");

    const config = readFileSync(join(root, "rex.config.ts"), "utf8");
    expect(config).toContain('import app from "rex:app";');
    expect(config).toContain('import { defineConfig } from "@sidioralabs/rex/config";');
    const entityFile = readFileSync(join(root, "app/entities/note.ts"), "utf8");
    expect(entityFile).toContain('import { entity } from "@sidioralabs/rex";');
    expect(entityFile).toContain('import { id, text } from "@sidioralabs/rex/schema";');
    const actionFile = readFileSync(join(root, "app/actions/ping.ts"), "utf8");
    expect(actionFile).toContain('import { boolean } from "@sidioralabs/rex/schema";');
    expect(actionFile).toContain('import { z } from "zod/mini";');
    expect(readFileSync(join(root, "index.html"), "utf8")).toContain(
      '<script type="module" src="/@rex/entry"></script>',
    );
    const page = readFileSync(join(root, "app/pages/home/page.ts"), "utf8");
    expect(page).toContain('export default page("home", {');
    expect(page).toContain('route: "/",');
    expect(page).toContain("actions: [ping],");
    expect(page).toContain('regions: ["welcome"],');

    installDependencies(root);
    expect(existsSync(join(root, appModuleTypesPath()))).toBe(true);
    const result = await runCheck(root);
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe("No findings.\n");
  });

  it("refuses an existing non-empty folder and an invalid name", async () => {
    const cwd = tempDir();
    mkdirSync(join(cwd, "taken"));
    writeFileSync(join(cwd, "taken", "keep.txt"), "mine\n");
    const taken = captureIO(cwd);
    expect(await run(["new", "taken"], taken.io)).toBe(EXIT_FAILURE);
    expect(taken.err()).toContain("refusing to write into taken");
    expect(readdirSync(join(cwd, "taken"))).toEqual(["keep.txt"]);

    const invalid = captureIO(cwd);
    expect(await run(["new", "My_App"], invalid.io)).toBe(EXIT_USAGE);
    expect(invalid.err()).toContain("app name");
    expect(existsSync(join(cwd, "My_App"))).toBe(false);

    mkdirSync(join(cwd, "empty"));
    const empty = captureIO(cwd);
    expect(await run(["new", "empty", "--ui", "none"], empty.io)).toBe(EXIT_OK);
    expect(listFiles(join(cwd, "empty"))).toEqual(APP_FILES);
  });

  it("installs the DesignX standard set by default and generates the shell, states and first region on it", async () => {
    const cwd = tempDir();
    const captured = captureIO(cwd);
    expect(await run(["new", "dx-app", "--no-install"], captured.io)).toBe(EXIT_OK);
    expect(captured.err()).toBe("");
    const root = join(cwd, "dx-app");
    const files = listFiles(root);
    for (const name of DESIGNX_BASE) expect(files).toContain(`${DESIGNX_UI_DIR}/${name}.tsx`);
    expect(files).toContain(DESIGNX_THEME_FILE);
    expect(files).toContain(DESIGNX_CONFIG_FILE);
    expect(files).toContain(DESIGNX_SHELL);
    expect(files).toContain(`${DESIGNX_UI_DIR}/use-screen.ts`);
    expect(files).not.toContain(`${DESIGNX_UI_DIR}/use-mobile.ts`);
    expect(captured.out()).toContain(`wrote dx-app/${DESIGNX_UI_DIR}/button.tsx\n`);
    expect(captured.out()).toContain(`wrote dx-app/${DESIGNX_SHELL}\n`);
    expect(readFileSync(join(root, "rex.config.ts"), "utf8")).toContain(
      `ui: { kit: "designx", components: "${DESIGNX_SHELL}" },`,
    );
    expect(readFileSync(join(root, "index.html"), "utf8")).toContain(
      `<link rel="stylesheet" href="${DESIGNX_STYLESHEET_HREF}" />`,
    );
    expect(readFileSync(join(root, "app/components/Button.tsx"), "utf8")).toContain(
      'from "./ui/button.tsx"',
    );
    expect(readFileSync(join(root, DESIGNX_UI_DIR, "use-screen.ts"), "utf8")).toContain(
      'import { useScreen } from "@sidioralabs/rex/client";',
    );

    const shell = readFileSync(join(root, DESIGNX_SHELL), "utf8");
    for (const slot of ["Button", "Sheet", "PaletteItem", "Outcome", "Nav"]) {
      expect(SHELL_COMPONENT_NAMES).toContain(slot);
      expect(shell).toContain(`export function ${slot}(`);
    }
    for (const item of [
      DESIGNX_MAP.button.default,
      DESIGNX_MAP.sheet.dialog,
      DESIGNX_MAP.sheet["bottom-sheet"],
      DESIGNX_MAP.paletteItem.default,
      DESIGNX_MAP.outcome.default,
      DESIGNX_MAP.nav.bar,
      DESIGNX_MAP.nav.sidebar,
      DESIGNX_MAP.nav.dock,
    ]) {
      expect(shell).toContain(`from "./ui/${item}.tsx"`);
    }
    expect(shell).toContain('form === "bottom-sheet"');
    expect(shell).toContain('form === "sidebar"');
    expect(shell).toContain("data-rex-nav={link.address}");

    const part = readFileSync(
      join(root, "app/pages/home/regions/welcome/parts/Welcome.tsx"),
      "utf8",
    );
    for (const item of ["card", "field", "input", "button"]) {
      expect(part).toContain(`/components/ui/${item}.tsx"`);
    }
    const states = readFileSync(join(root, "app/pages/home/states.tsx"), "utf8");
    for (const item of ["skeleton", "empty", "alert", "badge"]) {
      expect(states).toContain(`/components/ui/${item}.tsx"`);
    }

    const manifest = readJson<GeneratedPackage>(join(root, "package.json"));
    const declared = { ...manifest.dependencies, ...manifest.devDependencies };
    for (const name of TAILWIND_PACKAGES) expect(declared[name], name).toBeDefined();
    expect(manifest.dependencies["@sidioralabs/rex"]).toBe(`^${REX_VERSION}`);
    expect(existsSync(join(root, "node_modules"))).toBe(false);

    linkFromWorkspace(root);
    const result = await runCheck(root);
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe("No findings.\n");

    const statesModule = (await import(
      pathToFileURL(join(root, "app/pages/home/states.tsx")).href
    )) as Readonly<Record<string, ComponentType<StateProps>>>;
    const props: StateProps = {
      params: {},
      retry: () => undefined,
      error: new Error("The notes service is down"),
    };
    for (const state of REX_DATA_STATES) {
      if (state === "ready") continue;
      const component = statesModule[STATE_EXPORT_NAMES[state]];
      expect(component, state).toBeDefined();
      const html = renderToStaticMarkup(
        createElement(component as ComponentType<StateProps>, props),
      );
      expect(html, state).toContain(stateSlot(state));
    }
    const failed = renderToStaticMarkup(
      createElement(statesModule.RecoverableError as ComponentType<StateProps>, props),
    );
    expect(failed).toContain("The notes service is down");
    expect(failed).toContain("Try again");
  });
});

describe("rex promote", { timeout: NEW_TEST_TIMEOUT_MS }, () => {
  it("moves a shared part to app/components and rewrites its imports", async () => {
    const { root } = await generate("shared-app");
    installDependencies(root);

    const make = captureIO(root);
    expect(await run(["make", "page", "about", "--regions", "intro"], make.io)).toBe(EXIT_OK);
    const introFile = join(root, "app/pages/about/regions/intro/region.tsx");
    writeFileSync(
      introFile,
      [
        'import { region } from "@sidioralabs/rex/client";',
        'import Welcome from "../../../home/regions/welcome/parts/Welcome.tsx";',
        "",
        'export default region("intro", () => (',
        "  <Welcome",
        "    notes={[]}",
        '    actionLabel="Ping"',
        "    control={{",
        '      "data-rex-allowed": "false",',
        "      disabled: true,",
        '      "aria-disabled": true,',
        '      "aria-busy": false,',
        "    }}",
        "    onAction={() => undefined}",
        "  />",
        "));",
        "",
      ].join("\n"),
    );

    const shared = await runCheck(root, { rules: [boundariesRule] });
    expect(shared.exitCode).toBe(1);
    expect(shared.findings.map((entry) => `${entry.rule} ${entry.file}`)).toEqual([
      expect.stringMatching(/^boundaries\/[a-z-]+ app\/pages\/about\/regions\/intro\/region\.tsx$/),
    ]);

    const promote = captureIO(root);
    expect(await run(["promote", "home/regions/welcome/parts/Welcome"], promote.io)).toBe(EXIT_OK);
    expect(promote.err()).toBe("");
    expect(promote.out()).toBe(
      [
        "moved app/pages/home/regions/welcome/parts/Welcome.tsx -> app/components/Welcome.tsx",
        "rewrote app/pages/about/regions/intro/region.tsx",
        "rewrote app/pages/home/regions/welcome/region.tsx",
        "",
      ].join("\n"),
    );

    expect(existsSync(join(root, "app/pages/home/regions/welcome/parts/Welcome.tsx"))).toBe(false);
    const moved = readFileSync(join(root, "app/components/Welcome.tsx"), "utf8");
    expect(moved).toContain('import Button from "./Button.tsx";');
    expect(moved).toContain('import type { ActControlProps } from "@sidioralabs/rex/client";');

    const home = readFileSync(join(root, "app/pages/home/regions/welcome/region.tsx"), "utf8");
    expect(home).toContain('import Welcome from "../../../../components/Welcome.tsx";');
    expect(home).not.toContain("./parts/Welcome.tsx");
    const intro = readFileSync(introFile, "utf8");
    expect(intro).toContain('import Welcome from "../../../../components/Welcome.tsx";');
    expect(intro).not.toContain("home/regions");

    const result = await runCheck(root, { rules: defaultRules });
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);

    const again = captureIO(root);
    expect(await run(["promote", "home/regions/welcome/parts/Welcome"], again.io)).toBe(
      EXIT_FAILURE,
    );
    expect(again.err()).toContain("Welcome.tsx is missing");
  });

  it("refuses to overwrite a component and rejects a malformed part path", async () => {
    const { root } = await generate("clash-app");
    writeFileSync(
      join(root, "app/components/Welcome.tsx"),
      "export default function Welcome() {}\n",
    );

    const clash = captureIO(root);
    expect(await run(["promote", "home/regions/welcome/parts/Welcome"], clash.io)).toBe(
      EXIT_FAILURE,
    );
    expect(clash.err()).toContain("refusing to overwrite existing files");
    expect(existsSync(join(root, "app/pages/home/regions/welcome/parts/Welcome.tsx"))).toBe(true);
    expect(readFileSync(join(root, "app/pages/home/regions/welcome/region.tsx"), "utf8")).toContain(
      'import Welcome from "./parts/Welcome.tsx";',
    );

    const malformed = captureIO(root);
    expect(await run(["promote", "home/parts/Welcome"], malformed.io)).toBe(EXIT_USAGE);
    expect(malformed.err()).toContain("<page>/regions/<region>/parts/<Part>");

    const lowercase = captureIO(root);
    expect(await run(["promote", "home/regions/welcome/parts/welcome"], lowercase.io)).toBe(
      EXIT_USAGE,
    );
    expect(lowercase.err()).toContain("PascalCase");
  });
});
