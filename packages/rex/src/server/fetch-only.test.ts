import { builtinModules } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Plugin } from "vite";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const BUNDLE_TIMEOUT_MS = 120_000;
const NODE_SPECIFIER = /["'`]node:[a-z_/]+["'`]/;

const FETCH_ONLY_ENTRIES = {
  server: "src/server/index.ts",
  edge: "src/server/adapters/edge.ts",
  bun: "src/server/adapters/bun.ts",
  deno: "src/server/adapters/deno.ts",
} as const;

function isNodeBuiltin(specifier: string): boolean {
  if (specifier.startsWith("node:")) return true;
  const name = specifier.split("/")[0] ?? specifier;
  return builtinModules.includes(name);
}

interface BrowserBundle {
  readonly code: string;
  readonly builtins: readonly string[];
}

function builtinProbe(seen: string[]): Plugin {
  return {
    name: "rex-fetch-only-probe",
    enforce: "pre",
    resolveId(source, importer) {
      if (!isNodeBuiltin(source)) return null;
      seen.push(`${source} <- ${importer ?? "entry"}`);
      return { id: source, external: true };
    },
  };
}

async function bundleForBrowser(entries: Readonly<Record<string, string>>): Promise<BrowserBundle> {
  const builtins: string[] = [];
  const result = await build({
    root: packageRoot,
    configFile: false,
    logLevel: "silent",
    plugins: [builtinProbe(builtins)],
    build: {
      write: false,
      minify: false,
      lib: {
        entry: Object.fromEntries(
          Object.entries(entries).map(([name, source]) => [name, join(packageRoot, source)]),
        ),
        formats: ["es"],
      },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunks = outputs
    .flatMap((output) => ("output" in output ? output.output : []))
    .filter((item) => item.type === "chunk");
  expect(chunks.length).toBeGreaterThan(0);
  return { code: chunks.map((chunk) => chunk.code).join("\n"), builtins };
}

describe("rex/server is fetch-only", { timeout: BUNDLE_TIMEOUT_MS }, () => {
  it("bundles rex/server and the bun, deno and edge adapters for the browser with no node: specifier", async () => {
    const bundle = await bundleForBrowser(FETCH_ONLY_ENTRIES);
    expect(bundle.builtins).toEqual([]);
    expect(bundle.code).not.toMatch(NODE_SPECIFIER);
    expect(bundle.code).not.toContain("__vite-browser-external");
    expect(bundle.code).toContain("createRexServer");
    expect(bundle.code).toContain("createEdgeHandler");
  });

  it("detects the node: specifiers the node adapter needs", async () => {
    const bundle = await bundleForBrowser({ node: "src/server/adapters/node.ts" });
    expect(bundle.builtins.some((entry) => entry.startsWith("node:fs"))).toBe(true);
    expect(bundle.code).toMatch(NODE_SPECIFIER);
  });
});
