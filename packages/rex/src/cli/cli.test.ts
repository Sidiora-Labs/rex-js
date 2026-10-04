import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AnyAction } from "../core/action.ts";
import type { AnyEntity } from "../core/entity.ts";
import type { AnyPage } from "../core/page.ts";
import type { AnyPolicy } from "../core/policy.ts";
import { isRexErrorCode } from "../core/errors.ts";
import { REX_DATA_STATES, requiredStateExports } from "../core/states.ts";
import { REX_VERSION, actor, evaluate, validateStandardSync } from "../index.ts";
import {
  EXIT_FAILURE,
  EXIT_OK,
  EXIT_USAGE,
  USAGE_ERROR_CODES,
  commandModuleFiles,
  createProgram,
  run,
  type RexCliIO,
} from "./index.ts";
import {
  CLIENT_IMPORT,
  CORE_IMPORT,
  FIELDS_IMPORT,
  SCHEMA_IMPORT,
  actionTemplate,
  appPaths,
  camelCase,
  entityTemplate,
  flowTemplate,
  hookTemplate,
  overlayTemplate,
  pageTemplate,
  partTemplate,
  pascalCase,
  policyTemplate,
  regionComponentName,
  regionTemplate,
  statesTemplate,
  viewTemplate,
} from "./templates.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const cliEntry = join(here, "index.ts");
const coreEntry = join(here, "..", "index.ts");
const schemaEntry = import.meta.resolve(SCHEMA_IMPORT);
const fieldsEntry = join(here, "..", "schema", "index.ts");
const packageVersion = (
  JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
    version: string;
  }
).version;

const temporary: string[] = [];
function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temporary.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

const COMMAND_LOAD_TIMEOUT_MS = 60_000;

beforeAll(async () => {
  await createProgram({ cwd: tmpdir(), out: () => undefined, err: () => undefined });
}, COMMAND_LOAD_TIMEOUT_MS);

const CLI_BUILD_TIMEOUT_MS = 180_000;

function buildCli(): string {
  const cache = join(packageRoot, "node_modules", ".cache");
  mkdirSync(cache, { recursive: true });
  const outDir = mkdtempSync(join(cache, "rex-cli-"));
  temporary.push(outDir);
  const config = ts.getParsedCommandLineOfConfigFile(
    join(packageRoot, "tsconfig.build.json"),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      },
    },
  );
  if (config === undefined) throw new Error("tsconfig.build.json could not be read");
  const program = ts.createProgram({
    rootNames: config.fileNames,
    options: { ...config.options, outDir, declaration: false },
  });
  const emitted = program.emit();
  expect(emitted.emitSkipped).toBe(false);
  const entry = join(outDir, basename(dirname(cliEntry)), "index.js");
  expect(existsSync(entry)).toBe(true);
  return entry;
}

let builtCli = "";

