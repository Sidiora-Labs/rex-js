import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path, { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePath } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { loadAppBundle, withModuleLoader } from "../cli/load.ts";
import { isRexError } from "../core/errors.ts";
import { renderAgentsMd } from "../manifest/agents-md.ts";
import { generateAppModule } from "./app-module.ts";
import { DECLARATION_FOLDERS, PAGE_FILES, RexAppScanError, scanApp } from "./scan.ts";
import { DEFAULT_APP_DIR } from "./virtual.ts";

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function app(files: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), "rex-scan-"));
  roots.push(root);
  for (const file of files) {
    const target = join(root, file);
    if (file.endsWith("/")) {
      mkdirSync(target, { recursive: true });
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, "");
  }
  return root;
}

function at(root: string, path: string): string {
  return normalizePath(join(root, path));
}

function caught(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw");
}

const HOME = ["app/pages/home/page.ts", "app/pages/home/view.tsx", "app/pages/home/states.tsx"];

describe("vite/scan", () => {
  it("fixes the declaration folders and the page files of the convention", () => {
    expect(DECLARATION_FOLDERS).toEqual({
      entity: "entities",
      action: "actions",
      policy: "policies",
      flow: "flows",
    });
    expect(PAGE_FILES).toEqual(["page.ts", "view.tsx", "states.tsx"]);
    expect(DEFAULT_APP_DIR).toBe("app");
  });

  it("refuses a root without the app directory with REX460", () => {
    const root = app([]);
    const error = caught(() => scanApp(root));
    expect(error).toBeInstanceOf(RexAppScanError);
    expect(isRexError(error)).toBe(true);
    const scanError = error as RexAppScanError;
    expect(scanError.code).toBe("REX460");
    expect(scanError.name).toBe("RexAppScanError");
    expect(scanError.message).toBe(`REX460 no app directory at ${at(root, "app")}`);

    const file = app(["app"]);
    expect((caught(() => scanApp(file)) as RexAppScanError).code).toBe("REX460");

    const custom = app(HOME);
    expect((caught(() => scanApp(custom, "site")) as RexAppScanError).message).toBe(
      `REX460 no app directory at ${at(custom, "site")}`,
    );
  });

  it("lists declaration modules alphabetically, skipping tests, type declarations and other files", () => {
    const root = app([
      "app/entities/note.ts",
      "app/entities/alpha.ts",
      "app/entities/note.test.ts",
      "app/entities/types.d.ts",
      "app/entities/README.md",
      "app/entities/view.tsx",
      "app/entities/nested/deep.ts",
      "app/actions/add.ts",
      "app/policies/notes.ts",
      "app/flows/onboard.ts",
    ]);
    const scan = scanApp(root);
    expect(scan).toEqual({
      root: normalizePath(root),
      appDir: at(root, "app"),
      entities: [at(root, "app/entities/alpha.ts"), at(root, "app/entities/note.ts")],
      actions: [at(root, "app/actions/add.ts")],
      policies: [at(root, "app/policies/notes.ts")],
      flows: [at(root, "app/flows/onboard.ts")],
      pages: [],
    });
    expect(scanApp(relative(process.cwd(), root))).toEqual(scan);
  });

  it("scans a page folder into its declaration, view, states, regions and overlays", () => {
    const root = app([
      ...HOME,
      "app/pages/home/regions/list/region.tsx",
      "app/pages/home/regions/composer/region.tsx",
      "app/pages/home/regions/parts/",
      "app/pages/home/regions/stray.tsx",
      "app/pages/home/overlays/NoteSheet.tsx",
      "app/pages/home/overlays/Help.tsx",
      "app/pages/home/overlays/notes.ts",
      "app/pages/home/overlays/NoteSheet.test.tsx",
      "app/pages/home/overlays/types.d.tsx",
      "app/pages/home/overlays/nested/Deep.tsx",
      "app/pages/README.md",
    ]);
    const scan = scanApp(root);
    expect(scan.pages).toEqual([
      {
        id: "home",
        dir: at(root, "app/pages/home"),
        page: at(root, "app/pages/home/page.ts"),
        view: at(root, "app/pages/home/view.tsx"),
        states: at(root, "app/pages/home/states.tsx"),
        regions: [
          { name: "composer", file: at(root, "app/pages/home/regions/composer/region.tsx") },
          { name: "list", file: at(root, "app/pages/home/regions/list/region.tsx") },
        ],
        overlays: [
          { name: "Help", file: at(root, "app/pages/home/overlays/Help.tsx") },
          { name: "NoteSheet", file: at(root, "app/pages/home/overlays/NoteSheet.tsx") },
        ],
      },
    ]);
    expect(scan.entities).toEqual([]);
  });

  it("names a page folder after its page id", () => {
    const upper = app([
      "app/pages/Home/page.ts",
      "app/pages/Home/view.tsx",
      "app/pages/Home/states.tsx",
    ]);
    const error = caught(() => scanApp(upper)) as RexAppScanError;
    expect(error.code).toBe("REX460");
    expect(error.message).toBe(
      "REX460 app/pages/Home: a page folder is named after its page id (lowercase letters, digits, dot and dash)",
    );

    const dotted = app([
      "app/pages/notes.archive-2/page.ts",
      "app/pages/notes.archive-2/view.tsx",
      "app/pages/notes.archive-2/states.tsx",
    ]);
    expect(scanApp(dotted).pages.map((entry) => entry.id)).toEqual(["notes.archive-2"]);
  });

  it("reports every missing page file in convention order", () => {
    const partial = app(["app/pages/home/states.tsx"]);
    expect((caught(() => scanApp(partial)) as RexAppScanError).message).toBe(
      "REX460 app/pages/home is missing page.ts, view.tsx",
    );
    const empty = app(["app/pages/home/"]);
    expect((caught(() => scanApp(empty)) as RexAppScanError).message).toBe(
      "REX460 app/pages/home is missing page.ts, view.tsx, states.tsx",
    );
  });

  it("scans the configured app folder instead of the default", () => {
    const root = app([
      "site/pages/home/page.ts",
      "site/pages/home/view.tsx",
      "site/pages/home/states.tsx",
      "site/actions/go.ts",
    ]);
    const scan = scanApp(root, "site");
    expect(scan.appDir).toBe(at(root, "site"));
    expect(scan.actions).toEqual([at(root, "site/actions/go.ts")]);
    expect(scan.pages.map((entry) => entry.dir)).toEqual([at(root, "site/pages/home")]);
    expect((caught(() => scanApp(root)) as RexAppScanError).code).toBe("REX460");
  });
});

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "../..");
const fixture = path.join(here, "fixtures/app");
const SCAN_TEST_TIMEOUT_MS = 60_000;
const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function link(root: string, name: string, target: string): void {
  const destination = path.join(root, "node_modules", name);
  mkdirSync(path.dirname(destination), { recursive: true });
  symlinkSync(realpathSync(target), destination, "dir");
}

