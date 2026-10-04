import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";
import { CONFIG_FILE, UI_KITS } from "../../core/config.ts";
import { titleFromId } from "../../core/page.ts";
import { REX_VERSION } from "../../index.ts";
import { InvalidArgumentError, RexArgsError, RexCommand } from "../args.ts";
import { DEFAULT_UI } from "../gen/designx.ts";
import type { RexCliIO } from "../index.ts";
import {
  CLIENT_IMPORT,
  CORE_IMPORT,
  appPaths,
  configTemplate as sharedConfigTemplate,
} from "../templates.ts";
import { MakeError } from "./make.ts";
import {
  APP_ACTION,
  APP_COMPONENT,
  APP_DATA,
  APP_ENTITY,
  APP_MODULE_TYPES,
  APP_PEERS,
  APP_POLICY,
  HOME_HOOK,
  HOME_PAGE,
  HOME_PART,
  HOME_REGION,
  NEW_APP_HOME,
  REX_PACKAGE,
  appModuleTypesPath,
  baseAppPlan,
  componentTemplate,
  configTemplate,
  dataTemplate,
  homeHookTemplate,
  homePartTemplate,
  homeRegionTemplate,
  indexHtmlTemplate,
  newApp,
  newAppPlan,
  packageJsonTemplate,
  parseUi,
  register,
  tsconfigTemplate,
} from "./new.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..", "..");

interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly private: boolean;
  readonly type: string;
  readonly scripts: Readonly<Record<string, string>>;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

const rexManifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
) as PackageManifest;

function pinned(name: string): string | undefined {
  return (
    rexManifest.dependencies[name] ??
    rexManifest.devDependencies[name] ??
    rexManifest.peerDependencies?.[name]
  );
}

const BASE_PATHS = [
  "package.json",
  "tsconfig.json",
  "index.html",
  CONFIG_FILE,
  appPaths.entity(APP_ENTITY),
  appPaths.policy(APP_POLICY),
  appPaths.action(APP_ACTION),
  `app/data/${APP_DATA}.ts`,
  `app/components/${APP_COMPONENT}.tsx`,
  appPaths.page(HOME_PAGE),
  appPaths.view(HOME_PAGE),
  appPaths.states(HOME_PAGE),
  appPaths.hook(HOME_PAGE, HOME_HOOK),
  appPaths.region(HOME_PAGE, HOME_REGION),
  appPaths.part(HOME_PAGE, HOME_REGION, HOME_PART),
  appPaths.testDir(HOME_PAGE),
];

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
  const dir = mkdtempSync(join(tmpdir(), "rex-new-command-"));
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

function diagnostics(code: string, fileName: string): string[] {
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
  return (output.diagnostics ?? []).map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  );
}

function importsOf(code: string, fileName: string): string[] {
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.ES2022, true);
  return source.statements
    .filter(ts.isImportDeclaration)
    .map((statement) => (statement.moduleSpecifier as ts.StringLiteral).text);
}

describe("app manifest templates", () => {
  it("packageJsonTemplate pins rex and every peer to the versions the rex package uses", () => {
    const parsed = JSON.parse(packageJsonTemplate("notes-app")) as PackageManifest;
    expect(packageJsonTemplate("notes-app").endsWith("}\n")).toBe(true);
    expect(parsed).toMatchObject({
      name: "notes-app",
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: {
        dev: "rex dev",
        build: "rex build",
        check: "rex check",
        manifest: "rex manifest",
        start: "node dist/server.js",
      },
    });
    expect(REX_PACKAGE).toBe("@sidioralabs/rex");
    expect(parsed.dependencies[REX_PACKAGE]).toBe(`^${REX_VERSION}`);
    expect(Object.keys(parsed.dependencies)).toEqual([REX_PACKAGE, ...APP_PEERS]);
    for (const peer of APP_PEERS) {
      expect(pinned(peer), peer).toBeDefined();
      expect(parsed.dependencies[peer], peer).toBe(pinned(peer));
    }
    expect(Object.keys(parsed.devDependencies)).toEqual([
      "@types/node",
      "@types/react",
      "@types/react-dom",
      "typescript",
    ]);
    for (const [name, version] of Object.entries(parsed.devDependencies)) {
      expect(version, name).toBe(pinned(name));
    }
  });

  it("tsconfigTemplate includes the app, the config and the rex app module types inline", () => {
    const text = tsconfigTemplate();
    const parsed = JSON.parse(text) as {
      readonly compilerOptions: Readonly<Record<string, unknown>>;
      readonly include: readonly string[];
    };
    expect(parsed.include).toEqual(["app", CONFIG_FILE, appModuleTypesPath()]);
    expect(parsed.compilerOptions).toMatchObject({
      strict: true,
      jsx: "react-jsx",
      moduleResolution: "Bundler",
      verbatimModuleSyntax: true,
      allowImportingTsExtensions: true,
      noEmit: true,
    });
    expect(text).toContain('    "lib": ["ES2022", "DOM", "DOM.Iterable"],\n');
    expect(text).toContain('    "types": ["node"],\n');
    expect(text).toContain(`  "include": ["app", "${CONFIG_FILE}", "${appModuleTypesPath()}"]\n`);
    expect(APP_MODULE_TYPES).toBe("rex-app.d.ts");
    expect(appModuleTypesPath()).toBe(`node_modules/${REX_PACKAGE}/src/vite/${APP_MODULE_TYPES}`);
    expect(existsSync(join(packageRoot, "src", "vite", APP_MODULE_TYPES))).toBe(true);
  });

  it("indexHtmlTemplate titles the page from the app name and loads the rex entry", () => {
    const html = indexHtmlTemplate("notes-app");
    expect(html).toContain(`<title>${titleFromId("notes-app")}</title>`);
    expect(html).toContain("<title>Notes app</title>");
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('<script type="module" src="/@rex/entry"></script>');
    expect(html.startsWith("<!doctype html>\n")).toBe(true);
    expect(html.endsWith("</html>\n")).toBe(true);
  });
});

