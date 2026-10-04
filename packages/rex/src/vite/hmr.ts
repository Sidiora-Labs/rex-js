import { relative } from "node:path";
import { normalizePath, type DevEnvironment, type EnvironmentModuleNode, type Plugin } from "vite";
import { invalidateAppModule } from "./app-module.ts";
import type { RexHookContext } from "./hooks.ts";
import { pageIdOfModule } from "./split.ts";

export const PAGE_RELOAD_CODE = "REX320";
export const REX_NOTICE_EVENT = "rex:notice";
export const PAGE_DECLARATION_FILE = "page.ts";

export interface RexHmrNotice {
  readonly code: typeof PAGE_RELOAD_CODE;
  readonly page: string;
  readonly file: string;
  readonly message: string;
}

export function pageIdOfDeclaration(file: string, appPath: string): string | null {
  const prefix = `${normalizePath(appPath)}/pages/`;
  const normalized = normalizePath(file.split("?")[0] ?? file);
  if (!normalized.startsWith(prefix)) return null;
  const [pageId, name, ...rest] = normalized.slice(prefix.length).split("/");
  if (pageId === undefined || pageId === "" || rest.length > 0) return null;
  return name === PAGE_DECLARATION_FILE ? pageId : null;
}

export function pageReloadNotice(pageId: string, file: string): RexHmrNotice {
  return {
    code: PAGE_RELOAD_CODE,
    page: pageId,
    file,
    message: `${PAGE_RELOAD_CODE} page ${JSON.stringify(pageId)} changed its declaration in ${file}; rex:app and the page chunk were invalidated and the page reloads`,
  };
}

export function invalidatePage(
  environment: Pick<DevEnvironment, "moduleGraph">,
  appPath: string,
  pageId: string,
  declarations: readonly EnvironmentModuleNode[],
  timestamp: number,
): string[] {
  const graph = environment.moduleGraph;
  const targets = new Set<EnvironmentModuleNode>(declarations);
  for (const [id, node] of graph.idToModuleMap) {
    if (pageIdOfModule(id, appPath) === pageId) targets.add(node);
  }
  const seen = new Set<EnvironmentModuleNode>();
  for (const node of targets) graph.invalidateModule(node, seen, timestamp, true);
  invalidateAppModule(environment, timestamp);
  return [...targets].map((node) => node.id ?? node.url).sort();
}

export function hmrHook(context: RexHookContext): Plugin {
  return {
    name: "rex:hmr",
    hotUpdate(options) {
      if (options.type !== "update") return;
      const appPath = context.appPath();
      const pageId = pageIdOfDeclaration(options.file, appPath);
      if (pageId === null) return;
      const environment = this.environment;
      invalidatePage(environment, appPath, pageId, options.modules, options.timestamp);
      if (environment.config.consumer === "client") {
        const file = normalizePath(relative(context.state.root, options.file));
        const notice = pageReloadNotice(pageId, file);
        environment.logger.info(notice.message, { timestamp: true });
        environment.hot.send({ type: "custom", event: REX_NOTICE_EVENT, data: notice });
        environment.hot.send({ type: "full-reload", path: "*" });
      }
      return [];
    },
  };
}
