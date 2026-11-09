import { ARGS_USAGE_EXIT, type RexCommand } from "../args.ts";
import type { RexCliIO } from "../index.ts";

export const DEFAULT_FROM = "0.1";

export function register(program: RexCommand, io: RexCliIO): void {
  const command: RexCommand = program
    .command("migrate")
    .description("list and apply the codemods that move an app from an earlier Rex version")
    .option("--from <version>", "the Rex version the app was written for", DEFAULT_FROM)
    .option("--list", "list the codemods without applying them")
    .action(async (options: { from: string; list?: boolean }) => {
      const { executeMigrate, MigrateError } = await import("../commands/migrate.ts");
      try {
        await executeMigrate(options, io);
      } catch (error) {
        if (error instanceof MigrateError) {
          command.error(error.detail, { code: error.cliCode, exitCode: ARGS_USAGE_EXIT });
        }
        throw error;
      }
    });
}
