import { resolve } from "node:path";
import { createServer, type LogLevel, type Plugin, type ViteDevServer } from "vite";
import type { RexConfigExport } from "../core/config.ts";
import type { RexAppBundle } from "../vite/app-module.ts";
import { rex, type RexPluginOptions } from "../vite/plugin.ts";
import { APP_MODULE_ID } from "../vite/virtual.ts";
import { hasConfig, loadRexConfig } from "./config.ts";

export interface ModuleLoaderOptions {
  readonly logLevel?: LogLevel;
  readonly plugins?: readonly Plugin[];
  readonly rex?: RexPluginOptions;
}

export interface ModuleLoader {
  readonly root: string;
  readonly vite: ViteDevServer;
  load<T = Record<string, unknown>>(specifier: string): Promise<T>;
  close(): Promise<void>;
}

export function configPluginOptions(read: RexConfigExport): RexPluginOptions {
  return { compiler: read.options.compiler };
}

async function pluginOptionsFor(
  appRoot: string,
  options: ModuleLoaderOptions,
): Promise<RexPluginOptions> {
  const given = options.rex ?? {};
  if (given.compiler !== undefined || !hasConfig(appRoot)) return given;
  const loaded = await loadRexConfig(
    appRoot,
    options.logLevel === undefined ? {} : { logLevel: options.logLevel },
  );
  return { ...configPluginOptions(loaded.read), ...given };
}

export async function createModuleLoader(
  root: string,
  options: ModuleLoaderOptions = {},
): Promise<ModuleLoader> {
  const appRoot = resolve(root);
  const vite = await createServer({
    root: appRoot,
    configFile: false,
    logLevel: options.logLevel ?? "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, watch: null },
    plugins: [...rex(await pluginOptionsFor(appRoot, options)), ...(options.plugins ?? [])],
  });
  return {
    root: appRoot,
    vite,
    load: async <T>(specifier: string) => (await vite.ssrLoadModule(specifier)) as T,
    close: () => vite.close(),
  };
}

export async function withModuleLoader<T>(
  root: string,
  use: (loader: ModuleLoader) => Promise<T>,
  options: ModuleLoaderOptions = {},
): Promise<T> {
  const loader = await createModuleLoader(root, options);
  try {
    return await use(loader);
  } finally {
    await loader.close();
  }
}

export function loadAppBundle(loader: ModuleLoader): Promise<RexAppBundle> {
  return loader.load<{ readonly default: RexAppBundle }>(APP_MODULE_ID).then(
    (loaded) => loaded.default,
  );
}
