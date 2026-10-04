import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { discoverApp, runRules } from "../check/engine.ts";
import { firstDifferentLine, manifestRule } from "../check/rules/manifest.ts";
import { AGENTS_MD_BANNER, FOLDER_CONVENTION, renderAgentsMd } from "./agents-md.ts";
import { stableStringify } from "./build.ts";
import {
  AGENTS_FILE,
  MANIFEST_FILE,
  ManifestScanError,
  declarationFiles,
  loadRegistry,
  scanManifest,
  writeManifest,
} from "./scan.ts";
import type { Manifest } from "./types.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "../..");
const fixture = path.join(here, "fixtures/app");
const temporary: string[] = [];
const SCAN_TEST_TIMEOUT_MS = 60_000;

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function copyApp(): string {
  const root = mkdtempSync(path.join(tmpdir(), "rex-scan-"));
  temporary.push(root);
  cpSync(fixture, root, { recursive: true });
  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "fixture-app", private: true, type: "module" })}\n`,
  );
  mkdirSync(path.join(root, "node_modules/@sidioralabs"), { recursive: true });
  symlinkSync(packageRoot, path.join(root, "node_modules/@sidioralabs/rex"), "dir");
  return root;
}

const read = (root: string, file: string) => readFileSync(path.join(root, file), "utf8");

describe("loadRegistry", { timeout: SCAN_TEST_TIMEOUT_MS }, () => {
  it("lists declaration files in a deterministic order", () => {
    const root = copyApp();
    expect(declarationFiles(root).map((file) => path.relative(root, file))).toEqual([
      "app/entities/account.ts",
      "app/entities/token.ts",
      "app/policies/wallet.ts",
      "app/actions/pick-token.ts",
      "app/actions/send.ts",
      "app/pages/portfolio/page.ts",
      "app/pages/send/page.ts",
    ]);
    expect(() => declarationFiles(path.join(root, "missing"))).toThrow(ManifestScanError);
  });

  it("imports every declaration through tsx and returns the frozen registry", async () => {
    const snapshot = await loadRegistry(copyApp());
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot.entities.map((entry) => entry.id)).toEqual(["account", "token"]);
    expect(snapshot.actions.map((entry) => entry.id)).toEqual(["pick-token", "send"]);
    expect(snapshot.pages.map((entry) => entry.id)).toEqual(["portfolio", "send"]);
    expect(snapshot.policies.map((entry) => entry.id)).toEqual(["wallet"]);
    expect(snapshot.flows).toEqual([]);
    expect(snapshot.get("page", "send").actions.map((entry) => entry.id)).toEqual([
      "send",
      "pick-token",
    ]);
  });
});

describe("writeManifest", { timeout: SCAN_TEST_TIMEOUT_MS }, () => {
  it("writes byte-identical manifest and AGENTS.md on repeated runs", async () => {
    const root = copyApp();
    const first = await writeManifest(root);
    const manifestBytes = read(root, MANIFEST_FILE);
    const agentsBytes = read(root, AGENTS_FILE);
    const second = await writeManifest(root);
    expect(read(root, MANIFEST_FILE)).toBe(manifestBytes);
    expect(read(root, AGENTS_FILE)).toBe(agentsBytes);
    expect(second.files).toEqual(first.files);

    const other = copyApp();
    await writeManifest(other);
    expect(read(other, MANIFEST_FILE)).toBe(manifestBytes);
    expect(read(other, AGENTS_FILE)).toBe(agentsBytes);

    expect(manifestBytes).toBe(`${stableStringify(first.manifest)}\n`);
    const parsed = JSON.parse(manifestBytes) as Manifest;
    expect(parsed.app.name).toBe("fixture-app");
    expect(parsed.pages.map((entry) => [entry.id, entry.route])).toEqual([
      ["portfolio", "/"],
      ["send", "/send/:account"],
    ]);
    expect(parsed.actions.map((entry) => [entry.id, entry.effect])).toEqual([
      ["pick-token", "reversible"],
      ["send", "irreversible"],
    ]);
    expect(parsed.pages[1]?.actions).toEqual(["pick-token", "send"]);
    expect(parsed).toEqual(await scanManifest(root));

    expect(agentsBytes).toBe(renderAgentsMd(first.manifest));
    expect(agentsBytes.startsWith(AGENTS_MD_BANNER)).toBe(true);
    expect(agentsBytes).toContain("# fixture-app: agent guide");
    expect(agentsBytes).toContain(
      "| `send` | `/send/:account` | Send | wallet.can(send) | form, confirm | TokenSelectorSheet (both) | pick-token, send | 9 |",
    );
    expect(agentsBytes).toContain(
      "| `send` | Send | irreversible | `mod+enter` | wallet.requires(unlocked, send) | tokens |",
    );
    for (const line of FOLDER_CONVENTION) expect(agentsBytes).toContain(`- ${line}`);
  });

  it("reports a declaration error from the child process", async () => {
    const root = copyApp();
    writeFileSync(
      path.join(root, "app/actions/duplicate.ts"),
      read(root, "app/actions/send.ts").replace("export const send", "export const again"),
    );
    await expect(scanManifest(root)).rejects.toThrow(/send.*already registered/);
  });
});

describe("manifest freshness rule", { timeout: SCAN_TEST_TIMEOUT_MS }, () => {
  it("stays silent until rex manifest has created .rex", async () => {
    const result = await runRules(discoverApp(copyApp()), [manifestRule]);
    expect(result.findings).toEqual([]);
  });

  it("passes on fresh output and reports staleness after a declaration change", async () => {
    const root = copyApp();
    await writeManifest(root);
    const fresh = await runRules(discoverApp(root), [manifestRule]);
    expect(fresh.findings).toEqual([]);
    expect(fresh.exitCode).toBe(0);

    const actionFile = path.join(root, "app/actions/pick-token.ts");
    writeFileSync(
      actionFile,
      readFileSync(actionFile, "utf8").replace('label: "Pick token"', 'label: "Choose token"'),
    );
    const stale = await runRules(discoverApp(root), [manifestRule]);
    expect(stale.findings.map((entry) => [entry.file, entry.rule, entry.severity])).toEqual([
      [MANIFEST_FILE, "manifest/manifest-stale", "error"],
      [AGENTS_FILE, "manifest/agents-stale", "warning"],
    ]);
    expect(stale.exitCode).toBe(1);
    const manifestFinding = stale.findings.find((entry) => entry.file === MANIFEST_FILE);
    expect(manifestFinding?.message).toBe(
      ".rex/manifest.json is stale: it differs from a fresh build of the declarations",
    );
    expect(manifestFinding?.hint).toContain("rex manifest");
    const staleLine = read(root, MANIFEST_FILE).split("\n")[(manifestFinding?.line ?? 1) - 1];
    expect(staleLine).toContain("Pick token");

    await writeManifest(root);
    expect((await runRules(discoverApp(root), [manifestRule])).findings).toEqual([]);

    unlinkSync(path.join(root, AGENTS_FILE));
    unlinkSync(path.join(root, MANIFEST_FILE));
    const missing = await runRules(discoverApp(root), [manifestRule]);
    expect(missing.findings.map((entry) => [entry.rule, entry.severity])).toEqual([
      ["manifest/manifest-missing", "error"],
      ["manifest/agents-missing", "warning"],
    ]);
  });

  it("reports a load error when the declarations cannot be built", async () => {
    const root = copyApp();
    await writeManifest(root);
    writeFileSync(path.join(root, "app/actions/broken.ts"), "export const broken = ;\n");
    const result = await runRules(discoverApp(root), [manifestRule]);
    expect(result.findings.map((entry) => [entry.file, entry.rule])).toEqual([
      [MANIFEST_FILE, "manifest/load-error"],
    ]);
    expect(result.findings[0]?.message).toContain("broken.ts");
  });

  it("locates the first differing line", () => {
    expect(firstDifferentLine("a\nb\nc", "a\nb\nc")).toBe(1);
    expect(firstDifferentLine("a\nx\nc", "a\nb\nc")).toBe(2);
    expect(firstDifferentLine("a\nb", "a\nb\nc")).toBe(2);
  });
});
