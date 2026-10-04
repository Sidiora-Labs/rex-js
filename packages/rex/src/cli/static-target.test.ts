import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SSR_ATTRIBUTE } from "../client/hydrate.ts";
import type { Actor } from "../core/actor.ts";
import { REX_MANIFEST_PATH } from "../core/protocol.ts";
import { parseManifest } from "../client/app.tsx";
import { PRERENDER_LIST_FILE, parsePrerenderList } from "../server/adapters/static-cache.ts";
import { pageTextPath } from "../server/routes/pages-text.ts";
import type { createRexServer, memoryLedger } from "../server/index.ts";
import { NOT_FOUND_FILE, PRERENDER_TEXT_FILE, STATIC_MANIFEST_FILE } from "../vite/prerender.ts";
import { STATIC_HOST_DEFINE, STATIC_HOST_ENV_KEY } from "../vite/entry-module.ts";
import {
  CLIENT_DIR,
  DIST_DIR,
  buildApp,
  formatHostFiles,
  formatStaticOutputs,
  startHint,
  writtenLayout,
  type BuildResult,
} from "./commands/build.ts";
import { EXIT_OK, run, type RexCliIO } from "./index.ts";
import { loadAppBundle, withModuleLoader } from "./load.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const fixturePages = join(here, "fixtures", "static-site", "app", "pages");
const APP_NAME = "static-site";
const STATIC_TEST_TIMEOUT_MS = 240_000;
const ORIGIN = "http://static.test";
const MANIFEST_REQUEST = new RegExp(
  `["'\`]${REX_MANIFEST_PATH}["'\`]|${REX_MANIFEST_PATH} (answered|did not return JSON)`,
);

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function silentIO(cwd: string): RexCliIO {
  return { cwd, out: () => {}, err: () => {} };
}

function installDependencies(root: string): void {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    readonly dependencies: Readonly<Record<string, string>>;
    readonly devDependencies: Readonly<Record<string, string>>;
  };
  for (const name of [
    ...Object.keys(manifest.dependencies),
    ...Object.keys(manifest.devDependencies),
  ]) {
    const source =
      name === "@sidioralabs/rex" ? packageRoot : join(packageRoot, "node_modules", name);
    expect(existsSync(source), `${name} is resolvable from the rex package`).toBe(true);
    const destination = join(root, "node_modules", name);
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(realpathSync(source), destination, "dir");
  }
}

function clientScripts(clientDir: string): string[] {
  return readdirSync(clientDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => join(entry.parentPath, entry.name));
}

function moduleScript(html: string): string {
  const match = /<script type="module"[^>]*\bsrc="\/([^"]+\.js)"[^>]*><\/script>/.exec(html);
  expect(match, "the document loads the client entry").not.toBeNull();
  return (match as RegExpExecArray)[1] as string;
}

interface ServerModule {
  readonly createRexServer: typeof createRexServer;
  readonly memoryLedger: typeof memoryLedger;
}

interface ServerAnswers {
  readonly manifest: string;
  readonly texts: Readonly<Record<string, string>>;
}

async function serverAnswers(
  root: string,
  requests: Readonly<Record<string, string>>,
): Promise<ServerAnswers> {
  return withModuleLoader(
    root,
    async (loader) => {
      const app = await loadAppBundle(loader);
      const server = await loader.load<ServerModule & Record<string, unknown>>(
        "@sidioralabs/rex/server",
      );
      const core = await loader.load<{ readonly anonymousActor: Actor }>("@sidioralabs/rex");
      const hono = server.createRexServer({
        registry: app.registry,
        ledger: server.memoryLedger(),
        actor: () => core.anonymousActor,
        app: app.name,
      });
      const manifest = await hono.fetch(new Request(`${ORIGIN}${REX_MANIFEST_PATH}`));
      expect(manifest.status).toBe(200);
      const texts: Record<string, string> = {};
      for (const [path, request] of Object.entries(requests)) {
        const answered = await hono.fetch(new Request(`${ORIGIN}${request}`));
        expect(answered.status, request).toBe(200);
        texts[path] = await answered.text();
      }
      return { manifest: await manifest.text(), texts };
    },
    { logLevel: "silent" },
  );
}