function rex(...args: string[]) {
  const result = spawnSync(process.execPath, [builtCli, ...args], {
    cwd: packageRoot,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function captureIO(cwd = packageRoot) {
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

const SPAWN_TEST_TIMEOUT_MS = 30_000;

describe("rex CLI as a node process without tsx", { timeout: SPAWN_TEST_TIMEOUT_MS }, () => {
  beforeAll(() => {
    builtCli = buildCli();
  }, CLI_BUILD_TIMEOUT_MS);

  it("prints the package version for --version, -v and version", () => {
    expect(REX_VERSION).toBe(packageVersion);
    for (const args of [["--version"], ["-v"], ["version"]]) {
      const result = rex(...args);
      expect(result.status).toBe(EXIT_OK);
      expect(result.stdout).toBe(`${packageVersion}\n`);
      expect(result.stderr).toBe("");
    }
  });

  it("prints help listing version and every registered command module", () => {
    const result = rex("--help");
    expect(result.status).toBe(EXIT_OK);
    expect(result.stdout).toContain("Usage: rex [options] [command]");
    expect(result.stdout).toContain("-v, --version");
    expect(result.stdout).toMatch(/^\s+version\s+print the rex version$/m);
    for (const file of commandModuleFiles()) {
      const name = basename(file).replace(/\.(ts|js)$/, "");
      expect(result.stdout).toMatch(new RegExp(`^\\s+${name}\\b`, "m"));
    }
  });

  it("exits 2 on an unknown command and names it on stderr", () => {
    const result = rex("frobnicate");
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("unknown command 'frobnicate'");
  });

  it("exits 2 on an unknown option", () => {
    const result = rex("--frobnicate");
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain("unknown option '--frobnicate'");
  });
});

describe("package hygiene", () => {
  it("depends on no argument parser and no TypeScript loader", () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      readonly dependencies: Readonly<Record<string, string>>;
      readonly devDependencies: Readonly<Record<string, string>>;
    };
    for (const name of ["commander", "tsx"]) {
      expect(manifest.dependencies[name]).toBeUndefined();
      expect(manifest.devDependencies[name]).toBeUndefined();
    }
    expect(Object.keys(manifest.dependencies).sort()).toEqual([
      "@orpc/client",
      "@orpc/server",
      "@orpc/tanstack-query",
      "hono",
    ]);
  });

  it("reports usage errors with exit 2 and the offending input", async () => {
    const missing = captureIO();
    expect(await run(["new"], missing.io)).toBe(EXIT_USAGE);
    expect(missing.err()).toContain("missing required argument 'name'");
    const excess = captureIO();
    expect(await run(["version", "extra"], excess.io)).toBe(EXIT_USAGE);
    expect(excess.err()).toContain("too many arguments");
    const badPort = captureIO();
    expect(await run(["dev", "--port", "http"], badPort.io)).toBe(EXIT_USAGE);
    expect(badPort.err()).toContain("the port must be an integer from 0 to 65535");
    const makeHelp = captureIO();
    expect(await run(["make", "page", "--help"], makeHelp.io)).toBe(EXIT_OK);
    expect(makeHelp.out()).toContain("Usage: rex make page [options] <id>");
    expect(makeHelp.out()).toContain("--regions <names>");
  });
});

describe("run and createProgram", () => {
  it("returns the same exit codes in process", async () => {
    const version = captureIO();
    expect(await run(["version"], version.io)).toBe(EXIT_OK);
    expect(version.out()).toBe(`${packageVersion}\n`);

    const unknown = captureIO();
    expect(await run(["frobnicate"], unknown.io)).toBe(EXIT_USAGE);
    expect(unknown.err()).toContain("unknown command 'frobnicate'");

    const help = captureIO();
    expect(await run(["--help"], help.io)).toBe(EXIT_OK);
    expect(help.out()).toContain("Usage: rex");
  });

  it("registers commands from every command module and ignores other files", async () => {
    const dir = tempDir("rex-commands-");
    writeFileSync(
      join(dir, "greet.ts"),
      [
        "interface Program {",
        "  command(name: string): Program;",
        "  description(text: string): Program;",
        "  action(run: (name: string) => void): Program;",
        "}",
        "",
        "export function register(program: Program, io: { out(text: string): void }) {",
        "  program",
        '    .command("greet <name>")',
        '    .description("greet someone")',
        "    .action((name: string) => {",
        "      io.out(`hello ${name}\\n`);",
        "    });",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(join(dir, "greet.test.ts"), "throw new Error('test files are not commands');\n");
    writeFileSync(join(dir, "Notes.ts"), "throw new Error('only lowercase command files');\n");
    writeFileSync(join(dir, "greet.d.ts"), "export {};\n");
    expect(commandModuleFiles(dir)).toEqual([join(dir, "greet.ts")]);

    const captured = captureIO();
    const program = await createProgram(captured.io, dir);
    expect(program.commands.map((command) => command.name()).sort()).toEqual(["greet", "version"]);
    await program.parseAsync(["greet", "rex"]);
    expect(captured.out()).toBe("hello rex\n");
  });

  it("maps catalogued usage codes to exit 2 and reports every refusal by its own code", async () => {
    expect(USAGE_ERROR_CODES).toEqual(["REX604", "REX601"]);
    expect(USAGE_ERROR_CODES.every((code) => isRexErrorCode(code))).toBe(true);

    const missing = captureIO();
    expect(await run(["new"], missing.io)).toBe(EXIT_USAGE);
    expect(missing.err()).toBe("REX604 error: missing required argument 'name'\n");

    const cwd = tempDir("rex-make-codes-");
    const invalid = captureIO(cwd);
    expect(await run(["make", "entity", "Token"], invalid.io)).toBe(EXIT_USAGE);
    expect(invalid.err()).toMatch(/^REX601 rex make: invalid entity id "Token"/);
    expect(await run(["make", "entity", "token"], captureIO(cwd).io)).toBe(EXIT_OK);
    const refused = captureIO(cwd);
    expect(await run(["make", "entity", "token"], refused.io)).toBe(EXIT_FAILURE);
    expect(refused.err()).toBe(
      "REX602 rex make: refusing to overwrite existing files:\n  app/entities/token.ts\n",
    );
    const promote = captureIO(cwd);
    expect(await run(["promote", "home/parts/Welcome"], promote.io)).toBe(EXIT_USAGE);
    expect(promote.err()).toMatch(/^REX601 rex promote: "home\/parts\/Welcome" is not a part path/);

    const dir = tempDir("rex-commands-");
    writeFileSync(
      join(dir, "refuse.ts"),
      [
        "interface Program {",
        "  command(name: string): Program;",
        "  action(run: () => void): Program;",
        "  error(message: string, options: { exitCode?: number }): never;",
        "}",
        "",
        "export function register(program: Program) {",
        '  const command = program.command("refuse").action(() => {',
        '    command.error("refuse: not today", { exitCode: 3 });',
        "  });",
        "}",
        "",
      ].join("\n"),
    );
    const refusal = captureIO();
    expect(await run(["refuse"], refusal.io, dir)).toBe(3);
    expect(refusal.err()).toBe("REX605 refuse: not today\n");
  });

  it("refuses a command module without register", async () => {
    const dir = tempDir("rex-commands-");
    writeFileSync(join(dir, "broken.ts"), "export const name = 'broken';\n");
    await expect(createProgram(captureIO().io, dir)).rejects.toThrow(
      /broken\.ts must export register\(program, io\)/,
    );
  });

  it("finds no command modules in a missing directory", () => {
    expect(commandModuleFiles(join(tempDir("rex-commands-"), "absent"))).toEqual([]);
  });
});

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

function exportsOf(code: string, fileName: string) {
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.ES2022, true);
  const named: string[] = [];
  let hasDefault = false;
  const imports: string[] = [];
  for (const statement of source.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const exported = modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    const isDefault =
      modifiers?.some((item) => item.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      imports.push(statement.moduleSpecifier.text);
    } else if (ts.isExportAssignment(statement)) {
      hasDefault = true;
    } else if (exported && isDefault) {
      hasDefault = true;
    } else if (exported && ts.isFunctionDeclaration(statement) && statement.name) {
      named.push(statement.name.text);
    } else if (exported && ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) named.push(declaration.name.text);
      }
    }
  }
  return { named, hasDefault, imports };
}

function expectValid(code: string, fileName: string) {
  expect(diagnostics(code, fileName)).toEqual([]);
  expect(code).not.toMatch(/TODO|FIXME|placeholder|lorem/i);
  expect(code.endsWith("\n")).toBe(true);
  return exportsOf(code, fileName);
}

async function importDeclaration(root: string, path: string, code: string) {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    code
      .split(`"${CORE_IMPORT}"`)
      .join(JSON.stringify(coreEntry))
      .split(`"${SCHEMA_IMPORT}"`)
      .join(JSON.stringify(schemaEntry))
      .split(`"${FIELDS_IMPORT}"`)
      .join(JSON.stringify(fieldsEntry)),
  );
  return (await import(pathToFileURL(file).href)) as Record<string, unknown>;
}

