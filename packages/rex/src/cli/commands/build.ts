import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_BUILD_TARGET, type BuildTarget } from "../registrations/build.ts";
export {
  BUILD_TARGETS,
  DEFAULT_BUILD_TARGET,
  isBuildTarget,
  parseTarget,
  register,
  type BuildTarget,
} from "../registrations/build.ts";
import { build, normalizePath, type LogLevel, type Plugin } from "vite";
import { rex, type RexPluginOptions } from "../../vite/index.ts";
import { chunkBudgets, resolveBudgets } from "../../vite/budgets.ts";
import {
  SHELL_DOCUMENT_FILE,
  formatPrerenderList,
  prerenderPages,
  type PrerenderRuntime,
  type PrerenderTextRuntime,
  type ShellDocumentEntry,
} from "../../vite/prerender.ts";
import { outputFiles, runStaticOutputs, type StaticOutputRun } from "../../vite/outputs.ts";
import { prerenderListOutput } from "../../vite/outputs/prerender-list.ts";
import { shellDocumentsOutput } from "../../vite/outputs/shell-documents.ts";
import { staticManifestOutput } from "../../vite/outputs/static-manifest.ts";
import { textFilesOutput } from "../../vite/outputs/text-files.ts";
import { buildWriter, hostFor, writeHostFiles, type RexHostWriter } from "../hosts/index.ts";
import type { RexAppBundle, RexAppConfig } from "../../vite/app-module.ts";
import { SERVER_SPECIFIER } from "../../vite/boundary.ts";
import { resolveRuntimeEntry, type ResolveContext } from "../../vite/resolve.ts";
import {
  RENDER_MODULE_ID,
  RESOLVED_RENDER_MODULE_ID,
  generateRenderModule,
} from "../../vite/ssr.ts";
import { APP_MODULE_ID } from "../../vite/virtual.ts";
import {
  PRERENDER_LIST_FILE,
  PRERENDER_LIST_VERSION,
  type PrerenderList,
  type StaticPageEntry,
} from "../../server/adapters/static-cache.ts";
import type { RexDocumentAssets } from "../../server/ssr.ts";
import { readSsrAssets } from "../../vite/ssr-css.ts";
import { stableStringify } from "../../manifest/build.ts";
import type { Manifest } from "../../manifest/types.ts";
import {
  chunkTable,
  formatChunkTable,
  formatStaticImportClosures,
  staticImportClosures,
  type ChunkRow,
  type OutputAssetLike,
  type StaticImportChunk,
  type StaticImportClosure,
} from "../../vite/split.ts";
import { loadRexConfig, restoringNodeEnv } from "../config.ts";
import { EXIT_FAILURE, RexCliExit, type RexCliIO } from "../index.ts";
import {
  configPluginOptions,
  loadAppBundle,
  withModuleLoader,
  type ModuleLoader,
} from "../load.ts";
import { ensureCheckPasses } from "./check.ts";
import { appConfigPath, cliWarn, rexCliExit } from "./dev.ts";
import type { ResolvedBudgets } from "../../core/config.ts";
import { RexError } from "../../core/errors.ts";
import type { DeprecationWarn } from "../../core/deprecated.ts";

export const DIST_DIR = "dist";
export const CLIENT_DIR = "client";
export const SERVER_FILE = "server.js";
export const MANIFEST_OUTPUT = "manifest.json";
export const DEFAULT_PORT = 3000;
export const SERVER_ENTRY_ID = "rex:server";
export const RESOLVED_SERVER_ENTRY_ID = "\0rex:server";
export const SERVING_PREFIX = "rex: serving ";
export type ServerTarget = Exclude<BuildTarget, "static">;
export const BUILD_NODE_ENV = "production";

function productionBuildConfig(): {
  readonly mode: string;
  readonly define: Record<string, string>;
  readonly oxc: { readonly jsx: { readonly development: boolean } };
} {
  return {
    mode: BUILD_NODE_ENV,
    define: { "process.env.NODE_ENV": JSON.stringify(BUILD_NODE_ENV) },
    oxc: { jsx: { development: false } },
  };
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
  readonly ssr: string;
  readonly pagesText: string;
}

export function serverRuntimePathsAt(serverEntry: string): ServerRuntimePaths {
  const extension = extname(serverEntry);
  const base = dirname(dirname(serverEntry));
  const file = (...segments: string[]) => normalizePath(`${join(base, ...segments)}${extension}`);
  return {
    node: file("server", "node"),
    bun: file("server", "adapters", "bun"),
    deno: file("server", "adapters", "deno"),
    edge: file("server", "adapters", "edge"),
    server: normalizePath(serverEntry),
    config: file("core", "config"),
    actor: file("core", "actor"),
    ssr: file("server", "ssr"),
    pagesText: file("server", "routes", "pages-text"),
  };
}

