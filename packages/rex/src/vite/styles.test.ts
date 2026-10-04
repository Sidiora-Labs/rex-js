import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Plugin } from "vite";
import { describe, expect, it } from "vitest";
import { isRexError } from "../core/errors.ts";
import { REX_HOOKS } from "./hooks.ts";
import { createHookContext, rex } from "./plugin.ts";
import {
  CSS_MODULE_FILE,
  isCssModule,
  loadTailwind,
  stylesHook,
  TAILWIND_PLUGIN,
  tailwindEnabled,
} from "./styles.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "..", "check", "fixtures", "styling", "pass");
const coreEntry = join(here, "..", "index.ts");
const BUILD_TIMEOUT_MS = 120_000;
const TAILWIND_PLUGINS = [
  "@tailwindcss/vite:scan",
  "@tailwindcss/vite:generate:serve",
  "@tailwindcss/vite:generate:build",
];

function tailwindStylesheet(): string {
  const local = createRequire(import.meta.url);
  const fromPlugin = createRequire(local.resolve(TAILWIND_PLUGIN));
  return join(dirname(dirname(fromPlugin.resolve("tailwindcss"))), "index.css");
}

function pluginNames(plugins: readonly Plugin[]): string[] {
  return plugins.map((plugin) => plugin.name);
}

async function buildFixture() {
  const result = await build({
    root: fixtureRoot,
    configFile: false,
    logLevel: "silent",
    resolve: {
      alias: [
        { find: /^@sidioralabs\/rex$/, replacement: coreEntry },
        { find: /^tailwindcss$/, replacement: tailwindStylesheet() },
      ],
    },
    plugins: rex({ name: "styling", tailwind: true }),
    build: {
      write: false,
      minify: false,
      rolldownOptions: { external: [/^react(\/.*)?$/, /^react-dom(\/.*)?$/] },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  return outputs.flatMap((output) => ("output" in output ? output.output : []));
}

function caught(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw");
}

describe("vite/styles", () => {
  it("is registered in the ordered hook list", () => {
    expect(REX_HOOKS).toContain(stylesHook);
  });

  it("enables Tailwind when tailwind is true or ui is designx", () => {
    expect(tailwindEnabled({})).toBe(false);
    expect(tailwindEnabled({ tailwind: false })).toBe(false);
    expect(tailwindEnabled({ ui: "none" })).toBe(false);
    expect(tailwindEnabled({ tailwind: true })).toBe(true);
    expect(tailwindEnabled({ ui: "designx" })).toBe(true);
  });

  it("adds the @tailwindcss/vite plugins only when Tailwind is enabled", () => {
    expect(stylesHook(createHookContext({}))).toEqual([]);
    expect(pluginNames(stylesHook(createHookContext({ tailwind: true })))).toEqual(
      TAILWIND_PLUGINS,
    );
    expect(pluginNames(stylesHook(createHookContext({ ui: "designx" })))).toEqual(TAILWIND_PLUGINS);
    const names = pluginNames(rex({ tailwind: true }));
    for (const name of TAILWIND_PLUGINS) expect(names).toContain(name);
    const plain = pluginNames(rex());
    for (const name of TAILWIND_PLUGINS) expect(plain).not.toContain(name);
  });

  it("fails with a coded error when @tailwindcss/vite cannot be loaded", () => {
    const missing = "@tailwindcss/vite-not-installed";
    const outside = pathToFileURL(join(tmpdir(), "rex-styles-missing", "entry.js")).href;
    const flag = caught(() => loadTailwind({ tailwind: true }, outside, missing));
    expect(isRexError(flag)).toBe(true);
    expect((flag as { code: string }).code).toBe("REX122");
    expect((flag as Error).message).toContain(`tailwind is true but ${missing} cannot be loaded`);
    expect((flag as { hint: string }).hint).toBe(
      `Install ${missing} and tailwindcss 4, or set tailwind: false in rex.config.ts.`,
    );
    const kit = caught(() => loadTailwind({ ui: "designx" }, outside, missing));
    expect(isRexError(kit)).toBe(true);
    expect((kit as { code: string }).code).toBe("REX120");
    expect((kit as { hint: string }).hint).toContain('ui: "none"');
  });

  it("treats *.module.* stylesheets as CSS Modules, Vite's default behaviour", () => {
    expect(isCssModule("/app/pages/home/regions/cards/parts/Card.module.css")).toBe(true);
    expect(isCssModule("./Card.module.scss")).toBe(true);
    expect(isCssModule("/app/Card.module.css?used")).toBe(true);
    expect(isCssModule("/styles.css")).toBe(false);
    expect(isCssModule("/app/module.css")).toBe(false);
    expect(CSS_MODULE_FILE.test("Card.module.ts")).toBe(false);
  });

  it(
    "builds a Rex app with Tailwind 4 utilities from the theme and scoped CSS Modules",
    { timeout: BUILD_TIMEOUT_MS },
    async () => {
      const output = await buildFixture();
      const css = output
        .filter((item) => item.type === "asset" && item.fileName.endsWith(".css"))
        .map((item) => (item.type === "asset" ? String(item.source) : ""))
        .join("\n");
      const js = output
        .filter((item) => item.type === "chunk")
        .map((item) => (item.type === "chunk" ? item.code : ""))
        .join("\n");
      expect(css).toMatch(/\.bg-surface\s*\{\s*background-color:\s*var\(--color-surface\)/);
      expect(css).toMatch(/\.text-white\s*\{\s*color:\s*var\(--color-white\)/);
      expect(css).toMatch(/\.p-gutter\s*\{\s*padding:\s*var\(--spacing-gutter\)/);
      expect(css).toMatch(/--color-surface:\s*#f/);
      expect(css).not.toContain('@import "tailwindcss"');
      const scoped = [...css.matchAll(/\.([A-Za-z0-9_-]*card[A-Za-z0-9_-]*)\s*\{/g)].map(
        (match) => match[1] ?? "",
      );
      expect(scoped.length).toBeGreaterThan(0);
      for (const name of scoped) {
        expect(name).not.toBe("card");
        expect(js).toContain(name);
      }
    },
  );
});
