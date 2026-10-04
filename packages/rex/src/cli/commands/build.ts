import { rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { build, normalizePath, type LogLevel, type Plugin } from "vite";
import { rex } from "../../vite/index.ts";
import type { RexCliIO } from "../index.ts";
import { ensureCheckPasses } from "./check.ts";
import { appConfigPath } from "./dev.ts";

export const DIST_DIR = "dist";
export const CLIENT_DIR = "client";
export const SERVER_FILE = "server.js";
export const DEFAULT_PORT = 3000;
export const SERVER_ENTRY_ID = "rex:server";
export const RESOLVED_SERVER_ENTRY_ID = "\0rex:server";
export const SERVING_PREFIX = "rex: serving ";

const MODULE_EXTENSION = import.meta.url.endsWith(".ts") ? ".ts" : ".js";

export function nodeRuntimePath(from: string = import.meta.url): string {
  return normalizePath(
    resolve(dirname(fileURLToPath(from)), "..", "..", "server", `node${MODULE_EXTENSION}`),
  );
}

export interface ServerEntryOptions {
  readonly config: string;
  readonly runtime: string;
}

export function generateServerEntry(options: ServerEntryOptions): string {
  return [
    'import { fileURLToPath } from "node:url";',
    `import { startNodeServer } from ${JSON.stringify(options.runtime)};`,
    `import server from ${JSON.stringify(normalizePath(options.config))};`,
    "",
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
    plugins: [...rex(), serverEntryPlugin({ config, runtime: nodeRuntimePath() })],
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
      const result = await buildApp(io.cwd);
      io.out(`rex build: wrote ${DIST_DIR}/${CLIENT_DIR}/ and ${DIST_DIR}/${SERVER_FILE}\n`);
      io.out(`rex build: start it with node ${DIST_DIR}/${SERVER_FILE} (${result.serverFile})\n`);
    });
}
