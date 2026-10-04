import { resolve } from "node:path";
import type { Plugin } from "vite";
import { DEFAULT_APP_NAME } from "../manifest/build.ts";
import type { RexServerSource } from "./dev-server.ts";
import { REX_HOOKS, type RexHook, type RexHookContext } from "./hooks.ts";
import { runtimePaths } from "./resolve.ts";
import { DEFAULT_APP_DIR } from "./virtual.ts";

export interface RexPluginOptions {
  readonly appDir?: string;
  readonly name?: string;
  readonly server?: RexServerSource;
}

export function createHookContext(options: RexPluginOptions = {}): RexHookContext {
  const appDir = options.appDir ?? DEFAULT_APP_DIR;
  const state = { root: process.cwd(), name: options.name ?? DEFAULT_APP_NAME };
  return {
    options,
    appDir,
    paths: runtimePaths(),
    state,
    appPath: () => resolve(state.root, appDir),
  };
}

export function assemblePlugins(
  context: RexHookContext,
  hooks: readonly RexHook[] = REX_HOOKS,
): Plugin[] {
  return hooks.flatMap((hook) => {
    const produced = hook(context);
    return Array.isArray(produced) ? [...(produced as readonly Plugin[])] : [produced as Plugin];
  });
}

export function rex(options: RexPluginOptions = {}): Plugin[] {
  return assemblePlugins(createHookContext(options));
}

export default rex;
