#!/usr/bin/env node
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const NOT_FOUND_PAGE = "404.html";
export const INDEX_PAGE = "index.html";
export const DEFAULT_PORT = 4173;
export const DEFAULT_HOST = "127.0.0.1";
export const SERVING_PREFIX = "serve-static: serving ";
export const FALLBACK_TYPE = "application/octet-stream";

export const CONTENT_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".pdf": "application/pdf",
});

export function contentType(file) {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? FALLBACK_TYPE;
}

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

function isDirectory(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

function decodePath(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

export function resolveRequest(root, pathname) {
  const base = resolve(root);
  const decoded = decodePath(pathname);
  if (decoded === null || decoded.includes("\0")) return { kind: "not-found" };
  const target = resolve(base, `.${decoded}`);
  if (target !== base && !target.startsWith(`${base}${sep}`)) return { kind: "not-found" };
  if (decoded.endsWith("/")) {
    const index = join(target, INDEX_PAGE);
    return isFile(index) ? { kind: "file", file: index } : { kind: "not-found" };
  }
  if (isFile(target)) return { kind: "file", file: target };
  if (isFile(`${target}.html`)) return { kind: "file", file: `${target}.html` };
  if (isDirectory(target) && isFile(join(target, INDEX_PAGE))) {
    return { kind: "redirect", location: `${pathname}/` };
  }
  return { kind: "not-found" };
}

function send(request, response, status, file) {
  const size = statSync(file).size;
  response.writeHead(status, {
    "content-type": contentType(file),
    "content-length": String(size),
    "cache-control": "no-cache",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
}

export function createStaticHandler(root) {
  const base = resolve(root);
  if (!isDirectory(base)) throw new Error(`serve-static: ${root} is not a directory`);
  return (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD", "content-type": CONTENT_TYPES[".txt"] });
      response.end("Method not allowed\n");
      return;
    }
    const url = new URL(request.url ?? "/", "http://static.local");
    const resolved = resolveRequest(base, url.pathname);
    if (resolved.kind === "redirect") {
      response.writeHead(301, { location: `${resolved.location}${url.search}` });
      response.end();
      return;
    }
    if (resolved.kind === "file") {
      send(request, response, 200, resolved.file);
      return;
    }
    const notFound = join(base, NOT_FOUND_PAGE);
    if (isFile(notFound)) {
      send(request, response, 404, notFound);
      return;
    }
    response.writeHead(404, { "content-type": CONTENT_TYPES[".txt"] });
    response.end("Not found\n");
  };
}

export function serveStatic(root, { port = DEFAULT_PORT, host = DEFAULT_HOST } = {}) {
  const server = createServer(createStaticHandler(root));
  return new Promise((done, fail) => {
    server.once("error", fail);
    server.listen(port, host, () => {
      server.off("error", fail);
      const address = server.address();
      const url = `http://${host}:${typeof address === "object" && address !== null ? address.port : port}`;
      done({
        url,
        server,
        close: () => new Promise((closed) => server.close(() => closed())),
      });
    });
  });
}

export function parseArgs(argv) {
  const options = { root: null, port: DEFAULT_PORT, host: DEFAULT_HOST };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--port" || arg === "--host") {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`serve-static: ${arg} needs a value`);
      index += 1;
      if (arg === "--port") {
        const port = Number(value);
        if (!Number.isInteger(port) || port < 0 || port > 65535) {
          throw new Error(`serve-static: --port must be a port number, got ${value}`);
        }
        options.port = port;
      } else {
        options.host = value;
      }
    } else if (options.root === null) {
      options.root = arg;
    } else {
      throw new Error(`serve-static: unexpected argument ${arg}`);
    }
  }
  if (options.root === null) {
    throw new Error("usage: node tools/serve-static.mjs <dir> [--port <n>] [--host <host>]");
  }
  return options;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const running = await serveStatic(options.root, options);
    console.log(`${SERVING_PREFIX}${resolve(options.root)} at ${running.url}`);
    const stop = () => void running.close().then(() => process.exit(0));
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