function write(root: string, file: string, lines: readonly string[]): void {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), `${lines.join("\n")}\n`);
}

function appWithActionFolder(): string {
  const root = mkdtempSync(path.join(tmpdir(), "rex-vite-scan-"));
  temporary.push(root);
  cpSync(fixture, root, { recursive: true });
  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "scan-fixture", private: true, type: "module" })}\n`,
  );
  link(root, "@sidioralabs/rex", packageRoot);
  link(root, "zod", path.join(packageRoot, "node_modules/zod"));
  link(root, "react", path.join(packageRoot, "node_modules/react"));
  write(root, "app/actions/notes/archive-note.ts", [
    'import { action } from "@sidioralabs/rex";',
    'import { id } from "@sidioralabs/rex/schema";',
    'import { z } from "zod/mini";',
    'import { notes } from "../../policies/notes.ts";',
    "",
    'export const archiveNote = action("archive-note", {',
    "  input: z.object({ noteId: id() }),",
    "  output: z.object({ archived: z.boolean() }),",
    '  policy: notes.can("notes.write"),',
    '  effect: "reversible",',
    '  label: "Archive note",',
    '  shortcut: "mod+shift+a",',
    '  invalidates: ["note"],',
    "  handler: () => ({ archived: true }),",
    "});",
  ]);
  write(root, "app/actions/notes/archive-note.test.ts", [
    'throw new Error("a test file under app/actions is never registered");',
  ]);
  write(root, "app/actions/notes/fixtures/archived.ts", [
    'throw new Error("a fixture under app/actions is never registered");',
  ]);
  write(root, "app/actions/fixtures/seed.ts", [
    'throw new Error("a fixture folder under app/actions is never registered");',
  ]);
  const pageFile = path.join(root, "app/pages/home/page.ts");
  writeFileSync(
    pageFile,
    readFileSync(pageFile, "utf8")
      .replace(
        'import { addNote } from "../../actions/add-note.ts";',
        'import { addNote } from "../../actions/add-note.ts";\nimport { archiveNote } from "../../actions/notes/archive-note.ts";',
      )
      .replace("actions: [addNote],", "actions: [addNote, archiveNote],"),
  );
  return root;
}

describe("scanApp action folders", { timeout: SCAN_TEST_TIMEOUT_MS }, () => {
  it("lists every action module under app/actions at any depth except tests and fixtures", () => {
    const root = appWithActionFolder();
    const scan = scanApp(root);
    const at = (file: string) => normalizePath(path.join(root, file));
    expect(scan.actions).toEqual([
      at("app/actions/add-note.ts"),
      at("app/actions/notes/archive-note.ts"),
    ]);
    expect(scan.entities).toEqual([at("app/entities/note.ts")]);
    expect(scan.policies).toEqual([at("app/policies/notes.ts")]);
    expect(scanApp(root)).toEqual(scan);

    const code = generateAppModule(scan, {
      name: "scan-fixture",
      core: "@sidioralabs/rex",
      client: "@sidioralabs/rex/client",
      config: { fonts: [], i18n: null },
      shellComponents: null,
      locales: [],
    });
    expect(code).toContain(
      `import * as action0 from ${JSON.stringify(at("app/actions/add-note.ts"))};`,
    );
    expect(code).toContain(
      `import * as action1 from ${JSON.stringify(at("app/actions/notes/archive-note.ts"))};`,
    );
    expect(code).toContain(
      '...rexDeclarations(action1, "action", "app/actions/notes/archive-note.ts")',
    );
    expect(code).not.toContain("fixtures");
    expect(code).not.toContain(".test.ts");
  });

  it("registers a nested action and addresses it in the manifest exactly like a flat one", async () => {
    const root = appWithActionFolder();
    const bundle = await withModuleLoader(root, loadAppBundle);
    expect(bundle.actions.map((entry) => entry.id)).toEqual(["add-note", "archive-note"]);
    expect(bundle.registry.get("action", "archive-note").id).toBe("archive-note");
    expect(bundle.registry.get("page", "home").actions.map((entry) => entry.id)).toEqual([
      "add-note",
      "archive-note",
    ]);

    const { manifest } = bundle;
    expect(manifest.actions.map((entry) => entry.id)).toEqual(["add-note", "archive-note"]);
    const flat = manifest.actions.find((entry) => entry.id === "add-note");
    const nested = manifest.actions.find((entry) => entry.id === "archive-note");
    expect(Object.keys(nested ?? {})).toEqual(Object.keys(flat ?? {}));
    expect(nested).toMatchObject({
      id: "archive-note",
      label: "Archive note",
      shortcut: "mod+shift+a",
      effect: "reversible",
      invalidates: ["note"],
    });
    expect(manifest.pages.find((entry) => entry.id === "home")?.actions).toEqual([
      "add-note",
      "archive-note",
    ]);
    const agents = renderAgentsMd(manifest);
    expect(agents).toContain("archive-note");
    expect(agents.indexOf("archive-note")).toBeGreaterThan(agents.indexOf("add-note"));
  });
});
