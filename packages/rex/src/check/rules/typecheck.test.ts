import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { discoverApp } from "../engine.ts";
import { diagnosticToFinding, typecheckApp } from "./typecheck.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function project() {
  const root = mkdtempSync(path.join(tmpdir(), "rex-incremental-"));
  roots.push(root);
  mkdirSync(path.join(root, "app/data"), { recursive: true });
  const config = path.join(root, "tsconfig.json");
  const cache = path.join(root, "node_modules/.cache/rex/typecheck.tsbuildinfo");
  const write = (name: string, source: string) => writeFileSync(path.join(root, name), source);
  const configure = (options: ts.CompilerOptions = {}) => {
    writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: {
          strict: true,
          incremental: true,
          tsBuildInfoFile: cache,
          skipLibCheck: true,
          types: [],
          noEmit: false,
          ...options,
        },
        include: ["app"],
      }),
    );
  };
  const check = () => {
    const app = discoverApp(root);
    const read = ts.readConfigFile(config, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, root, undefined, config);
    const full = ts.createProgram({
      rootNames: parsed.fileNames,
      options: { ...parsed.options, noEmit: true },
    });
    const expected = ts
      .getPreEmitDiagnostics(full)
      .map((diagnostic) => diagnosticToFinding(app, diagnostic))
      .filter((finding) => finding !== null);
    const actual = typecheckApp(app);
    expect(actual).toEqual(expected);
    expect(
      readdirSync(path.join(root, "app/data")).every(
        (file) => file.endsWith(".ts") && !file.endsWith(".d.ts"),
      ),
    ).toBe(true);
    return actual;
  };
  configure();
  return { root, cache, write, configure, check };
}

describe("incremental typechecking", { timeout: 60_000 }, () => {
  it("persists state and retains full diagnostics across changed dependencies and file sets", () => {
    const p = project();
    p.write("app/data/value.ts", "export const value = 1;\n");
    p.write(
      "app/data/count.ts",
      'import { value } from "./value"; export const count: number = value;\n',
    );
    expect(p.check()).toEqual([]);
    expect(existsSync(p.cache)).toBe(true);
    expect(p.check()).toEqual([]);
    p.write("app/data/value.ts", 'export const value = "one";\n');
    expect(p.check().map((finding) => finding.rule)).toEqual(["typecheck/ts2322"]);
    expect(p.check().map((finding) => finding.rule)).toEqual(["typecheck/ts2322"]);
    p.write("app/data/value.ts", "export const value = 1;\n");
    expect(p.check()).toEqual([]);
    p.write("app/data/wrong.ts", "export const wrong: boolean = 1;\n");
    expect(p.check().map((finding) => finding.rule)).toEqual(["typecheck/ts2322"]);
    rmSync(path.join(p.root, "app/data/wrong.ts"));
    expect(p.check()).toEqual([]);
    rmSync(path.join(p.root, "app/data/value.ts"));
    expect(p.check().map((finding) => finding.rule)).toEqual(["typecheck/ts2307"]);
  });

  it("invalidates changed options and handles absent or corrupt build state", () => {
    const p = project();
    p.write("app/data/value.ts", "export function identity(value) { return value; }\n");
    expect(p.check().map((finding) => finding.rule)).toEqual(["typecheck/ts7006"]);
    p.configure({ strict: false });
    expect(p.check()).toEqual([]);
    p.configure();
    expect(p.check().map((finding) => finding.rule)).toEqual(["typecheck/ts7006"]);
    writeFileSync(p.cache, "interrupted write");
    expect(p.check().map((finding) => finding.rule)).toEqual(["typecheck/ts7006"]);
    rmSync(p.cache);
    expect(p.check().map((finding) => finding.rule)).toEqual(["typecheck/ts7006"]);
    p.write("app/data/value.ts", "export const = ;\n");
    expect(p.check().length).toBeGreaterThan(0);
    expect(p.check().length).toBeGreaterThan(0);
  });
});
