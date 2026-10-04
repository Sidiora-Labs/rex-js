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
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
import { afterAll, describe, expect, it } from "vitest";
import { runCheck } from "../check/index.ts";
import { rexPrettierConfig } from "../prettier.ts";
import {
  DESIGNX_BASE,
  DESIGNX_CONFIG_FILE,
  DESIGNX_STYLESHEET_HREF,
  DESIGNX_THEME_FILE,
  DESIGNX_UI_DIR,
  TAILWIND_PACKAGES,
  parseDependency,
  registryName,
  rewriteImports,
} from "./designx.ts";
import { EXIT_OK, EXIT_USAGE, run, type RexCliIO } from "./index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const demoRoot = join(packageRoot, "..", "..", "examples", "demo");
const DESIGNX_TEST_TIMEOUT_MS = 240_000;

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "rex-designx-"));
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

interface GeneratedPackage {
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function sourceOf(name: string): string {
  if (name === "@sidioralabs/rex") return packageRoot;
  for (const base of [packageRoot, demoRoot]) {
    const candidate = join(base, "node_modules", name);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`${name} is installed neither for the rex package nor for the demo`);
}

function linkDependencies(root: string): void {
  const manifest = readJson<GeneratedPackage>(join(root, "package.json"));
  for (const name of [
    ...Object.keys(manifest.dependencies),
    ...Object.keys(manifest.devDependencies),
  ]) {
    const destination = join(root, "node_modules", name);
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(realpathSync(sourceOf(name)), destination, "dir");
  }
}

describe("DesignX registry helpers", () => {
  it("maps registry dependencies and npm specs", () => {
    expect(registryName("@dx/utils")).toBe("utils");
    expect(registryName("dialog")).toBe("dialog");
    expect(() => registryName("@other/thing")).toThrow(/not a DesignX item/);
    expect(parseDependency("@base-ui/react@^1.8.0")).toEqual(["@base-ui/react", "^1.8.0"]);
    expect(parseDependency("cmdk@^1.1.1")).toEqual(["cmdk", "^1.1.1"]);
    expect(parseDependency("tw-animate-css")).toEqual(["tw-animate-css", "latest"]);
  });

  it("rewrites registry aliases to relative imports and refuses unknown ones", () => {
    const aliases = new Map([
      ["@/lib/utils", `${DESIGNX_UI_DIR}/utils.ts`],
      ["@/components/ui/dialog", `${DESIGNX_UI_DIR}/dialog.tsx`],
    ]);
    const source = [
      'import { cn } from "@/lib/utils";',
      'import { Dialog } from "@/components/ui/dialog";',
      "",
    ].join("\n");
    expect(rewriteImports(source, `${DESIGNX_UI_DIR}/command.tsx`, aliases)).toBe(
      ['import { cn } from "./utils.ts";', 'import { Dialog } from "./dialog.tsx";', ""].join("\n"),
    );
    expect(() =>
      rewriteImports('import x from "@/hooks/missing";', `${DESIGNX_UI_DIR}/a.tsx`, aliases),
    ).toThrow(/no fetched DesignX item provides/);
  });
});

describe("rex new --ui", { timeout: DESIGNX_TEST_TIMEOUT_MS }, () => {
  it("installs the DesignX theme and base set from the registry into an app that passes rex check", async () => {
    const cwd = tempDir();
    const captured = captureIO(cwd);
    expect(await run(["new", "dx-app", "--no-install"], captured.io)).toBe(EXIT_OK);
    expect(captured.err()).toBe("");
    const root = join(cwd, "dx-app");

    for (const name of DESIGNX_BASE) {
      expect(existsSync(join(root, DESIGNX_UI_DIR, `${name}.tsx`)), name).toBe(true);
      expect(captured.out()).toContain(`wrote dx-app/${DESIGNX_UI_DIR}/${name}.tsx\n`);
    }
    expect(existsSync(join(root, DESIGNX_UI_DIR, "utils.ts"))).toBe(true);
    for (const file of [
      ...DESIGNX_BASE.map((name) => `${DESIGNX_UI_DIR}/${name}.tsx`),
      `${DESIGNX_UI_DIR}/utils.ts`,
      DESIGNX_THEME_FILE,
    ]) {
      const written = readFileSync(join(root, file), "utf8");
      expect(
        await format(written, {
          ...rexPrettierConfig,
          filepath: join(root, file),
        }),
        file,
      ).toBe(written);
    }
    const theme = readFileSync(join(root, DESIGNX_THEME_FILE), "utf8");
    expect(theme.startsWith('@import "tailwindcss";\n@import "tw-animate-css";\n')).toBe(true);
    expect(theme).toContain("@theme inline");

    const dx = readJson<{ items: string[]; theme: string; ui: string }>(
      join(root, DESIGNX_CONFIG_FILE),
    );
    expect(dx.theme).toBe(DESIGNX_THEME_FILE);
    expect(dx.ui).toBe(DESIGNX_UI_DIR);
    expect(dx.items).toEqual(expect.arrayContaining(["theme", "utils", ...DESIGNX_BASE]));

    const command = readFileSync(join(root, DESIGNX_UI_DIR, "command.tsx"), "utf8");
    expect(command).not.toContain('"@/');
    expect(command).toContain('from "./dialog.tsx"');

    const manifest = readJson<GeneratedPackage>(join(root, "package.json"));
    for (const name of [...TAILWIND_PACKAGES, "@base-ui/react", "class-variance-authority"]) {
      expect(manifest.dependencies[name], name).toBeDefined();
    }
    expect(readFileSync(join(root, "index.html"), "utf8")).toContain(
      `<link rel="stylesheet" href="${DESIGNX_STYLESHEET_HREF}" />`,
    );
    expect(readFileSync(join(root, "rex.config.ts"), "utf8")).toContain('ui: "designx",');
    expect(readFileSync(join(root, "app/components/Button.tsx"), "utf8")).toContain(
      'import { Button as DesignxButton } from "./ui/button.tsx";',
    );

    linkDependencies(root);
    const result = await runCheck(root);
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("keeps the token components with --ui none and rejects an unknown kit", async () => {
    const cwd = tempDir();
    const none = captureIO(cwd);
    expect(await run(["new", "plain-app", "--ui", "none", "--no-install"], none.io)).toBe(EXIT_OK);
    const root = join(cwd, "plain-app");
    expect(existsSync(join(root, DESIGNX_UI_DIR))).toBe(false);
    expect(existsSync(join(root, DESIGNX_CONFIG_FILE))).toBe(false);
    expect(existsSync(join(root, DESIGNX_THEME_FILE))).toBe(false);
    expect(readFileSync(join(root, "app/components/Button.tsx"), "utf8")).toContain(
      '<button type="button" {...props} />',
    );
    const manifest = readJson<GeneratedPackage>(join(root, "package.json"));
    expect(manifest.dependencies["@tailwindcss/vite"]).toBeUndefined();

    const unknown = captureIO(cwd);
    expect(await run(["new", "odd-app", "--ui", "bootstrap"], unknown.io)).toBe(EXIT_USAGE);
    expect(unknown.err()).toContain("--ui must be one of designx, none");
    expect(existsSync(join(cwd, "odd-app"))).toBe(false);
  });
});
