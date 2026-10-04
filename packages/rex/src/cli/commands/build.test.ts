import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, normalizePath } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { PRERENDER_LIST_FILE } from "../../server/adapters/static-cache.ts";
import { SERVER_SPECIFIER } from "../../vite/boundary.ts";
import { chunkBudgets } from "../../vite/budgets.ts";
import type { ResolveContext } from "../../vite/resolve.ts";
import { chunkTable, pageChunkName, type ChunkRow } from "../../vite/split.ts";
import { RENDER_MODULE_ID } from "../../vite/ssr.ts";
import { APP_MODULE_ID } from "../../vite/virtual.ts";
import { InvalidArgumentError, RexArgsError, RexCommand } from "../args.ts";
import { restoringNodeEnv } from "../config.ts";
import { EXIT_FAILURE, RexCliExit, type RexCliIO } from "../index.ts";
import {
  BUILD_NODE_ENV,
  BUILD_TARGETS,
  CLIENT_DIR,
  DEFAULT_BUILD_TARGET,
  DEFAULT_PORT,
  DIST_DIR,
  MANIFEST_OUTPUT,
  RESOLVED_SERVER_ENTRY_ID,
  SERVER_ENTRY_ID,
  SERVER_FILE,
  SERVING_PREFIX,
  appServerRuntime,
  buildApp,
  generateServerEntry,
  isBuildTarget,
  nodeRuntimePath,
  outputItems,
  overBudget,
  parseTarget,
  register,
  serverRuntimePaths,
  serverRuntimePathsAt,
  startHint,
  usesStaticPages,
  writtenLayout,
  type BuildResult,
  type BuildTarget,
  type ServerRuntimePaths,
} from "./build.ts";

const here = dirname(fileURLToPath(import.meta.url));
const INSTALLED = "/opt/app/node_modules/@sidioralabs/rex/dist/server/index.js";
const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "rex-build-"));
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

type Resolution = Awaited<ReturnType<ResolveContext["resolve"]>>;
type ResolveArgs = Parameters<ResolveContext["resolve"]>;

function resolvingTo(result: Resolution, calls: ResolveArgs[] = []): ResolveContext {
  return {
    resolve: async (...args) => {
      calls.push(args);
      return result;
    },
  };
}

function buildResult(target: BuildTarget, apiOrigin: string | null = null): BuildResult {
  const outDir = "/opt/app/dist";
  const server = target === "static" ? null : join(outDir, SERVER_FILE);
  return {
    target,
    outDir,
    clientDir: join(outDir, CLIENT_DIR),
    serverFile: server,
    manifestFile: server === null ? null : join(outDir, MANIFEST_OUTPUT),
    apiOrigin,
    chunks: [],
    prerendered: [],
    prerenderFile: usesStaticPages(target) ? join(outDir, PRERENDER_LIST_FILE) : null,
    staticManifestFile: null,
    textFiles: [],
    shells: [],
  };
}

describe("build targets", () => {
  it("accepts every declared target and refuses anything else", () => {
    expect(BUILD_TARGETS).toEqual(["node", "edge", "bun", "deno", "static"]);
    expect(DEFAULT_BUILD_TARGET).toBe("node");
    for (const target of BUILD_TARGETS) {
      expect(isBuildTarget(target), target).toBe(true);
      expect(parseTarget(target), target).toBe(target);
    }
    for (const value of ["lambda", "Node", "", "node "]) {
      expect(isBuildTarget(value), value).toBe(false);
      expect(() => parseTarget(value), value).toThrow(InvalidArgumentError);
      expect(() => parseTarget(value), value).toThrow(
        `the target must be one of ${BUILD_TARGETS.join(", ")}`,
      );
    }
  });

  it("serves prerendered pages only from the runtimes that own a file system", () => {
    expect(BUILD_TARGETS.filter(usesStaticPages)).toEqual(["node", "bun", "deno"]);
    expect(BUILD_NODE_ENV).toBe("production");
    expect(RESOLVED_SERVER_ENTRY_ID).toBe(`\0${SERVER_ENTRY_ID}`);
    expect([DIST_DIR, CLIENT_DIR, SERVER_FILE, MANIFEST_OUTPUT, DEFAULT_PORT]).toEqual([
      "dist",
      "client",
      "server.js",
      "manifest.json",
      3000,
    ]);
  });
});

