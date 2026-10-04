import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  AGENTS_FILE,
  MANIFEST_DIR,
  MANIFEST_FILE,
  ManifestScanError,
  renderManifestFiles,
  scanManifest,
} from "../../manifest/scan.ts";
import { defineRule, finding, type Finding } from "../rule.ts";

const REGENERATE =
  "Run rex manifest to regenerate .rex/manifest.json and AGENTS.md, then commit both.";

export function firstDifferentLine(actual: string, expected: string): number {
  const actualLines = actual.split("\n");
  const expectedLines = expected.split("\n");
  const length = Math.max(actualLines.length, expectedLines.length);
  for (let index = 0; index < length; index += 1) {
    if (actualLines[index] !== expectedLines[index]) {
      return Math.min(index + 1, Math.max(actualLines.length, 1));
    }
  }
  return 1;
}

function isDirectory(candidate: string): boolean {
  try {
    return statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

export const manifestRule = defineRule({
  id: "manifest",
  description:
    "Once rex manifest has created .rex/, reports a missing or stale .rex/manifest.json (error) or AGENTS.md (warning) compared with a fresh build.",
  async check({ app }) {
    if (!isDirectory(path.join(app.root, MANIFEST_DIR))) return [];
    let expected: ReturnType<typeof renderManifestFiles>;
    try {
      expected = renderManifestFiles(await scanManifest(app.root));
    } catch (error) {
      if (!(error instanceof ManifestScanError)) throw error;
      return [
        finding({
          rule: "manifest/load-error",
          file: MANIFEST_FILE,
          message: `the declarations cannot be loaded to build a fresh manifest: ${error.message}`,
          hint: "Fix the declaration error reported above so the manifest can be built, then run rex manifest.",
        }),
      ];
    }

    const findings: Finding[] = [];
    const compare = (
      file: string,
      fresh: string,
      severity: "error" | "warning",
      code: string,
    ): void => {
      const full = path.join(app.root, file);
      if (!existsSync(full)) {
        findings.push(
          finding({
            rule: `manifest/${code}-missing`,
            severity,
            file,
            message: `${file} has not been generated`,
            hint: REGENERATE,
          }),
        );
        return;
      }
      const actual = readFileSync(full, "utf8");
      if (actual === fresh) return;
      findings.push(
        finding({
          rule: `manifest/${code}-stale`,
          severity,
          file,
          line: firstDifferentLine(actual, fresh),
          message: `${file} is stale: it differs from a fresh build of the declarations`,
          hint: REGENERATE,
        }),
      );
    };
    compare(MANIFEST_FILE, expected.manifest, "error", "manifest");
    compare(AGENTS_FILE, expected.agents, "warning", "agents");
    return findings;
  },
});
