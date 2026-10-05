import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import { DEFAULT_RULE_IDS } from "./catalog.ts";
import { defaultRules } from "./rules/index.ts";

describe("checker metadata boundary", () => {
  it("keeps the catalog frozen, unique and identical to registered rule order", () => {
    expect(Object.isFrozen(DEFAULT_RULE_IDS)).toBe(true);
    expect(new Set(DEFAULT_RULE_IDS).size).toBe(DEFAULT_RULE_IDS.length);
    expect(defaultRules.map((rule) => rule.id)).toEqual(DEFAULT_RULE_IDS);
    expect(DEFAULT_RULE_IDS.length).toBeGreaterThan(0);
  });

  it("bundles and executes the actual site metadata without the checker toolchain", async () => {
    const root = fileURLToPath(new URL("../../../../site/", import.meta.url));
    const result = await build({
      root,
      configFile: false,
      logLevel: "silent",
      ssr: { noExternal: true, target: "node" },
      build: {
        ssr: true,
        write: false,
        minify: false,
        rolldownOptions: {
          input: fileURLToPath(
            new URL("../../../../site/app/server/content/meta.ts", import.meta.url),
          ),
          output: { format: "es" },
        },
      },
    });
    const outputs = Array.isArray(result) ? result : [result];
    const chunks = outputs.flatMap((output) =>
      "output" in output ? output.output.filter((item) => item.type === "chunk") : [],
    );
    const entry = chunks.find((chunk) => chunk.isEntry);
    expect(entry).toBeDefined();
    expect(entry!.imports).toEqual([]);
    expect(entry!.dynamicImports).toEqual([]);
    const runtimeModules = chunks.flatMap((chunk) =>
      Object.entries(chunk.modules)
        .filter(([, module]) => module.renderedLength > 0)
        .map(([id]) => id),
    );
    expect(
      runtimeModules.filter((id) =>
        /node_modules\/(?:\.pnpm\/)?(?:typescript|vite|rolldown)(?:@|\/)/.test(id),
      ),
    ).toEqual([]);
    const url = `data:text/javascript;base64,${Buffer.from(entry!.code).toString("base64")}`;
    const execution = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const {readRexMeta}=await import(${JSON.stringify(url)});console.log(JSON.stringify(readRexMeta()));`,
      ],
      { encoding: "utf8", timeout: 10_000 },
    );
    expect(execution.error).toBeUndefined();
    expect(execution.stderr).toBe("");
    expect(execution.status).toBe(0);
    expect(JSON.parse(execution.stdout).checkerRules).toBe(defaultRules.length);
  }, 60_000);
});
