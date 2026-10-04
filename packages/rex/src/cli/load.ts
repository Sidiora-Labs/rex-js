import { join, resolve } from "node:path";
import { createServer, type LogLevel, type Plugin, type ViteDevServer } from "vite";
import type { FontSpec, ResolvedFont, RexConfigExport } from "../core/config.ts";
import type { RexAppBundle } from "../vite/app-module.ts";
import { rex, type RexPluginOptions } from "../vite/plugin.ts";
import { locateAppError } from "../vite/overlay.ts";
import { APP_MODULE_ID, DEFAULT_APP_DIR } from "../vite/virtual.ts";
import { hasConfig, loadRexConfig, nodeEnvRestorer } from "./config.ts";

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

export function fontSpec(font: ResolvedFont): FontSpec {
  const { family, src, weight, style, preload } = font;
  return weight === null
    ? { family, src, style, preload }
    : { family, src, weight, style, preload };
}

export function configPluginOptions(read: RexConfigExport): RexPluginOptions {
  const { compiler, devtools, tailwind, ui, security, shellComponents, fonts, i18n } = read.options;
  return {
    compiler,
    devtools,
    tailwind,
    ui,
    secretNames: security.secretNames,
    shellComponents,
    fonts: fonts.map(fontSpec),
    i18n,
  };
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
  const pluginOptions = await pluginOptionsFor(appRoot, options);
  const appPath = join(appRoot, pluginOptions.appDir ?? DEFAULT_APP_DIR);
  const restoreNodeEnv = nodeEnvRestorer();
  const vite = await createServer({
    root: appRoot,
    configFile: false,
    logLevel: options.logLevel ?? "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, watch: null },
    plugins: [...rex(pluginOptions), ...(options.plugins ?? [])],
  }).finally(restoreNodeEnv);
  return {
    root: appRoot,
    vite,
    load: async <T>(specifier: string) => {
      try {
        return (await vite.ssrLoadModule(specifier, { fixStacktrace: true })) as T;
      } catch (error) {
        throw locateAppError(error, appPath);
      }
    },
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
  return loader
    .load<{ readonly default: RexAppBundle }>(APP_MODULE_ID)
    .then((loaded) => loaded.default);
}
