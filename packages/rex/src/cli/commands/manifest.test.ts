import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AGENTS_FILE,
  MANIFEST_DIR,
  MANIFEST_FILE,
  ManifestScanError,
  renderManifestFiles,
} from "../../manifest/scan.ts";
import type { Manifest } from "../../manifest/types.ts";
import { RexCommand } from "../args.ts";
import { EXIT_FAILURE, EXIT_OK, run, type RexCliIO } from "../index.ts";
import { register, writeAppManifest } from "./manifest.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..", "..");
const APP_NAME = "manifest-app";
const MANIFEST_TEST_TIMEOUT_MS = 240_000;

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "rex-manifest-command-"));
  temporary.push(dir);
  return dir;
}

function captureIO(cwd: string) {
  const out: string[] = [];
  const err: string[] = [];
  const io: RexCliIO = {
    cwd,
    out: (text) => {
      out.push(text);
    },
    err: (text) => {
      err.push(text);
    },
  };
  return { io, out: () => out.join(""), err: () => err.join("") };
}

function installDependencies(root: string): void {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    readonly dependencies: Readonly<Record<string, string>>;
    readonly devDependencies: Readonly<Record<string, string>>;
  };
  for (const name of [
    ...Object.keys(manifest.dependencies),
    ...Object.keys(manifest.devDependencies),
  ]) {
    const source =
      name === "@sidioralabs/rex" ? packageRoot : join(packageRoot, "node_modules", name);
    expect(existsSync(source), `${name} is resolvable from the rex package`).toBe(true);
    const destination = join(root, "node_modules", name);
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(realpathSync(source), destination, "dir");
  }
}

describe("rex manifest command", { timeout: MANIFEST_TEST_TIMEOUT_MS }, () => {
  let root: string;

  beforeAll(async () => {
    const cwd = tempDir();
    expect(await run(["new", APP_NAME, "--ui", "none"], captureIO(cwd).io)).toBe(EXIT_OK);
    root = join(cwd, APP_NAME);
    installDependencies(root);
  }, MANIFEST_TEST_TIMEOUT_MS);

  it("writeAppManifest builds the manifest from the app and writes both files", async () => {
    expect(existsSync(join(root, MANIFEST_DIR))).toBe(false);
    const manifest = await writeAppManifest(root);
    expect(manifest.app).toEqual({ name: APP_NAME });
    expect(manifest.pages.map((page) => [page.id, page.route, page.regions])).toEqual([
      ["home", "/", ["welcome"]],
    ]);
    expect(manifest.actions.map((action) => action.id)).toEqual(["ping"]);
    expect(manifest.entities.map((entity) => entity.id)).toEqual(["note"]);
    expect(manifest.policies.map((policy) => policy.id)).toEqual(["viewer"]);

    const files = renderManifestFiles(manifest);
    expect(readFileSync(join(root, MANIFEST_FILE), "utf8")).toBe(files.manifest);
    expect(readFileSync(join(root, AGENTS_FILE), "utf8")).toBe(files.agents);
    expect(JSON.parse(readFileSync(join(root, MANIFEST_FILE), "utf8")) as Manifest).toEqual(
      manifest,
    );
  });

  it("writeAppManifest rejects a root without an app directory as a manifest scan error", async () => {
    const empty = tempDir();
    await expect(writeAppManifest(empty)).rejects.toThrow(ManifestScanError);
    await expect(writeAppManifest(empty)).rejects.toMatchObject({
      code: "REX500",
      appRoot: resolve(empty),
      message: `REX500 manifest scan of ${resolve(empty)} failed: no app directory at ${join(resolve(empty), "app")}`,
    });
    expect(existsSync(join(empty, MANIFEST_DIR))).toBe(false);
    expect(existsSync(join(empty, AGENTS_FILE))).toBe(false);
  });

  it("registers rex manifest without options and reports what it wrote or why it failed", async () => {
    const program = new RexCommand("rex");
    register(program, captureIO(root).io);
    const [listing] = program.listing().commands;
    expect(listing).toMatchObject({
      name: "manifest",
      path: "rex manifest",
      arguments: [],
      options: [],
      description: `write ${MANIFEST_FILE} and ${AGENTS_FILE} from the app declarations`,
    });

    const written = captureIO(root);
    expect(await run(["manifest"], written.io)).toBe(EXIT_OK);
    expect(written.err()).toBe("");
    expect(written.out()).toBe(
      `wrote ${MANIFEST_FILE} (1 pages, 1 actions)\nwrote ${AGENTS_FILE}\n`,
    );

    const empty = tempDir();
    const failed = captureIO(empty);
    expect(await run(["manifest"], failed.io)).toBe(EXIT_FAILURE);
    expect(failed.out()).toBe("");
    expect(failed.err()).toBe(
      `rex manifest: REX500 manifest scan of ${resolve(empty)} failed: no app directory at ${join(resolve(empty), "app")}\n`,
    );
  });
});
