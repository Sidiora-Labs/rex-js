import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { gunzipSync } from "node:zlib";
import {
  FALLBACK_TYPE,
  acceptsGzip,
  contentType,
  parseArgs,
  resolveRequest,
  serveStatic,
} from "./serve-static.mjs";

let root;
let running;

function write(path, content) {
  const file = join(root, path);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, content);
}

before(async () => {
  root = mkdtempSync(join(tmpdir(), "serve-static-"));
  write("index.html", "<!doctype html><title>home</title>");
  write("404.html", "<!doctype html><title>not found</title>");
  write("docs/index.html", "<!doctype html><title>docs</title>");
  write("docs/tutorial/index.html", "<!doctype html><title>tutorial</title>");
  write("docs/tutorial/index.md", "# Tutorial\n");
  write("about.html", "<!doctype html><title>about</title>");
  write("rex/manifest", '{"version":1}');
  write("assets/app.js", "export {};\n");
  write("assets/app.css", "body{}\n");
  write("og.png", "png");
  write("CNAME", "rex.sidioralabs.com\n");
  running = await serveStatic(root, { port: 0 });
});

after(async () => {
  await running.close();
  rmSync(root, { recursive: true, force: true });
});

function get(path, init) {
  return fetch(new URL(path, running.url), { redirect: "manual", ...init });
}

describe("index resolution", () => {
  it("serves index.html for the root", async () => {
    const response = await get("/");
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<title>home<\/title>/);
  });

  it("serves a directory's index.html for a path ending in a slash", async () => {
    const response = await get("/docs/tutorial/");
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<title>tutorial<\/title>/);
  });

  it("redirects a directory path without the slash to the slashed path, keeping the query", async () => {
    const response = await get("/docs/tutorial?density=agent");
    assert.equal(response.status, 301);
    assert.equal(response.headers.get("location"), "/docs/tutorial/?density=agent");
  });

  it("serves name.html for an extensionless path", async () => {
    const response = await get("/about");
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<title>about<\/title>/);
  });

  it("serves a file next to a prerendered page", async () => {
    const response = await get("/docs/tutorial/index.md");
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "# Tutorial\n");
  });

  it("resolves paths without touching the network", () => {
    assert.deepEqual(resolveRequest(root, "/docs/"), {
      kind: "file",
      file: join(root, "docs", "index.html"),
    });
    assert.deepEqual(resolveRequest(root, "/docs"), { kind: "redirect", location: "/docs/" });
    assert.deepEqual(resolveRequest(root, "/missing/"), { kind: "not-found" });
  });
});

describe("404.html", () => {
  it("answers an unknown route with 404.html and status 404", async () => {
    const response = await get("/no/such/page");
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
    assert.match(await response.text(), /<title>not found<\/title>/);
  });

  it("answers a directory without index.html with 404.html", async () => {
    write("empty/.keep", "");
    const response = await get("/empty/");
    assert.equal(response.status, 404);
    assert.match(await response.text(), /<title>not found<\/title>/);
  });

  it("never serves a file outside the root", async () => {
    const outside = join(root, "..", "serve-static-secret.txt");
    writeFileSync(outside, "secret");
    try {
      for (const path of [
        "/../serve-static-secret.txt",
        "/%2e%2e/serve-static-secret.txt",
        "/docs/%2e%2e/%2e%2e/serve-static-secret.txt",
      ]) {
        const response = await get(path);
        assert.equal(response.status, 404, path);
        assert.doesNotMatch(await response.text(), /secret/);
      }
    } finally {
      rmSync(outside, { force: true });
    }
  });

  it("refuses methods a static host does not answer", async () => {
    const response = await get("/", { method: "POST" });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD");
  });

  it("answers HEAD without a body", async () => {
    const response = await get("/", { method: "HEAD", headers: { "accept-encoding": "identity" } });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "");
    assert.equal(response.headers.get("content-length"), "34");
  });
});

function raw(path, headers) {
  return new Promise((resolve, reject) => {
    const outgoing = request(new URL(path, running.url), { headers }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ response, body: Buffer.concat(chunks) }));
    });
    outgoing.on("error", reject);
    outgoing.end();
  });
}

describe("compression", () => {
  it("gzips text a client accepts gzip for, like a production static host", async () => {
    const { response, body } = await raw("/assets/app.js", { "accept-encoding": "gzip, br" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-encoding"], "gzip");
    assert.equal(response.headers.vary, "accept-encoding");
    assert.equal(response.headers["content-length"], String(body.length));
    assert.equal(gunzipSync(body).toString(), "export {};\n");
  });

  it("serves text uncompressed to a client that does not accept gzip", async () => {
    const { response, body } = await raw("/docs/", { "accept-encoding": "identity" });
    assert.equal(response.headers["content-encoding"], undefined);
    assert.equal(body.toString(), "<!doctype html><title>docs</title>");
  });

  it("never gzips binary files", async () => {
    const { response, body } = await raw("/og.png", { "accept-encoding": "gzip" });
    assert.equal(response.headers["content-encoding"], undefined);
    assert.equal(body.toString(), "png");
  });

  it("gzips the 404 page with its status", async () => {
    const { response, body } = await raw("/missing", { "accept-encoding": "gzip" });
    assert.equal(response.statusCode, 404);
    assert.match(gunzipSync(body).toString(), /<title>not found<\/title>/);
  });

  it("reads gzip from the accept-encoding header, honouring q=0", () => {
    assert.equal(acceptsGzip("gzip, deflate, br"), true);
    assert.equal(acceptsGzip("br;q=1.0, gzip;q=0.8"), true);
    assert.equal(acceptsGzip("*"), true);
    assert.equal(acceptsGzip("gzip;q=0"), false);
    assert.equal(acceptsGzip("identity"), false);
    assert.equal(acceptsGzip(undefined), false);
  });
});

describe("content types", () => {
  const cases = [
    ["/", "text/html; charset=utf-8"],
    ["/assets/app.js", "text/javascript; charset=utf-8"],
    ["/assets/app.css", "text/css; charset=utf-8"],
    ["/og.png", "image/png"],
    ["/docs/tutorial/index.md", "text/markdown; charset=utf-8"],
    ["/rex/manifest", FALLBACK_TYPE],
    ["/CNAME", FALLBACK_TYPE],
  ];
  for (const [path, type] of cases) {
    it(`serves ${path} as ${type}`, async () => {
      const response = await get(path);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), type);
    });
  }

  it("maps extensions case-insensitively", () => {
    assert.equal(contentType("logo.SVG"), "image/svg+xml");
    assert.equal(contentType("font.woff2"), "font/woff2");
    assert.equal(contentType("data.json"), "application/json; charset=utf-8");
  });
});

describe("arguments", () => {
  it("reads the directory, port and host", () => {
    assert.deepEqual(parseArgs(["dist/client", "--port", "4000", "--host", "0.0.0.0"]), {
      root: "dist/client",
      port: 4000,
      host: "0.0.0.0",
    });
  });

  it("rejects a missing directory and a bad port", () => {
    assert.throws(() => parseArgs([]), /usage/);
    assert.throws(() => parseArgs(["dist", "--port", "http"]), /port number/);
  });
});
