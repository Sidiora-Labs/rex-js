import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { serve, type ServerType } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

export const API_PREFIX = "/rex";
export const INDEX_FILE = "index.html";

export interface NodeFetchApp {
  fetch(request: Request, env?: unknown): Response | Promise<Response>;
}

export interface NodeServerOptions {
  readonly port: number;
  readonly clientDir: string;
  readonly hostname?: string;
}

export interface RunningNodeServer {
  readonly server: ServerType;
  readonly port: number;
  readonly url: string;
  close(): Promise<void>;
}

export function isApiPath(path: string): boolean {
  return path === API_PREFIX || path.startsWith(`${API_PREFIX}/`);
}

export function isPageRoutePath(path: string): boolean {
  const last = path.split("/").at(-1) ?? "";
  return !last.includes(".");
}

export function createNodeApp(app: NodeFetchApp, clientDir: string): Hono {
  const root = resolve(clientDir);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`startNodeServer: clientDir "${root}" is not a directory`);
  }
  const indexPath = join(root, INDEX_FILE);
  if (!existsSync(indexPath)) {
    throw new Error(`startNodeServer: clientDir "${root}" has no ${INDEX_FILE}`);
  }
  const assets = serveStatic({ root });
  const outer = new Hono();

  outer.use("*", async (c, next) => {
    if (isApiPath(c.req.path) || (c.req.method !== "GET" && c.req.method !== "HEAD")) {
      return next();
    }
    return assets(c, next);
  });

  outer.use("*", async (c, next) => {
    if (
      isApiPath(c.req.path) ||
      (c.req.method !== "GET" && c.req.method !== "HEAD") ||
      !isPageRoutePath(c.req.path)
    ) {
      return next();
    }
    return c.html(await readFile(indexPath, "utf8"));
  });

  outer.all("*", (c) => app.fetch(c.req.raw, c.env));

  return outer;
}

export function startNodeServer(
  app: NodeFetchApp,
  options: NodeServerOptions,
): Promise<RunningNodeServer> {
  const { port, hostname } = options;
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new RangeError(`startNodeServer: port must be an integer from 0 to 65535`);
  }
  const outer = createNodeApp(app, options.clientDir);
  return new Promise((resolvePromise, reject) => {
    const server = serve(
      hostname === undefined
        ? { fetch: outer.fetch, port }
        : { fetch: outer.fetch, port, hostname },
      (info: AddressInfo) => {
        server.off("error", reject);
        const host = hostname ?? "localhost";
        const urlHost = host.includes(":") ? `[${host}]` : host;
        resolvePromise({
          server,
          port: info.port,
          url: `http://${urlHost}:${info.port}`,
          close: () =>
            new Promise<void>((done, fail) => {
              server.close((error) => (error ? fail(error) : done()));
            }),
        });
      },
    );
    server.once("error", reject);
  });
}