describe("canonical templates", () => {
  it("derive conventional paths and names from declaration names", () => {
    expect(appPaths.page("send")).toBe("app/pages/send/page.ts");
    expect(appPaths.view("send")).toBe("app/pages/send/view.tsx");
    expect(appPaths.states("send")).toBe("app/pages/send/states.tsx");
    expect(appPaths.region("send", "form")).toBe("app/pages/send/regions/form/region.tsx");
    expect(appPaths.part("send", "form", "AmountField")).toBe(
      "app/pages/send/regions/form/parts/AmountField.tsx",
    );
    expect(appPaths.overlay("send", "TokenSelectorSheet")).toBe(
      "app/pages/send/overlays/TokenSelectorSheet.tsx",
    );
    expect(appPaths.hook("send", "useDraft")).toBe("app/pages/send/hooks/useDraft.ts");
    expect(appPaths.action("pick-token")).toBe("app/actions/pick-token.ts");
    expect(appPaths.entity("token")).toBe("app/entities/token.ts");
    expect(appPaths.policy("wallet")).toBe("app/policies/wallet.ts");
    expect(appPaths.flow("payout")).toBe("app/flows/payout.ts");
    expect(() => appPaths.page("Send")).toThrow(/page id/);
    expect(() => appPaths.part("send", "form", "amount-field")).toThrow(/PascalCase/);
    expect(() => appPaths.hook("send", "draft")).toThrow(/use/);
    expect(camelCase("toggle-hide-dust")).toBe("toggleHideDust");
    expect(pascalCase("send.review")).toBe("SendReview");
    expect(regionComponentName("holdings")).toBe("HoldingsRegion");
  });

  it("writes states.tsx with one export per declared state, all nine by default", () => {
    const all = expectValid(statesTemplate({ page: "portfolio" }), "states.tsx");
    expect(all.named.sort()).toEqual([...requiredStateExports(REX_DATA_STATES)].sort());
    expect(all.named).toHaveLength(8);
    expect(all.hasDefault).toBe(false);
    expect(all.imports).toEqual([CORE_IMPORT]);

    const some = expectValid(
      statesTemplate({
        page: "portfolio",
        states: ["ready", "loading", "recoverable-error"],
      }),
      "states.tsx",
    );
    expect(some.named).toEqual(["Loading", "RecoverableError"]);

    const minimal = expectValid(
      statesTemplate({ page: "portfolio", states: ["loading", "ready"] }),
      "states.tsx",
    );
    expect(minimal.named).toEqual(["Loading"]);
    expect(minimal.imports).toEqual([]);

    expect(() => statesTemplate({ page: "portfolio", states: ["loading"] })).toThrow(/ready/);
  });

  it("writes view.tsx that lays out regions only and region.tsx bound to its name", () => {
    const view = viewTemplate({ page: "send", regions: ["form", "confirm"] });
    const viewExports = expectValid(view, "view.tsx");
    expect(viewExports.hasDefault).toBe(true);
    expect(viewExports.imports).toEqual([
      CLIENT_IMPORT,
      "./regions/confirm/region.tsx",
      "./regions/form/region.tsx",
    ]);
    expect(view.indexOf("<FormRegion />")).toBeLessThan(view.indexOf("<ConfirmRegion />"));

    const region = regionTemplate({ page: "send", name: "form" });
    const regionExports = expectValid(region, "region.tsx");
    expect(regionExports.hasDefault).toBe(true);
    expect(regionExports.imports).toEqual([CLIENT_IMPORT]);
    expect(region).toContain('region("form", ');
  });

  it("writes parts, overlays and hooks in their canonical shapes", () => {
    const part = expectValid(partTemplate({ name: "AmountField" }), "AmountField.tsx");
    expect(part).toEqual({ named: [], hasDefault: true, imports: [] });

    const overlayCode = overlayTemplate({
      page: "send",
      name: "TokenSelectorSheet",
    });
    const overlay = expectValid(overlayCode, "TokenSelectorSheet.tsx");
    expect(overlay.hasDefault).toBe(true);
    expect(overlayCode).toContain('overlay("TokenSelectorSheet", { dismiss: "both"');
    expect(overlayCode).toContain("Token selector sheet");

    const hook = expectValid(hookTemplate({ name: "useDraft" }), "useDraft.ts");
    expect(hook).toEqual({
      named: ["useDraft"],
      hasDefault: false,
      imports: ["react"],
    });
  });

  it("writes page.ts declaring route, params, actions, regions, overlays and states", async () => {
    const code = pageTemplate({
      id: "send",
      route: "/send/:tokenId",
      actions: ["pick-token"],
      regions: ["form", "confirm"],
      overlays: ["TokenSelectorSheet"],
      states: ["ready", "loading", "terminal-error"],
    });
    const shape = expectValid(code, "page.ts");
    expect(shape.hasDefault).toBe(true);
    expect(shape.imports).toEqual([
      CORE_IMPORT,
      FIELDS_IMPORT,
      SCHEMA_IMPORT,
      "../../actions/pick-token.ts",
    ]);
    expect(code).not.toMatch(/react/i);

    const root = tempDir("rex-templates-");
    const actions = await importDeclaration(
      root,
      appPaths.action("pick-token"),
      actionTemplate({ name: "pick-token" }),
    );
    const pickToken = actions.pickToken as AnyAction;
    expect(pickToken.id).toBe("pick-token");
    const declared = (await importDeclaration(root, appPaths.page("send"), code))
      .default as AnyPage;
    expect(declared.kind).toBe("page");
    expect(declared.id).toBe("send");
    expect(declared.route).toBe("/send/:tokenId");
    expect(declared.routeParams).toEqual(["tokenId"]);
    expect(declared.actions).toEqual([pickToken]);
    expect(declared.regions).toEqual(["form", "confirm"]);
    expect(declared.overlays).toEqual([
      { id: "TokenSelectorSheet", dismiss: "both", binding: "region" },
    ]);
    expect(declared.states).toEqual(["loading", "terminal-error", "ready"]);

    const plain = (
      await importDeclaration(root, appPaths.page("home"), pageTemplate({ id: "home" }))
    ).default as AnyPage;
    expect(plain.route).toBe("/home");
    expect(plain.states).toEqual([...REX_DATA_STATES]);
    expect(plain.regions).toEqual([]);
  });

  it("writes action, entity and policy declarations that the core accepts", async () => {
    const root = tempDir("rex-templates-");
    const action = (
      await importDeclaration(
        root,
        appPaths.action("toggle-hide-dust"),
        actionTemplate({ name: "toggle-hide-dust" }),
      )
    ).toggleHideDust as AnyAction;
    expect(action.id).toBe("toggle-hide-dust");
    expect(action.label).toBe("Toggle hide dust");
    expect(action.effect).toBe("reversible");
    expect(
      validateStandardSync(action.output, await action.handler({}, { actor: actor({ id: "a" }) })),
    ).toEqual({ value: { ok: true } });

    const entity = (
      await importDeclaration(root, appPaths.entity("token"), entityTemplate({ name: "token" }))
    ).token as AnyEntity;
    expect(entity.id).toBe("token");
    expect(entity.key).toBe("id");
    expect(entity.label(entity.parse({ id: "t1", name: "Pax" }))).toBe("Pax");

    const policy = (
      await importDeclaration(root, appPaths.policy("wallet"), policyTemplate({ name: "wallet" }))
    ).wallet as AnyPolicy;
    expect(policy.permissions).toEqual(["wallet.read"]);
    const reader = actor({ id: "r", permissions: ["wallet.read"] });
    expect(evaluate(policy.can("wallet.read"), reader)).toEqual({
      allowed: true,
      reason: null,
    });
    expect(evaluate(policy.can("wallet.read"), actor({ id: "n" })).allowed).toBe(false);
  });

  it("writes a flow declaration with an approval gate and a journal", () => {
    const code = flowTemplate({ name: "payout" });
    const shape = expectValid(code, "payout.ts");
    expect(shape).toEqual({
      named: ["payout"],
      hasDefault: false,
      imports: [CORE_IMPORT],
    });
    expect(code).toContain('flow("payout", {');
    expect(code).toContain("journal: memoryJournal(),");
  });

  it("refuses invalid names in every template", () => {
    expect(() => pageTemplate({ id: "Send" })).toThrow(/page id/);
    expect(() => pageTemplate({ id: "send", route: "send" })).toThrow(/route/);
    expect(() => pageTemplate({ id: "send", regions: ["form", "form"] })).toThrow(/repeats/);
    expect(() => regionTemplate({ page: "send", name: "Form" })).toThrow(/region name/);
    expect(() => partTemplate({ name: "amountField" })).toThrow(/PascalCase/);
    expect(() => overlayTemplate({ page: "send", name: "sheet" })).toThrow(/PascalCase/);
    expect(() => hookTemplate({ name: "draft" })).toThrow(/use/);
    expect(() => actionTemplate({ name: "1send" })).toThrow(/digit/);
    expect(() => entityTemplate({ name: "Token" })).toThrow(/entity id/);
    expect(() => policyTemplate({ name: "" })).toThrow(/policy id/);
    expect(() => flowTemplate({ name: "pay out" })).toThrow(/flow id/);
  });
});
