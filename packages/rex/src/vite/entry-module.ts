import { dirname, join } from "node:path";
import { normalizePath, type Plugin } from "vite";
import type { RexHookContext } from "./hooks.ts";
import { SSR_ATTRIBUTE } from "../client/hydrate.ts";
import { resolveRuntimeEntry } from "./resolve.ts";
import {
  APP_MODULE_ID,
  CLIENT_SPECIFIER,
  ENTRY_MODULE_ID,
  RESOLVED_ENTRY_MODULE_ID,
  ROOT_ELEMENT_ID,
  RUNTIME_STYLESHEETS,
} from "./virtual.ts";

declare module "./plugin.ts" {
  interface RexPluginOptions {
    readonly apiOrigin?: string | null;
  }
}

export interface EntryModuleOptions {
  readonly client: string;
  readonly rootElement?: string;
  readonly apiOrigin?: string | null;
}

export const API_FETCH_EXPORT = "apiFetch";

export function runtimeStylesheets(client: string): readonly string[] {
  const dir = dirname(client);
  return RUNTIME_STYLESHEETS.map((file) => normalizePath(join(dir, file)));
}

export function generateEntryModule(options: EntryModuleOptions): string {
  const rootElement = options.rootElement ?? ROOT_ELEMENT_ID;
  const apiOrigin = options.apiOrigin ?? null;
  const baseUrl =
    apiOrigin === null ? null : `baseUrl: ${JSON.stringify(apiOrigin)}, fetch: ${API_FETCH_EXPORT}`;
  return [
    ...runtimeStylesheets(options.client).map((file) => `import ${JSON.stringify(file)};`),
    'import { StrictMode, createElement } from "react";',
    'import { createRoot } from "react-dom/client";',
    `import { createRexEntry } from ${JSON.stringify(options.client)};`,
    `import { startRexEntry } from ${JSON.stringify(options.client)};`,
    ...(apiOrigin === null
      ? []
      : [`import { ${API_FETCH_EXPORT} } from ${JSON.stringify(options.client)};`]),
    `import app from ${JSON.stringify(APP_MODULE_ID)};`,
    "",
    `const container = document.getElementById(${JSON.stringify(rootElement)});`,
    "if (container === null) {",
    `  throw new Error(${JSON.stringify(`rex: index.html has no element with id "${rootElement}"`)});`,
    "}",
    `if (container.hasAttribute(${JSON.stringify(SSR_ATTRIBUTE)})) {`,
    `  startRexEntry(container, app, { dev: import.meta.env.DEV${baseUrl === null ? "" : `, ${baseUrl}`} });`,
    "} else {",
    `  const RexEntry = createRexEntry(app${baseUrl === null ? "" : `, { ${baseUrl} }`});`,
    "  createRoot(container).render(createElement(StrictMode, null, createElement(RexEntry)));",
    "}",
    "",
  ].join("\n");
}

export function entryModuleHook(context: RexHookContext): Plugin {
  return {
    name: "rex:entry",
    enforce: "pre",
    resolveId(id) {
      return id === ENTRY_MODULE_ID ? RESOLVED_ENTRY_MODULE_ID : null;
    },
    async load(id) {
      if (id !== RESOLVED_ENTRY_MODULE_ID) return null;
      const client = await resolveRuntimeEntry(
        this,
        context.state.root,
        CLIENT_SPECIFIER,
        context.paths.client,
      );
      return generateEntryModule({ client, apiOrigin: context.options.apiOrigin ?? null });
    },
  };
}
