import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, normalizePath } from "vite";
import { describe, expect, it } from "vitest";
import { COMPILER_RUNTIME, REACT_COMPILER_TARGET, shouldCompile } from "./compiler.ts";
import { rex } from "./plugin.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "fixtures", "app");
const coreEntry = join(here, "..", "index.ts");
const alias = [{ find: /^@sidioralabs\/rex$/, replacement: coreEntry }];
const BUILD_TIMEOUT_MS = 120_000;

async function buildFixture(compiler: boolean | undefined) {
  const result = await build({
    root: fixtureRoot,
    configFile: false,
    logLevel: "silent",
    resolve: { alias },
    plugins: rex(compiler === undefined ? { name: "fixture" } : { name: "fixture", compiler }),
    build: {
      write: false,
      minify: false,
      rolldownOptions: { external: [/^react(\/.*)?$/, /^react-dom(\/.*)?$/] },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  return outputs
    .flatMap((output) => ("output" in output ? output.output : []))
    .filter((item) => item.type === "chunk");
}

function pageChunk(chunks: Awaited<ReturnType<typeof buildFixture>>, name: string) {
  const chunk = chunks.find((item) => item.name === name);
  if (chunk === undefined) throw new Error(`no ${name} chunk`);
  return chunk;
}

describe("vite/compiler", { timeout: BUILD_TIMEOUT_MS }, () => {
  it("compiles parts with the React Compiler by default", async () => {
    const chunks = await buildFixture(undefined);
    const home = pageChunk(chunks, "page-home");
    expect(home.moduleIds.map(normalizePath)).toContain(
      normalizePath(join(fixtureRoot, "app/pages/home/regions/list/parts/NoteRow.tsx")),
    );
    expect(home.imports).toContain(COMPILER_RUNTIME);
    expect(home.code).toMatch(/from "react\/compiler-runtime"/);
    expect(home.code).toContain("react.memo_cache_sentinel");
  });

  it("leaves the compiler runtime out when compiler is false", async () => {
    const chunks = await buildFixture(false);
    const home = pageChunk(chunks, "page-home");
    expect(home.imports).not.toContain(COMPILER_RUNTIME);
    for (const chunk of chunks) expect(chunk.code).not.toContain("react/compiler-runtime");
  });

  it("targets React 19 and only compiles application script modules", () => {
    expect(REACT_COMPILER_TARGET).toBe("19");
    const filter = /\b[A-Z]/;
    expect(shouldCompile("/app/pages/home/view.tsx", "export function View() {}", filter)).toBe(true);
    expect(shouldCompile("/app/pages/home/view.tsx?v=1", "export function View() {}", filter)).toBe(
      true,
    );
    expect(shouldCompile("/node_modules/x/index.js", "export function View() {}", filter)).toBe(false);
    expect(shouldCompile("\0rex:app", "export function View() {}", filter)).toBe(false);
    expect(shouldCompile("/app/styles.css", "Body {}", filter)).toBe(false);
    expect(shouldCompile("/app/types.d.ts", "export type A = 1", filter)).toBe(false);
    expect(shouldCompile("/app/util.ts", "export const a = 1", filter)).toBe(false);
  });
});
