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
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { runCheck } from "../check/index.ts";
import { rexPrettierConfig } from "../prettier.ts";
import {
  DESIGNX_ITEMS,
  DESIGNX_PROVIDED,
  DESIGNX_STANDARD,
  type DesignxItemName,
} from "../designx/index.ts";
import {
  DESIGNX_BASE,
  DESIGNX_CONFIG_FILE,
  DESIGNX_DATA_TABLE,
  DESIGNX_DEPENDENCY_VERSIONS,
  DESIGNX_LOCK,
  DESIGNX_MENU_GROUP,
  DESIGNX_REGISTRY,
  DESIGNX_STANDARD_SET,
  DESIGNX_STYLESHEET_HREF,
  DESIGNX_THEME_FILE,
  DESIGNX_UI_DIR,
  DesignxError,
  TAILWIND_PACKAGES,
  designxFiles,
  designxItemUrl,
  designxSha256,
  fetchDesignxItem,
  groupDataTableMenu,
  parseDependency,
  parseDesignxItem,
  providedDesignxNames,
  registryName,
  resolveDesignxItems,
  rewriteImports,
  useScreenTemplate,
} from "./designx.ts";
import { newApp } from "./commands/new.ts";
import {
  serveDesignxRegistry,
  unreachableDesignxRegistry,
  type DesignxRegistryFixture,
} from "./fixtures/designx-registry/server.ts";
import { EXIT_OK, EXIT_USAGE, run, type RexCliIO } from "./index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const demoRoot = join(packageRoot, "..", "..", "examples", "demo");
const DESIGNX_TEST_TIMEOUT_MS = 240_000;

