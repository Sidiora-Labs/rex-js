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
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { action, type AnyAction } from "../core/action.ts";
import { defineConfig, readConfigExport, type RexConfigApp } from "../core/config.ts";
import { resetDeprecations } from "../core/deprecated.ts";
import { isRexError, type RexError } from "../core/errors.ts";
import { page } from "../core/page.ts";
import { always } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { APP_MODULE_ID } from "../vite/virtual.ts";
import { EXIT_OK, run, type RexCliIO } from "./index.ts";
import {
  configPluginOptions,
  createModuleLoader,
  fontSpec,
  loadAppBundle,
  withModuleLoader,
  type ModuleLoader,
} from "./load.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const LOAD_TEST_TIMEOUT_MS = 240_000;
const APP_NAME = "load-app";

const ping = action("ping", {
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  policy: always(),
  effect: "read",
  handler: () => ({ ok: true }),
});
const home = page("home", { route: "/", actions: [ping] });
const app: RexConfigApp = {
  name: "load-config-app",
  registry: createRegistry().register(ping, home).freeze(),
};

const DEFAULT_PLUGIN_OPTIONS = {
  compiler: true,
  devtools: true,
  tailwind: false,
  ui: "none",
  secretNames: [],
  shellComponents: null,
  fonts: [],
  i18n: null,
};

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "rex-cli-load-")));
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

describe("fontSpec", () => {
  it("drops a null weight and keeps a declared one", () => {
    const unweighted = fontSpec({
      family: "Inter",
      src: "/fonts/inter.woff2",
      weight: null,
      style: "normal",
      preload: true,
    });
    expect(unweighted).toEqual({
      family: "Inter",
      src: "/fonts/inter.woff2",
      style: "normal",
      preload: true,
    });
    expect("weight" in unweighted).toBe(false);
    expect(
      fontSpec({
        family: "Mono",
        src: "/fonts/mono.woff2",
        weight: "100 900",
        style: "italic",
        preload: false,
      }),
    ).toEqual({
      family: "Mono",
      src: "/fonts/mono.woff2",
      weight: "100 900",
      style: "italic",
      preload: false,
    });
  });
});

describe("configPluginOptions", () => {
  it("maps the resolved defaults of defineConfig({ app }) and of a legacy export", () => {
    expect(configPluginOptions(readConfigExport(defineConfig({ app })))).toEqual(
      DEFAULT_PLUGIN_OPTIONS,
    );
    resetDeprecations();
    expect(configPluginOptions(readConfigExport(new Hono(), () => undefined))).toEqual(
      DEFAULT_PLUGIN_OPTIONS,
    );
    resetDeprecations();
  });

  it("carries compiler, devtools, tailwind, ui, secret names, shell components, fonts and i18n", () => {
    const read = readConfigExport(
      defineConfig({
        app,
        compiler: false,
        devtools: false,
        tailwind: true,
        ui: { kit: "designx", components: "app/components/Shell.tsx" },
        security: { secretNames: ["STRIPE_KEY"] },
        fonts: [
          { family: "Inter", src: "/fonts/inter.woff2", weight: "100 900" },
          { family: "Mono", src: "/fonts/mono.woff2", style: "italic", preload: false },
        ],
        i18n: { locales: ["en", "de"], default: "en", routing: "prefix" },
      }),
    );
    const options = configPluginOptions(read);
    expect(options).toEqual({
      compiler: false,
      devtools: false,
      tailwind: true,
      ui: "designx",
      secretNames: ["STRIPE_KEY"],
      shellComponents: "app/components/Shell.tsx",
      fonts: [
        {
          family: "Inter",
          src: "/fonts/inter.woff2",
          weight: "100 900",
          style: "normal",
          preload: true,
        },
        { family: "Mono", src: "/fonts/mono.woff2", style: "italic", preload: false },
      ],
      i18n: { locales: ["en", "de"], default: "en", routing: "prefix" },
    });
    expect(options.fonts?.map((font) => "weight" in font)).toEqual([true, false]);
  });
});

