import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { InvalidArgumentError, type Command } from "commander";
import { createServer, type LogLevel, type ServerOptions, type ViteDevServer } from "vite";
import { rex, type RexFetchApp } from "../../vite/index.ts";
import { EXIT_FAILURE, RexCliExit, type RexCliIO } from "../index.ts";
import { ensureCheckPasses } from "./check.ts";
import { CONFIG_FILE } from "./new.ts";

export const DEFAULT_DEV_PORT = 5173;

export interface DevOptions {
  readonly port?: number;
  readonly host?: string;
  readonly logLevel?: LogLevel;
}

export function appConfigPath(root: string): string {
  const file = join(resolve(root), CONFIG_FILE);
  if (!existsSync(file)) {
    throw new RexCliExit(
      EXIT_FAILURE,
      `rex: ${CONFIG_FILE} is missing in ${resolve(root)}; it default-exports the app's Hono server from createRexServer`,
    );
  }
  return file;
}

export function parsePort(value: string): number {
  const port = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new InvalidArgumentError("the port must be an integer from 0 to 65535");
  }
  return port;
}

export function isFetchApp(value: unknown): value is RexFetchApp {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { fetch?: unknown }).fetch === "function"
  );
}

export async function loadAppServer(vite: ViteDevServer): Promise<RexFetchApp> {
  const loaded = (await vite.ssrLoadModule(`/${CONFIG_FILE}`)) as { readonly default?: unknown };
  if (!isFetchApp(loaded.default)) {
    throw new Error(
      `${CONFIG_FILE} must default-export the app's Hono server, such as createRexServer({ registry, ledger, actor })`,
    );
  }
  return loaded.default;
}

export async function startDev(root: string, options: DevOptions = {}): Promise<ViteDevServer> {
  const appRoot = resolve(root);
  appConfigPath(appRoot);
  const server: ServerOptions = {
    port: options.port ?? DEFAULT_DEV_PORT,
    ...(options.host === undefined ? {} : { host: options.host }),
  };
  const vite = await createServer({
    root: appRoot,
    configFile: false,
    logLevel: options.logLevel ?? "info",
    plugins: rex({ server: loadAppServer }),
    server,
  });
  try {
    await vite.listen();
  } catch (error) {
    await vite.close();
    throw error;
  }
  return vite;
}

export function devUrls(vite: ViteDevServer): readonly string[] {
  return [...(vite.resolvedUrls?.local ?? []), ...(vite.resolvedUrls?.network ?? [])];
}

export function register(program: Command, io: RexCliIO): void {
  program
    .command("dev")
    .description("serve the Vite client and the app's Hono server on one port with hot reload")
    .option("--port <port>", "port to listen on", parsePort, DEFAULT_DEV_PORT)
    .option("--host <host>", "host to listen on")
    .option("--no-check", "start without running rex check first")
    .action(async (options: { port: number; host?: string; check: boolean }) => {
      if (options.check) await ensureCheckPasses(io.cwd, io, "dev");
      const vite = await startDev(
        io.cwd,
        options.host === undefined
          ? { port: options.port }
          : { port: options.port, host: options.host },
      );
      for (const url of devUrls(vite)) io.out(`rex dev: serving ${url}\n`);
    });
}
