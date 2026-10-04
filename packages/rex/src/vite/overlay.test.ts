import {
  cpSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createServer,
  normalizePath,
  type ErrorPayload,
  type HotPayload,
  type ViteDevServer,
} from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RexError, isRexError } from "../core/errors.ts";
import type { RexAppBundle } from "./app-module.ts";
import { REX_HOOKS } from "./hooks.ts";
import {
  OVERLAY_PLUGIN,
  appStackFrame,
  attachOverlayFields,
  checkAppModules,
  locateAppError,
  overlayError,
  overlayHook,
  reportAppError,
} from "./overlay.ts";
import { createHookContext, rex } from "./plugin.ts";
import { APP_MODULE_ID } from "./virtual.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "fixtures", "app");
const packageModules = join(here, "..", "..", "node_modules");
const alias = [
  { find: /^@sidioralabs\/rex$/, replacement: join(here, "..", "index.ts") },
  { find: /^@sidioralabs\/rex\/schema$/, replacement: join(here, "..", "schema", "index.ts") },
];
const APP = "/srv/site/app";
const HOME_PAGE = normalizePath(join(fixtureRoot, "app", "pages", "home", "page.ts"));
const SERVER_TIMEOUT_MS = 90_000;
const STACK = [
  'Error: REX213 page "home": field "route" must be a string starting with /',
  "    at page (/srv/site/node_modules/@sidioralabs/rex/src/core/page.ts:10:5)",
  "    at file:///srv/site/app/pages/home/page.ts?t=123:5:16",
  "    at /srv/site/app/actions/add-note.ts:7:23",
].join("\n");

function rexError(options: { file?: string; line?: number; column?: number } = {}): RexError {
  return new RexError(
    "REX213",
    'page "home": field "route" must be a string starting with /',
    options,
  );
}

describe("appStackFrame", () => {
  it("returns the first frame inside the app folder without its query", () => {
    expect(appStackFrame(STACK, APP)).toEqual({
      file: "/srv/site/app/pages/home/page.ts",
      line: 5,
      column: 16,
    });
    expect(
      appStackFrame(
        STACK.split("\n")
          .filter((line) => !line.includes("pages"))
          .join("\n"),
        APP,
      ),
    ).toEqual({
      file: "/srv/site/app/actions/add-note.ts",
      line: 7,
      column: 23,
    });
  });

  it("finds nothing without an app frame", () => {
    expect(appStackFrame(undefined, APP)).toBeNull();
    expect(appStackFrame("Error: boom", APP)).toBeNull();
    expect(appStackFrame(STACK, "/srv/other/app")).toBeNull();
    expect(appStackFrame(STACK, "/srv/site/application")).toBeNull();
    expect(appStackFrame(STACK.split("\n")[1] ?? "", APP)).toBeNull();
  });
});

describe("locateAppError", () => {
  it("passes anything that is not a Rex error through untouched", () => {
    const plain = new Error("boom");
    expect(locateAppError(plain, APP)).toBe(plain);
    expect(locateAppError("text", APP)).toBe("text");
    expect(locateAppError(null, APP)).toBeNull();
  });

  it("locates an unlocated Rex error from its app stack frame", () => {
    const error = rexError();
    error.stack = STACK;
    expect(locateAppError(error, APP)).toBe(error);
    expect([error.file, error.line, error.column]).toEqual([
      "/srv/site/app/pages/home/page.ts",
      5,
      16,
    ]);
  });

  it("keeps an explicit location and leaves an error without app frames unlocated", () => {
    const located = rexError({ file: "/srv/site/app/entities/note.ts", line: 3, column: 2 });
    located.stack = STACK;
    locateAppError(located, APP);
    expect([located.file, located.line, located.column]).toEqual([
      "/srv/site/app/entities/note.ts",
      3,
      2,
    ]);
    const elsewhere = rexError();
    elsewhere.stack = "Error: boom\n    at /srv/site/node_modules/x/index.js:1:1";
    locateAppError(elsewhere, APP);
    expect(elsewhere.file).toBeNull();
  });

  it("fixes the stack trace before reading the frames", () => {
    const error = rexError();
    error.stack = STACK.replaceAll("/srv/site/", "/compiled/");
    expect(locateAppError(error, APP).file).toBeNull();
    const fixed = locateAppError(error, APP, (target) => {
      target.stack = (target.stack ?? "").replaceAll("/compiled/", "/srv/site/");
    });
    expect(fixed.file).toBe("/srv/site/app/pages/home/page.ts");
    expect(fixed.line).toBe(5);
  });
});