describe("server runtime paths", () => {
  it("locates its own runtime modules in the source tree", () => {
    const own = serverRuntimePaths();
    expect(nodeRuntimePath()).toBe(own.node);
    expect(own.server).toBe(normalizePath(resolve(here, "..", "..", "server", "index.ts")));
    expect(own.node).toBe(normalizePath(resolve(here, "..", "..", "server", "node.ts")));
    for (const [key, file] of Object.entries(own)) expect(existsSync(file), key).toBe(true);
  });

  it("derives the sibling runtime modules from any server entry", () => {
    const base = "/opt/app/node_modules/@sidioralabs/rex/dist";
    const expected: ServerRuntimePaths = {
      node: `${base}/server/node.js`,
      bun: `${base}/server/adapters/bun.js`,
      deno: `${base}/server/adapters/deno.js`,
      pagesText: `${base}/server/routes/pages-text.js`,
      edge: `${base}/server/adapters/edge.js`,
      server: INSTALLED,
      config: `${base}/core/config.js`,
      actor: `${base}/core/actor.js`,
      ssr: `${base}/server/ssr.js`,
    };
    expect(serverRuntimePathsAt(INSTALLED)).toEqual(expected);
    expect(serverRuntimePathsAt(`${base}/server/index.mjs`).ssr).toBe(`${base}/server/ssr.mjs`);
  });

  it("appServerRuntime follows the app's resolved server entry and falls back to its own", async () => {
    const own = serverRuntimePaths();
    const root = "/opt/app";
    const calls: ResolveArgs[] = [];
    expect(await appServerRuntime(resolvingTo({ id: INSTALLED }, calls), root)).toEqual(
      serverRuntimePathsAt(INSTALLED),
    );
    expect(calls).toEqual([[SERVER_SPECIFIER, join(root, "index.html"), { skipSelf: true }]]);
    expect(await appServerRuntime(resolvingTo(null), root)).toEqual(own);
    expect(await appServerRuntime(resolvingTo({ id: INSTALLED, external: true }), root)).toEqual(
      own,
    );
    expect(await appServerRuntime(resolvingTo({ id: "virtual:server" }), root)).toEqual(own);
  });
});

describe("generateServerEntry", () => {
  const runtime = serverRuntimePathsAt(INSTALLED);
  const options = {
    config: "/opt/app/rex.config.ts",
    manifest: "/opt/app/dist/manifest.json",
    runtime,
  };

  it("writes a node entry that installs static pages and prints the serving line", () => {
    const entry = generateServerEntry({ ...options, target: "node" });
    expect(generateServerEntry(options)).toBe(entry);
    expect(entry.endsWith("\n")).toBe(true);
    const lines = entry.split("\n");
    expect(lines).toContain(
      `import { installNodeStaticPages, startPrerenderedNodeServer } from ${JSON.stringify(runtime.node)};`,
    );
    expect(lines).toContain(
      `import { createRexServer, memoryLedger } from ${JSON.stringify(runtime.server)};`,
    );
    expect(lines).toContain(`import { anonymousActor } from ${JSON.stringify(runtime.actor)};`);
    expect(lines).toContain('import exported from "/opt/app/rex.config.ts";');
    expect(lines).toContain('import manifest from "/opt/app/dist/manifest.json";');
    expect(lines).toContain(`import rexApp from ${JSON.stringify(APP_MODULE_ID)};`);
    expect(lines).toContain(`import ${JSON.stringify(RENDER_MODULE_ID)};`);
    expect(lines).toContain(`const port = Number(process.env.PORT ?? "${DEFAULT_PORT}");`);
    expect(lines).toContain(`console.log(${JSON.stringify(SERVING_PREFIX)} + running.url);`);
    expect(entry).toContain(`new URL("./${CLIENT_DIR}", import.meta.url)`);
    expect(entry).toContain(`new URL("./${PRERENDER_LIST_FILE}", import.meta.url)`);
    expect(entry).toContain("const running = await startPrerenderedNodeServer(");
    for (const absent of ["createEdgeHandler", "startBunServer", "startDenoServer"]) {
      expect(entry).not.toContain(absent);
    }
  });

  it("writes bun and deno entries that start the runtime's own server", () => {
    for (const [target, start] of [
      ["bun", "startBunServer"],
      ["deno", "startDenoServer"],
    ] as const) {
      const entry = generateServerEntry({ ...options, target });
      expect(entry, target).toContain(
        `import { ${start} } from ${JSON.stringify(runtime[target])};`,
      );
      expect(entry, target).toContain(
        `import { createNodeApp, createPrerenderedNodeApp, installNodeStaticPages } from ${JSON.stringify(runtime.node)};`,
      );
      expect(entry, target).toContain(`const running = await ${start}(`);
      expect(entry, target).toContain(`import rexApp from ${JSON.stringify(APP_MODULE_ID)};`);
      expect(entry, target).toContain(
        `console.log(${JSON.stringify(SERVING_PREFIX)} + running.url);`,
      );
      expect(entry, target).not.toContain("startPrerenderedNodeServer");
      expect(entry, target).not.toContain(target === "bun" ? "startDenoServer" : "startBunServer");
    }
  });

  it("writes an edge entry that exports a fetch handler without node or the app module", () => {
    const entry = generateServerEntry({ ...options, target: "edge" });
    expect(entry).toContain(`import { createEdgeHandler } from ${JSON.stringify(runtime.edge)};`);
    expect(entry.endsWith("export default createEdgeHandler(server);\n")).toBe(true);
    expect(entry).toContain(`import ${JSON.stringify(RENDER_MODULE_ID)};`);
    expect(entry).toContain('import manifest from "/opt/app/dist/manifest.json";');
    for (const absent of [APP_MODULE_ID, "process.env", "node:url", "installNodeStaticPages"]) {
      expect(entry).not.toContain(absent);
    }
  });
});

