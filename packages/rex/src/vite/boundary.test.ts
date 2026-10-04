import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, normalizePath } from "vite";
import { describe, expect, it } from "vitest";
import { REX_ERRORS_DOCS_BASE } from "../core/errors.ts";
import { REX_SERVER_ONLY } from "../server-only.ts";
import {
  BOUNDARY_IMPORT_CODE,
  SECRET_LEAK_CODE,
  SERVER_ONLY_HANDLER_MESSAGE,
  boundaryError,
  boundaryViolation,
  collectEnvReferences,
  findSecretNames,
  isActionModule,
  serverOnlyModulePaths,
  stripActionHandlers,
} from "./boundary.ts";
import { REX_HOOKS } from "./hooks.ts";
import { rex } from "./plugin.ts";
import { runtimePaths } from "./resolve.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "fixtures", "boundary");
const coreEntry = join(here, "..", "index.ts");
const serverOnlyEntry = join(here, "..", "server-only.ts");
const alias = [
  { find: /^@sidioralabs\/rex$/, replacement: coreEntry },
  { find: /^@sidioralabs\/rex\/server-only$/, replacement: serverOnlyEntry },
];
const BUILD_TIMEOUT_MS = 120_000;
const external = [/^react(\/.*)?$/, /^react-dom(\/.*)?$/];

interface FixtureBuild {
  readonly secretNames?: readonly string[];
  readonly serverOnlyAlias?: boolean;
}

function root(name: string): string {
  return join(fixtures, name);
}

async function buildClient(name: string, options: FixtureBuild = {}) {
  const result = await build({
    root: root(name),
    configFile: false,
    logLevel: "silent",
    resolve: { alias: options.serverOnlyAlias === false ? alias.slice(0, 1) : alias },
    plugins: rex({
      name: "boundary-fixture",
      compiler: false,
      ...(options.secretNames === undefined ? {} : { secretNames: options.secretNames }),
    }),
    build: { write: false, minify: false, rolldownOptions: { external } },
  });
  const outputs = Array.isArray(result) ? result : [result];
  return outputs
    .flatMap((output) => ("output" in output ? output.output : []))
    .filter((item) => item.type === "chunk");
}

async function buildFailure(name: string, options: FixtureBuild = {}): Promise<Error> {
  try {
    await buildClient(name, options);
  } catch (error) {
    return error as Error;
  }
  throw new Error(`the ${name} fixture built without a boundary error`);
}

function pluginCodes(error: Error): unknown[] {
  const failure = error as { pluginCode?: unknown; errors?: readonly { pluginCode?: unknown }[] };
  return [failure.pluginCode, ...(failure.errors ?? []).map((item) => item.pluginCode)];
}

const fixtureFile = (name: string, path: string) => normalizePath(join(root(name), path));