const temporary: string[] = [];
const registries: DesignxRegistryFixture[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

afterEach(async () => {
  await Promise.all(registries.splice(0).map((registry) => registry.close()));
});

async function serve(
  answers?: Parameters<typeof serveDesignxRegistry>[0],
): Promise<DesignxRegistryFixture> {
  const registry = await serveDesignxRegistry(answers);
  registries.push(registry);
  return registry;
}

const EXACT_OR_CARET = /^\^?\d+\.\d+(\.\d+)?$/;

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
    expect(parseDependency("tw-animate-css")).toEqual([
      "tw-animate-css",
      DESIGNX_DEPENDENCY_VERSIONS["tw-animate-css"],
    ]);
    expect(DESIGNX_DEPENDENCY_VERSIONS["tw-animate-css"]).toMatch(/^\d+\.\d+\.\d+$/);
    expect(() => parseDependency("left-pad")).toThrow(/without a version/);
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

describe("DesignX registry lock", () => {
  it("pins every item the standard set reaches with its content hash and a vendored copy", () => {
    const reached = new Set<string>();
    let pending = DESIGNX_STANDARD.map(String);
    while (pending.length > 0) {
      const next: string[] = [];
      for (const name of pending) {
        if (reached.has(name)) continue;
        reached.add(name);
        const pin = DESIGNX_LOCK.items[name];
        expect(pin, name).toBeDefined();
        if (pin === undefined) continue;
        expect(pin.url).toBe(designxItemUrl(name, DESIGNX_REGISTRY));
        expect(pin.sha256).toBe(designxSha256(pin.vendored));
        const item = parseDesignxItem(JSON.parse(pin.vendored), name);
        for (const dependency of item.registryDependencies) {
          const dependencyName = registryName(dependency);
          if (!Object.hasOwn(DESIGNX_PROVIDED, dependencyName)) next.push(dependencyName);
        }
        for (const spec of [...item.dependencies, ...item.devDependencies]) {
          expect(parseDependency(spec)[1], spec).toMatch(EXACT_OR_CARET);
        }
      }
      pending = next;
    }
    expect(Object.keys(DESIGNX_LOCK.items).sort()).toEqual([...reached].sort());
  });

  it("verifies a fetched item against its pinned hash", async () => {
    const registry = await serve();
    const item = await fetchDesignxItem("button", { registry: registry.registry });
    expect(item.name).toBe("button");
    expect(registry.requested).toEqual(["button"]);
  });

  it("refuses a fetched item whose content differs from the pin", async () => {
    const pinned = DESIGNX_LOCK.items.button?.vendored ?? "";
    const tampered = pinned.replace("Button", "Botton");
    expect(tampered).not.toBe(pinned);
    const registry = await serve({ button: tampered });
    const fetched = fetchDesignxItem("button", { registry: registry.registry });
    await expect(fetched).rejects.toBeInstanceOf(DesignxError);
    await expect(fetchDesignxItem("button", { registry: registry.registry })).rejects.toThrow(
      `has sha256 ${designxSha256(tampered)}, but designx.lock.json pins ${DESIGNX_LOCK.items.button?.sha256 ?? ""}`,
    );
  });

  it("falls back to the vendored copy when the registry is unreachable or lacks the item", async () => {
    const vendored = parseDesignxItem(JSON.parse(DESIGNX_LOCK.items.card?.vendored ?? ""), "card");
    const missing = await serve({ card: 404 });
    expect(await fetchDesignxItem("card", { registry: missing.registry })).toEqual(vendored);
    expect(missing.requested).toEqual(["card"]);
    const offline = await unreachableDesignxRegistry();
    expect(await fetchDesignxItem("card", { registry: offline })).toEqual(vendored);
    const items = await resolveDesignxItems(["command"], { registry: offline });
    expect(items.map((item) => item.name)).toEqual(["command", "dialog", "utils"]);
  });

  it("refuses an item the lock does not pin", async () => {
    const registry = await serve({ "theme-provider": "{}" });
    await expect(
      fetchDesignxItem("theme-provider", { registry: registry.registry }),
    ).rejects.toThrow('DesignX item "theme-provider" is not pinned in designx.lock.json');
    expect(registry.requested).toEqual([]);
  });
});

function installedFile(name: DesignxItemName): string {
  if (name === "theme") return DESIGNX_THEME_FILE;
  if (name === "utils") return `${DESIGNX_UI_DIR}/utils.ts`;
  return `${DESIGNX_UI_DIR}/${name}.${DESIGNX_ITEMS[name] === "hook" ? "ts" : "tsx"}`;
}

describe("DesignX provided items", () => {
  it("places use-screen.ts for use-mobile and points registry imports of it there", () => {
    const sidebar = parseDesignxItem(
      {
        name: "sidebar",
        type: "registry:ui",
        registryDependencies: ["@dx/use-mobile"],
        files: [
          {
            path: "ui/sidebar.tsx",
            type: "registry:ui",
            content:
              'import { useIsMobile } from "@/hooks/use-mobile";\nexport const mobile = useIsMobile;\n',
          },
        ],
      },
      "sidebar",
    );
    const provided = providedDesignxNames(["sidebar"], [sidebar]);
    expect(provided).toEqual(["use-mobile"]);
    const files = designxFiles([sidebar], provided);
    expect(files.map((file) => file.path)).toEqual([
      `${DESIGNX_UI_DIR}/sidebar.tsx`,
      `${DESIGNX_UI_DIR}/${DESIGNX_PROVIDED["use-mobile"].file}`,
    ]);
    expect(files[0]?.content).toContain('import { useIsMobile } from "./use-screen.ts";');
    expect(files[1]?.content).toBe(useScreenTemplate());
    expect(useScreenTemplate()).toContain('import { useScreen } from "@sidioralabs/rex/client";');
    expect(useScreenTemplate()).toContain("export { useScreen };");
  });

  it("refuses a registry item whose type disagrees with the rex/designx map", () => {
    expect(() =>
      parseDesignxItem(
        {
          name: "card",
          type: "registry:component",
          files: [
            {
              path: "components/card.tsx",
              type: "registry:component",
              content: "",
            },
          ],
        },
        "card",
      ),
    ).toThrow(/maps it as registry:ui/);
  });
});

const UNGROUPED_DATA_TABLE = [
  'import { Button } from "@/components/ui/button";',
  'import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";',
  "export function Columns({ table }: { table: { getAllColumns(): { id: string }[] } }) {",
  "  return (",
  "    <DropdownMenu>",
  '      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>View</DropdownMenuTrigger>',
  '      <DropdownMenuContent align="end" className="min-w-40">',
  "        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>",
  "        {table.getAllColumns().map((c) => (",
  "          <DropdownMenuCheckboxItem key={c.id}>{c.id}</DropdownMenuCheckboxItem>",
  "        ))}",
  "      </DropdownMenuContent>",
  "    </DropdownMenu>",
  "  );",
  "}",
  "",
].join("\n");

function registryItem(name: string, path: string, content: string, registryDependencies: string[]) {
  return parseDesignxItem(
    {
      name,
      type: "registry:ui",
      registryDependencies,
      files: [{ path, type: "registry:ui", content }],
    },
    name,
  );
}

describe("DesignX data-table column menu", () => {
  it("groups the column menu label of the installed data-table and imports the group", async () => {
    const files = designxFiles([
      registryItem("button", "ui/button.tsx", "export const Button = () => null;\n", []),
      registryItem(
        "dropdown-menu",
        "ui/dropdown-menu.tsx",
        "export const DropdownMenuGroup = () => null;\n",
        [],
      ),
      registryItem(DESIGNX_DATA_TABLE, "ui/data-table.tsx", UNGROUPED_DATA_TABLE, [
        "@dx/button",
        "@dx/dropdown-menu",
      ]),
    ]);
    const table = files.find((file) => file.path === `${DESIGNX_UI_DIR}/data-table.tsx`);
    expect(table).toBeDefined();
    const content = table?.content ?? "";
    expect(content).toContain(
      'import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuTrigger } from "./dropdown-menu.tsx";',
    );
    const formatted = await format(content, {
      ...rexPrettierConfig,
      filepath: `${DESIGNX_UI_DIR}/data-table.tsx`,
    });
    expect(formatted).toMatch(
      /<DropdownMenuContent align="end" className="min-w-40">\s*<DropdownMenuGroup>\s*<DropdownMenuLabel>Toggle columns<\/DropdownMenuLabel>\s*\{table\s*\.getAllColumns\(\)[\s\S]*<\/DropdownMenuCheckboxItem>\s*\)\)\}\s*<\/DropdownMenuGroup>\s*<\/DropdownMenuContent>/,
    );
    expect(formatted.match(/<DropdownMenuGroup>/g)).toHaveLength(1);
    expect(files.find((file) => file.path === `${DESIGNX_UI_DIR}/button.tsx`)?.content).toBe(
      "export const Button = () => null;\n",
    );
  });

  it("passes a data-table that already groups its label through unchanged", async () => {
    const once = groupDataTableMenu(UNGROUPED_DATA_TABLE);
    expect(once).not.toBe(UNGROUPED_DATA_TABLE);
    expect(groupDataTableMenu(once)).toBe(once);
    const formatted = await format(once, { ...rexPrettierConfig, filepath: "data-table.tsx" });
    expect(groupDataTableMenu(formatted)).toBe(formatted);
    const unlabelled = UNGROUPED_DATA_TABLE.replace(
      "        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>\n",
      "",
    );
    expect(groupDataTableMenu(unlabelled)).toBe(unlabelled);
    expect(unlabelled).not.toContain(DESIGNX_MENU_GROUP);
  });

  it("refuses an ungrouped label it cannot import the group for", () => {
    const withoutImport = UNGROUPED_DATA_TABLE.split("\n").slice(2).join("\n");
    expect(() => groupDataTableMenu(withoutImport)).toThrow(/imports no dropdown-menu/);
  });
});

