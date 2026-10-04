import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { RexError, errorDocs, isRexError } from "../../core/errors.ts";
import { ARGS_ERROR, RexCommand } from "../args.ts";
import { MEDIA_IMPORT } from "../templates.ts";
import type { CodemodFlag } from "../codemods/codemod.ts";
import { EXIT_OK, EXIT_USAGE, run, type RexCliIO } from "../index.ts";
import {
  CODEMODS_DIR,
  DEFAULT_FROM,
  MigrateError,
  codemodFiles,
  codemodVersions,
  formatCodemodList,
  formatMigrateReport,
  loadCodemods,
  register,
  runMigrate,
  selectCodemods,
} from "./migrate.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "..", "fixtures", "app-01");
const codemodModule = pathToFileURL(join(here, "..", "codemods", "codemod.ts")).href;
const CODEMOD_IDS = ["0.1-config", "0.1-page-render", "0.1-raw-img", "0.1-schema-entry"];
const PING = "app/actions/ping.ts";
const NOTE = "app/entities/note.ts";
const COVER = "app/pages/gallery/regions/cover/region.tsx";
const THUMB = "app/pages/gallery/regions/cover/parts/Thumb.tsx";
const SETTINGS_PAGE = "app/pages/settings/page.ts";
const CONFIG = "rex.config.ts";

const UPPER_FLAG: CodemodFlag = {
  code: "REX610",
  file: "notes.txt",
  line: 1,
  column: 1,
  message: "shout",
};

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix = "rex-migrate-command-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
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

function codemodSource(id: string, from: string, body: readonly string[]): string {
  return [
    'import { readFileSync } from "node:fs";',
    'import { join } from "node:path";',
    `import { defineCodemod } from ${JSON.stringify(codemodModule)};`,
    "",
    "export const codemod = defineCodemod({",
    `  id: ${JSON.stringify(id)},`,
    `  from: ${JSON.stringify(from)},`,
    `  description: ${JSON.stringify(`${id} description`)},`,
    "  run(root) {",
    ...body.map((line) => `    ${line}`),
    "  },",
    "});",
    "",
  ].join("\n");
}

const UPPER_BODY = [
  'const text = readFileSync(join(root, "notes.txt"), "utf8");',
  "const upper = text.toUpperCase();",
  "return {",
  '  changes: upper === text ? [] : [{ file: "notes.txt", text: upper }],',
  `  flags: [${JSON.stringify(UPPER_FLAG)}],`,
  "};",
];

const NOOP_BODY = ["void root;", "return { changes: [], flags: [] };"];

function codemodDir(): string {
  const dir = tempDir("rex-migrate-codemods-");
  writeFileSync(join(dir, "0.1-upper.ts"), codemodSource("0.1-upper", "0.1", UPPER_BODY));
  writeFileSync(join(dir, "0.2-later-on.ts"), codemodSource("0.2-later-on", "0.2", NOOP_BODY));
  writeFileSync(join(dir, "0.1-upper.test.ts"), "throw new Error('tests are not codemods');\n");
  writeFileSync(join(dir, "helper.ts"), "export const helper = 1;\n");
  writeFileSync(join(dir, "0.1-noise.js"), "throw new Error('wrong extension');\n");
  writeFileSync(join(dir, "0.1-types.d.ts"), "export {};\n");
  mkdirSync(join(dir, "0.1-folder.ts"));
  return dir;
}

function copyFixture(): string {
  const root = tempDir("rex-migrate-fixture-");
  cpSync(fixture, root, { recursive: true });
  return root;
}

