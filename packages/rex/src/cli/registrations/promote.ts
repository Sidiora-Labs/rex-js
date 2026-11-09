import type { RexCommand } from "../args.ts";
import type { RexCliIO } from "../index.ts";

export function register(program: RexCommand, io: RexCliIO): void {
  program
    .command("promote")
    .description("move a page part to app/components and rewrite the imports that use it")
    .argument("<part>", "part path: <page>/regions/<region>/parts/<Part>")
    .action(async (spec: string) => {
      const { executePromote } = await import("../commands/promote.ts");
      executePromote(spec, io);
    });
}