describe("rex new --ui", { timeout: DESIGNX_TEST_TIMEOUT_MS }, () => {
  it("installs the DesignX standard set from the registry into an app that passes rex check", async () => {
    const cwd = tempDir();
    const registry = await serve();
    const written = await newApp(cwd, "dx-app", { install: false, registry: registry.registry });
    expect([...registry.requested].sort()).toEqual(Object.keys(DESIGNX_LOCK.items).sort());
    const root = join(cwd, "dx-app");

    expect(DESIGNX_STANDARD_SET).toEqual(DESIGNX_STANDARD);
    for (const name of DESIGNX_BASE) expect(DESIGNX_STANDARD_SET, name).toContain(name);
    for (const name of DESIGNX_STANDARD_SET) {
      const file = installedFile(name);
      expect(existsSync(join(root, file)), name).toBe(true);
      expect(written).toContain(`dx-app/${file}`);
    }
    const useScreen = `${DESIGNX_UI_DIR}/${DESIGNX_PROVIDED["use-mobile"].file}`;
    expect(existsSync(join(root, DESIGNX_UI_DIR, "use-mobile.ts"))).toBe(false);
    expect(readFileSync(join(root, useScreen), "utf8")).toContain(
      'import { useScreen } from "@sidioralabs/rex/client";',
    );
    expect(readFileSync(join(root, DESIGNX_UI_DIR, "sidebar.tsx"), "utf8")).toContain(
      'from "./use-screen.ts"',
    );
    for (const file of [...DESIGNX_STANDARD_SET.map(installedFile), useScreen]) {
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

    const dx = readJson<{
      items: string[];
      theme: string;
      ui: string;
      provided: Record<string, string>;
    }>(join(root, DESIGNX_CONFIG_FILE));
    expect(dx.theme).toBe(DESIGNX_THEME_FILE);
    expect(dx.ui).toBe(DESIGNX_UI_DIR);
    expect(dx.items).toEqual(expect.arrayContaining([...DESIGNX_STANDARD_SET]));
    expect(dx.items).not.toContain("use-mobile");
    expect(dx.provided).toEqual({ "use-mobile": useScreen });

    const dataTable = readFileSync(join(root, DESIGNX_UI_DIR, "data-table.tsx"), "utf8");
    expect(dataTable).toContain(`  ${DESIGNX_MENU_GROUP},\n`);
    expect(dataTable).toMatch(
      /<DropdownMenuContent[^>]*>\s*<DropdownMenuGroup>\s*<DropdownMenuLabel>Toggle columns<\/DropdownMenuLabel>/,
    );

    const command = readFileSync(join(root, DESIGNX_UI_DIR, "command.tsx"), "utf8");
    expect(command).not.toContain('"@/');
    expect(command).toContain('from "./dialog.tsx"');

    const manifest = readJson<GeneratedPackage>(join(root, "package.json"));
    for (const name of [
      ...TAILWIND_PACKAGES,
      "@base-ui/react",
      "class-variance-authority",
      "@tanstack/react-table",
    ]) {
      expect(manifest.dependencies[name], name).toBeDefined();
    }
    for (const [name, version] of Object.entries({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    })) {
      expect(version, name).toMatch(EXACT_OR_CARET);
    }
    expect(readFileSync(join(root, "index.html"), "utf8")).toContain(
      `<link rel="stylesheet" href="${DESIGNX_STYLESHEET_HREF}" />`,
    );
    expect(readFileSync(join(root, "rex.config.ts"), "utf8")).toContain(
      'ui: { kit: "designx", components: "app/components/Shell.tsx" },',
    );
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