describe("vite/boundary in client builds", { timeout: BUILD_TIMEOUT_MS }, () => {
  it("strips action handlers and the server code only they used from the client bundle", async () => {
    const chunks = await buildClient("clean");
    const code = chunks.map((chunk) => chunk.code).join("\n");
    const modules = chunks.flatMap((chunk) => chunk.moduleIds.map(normalizePath));
    expect(modules).toContain(fixtureFile("clean", "app/actions/save-note.ts"));
    expect(modules).toContain(fixtureFile("clean", "app/actions/archive-note.ts"));
    expect(modules).not.toContain(fixtureFile("clean", "app/server/db.ts"));
    expect(modules).not.toContain(normalizePath(serverOnlyEntry));
    expect(code).toContain('"save-note"');
    expect(code).toContain('"archive-note"');
    expect(code).toContain(SERVER_ONLY_HANDLER_MESSAGE);
    for (const leaked of [
      "server-db-connection",
      "archived-by-",
      "audited:",
      "insertNote",
      "archiveNote",
      "auditTitle",
      "DATABASE_URL",
      "AUDIT_TOKEN",
    ]) {
      expect(code).not.toContain(leaked);
    }
  });

  it("keeps the handlers and their server modules in the server build", async () => {
    const serverCode = async (file: string) => {
      const result = await build({
        root: root("clean"),
        configFile: false,
        logLevel: "silent",
        resolve: { alias },
        plugins: rex({ name: "boundary-fixture", compiler: false }),
        build: {
          ssr: true,
          write: false,
          minify: false,
          rolldownOptions: { input: join(root("clean"), file) },
        },
      });
      const outputs = Array.isArray(result) ? result : [result];
      return outputs
        .flatMap((output) => ("output" in output ? output.output : []))
        .map((item) => (item.type === "chunk" ? item.code : ""))
        .join("\n");
    };
    const save = await serverCode("app/actions/save-note.ts");
    expect(save).toContain("process.env.DATABASE_URL");
    expect(save).toContain("insertNote(auditTitle(input.title))");
    expect(save).toContain("audited:");
    expect(save).not.toContain(SERVER_ONLY_HANDLER_MESSAGE);
    const archive = await serverCode("app/actions/archive-note.ts");
    expect(archive).toContain("archived-by-");
    expect(archive).not.toContain(SERVER_ONLY_HANDLER_MESSAGE);
  });

  it("fails with REX440 when a client module imports app/server", async () => {
    const error = await buildFailure("app-server");
    expect(error.message).toContain(BOUNDARY_IMPORT_CODE);
    expect(error.message).toContain("app/pages/home/view.tsx imports app/server/secrets.ts");
    expect(error.message).toContain(`${REX_ERRORS_DOCS_BASE}/${BOUNDARY_IMPORT_CODE}`);
    expect(pluginCodes(error)).toContain(BOUNDARY_IMPORT_CODE);
  });

  it("fails with REX440 when a client module imports rex/server", async () => {
    const error = await buildFailure("rex-server");
    expect(error.message).toContain(BOUNDARY_IMPORT_CODE);
    expect(error.message).toContain(
      'app/pages/home/view.tsx imports "@sidioralabs/rex/server" into the client bundle',
    );
  });

  it("fails with REX440 when a client module pulls in a module marked rex/server-only", async () => {
    for (const serverOnlyAlias of [true, false]) {
      const error = await buildFailure("server-only", { serverOnlyAlias });
      expect(error.message).toContain(BOUNDARY_IMPORT_CODE);
      expect(error.message).toContain("app/lib/billing.ts");
      expect(error.message).toContain("is server-only, but it is part of the client bundle");
    }
  });

  it("fails with REX441 when the client output references process.env without the VITE_ prefix", async () => {
    const error = await buildFailure("env-leak");
    expect(error.message).toContain(SECRET_LEAK_CODE);
    expect(error.message).toContain("app/pages/home/view.tsx references process.env.DATABASE_URL");
    expect(error.message).toContain(`${REX_ERRORS_DOCS_BASE}/${SECRET_LEAK_CODE}`);
    expect(pluginCodes(error)).toContain(SECRET_LEAK_CODE);
  });

  it("fails with REX441 when the client output contains a configured secret name", async () => {
    const chunks = await buildClient("secret-name");
    expect(chunks.map((chunk) => chunk.code).join("\n")).toContain("STRIPE_SECRET_KEY");
    const error = await buildFailure("secret-name", { secretNames: ["STRIPE_SECRET_KEY"] });
    expect(error.message).toContain(SECRET_LEAK_CODE);
    expect(error.message).toMatch(/\S+\.js contains the secret name STRIPE_SECRET_KEY/);
  });
});

