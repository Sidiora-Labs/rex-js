import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, normalizePath, parseSync, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SSR_ATTRIBUTE } from "../client/ssr-attribute.ts";
import {
  API_FETCH_EXPORT,
  entryModuleHook,
  generateEntryModule,
  runtimeStylesheets,
} from "./entry-module.ts";
import { REX_HOOKS } from "./hooks.ts";
import { createHookContext, rex } from "./plugin.ts";
import { runtimePaths } from "./resolve.ts";
import {
  APP_MODULE_ID,
  ENTRY_MODULE_ID,
  RESOLVED_ENTRY_MODULE_ID,
  ROOT_ELEMENT_ID,
  RUNTIME_STYLESHEETS,
} from "./virtual.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "fixtures", "app");
const coreEntry = join(here, "..", "index.ts");
const alias = [{ find: /^@sidioralabs\/rex$/, replacement: coreEntry }];
const CLIENT = "/opt/rex/dist/client/index.js";
const API_ORIGIN = "https://api.example.test";
const SERVER_TIMEOUT_MS = 60_000;

function lines(code: string): string[] {
  return code.split("\n");
}

describe("runtimeStylesheets", () => {
  it("names the runtime stylesheets beside the client entry", () => {
    expect(runtimeStylesheets(CLIENT)).toEqual([
      "/opt/rex/dist/client/tokens.css",
      "/opt/rex/dist/client/agent/density.css",
    ]);
    expect(runtimeStylesheets(CLIENT)).toHaveLength(RUNTIME_STYLESHEETS.length);
    for (const file of runtimeStylesheets(runtimePaths().client)) {
      expect(existsSync(file), file).toBe(true);
    }
  });
});

describe("generateEntryModule", () => {
  it("imports the stylesheets, mounts the app in the root element and hydrates a server-rendered one", () => {
    const code = generateEntryModule({ client: CLIENT });
    expect(parseSync("entry.js", code).errors).toEqual([]);
    const [tokens, density] = runtimeStylesheets(CLIENT);
    expect(lines(code).slice(0, 2)).toEqual([
      `import ${JSON.stringify(tokens)};`,
      `import ${JSON.stringify(density)};`,
    ]);
    expect(code).toContain('import { StrictMode, createElement } from "react";');
    expect(code).toContain('import { createRoot } from "react-dom/client";');
    expect(code).toContain(`import { createRexEntry } from ${JSON.stringify(CLIENT)};`);
    expect(code).toContain(
      `import { findRootElement, startRexEntry } from ${JSON.stringify(CLIENT)};`,
    );
    expect(code).toContain(`import app from ${JSON.stringify(APP_MODULE_ID)};`);
    expect(code).toContain(
      `const container = findRootElement(${JSON.stringify(ROOT_ELEMENT_ID)});`,
    );
    expect(code).toContain(`if (container.hasAttribute(${JSON.stringify(SSR_ATTRIBUTE)})) {`);
    expect(code).toContain("  startRexEntry(container, app, { dev: import.meta.env.DEV });");
    expect(code).toContain("  const RexEntry = createRexEntry(app);");
    expect(code).toContain(
      "  createRoot(container).render(createElement(StrictMode, null, createElement(RexEntry)));",
    );
    expect(code).not.toContain(API_FETCH_EXPORT);
    expect(code.endsWith("}\n")).toBe(true);
  });

  it("targets a custom root element and routes the RPC client at the API origin", () => {
    const code = generateEntryModule({ client: CLIENT, rootElement: "app", apiOrigin: API_ORIGIN });
    expect(parseSync("entry.js", code).errors).toEqual([]);
    expect(API_FETCH_EXPORT).toBe("apiFetch");
    expect(code).toContain(`import { apiFetch } from ${JSON.stringify(CLIENT)};`);
    expect(code).toContain('const container = findRootElement("app");');
    expect(code).toContain(
      `  startRexEntry(container, app, { dev: import.meta.env.DEV, baseUrl: ${JSON.stringify(API_ORIGIN)}, fetch: apiFetch });`,
    );
    expect(code).toContain(
      `  const RexEntry = createRexEntry(app, { baseUrl: ${JSON.stringify(API_ORIGIN)}, fetch: apiFetch });`,
    );
    expect(code).not.toContain(`findRootElement(${JSON.stringify(ROOT_ELEMENT_ID)})`);
  });

  it("treats a null API origin like none", () => {
    expect(generateEntryModule({ client: CLIENT, apiOrigin: null })).toBe(
      generateEntryModule({ client: CLIENT }),
    );
    expect(generateEntryModule({ client: CLIENT, rootElement: ROOT_ELEMENT_ID })).toBe(
      generateEntryModule({ client: CLIENT }),
    );
  });
});

describe("entryModuleHook", () => {
  it("is a pre plugin in the ordered hook list", () => {
    const plugin = entryModuleHook(createHookContext());
    expect(plugin.name).toBe("rex:entry");
    expect(plugin.enforce).toBe("pre");
    expect(REX_HOOKS).toContain(entryModuleHook);
  });

  describe("on the dev server", { timeout: SERVER_TIMEOUT_MS }, () => {
    let vite: ViteDevServer;

    beforeAll(async () => {
      vite = await createServer({
        root: fixtureRoot,
        configFile: false,
        logLevel: "silent",
        appType: "custom",
        resolve: { alias },
        server: { middlewareMode: true, hmr: false, watch: null },
        plugins: rex({ name: "fixture", apiOrigin: API_ORIGIN }),
      });
    });

    afterAll(async () => {
      await vite.close();
    });

    it("serves /@rex/entry generated against the resolved client entry and the API origin", async () => {
      const container = vite.environments.client.pluginContainer;
      expect((await container.resolveId(ENTRY_MODULE_ID))?.id).toBe(RESOLVED_ENTRY_MODULE_ID);
      expect((await container.resolveId("/@rex/other"))?.id).not.toBe(RESOLVED_ENTRY_MODULE_ID);
      const loaded = await container.load(RESOLVED_ENTRY_MODULE_ID);
      const code = typeof loaded === "string" ? loaded : loaded?.code;
      const client = normalizePath(join(here, "..", "client", "index.ts"));
      expect(code).toBe(generateEntryModule({ client, apiOrigin: API_ORIGIN }));
      expect(code).toContain(`import { apiFetch } from ${JSON.stringify(client)};`);
      expect(code).toContain(`baseUrl: ${JSON.stringify(API_ORIGIN)}`);
    });
  });
});