describe("overlayError", () => {
  it("describes a located error with its file, position and source frame for the overlay", () => {
    const error = rexError({ file: HOME_PAGE, line: 4, column: 16 });
    const payload = overlayError(error);
    expect(payload.message).toBe(error.message);
    expect(payload.stack).toBe(error.stack);
    expect(payload.plugin).toBe(OVERLAY_PLUGIN);
    expect(payload.id).toBe(HOME_PAGE);
    expect(payload.loc).toEqual({ file: HOME_PAGE, line: 4, column: 16 });
    expect(payload.frame).toContain('> 4 | export default page("home", {');
    expect(payload.frame).toContain("^");
    expect(payload.frame).toContain("2 | import { addNote }");
    expect(Object.keys(payload).sort()).toEqual([
      "frame",
      "id",
      "loc",
      "message",
      "plugin",
      "stack",
    ]);
  });

  it("defaults the column, drops the frame of a missing file and omits what is unknown", () => {
    const noColumn = overlayError(rexError({ file: HOME_PAGE, line: 4 }));
    expect(noColumn.loc).toEqual({ file: HOME_PAGE, line: 4, column: 1 });
    const missing = overlayError(rexError({ file: "/srv/nowhere/page.ts", line: 2, column: 3 }));
    expect(missing.id).toBe("/srv/nowhere/page.ts");
    expect(missing.loc).toEqual({ file: "/srv/nowhere/page.ts", line: 2, column: 3 });
    expect(missing.frame).toBeUndefined();
    const fileOnly = overlayError(rexError({ file: HOME_PAGE }));
    expect(fileOnly.id).toBe(HOME_PAGE);
    expect(fileOnly.loc).toBeUndefined();
    expect(fileOnly.frame).toBeUndefined();
    const unlocated = overlayError(rexError());
    expect(Object.keys(unlocated).sort()).toEqual(["message", "plugin", "stack"]);
  });
});

describe("attachOverlayFields", () => {
  it("adds the overlay fields to the error as hidden properties", () => {
    const error = rexError({ file: HOME_PAGE, line: 4, column: 16 });
    expect(attachOverlayFields(error)).toBe(error);
    const fields = error as RexError & {
      id?: string;
      frame?: string;
      loc?: { file: string; line: number; column: number };
      plugin?: string;
    };
    expect(fields.plugin).toBe(OVERLAY_PLUGIN);
    expect(fields.id).toBe(HOME_PAGE);
    expect(fields.loc).toEqual({ file: HOME_PAGE, line: 4, column: 16 });
    expect(fields.frame).toContain('> 4 | export default page("home", {');
    for (const key of ["id", "frame", "loc", "plugin"]) {
      expect(Object.getOwnPropertyDescriptor(error, key)?.enumerable, key).toBe(false);
    }
    expect(Object.keys(error)).not.toContain("plugin");
    expect(isRexError(error)).toBe(true);
    expect(error.code).toBe("REX213");
  });

  it("attaches only the plugin to an unlocated error", () => {
    const error = attachOverlayFields(rexError()) as RexError & { id?: string; loc?: unknown };
    expect(Object.getOwnPropertyDescriptor(error, "plugin")?.value).toBe(OVERLAY_PLUGIN);
    expect(Object.hasOwn(error, "id")).toBe(false);
    expect(Object.hasOwn(error, "loc")).toBe(false);
    expect(Object.hasOwn(error, "frame")).toBe(false);
  });
});

describe("overlayHook", () => {
  it("is a serve-only plugin in the ordered hook list", () => {
    const plugin = overlayHook(createHookContext());
    expect(plugin.name).toBe("rex:overlay");
    expect(plugin.apply).toBe("serve");
    expect(REX_HOOKS).toContain(overlayHook);
    expect(OVERLAY_PLUGIN).toBe("rex");
  });
});

