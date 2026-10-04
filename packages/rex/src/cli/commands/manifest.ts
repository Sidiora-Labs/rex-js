import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { RexCommand as Command } from "../args.ts";
import {
  AGENTS_FILE,
  MANIFEST_DIR,
  MANIFEST_FILE,
  ManifestScanError,
  appName,
  declarationFiles,
  renderManifestFiles,
} from "../../manifest/scan.ts";
import type { Manifest } from "../../manifest/types.ts";
import { EXIT_FAILURE, RexCliExit, type RexCliIO } from "../index.ts";
import { loadAppBundle, withModuleLoader } from "../load.ts";
import { readAppConfig } from "./check.ts";

export async function writeAppManifest(root: string): Promise<Manifest> {
  const appRoot = resolve(root);
  declarationFiles(appRoot);
  const manifest = await withModuleLoader(
    appRoot,
    async (loader) => (await loadAppBundle(loader)).manifest,
    { rex: { name: appName(appRoot) } },
  );
  const files = renderManifestFiles(manifest);
  mkdirSync(join(appRoot, MANIFEST_DIR), { recursive: true });
  writeFileSync(join(appRoot, MANIFEST_FILE), files.manifest);
  writeFileSync(join(appRoot, AGENTS_FILE), files.agents);
  return manifest;
}

export function register(program: Command, io: RexCliIO): void {
  program
    .command("manifest")
    .description(`write ${MANIFEST_FILE} and ${AGENTS_FILE} from the app declarations`)
    .action(async () => {
      await readAppConfig(io.cwd, io, "manifest");
      let manifest: Manifest;
      try {
        manifest = await writeAppManifest(io.cwd);
      } catch (error) {
        if (error instanceof ManifestScanError) {
          throw new RexCliExit(EXIT_FAILURE, `rex manifest: ${error.message}`);
        }
        throw error;
      }
      io.out(
        `wrote ${MANIFEST_FILE} (${manifest.pages.length} pages, ${manifest.actions.length} actions)\n`,
      );
      io.out(`wrote ${AGENTS_FILE}\n`);
    });
}
