import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CONFIG_FILE } from "../../core/config.ts";
import { explainRexError } from "../../core/errors.docs.ts";
import { RexError } from "../../core/errors.ts";
import type { Manifest } from "../../manifest/types.ts";
import { InvalidArgumentError, RexArgsError, RexCommand } from "../args.ts";
import { configPath } from "../config.ts";
import { EXIT_FAILURE, EXIT_OK, RexCliExit, run, type RexCliIO } from "../index.ts";
import {
  DEFAULT_DEV_PORT,
  appConfigPath,
  cliWarn,
  devUrls,
  isFetchApp,
  parsePort,
  register,
  rexCliExit,
  startDev,
} from "./dev.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..", "..");
const APP_NAME = "dev-app";
const DEV_TEST_TIMEOUT_MS = 240_000;

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "rex-dev-command-"));
  temporary.push(dir);
  return dir;
}

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

describe("dev command helpers", () => {
  it("parsePort accepts integers from 0 to 65535 and refuses the rest", () => {
    expect(parsePort("0")).toBe(0);
    expect(parsePort("5173")).toBe(5173);
    expect(parsePort("65535")).toBe(65535);
    expect(DEFAULT_DEV_PORT).toBe(5173);
    for (const value of ["65536", "-1", "http", "1.5", "", " 80", "0x50"]) {
      expect(() => parsePort(value), value).toThrow(InvalidArgumentError);
      expect(() => parsePort(value), value).toThrow("the port must be an integer from 0 to 65535");
    }
  });

  it("isFetchApp recognises objects with a fetch method such as a Hono app", () => {
    expect(isFetchApp(new Hono())).toBe(true);
    expect(isFetchApp({ fetch: () => new Response() })).toBe(true);
    expect(isFetchApp({ fetch: "yes" })).toBe(false);
    expect(isFetchApp(() => undefined)).toBe(false);
    expect(isFetchApp(null)).toBe(false);
    expect(isFetchApp("fetch")).toBe(false);
  });

  it("cliWarn writes each deprecation to stderr on its own line", () => {
    const captured = captureIO(tmpdir());
    const warn = cliWarn(captured.io);
    warn("REX101 first");
    warn("REX101 second");
    expect(captured.err()).toBe("REX101 first\nREX101 second\n");
    expect(captured.out()).toBe("");
  });

  it("rexCliExit turns a RexError into a failing exit and rethrows anything else", () => {
    const error = new RexError("REX100", "rex.config.ts is missing in /opt/app");
    let thrown: unknown;
    try {
      rexCliExit(error);
    } catch (caught) {
      thrown = caught;
    }
    expect(thrown).toBeInstanceOf(RexCliExit);
    expect(thrown).toMatchObject({
      exitCode: EXIT_FAILURE,
      message: `rex: ${explainRexError(error)}`,
    });
    expect((thrown as RexCliExit).message).toContain("https://rex.sidioralabs.com/errors/REX100");

    const plain = new Error("boom");
    let rethrown: unknown;
    try {
      rexCliExit(plain);
    } catch (caught) {
      rethrown = caught;
    }
    expect(rethrown).toBe(plain);
  });

  it("appConfigPath returns the config file and exits with REX100 when it is missing", () => {
    const root = tempDir();
    let thrown: unknown;
    try {
      appConfigPath(root);
    } catch (caught) {
      thrown = caught;
    }
    expect(thrown).toBeInstanceOf(RexCliExit);
    expect((thrown as RexCliExit).exitCode).toBe(EXIT_FAILURE);
    expect((thrown as RexCliExit).message).toContain(`REX100 ${CONFIG_FILE} is missing in ${root}`);

    writeFileSync(join(root, CONFIG_FILE), "export default {};\n");
    expect(appConfigPath(root)).toBe(configPath(root));
    expect(appConfigPath(root)).toBe(join(root, CONFIG_FILE));
  });

  it("startDev refuses a root without rex.config.ts before creating a server", async () => {
    const root = tempDir();
    await expect(startDev(root, { port: 0, logLevel: "silent" })).rejects.toMatchObject({
      exitCode: EXIT_FAILURE,
      message: expect.stringContaining(`${CONFIG_FILE} is missing`),
    });
  });

  it("registers the port, host and check options and validates the port", async () => {
    const captured = captureIO(tempDir());
    const program = new RexCommand("rex").configureOutput({
      writeOut: captured.io.out,
      writeErr: captured.io.err,
    });
    register(program, captured.io);
    const [listing] = program.listing().commands;
    expect(listing).toMatchObject({ name: "dev", path: "rex dev", arguments: [] });
    expect(listing?.options).toMatchObject([
      { long: "--port", value: "port", default: DEFAULT_DEV_PORT },
      { long: "--host", value: "host" },
      { long: "--no-check", value: null, negate: true },
    ]);
    await expect(program.parseAsync(["dev", "--port", "70000"])).rejects.toThrow(RexArgsError);
    await expect(program.parseAsync(["dev", "--port", "70000"])).rejects.toThrow(
      "option '--port <port>' argument '70000' is invalid. the port must be an integer from 0 to 65535",
    );
    await expect(program.parseAsync(["dev", "--host"])).rejects.toThrow(
      "option '--host <host>' argument missing",
    );
    await expect(program.parseAsync(["dev", "--no-check", "--port", "0"])).rejects.toMatchObject({
      exitCode: EXIT_FAILURE,
      message: expect.stringContaining(`${CONFIG_FILE} is missing`),
    });
    expect(captured.out()).toBe("");
  });
});

