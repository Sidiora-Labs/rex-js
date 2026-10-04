import { spawn, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Finding } from "../check/index.ts";
import { resetDeprecations } from "../core/deprecated.ts";
import { AGENTS_FILE, MANIFEST_FILE } from "../manifest/scan.ts";
import type { Manifest } from "../manifest/types.ts";
import { SSR_ATTRIBUTE } from "../client/hydrate.ts";
import { RENDER_KIND_HEADER, RENDER_PAGE_HEADER } from "../server/routes/render.ts";
import {
  BUILD_TARGETS,
  CLIENT_DIR,
  type BuildTarget,
  DIST_DIR,
  MANIFEST_OUTPUT,
  SERVER_FILE,
  SERVING_PREFIX,
  buildApp,
  startHint,
  writtenLayout,
} from "./commands/build.ts";
import {
  PRERENDER_LIST_FILE,
  STATIC_HEADER,
  parsePrerenderList,
} from "../server/adapters/static-cache.ts";
import { devUrls, startDev } from "./commands/dev.ts";
import { loadRexConfig, nodeEnvRestorer } from "./config.ts";
import { EXIT_FAILURE, EXIT_OK, EXIT_USAGE, run, type RexCliIO } from "./index.ts";
import { configPluginOptions } from "./load.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const COMMANDS_TEST_TIMEOUT_MS = 240_000;
const DEV_REACT_MARKER = "A tree hydrated but some attributes";
const SERVER_START_TIMEOUT_MS = 30_000;
const APP_NAME = "commands-app";
const API_ORIGIN = "https://api.example.test";
const NODE_SPECIFIER = /["'`]node:[a-z_/]+["'`]/;
const EDGE_PROBE = [
  "const worker = (await import(process.argv[1])).default;",
  'const manifest = await worker.fetch(new Request("https://edge.test/rex/manifest"));',
  'const ping = await worker.fetch(new Request("https://edge.test/rex/rpc/ping", {',
  '  method: "POST",',
  '  headers: { "content-type": "application/json", origin: "https://edge.test" },',
  "  body: JSON.stringify({ json: {} }),",
  "}));",
  'const page = await worker.fetch(new Request("https://edge.test/", { headers: { accept: "text/html" } }));',
  "console.log(JSON.stringify({",
  "  manifest: { status: manifest.status, body: await manifest.json() },",
  "  ping: { status: ping.status, body: await ping.json() },",
  '  page: { status: page.status, type: page.headers.get("content-type"), body: await page.text() },',
  "}));",
  "process.exit(0);",
].join("\n");

const temporary: string[] = [];
const children: ChildProcess[] = [];

afterAll(() => {
  for (const child of children) child.kill("SIGKILL");
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function captureIO(cwd: string) {
  const out: string[] = [];
  const err: string[] = [];
  const io: RexCliIO = {
    cwd,
    out: (text) => {
      out.push(text);
    },
    err: (text) => {
      err.push(text);
    },
  };
  return { io, out: () => out.join(""), err: () => err.join("") };
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

async function cli(root: string, ...args: string[]) {
  const captured = captureIO(root);
  const code = await run(args, captured.io);
  return { code, out: captured.out(), err: captured.err() };
}

function waitForServing(child: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      reject(new Error(`node ${SERVER_FILE} did not start: ${stdout}${stderr}`));
    }, SERVER_START_TIMEOUT_MS);
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
      const line = stdout.split("\n").find((entry) => entry.startsWith(SERVING_PREFIX));
      if (line !== undefined) {
        clearTimeout(timer);
        resolve(line.slice(SERVING_PREFIX.length).trim());
      }
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`node ${SERVER_FILE} exited with ${code}: ${stdout}${stderr}`));
    });
  });
}

