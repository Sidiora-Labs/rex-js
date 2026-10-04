import { createRequire } from "node:module";
import type { Plugin } from "vite";
import type { UiKit } from "../core/config.ts";
import { RexError } from "../core/errors.ts";
import type { RexHookContext } from "./hooks.ts";
import type { RexPluginOptions } from "./plugin.ts";

declare module "./plugin.ts" {
  interface RexPluginOptions {
    readonly tailwind?: boolean;
    readonly ui?: UiKit;
  }
}

export const TAILWIND_PLUGIN = "@tailwindcss/vite";

/**
 * CSS Modules need no Rex setup: Vite scopes every stylesheet whose name matches this pattern
 * and exposes its class names as the default export, so `import styles from "./Card.module.css"`
 * works in any part, region or component.
 */
export const CSS_MODULE_FILE = /\.module\.(?:css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;

type TailwindFactory = () => Plugin | readonly Plugin[];

export function tailwindEnabled(options: RexPluginOptions): boolean {
  return options.tailwind === true || options.ui === "designx";
}

export function isCssModule(id: string): boolean {
  return CSS_MODULE_FILE.test(id);
}

function missingTailwind(options: RexPluginOptions, specifier: string, cause: unknown): RexError {
  const reason = options.tailwind === true ? "tailwind is true" : 'ui is "designx"';
  const message = `${reason} but ${specifier} cannot be loaded (${cause instanceof Error ? cause.message : String(cause)})`;
  return options.tailwind === true
    ? new RexError("REX122", message, {
        hint: `Install ${specifier} and tailwindcss 4, or set tailwind: false in rex.config.ts.`,
        cause,
      })
    : new RexError("REX120", message, {
        hint: `Install ${specifier} and tailwindcss 4, or set ui: "none" in rex.config.ts.`,
        cause,
      });
}

export function loadTailwind(
  options: RexPluginOptions,
  from: string = import.meta.url,
  specifier: string = TAILWIND_PLUGIN,
): TailwindFactory {
  let loaded: { readonly default?: unknown };
  try {
    loaded = createRequire(from)(specifier) as { readonly default?: unknown };
  } catch (error) {
    throw missingTailwind(options, specifier, error);
  }
  if (typeof loaded.default !== "function") {
    throw missingTailwind(options, specifier, new TypeError(`${specifier} has no default plugin factory`));
  }
  return loaded.default as TailwindFactory;
}

export function stylesHook(context: RexHookContext): readonly Plugin[] {
  if (!tailwindEnabled(context.options)) return [];
  const produced = loadTailwind(context.options)();
  return Array.isArray(produced) ? [...(produced as readonly Plugin[])] : [produced as Plugin];
}
