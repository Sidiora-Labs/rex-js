import {
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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { z } from "zod/mini";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { action } from "../core/action.ts";
import {
  CONFIG_FILE as CORE_CONFIG_FILE,
  LEGACY_CONFIG_MESSAGE,
  defineConfig,
  isDefinedConfig,
  type RexConfigApp,
  type RexFetchHandler,
} from "../core/config.ts";
import { deprecationMessage, resetDeprecations } from "../core/deprecated.ts";
import { isRexError, type RexError } from "../core/errors.ts";
import { page } from "../core/page.ts";
import { always } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import type { Manifest } from "../manifest/types.ts";
import {
  CONFIG_FILE,
  configPath,
  defaultAppServer,
  hasConfig,
  importConfigExport,
  loadConfigServer,
  loadRexConfig,
  nodeEnvRestorer,
  requireConfig,
  restoringNodeEnv,
  serverForExport,
} from "./config.ts";
import { EXIT_OK, run, type RexCliIO } from "./index.ts";
import { createModuleLoader } from "./load.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const CONFIG_TEST_TIMEOUT_MS = 240_000;
const APP_NAME = "config-app";
const MANIFEST_URL = "http://rex.test/rex/manifest";
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

const ping = action("ping", {
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  policy: always(),
  effect: "read",
  handler: () => ({ ok: true }),
});
const home = page("home", { route: "/", actions: [ping] });
const app: RexConfigApp = {
  name: "config-cli-app",
  registry: createRegistry().register(ping, home).freeze(),
};

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "rex-cli-config-")));
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

function rexFailure(attempt: () => unknown): RexError {
  try {
    attempt();
  } catch (error) {
    expect(isRexError(error)).toBe(true);
    return error as RexError;
  }
  throw new Error("expected a RexError");
}

async function rexRejection(attempt: () => Promise<unknown>): Promise<RexError> {
  try {
    await attempt();
  } catch (error) {
    expect(isRexError(error)).toBe(true);
    return error as RexError;
  }
  throw new Error("expected a RexError");
}

async function manifestOf(server: RexFetchHandler): Promise<Manifest> {
  const response = await server.fetch(new Request(MANIFEST_URL));
  expect(response.status).toBe(200);
  return (await response.json()) as Manifest;
}

