import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, normalizePath, type ErrorPayload, type HotPayload, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildManifest } from "../manifest/build.ts";
import { checkAppModules, rex } from "../vite/index.ts";
import { action, validateShortcut } from "./action.ts";
import { deprecated, deprecationMessage, hasWarned, resetDeprecations } from "./deprecated.ts";
import { RexDeclarationError, entity } from "./entity.ts";
import {
  REX_ERROR_AREAS,
  REX_ERROR_CATALOG,
  REX_ERROR_CODE_PATTERN,
  RexDeclarationOptionError,
  RexError,
  errorDetail,
  errorDocs,
  formatRexError,
  isRexError,
  isRexErrorCode,
  locateRexError,
  stackFrames,
  type RexErrorArea,
  type RexErrorCode,
} from "./errors.ts";
import { pageId } from "./ids.ts";
import { memoryJournal } from "./journal.ts";
import { page, parseRoute } from "./page.ts";
import { always } from "./policy.ts";
import { createRegistry } from "./registry.ts";
import { enumOf, id, text } from "./schema.ts";
import { z } from "zod/mini";
import { bind } from "./store.ts";
import { memoryStore } from "./store.memory.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");
const docsScript = join(repoRoot, "tools", "docs-errors.mjs");

const codes = Object.keys(REX_ERROR_CATALOG) as RexErrorCode[];

describe("the error catalog", () => {
  it("holds every area from REX1xx to REX6xx under its prefix, each code with a title and hint", () => {
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      const entry = REX_ERROR_CATALOG[code];
      expect(code).toMatch(REX_ERROR_CODE_PATTERN);
      expect(entry.title.trim()).not.toBe("");
      expect(entry.hint.trim()).not.toBe("");
      expect(code.startsWith(REX_ERROR_AREAS[entry.area].prefix)).toBe(true);
    }
    const areas = new Set(codes.map((code) => REX_ERROR_CATALOG[code].area));
    expect([...areas].sort()).toEqual(
      (Object.keys(REX_ERROR_AREAS) as RexErrorArea[]).sort(),
    );
    for (const code of ["REX310", "REX320", "REX330", "REX440", "REX450", "REX500", "REX600", "REX610"]) {
      expect(isRexErrorCode(code)).toBe(true);
    }
    for (const code of ["REX100", "REX101", "REX102", "REX110", "REX200", "REX210"]) {
      expect(isRexErrorCode(code)).toBe(true);
    }
    expect(isRexErrorCode("REX999")).toBe(false);
    expect(isRexErrorCode("toString")).toBe(false);
  });
});

