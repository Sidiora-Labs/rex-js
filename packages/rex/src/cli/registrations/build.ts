import { InvalidArgumentError, type RexCommand } from "../args.ts";
import type { RexCliIO } from "../index.ts";

export const BUILD_TARGETS = ["node", "edge", "bun", "deno", "static"] as const;
export type BuildTarget = (typeof BUILD_TARGETS)[number];
export const DEFAULT_BUILD_TARGET: BuildTarget = "node";

export function isBuildTarget(value: string): value is BuildTarget {
  return (BUILD_TARGETS as readonly string[]).includes(value);
}

export function parseTarget(value: string): BuildTarget {
  if (!isBuildTarget(value)) {
    throw new InvalidArgumentError(`the target must be one of ${BUILD_TARGETS.join(", ")}`);
  }
  return value;
}

export function register(program: RexCommand, io: RexCliIO): void {
  program
    .command("build")
    .description(
      "build the client into dist/client and, unless the target is static, the server into dist/server.js; for static, every page as HTML (prerendered or the shell), index.md beside each prerendered page, 404.html and dist/client/rex/manifest",
    )
    .option(
      "--target <target>",
      `runtime to build for: ${BUILD_TARGETS.join(", ")}; without it, the target of deploy.host in rex.config.ts, else ${DEFAULT_BUILD_TARGET}`,
      parseTarget,
    )
    .option("--no-check", "build without running rex check first")
    .action(async (options: { check: boolean; target?: BuildTarget }) => {
      const { executeBuild } = await import("../commands/build.ts");
      await executeBuild(options, io);
    });
}
