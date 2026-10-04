import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { normalizePath, type Plugin } from "vite";
import { RexError } from "../core/errors.ts";
import type { RexHookContext } from "./hooks.ts";

declare module "./plugin.ts" {
  interface RexPluginOptions {
    readonly shellComponents?: string | null;
  }
}

export const REGISTER_SHELL_COMPONENTS = "registerShellComponents";

export function shellComponentsFile(root: string, configured: string): string {
  const file = normalizePath(resolve(root, configured));
  if (!existsSync(file)) {
    throw new RexError(
      "REX120",
      `rex.config.ts: field "ui.components" names ${configured}, which does not exist`,
      {
        hint: "Create the module under app/components exporting Button, Sheet, PaletteItem or Outcome, or remove ui.components.",
      },
    );
  }
  return file;
}

export function configuredShellComponents(context: RexHookContext): string | null {
  const configured = context.options.shellComponents ?? null;
  return configured === null ? null : shellComponentsFile(context.state.root, configured);
}

export interface ShellComponentsLines {
  readonly imports: readonly string[];
  readonly register: readonly string[];
}

export function shellComponentsLines(file: string | null, client: string): ShellComponentsLines {
  if (file === null) return { imports: [], register: [] };
  return {
    imports: [
      `import { ${REGISTER_SHELL_COMPONENTS} as rexRegisterShellComponents } from ${JSON.stringify(client)};`,
      `import * as rexShellComponents from ${JSON.stringify(file)};`,
    ],
    register: ["rexRegisterShellComponents(rexShellComponents);"],
  };
}

export function shellComponentsHook(context: RexHookContext): Plugin {
  return {
    name: "rex:shell-components",
    buildStart() {
      const file = configuredShellComponents(context);
      if (file !== null) this.addWatchFile(file);
    },
  };
}
