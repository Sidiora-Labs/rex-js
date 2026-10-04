import { UI_KITS, type UiKit } from "../../core/config.ts";
import type { PlannedEntry } from "../commands/make.ts";
import {
  DESIGNX_CONFIG_FILE,
  withDesignxDependencies,
  withDesignxStylesheet,
  type DesignxInstall,
} from "../designx.ts";
import type { RexNewContext, RexNewGenerator } from "../generators.ts";

export const DEFAULT_UI: UiKit = "designx";
export const DESIGNX_BUTTON = "app/components/Button.tsx";
export const DESIGNX_CONFIG = "rex.config.ts";

export interface DesignxNewContext extends RexNewContext {
  readonly ui: UiKit;
  readonly designx: DesignxInstall | null;
}

export function isUiKit(value: unknown): value is UiKit {
  return typeof value === "string" && (UI_KITS as readonly string[]).includes(value);
}

export function designxOf(context: RexNewContext): DesignxInstall | null {
  if (!("ui" in context) || !("designx" in context)) return null;
  const { ui, designx } = context as DesignxNewContext;
  if (ui !== "designx") return null;
  if (designx === null) {
    throw new Error("rex new: ui designx needs the DesignX registry items fetched first");
  }
  return designx;
}

export function designxButtonTemplate(): string {
  return [
    'import type { ButtonHTMLAttributes } from "react";',
    'import { Button as DesignxButton } from "./ui/button.tsx";',
    "",
    "export default function Button({",
    '  type = "button",',
    "  ...props",
    "}: ButtonHTMLAttributes<HTMLButtonElement>) {",
    "  return <DesignxButton type={type} {...props} />;",
    "}",
    "",
  ].join("\n");
}

export function withDesignxUi(config: string): string {
  if (config.includes("\n  ui: ")) return config;
  return config.replace("  app,\n", '  app,\n  ui: "designx",\n');
}

function replaced(entry: PlannedEntry, install: DesignxInstall): PlannedEntry {
  if (entry.kind !== "file") return entry;
  switch (entry.path) {
    case "package.json":
      return { ...entry, content: withDesignxDependencies(entry.content, install) };
    case "index.html":
      return { ...entry, content: withDesignxStylesheet(entry.content) };
    case DESIGNX_CONFIG:
      return { ...entry, content: withDesignxUi(entry.content) };
    case DESIGNX_BUTTON:
      return { ...entry, content: designxButtonTemplate() };
    default:
      return entry;
  }
}

export const designxGenerator: RexNewGenerator = {
  id: "designx",
  contribute(plan, context) {
    const install = designxOf(context);
    if (install === null) return plan;
    if (!install.files.some((file) => file.path === DESIGNX_CONFIG_FILE)) {
      throw new Error(`rex new: the DesignX install has no ${DESIGNX_CONFIG_FILE}`);
    }
    return [...plan.map((entry) => replaced(entry, install)), ...install.files];
  },
};