export function serverRuntimePaths(from: string = import.meta.url): ServerRuntimePaths {
  return serverRuntimePathsAt(sourcePath(from, "server", `index${MODULE_EXTENSION}`));
}

export async function appServerRuntime(
  context: ResolveContext,
  root: string,
): Promise<ServerRuntimePaths> {
  const own = serverRuntimePaths();
  return serverRuntimePathsAt(
    await resolveRuntimeEntry(context, root, SERVER_SPECIFIER, own.server),
  );
}

export function loaderResolveContext(loader: ModuleLoader): ResolveContext {
  const container = loader.vite.environments.ssr.pluginContainer;
  return { resolve: (source, importer) => container.resolveId(source, importer) };
}

export interface ServerEntryOptions {
  readonly config: string;
  readonly runtime: ServerRuntimePaths;
  readonly target?: ServerTarget;
  readonly manifest: string;
}

function appServerLines(options: ServerEntryOptions, appImport: boolean): string[] {
  const { runtime } = options;
  return [
    `import { createRexServer, memoryLedger } from ${JSON.stringify(runtime.server)};`,
    `import { configServer, configServerOptions, readConfigExport } from ${JSON.stringify(runtime.config)};`,
    `import { anonymousActor } from ${JSON.stringify(runtime.actor)};`,
    `import exported from ${JSON.stringify(normalizePath(options.config))};`,
    `import manifest from ${JSON.stringify(normalizePath(options.manifest))};`,
    ...(appImport ? [`import rexApp from ${JSON.stringify(APP_MODULE_ID)};`] : []),
    `import ${JSON.stringify(RENDER_MODULE_ID)};`,
    "",
    "const config = readConfigExport(exported);",
    "const server = configServer(config, (app) =>",
    "  createRexServer({",
    "    registry: app.registry,",
    "    ledger: memoryLedger(),",
    "    actor: () => anonymousActor,",
    "    app: app.name,",
    "    manifest,",
    "    ...configServerOptions(config),",
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

export interface ServerEntryPluginOptions extends Omit<ServerEntryOptions, "runtime"> {
  readonly root: string;
  readonly assets: RexDocumentAssets;
}

function serverEntryPlugin(options: ServerEntryPluginOptions): Plugin {
  let runtime: Promise<ServerRuntimePaths> | null = null;
  return {
    name: "rex:server-entry",
    enforce: "pre",
    buildStart() {
      runtime = null;
    },
    resolveId(id) {
      if (id === SERVER_ENTRY_ID) return RESOLVED_SERVER_ENTRY_ID;
      return id === RENDER_MODULE_ID ? RESOLVED_RENDER_MODULE_ID : null;
    },
    async load(id) {
      if (id !== RESOLVED_SERVER_ENTRY_ID && id !== RESOLVED_RENDER_MODULE_ID) return null;
      runtime ??= appServerRuntime(this, options.root);
      const paths = await runtime;
      if (id === RESOLVED_RENDER_MODULE_ID) {
        return generateRenderModule({ ssr: paths.ssr, assets: options.assets });
      }
      return generateServerEntry({
        config: options.config,
        manifest: options.manifest,
        runtime: paths,
        ...(options.target === undefined ? {} : { target: options.target }),
      });
    },
  };
}

export interface BuildOptions {
  readonly logLevel?: LogLevel;
  readonly warn?: DeprecationWarn;
  readonly target?: BuildTarget;
  readonly reportChunks?: (
    chunks: readonly ChunkRow[],
    closures: readonly StaticImportClosure[],
  ) => void;
}

export interface BuildResult {
  readonly target: BuildTarget;
  readonly outDir: string;
  readonly clientDir: string;
  readonly serverFile: string | null;
  readonly manifestFile: string | null;
  readonly apiOrigin: string | null;
  readonly chunks: readonly ChunkRow[];
  readonly prerendered: readonly StaticPageEntry[];
  readonly prerenderFile: string | null;
  readonly staticManifestFile: string | null;
  readonly textFiles: readonly string[];
  readonly shells: readonly ShellDocumentEntry[];
  readonly outputs: readonly StaticOutputRun[];
  readonly host: string | null;
  readonly hostFiles: readonly string[];
}

export interface ServerBuildOptions {
  readonly root: string;
  readonly outDir: string;
  readonly config: string;
  readonly target: ServerTarget;
  readonly assets: RexDocumentAssets;
  readonly manifest: string;
  readonly rex: RexPluginOptions;
  readonly logLevel: LogLevel;
}

export async function buildServer(options: ServerBuildOptions): Promise<string> {
  await restoringNodeEnv(() =>
    build({
      root: options.root,
      configFile: false,
      ...productionBuildConfig(),
      logLevel: options.logLevel,
      plugins: [
        serverEntryPlugin({
          root: options.root,
          config: options.config,
          target: options.target,
          manifest: options.manifest,
          assets: options.assets,
        }),
        ...rex(options.rex),
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
    }),
  );
  return join(options.outDir, SERVER_FILE);
}

export function usesStaticPages(target: BuildTarget): boolean {
  return target === "node" || target === "bun" || target === "deno";
}

export interface PrerenderBuildOptions {
  readonly target?: BuildTarget;
  readonly outDir: string;
  readonly clientDir: string;
  readonly static?: StaticOutputOptions;
  readonly assets: RexDocumentAssets;
  readonly rex: RexPluginOptions;
  readonly logLevel?: LogLevel;
  readonly plugins?: readonly Plugin[];
}

export interface StaticOutputOptions {
  readonly shell: string;
}

export interface StaticOutputs {
  readonly manifestFile: string;
  readonly textFiles: readonly string[];
  readonly shells: readonly ShellDocumentEntry[];
}

export interface PrerenderBuildResult {
  readonly list: PrerenderList;
  readonly file: string;
  readonly static: StaticOutputs | null;
  readonly manifest: Manifest;
  readonly outputs: readonly StaticOutputRun[];
}

function clientRelative(clientDir: string, file: string): string {
  return normalizePath(relative(resolve(clientDir), file));
}

export async function prerenderBuild(
  root: string,
  options: PrerenderBuildOptions,
): Promise<PrerenderBuildResult> {
  const staticOptions = options.static;
  const built = await withModuleLoader(
    root,
    async (loader) => {
      const app = await loader.load<{
        readonly default: RexAppBundle;
        readonly config: RexAppConfig;
      }>(APP_MODULE_ID);
      const runtime = await appServerRuntime(loaderResolveContext(loader), loader.root);
      const ssr = await loader.load<PrerenderRuntime & Record<string, unknown>>(runtime.ssr);
      const text =
        staticOptions === undefined
          ? undefined
          : await loader.load<PrerenderTextRuntime & Record<string, unknown>>(runtime.pagesText);
      const list = await prerenderPages(
        {
          bundle: app.default,
          ssr,
          assets: options.assets,
          fonts: app.config.fonts,
          ...(text === undefined ? {} : { text }),
        },
        { clientDir: options.clientDir },
      );
      return { list, manifest: app.default.manifest };
    },
    {
      rex: options.rex,
      ...(options.logLevel === undefined ? {} : { logLevel: options.logLevel }),
      ...(options.plugins === undefined ? {} : { plugins: options.plugins }),
    },
  );
  const target = options.target ?? (staticOptions === undefined ? DEFAULT_BUILD_TARGET : "static");
  const outputs = await runStaticOutputs({
    target,
    outDir: resolve(options.outDir),
    clientDir: resolve(options.clientDir),
    manifest: built.manifest,
    prerendered: built.list,
    shell: staticOptions?.shell ?? null,
  });
  const listed = outputFiles(outputs, prerenderListOutput.id)[0];
  if (listed === undefined) {
    throw new RexError("REX400", `prerenderBuild: the ${target} target wrote no prerender list`);
  }
  const base = { list: built.list, file: listed.file, manifest: built.manifest, outputs };
  if (target !== "static") return { ...base, static: null };
  const [manifestFile] = outputFiles(outputs, staticManifestOutput.id);
  if (manifestFile === undefined) {
    throw new RexError("REX400", "prerenderBuild: the static target wrote no manifest file");
  }
  return {
    ...base,
    static: {
      manifestFile: manifestFile.file,
      textFiles: outputFiles(outputs, textFilesOutput.id).map((written) =>
        clientRelative(options.clientDir, written.file),
      ),
      shells: outputFiles(outputs, shellDocumentsOutput.id).map((written) =>
        Object.freeze({
          path: written.path,
          page: written.page,
          file: clientRelative(options.clientDir, written.file),
        }),
      ),
    },
  };
}

export async function writeBuildManifest(
  root: string,
  outDir: string,
  rex: RexPluginOptions,
  logLevel?: LogLevel,
): Promise<string> {
  const manifest: Manifest = await withModuleLoader(
    root,
    async (loader) => (await loadAppBundle(loader)).manifest,
    { rex, ...(logLevel === undefined ? {} : { logLevel }) },
  );
  const file = join(outDir, MANIFEST_OUTPUT);
  writeFileSync(file, `${stableStringify(manifest)}\n`);
  return file;
}

type BuildOutput = Awaited<ReturnType<typeof build>>;

export function outputItems(result: BuildOutput): (StaticImportChunk | OutputAssetLike)[] {
  const outputs = Array.isArray(result) ? result : [result];
  return outputs.flatMap((output) =>
    "output" in output ? (output.output as readonly (StaticImportChunk | OutputAssetLike)[]) : [],
  );
}

export function overBudget(rows: readonly ChunkRow[]): readonly ChunkRow[] {
  return rows.filter((row) => row.over);
}

class BuildBudgetError extends RexCliExit {
  constructor(readonly chunks: readonly ChunkRow[]) {
    super(
      EXIT_FAILURE,
      `rex build: ${overBudget(chunks)
        .map(
          (row) => `${row.name} (${(row.gzip / 1024).toFixed(2)} KB gzip, budget ${row.budget} KB)`,
        )
        .join(", ")} over budget`,
    );
  }
}

export async function buildApp(root: string, options: BuildOptions = {}): Promise<BuildResult> {
  const appRoot = resolve(root);
  const staging = mkdtempSync(join(appRoot, ".rex-build-"));
  const output = join(staging, DIST_DIR);
  const destination = join(appRoot, DIST_DIR);
  const backup = join(staging, "previous");
  try {
    const result = await buildStagedApp(appRoot, output, options);
    const relocate = (file: string): string => join(destination, relative(output, file));
    const optional = (file: string | null): string | null =>
      file === null ? null : relocate(file);
    const published: BuildResult = {
      ...result,
      outDir: destination,
      clientDir: relocate(result.clientDir),
      serverFile: optional(result.serverFile),
      manifestFile: optional(result.manifestFile),
      prerenderFile: optional(result.prerenderFile),
      staticManifestFile: optional(result.staticManifestFile),
      hostFiles: result.hostFiles.map(relocate),
      outputs: result.outputs.map((run) => ({
        ...run,
        files: run.files.map((file) => ({ ...file, file: relocate(file.file) })),
      })),
    };
    if (existsSync(destination)) renameSync(destination, backup);
    try {
      renameSync(output, destination);
    } catch (error) {
      if (existsSync(backup)) renameSync(backup, destination);
      throw error;
    }
    rmSync(backup, { recursive: true, force: true });
    return published;
  } finally {
    // Retain the backup if publication and restoration both failed.
    if (!existsSync(backup)) rmSync(staging, { recursive: true, force: true });
  }
}

async function buildStagedApp(
  root: string,
  outDir: string,
  options: BuildOptions,
): Promise<BuildResult> {
  const appRoot = resolve(root);
  const config = appConfigPath(appRoot);
  const logLevel = options.logLevel ?? "warn";
  let target: BuildTarget;
  let writer: RexHostWriter | null;
  let budgets: ResolvedBudgets;
  let pluginOptions: RexPluginOptions;
  let clientOptions: RexPluginOptions;
  let apiOrigin: string | null = null;
  try {
    const loaded = await loadRexConfig(
      appRoot,
      options.warn === undefined ? {} : { warn: options.warn },
    );
    target = options.target ?? hostFor(loaded.read.options)?.target ?? DEFAULT_BUILD_TARGET;
    writer = buildWriter(loaded.read.options, target);
    budgets = resolveBudgets(loaded.read);
    pluginOptions = configPluginOptions(loaded.read);
    clientOptions = pluginOptions;
    if (target === "static") {
      apiOrigin = loaded.read.options.client.apiOrigin;
      clientOptions = {
        ...pluginOptions,
        apiOrigin,
        staticHost: apiOrigin === null,
      };
    }
  } catch (error) {
    return rexCliExit(error);
  }
  const clientDir = join(outDir, CLIENT_DIR);
  const client = await restoringNodeEnv(() =>
    build({
      root: appRoot,
      configFile: false,
      ...productionBuildConfig(),
      logLevel,
      plugins: rex(clientOptions),
      build: { outDir: clientDir, emptyOutDir: true, manifest: true },
    }),
  );
  const chunks = chunkTable(outputItems(client), chunkBudgets(budgets));
  options.reportChunks?.(chunks, staticImportClosures(outputItems(client)));
  const over = overBudget(chunks);
  if (over.length > 0) {
    throw new BuildBudgetError(chunks);
  }
  const result = {
    target,
    outDir,
    clientDir,
    apiOrigin,
    chunks,
    staticManifestFile: null,
    textFiles: [],
    shells: [],
    outputs: [],
    host: writer?.host ?? null,
    hostFiles: [],
  };
  const hosted = async (built: BuildResult, manifest: Manifest): Promise<BuildResult> => ({
    ...built,
    hostFiles: await writeHostFiles(writer, built, manifest),
  });
  if (target === "static") {
    const shell = readFileSync(join(clientDir, SHELL_DOCUMENT_FILE), "utf8");
    const prerendered = await prerenderBuild(appRoot, {
      target,
      outDir,
      clientDir,
      assets: readSsrAssets(clientDir, { root: appRoot }),
      rex: pluginOptions,
      logLevel,
      static: { shell },
    });
    const outputs = prerendered.static as StaticOutputs;
    return hosted(
      {
        ...result,
        serverFile: null,
        manifestFile: null,
        prerendered: prerendered.list.pages,
        prerenderFile: prerendered.file,
        staticManifestFile: outputs.manifestFile,
        textFiles: outputs.textFiles,
        shells: outputs.shells,
        outputs: prerendered.outputs,
      },
      prerendered.manifest,
    );
  }

  const assets = readSsrAssets(clientDir, { root: appRoot });
  const manifestFile = await writeBuildManifest(appRoot, outDir, pluginOptions, logLevel);
  const serverFile = await buildServer({
    root: appRoot,
    outDir,
    config,
    target,
    assets,
    manifest: manifestFile,
    rex: pluginOptions,
    logLevel,
  });
  if (!usesStaticPages(target)) {
    return hosted(
      { ...result, serverFile, manifestFile, prerendered: [], prerenderFile: null },
      JSON.parse(readFileSync(manifestFile, "utf8")) as Manifest,
    );
  }

  const prerendered = await prerenderBuild(appRoot, {
    target,
    outDir,
    clientDir,
    assets,
    rex: pluginOptions,
    logLevel,
  });

  return hosted(
    {
      ...result,
      serverFile,
      manifestFile,
      prerendered: prerendered.list.pages,
      prerenderFile: prerendered.file,
      outputs: prerendered.outputs,
    },
    prerendered.manifest,
  );
}

export function writtenLayout(result: BuildResult): string {
  return result.serverFile === null
    ? `${DIST_DIR}/${CLIENT_DIR}/`
    : `${DIST_DIR}/${CLIENT_DIR}/ and ${DIST_DIR}/${SERVER_FILE}`;
}

function distPath(result: BuildResult, file: string): string {
  return `${DIST_DIR}/${normalizePath(relative(result.outDir, file))}`;
}

function wroteLines(lines: readonly string[]): string {
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

export function formatStaticOutputs(result: BuildResult): string {
  return wroteLines(
    result.outputs.flatMap((run) =>
      run.files.map(
        (written) =>
          `rex build: wrote ${distPath(result, written.file)}${written.note === null ? "" : ` (${written.note})`}`,
      ),
    ),
  );
}

export function formatHostFiles(result: BuildResult): string {
  return wroteLines(
    result.hostFiles.map(
      (file) => `rex build: wrote ${distPath(result, file)} (the ${result.host} host file)`,
    ),
  );
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

export async function executeBuild(
  options: { check: boolean; target?: BuildTarget },
  io: RexCliIO,
): Promise<void> {
  if (options.check) await ensureCheckPasses(io.cwd, io, "build");
  const result = await buildApp(io.cwd, {
    warn: cliWarn(io),
    reportChunks: (chunks, closures) => {
      io.out(formatChunkTable(chunks));
      io.out(formatStaticImportClosures(closures));
    },
    ...(options.target === undefined ? {} : { target: options.target }),
  });
  io.out(`rex build: wrote ${writtenLayout(result)} for the ${result.target} target\n`);
  if (result.manifestFile !== null) io.out(`rex build: wrote ${DIST_DIR}/${MANIFEST_OUTPUT}\n`);
  if (result.prerenderFile !== null) {
    io.out(
      formatPrerenderList(
        { version: PRERENDER_LIST_VERSION, pages: result.prerendered },
        `${DIST_DIR}/${CLIENT_DIR}`,
      ),
    );
  }
  io.out(formatStaticOutputs(result));
  io.out(formatHostFiles(result));
  io.out(`rex build: ${startHint(result)}\n`);
}