describe("home page templates", () => {
  it("transpile cleanly and import their neighbours by the conventional relative paths", () => {
    expect(configTemplate).toBe(sharedConfigTemplate);
    const cases: readonly (readonly [string, string, readonly string[]])[] = [
      [dataTemplate(), "notes.ts", [CORE_IMPORT, `../entities/${APP_ENTITY}.ts`]],
      [componentTemplate(), "Button.tsx", ["react"]],
      [
        homeHookTemplate(),
        "useNotes.ts",
        ["@tanstack/react-query", `../../../data/${APP_DATA}.ts`],
      ],
      [
        homeRegionTemplate(),
        "region.tsx",
        [
          CLIENT_IMPORT,
          `../../../../actions/${APP_ACTION}.ts`,
          `../../hooks/${HOME_HOOK}.ts`,
          `./parts/${HOME_PART}.tsx`,
        ],
      ],
      [
        homePartTemplate(),
        "Welcome.tsx",
        [CLIENT_IMPORT, `../../../../../components/${APP_COMPONENT}.tsx`],
      ],
    ];
    for (const [code, fileName, imports] of cases) {
      expect(diagnostics(code, fileName), fileName).toEqual([]);
      expect(importsOf(code, fileName), fileName).toEqual(imports);
      expect(code.endsWith("\n"), fileName).toBe(true);
    }
    expect(dataTemplate()).toContain(`export const ${APP_DATA} = bind(${APP_ENTITY}, memoryStore(`);
    expect(homeRegionTemplate()).toContain(
      `export default region(${JSON.stringify(HOME_REGION)}, `,
    );
    expect(homeRegionTemplate()).toContain(`const handle = act(${APP_ACTION});`);
    expect(homePartTemplate()).toContain(`export default function ${HOME_PART}(`);
    expect(homeHookTemplate()).toContain(`export function ${HOME_HOOK}()`);
  });
});

describe("app plans", () => {
  it("baseAppPlan lists the base files in write order and newAppPlan adds the generators' files", () => {
    const base = baseAppPlan("notes-app");
    expect(base.map((entry) => entry.path)).toEqual(BASE_PATHS);
    expect(base.map((entry) => entry.kind)).toEqual([
      ...BASE_PATHS.slice(0, -1).map(() => "file"),
      "dir",
    ]);
    expect(base.find((entry) => entry.path === "package.json")).toEqual({
      kind: "file",
      path: "package.json",
      content: packageJsonTemplate("notes-app"),
    });

    const plan = newAppPlan("notes-app", "none");
    const paths = plan.map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.filter((path) => !BASE_PATHS.includes(path)).sort()).toEqual([
      ".prettierignore",
      ".prettierrc",
      "app/locales/en.json",
      "eslint.config.js",
    ]);
    expect(
      plan
        .filter((entry) => entry.kind === "file")
        .map((entry) => entry.path)
        .sort(),
    ).toEqual(APP_FILES);
    expect(NEW_APP_HOME).toEqual({ page: HOME_PAGE, region: HOME_REGION, part: HOME_PART });
    expect(Object.isFrozen(NEW_APP_HOME)).toBe(true);
  });
});

