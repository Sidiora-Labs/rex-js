import { resolve } from "node:path";
import { createServer, type LogLevel, type ServerOptions, type ViteDevServer } from "vite";
import { isFetchHandler } from "../../core/config.ts";
import type { DeprecationWarn } from "../../core/deprecated.ts";
import { explainRexError } from "../../core/errors.docs.ts";
import { isRexError } from "../../core/errors.ts";
import { rex, type RexFetchApp, type RexPluginOptions } from "../../vite/index.ts";
import { loadConfigServer, loadRexConfig, requireConfig } from "../config.ts";
import { EXIT_FAILURE, RexCliExit, type RexCliIO } from "../index.ts";
import { configPluginOptions } from "../load.ts";
import { ensureCheckPasses } from "./check.ts";

import { DEFAULT_DEV_PORT } from "../registrations/dev.ts";
export { DEFAULT_DEV_PORT, parsePort, register } from "../registrations/dev.ts";

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
  if (isRexError(error)) throw new RexCliExit(EXIT_FAILURE, `rex: ${explainRexError(error)}`);
  throw error;
}

export function appConfigPath(root: string): string {
  try {
    return requireConfig(root);
  } catch (error) {
    return rexCliExit(error);
  }
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
  let pluginOptions: RexPluginOptions;
  try {
    const loaded = await loadRexConfig(
      appRoot,
      options.warn === undefined ? {} : { warn: options.warn },
    );
    pluginOptions = configPluginOptions(loaded.read);
  } catch (error) {
    return rexCliExit(error);
  }
  const server: ServerOptions = {
    port: options.port ?? DEFAULT_DEV_PORT,
    ...(options.host === undefined ? {} : { host: options.host }),
  };
  const vite = await createServer({
    root: appRoot,
    configFile: false,
    logLevel: options.logLevel ?? "info",
    plugins: rex({ ...pluginOptions, server: (vite) => loadAppServer(vite, options.warn) }),
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

export async function executeDev(
  options: { port: number; host?: string; check: boolean },
  io: RexCliIO,
): Promise<void> {
  if (options.check) await ensureCheckPasses(io.cwd, io, "dev");
  const vite = await startDev(
    io.cwd,
    options.host === undefined
      ? { port: options.port, warn: cliWarn(io) }
      : { port: options.port, host: options.host, warn: cliWarn(io) },
  );
  for (const url of devUrls(vite)) io.out(`rex dev: serving ${url}\n`);
}