describe("rex build --target static", { timeout: STATIC_TEST_TIMEOUT_MS }, () => {
  let root: string;
  let built: BuildResult;
  let clientDir: string;

  beforeAll(async () => {
    const cwd = mkdtempSync(join(tmpdir(), "rex-static-target-"));
    temporary.push(cwd);
    expect(await run(["new", APP_NAME, "--ui", "none"], silentIO(cwd))).toBe(EXIT_OK);
    root = join(cwd, APP_NAME);
    installDependencies(root);
    cpSync(fixturePages, join(root, "app", "pages"), { recursive: true });
    built = await buildApp(root, { logLevel: "silent", target: "static" });
    clientDir = join(root, DIST_DIR, CLIENT_DIR);
  }, STATIC_TEST_TIMEOUT_MS);

  it("writes dist/client and dist/prerender.json, with no server and no server manifest", () => {
    const outDir = join(root, DIST_DIR);
    expect(built.target).toBe("static");
    expect(built.serverFile).toBeNull();
    expect(built.manifestFile).toBeNull();
    expect(built.apiOrigin).toBeNull();
    expect(built.prerenderFile).toBe(join(outDir, PRERENDER_LIST_FILE));
    expect(readdirSync(outDir).sort()).toEqual([CLIENT_DIR, PRERENDER_LIST_FILE].sort());
    expect(writtenLayout(built)).toBe(`${DIST_DIR}/${CLIENT_DIR}/`);
    expect(startHint(built)).toBe(
      `serve ${DIST_DIR}/${CLIENT_DIR}/ from any static host; the client calls the origin it is served from`,
    );
  });

  it("prerenders every ssg and static page with its paths and lists them in dist/prerender.json", () => {
    const list = parsePrerenderList(
      JSON.parse(readFileSync(built.prerenderFile as string, "utf8")),
    );
    expect(list.pages).toEqual(built.prerendered);
    expect(list.pages.map((entry) => [entry.path, entry.page, entry.render, entry.file])).toEqual([
      ["/guide", "guide", "static", "guide/index.html"],
      ["/news", "news", "ssg", "news/index.html"],
      ["/topics/routing", "topic", "static", "topics/routing/index.html"],
      ["/topics/forms", "topic", "static", "topics/forms/index.html"],
    ]);
    for (const entry of list.pages) {
      const html = readFileSync(join(clientDir, entry.file), "utf8");
      expect(html, entry.path).toContain(`data-rex-page="${entry.page}"`);
      expect(html, entry.path).toContain('type="application/rex+json"');
      if (entry.render === "static") {
        expect(html, entry.path).not.toContain('<script type="module"');
        expect(html, entry.path).not.toContain(SSR_ATTRIBUTE);
      } else {
        expect(html, entry.path).toContain(`${SSR_ATTRIBUTE}=""`);
      }
    }
    expect(readFileSync(join(clientDir, "guide", "index.html"), "utf8")).toContain(
      "Read the guide without JavaScript",
    );
  });

  it("writes rex/manifest as the JSON the manifest route answers and index.md as the text route answers", async () => {
    expect(built.staticManifestFile).toBe(join(clientDir, STATIC_MANIFEST_FILE));
    expect(STATIC_MANIFEST_FILE).toBe("rex/manifest");
    const file = readFileSync(join(clientDir, STATIC_MANIFEST_FILE), "utf8");
    const manifest = parseManifest(JSON.parse(file));
    expect(manifest.pages.map((entry) => entry.id).sort()).toEqual(
      ["console", "guide", "home", "item", "news", "topic"].sort(),
    );

    expect(built.textFiles).toEqual(
      built.prerendered.map((entry) => entry.file.replace(/index\.html$/, PRERENDER_TEXT_FILE)),
    );
    const requests: Record<string, string> = {
      "/guide": pageTextPath("guide"),
      "/news": pageTextPath("news"),
      "/topics/routing": `${pageTextPath("topic")}?slug=routing`,
      "/topics/forms": `${pageTextPath("topic")}?slug=forms`,
    };
    const answers = await serverAnswers(root, requests);
    expect(file).toBe(answers.manifest);
    for (const entry of built.prerendered) {
      const text = readFileSync(
        join(clientDir, entry.file.replace(/index\.html$/, PRERENDER_TEXT_FILE)),
        "utf8",
      );
      expect(text, entry.path).toBe(answers.texts[entry.path]);
    }
    expect(answers.texts["/topics/forms"]).toContain("`/topics/forms`");
  });

  it("writes the shell document at every ssr and csr route without params and as 404.html", () => {
    expect(built.shells).toEqual([
      { path: "/", page: "home", file: "index.html" },
      { path: "/console", page: "console", file: "console/index.html" },
      { path: null, page: null, file: NOT_FOUND_FILE },
    ]);
    const shell = readFileSync(join(clientDir, NOT_FOUND_FILE), "utf8");
    expect(shell).toContain('<div id="root"></div>');
    expect(shell).not.toContain(SSR_ATTRIBUTE);
    expect(shell).not.toContain("data-rex-page");
    const entry = moduleScript(shell);
    expect(existsSync(join(clientDir, entry))).toBe(true);
    const news = readFileSync(join(clientDir, "news", "index.html"), "utf8");
    expect(moduleScript(news)).toBe(entry);
    for (const written of built.shells) {
      expect(readFileSync(join(clientDir, written.file), "utf8"), written.file).toBe(shell);
    }
    expect(existsSync(join(clientDir, "items"))).toBe(false);
  });

  it("builds a client that reads the inlined manifest and never requests the manifest route", () => {
    expect(STATIC_HOST_DEFINE).toBe(`import.meta.env.${STATIC_HOST_ENV_KEY}`);
    const scripts = clientScripts(clientDir);
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      expect(readFileSync(script, "utf8"), script).not.toMatch(MANIFEST_REQUEST);
    }
  });

  it("runs the static output list in order and the static host writer, which writes nothing", () => {
    expect(built.outputs.map((run) => run.id)).toEqual([
      "shell-documents",
      "static-manifest",
      "text-files",
      "prerender-list",
    ]);
    expect(built.host).toBe("static");
    expect(built.hostFiles).toEqual([]);
    expect(formatHostFiles(built)).toBe("");
  });

  it("prints every static output", () => {
    const client = `${DIST_DIR}/${CLIENT_DIR}`;
    expect(formatStaticOutputs(built)).toBe(
      [
        `rex build: wrote ${client}/index.html (home, the shell document for /)`,
        `rex build: wrote ${client}/console/index.html (console, the shell document for /console)`,
        `rex build: wrote ${client}/404.html (the shell document for unknown routes)`,
        `rex build: wrote ${client}/rex/manifest`,
        `rex build: wrote ${client}/guide/index.md`,
        `rex build: wrote ${client}/news/index.md`,
        `rex build: wrote ${client}/topics/routing/index.md`,
        `rex build: wrote ${client}/topics/forms/index.md`,
        `rex build: wrote ${DIST_DIR}/${PRERENDER_LIST_FILE}`,
        "",
      ].join("\n"),
    );
  });
});
