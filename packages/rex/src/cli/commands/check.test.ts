import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCheck, type Finding } from "../../check/index.ts";
import { LEGACY_CONFIG_MESSAGE } from "../../core/config.ts";
import { deprecationMessage, resetDeprecations } from "../../core/deprecated.ts";
import { RexCommand } from "../args.ts";
import { EXIT_FAILURE, EXIT_OK, RexCliExit, run, type RexCliIO } from "../index.ts";
import { NO_CHECK_HINT, ensureCheckPasses, readAppConfig, register } from "./check.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..", "..");
const enginePass = join(here, "..", "..", "check", "fixtures", "engine", "pass");
const mediaFail = join(here, "..", "..", "check", "fixtures", "media", "fail");
const APP_NAME = "check-app";
const CHECK_TEST_TIMEOUT_MS = 240_000;
const TILE = "app/pages/gallery/regions/grid/parts/Tile.tsx";

const LEGACY_CONFIG = [
  'import { anonymousActor } from "@sidioralabs/rex";',
  'import { createRexServer, memoryLedger } from "@sidioralabs/rex/server";',
  'import app from "rex:app";',
  "",
  "export default createRexServer({",
  "  registry: app.registry,",
  "  ledger: memoryLedger(),",
  "  actor: () => anonymousActor,",
  "  app: app.name,",
  "});",
  "",
].join("\n");

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix = "rex-check-command-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
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

function installDependencies(root: string): void {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    readonly dependencies: Readonly<Record<string, string>>;
    readonly devDependencies: Readonly<Record<string, string>>;
  };
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

function copyMediaFail(): string {
  const root = tempDir("rex-check-media-");
  cpSync(mediaFail, root, { recursive: true });
  return root;
}

async function cli(root: string, ...args: string[]) {
  const captured = captureIO(root);
  const code = await run(args, captured.io);
  return { code, out: captured.out(), err: captured.err() };
}

describe("rex check command", { timeout: CHECK_TEST_TIMEOUT_MS }, () => {
  let root: string;

  beforeAll(async () => {
    const cwd = tempDir();
    expect(await run(["new", APP_NAME, "--ui", "none"], captureIO(cwd).io)).toBe(EXIT_OK);
    root = join(cwd, APP_NAME);
    installDependencies(root);
  }, CHECK_TEST_TIMEOUT_MS);

  it("readAppConfig returns null without a config and the read config with one", async () => {
    const empty = tempDir();
    const silent = captureIO(empty);
    expect(await readAppConfig(empty, silent.io, "check")).toBeNull();
    expect(silent.err()).toBe("");

    const captured = captureIO(root);
    const read = await readAppConfig(root, captured.io, "check");
    expect(read?.kind).toBe("config");
    expect(captured.err()).toBe("");
  });

  it("readAppConfig warns about a legacy config and exits on an invalid one", async () => {
    const configFile = join(root, "rex.config.ts");
    const generated = readFileSync(configFile, "utf8");
    try {
      resetDeprecations();
      writeFileSync(configFile, LEGACY_CONFIG);
      const legacy = captureIO(root);
      expect((await readAppConfig(root, legacy.io, "check"))?.kind).toBe("legacy");
      expect(legacy.err()).toBe(`${deprecationMessage("REX101", LEGACY_CONFIG_MESSAGE)}\n`);

      writeFileSync(
        configFile,
        generated.replace("  app,", '  app,\n  render: { default: "edge" },'),
      );
      const invalid = captureIO(root);
      await expect(readAppConfig(root, invalid.io, "manifest")).rejects.toThrow(RexCliExit);
      await expect(readAppConfig(root, invalid.io, "manifest")).rejects.toMatchObject({
        exitCode: EXIT_FAILURE,
        message: expect.stringMatching(/^rex manifest: REX113 .*field "render\.default"/s),
      });
    } finally {
      writeFileSync(configFile, generated);
      resetDeprecations();
    }
  });

  it("ensureCheckPasses is silent on a clean app and exits with the error count otherwise", async () => {
    const clean = captureIO(enginePass);
    await expect(ensureCheckPasses(enginePass, clean.io, "build")).resolves.toBeUndefined();
    expect(clean.out()).toBe("");
    expect(clean.err()).toBe("");

    const failing = copyMediaFail();
    const expected = await runCheck(failing);
    expect(expected.exitCode).toBe(EXIT_FAILURE);
    expect(expected.errors).toBeGreaterThan(1);
    const captured = captureIO(failing);
    await expect(ensureCheckPasses(failing, captured.io, "dev")).rejects.toMatchObject({
      exitCode: EXIT_FAILURE,
      message: `rex dev: rex check reported ${expected.errors} errors; ${NO_CHECK_HINT}`,
    });
    expect(captured.err()).toBe(expected.output);
    expect(captured.out()).toBe("");
  });

  it("registers --json and --runtime and reports findings through the CLI", async () => {
    const captured = captureIO(root);
    const program = new RexCommand("rex");
    register(program, captured.io);
    const [listing] = program.listing().commands;
    expect(listing).toMatchObject({ name: "check", path: "rex check", arguments: [] });
    expect(listing?.options.map((option) => option.long)).toEqual(["--json", "--runtime"]);

    expect(await cli(enginePass, "check")).toEqual({
      code: EXIT_OK,
      out: "No findings.\n",
      err: "",
    });

    const failing = copyMediaFail();
    const json = await cli(failing, "check", "--json");
    expect(json.code).toBe(EXIT_FAILURE);
    expect(json.err).toBe("");
    const findings = JSON.parse(json.out) as Finding[];
    expect(findings.map((entry) => `${entry.rule} ${entry.file}`)).toContain(
      `media/no-raw-img ${TILE}`,
    );
    expect(
      findings.every((entry) => entry.severity === "error" || entry.severity === "warning"),
    ).toBe(true);
  });

  it("merges the runtime findings into the report with --runtime", async () => {
    const runtime = await cli(root, "check", "--runtime", "--json");
    expect(runtime.err).toBe("");
    expect(runtime).toMatchObject({ code: EXIT_OK, out: "[]\n" });
  });
});