describe("newApp", () => {
  it("writes the plain app into a new folder and reports every path under the app name", async () => {
    const cwd = tempDir();
    const written = await newApp(cwd, "notes-app", { ui: "none" });
    expect(written.every((path) => path.startsWith("notes-app/"))).toBe(true);
    expect(
      written
        .filter((path) => !path.endsWith("/"))
        .map((path) => path.slice("notes-app/".length))
        .sort(),
    ).toEqual(APP_FILES);
    expect(written).toContain(`notes-app/${appPaths.testDir(HOME_PAGE)}/`);
    const planned = newAppPlan("notes-app", "none").find((entry) => entry.path === "package.json");
    expect(planned?.kind).toBe("file");
    const packageJson = readFileSync(join(cwd, "notes-app", "package.json"), "utf8");
    expect(packageJson).toBe(planned?.kind === "file" ? planned.content : "");
    expect(JSON.parse(packageJson) as PackageManifest).toMatchObject({
      ...(JSON.parse(packageJsonTemplate("notes-app")) as PackageManifest),
      scripts: { dev: "rex dev", lint: "eslint ." },
    });
    expect(readFileSync(join(cwd, "notes-app", CONFIG_FILE), "utf8")).toBe(configTemplate());
    expect(existsSync(join(cwd, "notes-app", "node_modules"))).toBe(false);

    mkdirSync(join(cwd, "empty-app"));
    expect((await newApp(cwd, "empty-app", { ui: "none" })).length).toBe(written.length);
  });

  it("refuses an invalid name, a non-empty folder and a file in the way", async () => {
    const cwd = tempDir();
    await expect(newApp(cwd, "My_App", { ui: "none" })).rejects.toThrow(MakeError);
    await expect(newApp(cwd, "My_App", { ui: "none" })).rejects.toMatchObject({
      code: "REX601",
      exitCode: 2,
      detail: expect.stringContaining('invalid app name "My_App"'),
    });

    mkdirSync(join(cwd, "taken"));
    writeFileSync(join(cwd, "taken", "keep.txt"), "mine\n");
    await expect(newApp(cwd, "taken", { ui: "none" })).rejects.toMatchObject({
      code: "REX602",
      exitCode: 1,
      detail: "refusing to write into taken: it already exists and is not an empty folder",
    });
    expect(readFileSync(join(cwd, "taken", "keep.txt"), "utf8")).toBe("mine\n");

    writeFileSync(join(cwd, "blocked"), "not a folder\n");
    await expect(newApp(cwd, "blocked", { ui: "none" })).rejects.toMatchObject({
      code: "REX602",
      detail: "refusing to write into blocked: it already exists and is not an empty folder",
    });
    expect(readFileSync(join(cwd, "blocked"), "utf8")).toBe("not a folder\n");
    expect(existsSync(join(cwd, "My_App"))).toBe(false);
  });
});

describe("register", () => {
  it("parses the ui kit and registers --ui and --no-install", async () => {
    for (const kit of UI_KITS) expect(parseUi(kit)).toBe(kit);
    expect(DEFAULT_UI).toBe("designx");
    expect(() => parseUi("mui")).toThrow(InvalidArgumentError);
    expect(() => parseUi("mui")).toThrow(`--ui must be one of ${UI_KITS.join(", ")}`);

    const cwd = tempDir();
    const captured = captureIO(cwd);
    const program = new RexCommand("rex").configureOutput({
      writeOut: captured.io.out,
      writeErr: captured.io.err,
    });
    register(program, captured.io);
    const [listing] = program.listing().commands;
    expect(listing).toMatchObject({ name: "new", path: "rex new" });
    expect(listing?.arguments).toEqual([
      {
        name: "name",
        required: true,
        description: "app name: lowercase letters, digits, dot and dash",
      },
    ]);
    expect(listing?.options).toMatchObject([
      { long: "--ui", value: "kit", default: DEFAULT_UI },
      { long: "--no-install", value: null, negate: true },
    ]);
    await expect(program.parseAsync(["new", "notes-app", "--ui", "mui"])).rejects.toThrow(
      RexArgsError,
    );
    await expect(program.parseAsync(["new", "notes-app", "--ui", "mui"])).rejects.toThrow(
      `option '--ui <kit>' argument 'mui' is invalid. --ui must be one of ${UI_KITS.join(", ")}`,
    );
    expect(existsSync(join(cwd, "notes-app"))).toBe(false);

    await program.parseAsync(["new", "notes-app", "--ui", "none"]);
    expect(captured.err()).toBe("");
    expect(captured.out()).toContain("wrote notes-app/package.json\n");
    expect(captured.out()).toContain(`wrote notes-app/${appPaths.page(HOME_PAGE)}\n`);
    await expect(program.parseAsync(["new", "notes-app", "--ui", "none"])).rejects.toMatchObject({
      code: "REX605",
      cliCode: "rex.make.refused",
      exitCode: 1,
      message: expect.stringContaining("rex new: refusing to write into notes-app"),
    });
  });
});
