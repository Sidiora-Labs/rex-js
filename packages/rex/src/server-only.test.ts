import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";
import * as serverOnly from "./server-only.ts";
import { REX_SERVER_ONLY } from "./server-only.ts";
import {
  SERVER_ONLY_SPECIFIER,
  boundaryViolation,
  serverOnlyModulePaths,
} from "./vite/boundary.ts";
import { CORE_SPECIFIER } from "./vite/virtual.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("rex/server-only", () => {
  it("exports only the marker", () => {
    expect(Object.keys(serverOnly)).toEqual(["REX_SERVER_ONLY"]);
    expect(REX_SERVER_ONLY).toBe("rex/server-only");
    expectTypeOf(REX_SERVER_ONLY).toEqualTypeOf<"rex/server-only">();
  });

  it("is the specifier the bundler boundary treats as server-only", () => {
    expect(SERVER_ONLY_SPECIFIER).toBe(`${CORE_SPECIFIER}/server-only`);
    expect(SERVER_ONLY_SPECIFIER.endsWith(REX_SERVER_ONLY)).toBe(true);
    const importer = join(here, "app/pages/home/view.tsx");
    const appPath = join(here, "app");
    expect(boundaryViolation(SERVER_ONLY_SPECIFIER, importer, appPath)).toBe("server-only");
    expect(boundaryViolation(`${SERVER_ONLY_SPECIFIER}?v=1`, importer, appPath)).toBe(
      "server-only",
    );
    expect(boundaryViolation(`${CORE_SPECIFIER}/client`, importer, appPath)).toBeNull();
  });

  it("lives beside the core entry where the boundary looks for it", () => {
    const paths = serverOnlyModulePaths(join(here, "index.ts"));
    const marker = join(here, "server-only.ts");
    expect(paths).toContain(marker);
    expect(existsSync(marker)).toBe(true);
    expect(boundaryViolation("./server-only.ts", join(here, "index.ts"), here, paths)).toBe(
      "server-only",
    );
    const packageJson = JSON.parse(readFileSync(join(here, "../package.json"), "utf8")) as {
      readonly exports: Readonly<Record<string, string>>;
    };
    expect(packageJson.exports["./server-only"]).toBe("./src/server-only.ts");
  });
});