describe("RexError", () => {
  it("carries code, hint, docs and an optional location", () => {
    const error = new RexError("REX113", "rex.config.ts: render is wrong", {
      file: "rex.config.ts",
      line: 4,
      column: 12,
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("RexError");
    expect(error.code).toBe("REX113");
    expect(error.message).toBe("REX113 rex.config.ts: render is wrong");
    expect(error.hint).toBe(REX_ERROR_CATALOG.REX113.hint);
    expect(error.docs).toBe("https://rex.sidioralabs.com/errors/REX113");
    expect(error.docs).toBe(errorDocs("REX113"));
    expect([error.file, error.line, error.column]).toEqual(["rex.config.ts", 4, 12]);
    expect(formatRexError(error)).toBe(
      [
        "REX113 rex.config.ts: render is wrong (rex.config.ts:4:12)",
        `  hint: ${REX_ERROR_CATALOG.REX113.hint}`,
        "  docs: https://rex.sidioralabs.com/errors/REX113",
      ].join("\n"),
    );
  });

  it("defaults the location to null and accepts a custom hint and cause", () => {
    const cause = new Error("root");
    const error = new RexError("REX100", "missing", { hint: "create it", cause });
    expect([error.file, error.line, error.column]).toEqual([null, null, null]);
    expect(error.hint).toBe("create it");
    expect(error.cause).toBe(cause);
    expect(formatRexError(error).split("\n")[0]).toBe("REX100 missing");
  });

  it("refuses an uncatalogued code", () => {
    expect(() => new RexError("REX999" as RexErrorCode, "x")).toThrow(TypeError);
  });

  it("is recognised structurally across module instances", () => {
    expect(isRexError(new RexError("REX110", "x"))).toBe(true);
    expect(isRexError(new Error("REX110 x"))).toBe(false);
    expect(isRexError({ code: "REX110", message: "x" })).toBe(false);
  });

  it("names the declaration, id and field for declaration option errors", () => {
    const error = new RexDeclarationOptionError("REX200", {
      declaration: "page",
      id: "home",
      field: "render",
      problem: "must be one of ssr, csr, ssg, static",
    });
    expect(error).toBeInstanceOf(RexError);
    expect(error.message).toBe('REX200 page "home": field "render" must be one of ssr, csr, ssg, static');
    expect([error.declaration, error.id, error.field]).toEqual(["page", "home", "render"]);
  });
});

describe("deprecated", () => {
  it("warns once per code with the docs link", () => {
    resetDeprecations();
    const warnings: string[] = [];
    const warn = (message: string) => warnings.push(message);
    expect(deprecated("REX101", "use defineConfig", warn)).toBe(true);
    expect(deprecated("REX101", "use defineConfig", warn)).toBe(false);
    expect(hasWarned("REX101")).toBe(true);
    expect(warnings).toEqual([
      "rex: REX101 deprecated: use defineConfig (https://rex.sidioralabs.com/errors/REX101)",
    ]);
    expect(deprecationMessage("REX101", "use defineConfig")).toBe(warnings[0]);
    resetDeprecations();
    expect(hasWarned("REX101")).toBe(false);
  });
});

describe("RexError details and locations", () => {
  it("keeps the message without the code as detail", () => {
    const error = new RexError("REX220", "route must not end with /");
    expect(error.detail).toBe("route must not end with /");
    expect(errorDetail(error)).toBe("route must not end with /");
    expect(errorDetail(new Error("plain"))).toBe("plain");
    expect(errorDetail("text")).toBe("text");
  });

  it("parses V8 stack frames including file URLs", () => {
    const stack = [
      "RexError: REX213 page",
      "    at fail (/srv/rex/src/core/page.ts:310:11)",
      "    at file:///srv/site/app/pages/note/page.ts:3:16",
      "    at async Promise.all (index 0)",
    ].join("\n");
    expect(stackFrames(stack)).toEqual([
      { file: "/srv/rex/src/core/page.ts", line: 310, column: 11 },
      { file: "/srv/site/app/pages/note/page.ts", line: 3, column: 16 },
    ]);
    expect(stackFrames(undefined)).toEqual([]);
  });

  it("fills a missing location once and keeps a known one", () => {
    const error = new RexError("REX213", "x");
    locateRexError(error, { file: "/a/page.ts", line: 3, column: 16 });
    expect([error.file, error.line, error.column]).toEqual(["/a/page.ts", 3, 16]);
    locateRexError(error, { file: "/b/page.ts", line: 9, column: 1 });
    expect(error.file).toBe("/a/page.ts");
    expect(formatRexError(error).split("\n")[0]).toBe("REX213 x (/a/page.ts:3:16)");
  });
});

function caught(run: () => unknown): RexError {
  try {
    run();
  } catch (error) {
    expect(isRexError(error)).toBe(true);
    return error as RexError;
  }
  throw new Error("expected a RexError");
}

async function rejected(run: () => Promise<unknown>): Promise<RexError> {
  try {
    await run();
  } catch (error) {
    expect(isRexError(error)).toBe(true);
    return error as RexError;
  }
  throw new Error("expected a RexError");
}

const noop = () =>
  action("noop", {
    label: "Noop",
    input: z.object({}),
    output: z.object({}),
    policy: always(),
    effect: "read",
    handler: () => ({}),
  });

describe("catalogued codes in core and manifest", () => {
  it("raises declaration errors under the code of their declaration kind", () => {
    const route = caught(() => page("note", { route: "notes" } as never));
    expect(route).toBeInstanceOf(RexDeclarationError);
    expect(route.code).toBe("REX213");
    expect(route.message).toBe(
      'REX213 page "note": field "route" route must be a string starting with /',
    );
    const named = caught(() => entity("Account", { fields: { id: id() } } as never));
    expect(named.code).toBe("REX211");
    expect(named.message).toContain('field "id" invalid entity id "Account"');
    expect(named.message).not.toContain("REX218");
    const shortcut = caught(() =>
      action("save", {
        label: "Save",
        input: z.object({}),
        output: z.object({}),
        policy: always(),
        effect: "read",
        shortcut: "k+mod",
        handler: () => ({}),
      }),
    );
    expect([shortcut.code, (shortcut as RexDeclarationError).field]).toEqual(["REX212", "shortcut"]);
    expect(shortcut.message).not.toContain("REX219");
  });

  it("raises name, route, shortcut and enum errors with their own codes", () => {
    expect(caught(() => pageId("Bad")).code).toBe("REX218");
    expect(caught(() => parseRoute("/a/")).code).toBe("REX220");
    expect(caught(() => validateShortcut("mod+k")).code).toBe("REX219");
    expect(caught(() => enumOf(["a", "a"])).code).toBe("REX221");
  });

  it("raises registry errors for duplicates, incomplete entries and unknown lookups", () => {
    const duplicate = caught(() => createRegistry().register(noop(), noop()));
    expect(duplicate).toBeInstanceOf(RexDeclarationError);
    expect(duplicate.code).toBe("REX217");
    expect(caught(() => createRegistry().register({ kind: "action" } as never)).code).toBe("REX224");
    expect(caught(() => createRegistry().freeze().get("action", "send")).code).toBe("REX301");
  });

  it("raises journal and store errors as runtime codes", async () => {
    const journal = memoryJournal();
    expect((await rejected(() => journal.open("", "i-1", null))).code).toBe("REX302");
    expect(
      (await rejected(() => journal.record("missing", { type: "completed", at: "x" }))).code,
    ).toBe("REX303");
    await journal.open("payout", "i-1", null);
    expect((await rejected(() => journal.open("other", "i-1", null))).code).toBe("REX304");
    const note = entity("note", { fields: { id: id(), title: text() }, label: (r) => r.title });
    const store = bind(note, memoryStore(note));
    expect((await rejected(() => store.list({ filter: { nope: 1 } as never }))).code).toBe("REX305");
  });

  it("raises manifest build errors with catalogued codes", () => {
    const home = page("home", { route: "/", actions: [noop()] });
    const snapshot = createRegistry().register(home).freeze();
    expect(caught(() => buildManifest(snapshot)).code).toBe("REX222");
    const orphan = page("orphan", { route: "/orphan", chrome: { back: "home" } });
    expect(caught(() => buildManifest(createRegistry().register(orphan).freeze())).code).toBe(
      "REX223",
    );
    expect(caught(() => buildManifest(createRegistry().freeze(), { app: " " })).code).toBe("REX501");
  });

  it("leaves no bare Error throw in the core and manifest sources", () => {
    for (const dir of ["core", "manifest"]) {
      const root = join(here, "..", dir);
      for (const name of readdirSync(root)) {
        if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
        expect(readFileSync(join(root, name), "utf8"), `${dir}/${name}`).not.toMatch(
          /throw new Error\(/,
        );
      }
    }
  });
});

describe("docs/errors.md", () => {
  it("is generated from the catalog and the check fails when it is stale", () => {
    const current = spawnSync(process.execPath, [docsScript, "--check"], { encoding: "utf8" });
    expect(current.stderr).toBe("");
    expect(current.status).toBe(0);
    const doc = readFileSync(join(repoRoot, "docs", "errors.md"), "utf8");
    for (const code of codes) {
      expect(doc).toContain(`| [${code}](${errorDocs(code)}) | ${REX_ERROR_CATALOG[code].title} |`);
    }
    const dir = mkdtempSync(join(tmpdir(), "rex-errors-doc-"));
    try {
      const stale = join(dir, "errors.md");
      writeFileSync(stale, doc.replace("REX330", "REX331"));
      const check = spawnSync(process.execPath, [docsScript, "--check", "--out", stale], {
        encoding: "utf8",
      });
      expect(check.status).toBe(1);
      expect(check.stderr).toContain("stale");
      const written = spawnSync(process.execPath, [docsScript, "--out", stale], { encoding: "utf8" });
      expect(written.status).toBe(0);
      expect(readFileSync(stale, "utf8")).toBe(doc);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the Vite error overlay", () => {
  const fixtureRoot = join(here, "..", "vite", "fixtures", "app");
  const packageModules = join(here, "..", "..", "node_modules");
  const alias = [{ find: /^@sidioralabs\/rex$/, replacement: join(here, "..", "index.ts") }];
  const messages: HotPayload[] = [];
  let root: string;
  let vite: ViteDevServer;
  let socket: WebSocket | undefined;

  beforeAll(async () => {
    root = normalizePath(realpathSync(mkdtempSync(join(tmpdir(), "rex-overlay-"))));
    cpSync(fixtureRoot, root, { recursive: true });
    symlinkSync(packageModules, join(root, "node_modules"), "dir");
    const notePage = join(root, "app", "pages", "note", "page.ts");
    writeFileSync(
      notePage,
      readFileSync(notePage, "utf8").replace('route: "/notes/:noteId"', 'route: "notes/:noteId"'),
    );
    vite = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      appType: "custom",
      resolve: { alias },
      optimizeDeps: { noDiscovery: true },
      server: { host: "127.0.0.1", port: 0 },
      plugins: [rex({ name: "fixture" })],
    });
    await vite.listen();
    const address = vite.httpServer?.address() as AddressInfo;
    const token = encodeURIComponent(vite.config.webSocketToken);
    socket = new WebSocket(`ws://127.0.0.1:${address.port}/?token=${token}`, "vite-hmr");
    socket.addEventListener("message", (event) => {
      messages.push(JSON.parse(String(event.data)) as HotPayload);
    });
  }, 60_000);

  afterAll(async () => {
    socket?.close();
    await vite?.close();
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  });

  it("shows a declaration error from an app module with the declaring file, line and frame", async () => {
    const deadline = Date.now() + 30_000;
    let payload: ErrorPayload | undefined;
    while (payload === undefined && Date.now() < deadline) {
      payload = messages.find((message): message is ErrorPayload => message.type === "error");
      if (payload === undefined) await new Promise((done) => setTimeout(done, 25));
    }
    if (payload === undefined) {
      throw new Error(`no error overlay payload; received ${JSON.stringify(messages)}`);
    }
    const file = `${root}/app/pages/note/page.ts`;
    expect(payload.err.message).toBe(
      'REX213 page "note": field "route" route must be a string starting with /',
    );
    expect(payload.err.plugin).toBe("rex");
    expect(payload.err.id).toBe(file);
    expect(payload.err.loc?.file).toBe(file);
    expect(payload.err.loc?.line).toBe(3);
    expect(payload.err.loc?.column).toBeGreaterThan(0);
    expect(payload.err.frame).toContain('> 3 | export default page("note", {');
    expect(payload.err.frame).toContain("^");

    const located = await checkAppModules(vite, join(root, "app"));
    expect(located?.code).toBe("REX213");
    expect([located?.file, located?.line]).toEqual([file, 3]);
  }, 60_000);
});
