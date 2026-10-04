import type { RexCommand as Command } from "../args.ts";
import { formatFindings, runCheck, summarize } from "../../check/index.ts";
import { runRuntimeCheck } from "../../check/runtime.ts";
import type { RexConfigExport } from "../../core/config.ts";
import { explainRexError } from "../../core/errors.docs.ts";
import { isRexError } from "../../core/errors.ts";
import { hasConfig, loadRexConfig } from "../config.ts";
import { EXIT_FAILURE, EXIT_OK, RexCliExit, type RexCliIO } from "../index.ts";

export const NO_CHECK_HINT = "fix the findings above, or pass --no-check to skip rex check";

export async function readAppConfig(
  root: string,
  io: RexCliIO,
  command: string,
): Promise<RexConfigExport | null> {
  if (!hasConfig(root)) return null;
  try {
    return (await loadRexConfig(root, { warn: (message) => io.err(`${message}\n`) })).read;
  } catch (error) {
    if (isRexError(error)) {
      throw new RexCliExit(EXIT_FAILURE, `rex ${command}: ${explainRexError(error)}`);
    }
    return null;
  }
}

export async function ensureCheckPasses(
  root: string,
  io: RexCliIO,
  command: string,
): Promise<void> {
  const result = await runCheck(root);
  if (result.exitCode === EXIT_OK) return;
  io.err(result.output);
  throw new RexCliExit(
    result.exitCode,
    `rex ${command}: rex check reported ${result.errors} error${result.errors === 1 ? "" : "s"}; ${NO_CHECK_HINT}`,
  );
}

export function register(program: Command, io: RexCliIO): void {
  program
    .command("check")
    .description(
      "run typecheck, boundaries, states, parity, naming, traps, tokens and manifest freshness",
    )
    .option("--json", "print the findings as a JSON array")
    .option(
      "--runtime",
      "also mount every page in happy-dom per actor and state and compare the sidecar with the visible controls (parity/runtime)",
    )
    .action(async (options: { json?: boolean; runtime?: boolean }) => {
      await readAppConfig(io.cwd, io, "check");
      const json = options.json === true;
      const result = await runCheck(io.cwd, { json });
      if (options.runtime !== true) {
        io.out(result.output);
        if (result.exitCode !== EXIT_OK) throw new RexCliExit(result.exitCode);
        return;
      }
      let runtime: Awaited<ReturnType<typeof runRuntimeCheck>>;
      try {
        runtime = await runRuntimeCheck(io.cwd);
      } catch (error) {
        io.out(result.output);
        throw new RexCliExit(
          EXIT_FAILURE,
          `rex check --runtime: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      const merged = summarize([...result.findings, ...runtime.findings]);
      io.out(formatFindings(merged.findings, json ? "json" : "human"));
      if (merged.exitCode !== EXIT_OK) throw new RexCliExit(merged.exitCode);
    });
}
