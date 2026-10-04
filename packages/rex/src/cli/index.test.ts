import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { explainRexError } from "../core/errors.docs.ts";
import { RexError } from "../core/errors.ts";
import { REX_VERSION } from "../index.ts";
import { ARGS_USAGE_CODE } from "./args.ts";
import { MAKE_INVALID_CODE } from "./commands/make.ts";
import {
  COMMANDS_DIR,
  EXIT_FAILURE,
  EXIT_OK,
  EXIT_USAGE,
  RexCliExit,
  USAGE_ERROR_CODES,
  commandListing,
  commandModuleFiles,
  createProgram,
  processIO,
  run,
  type RexCliIO,
} from "./index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const COMMAND_LOAD_TIMEOUT_MS = 60_000;
const KNOWN_COMMANDS = ["build", "check", "dev", "make", "manifest", "migrate", "new", "promote"];
const GREET_MODULE = [
  "interface Program {",
  "  command(name: string): Program;",
  "  description(text: string): Program;",
  "  action(run: (name: string) => void): Program;",
  "}",
  "",
  "export function register(program: Program, io: { out(text: string): void }) {",
  "  program",
  '    .command("greet <name>")',
  '    .description("greet someone")',
  "    .action((name: string) => {",
  "      io.out(`hello ${name}\\n`);",
  "    });",
  "}",
  "",
].join("\n");

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "rex-cli-index-"));
  temporary.push(dir);
  return dir;
}

function captureIO(cwd: string = tmpdir()) {
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

function probeCommands(): string {
  const dir = tempDir();
  const errorsModule = JSON.stringify(join(here, "..", "core", "errors.ts"));
  const argsModule = JSON.stringify(join(here, "args.ts"));
  const indexModule = JSON.stringify(join(here, "index.ts"));
  writeFileSync(
    join(dir, "probe.ts"),
    [
      `import { RexError } from ${errorsModule};`,
      `import { RexArgsError } from ${argsModule};`,
      `import { RexCliExit } from ${indexModule};`,
      "",
      "export function register(program, io) {",
      '  program.command("stop").action(() => {',
      '    throw new RexCliExit(1, "rex stop: halted");',
      "  });",
      '  program.command("quiet").action(() => {',
      "    throw new RexCliExit(4);",
      "  });",
      '  program.command("usage").action(() => {',
      '    throw new RexArgsError("rex usage: bad input", "rex.custom", 7, "REX604");',
      "  });",
      '  program.command("invalid").action(() => {',
      '    throw new RexArgsError("rex invalid: bad id", "rex.custom", 7, "REX601");',
      "  });",
      '  program.command("refuse").action(() => {',
      '    throw new RexArgsError("rex refuse: not today", "rex.custom", 7, "REX605");',
      "  });",
      '  program.command("plain").action(() => {',
      '    throw new Error("probe exploded");',
      "  });",
      '  program.command("rex-error").action(() => {',
      '    throw new RexError("REX100", "missing");',
      "  });",
      '  program.command("echo <word>").action((word) => {',
      "    io.out(`${word}\\n`);",
      "  });",
      "}",
      "",
    ].join("\n"),
  );
  return dir;
}

beforeAll(async () => {
  await createProgram(captureIO().io);
}, COMMAND_LOAD_TIMEOUT_MS);

describe("exit codes and RexCliExit", () => {
  it("fixes the exit codes and maps the catalogued usage codes to exit 2", () => {
    expect([EXIT_OK, EXIT_FAILURE, EXIT_USAGE]).toEqual([0, 1, 2]);
    expect(USAGE_ERROR_CODES).toEqual([ARGS_USAGE_CODE, MAKE_INVALID_CODE]);
  });

  it("carries an exit code, an optional message and a cause", () => {
    const quiet = new RexCliExit(3);
    expect(quiet).toBeInstanceOf(Error);
    expect(quiet.name).toBe("RexCliExit");
    expect(quiet.exitCode).toBe(3);
    expect(quiet.message).toBe("");
    expect(quiet.cause).toBeUndefined();
    const cause = new Error("root");
    const loud = new RexCliExit(EXIT_FAILURE, "rex build: failed", { cause });
    expect(loud.exitCode).toBe(EXIT_FAILURE);
    expect(loud.message).toBe("rex build: failed");
    expect(loud.cause).toBe(cause);
  });
});

describe("commandModuleFiles", () => {
  it("lists the shipped command modules from the commands folder next to the CLI", () => {
    expect(COMMANDS_DIR).toBe(join(here, "commands"));
    const files = commandModuleFiles();
    expect(files).toEqual([...files].sort());
    for (const file of files) {
      expect(dirname(file)).toBe(COMMANDS_DIR);
      expect(basename(file)).toMatch(/^[a-z][a-z0-9-]*\.ts$/);
      expect(existsSync(file)).toBe(true);
    }
    expect(files.map((file) => basename(file, ".ts"))).toEqual(
      expect.arrayContaining(KNOWN_COMMANDS),
    );
  });

  it("keeps only lowercase TypeScript modules, sorted, and skips other files and folders", () => {
    const dir = tempDir();
    for (const name of [
      "zeta.ts",
      "alpha.ts",
      "other.js",
      "_hidden.ts",
      "Upper.ts",
      "alpha.test.ts",
      "data.json",
      "two-words.d.ts",
    ]) {
      writeFileSync(join(dir, name), "export {};\n");
    }
    mkdirSync(join(dir, "folder.ts"));
    expect(commandModuleFiles(dir)).toEqual([join(dir, "alpha.ts"), join(dir, "zeta.ts")]);
    expect(commandModuleFiles(join(dir, "absent"))).toEqual([]);
  });
});

describe("processIO", () => {
  it("binds the CLI to the process working directory and its streams", () => {
    const io = processIO();
    expect(io.cwd).toBe(process.cwd());
    expect(Object.keys(io).sort()).toEqual(["cwd", "err", "out"]);
    expect(typeof io.out).toBe("function");
    expect(typeof io.err).toBe("function");
  });
});

describe("createProgram and commandListing", () => {
  it("builds the rex program with version, the module commands and output routed to io", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "greet.ts"), GREET_MODULE);
    const captured = captureIO();
    const program = await createProgram(captured.io, dir);
    expect(program.listing().name).toBe("rex");
    expect(program.commands.map((command) => command.name()).sort()).toEqual(["greet", "version"]);

    expect(await run(["version"], captured.io, dir)).toBe(EXIT_OK);
    expect(captured.out()).toBe(`${REX_VERSION}\n`);
    const flag = captureIO();
    expect(await run(["--version"], flag.io, dir)).toBe(EXIT_OK);
    expect(flag.out()).toBe(`${REX_VERSION}\n`);

    const help = captureIO();
    expect(await run(["--help"], help.io, dir)).toBe(EXIT_OK);
    expect(help.err()).toBe("");
    expect(help.out()).toContain("Rex: declarations in, an agent-operable web app out");
    expect(help.out()).toMatch(/^\s+greet\b.*greet someone$/m);

    const greeted = captureIO();
    expect(await run(["greet", "rex"], greeted.io, dir)).toBe(EXIT_OK);
    expect(greeted.out()).toBe("hello rex\n");
  });

  it("refuses a command module whose register is not a function", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "broken.ts"), 'export const register = "nope";\n');
    await expect(createProgram(captureIO().io, dir)).rejects.toThrow(
      `rex: ${join(dir, "broken.ts")} must export register(program, io)`,
    );
  });

  it("lists the command tree without writing anything to io", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "greet.ts"), GREET_MODULE);
    const captured = captureIO();
    const listing = await commandListing(captured.io, dir);
    expect(captured.out()).toBe("");
    expect(captured.err()).toBe("");
    expect(listing.path).toBe("rex");
    expect(listing.commands.map((command) => [command.name, command.path])).toEqual([
      ["version", "rex version"],
      ["greet", "rex greet"],
    ]);
    expect(listing.commands[1]?.arguments.map((argument) => argument.name)).toEqual(["name"]);

    const shipped = await commandListing();
    expect(shipped.commands.map((command) => command.name).sort()).toEqual(
      ["version", ...commandModuleFiles().map((file) => basename(file, ".ts"))].sort(),
    );
  });
});

