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
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildApp,
  CLIENT_DIR,
  DIST_DIR,
  SERVER_FILE,
  SERVING_PREFIX,
} from "../cli/commands/build.ts";
import { devUrls, startDev } from "../cli/commands/dev.ts";
import { configPluginOptions } from "../cli/load.ts";
import { loadRexConfig } from "../cli/config.ts";
import { isRexError } from "../core/errors.ts";
import { generateAppModule, localeModules } from "./app-module.ts";
import { REX_HOOKS } from "./hooks.ts";
import { generateRenderModule } from "./ssr.ts";
import { scanApp } from "./scan.ts";
import { shellComponentsFile, shellComponentsHook } from "./shell-components.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const TEST_TIMEOUT_MS = 300_000;
const SERVER_START_TIMEOUT_MS = 60_000;
const SHELL_MODULE = "app/components/Shell.tsx";
const OVERRIDE_MARKER = 'data-shell-sheet="override"';
const FONT_PRELOAD =
  '<link rel="preload" as="font" href="/fonts/inter.woff2" type="font/woff2" crossorigin="">';
const FONT_FACE =
  '<style data-rex-fonts="">@font-face{font-family:"Inter";src:url("/fonts/inter.woff2") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}</style>';

const temporary: string[] = [];
const children: ChildProcess[] = [];

afterAll(() => {
  for (const child of children) child.kill("SIGKILL");
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

const STATE_NAMES = [
  "Loading",
  "Empty",
  "Stale",
  "Partial",
  "Offline",
  "PermissionDenied",
  "RecoverableError",
  "TerminalError",
] as const;

const FIXTURE: Readonly<Record<string, string>> = {
  "package.json": `${JSON.stringify({ name: "shell-fixture", private: true, type: "module" })}\n`,
  "index.html": [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="UTF-8" />',
    "    <title>Shell Fixture</title>",
    "  </head>",
    "  <body>",
    '    <div id="root"></div>',
    '    <script type="module" src="/@rex/entry"></script>',
    "  </body>",
    "</html>",
    "",
  ].join("\n"),
  "rex.config.ts": [
    'import { anonymousActor, defineConfig } from "@sidioralabs/rex";',
    'import { createRexServer, memoryLedger } from "@sidioralabs/rex/server";',
    'import app from "rex:app";',
    "",
    "export default defineConfig({",
    "  app,",
    "  compiler: false,",
    `  ui: { components: ${JSON.stringify(SHELL_MODULE)} },`,
    '  fonts: [{ family: "Inter", src: "/fonts/inter.woff2", weight: "100 900" }],',
    '  i18n: { locales: ["en", "de"], default: "en" },',
    "  server: (bundle) =>",
    "    createRexServer({",
    "      registry: bundle.registry,",
    "      ledger: memoryLedger(),",
    "      actor: () => anonymousActor,",
    "      app: bundle.name,",
    "    }),",
    "});",
    "",
  ].join("\n"),
  "app/locales/en.json": `${JSON.stringify({ "home.title": "Notes" })}\n`,
  "app/locales/de.json": `${JSON.stringify({ "home.title": "Notizen" })}\n`,
  [SHELL_MODULE]: [
    'import type { ShellSheetProps } from "@sidioralabs/rex/client";',
    "",
    "export function Sheet({ title, titleId, children }: ShellSheetProps) {",
    "  return (",
    '    <section data-shell-sheet="override">',
    "      <h2 id={titleId}>{title}</h2>",
    "      {children}",
    "    </section>",
    "  );",
    "}",
    "",
  ].join("\n"),
  "app/pages/home/page.ts": [
    'import { page } from "@sidioralabs/rex";',
    "",
    'export default page("home", {',
    '  route: "/",',
    '  chrome: { title: "msg:home.title" },',
    '  overlays: [{ id: "NoteSheet", dismiss: "both", binding: "url" }],',
    "});",
    "",
  ].join("\n"),
  "app/pages/home/view.tsx": [
    'import NoteSheet from "./overlays/NoteSheet.tsx";',
    "",
    "export default function HomeView() {",
    "  return (",
    "    <>",
    "      <p>Shell fixture home</p>",
    "      <NoteSheet />",
    "    </>",
    "  );",
    "}",
    "",
  ].join("\n"),
  "app/pages/home/overlays/NoteSheet.tsx": [
    'import { overlay } from "@sidioralabs/rex/client";',
    "",
    'export default overlay("NoteSheet", { dismiss: "both", binding: "url" }, () => <p>Note details</p>);',
    "",
  ].join("\n"),
  "app/pages/home/states.tsx": [
    'import type { StateProps } from "@sidioralabs/rex";',
    "",
    ...STATE_NAMES.flatMap((name) => [
      `export function ${name}(_props: StateProps) {`,
      `  return <p role="status">${name}</p>;`,
      "}",
      "",
    ]),
  ].join("\n"),
};

function link(root: string, name: string, target: string): void {
  const destination = join(root, "node_modules", name);
  mkdirSync(dirname(destination), { recursive: true });
  symlinkSync(realpathSync(target), destination, "dir");
}

function writeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "rex-shell-components-"));
  temporary.push(root);
  for (const [file, content] of Object.entries(FIXTURE)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  link(root, "@sidioralabs/rex", packageRoot);
  for (const name of ["react", "react-dom"])
    link(root, name, join(packageRoot, "node_modules", name));
  return root;
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

function runNode(args: readonly string[], cwd: string): Promise<NodeRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    children.push(child);
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`node ${args.join(" ")} did not exit: ${stdout}${stderr}`));
    }, SERVER_START_TIMEOUT_MS);
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

