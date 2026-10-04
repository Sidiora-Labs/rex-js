import { rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { InvalidArgumentError, type RexCommand as Command } from "../args.ts";
import { build, normalizePath, type LogLevel, type Plugin } from "vite";
import { rex, type RexPluginOptions } from "../../vite/index.ts";
import { chunkBudgets, resolveBudgets } from "../../vite/budgets.ts";
import {
  formatPrerenderList,
  prerenderPages,
  writePrerenderList,
  type PrerenderRuntime,
} from "../../vite/prerender.ts";
import { RENDER_MODULE_ID, renderModulePlugin, ssrRuntimePath } from "../../vite/ssr.ts";
import { APP_MODULE_ID } from "../../vite/virtual.ts";
import {
  PRERENDER_LIST_FILE,
  PRERENDER_LIST_VERSION,
  type PrerenderList,
  type StaticPageEntry,
} from "../../server/adapters/static-cache.ts";
import type { RexDocumentAssets } from "../../server/ssr.ts";
import { readSsrAssets } from "../../vite/ssr-css.ts";
import {
  chunkTable,
  formatChunkTable,
  type ChunkRow,
  type OutputAssetLike,
  type OutputChunkLike,
} from "../../vite/split.ts";
import { loadRexConfig } from "../config.ts";
import { EXIT_FAILURE, RexCliExit, type RexCliIO } from "../index.ts";
import { configPluginOptions, loadAppBundle, withModuleLoader } from "../load.ts";
import { ensureCheckPasses } from "./check.ts";
import { appConfigPath, cliWarn, rexCliExit } from "./dev.ts";
import type { ResolvedBudgets } from "../../core/config.ts";
import type { DeprecationWarn } from "../../core/deprecated.ts";

export const DIST_DIR = "dist";
export const CLIENT_DIR = "client";
export const SERVER_FILE = "server.js";
export const DEFAULT_PORT = 3000;
export const SERVER_ENTRY_ID = "rex:server";
export const RESOLVED_SERVER_ENTRY_ID = "\0rex:server";
export const SERVING_PREFIX = "rex: serving ";
export const BUILD_TARGETS = ["node", "edge", "bun", "deno", "static"] as const;
export type BuildTarget = (typeof BUILD_TARGETS)[number];
export type ServerTarget = Exclude<BuildTarget, "static">;
export const DEFAULT_BUILD_TARGET: BuildTarget = "node";

export function isBuildTarget(value: string): value is BuildTarget {
  return (BUILD_TARGETS as readonly string[]).includes(value);
}

export function parseTarget(value: string): BuildTarget {
  if (!isBuildTarget(value)) {
    throw new InvalidArgumentError(`the target must be one of ${BUILD_TARGETS.join(", ")}`);
  }
  return value;
}

const MODULE_EXTENSION = import.meta.url.endsWith(".ts") ? ".ts" : ".js";

function sourcePath(from: string, ...segments: string[]): string {
  return normalizePath(resolve(dirname(fileURLToPath(from)), "..", "..", ...segments));
}

export function nodeRuntimePath(from: string = import.meta.url): string {
  return sourcePath(from, "server", `node${MODULE_EXTENSION}`);
}

export interface ServerRuntimePaths {
  readonly node: string;
  readonly bun: string;
  readonly deno: string;
  readonly edge: string;
  readonly server: string;
  readonly config: string;
  readonly actor: string;
}

export function serverRuntimePaths(from: string = import.meta.url): ServerRuntimePaths {
  return {
    node: nodeRuntimePath(from),
    bun: sourcePath(from, "server", "adapters", `bun${MODULE_EXTENSION}`),
    deno: sourcePath(from, "server", "adapters", `deno${MODULE_EXTENSION}`),
    edge: sourcePath(from, "server", "adapters", `edge${MODULE_EXTENSION}`),
    server: sourcePath(from, "server", `index${MODULE_EXTENSION}`),
    config: sourcePath(from, "core", `config${MODULE_EXTENSION}`),
    actor: sourcePath(from, "core", `actor${MODULE_EXTENSION}`),
  };
}

export interface ServerEntryOptions {
  readonly config: string;
  readonly runtime: ServerRuntimePaths;
  readonly target?: ServerTarget;
}

function appServerLines(options: ServerEntryOptions, appImport: boolean): string[] {
  const { runtime } = options;
  return [
    `import { createRexServer, memoryLedger } from ${JSON.stringify(runtime.server)};`,
    `import { configServer, readConfigExport } from ${JSON.stringify(runtime.config)};`,
    `import { anonymousActor } from ${JSON.stringify(runtime.actor)};`,
    `import exported from ${JSON.stringify(normalizePath(options.config))};`,
    ...(appImport ? [`import rexApp from ${JSON.stringify(APP_MODULE_ID)};`] : []),
    `import ${JSON.stringify(RENDER_MODULE_ID)};`,
    "",
    "const server = configServer(readConfigExport(exported), (app) =>",
    "  createRexServer({",
    "    registry: app.registry,",
    "    ledger: memoryLedger(),",
    "    actor: () => anonymousActor,",
    "    app: app.name,",
    "  }),",
    ");",
  ];
}

function listenLines(): string[] {
  return [
    `const port = Number(process.env.PORT ?? ${JSON.stringify(String(DEFAULT_PORT))});`,
    "const hostname = process.env.HOST;",
    `const clientDir = fileURLToPath(new URL(${JSON.stringify(`./${CLIENT_DIR}`)}, import.meta.url));`,
    `const prerendered = fileURLToPath(new URL(${JSON.stringify(`./${PRERENDER_LIST_FILE}`)}, import.meta.url));`,
  ];
}

const SERVING_LINE = `console.log(${JSON.stringify(SERVING_PREFIX)} + running.url);`;

function nodeServerEntry(options: ServerEntryOptions): string[] {
  return [
    'import { fileURLToPath } from "node:url";',
    `import { installNodeStaticPages, startPrerenderedNodeServer } from ${JSON.stringify(options.runtime.node)};`,
    ...appServerLines(options, true),
    ...listenLines(),
    "await installNodeStaticPages(rexApp.registry, { clientDir, list: prerendered });",
    "const running = await startPrerenderedNodeServer(",
    "  server,",
    '  hostname === undefined || hostname === ""',
    "    ? { port, clientDir, registry: rexApp.registry }",
    "    : { port, clientDir, hostname, registry: rexApp.registry },",
    ");",
    SERVING_LINE,
  ];
}

function runtimeServerEntry(options: ServerEntryOptions, target: "bun" | "deno"): string[] {
  const start = target === "bun" ? "startBunServer" : "startDenoServer";
  return [
    'import process from "node:process";',
    'import { fileURLToPath } from "node:url";',
    `import { createNodeApp, createPrerenderedNodeApp, installNodeStaticPages } from ${JSON.stringify(options.runtime.node)};`,
    `import { ${start} } from ${JSON.stringify(options.runtime[target])};`,
    ...appServerLines(options, true),
    ...listenLines(),
    "const cache = await installNodeStaticPages(rexApp.registry, { clientDir, list: prerendered });",
    "const site =",
    "  cache.size === 0",
    "    ? createNodeApp(server, clientDir)",
    "    : createPrerenderedNodeApp(server, clientDir, rexApp.registry);",
    `const running = await ${start}(`,
    "  site,",
    '  hostname === undefined || hostname === "" ? { port } : { port, hostname },',
    ");",
    SERVING_LINE,
  ];
}

function edgeServerEntry(options: ServerEntryOptions): string[] {
  return [
    `import { createEdgeHandler } from ${JSON.stringify(options.runtime.edge)};`,
    ...appServerLines(options, false),
    "",
    "export default createEdgeHandler(server);",
  ];
}

export function generateServerEntry(options: ServerEntryOptions): string {
  const target = options.target ?? "node";
  const lines =
    target === "node"
      ? nodeServerEntry(options)
      : target === "edge"
        ? edgeServerEntry(options)
        : runtimeServerEntry(options, target);
  return [...lines, ""].join("\n");
}

function serverEntryPlugin(options: ServerEntryOptions): Plugin {
  return {
    name: "rex:server-entry",
    enforce: "pre",
    resolveId(id) {
      return id === SERVER_ENTRY_ID ? RESOLVED_SERVER_ENTRY_ID : null;
    },
    load(id) {
      return id === RESOLVED_SERVER_ENTRY_ID ? generateServerEntry(options) : null;
    },
  };
}

export interface BuildOptions {
  readonly logLevel?: LogLevel;
  readonly warn?: DeprecationWarn;
  readonly target?: BuildTarget;
}

export interface BuildResult {
  readonly target: BuildTarget;
  readonly outDir: string;
  readonly clientDir: string;
  readonly serverFile: string | null;
  readonly apiOrigin: string | null;
  readonly chunks: readonly ChunkRow[];
  readonly prerendered: readonly StaticPageEntry[];
  readonly prerenderFile: string | null;
}

export interface ServerBuildOptions {
  readonly root: string;
  readonly outDir: string;
  readonly config: string;
  readonly target: ServerTarget;
  readonly assets: RexDocumentAssets;
  readonly rex: RexPluginOptions;
  readonly logLevel: LogLevel;
}

export async function buildServer(options: ServerBuildOptions): Promise<string> {
  await build({
    root: options.root,
    configFile: false,
    logLevel: options.logLevel,
    plugins: [
      renderModulePlugin(() => options.assets),
      ...rex(options.rex),
      serverEntryPlugin({
        config: options.config,
        runtime: serverRuntimePaths(),
        target: options.target,
      }),
    ],
    ssr: { noExternal: true, target: options.target === "edge" ? "webworker" : "node" },
    build: {
      ssr: true,
      outDir: options.outDir,
      emptyOutDir: false,
      copyPublicDir: false,
      minify: false,
      rolldownOptions: {
        input: { server: SERVER_ENTRY_ID },
        output: { format: "es", entryFileNames: SERVER_FILE },
      },
    },
  });
  return join(options.outDir, SERVER_FILE);
}

export function usesStaticPages(target: BuildTarget): boolean {
  return target === "node" || target === "bun" || target === "deno";
}

export interface PrerenderBuildOptions {
  readonly outDir: string;
  readonly clientDir: string;
  readonly assets: RexDocumentAssets;
  readonly rex: RexPluginOptions;
  readonly logLevel?: LogLevel;
  readonly plugins?: readonly Plugin[];
}

export interface PrerenderBuildResult {
  readonly list: PrerenderList;
  readonly file: string;
}

export async function prerenderBuild(
  root: string,
  options: PrerenderBuildOptions,
): Promise<PrerenderBuildResult> {
  const list = await withModuleLoader(
    root,
    async (loader) => {
      const bundle = await loadAppBundle(loader);
      const ssr = await loader.load<PrerenderRuntime & Record<string, unknown>>(ssrRuntimePath());
      return prerenderPages({ bundle, ssr, assets: options.assets }, { clientDir: options.clientDir });
    },
    {
      rex: options.rex,
      ...(options.logLevel === undefined ? {} : { logLevel: options.logLevel }),
      ...(options.plugins === undefined ? {} : { plugins: options.plugins }),
    },
  );
  return { list, file: writePrerenderList(options.outDir, list) };
}

type BuildOutput = Awaited<ReturnType<typeof build>>;

export function outputItems(result: BuildOutput): (OutputChunkLike | OutputAssetLike)[] {
  const outputs = Array.isArray(result) ? result : [result];
  return outputs.flatMap((output) =>
    "output" in output ? (output.output as readonly (OutputChunkLike | OutputAssetLike)[]) : [],
  );
}

export function overBudget(rows: readonly ChunkRow[]): readonly ChunkRow[] {
  return rows.filter((row) => row.over);
}

export async function buildApp(root: string, options: BuildOptions = {}): Promise<BuildResult> {
  const appRoot = resolve(root);
  const config = appConfigPath(appRoot);
  const logLevel = options.logLevel ?? "warn";
  const target = options.target ?? DEFAULT_BUILD_TARGET;
  let budgets: ResolvedBudgets;
  let pluginOptions: RexPluginOptions;
  let apiOrigin: string | null = null;
  try {
    const loaded = await loadRexConfig(
      appRoot,
      options.warn === undefined ? {} : { warn: options.warn },
    );
    budgets = resolveBudgets(loaded.read);
    pluginOptions = configPluginOptions(loaded.read);
    if (target === "static") {
      apiOrigin = loaded.read.options.client.apiOrigin;
      pluginOptions = { ...pluginOptions, apiOrigin };
    }
  } catch (error) {
    return rexCliExit(error);
  }
  const outDir = join(appRoot, DIST_DIR);
  const clientDir = join(outDir, CLIENT_DIR);
  rmSync(outDir, { recursive: true, force: true });

  const client = await build({
    root: appRoot,
    configFile: false,
    logLevel,
    plugins: rex(pluginOptions),
    build: { outDir: clientDir, emptyOutDir: true, manifest: true },
  });
  const chunks = chunkTable(outputItems(client), chunkBudgets(budgets));
  const result = { target, outDir, clientDir, apiOrigin, chunks };
  if (target === "static") {
    return { ...result, serverFile: null, prerendered: [], prerenderFile: null };
  }

  const assets = readSsrAssets(clientDir, { root: appRoot });
  const serverFile = await buildServer({
    root: appRoot,
    outDir,
    config,
    target,
    assets,
    rex: pluginOptions,
    logLevel,
  });
  if (!usesStaticPages(target)) {
    return { ...result, serverFile, prerendered: [], prerenderFile: null };
  }

  const prerendered = await prerenderBuild(appRoot, {
    outDir,
    clientDir,
    assets,
    rex: pluginOptions,
    logLevel,
  });

  return {
    ...result,
    serverFile,
    prerendered: prerendered.list.pages,
    prerenderFile: prerendered.file,
  };
}

export function writtenLayout(result: BuildResult): string {
  return result.serverFile === null
    ? `${DIST_DIR}/${CLIENT_DIR}/`
    : `${DIST_DIR}/${CLIENT_DIR}/ and ${DIST_DIR}/${SERVER_FILE}`;
}

export function startHint(result: BuildResult): string {
  const server = `${DIST_DIR}/${SERVER_FILE}`;
  switch (result.target) {
    case "node":
      return `start it with node ${server} (${result.serverFile})`;
    case "bun":
      return `start it with bun ${server} (${result.serverFile})`;
    case "deno":
      return `start it with deno run --allow-net --allow-read --allow-env ${server} (${result.serverFile})`;
    case "edge":
      return `deploy ${server} as the worker module (export default { fetch }) and ${DIST_DIR}/${CLIENT_DIR}/ as its static assets`;
    case "static":
      return `serve ${DIST_DIR}/${CLIENT_DIR}/ from any static host; the client calls ${result.apiOrigin ?? "the origin it is served from"}`;
  }
}

export function register(program: Command, io: RexCliIO): void {
  program
    .command("build")
    .description(
      `build the client into ${DIST_DIR}/${CLIENT_DIR} and, unless the target is static, the server into ${DIST_DIR}/${SERVER_FILE}`,
    )
    .option(
      "--target <target>",
      `runtime to build for: ${BUILD_TARGETS.join(", ")}`,
      parseTarget,
      DEFAULT_BUILD_TARGET,
    )
    .option("--no-check", "build without running rex check first")
    .action(async (options: { check: boolean; target: BuildTarget }) => {
      if (options.check) await ensureCheckPasses(io.cwd, io, "build");
      const result = await buildApp(io.cwd, { warn: cliWarn(io), target: options.target });
      io.out(formatChunkTable(result.chunks));
      io.out(`rex build: wrote ${writtenLayout(result)} for the ${result.target} target\n`);
      if (result.prerenderFile !== null) {
        io.out(
          formatPrerenderList(
            { version: PRERENDER_LIST_VERSION, pages: result.prerendered },
            `${DIST_DIR}/${CLIENT_DIR}`,
          ),
        );
      }
      const over = overBudget(result.chunks);
      if (over.length > 0) {
        throw new RexCliExit(
          EXIT_FAILURE,
          `rex build: ${over.map((row) => `${row.name} (${(row.gzip / 1024).toFixed(2)} KB gzip, budget ${row.budget} KB)`).join(", ")} over budget`,
        );
      }
      io.out(`rex build: ${startHint(result)}\n`);
    });
}
