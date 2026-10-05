import type { RexCommand } from "../args.ts";
import type { RexCliIO } from "../index.ts";

export function register(program: RexCommand, io: RexCliIO): void {
  program
    .command("manifest")
    .description("write .rex/manifest.json and AGENTS.md from the app declarations")
    .action(async () => {
      const { executeManifest } = await import("../commands/manifest.ts");
      await executeManifest(io);
    });
}
