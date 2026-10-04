import { reactCompilerPreset } from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import type { RexHookContext } from "./hooks.ts";

declare module "./plugin.ts" {
  interface RexPluginOptions {
    readonly compiler?: boolean;
  }
}

export const REACT_COMPILER_TARGET = "19";
export const COMPILER_RUNTIME = "react/compiler-runtime";

const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;

interface BabelResult {
  readonly code?: string | null;
  readonly map?: unknown;
}

interface BabelCore {
  transformAsync(code: string, options: Record<string, unknown>): Promise<BabelResult | null>;
}

export function compilerEnabled(context: RexHookContext): boolean {
  return context.options.compiler !== false;
}

export function shouldCompile(id: string, code: string, filter: RegExp): boolean {
  const file = id.split("?")[0] ?? id;
  return (
    !id.startsWith("\0") &&
    SCRIPT_FILE.test(file) &&
    !file.endsWith(".d.ts") &&
    !/[\\/]node_modules[\\/]/.test(file) &&
    filter.test(code)
  );
}

async function loadBabel(): Promise<BabelCore | Error> {
  try {
    return (await import("@babel/core")) as unknown as BabelCore;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

export function compilerHook(context: RexHookContext): Plugin | readonly Plugin[] {
  if (!compilerEnabled(context)) return [];
  let babel: Promise<BabelCore | Error> | null = null;
  let warned = false;
  return {
    name: "rex:react-compiler",
    enforce: "pre",
    applyToEnvironment: (environment) => environment.config.consumer === "client",
    config: () => ({ optimizeDeps: { include: [COMPILER_RUNTIME] } }),
    async transform(code, id) {
      let preset: ReturnType<typeof reactCompilerPreset>;
      try {
        preset = reactCompilerPreset({ target: REACT_COMPILER_TARGET });
      } catch (error) {
        return this.error(
          `rex: the React Compiler needs babel-plugin-react-compiler; install it or set compiler: false in rex.config.ts (${(error as Error).message})`,
        );
      }
      const filter = preset.rolldown.filter?.code;
      if (!(filter instanceof RegExp) || !shouldCompile(id, code, filter)) return null;
      babel ??= loadBabel();
      const core = await babel;
      if (core instanceof Error) {
        if (context.options.compiler === true) {
          return this.error(
            `rex: the React Compiler needs @babel/core; install it or set compiler: false (${core.message})`,
          );
        }
        if (!warned) {
          warned = true;
          this.warn(
            "rex: the React Compiler is skipped because @babel/core is not installed; install @babel/core and babel-plugin-react-compiler or set compiler: false in rex.config.ts",
          );
        }
        return null;
      }
      const result = await core.transformAsync(code, {
        filename: id.split("?")[0],
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        parserOpts: { plugins: ["jsx", "typescript"] },
        presets: [preset.preset],
      });
      if (result === null || typeof result.code !== "string") return null;
      return { code: result.code, map: result.map as never };
    },
  };
}
