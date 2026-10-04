import { existsSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { RexError } from "../../core/errors.ts";
import { ARGS_ERROR, ARGS_USAGE_EXIT, type RexCommand as Command } from "../args.ts";
import {
  CODEMOD_FILE,
  formatFlag,
  type Codemod,
  type CodemodFlag,
} from "../codemods/codemod.ts";
import type { RexCliIO } from "../index.ts";

export const DEFAULT_FROM = "0.1";

export const CODEMODS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "codemods",
);

const MODULE_EXTENSION = import.meta.url.endsWith(".ts") ? ".ts" : ".js";

export interface CodemodReport {
  readonly id: string;
  readonly description: string;
  readonly changed: readonly string[];
  readonly flags: readonly CodemodFlag[];
}

export interface MigrateReport {
  readonly from: string;
  readonly codemods: readonly CodemodReport[];
  readonly changed: readonly string[];
  readonly flags: readonly CodemodFlag[];
}

export class MigrateError extends RexError {
  readonly cliCode: string;

  constructor(message: string, cliCode: string = ARGS_ERROR.invalidArgument) {
    super("REX611", message);
    this.name = "MigrateError";
    this.cliCode = cliCode;
  }
}

export function codemodFiles(dir: string = CODEMODS_DIR): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && CODEMOD_FILE.test(entry.name) && entry.name.endsWith(MODULE_EXTENSION),
    )
    .map((entry) => entry.name)
    .sort()
    .map((name) => path.join(dir, name));
}

function isCodemod(value: unknown): value is Codemod {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { from?: unknown }).from === "string" &&
    typeof (value as { description?: unknown }).description === "string" &&
    typeof (value as { run?: unknown }).run === "function"
  );
}

export async function loadCodemods(dir: string = CODEMODS_DIR): Promise<readonly Codemod[]> {
  const codemods: Codemod[] = [];
  for (const file of codemodFiles(dir)) {
    const loaded = (await import(pathToFileURL(file).href)) as { readonly codemod?: unknown };
    const stem = path.basename(file).replace(/\.(ts|js)$/, "");
    if (!isCodemod(loaded.codemod)) {
      throw new RexError("REX612", `rex: ${file} must export codemod (defineCodemod({ id, from, description, run }))`);
    }
    if (loaded.codemod.id !== stem) {
      throw new RexError("REX612", `rex: ${file} exports codemod ${loaded.codemod.id}; its id must be ${stem}`);
    }
    codemods.push(loaded.codemod);
  }
  return Object.freeze(codemods);
}

export function codemodVersions(codemods: readonly Codemod[]): readonly string[] {
  return [...new Set(codemods.map((codemod) => codemod.from))];
}

export function selectCodemods(codemods: readonly Codemod[], from: string): readonly Codemod[] {
  const versions = codemodVersions(codemods);
  if (!versions.includes(from)) {
    throw new MigrateError(
      `rex migrate: no codemods migrate from ${JSON.stringify(from)}; known versions: ${versions.join(", ")}`,
    );
  }
  return Object.freeze(codemods.filter((codemod) => codemod.from === from));
}

export async function runMigrate(
  root: string,
  from: string = DEFAULT_FROM,
  dir: string = CODEMODS_DIR,
): Promise<MigrateReport> {
  const selected = selectCodemods(await loadCodemods(dir), from);
  const absoluteRoot = path.resolve(root);
  const reports: CodemodReport[] = [];
  for (const codemod of selected) {
    const result = codemod.run(absoluteRoot);
    for (const change of result.changes) {
      writeFileSync(path.join(absoluteRoot, change.file), change.text);
    }
    reports.push(
      Object.freeze({
        id: codemod.id,
        description: codemod.description,
        changed: Object.freeze(result.changes.map((change) => change.file).sort()),
        flags: Object.freeze([...result.flags]),
      }),
    );
  }
  return Object.freeze({
    from,
    codemods: Object.freeze(reports),
    changed: Object.freeze([...new Set(reports.flatMap((report) => report.changed))].sort()),
    flags: Object.freeze(reports.flatMap((report) => report.flags)),
  });
}

export function formatCodemodList(codemods: readonly Codemod[]): string {
  const width = Math.max(0, ...codemods.map((codemod) => codemod.id.length));
  return codemods
    .map((codemod) => `${codemod.id.padEnd(width)}  ${codemod.description}\n`)
    .join("");
}

export function formatMigrateReport(report: MigrateReport): string {
  const lines: string[] = [];
  for (const codemod of report.codemods) {
    const changed = codemod.changed.length;
    lines.push(`${codemod.id}: ${changed === 0 ? "no changes" : `${changed} changed`}`);
    for (const file of codemod.changed) lines.push(`  changed ${file}`);
  }
  for (const flag of report.flags) lines.push(formatFlag(flag));
  const count = report.changed.length;
  lines.push(
    `migrated from ${report.from}: ${count} file${count === 1 ? "" : "s"} changed, ${report.flags.length} flagged for the author`,
  );
  return `${lines.join("\n")}\n`;
}

export function register(program: Command, io: RexCliIO): void {
  const command: Command = program
    .command("migrate")
    .description("list and apply the codemods that move an app from an earlier Rex version")
    .option("--from <version>", "the Rex version the app was written for", DEFAULT_FROM)
    .option("--list", "list the codemods without applying them")
    .action(async (options: { from: string; list?: boolean }) => {
      try {
        if (options.list === true) {
          io.out(formatCodemodList(selectCodemods(await loadCodemods(), options.from)));
          return;
        }
        io.out(formatMigrateReport(await runMigrate(io.cwd, options.from)));
      } catch (error) {
        if (error instanceof MigrateError) {
          command.error(error.detail, { code: error.cliCode, exitCode: ARGS_USAGE_EXIT });
        }
        throw error;
      }
    });
}