describe("nodeEnvRestorer and restoringNodeEnv", () => {
  const original = process.env.NODE_ENV;

  afterEach(() => {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  });

  it("restores a set NODE_ENV and removes one that was unset", () => {
    process.env.NODE_ENV = "config-test";
    const restoreSet = nodeEnvRestorer();
    process.env.NODE_ENV = "production";
    restoreSet();
    expect(process.env.NODE_ENV).toBe("config-test");

    delete process.env.NODE_ENV;
    const restoreUnset = nodeEnvRestorer();
    process.env.NODE_ENV = "production";
    restoreUnset();
    expect(process.env.NODE_ENV).toBeUndefined();
    expect("NODE_ENV" in process.env).toBe(false);
  });

  it("restores NODE_ENV around a run whether it resolves or rejects", async () => {
    process.env.NODE_ENV = "before";
    await expect(
      restoringNodeEnv(async () => {
        process.env.NODE_ENV = "inside";
        return "done";
      }),
    ).resolves.toBe("done");
    expect(process.env.NODE_ENV).toBe("before");

    await expect(
      restoringNodeEnv(async () => {
        process.env.NODE_ENV = "failed";
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(process.env.NODE_ENV).toBe("before");
  });
});

describe("configPath, hasConfig and requireConfig", () => {
  it("point at rex.config.ts under the resolved root", () => {
    const root = tempDir();
    expect(CONFIG_FILE).toBe(CORE_CONFIG_FILE);
    expect(configPath(root)).toBe(join(root, "rex.config.ts"));
    expect(configPath("relative-app")).toBe(join(process.cwd(), "relative-app", CONFIG_FILE));
    expect(hasConfig(root)).toBe(false);
    writeFileSync(configPath(root), "export default 1;\n");
    expect(hasConfig(root)).toBe(true);
    expect(requireConfig(root)).toBe(configPath(root));
  });

  it("refuses a root without rex.config.ts with REX100 naming the root", () => {
    const root = tempDir();
    const failure = rexFailure(() => requireConfig(root));
    expect(failure.code).toBe("REX100");
    expect(failure.detail).toBe(
      `${CONFIG_FILE} is missing in ${resolve(root)}; it default-exports defineConfig({ app }) with app imported from rex:app`,
    );
    expect(existsSync(configPath(root))).toBe(false);
  });
});

describe("defaultAppServer and serverForExport", () => {
  afterEach(() => {
    resetDeprecations();
  });

  it("serves the app's manifest when the config declares no server", async () => {
    const manifest = await manifestOf(defaultAppServer(app));
    expect(manifest.app).toEqual({ name: "config-cli-app" });
    expect(manifest.actions.map((entry) => entry.id)).toEqual(["ping"]);
    expect(manifest.pages.map((entry) => entry.id)).toEqual(["home"]);
  });

  it("caches one server per config export object and builds a new one per object", async () => {
    const exported = defineConfig({ app });
    const server = serverForExport(exported);
    expect(serverForExport(exported)).toBe(server);
    expect(serverForExport(defineConfig({ app }))).not.toBe(server);
    expect((await manifestOf(server)).app).toEqual({ name: "config-cli-app" });
  });

  it("uses the config's own server factory with the declared app", async () => {
    const exported = defineConfig({
      app,
      server: (bundle) => new Hono().get("/rex/name", (c) => c.text(bundle.name)),
    });
    const server = serverForExport(exported);
    const named = await server.fetch(new Request("http://rex.test/rex/name"));
    expect(await named.text()).toBe("config-cli-app");
    expect((await server.fetch(new Request(MANIFEST_URL))).status).toBe(404);
  });

  it("returns a legacy bare fetch app as is and warns REX101 once through warn", () => {
    const legacy = new Hono().get("/legacy", (c) => c.text("legacy"));
    const warnings: string[] = [];
    const warn = (message: string) => {
      warnings.push(message);
    };
    expect(serverForExport(legacy, warn)).toBe(legacy);
    expect(serverForExport(legacy, warn)).toBe(legacy);
    expect(warnings).toEqual([deprecationMessage("REX101", LEGACY_CONFIG_MESSAGE)]);
  });

  it("rejects exports that are not a Rex config by their REX codes", () => {
    expect(rexFailure(() => serverForExport(undefined)).code).toBe("REX102");
    expect(rexFailure(() => serverForExport("rex")).code).toBe("REX102");
    expect(rexFailure(() => serverForExport({ app: { name: "x" } })).code).toBe("REX111");
    const broken = defineConfig({ app, server: () => ({}) as unknown as RexFetchHandler });
    expect(rexFailure(() => serverForExport(broken)).code).toBe("REX112");
  });
});

describe("loadRexConfig on a generated app", { timeout: CONFIG_TEST_TIMEOUT_MS }, () => {
  let root: string;
  let generated: string;

  beforeAll(async () => {
    const cwd = tempDir();
    const created = captureIO(cwd);
    expect(await run(["new", APP_NAME, "--ui", "none"], created.io)).toBe(EXIT_OK);
    expect(created.err()).toBe("");
    root = join(cwd, APP_NAME);
    installDependencies(root);
    generated = readFileSync(configPath(root), "utf8");
  }, CONFIG_TEST_TIMEOUT_MS);

  afterEach(() => {
    writeFileSync(configPath(root), generated);
    resetDeprecations();
  });

  it("reads defineConfig from rex.config.ts with the app bundle and leaves NODE_ENV as it was", async () => {
    const restore = nodeEnvRestorer();
    process.env.NODE_ENV = "config-probe";
    try {
      const loaded = await loadRexConfig(root);
      expect(loaded.file).toBe(join(root, CONFIG_FILE));
      expect(loaded.read.kind).toBe("config");
      if (loaded.read.kind !== "config") throw new Error("expected a defineConfig export");
      expect(loaded.read.config.app.name).toBe(APP_NAME);
      expect(loaded.read.config.app.registry.pages.map((entry) => entry.id)).toEqual(["home"]);
      expect(loaded.read.config.app.registry.actions.map((entry) => entry.id)).toEqual(["ping"]);
      expect(typeof loaded.read.config.server).toBe("function");
      expect(loaded.read.options).toBe(loaded.read.config);
      expect(loaded.read.options.ui).toBe("none");
      expect(process.env.NODE_ENV).toBe("config-probe");
    } finally {
      restore();
    }
  });

  it("fails with REX100 for a root without rex.config.ts", async () => {
    const empty = tempDir();
    const failure = await rexRejection(() => loadRexConfig(empty));
    expect(failure.code).toBe("REX100");
    expect(failure.detail).toContain(`${CONFIG_FILE} is missing in ${empty}`);
  });

  it("rejects a config module without defineConfig by its REX code and passes module errors through", async () => {
    writeFileSync(configPath(root), "export default 42;\n");
    const notConfig = await rexRejection(() => loadRexConfig(root));
    expect(notConfig.code).toBe("REX102");
    expect(notConfig.detail).toBe(
      `${CONFIG_FILE}: the default export must be defineConfig({ app })`,
    );

    writeFileSync(configPath(root), "export const settings = {};\n");
    const missing = await rexRejection(() => loadRexConfig(root));
    expect(missing.code).toBe("REX102");
    expect(missing.detail).toBe(`${CONFIG_FILE} has no default export`);

    writeFileSync(configPath(root), 'throw new Error("config exploded");\n');
    await expect(loadRexConfig(root)).rejects.toThrow("config exploded");
  });

  it("reads a legacy bare Hono export, warns REX101 through warn and keeps serving it", async () => {
    writeFileSync(configPath(root), LEGACY_CONFIG);
    const warnings: string[] = [];
    const loaded = await loadRexConfig(root, {
      warn: (message) => {
        warnings.push(message);
      },
    });
    expect(loaded.read.kind).toBe("legacy");
    if (loaded.read.kind !== "legacy") throw new Error("expected a legacy export");
    expect(warnings).toEqual([deprecationMessage("REX101", LEGACY_CONFIG_MESSAGE)]);
    expect((await manifestOf(loaded.read.server)).app).toEqual({ name: APP_NAME });
  });

  it("importConfigExport and loadConfigServer read the live vite server and cache the server per export", async () => {
    const loader = await createModuleLoader(root);
    try {
      const exported = await importConfigExport(loader.vite);
      expect(isDefinedConfig(exported)).toBe(true);
      const server = await loadConfigServer(loader.vite);
      expect(await loadConfigServer(loader.vite)).toBe(server);
      expect(serverForExport(exported)).toBe(server);
      expect((await manifestOf(server)).app).toEqual({ name: APP_NAME });
    } finally {
      await loader.close();
    }
  });
});
