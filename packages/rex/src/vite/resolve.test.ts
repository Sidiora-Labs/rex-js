import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer, normalizePath, type Plugin, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rex } from "./plugin.ts";
import { resolveRuntimeEntry, runtimePaths } from "./resolve.ts";
import { APP_MODULE_ID, CLIENT_SPECIFIER, CORE_SPECIFIER } from "./virtual.ts";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..");
const fixtureRoot = join(here, "fixtures", "app");
const coreEntry = join(source, "index.ts");
const alias = [{ find: /^@sidioralabs\/rex$/, replacement: coreEntry }];
const PROBE = "\0rex-resolve-probe:";
const EXTERNAL_SPECIFIER = "rex-resolve-probe-external";
const RELATIVE_SPECIFIER = "rex-resolve-probe-relative";
const FALLBACK = "/opt/rex/dist/fallback.js";
const SERVER_TIMEOUT_MS = 60_000;

function probePlugin(): Plugin {
  return {
    name: "rex-resolve-probe",
    enforce: "pre",
    resolveId(id) {
      if (id === EXTERNAL_SPECIFIER) return { id: "/opt/vendor/index.js", external: true };
      if (id === RELATIVE_SPECIFIER) return { id: "./vendor/index.js", external: "relative" };
      return null;
    },
    async load(id) {
      if (!id.startsWith(PROBE)) return null;
      const specifier = decodeURIComponent(id.slice(PROBE.length));
      const resolved = await resolveRuntimeEntry(this, fixtureRoot, specifier, FALLBACK);
      return `export default ${JSON.stringify(resolved)};`;
    },
  };
}

describe("runtimePaths", () => {
  it("points at the package entries beside the plugin and swaps the extension for built output", () => {
    const paths = runtimePaths();
    expect(paths).toEqual({
      core: normalizePath(join(source, "index.ts")),
      client: normalizePath(join(source, "client", "index.ts")),
    });
    expect(existsSync(paths.core)).toBe(true);
    expect(existsSync(paths.client)).toBe(true);
    expect(runtimePaths(pathToFileURL("/opt/rex/dist/vite/index.js").href)).toEqual({
      core: "/opt/rex/dist/index.js",
      client: "/opt/rex/dist/client/index.js",
    });
    expect(runtimePaths(pathToFileURL("/opt/rex/src/vite/index.ts").href)).toEqual({
      core: "/opt/rex/src/index.ts",
      client: "/opt/rex/src/client/index.ts",
    });
    expect(runtimePaths(pathToFileURL("/opt/rex/dist/vite/index.mjs").href).core).toBe(
      "/opt/rex/dist/index.js",
    );
  });
});

describe(
  "resolveRuntimeEntry through a Vite plugin context",
  { timeout: SERVER_TIMEOUT_MS },
  () => {
    let vite: ViteDevServer;

    const probe = async (environment: "client" | "ssr", specifier: string): Promise<string> => {
      const loaded = await vite.environments[environment].pluginContainer.load(
        `${PROBE}${encodeURIComponent(specifier)}`,
      );
      const code = typeof loaded === "string" ? loaded : loaded?.code;
      const match = /^export default (.*);$/.exec(code ?? "");
      if (match === null) throw new Error(`the probe did not load: ${String(code)}`);
      return JSON.parse(match[1] as string) as string;
    };

    beforeAll(async () => {
      vite = await createServer({
        root: fixtureRoot,
        configFile: false,
        logLevel: "silent",
        appType: "custom",
        resolve: { alias },
        server: { middlewareMode: true, hmr: false, watch: null },
        plugins: [probePlugin(), ...rex({ name: "fixture" })],
      });
    });

    afterAll(async () => {
      await vite.close();
    });

    it("returns the absolute module the app resolves the package to", async () => {
      expect(await probe("client", CORE_SPECIFIER)).toBe(normalizePath(coreEntry));
      expect(await probe("ssr", CORE_SPECIFIER)).toBe(normalizePath(coreEntry));
      const client = await probe("client", CLIENT_SPECIFIER);
      expect(client).toBe(normalizePath(join(source, "client", "index.ts")));
      expect(client).not.toBe(FALLBACK);
    });

    it("falls back to the package entry beside the plugin when nothing resolves", async () => {
      expect(await probe("client", "@sidioralabs/rex-not-installed")).toBe(FALLBACK);
      expect(await probe("ssr", "@sidioralabs/rex-not-installed")).toBe(FALLBACK);
    });

    it("falls back when the resolution is virtual or external rather than a file", async () => {
      expect(await probe("client", APP_MODULE_ID)).toBe(FALLBACK);
      expect(await probe("ssr", APP_MODULE_ID)).toBe(FALLBACK);
      expect(await probe("client", EXTERNAL_SPECIFIER)).toBe(FALLBACK);
      expect(await probe("ssr", EXTERNAL_SPECIFIER)).toBe(FALLBACK);
      expect(await probe("client", RELATIVE_SPECIFIER)).toBe(FALLBACK);
      expect(await probe("ssr", "react")).not.toBe(FALLBACK);
    });
  },
);
