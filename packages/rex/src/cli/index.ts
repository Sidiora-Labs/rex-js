#!/usr/bin/env node
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REX_VERSION } from "../index.ts";
import { ARGS_ERROR, RexArgsError, RexCommand } from "./args.ts";

export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;

export const USAGE_ERROR_CODES: readonly string[] = Object.values(ARGS_ERROR);

export interface RexCliIO {
  readonly cwd: string;
  out(text: string): void;
  err(text: string): void;
}

export interface RexCommandModule {
  register(program: RexCommand, io: RexCliIO): void;
}

export class RexCliExit extends Error {
  readonly exitCode: number;

  constructor(exitCode: number, message = "") {
    super(message);
    this.name = "RexCliExit";
    this.exitCode = exitCode;
  }
}

const MODULE_EXTENSION = import.meta.url.endsWith(".ts") ? ".ts" : ".js";

export const COMMANDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "commands");

const COMMAND_FILE = /^[a-z][a-z0-9-]*\.(ts|js)$/;

export function commandModuleFiles(dir: string = COMMANDS_DIR): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && COMMAND_FILE.test(entry.name) && entry.name.endsWith(MODULE_EXTENSION),
    )
    .map((entry) => entry.name)
    .sort()
    .map((name) => join(dir, name));
}

function isCommandModule(value: unknown): value is RexCommandModule {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { register?: unknown }).register === "function"
  );
}

export function processIO(): RexCliIO {
  return {
    cwd: process.cwd(),
    out: (text) => {
      process.stdout.write(text);
    },
    err: (text) => {
      process.stderr.write(text);
    },
  };
}

export async function createProgram(
  io: RexCliIO,
  commandsDir: string = COMMANDS_DIR,
): Promise<RexCommand> {
  const program = new RexCommand("rex")
    .description("Rex: declarations in, an agent-operable web app out")
    .version(REX_VERSION, "-v, --version", "print the rex version")
    .configureOutput({ writeOut: io.out, writeErr: io.err });
  program
    .command("version")
    .description("print the rex version")
    .action(() => {
      io.out(`${REX_VERSION}\n`);
    });
  for (const file of commandModuleFiles(commandsDir)) {
    const loaded: unknown = await import(pathToFileURL(file).href);
    if (!isCommandModule(loaded)) {
      throw new Error(`rex: ${file} must export register(program, io)`);
    }
    loaded.register(program, io);
  }
  return program;
}

export async function run(
  argv: readonly string[],
  io: RexCliIO = processIO(),
  commandsDir: string = COMMANDS_DIR,
): Promise<number> {
  try {
    const program = await createProgram(io, commandsDir);
    await program.parseAsync([...argv]);
    return EXIT_OK;
  } catch (error) {
    if (error instanceof RexCliExit) {
      if (error.message !== "") io.err(`${error.message}\n`);
      return error.exitCode;
    }
    if (error instanceof RexArgsError) {
      if (error.message !== "") io.err(`${error.message}\n`);
      return USAGE_ERROR_CODES.includes(error.code) ? EXIT_USAGE : error.exitCode;
    }
    io.err(`rex: ${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_FAILURE;
  }
}

function isMain(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return pathToFileURL(realpathSync(entry)).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isMain()) {
  void run(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