describe("codemod discovery", () => {
  it("lists only versioned codemod modules with the running extension, sorted", () => {
    const dir = codemodDir();
    expect(codemodFiles(dir)).toEqual([join(dir, "0.1-upper.ts"), join(dir, "0.2-later-on.ts")]);
    expect(codemodFiles(join(dir, "absent"))).toEqual([]);
    expect(basename(CODEMODS_DIR)).toBe("codemods");
    expect(existsSync(CODEMODS_DIR)).toBe(true);
    expect(codemodFiles().map((file) => basename(file, ".ts"))).toEqual(CODEMOD_IDS);
  });

  it("loads the exported codemods frozen and in file order", async () => {
    const dir = codemodDir();
    const codemods = await loadCodemods(dir);
    expect(Object.isFrozen(codemods)).toBe(true);
    expect(codemods.map((codemod) => [codemod.id, codemod.from, codemod.description])).toEqual([
      ["0.1-upper", "0.1", "0.1-upper description"],
      ["0.2-later-on", "0.2", "0.2-later-on description"],
    ]);
    expect(codemodVersions(codemods)).toEqual(["0.1", "0.2"]);
    expect(codemodVersions(await loadCodemods())).toEqual([DEFAULT_FROM]);
    expect(DEFAULT_FROM).toBe("0.1");
  });

  it("refuses a module without a codemod export or with a mismatched id", async () => {
    const missing = tempDir("rex-migrate-broken-");
    writeFileSync(join(missing, "0.1-broken.ts"), "export const name = 'broken';\n");
    await expect(loadCodemods(missing)).rejects.toThrow(RexError);
    await expect(loadCodemods(missing)).rejects.toMatchObject({
      code: "REX612",
      detail: `rex: ${join(missing, "0.1-broken.ts")} must export codemod (defineCodemod({ id, from, description, run }))`,
    });

    const renamed = tempDir("rex-migrate-renamed-");
    writeFileSync(join(renamed, "0.1-renamed.ts"), codemodSource("0.1-other", "0.1", NOOP_BODY));
    await expect(loadCodemods(renamed)).rejects.toMatchObject({
      code: "REX612",
      detail: `rex: ${join(renamed, "0.1-renamed.ts")} exports codemod 0.1-other; its id must be 0.1-renamed`,
    });
  });
});

describe("selectCodemods", () => {
  it("keeps the codemods of the requested version and refuses unknown versions", async () => {
    const codemods = await loadCodemods(codemodDir());
    expect(selectCodemods(codemods, "0.2").map((codemod) => codemod.id)).toEqual(["0.2-later-on"]);
    expect(Object.isFrozen(selectCodemods(codemods, "0.1"))).toBe(true);
    let thrown: unknown;
    try {
      selectCodemods(codemods, "0.3");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(MigrateError);
    expect(isRexError(thrown)).toBe(true);
    expect(thrown).toMatchObject({
      name: "MigrateError",
      code: "REX611",
      cliCode: ARGS_ERROR.invalidArgument,
      detail: 'rex migrate: no codemods migrate from "0.3"; known versions: 0.1, 0.2',
    });
    expect(new MigrateError("custom", "rex.custom")).toMatchObject({
      code: "REX611",
      cliCode: "rex.custom",
      message: "REX611 custom",
    });
  });
});

describe("runMigrate", () => {
  it("applies the selected codemods, writes their changes and reports flags", async () => {
    const dir = codemodDir();
    const root = tempDir();
    writeFileSync(join(root, "notes.txt"), "quiet\n");
    const report = await runMigrate(root, "0.1", dir);
    expect(report).toEqual({
      from: "0.1",
      codemods: [
        {
          id: "0.1-upper",
          description: "0.1-upper description",
          changed: ["notes.txt"],
          flags: [UPPER_FLAG],
        },
      ],
      changed: ["notes.txt"],
      flags: [UPPER_FLAG],
    });
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.codemods)).toBe(true);
    expect(Object.isFrozen(report.codemods[0])).toBe(true);
    expect(readFileSync(join(root, "notes.txt"), "utf8")).toBe("QUIET\n");

    const again = await runMigrate(root, "0.1", dir);
    expect(again.changed).toEqual([]);
    expect(again.codemods.map((codemod) => codemod.changed)).toEqual([[]]);
    expect(again.flags).toEqual([UPPER_FLAG]);

    const later = await runMigrate(root, "0.2", dir);
    expect(later.codemods.map((codemod) => codemod.id)).toEqual(["0.2-later-on"]);
    expect(later.changed).toEqual([]);
    expect(later.flags).toEqual([]);
    await expect(runMigrate(root, "0.3", dir)).rejects.toThrow(MigrateError);
  });

  it("runs the shipped 0.1 codemods over a 0.1 app and dedupes the changed files", async () => {
    const root = copyFixture();
    const report = await runMigrate(root);
    expect(report.from).toBe(DEFAULT_FROM);
    expect(report.codemods.map((codemod) => [codemod.id, codemod.changed])).toEqual([
      ["0.1-config", [CONFIG]],
      ["0.1-page-render", [SETTINGS_PAGE]],
      ["0.1-raw-img", [THUMB, COVER]],
      ["0.1-schema-entry", [PING, NOTE]],
    ]);
    expect(report.changed).toEqual([PING, NOTE, THUMB, COVER, SETTINGS_PAGE, CONFIG]);
    expect(report.flags.map((flag) => [flag.code, flag.file, flag.line, flag.column])).toEqual([
      ["REX610", COVER, 7, 5],
      ["REX610", COVER, 14, 5],
    ]);
    const cover = readFileSync(join(root, COVER), "utf8");
    expect(cover).toContain(`import { Img } from ${JSON.stringify(MEDIA_IMPORT)};`);
    expect(cover).not.toContain("<img");
    expect(readFileSync(join(root, CONFIG), "utf8")).toContain("export default defineConfig({");
    expect(readFileSync(join(root, PING), "utf8")).toContain('import { z } from "zod/mini";');
    expect(readFileSync(join(root, SETTINGS_PAGE), "utf8")).toContain('render: "csr",');

    const second = await runMigrate(root);
    expect(second.changed).toEqual([]);
    expect(second.flags).toEqual(report.flags);
  });
});