describe("startDev on a generated app", { timeout: DEV_TEST_TIMEOUT_MS }, () => {
  let root: string;

  beforeAll(async () => {
    const cwd = tempDir();
    expect(await run(["new", APP_NAME, "--ui", "none"], captureIO(cwd).io)).toBe(EXIT_OK);
    root = join(cwd, APP_NAME);
    installDependencies(root);
  }, DEV_TEST_TIMEOUT_MS);

  it("serves the manifest and the client entry on one loopback port and reports its urls", async () => {
    const warnings: string[] = [];
    const vite = await startDev(root, {
      port: 0,
      host: "127.0.0.1",
      logLevel: "silent",
      warn: (message) => {
        warnings.push(message);
      },
    });
    try {
      const urls = devUrls(vite);
      expect(urls).toHaveLength(1);
      const [url] = urls as [string];
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
      expect(url).not.toContain(`:${DEFAULT_DEV_PORT}/`);
      const base = url.replace(/\/$/, "");
      const manifest = await fetch(`${base}/rex/manifest`);
      expect(manifest.status).toBe(200);
      expect(((await manifest.json()) as Manifest).app).toEqual({ name: APP_NAME });
      const entry = await fetch(`${base}/@rex/entry`);
      expect(entry.status).toBe(200);
      expect(await entry.text()).toContain("createRexEntry");
      expect(warnings).toEqual([]);
    } finally {
      await vite.close();
    }
    expect(devUrls(vite)).toEqual([]);
  });

  it("serves browser documents when defineConfig uses the default server", async () => {
    const config = configPath(root);
    const original = readFileSync(config, "utf8");
    writeFileSync(
      config,
      [
        'import { defineConfig } from "@sidioralabs/rex/config";',
        'import app from "rex:app";',
        'export default defineConfig({ app, ui: "none" });',
        "",
      ].join("\n"),
    );
    try {
      const vite = await startDev(root, { port: 0, host: "127.0.0.1", logLevel: "silent" });
      try {
        const [base] = devUrls(vite);
        if (base === undefined) throw new Error("Dev server has no URL");
        const headers = { accept: "text/html,application/xhtml+xml,*/*;q=0.8" };
        const response = await fetch(base, { headers });
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/html");
        expect(response.headers.get("x-rex-page")).toBe("home");
        const html = await response.text();
        expect(html).toContain('data-rex-page="home"');
        expect(html).toContain('type="application/rex+json"');
        expect(html).toContain('"page":"home"');
        expect(html).toContain("/@rex/entry");
        const head = await fetch(base, { method: "HEAD", headers });
        expect(head.status).toBe(200);
        expect(await head.text()).toBe("");
        const missing = await fetch(new URL("missing", base), { headers });
        expect(missing.status).toBe(404);
        expect(missing.headers.get("content-type")).toContain("text/html");
        const manifest = await fetch(new URL("rex/manifest", base));
        expect(manifest.status).toBe(200);
        expect(((await manifest.json()) as Manifest).app.name).toBe(APP_NAME);
      } finally {
        await vite.close();
      }
    } finally {
      writeFileSync(config, original);
    }
  });

  it("serves workspace source components through the built CLI with authored head assets and fresh CSP nonces", async () => {
    const built = (await import(
      pathToFileURL(join(packageRoot, "dist/cli/commands/dev.js")).href
    )) as typeof import("./dev.ts");
    const index = join(root, "index.html");
    const original = readFileSync(index, "utf8");
    writeFileSync(
      index,
      original.replace(
        "</head>",
        '<meta name="description" content="Dev document"><link rel="stylesheet" href="/app/theme.css"></head>',
      ),
    );
    try {
      const vite = await built.startDev(root, { port: 0, host: "127.0.0.1", logLevel: "silent" });
      try {
        const [base] = built.devUrls(vite);
        if (base === undefined) throw new Error("Dev server has no URL");
        const nonces = new Set<string>();
        for (let i = 0; i < 2; i += 1) {
          const response = await fetch(base, { headers: { accept: "text/html" } });
          expect(response.status).toBe(200);
          const html = await response.text();
          expect(html).toContain('data-rex-page="home"');
          expect(html).toContain('<meta name="description" content="Dev document">');
          expect(html).toContain('href="/app/theme.css"');
          const nonce = /'nonce-([^']+)'/.exec(
            response.headers.get("content-security-policy") ?? "",
          )?.[1];
          if (nonce === undefined) throw new Error("Document has no CSP nonce");
          nonces.add(nonce);
          const scriptNonces = [...html.matchAll(/<script\b[^>]*\bnonce="([^"]+)"/g)].map(
            (match) => match[1],
          );
          expect(scriptNonces.length).toBeGreaterThan(0);
          expect(scriptNonces.every((value) => value === nonce)).toBe(true);
          expect(html).toContain(`<meta property="csp-nonce" nonce="${nonce}">`);
        }
        expect(nonces.size).toBe(2);
      } finally {
        await vite.close();
      }
    } finally {
      writeFileSync(index, original);
    }
  });
});
