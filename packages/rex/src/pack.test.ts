import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REX_ERROR_AREAS, REX_ERROR_CATALOG, REX_ERROR_DOCS } from "./errors.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const PACK_TEST_TIMEOUT_MS = 600_000;
const tsc = createRequire(join(packageRoot, "package.json")).resolve("typescript/bin/tsc");

interface PublishedExport {
  readonly types?: string;
  readonly import?: string;
}

interface PackedManifest {
  readonly name: string;
  readonly exports: Readonly<Record<string, PublishedExport | string>>;
}

const CONSUMER = `import {
  REX_ERROR_AREAS,
  REX_ERROR_CATALOG,
  REX_ERROR_DOCS,
  errorArea,
  errorDocs,
  errorHint,
  formatRexError,
  RexError,
  type RexErrorArea,
  type RexErrorCode,
} from "@sidioralabs/rex/errors";

const code: RexErrorCode = "REX451";
const area: RexErrorArea = errorArea(code);
const error = new RexError(code, "env.server.DATABASE_URL is missing");
const lines: string[] = [
  REX_ERROR_CATALOG[code],
  REX_ERROR_DOCS[code].hint,
  REX_ERROR_AREAS[area].title,
  errorDocs(code),
  errorHint(error),
  formatRexError(error),
];
export default lines;
`;

const RESOLVE = `const errors = await import("@sidioralabs/rex/errors");
const error = new errors.RexError("REX335", "page render failed");
process.stdout.write(
  JSON.stringify({
    resolved: import.meta.resolve("@sidioralabs/rex/errors"),
    exports: Object.keys(errors).sort(),
    codes: Object.keys(errors.REX_ERROR_CATALOG).length,
    hint: errors.errorHint(error),
    area: errors.errorArea("REX335"),
    docs: errors.errorDocs("REX335"),
    formatted: errors.formatRexError(error),
  }),
);
`;

describe(
  "the @sidioralabs/rex/errors entry in the packed tarball",
  { timeout: PACK_TEST_TIMEOUT_MS },
  () => {
    let work: string;
    let installed: string;
    let consumer: string;

    beforeAll(() => {
      work = mkdtempSync(join(tmpdir(), "rex-pack-errors-"));
      execFileSync("pnpm", ["run", "build"], { cwd: packageRoot, stdio: "pipe" });
      const destination = join(work, "pack");
      mkdirSync(destination);
      execFileSync("pnpm", ["pack", "--pack-destination", destination], {
        cwd: packageRoot,
        stdio: "pipe",
      });
      const tarballs = readdirSync(destination).filter((file) => file.endsWith(".tgz"));
      expect(tarballs).toHaveLength(1);
      consumer = join(work, "consumer");
      installed = join(consumer, "node_modules", "@sidioralabs", "rex");
      mkdirSync(installed, { recursive: true });
      execFileSync(
        "tar",
        ["-xzf", join(destination, tarballs[0] as string), "-C", installed, "--strip-components=1"],
        { stdio: "pipe" },
      );
      writeFileSync(
        join(consumer, "package.json"),
        JSON.stringify({ name: "errors-consumer", private: true, type: "module" }),
      );
    }, PACK_TEST_TIMEOUT_MS);

    afterAll(() => {
      if (work !== undefined) rmSync(work, { recursive: true, force: true });
    });

    it("publishes ./errors with its types condition first", () => {
      const manifest = JSON.parse(
        readFileSync(join(installed, "package.json"), "utf8"),
      ) as PackedManifest;
      expect(manifest.name).toBe("@sidioralabs/rex");
      const entry = manifest.exports["./errors"];
      expect(entry).toEqual({ types: "./dist/errors.d.ts", import: "./dist/errors.js" });
      expect(Object.keys(entry as PublishedExport)[0]).toBe("types");
      const declarations = readFileSync(join(installed, "dist", "errors.d.ts"), "utf8");
      for (const name of [
        "REX_ERROR_CATALOG",
        "REX_ERROR_DOCS",
        "REX_ERROR_AREAS",
        "errorArea",
        "errorHint",
        "errorDocs",
        "formatRexError",
      ]) {
        expect(declarations, name).toContain(name);
      }
    });

    it("resolves from a consumer without the workspace and carries the catalog, hints and areas", () => {
      const output = execFileSync(process.execPath, ["--input-type=module", "-e", RESOLVE], {
        cwd: consumer,
        encoding: "utf8",
      });
      const result = JSON.parse(output) as {
        readonly resolved: string;
        readonly exports: readonly string[];
        readonly codes: number;
        readonly hint: string;
        readonly area: string;
        readonly docs: string;
        readonly formatted: string;
      };
      expect(fileURLToPath(result.resolved)).toBe(join(installed, "dist", "errors.js"));
      expect(result.exports).toEqual(
        expect.arrayContaining([
          "REX_ERROR_AREAS",
          "REX_ERROR_CATALOG",
          "REX_ERROR_DOCS",
          "RexError",
          "errorArea",
          "errorDocs",
          "errorHint",
          "formatRexError",
        ]),
      );
      expect(result.codes).toBe(Object.keys(REX_ERROR_CATALOG).length);
      expect(result.hint).toBe(REX_ERROR_DOCS.REX335.hint);
      expect(result.area).toBe("runtime");
      expect(REX_ERROR_AREAS.runtime.prefix).toBe("REX3");
      expect(result.docs).toBe("https://rex.sidioralabs.com/errors/REX335");
      expect(result.formatted.split("\n")[0]).toBe("REX335 page render failed");
    });

    it("type-checks a consumer that imports the entry under NodeNext resolution", () => {
      writeFileSync(join(consumer, "index.ts"), CONSUMER);
      writeFileSync(
        join(consumer, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            types: [],
          },
          files: ["index.ts"],
        }),
      );
      let output = "";
      try {
        output = execFileSync(process.execPath, [tsc, "-p", "tsconfig.json"], {
          cwd: consumer,
          encoding: "utf8",
        });
      } catch (error) {
        const failed = error as { stdout?: string; stderr?: string };
        throw new Error(`tsc failed:\n${failed.stdout ?? ""}${failed.stderr ?? ""}`);
      }
      expect(output).toBe("");
    });
  },
);
