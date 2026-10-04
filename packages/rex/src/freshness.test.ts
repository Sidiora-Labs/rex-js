import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import type { CommandListing } from "./cli/args.ts";
import { baseAppPlan } from "./cli/commands/new.ts";
import { commandListing } from "./cli/index.ts";
import { REX_VERSION } from "./index.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const script = join(repoRoot, "tools", "freshness.mjs");

interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly exports: Readonly<Record<string, string>>;
}

interface TypedocConfig {
  readonly entryPoints: readonly string[];
}

interface ExportsInput {
  readonly root: string;
  readonly manifest: PackageManifest;
  readonly reference: string;
  readonly apiIndex: string;
  readonly typedoc: TypedocConfig;
}

interface NodeFloorDocument {
  readonly file: string;
  readonly text: string;
  readonly required: boolean;
}

interface VersionsInput {
  readonly packageVersion: string;
  readonly rexVersion: string;
  readonly newAppRex: string;
  readonly changelog: string;
}

interface FreshnessTools {
  checkExports(input: ExportsInput): string[];
  checkCliDoc(listing: CommandListing, file: string, markdown: string): string[];
  checkNodeFloor(engines: string, documents: readonly NodeFloorDocument[]): string[];
  checkVersions(input: VersionsInput): string[];
}

const tools = (await import(pathToFileURL(script).href)) as FreshnessTools;

const read = (file: string): string => readFileSync(join(repoRoot, file), "utf8");
const readJson = <T>(file: string): T => JSON.parse(read(file)) as T;

const FRESHNESS_TIMEOUT_MS = 600_000;

