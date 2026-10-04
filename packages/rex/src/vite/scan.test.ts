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
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePath } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { loadAppBundle, withModuleLoader } from "../cli/load.ts";
import { renderAgentsMd } from "../manifest/agents-md.ts";
import { generateAppModule } from "./app-module.ts";
import { scanApp } from "./scan.ts";

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
