import type { Plugin } from "vite";
import type { RexHookContext } from "../../vite/hooks.ts";
import { DEVTOOLS_DEFINE } from "./env.ts";

declare module "../../vite/plugin.ts" {
  interface RexPluginOptions {
    readonly devtools?: boolean;
  }
}

export function devtoolsEnabled(context: RexHookContext): boolean {
  return context.options.devtools !== false;
}

export function devtoolsHook(context: RexHookContext): Plugin {
  return {
    name: "rex:devtools",
    config: () => ({
      define: { [DEVTOOLS_DEFINE]: JSON.stringify(devtoolsEnabled(context)) },
    }),
  };
}
