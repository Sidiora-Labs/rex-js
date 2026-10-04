import { rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RexCommand as Command } from "../args.ts";
import { build, normalizePath, type LogLevel, type Plugin } from "vite";
import { rex } from "../../vite/index.ts";
import { loadRexConfig } from "../config.ts";
import type { RexCliIO } from "../index.ts";
import { ensureCheckPasses } from "./check.ts";
import { appConfigPath, cliWarn, rexCliExit } from "./dev.ts";
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
    `import { startNodeServer } from ${JSON.stringify(runtime.node)};`,
    `import { createRexServer, memoryLedger } from ${JSON.stringify(runtime.server)};`,
    `import { configServer, readConfigExport } from ${JSON.stringify(runtime.config)};`,
    `import { anonymousActor } from ${JSON.stringify(runtime.actor)};`,
    `import exported from ${JSON.stringify(normalizePath(options.config))};`,
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
    "const running = await startNodeServer(",
    "  server,",
    '  hostname === undefined || hostname === "" ? { port, clientDir } : { port, clientDir, hostname },',
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
}

export async function buildApp(root: string, options: BuildOptions = {}): Promise<BuildResult> {
  const appRoot = resolve(root);
  const config = appConfigPath(appRoot);
  const logLevel = options.logLevel ?? "warn";
  try {
    await loadRexConfig(appRoot, options.warn === undefined ? {} : { warn: options.warn });
  } catch (error) {
    rexCliExit(error);
  }
  const outDir = join(appRoot, DIST_DIR);
  const clientDir = join(outDir, CLIENT_DIR);
  rmSync(outDir, { recursive: true, force: true });

  await build({
    root: appRoot,
    configFile: false,
    logLevel,
    plugins: rex(),
    build: { outDir: clientDir, emptyOutDir: true },
  });

  await build({
    root: appRoot,
    configFile: false,
    logLevel,
    plugins: [...rex(), serverEntryPlugin({ config, runtime: serverRuntimePaths() })],
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

  return { outDir, clientDir, serverFile: join(outDir, SERVER_FILE) };
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
      io.out(`rex build: wrote ${DIST_DIR}/${CLIENT_DIR}/ and ${DIST_DIR}/${SERVER_FILE}\n`);
      io.out(`rex build: start it with node ${DIST_DIR}/${SERVER_FILE} (${result.serverFile})\n`);
    });
}
