import type { Command } from "commander";
import {
  AGENTS_FILE,
  MANIFEST_FILE,
  ManifestScanError,
  writeManifest,
  type WriteManifestResult,
} from "../../manifest/scan.ts";
import { EXIT_FAILURE, RexCliExit, type RexCliIO } from "../index.ts";
import { readAppConfig } from "./check.ts";

export function register(program: Command, io: RexCliIO): void {
  program
    .command("manifest")
    .description(`write ${MANIFEST_FILE} and ${AGENTS_FILE} from the app declarations`)
    .action(async () => {
      await readAppConfig(io.cwd, io, "manifest");
      let result: WriteManifestResult;
      try {
        result = await writeManifest(io.cwd);
      } catch (error) {
        if (error instanceof ManifestScanError) {
          throw new RexCliExit(EXIT_FAILURE, `rex manifest: ${error.message}`);
        }
        throw error;
      }
      io.out(
        `wrote ${MANIFEST_FILE} (${result.manifest.pages.length} pages, ${result.manifest.actions.length} actions)\n`,
      );
      io.out(`wrote ${AGENTS_FILE}\n`);
    });
}
