import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer, type LogLevel, type ViteDevServer } from "vite";
import { anonymousActor } from "../core/actor.ts";
import {
  CONFIG_FILE,
  configServer,
  readConfigExport,
  type RexConfigApp,
  type RexConfigExport,
  type RexFetchHandler,
} from "../core/config.ts";
import type { DeprecationWarn } from "../core/deprecated.ts";
import { RexError } from "../core/errors.ts";
import { memoryLedger } from "../server/audit.ts";
import { createRexServer } from "../server/app.ts";
import { locateAppError } from "../vite/overlay.ts";
import { rex } from "../vite/plugin.ts";
import { DEFAULT_APP_DIR } from "../vite/virtual.ts";

export { CONFIG_FILE };

export function nodeEnvRestorer(): () => void {
  const previous = process.env.NODE_ENV;
  return () => {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  };
}

export async function restoringNodeEnv<T>(run: () => Promise<T>): Promise<T> {
  const restore = nodeEnvRestorer();
  try {
    return await run();
  } finally {
    restore();
  }
}

export interface LoadedRexConfig {
  readonly file: string;
  readonly read: RexConfigExport;
}

export function configPath(root: string): string {
  return join(resolve(root), CONFIG_FILE);
}

export function hasConfig(root: string): boolean {
  return existsSync(configPath(root));
}

export function requireConfig(root: string): string {
  const file = configPath(root);
  if (!existsSync(file)) {
    throw new RexError(
      "REX100",
      `${CONFIG_FILE} is missing in ${resolve(root)}; it default-exports defineConfig({ app }) with app imported from rex:app`,
    );
  }
  return file;
}

export function defaultAppServer(app: RexConfigApp): RexFetchHandler {
  return createRexServer({
    registry: app.registry,
    ledger: memoryLedger(),
    actor: () => anonymousActor,
    app: app.name,
  });
}

export async function importConfigExport(vite: ViteDevServer): Promise<unknown> {
  try {
    const loaded = (await vite.ssrLoadModule(`/${CONFIG_FILE}`, { fixStacktrace: true })) as {
      readonly default?: unknown;
    };
    return loaded.default;
  } catch (error) {
    throw locateAppError(error, join(vite.config.root, DEFAULT_APP_DIR));
  }
}

const servers = new WeakMap<object, RexFetchHandler>();

export function serverForExport(exported: unknown, warn?: DeprecationWarn): RexFetchHandler {
  if (typeof exported === "object" && exported !== null) {
    const cached = servers.get(exported);
    if (cached !== undefined) return cached;
  }
  const server = configServer(readConfigExport(exported, warn), defaultAppServer);
  if (typeof exported === "object" && exported !== null) servers.set(exported, server);
  return server;
}

export async function loadConfigServer(
  vite: ViteDevServer,
  warn?: DeprecationWarn,
): Promise<RexFetchHandler> {
  return serverForExport(await importConfigExport(vite), warn);
}

export interface LoadRexConfigOptions {
  readonly warn?: DeprecationWarn;
  readonly logLevel?: LogLevel;
}

export async function loadRexConfig(
  root: string,
  options: LoadRexConfigOptions = {},
): Promise<LoadedRexConfig> {
  const appRoot = resolve(root);
  const file = requireConfig(appRoot);
  const restoreNodeEnv = nodeEnvRestorer();
  const vite = await createServer({
    root: appRoot,
    configFile: false,
    logLevel: options.logLevel ?? "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, watch: null },
    plugins: rex(),
  });
  try {
    return { file, read: readConfigExport(await importConfigExport(vite), options.warn) };
  } finally {
    await vite.close();
    restoreNodeEnv();
  }
}
