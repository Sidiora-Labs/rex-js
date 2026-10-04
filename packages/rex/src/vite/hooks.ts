import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { DEFAULT_APP_NAME } from "../manifest/build.ts";
import { appModuleHook } from "./app-module.ts";
import { compilerHook } from "./compiler.ts";
import { devServerHook } from "./dev-server.ts";
import { entryModuleHook } from "./entry-module.ts";
import { nonceHook } from "./nonce.ts";
import type { RexPluginOptions } from "./plugin.ts";
import type { RuntimePaths } from "./resolve.ts";

export interface RexHookState {
  root: string;
  name: string;
}

export interface RexHookContext {
  readonly options: RexPluginOptions;
  readonly appDir: string;
  readonly paths: RuntimePaths;
  readonly state: RexHookState;
  appPath(): string;
}

export type RexHook = (context: RexHookContext) => Plugin | readonly Plugin[];

function packageName(root: string): string | null {
  const file = join(root, "package.json");
  if (!existsSync(file)) return null;
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { name?: unknown };
  return typeof parsed.name === "string" && parsed.name.trim() !== "" ? parsed.name : null;
}

export function configHook(context: RexHookContext): Plugin {
  return {
    name: "rex",
    enforce: "pre",
    configResolved(config) {
      context.state.root = config.root;
      context.state.name = context.options.name ?? packageName(config.root) ?? DEFAULT_APP_NAME;
    },
  };
}

export function reactHook(): readonly Plugin[] {
  return react();
}

export const REX_HOOKS: readonly RexHook[] = [
  configHook,
  appModuleHook,
  entryModuleHook,
  devServerHook,
  compilerHook,
  reactHook,
  nonceHook,
];
