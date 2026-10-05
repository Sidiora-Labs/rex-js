import type { RexCommand } from "../args.ts";
import type { RexCliIO } from "../index.ts";

export function register(program: RexCommand, io: RexCliIO): void {
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
      const { executeCheck } = await import("../commands/check.ts");
      await executeCheck(options, io);
    });
}
