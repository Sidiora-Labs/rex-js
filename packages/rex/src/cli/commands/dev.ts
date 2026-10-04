import { resolve } from "node:path";
import { InvalidArgumentError, type RexCommand as Command } from "../args.ts";
import { createServer, type LogLevel, type ServerOptions, type ViteDevServer } from "vite";
import { isFetchHandler } from "../../core/config.ts";
import type { DeprecationWarn } from "../../core/deprecated.ts";
import { formatRexError, isRexError } from "../../core/errors.ts";
import { rex, type RexFetchApp } from "../../vite/index.ts";
import { loadConfigServer, requireConfig } from "../config.ts";
import { EXIT_FAILURE, RexCliExit, type RexCliIO } from "../index.ts";
import { ensureCheckPasses } from "./check.ts";

export const DEFAULT_DEV_PORT = 5173;

export interface DevOptions {
  readonly port?: number;
  readonly host?: string;
  readonly logLevel?: LogLevel;
  readonly warn?: DeprecationWarn;
}

export function cliWarn(io: RexCliIO): DeprecationWarn {
  return (message) => io.err(`${message}\n`);
}

export function rexCliExit(error: unknown): never {
  if (isRexError(error)) throw new RexCliExit(EXIT_FAILURE, `rex: ${formatRexError(error)}`);
  throw error;
}

export function appConfigPath(root: string): string {
  try {
    return requireConfig(root);
  } catch (error) {
    return rexCliExit(error);
  }
}

export function parsePort(value: string): number {
  const port = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new InvalidArgumentError("the port must be an integer from 0 to 65535");
  }
  return port;
}

export function isFetchApp(value: unknown): value is RexFetchApp {
  return isFetchHandler(value);
}

export function loadAppServer(vite: ViteDevServer, warn?: DeprecationWarn): Promise<RexFetchApp> {
  return loadConfigServer(vite, warn);
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
    plugins: rex({ server: (vite) => loadAppServer(vite, options.warn) }),
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
          ? { port: options.port, warn: cliWarn(io) }
          : { port: options.port, host: options.host, warn: cliWarn(io) },
      );
      for (const url of devUrls(vite)) io.out(`rex dev: serving ${url}\n`);
    });
}
