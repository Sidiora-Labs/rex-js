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
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePath, type Plugin } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REX_ERROR_DOCS } from "../core/errors.docs.ts";
import { RexError, isRexError } from "../core/errors.ts";
import { causeFrame, fileFrame, formatCliError, locatedRexError, sourceFrame } from "./frame.ts";
import { EXIT_FAILURE, run, type RexCliIO } from "./index.ts";
import { withModuleLoader } from "./load.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "..", "vite", "fixtures", "app");
const packageModules = join(here, "..", "..", "node_modules");
const coreEntry = join(here, "..", "index.ts");
const aliasPlugin: Plugin = {
  name: "frame-test-alias",
  config: () => ({ resolve: { alias: [{ find: /^@sidioralabs\/rex$/, replacement: coreEntry }] } }),
};

const SOURCE = ["a", "", "\tconst b = 1;", "d", "e", "f"].join("\n");

describe("sourceFrame", () => {
  it("marks the line and column with two lines of context", () => {
    expect(sourceFrame(SOURCE, 3, { column: 2 })).toBe(
      ["  1 | a", "  2 |", "> 3 |   const b = 1;", "    |   ^", "  4 | d", "  5 | e"].join("\n"),
    );
  });

  it("omits the caret without a column and pads wide gutters", () => {
    const source = Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join("\n");
    expect(sourceFrame(source, 10, { context: 1 })).toBe(
      ["   9 | line 9", "> 10 | line 10", "  11 | line 11"].join("\n"),
    );
  });

  it("returns nothing for a line outside the source", () => {
    expect(sourceFrame(SOURCE, 0)).toBe("");
    expect(sourceFrame(SOURCE, 7)).toBe("");
    expect(sourceFrame(SOURCE, 1.5)).toBe("");
  });
});

describe("CLI error output", () => {
  let dir: string;
  let file: string;

  beforeAll(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "rex-frame-")));
    file = join(dir, "page.ts");
    writeFileSync(file, 'import { page } from "@sidioralabs/rex";\n\nexport default page("x", {\n  route: "x",\n});\n');
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("prints the error, hint, docs and a source frame for a located RexError", () => {
    const error = new RexError("REX213", 'page "x": field "route" route must be a string starting with /', {
      file,
      line: 3,
      column: 16,
    });
    expect(formatCliError(error)).toBe(
      [
        `rex: REX213 page "x": field "route" route must be a string starting with / (${file}:3:16)`,
        `  hint: ${REX_ERROR_DOCS.REX213.hint}`,
        "  docs: https://rex.sidioralabs.com/errors/REX213",
        "",
        '  1 | import { page } from "@sidioralabs/rex";',
        "  2 |",
        '> 3 | export default page("x", {',
        "    |                ^",
        '  4 |   route: "x",',
        "  5 | });",
      ].join("\n"),
    );
    expect(fileFrame(error)).toContain("> 3 |");
  });

  it("prints no frame without a location or a readable file", () => {
    const bare = new RexError("REX100", "missing");
    expect(formatCliError(bare)).toBe(
      `rex: REX100 missing\n  hint: ${REX_ERROR_DOCS.REX100.hint}\n  docs: https://rex.sidioralabs.com/errors/REX100`,
    );
    expect(fileFrame(new RexError("REX213", "x", { file: join(dir, "gone.ts"), line: 1 }))).toBe("");
    expect(formatCliError(new Error("plain"))).toBe("rex: plain");
  });

  it("finds a located RexError through the cause chain", () => {
    const located = new RexError("REX213", "x", { file, line: 4, column: 3 });
    const wrapped = new Error("outer", { cause: new Error("middle", { cause: located }) });
    expect(locatedRexError(wrapped)).toBe(located);
    expect(locatedRexError(new RexError("REX213", "x"))).toBeNull();
    expect(causeFrame(wrapped)).toContain('> 4 |   route: "x",');
    expect(causeFrame(new Error("none"))).toBe("");
  });

  it("makes the CLI entry print a source frame for raw and wrapped errors", async () => {
    const commands = join(dir, "commands");
    mkdirSync(commands);
    const errorsModule = JSON.stringify(join(here, "..", "core", "errors.ts"));
    const indexModule = JSON.stringify(join(here, "index.ts"));
    writeFileSync(
      join(commands, "broken.ts"),
      [
        `import { RexError } from ${errorsModule};`,
        `import { RexCliExit } from ${indexModule};`,
        `const located = () => new RexError("REX213", "page declaration failed", { file: ${JSON.stringify(file)}, line: 4, column: 3 });`,
        "export function register(program) {",
        "  program.command(\"raw\").action(() => { throw located(); });",
        "  program.command(\"wrapped\").action(() => { throw new RexCliExit(1, \"rex wrapped: failed\", { cause: located() }); });",
        "}",
        "",
      ].join("\n"),
    );
    const capture = () => {
      const io = { cwd: dir, out: "", err: "" };
      const cli: RexCliIO = {
        cwd: dir,
        out: (text) => {
          io.out += text;
        },
        err: (text) => {
          io.err += text;
        },
      };
      return { io, cli };
    };
    const raw = capture();
    expect(await run(["raw"], raw.cli, commands)).toBe(EXIT_FAILURE);
    expect(raw.io.err).toContain(`rex: REX213 page declaration failed (${file}:4:3)`);
    expect(raw.io.err).toContain('> 4 |   route: "x",\n    |   ^');
    const wrapped = capture();
    expect(await run(["wrapped"], wrapped.cli, commands)).toBe(1);
    expect(wrapped.io.err.startsWith("rex wrapped: failed\n\n")).toBe(true);
    expect(wrapped.io.err).toContain('> 4 |   route: "x",');
  }, 60_000);
});

describe("module loading for CLI commands", () => {
  let root: string;

  beforeAll(() => {
    root = normalizePath(realpathSync(mkdtempSync(join(tmpdir(), "rex-frame-app-"))));
    cpSync(fixtureRoot, root, { recursive: true });
    symlinkSync(packageModules, join(root, "node_modules"), "dir");
    const notePage = join(root, "app", "pages", "note", "page.ts");
    writeFileSync(
      notePage,
      readFileSync(notePage, "utf8").replace('route: "/notes/:noteId"', 'route: "notes/:noteId"'),
    );
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("locates a declaration error at the declaring line of the app module", async () => {
    const failure = await withModuleLoader(
      root,
      async (loader) => {
        try {
          await loader.load("/app/pages/note/page.ts");
        } catch (error) {
          return error;
        }
        throw new Error("expected the note page declaration to fail");
      },
      { plugins: [aliasPlugin] },
    );
    expect(isRexError(failure)).toBe(true);
    const error = failure as RexError;
    const file = `${root}/app/pages/note/page.ts`;
    expect(error.code).toBe("REX213");
    expect([error.file, error.line]).toEqual([file, 3]);
    expect(error.column).toBeGreaterThan(0);
    const output = formatCliError(error);
    expect(output).toContain(`(${file}:3:${error.column})`);
    expect(output).toContain('> 3 | export default page("note", {');
  }, 60_000);
});