describe("vite/boundary helpers", () => {
  it("is registered in the hook list and assembled into rex()", () => {
    expect(REX_HOOKS.map((hook) => hook.name)).toContain("boundaryHook");
    expect(rex({ compiler: false }).map((plugin) => plugin.name)).toContain("rex:boundary");
    expect(REX_SERVER_ONLY).toBe("rex/server-only");
  });

  it("replaces handlers in action declarations and prunes what only they referenced", () => {
    const source = [
      'import { action, z } from "@sidioralabs/rex";',
      'import * as rex from "@sidioralabs/rex";',
      'import { query, pool, type Row } from "../server/db.ts";',
      'import { unused } from "./unused.ts";',
      'import "./side-effect.ts";',
      "function load(id: string): Row { return query(id); }",
      "const run = (id: string) => load(id);",
      "export const one = action(\"one\", { input: z.object({}), handler: (input) => run(input.id) });",
      "export const two = rex.action(\"two\", { input: z.object({}), async handler(input) { return pool.get(input); } });",
      "export const three = action(\"three\", { input: z.object({}), 'handler': () => 3 });",
    ].join("\n");
    const output = stripActionHandlers(source, "/app/actions/one.ts");
    expect(output).not.toBeNull();
    const code = output as string;
    const stub = `throw new Error(${JSON.stringify(SERVER_ONLY_HANDLER_MESSAGE)})`;
    expect(code.split(stub)).toHaveLength(4);
    expect(code).not.toContain("../server/db.ts");
    expect(code).not.toContain("function load");
    expect(code).not.toContain("const run");
    expect(code).not.toContain("pool.get");
    expect(code).toContain('import { unused } from "./unused.ts";');
    expect(code).toContain('import "./side-effect.ts";');
    expect(code).toContain('import * as rex from "@sidioralabs/rex";');
    expect(code).toContain('export const one = action("one"');
  });

  it("keeps imports still used outside the handler and leaves modules without actions alone", () => {
    const source = [
      'import { action, z } from "@sidioralabs/rex";',
      'import { query, LABEL } from "../lib/shared.ts";',
      "export const one = action(\"one\", { input: z.object({}), label: LABEL, handler: () => query() });",
    ].join("\n");
    const code = stripActionHandlers(source, "/app/actions/one.ts") as string;
    expect(code).toContain('import { LABEL } from "../lib/shared.ts";');
    expect(stripActionHandlers("export const handler = () => 1;", "/app/actions/x.ts")).toBeNull();
    expect(
      stripActionHandlers('import { action } from "other";\naction("x", { handler: () => 1 });', "/a.ts"),
    ).toBeNull();
  });

  it("recognises action modules by the app/actions folder", () => {
    expect(isActionModule("/srv/app/app/actions/save-note.ts", "/srv/app/app")).toBe(true);
    expect(isActionModule("/srv/app/app/actions/save-note.ts?v=1", "/srv/app/app")).toBe(true);
    expect(isActionModule("/srv/app/app/pages/home/page.ts", "/srv/app/app")).toBe(false);
    expect(isActionModule("\0rex:app", "/srv/app/app")).toBe(false);
  });

  it("classifies server-only imports", () => {
    const appPath = "/srv/app/app";
    const importer = "/srv/app/app/pages/home/view.tsx";
    const serverOnly = serverOnlyModulePaths(runtimePaths().core);
    expect(serverOnly).toContain(normalizePath(serverOnlyEntry));
    expect(boundaryViolation("@sidioralabs/rex/server", importer, appPath)).toBe("rex/server");
    expect(boundaryViolation("@sidioralabs/rex/server/node", importer, appPath)).toBe("rex/server");
    expect(boundaryViolation("@sidioralabs/rex/server-only", importer, appPath)).toBe("server-only");
    expect(boundaryViolation(normalizePath(serverOnlyEntry), importer, appPath, serverOnly)).toBe(
      "server-only",
    );
    expect(boundaryViolation("../../server/db.ts", importer, appPath)).toBe("app/server");
    expect(boundaryViolation("/srv/app/app/server/db.ts", importer, appPath)).toBe("app/server");
    expect(boundaryViolation("@sidioralabs/rex", importer, appPath)).toBeNull();
    expect(boundaryViolation("@sidioralabs/rex/client", importer, appPath)).toBeNull();
    expect(boundaryViolation("../../lib/server.ts", importer, appPath)).toBeNull();
    expect(boundaryViolation("./server/x.ts", "\0rex:app", appPath)).toBeNull();
  });

  it("collects process.env references that are not public", () => {
    const code = [
      "const a = process.env.DATABASE_URL;",
      "const b = process.env.VITE_PUBLIC;",
      "const c = process.env.NODE_ENV;",
      'const d = process.env["API_TOKEN"];',
      "const e = globalThis.process.env.SESSION_SECRET;",
      "const f = process.env;",
      'const g = "process.env.IN_STRING";',
    ].join("\n");
    expect(collectEnvReferences(code, "/app/x.ts")).toEqual([
      "process.env",
      "process.env.API_TOKEN",
      "process.env.DATABASE_URL",
      "process.env.SESSION_SECRET",
    ]);
    expect(collectEnvReferences("const x = 1;", "/app/x.ts")).toEqual([]);
  });

  it("finds configured secret names as whole words", () => {
    const text = 'const key = env.STRIPE_SECRET_KEY; const other = "STRIPE_SECRET_KEY_ID";';
    expect(findSecretNames(text, ["STRIPE_SECRET_KEY", "GITHUB_TOKEN"])).toEqual([
      "STRIPE_SECRET_KEY",
    ]);
    expect(findSecretNames("STRIPE_SECRET_KEY_ID", ["STRIPE_SECRET_KEY"])).toEqual([]);
  });

  it("formats boundary errors with the code, hint and docs link", () => {
    const log = boundaryError(SECRET_LEAK_CODE, "leak", "/app/x.ts");
    expect(log.code).toBe(SECRET_LEAK_CODE);
    expect(log.id).toBe("/app/x.ts");
    expect(log.url).toBe(`${REX_ERRORS_DOCS_BASE}/REX441`);
    expect(log.message.split("\n")).toEqual([
      "REX441 leak",
      expect.stringMatching(/^ {2}hint: .*VITE_ prefix/),
      `  docs: ${REX_ERRORS_DOCS_BASE}/REX441`,
    ]);
  });
});