async function fetchPage(base: string, language: string): Promise<string> {
  const response = await fetch(`${base}/?overlay=NoteSheet`, {
    headers: { accept: "text/html", "accept-language": language },
  });
  expect(response.status).toBe(200);
  return response.text();
}

function expectRenderedApp(german: string, english: string): void {
  for (const html of [german, english]) {
    expect(html).toContain(OVERRIDE_MARKER);
    expect(html).toContain("Note details");
    expect(html).toContain(FONT_PRELOAD);
    expect(html).toContain(FONT_FACE);
  }
  expect(german).toContain('<html lang="de">');
  expect(german).toContain("<title>Notizen</title>");
  expect(english).toContain('<html lang="en">');
  expect(english).toContain("<title>Notes</title>");
}

function clientAssets(clientDir: string): string {
  const assets = join(clientDir, "assets");
  return readdirSync(assets)
    .filter((name) => name.endsWith(".js"))
    .map((name) => readFileSync(join(assets, name), "utf8"))
    .join("\n");
}

describe("vite/shell-components", () => {
  it("is registered in the ordered hook list", () => {
    expect(REX_HOOKS).toContain(shellComponentsHook);
  });

  it("fails with REX120 when ui.components names a module that does not exist", () => {
    const root = mkdtempSync(join(tmpdir(), "rex-shell-missing-"));
    temporary.push(root);
    let caught: unknown = null;
    try {
      shellComponentsFile(root, "app/components/Missing.tsx");
    } catch (error) {
      caught = error;
    }
    expect(isRexError(caught)).toBe(true);
    expect((caught as { code: string }).code).toBe("REX120");
    expect((caught as Error).message).toContain(
      'field "ui.components" names app/components/Missing.tsx, which does not exist',
    );
  });

  it("generates a rex:app that registers the shell components and the locale messages, and a rex:render that passes the fonts", () => {
    const root = writeFixture();
    const shell = shellComponentsFile(root, SHELL_MODULE);
    const locales = localeModules(join(root, "app"));
    expect(locales.map((entry) => entry.locale)).toEqual(["de", "en"]);
    const code = generateAppModule(scanApp(root, "app"), {
      name: "shell-fixture",
      core: "/rex/index.ts",
      client: "/rex/client/index.ts",
      config: {
        fonts: [{ family: "Inter", src: "/fonts/inter.woff2" }],
        i18n: { locales: ["en", "de"], default: "en", routing: "none" },
      },
      shellComponents: shell,
      locales,
    });
    expect(code).toContain(
      'import { registerShellComponents as rexRegisterShellComponents } from "/rex/client/index.ts";',
    );
    expect(code).toContain(`import * as rexShellComponents from ${JSON.stringify(shell)};`);
    expect(code).toContain("rexRegisterShellComponents(rexShellComponents);");
    expect(code).toContain(
      'import { registerI18n as rexRegisterI18n } from "/rex/client/index.ts";',
    );
    for (const [index, entry] of locales.entries()) {
      expect(code).toContain(`import rexLocale${index} from ${JSON.stringify(entry.file)};`);
    }
    expect(code).toContain(
      'rexRegisterI18n(registry, { config: config.i18n, messages: { "de": rexLocale0, "en": rexLocale1 } });',
    );
    expect(code).toContain(
      'export const config = Object.freeze({ fonts: Object.freeze([{"family":"Inter","src":"/fonts/inter.woff2"}]), i18n: {"locales":["en","de"],"default":"en","routing":"none"} });',
    );

    const plain = generateAppModule(scanApp(root, "app"), {
      name: "shell-fixture",
      core: "/rex/index.ts",
      client: "/rex/client/index.ts",
      config: { fonts: [], i18n: null },
      shellComponents: null,
      locales: [],
    });
    expect(plain).not.toContain("/rex/client/index.ts");
    expect(plain).not.toContain("rexRegister");
    expect(plain).toContain(
      "export const config = Object.freeze({ fonts: Object.freeze([]), i18n: null });",
    );

    const render = generateRenderModule({
      ssr: "/rex/server/ssr.ts",
      assets: { scripts: [], stylesheets: [], preloads: [], pages: {} },
    });
    expect(render).toContain('import app, { config } from "rex:app";');
    expect(render).toContain("fonts: config.fonts");
  });

  it(
    "makes a rex.config ui.components override, the fonts and the locales live in rex dev and in a built app",
    { timeout: TEST_TIMEOUT_MS },
    async () => {
      const root = writeFixture();
      const options = configPluginOptions((await loadRexConfig(root)).read);
      expect(options).toMatchObject({
        shellComponents: SHELL_MODULE,
        fonts: [{ family: "Inter", src: "/fonts/inter.woff2", weight: "100 900" }],
        i18n: { locales: ["en", "de"], default: "en", routing: "none" },
      });

      const vite = await startDev(root, { port: 0, host: "127.0.0.1", logLevel: "silent" });
      try {
        const base = (devUrls(vite)[0] as string).replace(/\/$/, "");
        expectRenderedApp(await fetchPage(base, "de"), await fetchPage(base, "en"));
      } finally {
        await vite.close();
      }

      const built = await buildApp(root, { logLevel: "silent" });
      expect(built.serverFile).toBe(join(root, DIST_DIR, SERVER_FILE));
      const client = clientAssets(join(root, DIST_DIR, CLIENT_DIR));
      expect(client).toContain("data-shell-sheet");
      expect(client).toContain("Notizen");

      const child = spawn(process.execPath, [built.serverFile as string], {
        cwd: root,
        env: { ...process.env, PORT: "0", HOST: "127.0.0.1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      children.push(child);
      const url = await waitForServing(child);
      expectRenderedApp(await fetchPage(url, "de"), await fetchPage(url, "en"));
      child.kill("SIGTERM");
    },
  );

  it("loads the package's vite entry from plain Node", { timeout: TEST_TIMEOUT_MS }, async () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      readonly exports: Readonly<Record<string, string>>;
    };
    const entry = join(packageRoot, manifest.exports["./vite"] as string);
    expect(existsSync(entry)).toBe(true);
    const run = await runNode(
      [
        "--input-type=module",
        "-e",
        [
          "const vite = await import(process.argv[1]);",
          'if (typeof vite.rex !== "function" || typeof vite.shellComponentsHook !== "function") process.exit(2);',
        ].join("\n"),
        pathToFileURL(entry).href,
      ],
      packageRoot,
    );
    expect(run.stderr).not.toContain("ERR_UNKNOWN_FILE_EXTENSION");
    expect(run.code).toBe(0);
  });
});