interface NodeRun {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runNode(
  args: readonly string[],
  cwd: string,
  timeoutMs: number = SERVER_START_TIMEOUT_MS,
): Promise<NodeRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...args], {
      cwd,
      env: { ...process.env, PORT: "0", HOST: "127.0.0.1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(child);
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`node ${args.join(" ")} did not exit: ${stdout}${stderr}`));
    }, timeoutMs);
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function serverModules(outDir: string): string[] {
  return readdirSync(outDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((file) => !file.startsWith(join(outDir, CLIENT_DIR)));
}

const SERVER_CHUNK_DIR = "assets";

function serverLayout(outDir: string): string[] {
  const chunkDir = join(outDir, SERVER_CHUNK_DIR);
  if (existsSync(chunkDir)) {
    for (const name of readdirSync(chunkDir)) expect(name, "server chunk").toMatch(/\.js$/);
  }
  return readdirSync(outDir)
    .filter((name) => name !== SERVER_CHUNK_DIR)
    .sort();
}

function entryScript(clientDir: string): string {
  const html = readFileSync(join(clientDir, "index.html"), "utf8");
  const match = /<script type="module" crossorigin src="\/(assets\/[^"]+\.js)"><\/script>/.exec(
    html,
  );
  expect(match, "index.html loads the entry chunk").not.toBeNull();
  return readFileSync(join(clientDir, (match as RegExpExecArray)[1] as string), "utf8");
}