describe("report formatting", () => {
  it("formatCodemodList pads ids to the widest and formatMigrateReport lists changes and flags", async () => {
    const codemods = await loadCodemods(codemodDir());
    expect(formatCodemodList(codemods)).toBe(
      "0.1-upper     0.1-upper description\n0.2-later-on  0.2-later-on description\n",
    );
    expect(formatCodemodList([])).toBe("");

    const root = tempDir();
    writeFileSync(join(root, "notes.txt"), "quiet\n");
    const dir = codemodDir();
    expect(formatMigrateReport(await runMigrate(root, "0.1", dir))).toBe(
      [
        "0.1-upper: 1 changed",
        "  changed notes.txt",
        `REX610 notes.txt:1:1 shout (${errorDocs("REX610")})`,
        "migrated from 0.1: 1 file changed, 1 flagged for the author",
        "",
      ].join("\n"),
    );
    expect(formatMigrateReport(await runMigrate(root, "0.1", dir))).toBe(
      [
        "0.1-upper: no changes",
        `REX610 notes.txt:1:1 shout (${errorDocs("REX610")})`,
        "migrated from 0.1: 0 files changed, 1 flagged for the author",
        "",
      ].join("\n"),
    );
    expect(formatMigrateReport(await runMigrate(root, "0.2", dir))).toBe(
      "0.2-later-on: no changes\nmigrated from 0.2: 0 files changed, 0 flagged for the author\n",
    );
  });
});

describe("register", () => {
  it("registers --from and --list and turns a migrate error into a usage exit", async () => {
    const program = new RexCommand("rex");
    register(program, captureIO(tmpdir()).io);
    const [listing] = program.listing().commands;
    expect(listing).toMatchObject({ name: "migrate", path: "rex migrate", arguments: [] });
    expect(listing?.options).toMatchObject([
      { long: "--from", value: "version", default: DEFAULT_FROM },
      { long: "--list", value: null, negate: false },
    ]);

    const root = copyFixture();
    const listed = captureIO(root);
    expect(await run(["migrate", "--list"], listed.io)).toBe(EXIT_OK);
    expect(listed.err()).toBe("");
    expect(listed.out()).toBe(formatCodemodList(await loadCodemods()));
    expect(readFileSync(join(root, CONFIG), "utf8")).toBe(
      readFileSync(join(fixture, CONFIG), "utf8"),
    );

    const unknown = captureIO(root);
    expect(await run(["migrate", "--from", "0.0"], unknown.io)).toBe(EXIT_USAGE);
    expect(unknown.out()).toBe("");
    expect(unknown.err()).toBe(
      'REX605 rex migrate: no codemods migrate from "0.0"; known versions: 0.1\n',
    );
  });
});