describe(
  "createModuleLoader, withModuleLoader and loadAppBundle",
  { timeout: LOAD_TEST_TIMEOUT_MS },
  () => {
    let root: string;

    beforeAll(async () => {
      const cwd = tempDir();
      const created = captureIO(cwd);
      expect(await run(["new", APP_NAME, "--ui", "none"], created.io)).toBe(EXIT_OK);
      expect(created.err()).toBe("");
      root = join(cwd, APP_NAME);
      installDependencies(root);
    }, LOAD_TEST_TIMEOUT_MS);

    it("loads the rex:app bundle and the app's own modules through one vite server", async () => {
      const loader = await createModuleLoader(root);
      try {
        expect(loader.root).toBe(resolve(root));
        const bundle = await loadAppBundle(loader);
        expect(bundle.name).toBe(APP_NAME);
        expect(bundle.pages.map((entry) => entry.id)).toEqual(["home"]);
        expect(bundle.actions.map((entry) => entry.id)).toEqual(["ping"]);
        expect(bundle.entities.map((entry) => entry.id)).toEqual(["note"]);
        expect(bundle.policies.map((entry) => entry.id)).toEqual(["viewer"]);
        expect(bundle.registry.get("action", "ping")).toBe(bundle.actions[0]);
        expect(bundle.manifest.app).toEqual({ name: APP_NAME });
        const loaded = await loader.load<{ readonly ping: AnyAction }>("/app/actions/ping.ts");
        expect(loaded.ping.id).toBe("ping");
        expect(loaded.ping).toBe(bundle.actions[0]);
        const again = await loader.load<{ readonly default: unknown }>(APP_MODULE_ID);
        expect(again.default).toBe(bundle);
      } finally {
        await loader.close();
      }
    });

    it("lets given rex options override the ones read from rex.config.ts", async () => {
      const loader = await createModuleLoader(root, { rex: { name: "renamed-app" } });
      try {
        const bundle = await loadAppBundle(loader);
        expect(bundle.name).toBe("renamed-app");
        expect(bundle.manifest.app).toEqual({ name: "renamed-app" });
      } finally {
        await loader.close();
      }
    });

    it("withModuleLoader hands the loader to use, returns its result and closes it afterwards", async () => {
      const seen: ModuleLoader[] = [];
      const name = await withModuleLoader(root, async (loader) => {
        seen.push(loader);
        return (await loadAppBundle(loader)).name;
      });
      expect(name).toBe(APP_NAME);
      const [closed] = seen;
      if (closed === undefined) throw new Error("use was not called");
      expect(closed.root).toBe(resolve(root));
      await expect(closed.load("/app/actions/ping.ts")).rejects.toThrow();
      await expect(
        withModuleLoader(root, async () => {
          throw new Error("use failed");
        }),
      ).rejects.toThrow("use failed");
    });

    it("locates a RexError thrown by an app module at its file and line", async () => {
      const file = join(root, "app", "data", "broken.ts");
      writeFileSync(
        file,
        [
          'import { RexError } from "@sidioralabs/rex";',
          "",
          'throw new RexError("REX315", "the notes store is broken");',
          "",
        ].join("\n"),
      );
      try {
        const failure = await withModuleLoader(root, async (loader) => {
          try {
            await loader.load("/app/data/broken.ts");
          } catch (error) {
            return error;
          }
          throw new Error("expected the broken module to fail");
        });
        expect(isRexError(failure)).toBe(true);
        const error = failure as RexError;
        expect(error.code).toBe("REX315");
        expect(error.detail).toBe("the notes store is broken");
        expect([error.file, error.line]).toEqual([file, 3]);
        expect(error.column).toBeGreaterThan(0);
      } finally {
        rmSync(file, { force: true });
      }
    });

    it("loads plain modules from a root without rex.config.ts using the given options only", async () => {
      const plain = tempDir();
      mkdirSync(join(plain, "app"));
      mkdirSync(join(plain, "lib"));
      writeFileSync(join(plain, "lib", "answer.ts"), "export const answer: number = 42;\n");
      const loader = await createModuleLoader(plain, { rex: { appDir: "app" } });
      try {
        expect(loader.root).toBe(plain);
        const loaded = await loader.load<{ readonly answer: number }>("/lib/answer.ts");
        expect(loaded.answer).toBe(42);
      } finally {
        await loader.close();
      }
    });
  },
);