describe("on the dev server", { timeout: SERVER_TIMEOUT_MS }, () => {
  let root: string;
  let appPath: string;
  let actionFile: string;
  let original: string;
  let vite: ViteDevServer;
  let socket: WebSocket | undefined;
  const messages: HotPayload[] = [];

  const errors = () =>
    messages.filter((payload): payload is ErrorPayload => payload.type === "error");
  const waitFor = async <T>(read: () => T | undefined): Promise<T> => {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const found = read();
      if (found !== undefined) return found;
      await new Promise((done) => setTimeout(done, 25));
    }
    throw new Error(`nothing arrived; received ${JSON.stringify(messages)}`);
  };

  beforeAll(async () => {
    root = normalizePath(realpathSync(mkdtempSync(join(tmpdir(), "rex-overlay-check-"))));
    appPath = join(root, "app");
    cpSync(fixtureRoot, root, { recursive: true });
    symlinkSync(packageModules, join(root, "node_modules"), "dir");
    actionFile = join(appPath, "actions", "add-note.ts");
    original = readFileSync(actionFile, "utf8");
    expect(original).toContain('action("add-note", {');
    writeFileSync(actionFile, original.replace('action("add-note", {', 'action("Add Note", {'));
    vite = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      appType: "custom",
      resolve: { alias },
      optimizeDeps: { noDiscovery: true },
      server: { host: "127.0.0.1", port: 0, watch: null },
      plugins: rex({ name: "fixture" }),
    });
    await vite.listen();
    const address = vite.httpServer?.address() as AddressInfo;
    const token = encodeURIComponent(vite.config.webSocketToken);
    socket = new WebSocket(`ws://127.0.0.1:${address.port}/?token=${token}`, "vite-hmr");
    socket.addEventListener("message", (event) => {
      messages.push(JSON.parse(String(event.data)) as HotPayload);
    });
    await waitFor(() => messages.find((payload) => payload.type === "connected"));
  });

  afterAll(async () => {
    socket?.close();
    await vite?.close();
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  });

  it("locates a declaration error in the app module that raised it and shows it in the overlay", async () => {
    const file = `${root}/app/actions/add-note.ts`;
    const before = errors().length;
    const located = await checkAppModules(vite, appPath);
    expect(located).not.toBeNull();
    expect(isRexError(located)).toBe(true);
    expect(located?.code).toBe("REX212");
    expect(located?.message).toContain('action "Add Note"');
    expect(located?.file).toBe(file);
    expect(located?.line).toBe(7);
    expect(located?.column).toBeGreaterThan(0);
    const plugin = Object.getOwnPropertyDescriptor(located, "plugin");
    expect(plugin?.value).toBe(OVERLAY_PLUGIN);
    expect(plugin?.enumerable).toBe(false);

    const payload = await waitFor(() => (errors().length > before ? errors().at(-1) : undefined));
    expect(payload.err.plugin).toBe(OVERLAY_PLUGIN);
    expect(payload.err.message).toBe(located?.message);
    expect(payload.err.id).toBe(file);
    expect(payload.err.loc).toEqual({ file, line: 7, column: located?.column });
    expect(payload.err.frame).toContain('> 7 | export const addNote = action("Add Note", {');
    expect(payload.err.frame).toContain("^");
  });

  it("reports only Rex errors", () => {
    expect(reportAppError(vite, new Error("plain"), appPath)).toBe(false);
    expect(reportAppError(vite, "text", appPath)).toBe(false);
    expect(reportAppError(vite, undefined, appPath)).toBe(false);
  });

  it("reports a Rex error raised outside the module graph to the overlay", async () => {
    const before = errors().length;
    const error = new RexError("REX460", "no app directory at /srv/nowhere/app");
    expect(reportAppError(vite, error, appPath)).toBe(true);
    expect(Object.getOwnPropertyDescriptor(error, "plugin")?.value).toBe(OVERLAY_PLUGIN);
    const payload = await waitFor(() => errors()[before]);
    expect(payload.err).toEqual({
      message: error.message,
      stack: error.stack,
      plugin: OVERLAY_PLUGIN,
    });
  });

  it("finds nothing to report once the app is fixed", async () => {
    writeFileSync(actionFile, original);
    for (const environment of Object.values(vite.environments)) {
      environment.moduleGraph.invalidateAll();
    }
    expect(await checkAppModules(vite, appPath)).toBeNull();
    const bundle = (await vite.ssrLoadModule(APP_MODULE_ID)) as RexAppBundle;
    expect(bundle.actions.map((entry) => entry.id)).toEqual(["add-note"]);
  });
});