describe("build output", () => {
  it("lists the chunks of a vite build and picks out the rows over budget", async () => {
    const root = tempDir();
    writeFileSync(
      join(root, "home.js"),
      'export const greeting = "hello";\nconsole.log(greeting);\n',
    );
    const name = pageChunkName("home");
    const output = await restoringNodeEnv(() =>
      build({
        root,
        configFile: false,
        logLevel: "silent",
        build: {
          write: false,
          minify: false,
          rolldownOptions: { input: { [name]: join(root, "home.js") } },
        },
      }),
    );
    const items = outputItems(output);
    expect(items.map((item) => item.type)).toContain("chunk");
    const rows = chunkTable(items, chunkBudgets());
    expect(rows.map((row) => row.name)).toEqual([name]);
    const [row] = rows as [ChunkRow];
    expect(row.budget).toBe(chunkBudgets().page);
    expect(row.gzip).toBeGreaterThan(0);
    expect(row.over).toBe(false);
    expect(overBudget(rows)).toEqual([]);
    const exceeded: ChunkRow = { ...row, gzip: (row.budget as number) * 1024 + 1, over: true };
    expect(overBudget([exceeded, row])).toEqual([exceeded]);
    if (!("output" in output)) throw new Error("vite build returned a watcher");
    expect(outputItems([output, output])).toHaveLength(items.length * 2);
  });

  it("describes the written layout and how to start each target", () => {
    expect(writtenLayout(buildResult("static"))).toBe(`${DIST_DIR}/${CLIENT_DIR}/`);
    for (const target of ["node", "edge", "bun", "deno"] as const) {
      expect(writtenLayout(buildResult(target)), target).toBe(
        `${DIST_DIR}/${CLIENT_DIR}/ and ${DIST_DIR}/${SERVER_FILE}`,
      );
    }
    const server = `${DIST_DIR}/${SERVER_FILE}`;
    expect(startHint(buildResult("node"))).toBe(
      `start it with node ${server} (/opt/app/dist/server.js)`,
    );
    expect(startHint(buildResult("bun"))).toBe(
      `start it with bun ${server} (/opt/app/dist/server.js)`,
    );
    expect(startHint(buildResult("deno"))).toBe(
      `start it with deno run --allow-net --allow-read --allow-env ${server} (/opt/app/dist/server.js)`,
    );
    expect(startHint(buildResult("edge"))).toBe(
      `deploy ${server} as the worker module (export default { fetch }) and ${DIST_DIR}/${CLIENT_DIR}/ as its static assets`,
    );
    expect(startHint(buildResult("static", "https://api.example.test"))).toBe(
      `serve ${DIST_DIR}/${CLIENT_DIR}/ from any static host; the client calls https://api.example.test`,
    );
    expect(startHint(buildResult("static"))).toBe(
      `serve ${DIST_DIR}/${CLIENT_DIR}/ from any static host; the client calls the origin it is served from`,
    );
  });
});

describe("buildApp and rex build", () => {
  it("refuses a root without rex.config.ts before writing anything", async () => {
    const root = tempDir();
    await expect(buildApp(root, { logLevel: "silent" })).rejects.toThrow(RexCliExit);
    await expect(buildApp(root)).rejects.toMatchObject({
      exitCode: EXIT_FAILURE,
      message: expect.stringContaining("REX100 rex.config.ts is missing"),
    });
    expect(existsSync(join(root, DIST_DIR))).toBe(false);
  });

  it("registers the target and check options and validates the target before building", async () => {
    const root = tempDir();
    const captured = captureIO(root);
    const program = new RexCommand("rex").configureOutput({
      writeOut: captured.io.out,
      writeErr: captured.io.err,
    });
    register(program, captured.io);
    const [listing] = program.listing().commands;
    expect(listing).toMatchObject({ name: "build", path: "rex build", arguments: [] });
    expect(listing?.options).toMatchObject([
      { long: "--target", value: "target", default: DEFAULT_BUILD_TARGET },
      { long: "--no-check", value: null, negate: true },
    ]);

    await expect(program.parseAsync(["build", "--target", "lambda"])).rejects.toThrow(RexArgsError);
    await expect(program.parseAsync(["build", "--target", "lambda"])).rejects.toThrow(
      `option '--target <target>' argument 'lambda' is invalid. the target must be one of ${BUILD_TARGETS.join(", ")}`,
    );
    await expect(program.parseAsync(["build", "--no-check"])).rejects.toMatchObject({
      exitCode: EXIT_FAILURE,
      message: expect.stringContaining("rex.config.ts is missing"),
    });
    await program.parseAsync(["build", "--help"]);
    expect(captured.out()).toContain("Usage: rex build [options]");
    expect(captured.out()).toContain("--no-check");
    expect(existsSync(join(root, DIST_DIR))).toBe(false);
  });
});
