import { rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RexCommand as Command } from "../args.ts";
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

const MODULE_EXTENSION = import.meta.url.endsWith(".ts") ? ".ts" : ".js";

function sourcePath(from: string, ...segments: string[]): string {
  return normalizePath(resolve(dirname(fileURLToPath(from)), "..", "..", ...segments));
}

export function nodeRuntimePath(from: string = import.meta.url): string {
  return sourcePath(from, "server", `node${MODULE_EXTENSION}`);
}

export interface ServerRuntimePaths {
  readonly node: string;
  readonly server: string;
  readonly config: string;
  readonly actor: string;
}

export function serverRuntimePaths(from: string = import.meta.url): ServerRuntimePaths {
  return {
    node: nodeRuntimePath(from),
    server: sourcePath(from, "server", `index${MODULE_EXTENSION}`),
    config: sourcePath(from, "core", `config${MODULE_EXTENSION}`),
    actor: sourcePath(from, "core", `actor${MODULE_EXTENSION}`),
  };
}

export interface ServerEntryOptions {
  readonly config: string;
  readonly runtime: ServerRuntimePaths;
}

export function generateServerEntry(options: ServerEntryOptions): string {
  const { runtime } = options;
  return [
    'import { fileURLToPath } from "node:url";',
    `import { installNodeStaticPages, startPrerenderedNodeServer } from ${JSON.stringify(runtime.node)};`,
    `import { createRexServer, memoryLedger } from ${JSON.stringify(runtime.server)};`,
    `import { configServer, readConfigExport } from ${JSON.stringify(runtime.config)};`,
    `import { anonymousActor } from ${JSON.stringify(runtime.actor)};`,
    `import exported from ${JSON.stringify(normalizePath(options.config))};`,
    `import rexApp from ${JSON.stringify(APP_MODULE_ID)};`,
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
    `const port = Number(process.env.PORT ?? ${JSON.stringify(String(DEFAULT_PORT))});`,
    "const hostname = process.env.HOST;",
    `const clientDir = fileURLToPath(new URL(${JSON.stringify(`./${CLIENT_DIR}`)}, import.meta.url));`,
    `const prerendered = fileURLToPath(new URL(${JSON.stringify(`./${PRERENDER_LIST_FILE}`)}, import.meta.url));`,
    "await installNodeStaticPages(rexApp.registry, { clientDir, list: prerendered });",
    "const running = await startPrerenderedNodeServer(",
    "  server,",
    "  hostname === undefined || hostname === \"\"",
    "    ? { port, clientDir, registry: rexApp.registry }",
    "    : { port, clientDir, hostname, registry: rexApp.registry },",
    ");",
    `console.log(${JSON.stringify(SERVING_PREFIX)} + running.url);`,
    "",
  ].join("\n");
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
}

export interface BuildResult {
  readonly outDir: string;
  readonly clientDir: string;
  readonly serverFile: string;
  readonly chunks: readonly ChunkRow[];
  readonly prerendered: readonly StaticPageEntry[];
  readonly prerenderFile: string;
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
  let budgets: ResolvedBudgets;
  let pluginOptions: RexPluginOptions;
  try {
    const loaded = await loadRexConfig(
      appRoot,
      options.warn === undefined ? {} : { warn: options.warn },
    );
    budgets = resolveBudgets(loaded.read);
    pluginOptions = configPluginOptions(loaded.read);
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
  const assets = readSsrAssets(clientDir, { root: appRoot });

  await build({
    root: appRoot,
    configFile: false,
    logLevel,
    plugins: [
      renderModulePlugin(() => assets),
      ...rex(pluginOptions),
      serverEntryPlugin({ config, runtime: serverRuntimePaths() }),
    ],
    ssr: { noExternal: true, target: "node" },
    build: {
      ssr: true,
      outDir,
      emptyOutDir: false,
      copyPublicDir: false,
      minify: false,
      rolldownOptions: {
        input: { server: SERVER_ENTRY_ID },
        output: { format: "es", entryFileNames: SERVER_FILE },
      },
    },
  });

  const prerendered = await prerenderBuild(appRoot, {
    outDir,
    clientDir,
    assets,
    rex: pluginOptions,
    logLevel,
  });

  return {
    outDir,
    clientDir,
    serverFile: join(outDir, SERVER_FILE),
    chunks,
    prerendered: prerendered.list.pages,
    prerenderFile: prerendered.file,
  };
}

export function register(program: Command, io: RexCliIO): void {
  program
    .command("build")
    .description(
      `build the client into ${DIST_DIR}/${CLIENT_DIR} and the server into ${DIST_DIR}/${SERVER_FILE}`,
    )
    .option("--no-check", "build without running rex check first")
    .action(async (options: { check: boolean }) => {
      if (options.check) await ensureCheckPasses(io.cwd, io, "build");
      const result = await buildApp(io.cwd, { warn: cliWarn(io) });
      io.out(formatChunkTable(result.chunks));
      io.out(`rex build: wrote ${DIST_DIR}/${CLIENT_DIR}/ and ${DIST_DIR}/${SERVER_FILE}\n`);
      io.out(
        formatPrerenderList(
          { version: PRERENDER_LIST_VERSION, pages: result.prerendered },
          `${DIST_DIR}/${CLIENT_DIR}`,
        ),
      );
      const over = overBudget(result.chunks);
      if (over.length > 0) {
        throw new RexCliExit(
          EXIT_FAILURE,
          `rex build: ${over.map((row) => `${row.name} (${(row.gzip / 1024).toFixed(2)} KB gzip, budget ${row.budget} KB)`).join(", ")} over budget`,
        );
      }
      io.out(`rex build: start it with node ${DIST_DIR}/${SERVER_FILE} (${result.serverFile})\n`);
    });
}
