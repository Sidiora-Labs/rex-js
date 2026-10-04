import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { Hono } from "hono";
import {
  createNodeApp,
  startNodeServer,
  type NodeFetchApp,
  type NodeServerOptions,
  type RunningNodeServer,
} from "./adapters/node.ts";
import {
  PRERENDER_LIST_VERSION,
  createStaticCache,
  parsePrerenderList,
  prerenderedFile,
  registerStaticCache,
  type PrerenderList,
  type StaticCache,
  type StaticCacheErrorHandler,
  type StaticPageStore,
} from "./adapters/static-cache.ts";

export * from "./adapters/node.ts";

function isMissing(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "ENOENT";
}

export function nodeStaticStore(clientDir: string): StaticPageStore {
  const root = resolve(clientDir);
  return Object.freeze({
    async read(path: string) {
      try {
        return await readFile(join(root, prerenderedFile(path)), "utf8");
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    async write(path: string, html: string) {
      const file = join(root, prerenderedFile(path));
      await mkdir(dirname(file), { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      await writeFile(temporary, html, "utf8");
      await rename(temporary, file);
    },
  });
}

export async function readPrerenderList(file: string): Promise<PrerenderList> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (isMissing(error)) return { version: PRERENDER_LIST_VERSION, pages: [] };
    throw error;
  }
  return parsePrerenderList(JSON.parse(text));
}

export interface NodeStaticPagesOptions {
  readonly clientDir: string;
  readonly list: string | PrerenderList;
  readonly onError?: StaticCacheErrorHandler;
}

export async function installNodeStaticPages(
  registry: object,
  options: NodeStaticPagesOptions,
): Promise<StaticCache> {
  const list =
    typeof options.list === "string" ? await readPrerenderList(options.list) : parsePrerenderList(options.list);
  const cache = createStaticCache({
    pages: list.pages,
    store: nodeStaticStore(options.clientDir),
    ...(options.onError === undefined ? {} : { onError: options.onError }),
  });
  registerStaticCache(registry, cache);
  return cache;
}

export const createPrerenderedNodeApp: (
  app: NodeFetchApp,
  clientDir: string,
  registry?: object,
) => Hono = createNodeApp;

export interface PrerenderedNodeServerOptions extends NodeServerOptions {
  readonly registry: object;
}

export function startPrerenderedNodeServer(
  app: NodeFetchApp,
  options: PrerenderedNodeServerOptions,
): Promise<RunningNodeServer> {
  const { port, hostname, clientDir } = options;
  return startNodeServer(
    app,
    hostname === undefined ? { port, clientDir } : { port, clientDir, hostname },
  );
}
