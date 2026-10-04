import type { Command } from "commander";
import { runCheck } from "../../check/index.ts";
import { EXIT_OK, RexCliExit, type RexCliIO } from "../index.ts";

export const NO_CHECK_HINT = "fix the findings above, or pass --no-check to skip rex check";

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
    .action(async (options: { json?: boolean }) => {
      const result = await runCheck(io.cwd, { json: options.json === true });
      io.out(result.output);
      if (result.exitCode !== EXIT_OK) throw new RexCliExit(result.exitCode);
    });
}