describe("rex check, manifest, build and dev", { timeout: COMMANDS_TEST_TIMEOUT_MS }, () => {
  let root: string;

  beforeAll(async () => {
    const cwd = mkdtempSync(join(tmpdir(), "rex-commands-"));
    temporary.push(cwd);
    const created = captureIO(cwd);
    expect(await run(["new", APP_NAME, "--ui", "none"], created.io)).toBe(EXIT_OK);
    root = join(cwd, APP_NAME);
    installDependencies(root);
  }, COMMANDS_TEST_TIMEOUT_MS);

  it("rex check exits 0 on a generated app in the human and JSON formats", async () => {
    const human = await cli(root, "check");
    expect(human).toEqual({ code: EXIT_OK, out: "No findings.\n", err: "" });
    const json = await cli(root, "check", "--json");
    expect(json).toEqual({ code: EXIT_OK, out: "[]\n", err: "" });
  });

  it("rex manifest writes .rex/manifest.json and AGENTS.md that rex check finds fresh", async () => {
    const written = await cli(root, "manifest");
    expect(written.code).toBe(EXIT_OK);
    expect(written.err).toBe("");
    expect(written.out).toBe(`wrote ${MANIFEST_FILE} (1 pages, 1 actions)\nwrote ${AGENTS_FILE}\n`);

    const manifest = JSON.parse(readFileSync(join(root, MANIFEST_FILE), "utf8")) as Manifest;
    expect(manifest.app).toEqual({ name: APP_NAME });
    expect(manifest.pages.map((entry) => [entry.id, entry.route, entry.regions])).toEqual([
      ["home", "/", ["welcome"]],
    ]);
    expect(manifest.actions.map((entry) => entry.id)).toEqual(["ping"]);
    expect(manifest.entities.map((entry) => entry.id)).toEqual(["note"]);
    expect(manifest.policies.map((entry) => entry.id)).toEqual(["viewer"]);
    expect(readFileSync(join(root, AGENTS_FILE), "utf8")).toContain("home");

    const fresh = await cli(root, "check", "--json");
    expect(fresh).toEqual({ code: EXIT_OK, out: "[]\n", err: "" });

    writeFileSync(join(root, AGENTS_FILE), "hand edited\n");
    const stale = await cli(root, "check", "--json");
    expect(stale.code).toBe(EXIT_OK);
    expect((JSON.parse(stale.out) as Finding[]).map((entry) => entry.rule)).toEqual([
      "manifest/agents-stale",
    ]);
    expect((await cli(root, "manifest")).code).toBe(EXIT_OK);
  });

  it("rex build emits dist/server.js and dist/client/index.html and node dist/server.js serves the app", async () => {
    const built = await cli(root, "build");
    expect(built.err).toBe("");
    expect(built.code).toBe(EXIT_OK);
    expect(built.out).toContain(`wrote ${DIST_DIR}/client/ and ${DIST_DIR}/${SERVER_FILE}`);

    const serverFile = join(root, DIST_DIR, SERVER_FILE);
    const indexFile = join(root, DIST_DIR, "client", "index.html");
    expect(existsSync(serverFile)).toBe(true);
    expect(existsSync(indexFile)).toBe(true);
    const html = readFileSync(indexFile, "utf8");
    expect(html).not.toContain("/@rex/entry");
    expect(html).toMatch(/<script type="module" crossorigin src="\/assets\/[^"]+\.js"><\/script>/);

    const child = spawn(process.execPath, [serverFile], {
      cwd: root,
      env: { ...process.env, PORT: "0", HOST: "127.0.0.1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(child);
    const url = await waitForServing(child);
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const manifest = await fetch(`${url}/rex/manifest`);
    expect(manifest.status).toBe(200);
    const served = (await manifest.json()) as Manifest;
    expect(served.app).toEqual({ name: APP_NAME });
    expect(served.actions.map((entry) => entry.id)).toEqual(["ping"]);

    const page = await fetch(`${url}/`);
    expect(page.status).toBe(200);
    expect(page.headers.get(RENDER_KIND_HEADER)).toBe("page");
    const rendered = await page.text();
    expect(rendered).not.toBe(html);
    expect(rendered).toContain(SSR_ATTRIBUTE);

    const ping = await fetch(`${url}/rex/rpc/ping`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: url },
      body: JSON.stringify({ json: {} }),
    });
    expect(ping.status).toBe(200);
    expect(((await ping.json()) as { json: unknown }).json).toEqual({ ok: true });
    child.kill("SIGTERM");

    const direct = await buildApp(root, { logLevel: "silent" });
    expect(direct.serverFile).toBe(serverFile);
    expect(existsSync(serverFile)).toBe(true);
    expect(existsSync(join(direct.clientDir, "index.html"))).toBe(true);
  });

  it("rex build emits production bundles with NODE_ENV unset and leaves it unset", async () => {
    const restoreNodeEnv = nodeEnvRestorer();
    delete process.env.NODE_ENV;
    try {
      await loadRexConfig(root);
      expect(process.env.NODE_ENV).toBeUndefined();

      const built = await cli(root, "build");
      expect(built.err).toBe("");
      expect(built.code).toBe(EXIT_OK);
      expect(process.env.NODE_ENV).toBeUndefined();

      const assetsDir = join(root, DIST_DIR, "client", "assets");
      const assets = readdirSync(assetsDir);
      expect(assets.filter((name) => name.includes("jsx-dev-runtime"))).toEqual([]);
      for (const name of assets.filter((entry) => entry.endsWith(".js"))) {
        expect(readFileSync(join(assetsDir, name), "utf8")).not.toContain(DEV_REACT_MARKER);
      }
      const server = readFileSync(join(root, DIST_DIR, SERVER_FILE), "utf8");
      expect(server).not.toMatch(/process\.env\.NODE_ENV\s*[!=]==/);
    } finally {
      restoreNodeEnv();
    }
  });

  it("rex dev serves the client and the app server on one port", async () => {
    const vite = await startDev(root, { port: 0, host: "127.0.0.1", logLevel: "silent" });
    try {
      const [url] = devUrls(vite);
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
      const base = (url as string).replace(/\/$/, "");

      const manifest = await fetch(`${base}/rex/manifest`);
      expect(manifest.status).toBe(200);
      expect(((await manifest.json()) as Manifest).app).toEqual({ name: APP_NAME });

      const agent = await fetch(`${base}/rex/rpc/ping?density=agent`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: base },
        body: JSON.stringify({ json: {} }),
      });
      expect(agent.status).toBe(200);
      expect(agent.headers.get("x-rex-density")).toBe("agent");

      const page = await fetch(`${base}/`);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain('src="/@rex/entry"');

      const entry = await fetch(`${base}/@rex/entry`);
      expect(entry.status).toBe(200);
      expect(await entry.text()).toContain("createRexEntry");
    } finally {
      await vite.close();
    }
  });

  it("rex check exits 1 and dev and build stop on error findings unless --no-check", async () => {
    const stray = join(root, "app/pages/home/regions/stray");
    mkdirSync(stray, { recursive: true });
    writeFileSync(
      join(stray, "region.tsx"),
      [
        'import { region } from "@sidioralabs/rex/client";',
        "",
        'export default region("stray", () => <p>Stray</p>);',
        "",
      ].join("\n"),
    );
    try {
      const json = await cli(root, "check", "--json");
      expect(json.code).toBe(EXIT_FAILURE);
      const findings = JSON.parse(json.out) as Finding[];
      expect(findings.map((entry) => `${entry.rule} ${entry.file}`)).toContain(
        "parity/region-undeclared app/pages/home/regions/stray/region.tsx",
      );
      for (const entry of findings) {
        expect(Object.keys(entry)).toEqual([
          "rule",
          "severity",
          "file",
          "line",
          "column",
          "message",
          "hint",
        ]);
      }

      const human = await cli(root, "check");
      expect(human.code).toBe(EXIT_FAILURE);
      expect(human.out).toContain("app/pages/home/regions/stray/region.tsx");

      rmSync(join(root, DIST_DIR), { recursive: true, force: true });
      const build = await cli(root, "build");
      expect(build.code).toBe(EXIT_FAILURE);
      expect(build.out).toBe("");
      expect(build.err).toContain("parity/region-undeclared");
      expect(build.err).toContain("rex build: rex check reported");
      expect(existsSync(join(root, DIST_DIR))).toBe(false);

      const dev = await cli(root, "dev", "--port", "0");
      expect(dev.code).toBe(EXIT_FAILURE);
      expect(dev.out).toBe("");
      expect(dev.err).toContain("rex dev: rex check reported");

      const unchecked = await cli(root, "build", "--no-check");
      expect(unchecked.code).toBe(EXIT_OK);
      expect(existsSync(join(root, DIST_DIR, SERVER_FILE))).toBe(true);

      const badPort = await cli(root, "dev", "--port", "http");
      expect(badPort.code).toBe(EXIT_USAGE);
      expect(badPort.err).toContain("the port must be an integer");
    } finally {
      rmSync(stray, { recursive: true, force: true });
    }
  });

  it("rex new writes rex.config.ts with defineConfig and the commands read it", async () => {
    const configFile = join(root, "rex.config.ts");
    const generated = readFileSync(configFile, "utf8");
    expect(generated).toContain("export default defineConfig({");
    expect(generated).toContain("  app,");
    expect(generated).toContain("server: (bundle) =>");

    const legacy = [
      'import { anonymousActor } from "@sidioralabs/rex";',
      'import { createRexServer, memoryLedger } from "@sidioralabs/rex/server";',
      'import app from "rex:app";',
      "",
      "export default createRexServer({",
      "  registry: app.registry,",
      "  ledger: memoryLedger(),",
      "  actor: () => anonymousActor,",
      "  app: app.name,",
      "});",
      "",
    ].join("\n");
    const invalid = generated.replace("  app,", '  app,\n  render: { default: "edge" },');
    try {
      resetDeprecations();
      writeFileSync(configFile, legacy);
      const first = await cli(root, "check", "--json");
      expect(first.code).toBe(EXIT_OK);
      expect(first.out).toBe("[]\n");
      expect(first.err.split("\n").filter((line) => line.includes("REX101"))).toHaveLength(1);
      expect(first.err).toContain("https://rex.sidioralabs.com/errors/REX101");
      const again = await cli(root, "manifest");
      expect(again.code).toBe(EXIT_OK);
      expect(again.err).not.toContain("REX101");

      writeFileSync(configFile, invalid);
      const rejected = await cli(root, "check");
      expect(rejected.code).toBe(EXIT_FAILURE);
      expect(rejected.err).toContain("REX113");
      expect(rejected.err).toContain('field "render.default"');
      expect(rejected.err).toContain("https://rex.sidioralabs.com/errors/REX113");
      const manifest = await cli(root, "manifest");
      expect(manifest.code).toBe(EXIT_FAILURE);
      expect(manifest.err).toContain("rex manifest: REX113");
      const build = await cli(root, "build", "--no-check");
      expect(build.code).toBe(EXIT_FAILURE);
      expect(build.err).toContain("REX113");
    } finally {
      writeFileSync(configFile, generated);
      resetDeprecations();
    }
    const restored = await cli(root, "check", "--json");
    expect(restored).toEqual({ code: EXIT_OK, out: "[]\n", err: "" });
  });

  it("rex build prints the chunk table and fails a page chunk over the rex.config page budget", async () => {
    const built = await cli(root, "build", "--no-check");
    expect(built.code).toBe(EXIT_OK);
    expect(built.out.split("\n")[0]).toMatch(/^chunk\s+raw\s+gzip\s+budget$/);
    expect(built.out).toMatch(/^page-home\s+[\d.]+ KB\s+[\d.]+ KB\s+50 KB$/m);

    const configFile = join(root, "rex.config.ts");
    const generated = readFileSync(configFile, "utf8");
    try {
      writeFileSync(configFile, generated.replace("  app,", "  app,\n  budgets: { page: 0.01 },"));
      const over = await cli(root, "build", "--no-check");
      expect(over.code).toBe(EXIT_FAILURE);
      expect(over.out).toMatch(/^page-home\s+[\d.]+ KB\s+[\d.]+ KB\s+0\.01 KB OVER$/m);
      expect(over.err).toContain("rex build: page-home (");
      expect(over.err).toContain("budget 0.01 KB) over budget");
    } finally {
      writeFileSync(configFile, generated);
    }
  });

  it("passes compiler, devtools, tailwind, ui, security.secretNames, ui.components, fonts and i18n from rex.config.ts into rex()", async () => {
    expect(configPluginOptions((await loadRexConfig(root)).read)).toEqual({
      compiler: true,
      devtools: true,
      tailwind: false,
      ui: "none",
      secretNames: [],
      shellComponents: null,
      fonts: [],
      i18n: null,
    });
    const configFile = join(root, "rex.config.ts");
    const generated = readFileSync(configFile, "utf8");
    try {
      writeFileSync(
        configFile,
        generated.replace(
          "  app,",
          [
            "  app,",
            "  compiler: false,",
            "  devtools: false,",
            "  tailwind: true,",
            '  ui: { kit: "designx", components: "app/components/Button.tsx" },',
            '  security: { secretNames: ["STRIPE_KEY"] },',
            '  fonts: [{ family: "Inter", src: "/fonts/inter.woff2", weight: "100 900" }, { family: "Mono", src: "/fonts/mono.woff2" }],',
            '  i18n: { locales: ["en", "de"], default: "en" },',
          ].join("\n"),
        ),
      );
      expect(configPluginOptions((await loadRexConfig(root)).read)).toEqual({
        compiler: false,
        devtools: false,
        tailwind: true,
        ui: "designx",
        secretNames: ["STRIPE_KEY"],
        shellComponents: "app/components/Button.tsx",
        fonts: [
          {
            family: "Inter",
            src: "/fonts/inter.woff2",
            weight: "100 900",
            style: "normal",
            preload: true,
          },
          { family: "Mono", src: "/fonts/mono.woff2", style: "normal", preload: true },
        ],
        i18n: { locales: ["en", "de"], default: "en", routing: "none" },
      });
    } finally {
      writeFileSync(configFile, generated);
    }
  });

  it("rex build --target node, bun and deno write dist/client, dist/server.js and the prerender list with the runtime's server entry", async () => {
    const entries = {
      node: {
        start: "startPrerenderedNodeServer",
        hint: `start it with node ${DIST_DIR}/${SERVER_FILE}`,
      },
      bun: { start: "startBunServer", hint: `start it with bun ${DIST_DIR}/${SERVER_FILE}` },
      deno: {
        start: "startDenoServer",
        hint: `start it with deno run --allow-net --allow-read --allow-env ${DIST_DIR}/${SERVER_FILE}`,
      },
    } as const;
    for (const [target, expected] of Object.entries(entries)) {
      const built = await buildApp(root, { logLevel: "silent", target: target as BuildTarget });
      const outDir = join(root, DIST_DIR);
      expect(built.target, target).toBe(target);
      expect(built.serverFile, target).toBe(join(outDir, SERVER_FILE));
      expect(built.prerenderFile, target).toBe(join(outDir, PRERENDER_LIST_FILE));
      expect(writtenLayout(built), target).toBe(
        `${DIST_DIR}/${CLIENT_DIR}/ and ${DIST_DIR}/${SERVER_FILE}`,
      );
      expect(startHint(built), target).toBe(`${expected.hint} (${join(outDir, SERVER_FILE)})`);

      expect(serverLayout(outDir), target).toEqual(
        [CLIENT_DIR, MANIFEST_OUTPUT, PRERENDER_LIST_FILE, SERVER_FILE].sort(),
      );
      expect(existsSync(join(outDir, CLIENT_DIR, "index.html")), target).toBe(true);
      const server = readFileSync(join(outDir, SERVER_FILE), "utf8");
      expect(server, target).toContain(expected.start);
      expect(server, target).toContain("installNodeStaticPages");
      for (const other of Object.values(entries)) {
        if (other.start !== expected.start) expect(server, target).not.toContain(other.start);
      }
      if (target === "node") expect(server, target).not.toContain("createEdgeHandler");
    }

    for (const [target, runtime] of [
      ["bun", "Bun"],
      ["deno", "Deno"],
    ] as const) {
      await buildApp(root, { logLevel: "silent", target });
      const run = await runNode([join(root, DIST_DIR, SERVER_FILE)], root);
      expect(run.code, target).not.toBe(0);
      expect(run.stdout, target).not.toContain(SERVING_PREFIX);
      expect(run.stderr, target).toContain(
        `REX450 start${runtime}Server: the ${runtime} runtime global is absent`,
      );
    }
  });

  it("rex build --target edge writes a fetch-only worker module whose default export serves the app", async () => {
    const built = await buildApp(root, { logLevel: "silent", target: "edge" });
    const outDir = join(root, DIST_DIR);
    expect(built.serverFile).toBe(join(outDir, SERVER_FILE));
    expect(built.prerenderFile).toBeNull();
    expect(built.prerendered).toEqual([]);
    expect(writtenLayout(built)).toBe(`${DIST_DIR}/${CLIENT_DIR}/ and ${DIST_DIR}/${SERVER_FILE}`);
    expect(startHint(built)).toBe(
      `deploy ${DIST_DIR}/${SERVER_FILE} as the worker module (export default { fetch }) and ${DIST_DIR}/${CLIENT_DIR}/ as its static assets`,
    );

    expect(existsSync(join(outDir, SERVER_FILE))).toBe(true);
    expect(existsSync(join(outDir, CLIENT_DIR, "index.html"))).toBe(true);
    expect(serverLayout(outDir)).toEqual([CLIENT_DIR, MANIFEST_OUTPUT, SERVER_FILE].sort());
    const modules = serverModules(outDir);
    expect(modules).toContain(join(outDir, SERVER_FILE));
    for (const file of modules) {
      const code = readFileSync(file, "utf8");
      expect(code, file).not.toMatch(NODE_SPECIFIER);
      expect(code, file).not.toContain("startPrerenderedNodeServer");
    }
    expect(readFileSync(join(outDir, SERVER_FILE), "utf8")).toContain("createEdgeHandler");

    const run = await runNode(
      ["--input-type=module", "-e", EDGE_PROBE, pathToFileURL(join(outDir, SERVER_FILE)).href],
      root,
    );
    expect(run.stderr).toBe("");
    expect(run.code).toBe(0);
    const answered = JSON.parse(run.stdout) as {
      readonly manifest: { readonly status: number; readonly body: Manifest };
      readonly ping: { readonly status: number; readonly body: { readonly json: unknown } };
      readonly page: {
        readonly status: number;
        readonly type: string | null;
        readonly body: string;
      };
    };
    expect(answered.manifest.status).toBe(200);
    expect(answered.manifest.body.app).toEqual({ name: APP_NAME });
    expect(answered.manifest.body.actions.map((entry) => entry.id)).toEqual(["ping"]);
    expect(answered.ping.status).toBe(200);
    expect(answered.ping.body.json).toEqual({ ok: true });
    expect(answered.page.status).toBe(200);
    expect(answered.page.type).toContain("text/html");
    expect(answered.page.body).toContain('<div id="root" data-rex-ssr="">');
  });

  it("rex build --target static writes dist/client only and bakes client.apiOrigin into the entry", async () => {
    const configFile = join(root, "rex.config.ts");
    const generated = readFileSync(configFile, "utf8");
    try {
      writeFileSync(
        configFile,
        generated.replace(
          "  app,",
          `  app,\n  client: { apiOrigin: ${JSON.stringify(API_ORIGIN)} },`,
        ),
      );
      const built = await buildApp(root, { logLevel: "silent", target: "static" });
      expect(built.target).toBe("static");
      expect(built.serverFile).toBeNull();
      expect(built.manifestFile).toBeNull();
      expect(built.prerenderFile).toBe(join(root, DIST_DIR, PRERENDER_LIST_FILE));
      expect(built.apiOrigin).toBe(API_ORIGIN);
      expect(writtenLayout(built)).toBe(`${DIST_DIR}/${CLIENT_DIR}/`);
      expect(startHint(built)).toBe(
        `serve ${DIST_DIR}/${CLIENT_DIR}/ from any static host; the client calls ${API_ORIGIN}`,
      );
      const outDir = join(root, DIST_DIR);
      expect(readdirSync(outDir).sort()).toEqual([CLIENT_DIR, PRERENDER_LIST_FILE].sort());
      const clientDir = join(outDir, CLIENT_DIR);
      expect(existsSync(join(clientDir, "index.html"))).toBe(true);
      expect(existsSync(join(clientDir, "404.html"))).toBe(true);
      expect(existsSync(join(clientDir, "rex", "manifest"))).toBe(true);
      expect(entryScript(clientDir)).toMatch(/baseUrl:\s*(["`])https:\/\/api\.example\.test\1/);
      expect(
        readdirSync(clientDir, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
          .some((entry) =>
            /["'`]\/rex\/manifest["'`]/.test(
              readFileSync(join(entry.parentPath, entry.name), "utf8"),
            ),
          ),
        "a static client with client.apiOrigin asks its API server for the manifest and the actor",
      ).toBe(true);

      const node = await buildApp(root, { logLevel: "silent", target: "node" });
      expect(node.serverFile).toBe(join(outDir, SERVER_FILE));
      expect(node.apiOrigin).toBeNull();
      expect(entryScript(clientDir)).not.toContain(API_ORIGIN);
    } finally {
      writeFileSync(configFile, generated);
    }
  });

  it("rex build --target refuses a runtime it has no output layout for", async () => {
    const refused = await cli(root, "build", "--no-check", "--target", "lambda");
    expect(refused.code).toBe(EXIT_USAGE);
    expect(refused.out).toBe("");
    expect(refused.err).toContain(`the target must be one of ${BUILD_TARGETS.join(", ")}`);
  });

  it("rex manifest, dev and build fail with exit 1 outside a Rex app", async () => {
    const empty = mkdtempSync(join(tmpdir(), "rex-commands-empty-"));
    temporary.push(empty);
    const manifest = await cli(empty, "manifest");
    expect(manifest.code).toBe(EXIT_FAILURE);
    expect(manifest.err).toContain("rex manifest: REX500 manifest scan");
    const build = await cli(empty, "build", "--no-check");
    expect(build.code).toBe(EXIT_FAILURE);
    expect(build.err).toContain("rex.config.ts is missing");
    const dev = await cli(empty, "dev", "--no-check");
    expect(dev.code).toBe(EXIT_FAILURE);
    expect(dev.err).toContain("rex.config.ts is missing");
  });
});

const CLI_EMIT_TIMEOUT_MS = 180_000;
const DIST_BUILD_TIMEOUT_MS = 180_000;
const PRERENDER_APP_NAME = "prerender-app";

function emitDistCli(): string {
  const cache = join(packageRoot, "node_modules", ".cache");
  mkdirSync(cache, { recursive: true });
  const outDir = mkdtempSync(join(cache, "rex-dist-cli-"));
  temporary.push(outDir);
  const config = ts.getParsedCommandLineOfConfigFile(
    join(packageRoot, "tsconfig.build.json"),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      },
    },
  );
  if (config === undefined) throw new Error("tsconfig.build.json could not be read");
  const program = ts.createProgram({
    rootNames: config.fileNames,
    options: { ...config.options, outDir, declaration: false },
  });
  expect(program.emit().emitSkipped).toBe(false);
  const entry = join(outDir, basename(here), "index.js");
  expect(existsSync(entry)).toBe(true);
  return entry;
}

function declareRender(root: string, pageId: string, render: "ssg" | "static"): void {
  const file = join(root, "app", "pages", pageId, "page.ts");
  const source = readFileSync(file, "utf8");
  const route = `  route: ${JSON.stringify(`/${pageId}`)},\n`;
  expect(source, `${pageId}/page.ts declares its route`).toContain(route);
  writeFileSync(file, source.replace(route, `${route}  render: ${JSON.stringify(render)},\n`));
}

describe(
  "rex build from the emitted dist CLI with an ssg and a static page",
  { timeout: DIST_BUILD_TIMEOUT_MS },
  () => {
    let root: string;
    let distCli: string;

    beforeAll(async () => {
      distCli = emitDistCli();
      const cwd = mkdtempSync(join(tmpdir(), "rex-prerender-app-"));
      temporary.push(cwd);
      expect(await run(["new", PRERENDER_APP_NAME, "--ui", "none"], captureIO(cwd).io)).toBe(
        EXIT_OK,
      );
      root = join(cwd, PRERENDER_APP_NAME);
      installDependencies(root);
      for (const id of ["about", "guide"]) {
        const made = await cli(root, "make", "page", id);
        expect(made.err, `rex make page ${id}`).toBe("");
        expect(made.code).toBe(EXIT_OK);
      }
      declareRender(root, "about", "static");
      declareRender(root, "guide", "ssg");
      expect((await cli(root, "manifest")).code).toBe(EXIT_OK);
    }, CLI_EMIT_TIMEOUT_MS + COMMANDS_TEST_TIMEOUT_MS);

    it("prerenders both pages in the app's page runtime and the generated server serves them", async () => {
      const built = await runNode([distCli, "build"], root, DIST_BUILD_TIMEOUT_MS);
      expect(built.stderr).not.toMatch(/REX306|REX405/);
      expect(built.code, `${built.stdout}${built.stderr}`).toBe(EXIT_OK);
      expect(built.stdout).toContain(
        `rex build: prerendered /about -> ${DIST_DIR}/${CLIENT_DIR}/about/index.html (about, static)`,
      );
      expect(built.stdout).toContain(
        `rex build: prerendered /guide -> ${DIST_DIR}/${CLIENT_DIR}/guide/index.html (guide, ssg)`,
      );

      const outDir = join(root, DIST_DIR);
      const list = parsePrerenderList(
        JSON.parse(readFileSync(join(outDir, PRERENDER_LIST_FILE), "utf8")),
      );
      expect(list.pages.map((entry) => [entry.path, entry.page, entry.render])).toEqual([
        ["/about", "about", "static"],
        ["/guide", "guide", "ssg"],
      ]);
      const about = readFileSync(join(outDir, CLIENT_DIR, "about", "index.html"), "utf8");
      expect(about).toContain('data-rex-page="about"');
      expect(about).not.toContain('<script type="module"');
      expect(about).not.toContain(SSR_ATTRIBUTE);
      const guide = readFileSync(join(outDir, CLIENT_DIR, "guide", "index.html"), "utf8");
      expect(guide).toContain('data-rex-page="guide"');
      expect(guide).toContain(`${SSR_ATTRIBUTE}=""`);
      expect(guide).toContain('<script type="module"');

      const child = spawn(process.execPath, [join(outDir, SERVER_FILE)], {
        cwd: root,
        env: { ...process.env, PORT: "0", HOST: "127.0.0.1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      children.push(child);
      const url = await waitForServing(child);
      try {
        for (const [path, pageId] of [
          ["/about", "about"],
          ["/guide", "guide"],
        ] as const) {
          const response = await fetch(`${url}${path}`, { headers: { accept: "text/html" } });
          expect(response.status, path).toBe(200);
          expect(response.headers.get(RENDER_KIND_HEADER), path).toBe("page");
          expect(response.headers.get(RENDER_PAGE_HEADER), path).toBe(pageId);
          expect(response.headers.get(STATIC_HEADER), path).toBe("hit");
          expect(await response.text(), path).toContain(`data-rex-page="${pageId}"`);
        }
        const home = await fetch(`${url}/`, { headers: { accept: "text/html" } });
        expect(home.status).toBe(200);
        expect(home.headers.get(RENDER_PAGE_HEADER)).toBe("home");
        expect(home.headers.get(STATIC_HEADER)).toBeNull();
        expect(await home.text()).toContain(SSR_ATTRIBUTE);
      } finally {
        child.kill("SIGTERM");
      }
    });
  },
);