describe("run", () => {
  it("prints a RexCliExit message and returns its exit code, silently when it has none", async () => {
    const commands = probeCommands();
    const stop = captureIO();
    expect(await run(["stop"], stop.io, commands)).toBe(1);
    expect(stop.out()).toBe("");
    expect(stop.err()).toBe("rex stop: halted\n");
    const quiet = captureIO();
    expect(await run(["quiet"], quiet.io, commands)).toBe(4);
    expect(quiet.out()).toBe("");
    expect(quiet.err()).toBe("");
  });

  it("maps a RexArgsError to exit 2 for catalogued usage codes and to its own code otherwise", async () => {
    const commands = probeCommands();
    const usage = captureIO();
    expect(await run(["usage"], usage.io, commands)).toBe(EXIT_USAGE);
    expect(usage.err()).toBe("REX604 rex usage: bad input\n");
    const invalid = captureIO();
    expect(await run(["invalid"], invalid.io, commands)).toBe(EXIT_USAGE);
    expect(invalid.err()).toBe("REX601 rex invalid: bad id\n");
    const refuse = captureIO();
    expect(await run(["refuse"], refuse.io, commands)).toBe(7);
    expect(refuse.err()).toBe("REX605 rex refuse: not today\n");
  });

  it("formats any other error as a CLI failure with exit 1", async () => {
    const commands = probeCommands();
    const plain = captureIO();
    expect(await run(["plain"], plain.io, commands)).toBe(EXIT_FAILURE);
    expect(plain.err()).toBe("rex: probe exploded\n");
    const rex = captureIO();
    expect(await run(["rex-error"], rex.io, commands)).toBe(EXIT_FAILURE);
    expect(rex.err()).toBe(`rex: ${explainRexError(new RexError("REX100", "missing"))}\n`);
    expect(rex.err()).toContain("REX100 missing");
  });

  it("returns exit 0 after a command that completes and routes its output to io", async () => {
    const commands = probeCommands();
    const echoed = captureIO();
    expect(await run(["echo", "hi"], echoed.io, commands)).toBe(EXIT_OK);
    expect(echoed.out()).toBe("hi\n");
    expect(echoed.err()).toBe("");
    const unknown = captureIO();
    expect(await run(["frobnicate"], unknown.io, commands)).toBe(EXIT_USAGE);
    expect(unknown.err()).toContain("unknown command 'frobnicate'");
  });
});