describe("tools/freshness.mjs", () => {
  it(
    "passes on the repository",
    () => {
      const result = spawnSync(process.execPath, [script, "--check"], {
        cwd: repoRoot,
        encoding: "utf8",
      });
      expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: "" });
      expect(result.stdout).toContain("freshness: the docs match the code");
    },
    FRESHNESS_TIMEOUT_MS,
  );

  it("refuses an unknown check name with exit 2", () => {
    const result = spawnSync(process.execPath, [script, "--check", "--skip", "spelling"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("unknown check spelling");
  });

  it("fails when a package export has no reference section, API page or source file", () => {
    const input: ExportsInput = {
      root: repoRoot,
      manifest: readJson<PackageManifest>("packages/rex/package.json"),
      reference: read("docs/reference.md"),
      apiIndex: read("docs/api/README.md"),
      typedoc: readJson<TypedocConfig>("typedoc.json"),
    };
    expect(tools.checkExports(input)).toEqual([]);

    expect(
      tools.checkExports({
        ...input,
        reference: input.reference.replace("### `@sidioralabs/rex/designx`", "### designx"),
      }),
    ).toEqual([
      'export "./designx" (@sidioralabs/rex/designx) has no section in docs/reference.md',
    ]);

    expect(
      tools.checkExports({
        ...input,
        apiIndex: input.apiIndex
          .split("\n")
          .filter((line) => !line.includes("[@sidioralabs/rex/client/media]"))
          .join("\n"),
      }),
    ).toEqual([
      'export "./client/media" (@sidioralabs/rex/client/media) has no page listed in docs/api/README.md',
    ]);

    const ghost = tools.checkExports({
      ...input,
      manifest: {
        ...input.manifest,
        exports: { ...input.manifest.exports, "./ghost": "./src/ghost.ts" },
      },
    });
    expect(ghost).toContain(
      'export "./ghost" (@sidioralabs/rex/ghost) points at packages/rex/src/ghost.ts, which does not exist',
    );
    expect(ghost).toContain(
      'export "./ghost" (@sidioralabs/rex/ghost) has no section in docs/reference.md',
    );
    expect(ghost).toContain(
      'export "./ghost" (@sidioralabs/rex/ghost) has no page listed in docs/api/README.md',
    );
    expect(ghost.some((problem) => problem.startsWith("typedoc.json entryPoints differ"))).toBe(
      true,
    );
  });

  it(
    "fails when a CLI command or flag differs between the CLI and docs/cli.md",
    async () => {
      const listing = await commandListing();
      const doc = read("docs/cli.md");
      expect(tools.checkCliDoc(listing, "docs/cli.md", doc)).toEqual([]);

      expect(
        tools.checkCliDoc(
          listing,
          "docs/cli.md",
          doc
            .replace("rex check [--json] [--runtime]", "rex check [--json]")
            .replace("`rex check --runtime: <message>`", "`rex check: <message>`"),
        ),
      ).toEqual(['docs/cli.md does not document --runtime of "rex check"']);

      expect(
        tools.checkCliDoc(
          listing,
          "docs/cli.md",
          doc
            .replace(/^## rex migrate[\s\S]*$/m, "")
            .replaceAll("`rex migrate`", "the migrate command"),
        ),
      ).toEqual(['docs/cli.md does not document "rex migrate"']);

      const drifted = `${doc}\n\`\`\`\nrex build --frobnicate\nrex deploy --now\npnpm exec rex make widget\n\`\`\`\n`;
      const lines = drifted.split("\n");
      const at = (text: string): number => lines.indexOf(text) + 1;
      expect(tools.checkCliDoc(listing, "docs/cli.md", drifted)).toEqual([
        `docs/cli.md:${at("rex build --frobnicate")} documents --frobnicate for "rex build", which the CLI does not declare`,
        `docs/cli.md:${at("rex deploy --now")} documents "rex deploy", which the CLI does not register`,
        `docs/cli.md:${at("pnpm exec rex make widget")} documents "rex make widget", which the CLI does not register`,
      ]);

      expect(
        tools
          .checkCliDoc(
            listing,
            "notes.md",
            "Run `rex --help --json`; it prints `rex: serving <url>` and `rex build: wrote dist/client/`.\n",
          )
          .filter((problem) => !problem.startsWith("notes.md does not document")),
      ).toEqual([]);
    },
    FRESHNESS_TIMEOUT_MS,
  );

  it("fails when a quoted Node floor disagrees with package.json engines", () => {
    const engines = readJson<{ engines: { node: string } }>("package.json").engines.node;
    expect(
      tools.checkNodeFloor(engines, [
        { file: "README.md", text: read("README.md"), required: true },
        { file: "docs/development.md", text: read("docs/development.md"), required: true },
        { file: "CONTRIBUTING.md", text: read("CONTRIBUTING.md"), required: false },
      ]),
    ).toEqual([]);

    const readme = "Rex requires Node 22 or later and pnpm.\n";
    expect(
      tools.checkNodeFloor(">=22", [{ file: "README.md", text: readme, required: true }]),
    ).toEqual([]);
    expect(
      tools.checkNodeFloor(">=22.12", [{ file: "README.md", text: readme, required: true }]),
    ).toEqual(['README.md:1 quotes Node 22; package.json engines.node is ">=22.12" (Node 22.12)']);
    expect(
      tools.checkNodeFloor("^22.19.0 || ^24.11.0 || >=26.0.0", [
        {
          file: "docs/development.md",
          text: "Node 22.19+, 24.11+ or 26+ is required.\n",
          required: true,
        },
      ]),
    ).toEqual([]);
    expect(
      tools.checkNodeFloor(">=22", [
        { file: "README.md", text: "Install pnpm.\n", required: true },
        { file: "CONTRIBUTING.md", text: "Run the tests.\n", required: false },
      ]),
    ).toEqual(["README.md does not quote the Node floor (Node 22 or later)"]);
  });

  it("fails when REX_VERSION, the rex new template or the CHANGELOG head disagree", () => {
    const packageVersion = readJson<PackageManifest>("packages/rex/package.json").version;
    const plan = baseAppPlan("freshness");
    const packageFile = plan.find((entry) => entry.path === "package.json");
    if (packageFile === undefined || packageFile.kind !== "file") {
      throw new Error("rex new writes no package.json");
    }
    const newAppRex = (JSON.parse(packageFile.content) as { dependencies: Record<string, string> })
      .dependencies["@sidioralabs/rex"] as string;
    const input: VersionsInput = {
      packageVersion,
      rexVersion: REX_VERSION,
      newAppRex,
      changelog: read("CHANGELOG.md"),
    };
    expect(tools.checkVersions(input)).toEqual([]);

    expect(
      tools.checkVersions({
        ...input,
        changelog: `# Changelog\n\n## ${REX_VERSION} (2026-10-04)\n`,
      }),
    ).toEqual([]);
    expect(
      tools.checkVersions({ ...input, changelog: "# Changelog\n\n## 9.9.9 (unreleased)\n" }),
    ).toEqual([]);
    for (const head of [`[v${REX_VERSION}] - 2026-10-04`, `[${REX_VERSION}] - 2026-10-04`]) {
      expect(tools.checkVersions({ ...input, changelog: `# Changelog\n\n## ${head}\n` })).toEqual(
        [],
      );
    }
    expect(
      tools.checkVersions({ ...input, changelog: "# Changelog\n\n## 0.0.9 (2020-01-01)\n" }),
    ).toEqual([
      `CHANGELOG.md starts with "## 0.0.9 (2020-01-01)"; expected ${REX_VERSION} or an unreleased entry`,
    ]);
    expect(tools.checkVersions({ ...input, newAppRex: "^0.0.1" })).toEqual([
      `rex new writes @sidioralabs/rex "^0.0.1"; REX_VERSION is ${REX_VERSION}`,
    ]);
    expect(tools.checkVersions({ ...input, packageVersion: "9.9.9" })).toEqual([
      `REX_VERSION is ${REX_VERSION}; packages/rex/package.json version is 9.9.9`,
    ]);
  });
});
