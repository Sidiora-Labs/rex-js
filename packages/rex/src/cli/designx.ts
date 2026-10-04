import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import {
  DESIGNX_ITEMS,
  DESIGNX_PROVIDED,
  DESIGNX_REGISTRY_URL,
  DESIGNX_STANDARD,
  isDesignxItem,
  isDesignxProvided,
  type DesignxProvidedName,
} from "../designx/index.ts";
import { rexPrettierConfig } from "../prettier.ts";
import type { PlannedFile } from "./commands/make.ts";
import { CLIENT_IMPORT } from "./templates.ts";

export const DESIGNX_REGISTRY = DESIGNX_REGISTRY_URL;
export const DESIGNX_NAMESPACE = "@dx/";
export const DESIGNX_THEME = "theme";
export const DESIGNX_BASE = [
  "button",
  "card",
  "field",
  "input",
  "select",
  "sheet",
  "dialog",
  "skeleton",
  "empty",
  "command",
  "table",
  "tabs",
  "tooltip",
  "kbd",
  "badge",
] as const;
export const DESIGNX_STANDARD_SET = DESIGNX_STANDARD;
export const DESIGNX_UI_DIR = "app/components/ui";
export const DESIGNX_THEME_FILE = "app/theme.css";
export const DESIGNX_CONFIG_FILE = "dx.json";
export const DESIGNX_STYLESHEET_HREF = `/${DESIGNX_THEME_FILE}`;
export const TAILWIND_PACKAGES = ["@tailwindcss/vite", "tailwindcss"] as const;
export const TAILWIND_VERSION = "^4.3.0";
export const DESIGNX_FAILED = "rex.designx.failed";

const ITEM_TYPES = [
  "registry:ui",
  "registry:lib",
  "registry:hook",
  "registry:component",
  "registry:style",
  "registry:file",
] as const;

export type DesignxItemType = (typeof ITEM_TYPES)[number];

export interface DesignxFile {
  readonly path: string;
  readonly type: string;
  readonly content: string;
  readonly target: string | null;
}

export interface DesignxItem {
  readonly name: string;
  readonly type: DesignxItemType;
  readonly dependencies: readonly string[];
  readonly devDependencies: readonly string[];
  readonly registryDependencies: readonly string[];
  readonly files: readonly DesignxFile[];
}

export interface DesignxInstall {
  readonly registry: string;
  readonly items: readonly DesignxItem[];
  readonly provided: readonly DesignxProvidedName[];
  readonly files: readonly PlannedFile[];
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
}

export type DesignxFetch = (url: string) => Promise<Response>;

export interface DesignxOptions {
  readonly registry?: string;
  readonly fetch?: DesignxFetch;
}

export class DesignxError extends Error {
  readonly code = DESIGNX_FAILED;
  readonly exitCode = 1;

  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = "DesignxError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringList(value: unknown, field: string, name: string): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new DesignxError(`DesignX item "${name}" has a ${field} that is not a list of strings`);
  }
  return value as readonly string[];
}

function parseFile(value: unknown, name: string): DesignxFile {
  if (
    !isRecord(value) ||
    typeof value.path !== "string" ||
    typeof value.type !== "string" ||
    typeof value.content !== "string"
  ) {
    throw new DesignxError(`DesignX item "${name}" lists a file without path, type and content`);
  }
  return {
    path: value.path,
    type: value.type,
    content: value.content,
    target: typeof value.target === "string" ? value.target : null,
  };
}

export function parseDesignxItem(value: unknown, expected: string): DesignxItem {
  if (!isRecord(value) || typeof value.name !== "string") {
    throw new DesignxError(`DesignX item "${expected}" is not a registry item`);
  }
  if (value.name !== expected) {
    throw new DesignxError(`DesignX item "${expected}" answered with the item "${value.name}"`);
  }
  const type = value.type;
  if (typeof type !== "string" || !(ITEM_TYPES as readonly string[]).includes(type)) {
    throw new DesignxError(`DesignX item "${expected}" has the unsupported type ${String(type)}`);
  }
  if (isDesignxItem(expected) && type !== `registry:${DESIGNX_ITEMS[expected]}`) {
    throw new DesignxError(
      `DesignX item "${expected}" is a ${type} item, but rex/designx maps it as registry:${DESIGNX_ITEMS[expected]}`,
    );
  }
  if (!Array.isArray(value.files) || value.files.length === 0) {
    throw new DesignxError(`DesignX item "${expected}" has no files`);
  }
  return {
    name: value.name,
    type: type as DesignxItemType,
    dependencies: stringList(value.dependencies, "dependencies", expected),
    devDependencies: stringList(value.devDependencies, "devDependencies", expected),
    registryDependencies: stringList(value.registryDependencies, "registryDependencies", expected),
    files: value.files.map((file) => parseFile(file, expected)),
  };
}

export function designxItemUrl(name: string, registry: string = DESIGNX_REGISTRY): string {
  return `${registry.replace(/\/+$/, "")}/${name}.json`;
}

export function registryName(dependency: string): string {
  if (dependency.startsWith(DESIGNX_NAMESPACE)) return dependency.slice(DESIGNX_NAMESPACE.length);
  if (/^[a-z][a-z0-9-]*$/.test(dependency)) return dependency;
  throw new DesignxError(
    `the registry dependency "${dependency}" is not a DesignX item (expected ${DESIGNX_NAMESPACE}<name>)`,
  );
}

export async function fetchDesignxItem(
  name: string,
  options: DesignxOptions = {},
): Promise<DesignxItem> {
  const url = designxItemUrl(name, options.registry);
  const request = options.fetch ?? globalThis.fetch;
  let response: Response;
  try {
    response = await request(url);
  } catch (error) {
    throw new DesignxError(`cannot reach the DesignX registry at ${url}`, {
      cause: error,
    });
  }
  if (!response.ok) {
    throw new DesignxError(`the DesignX registry answered ${response.status} for ${url}`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new DesignxError(`the DesignX registry sent invalid JSON for ${url}`, { cause: error });
  }
  return parseDesignxItem(body, name);
}

export async function resolveDesignxItems(
  names: readonly string[],
  options: DesignxOptions = {},
): Promise<readonly DesignxItem[]> {
  const resolved = new Map<string, DesignxItem>();
  let pending = [...new Set(names.map(registryName))].filter((name) => !isDesignxProvided(name));
  while (pending.length > 0) {
    const fetched = await Promise.all(pending.map((name) => fetchDesignxItem(name, options)));
    const next = new Set<string>();
    for (const item of fetched) {
      resolved.set(item.name, item);
      for (const dependency of item.registryDependencies) {
        const name = registryName(dependency);
        if (isDesignxProvided(name)) continue;
        if (!resolved.has(name) && !pending.includes(name)) next.add(name);
      }
    }
    pending = [...next];
  }
  return [...resolved.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function providedDesignxNames(
  names: readonly string[],
  items: readonly DesignxItem[],
): readonly DesignxProvidedName[] {
  const provided = new Set<DesignxProvidedName>();
  for (const name of [
    ...names.map(registryName),
    ...items.flatMap((item) => item.registryDependencies.map(registryName)),
  ]) {
    if (isDesignxProvided(name)) provided.add(name);
  }
  return [...provided].sort();
}

export function useScreenTemplate(): string {
  return [
    `import { useScreen } from "${CLIENT_IMPORT}";`,
    "",
    "export { useScreen };",
    "",
    "export function useIsMobile(): boolean {",
    '  return useScreen().screen === "phone";',
    "}",
    "",
  ].join("\n");
}

const PROVIDED_TEMPLATES: Readonly<Record<DesignxProvidedName, () => string>> = {
  "use-mobile": useScreenTemplate,
};

export function providedDesignxPath(name: DesignxProvidedName): string {
  return `${DESIGNX_UI_DIR}/${DESIGNX_PROVIDED[name].file}`;
}

function stripExtension(path: string): string {
  return path.replace(/\.(tsx?|jsx?)$/, "");
}

export function designxTarget(item: DesignxItem, file: DesignxFile): string {
  if (item.type === "registry:style" || file.path.endsWith(".css")) return DESIGNX_THEME_FILE;
  const base = posix.basename(file.path);
  if (
    file.path.startsWith("ui/") ||
    file.path.startsWith("lib/") ||
    file.path.startsWith("hooks/")
  ) {
    return `${DESIGNX_UI_DIR}/${base}`;
  }
  if (file.path.startsWith("components/")) return `${DESIGNX_UI_DIR}/${base}`;
  throw new DesignxError(
    `DesignX item "${item.name}" has the file ${file.path}, which Rex cannot place`,
  );
}

function aliasOf(file: DesignxFile): string | null {
  if (file.path.endsWith(".css")) return null;
  const path = stripExtension(file.path);
  if (path.startsWith("ui/")) return `@/components/${path}`;
  return `@/${path}`;
}

const ALIAS_IMPORT = /(["'])(@\/[^"']+)\1/g;

export function rewriteImports(
  content: string,
  from: string,
  aliases: ReadonlyMap<string, string>,
): string {
  return content.replace(ALIAS_IMPORT, (_match, quote: string, specifier: string) => {
    const target = aliases.get(specifier);
    if (target === undefined) {
      throw new DesignxError(
        `${from} imports "${specifier}", which no fetched DesignX item provides`,
      );
    }
    let relativePath = posix.relative(posix.dirname(from), target);
    if (!relativePath.startsWith(".")) relativePath = `./${relativePath}`;
    return `${quote}${relativePath}${quote}`;
  });
}

const THEME_PRELUDE = ['@import "tailwindcss";', '@import "tw-animate-css";', ""].join("\n");

export const DESIGNX_DATA_TABLE = "data-table";
export const DESIGNX_MENU_GROUP = "DropdownMenuGroup";

const DATA_TABLE_UNGROUPED_MENU =
  /(<DropdownMenuContent\b[^>]*>)\s*(<DropdownMenuLabel>Toggle columns<\/DropdownMenuLabel>[\s\S]*?)\s*(<\/DropdownMenuContent>)/;
const DROPDOWN_MENU_IMPORT = /import\s*\{([^}]*)\}\s*from\s*(["'][^"']*dropdown-menu[^"']*["'])/;

function withImportedName(names: string, name: string): string {
  const listed = names
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const at = listed.findIndex((entry) => entry.localeCompare(name) > 0);
  listed.splice(at === -1 ? listed.length : at, 0, name);
  return listed.join(", ");
}

export function groupDataTableMenu(content: string): string {
  if (content.includes(DESIGNX_MENU_GROUP) || !DATA_TABLE_UNGROUPED_MENU.test(content)) {
    return content;
  }
  const imported = DROPDOWN_MENU_IMPORT.exec(content);
  if (imported === null) {
    throw new DesignxError(
      `the DesignX ${DESIGNX_DATA_TABLE} item renders its column menu label outside a ${DESIGNX_MENU_GROUP} but imports no dropdown-menu to take it from`,
    );
  }
  const [statement, names = "", from = ""] = imported;
  return content
    .replace(statement, `import { ${withImportedName(names, DESIGNX_MENU_GROUP)} } from ${from}`)
    .replace(
      DATA_TABLE_UNGROUPED_MENU,
      `$1\n<${DESIGNX_MENU_GROUP}>\n$2\n</${DESIGNX_MENU_GROUP}>\n$3`,
    );
}

function patchedDesignxSource(item: DesignxItem, content: string): string {
  return item.name === DESIGNX_DATA_TABLE ? groupDataTableMenu(content) : content;
}

export function designxFiles(
  items: readonly DesignxItem[],
  provided: readonly DesignxProvidedName[] = [],
): readonly PlannedFile[] {
  const aliases = new Map<string, string>(
    provided.map((name) => [DESIGNX_PROVIDED[name].alias, providedDesignxPath(name)]),
  );
  const placed: {
    readonly path: string;
    readonly item: DesignxItem;
    readonly file: DesignxFile;
  }[] = [];
  for (const item of items) {
    for (const file of item.files) {
      const path = designxTarget(item, file);
      const alias = aliasOf(file);
      if (alias !== null) aliases.set(alias, path);
      placed.push({ path, item, file });
    }
  }
  const seen = new Set<string>();
  const planned: PlannedFile[] = [];
  for (const { path, item, file } of placed) {
    if (seen.has(path)) throw new DesignxError(`two DesignX files would be written to ${path}`);
    seen.add(path);
    const content = path.endsWith(".css")
      ? `${THEME_PRELUDE}${file.content.trimEnd()}\n`
      : `${patchedDesignxSource(item, rewriteImports(file.content, path, aliases)).trimEnd()}\n`;
    planned.push({ kind: "file", path, content });
  }
  for (const name of provided) {
    const path = providedDesignxPath(name);
    if (seen.has(path)) throw new DesignxError(`two DesignX files would be written to ${path}`);
    seen.add(path);
    planned.push({ kind: "file", path, content: PROVIDED_TEMPLATES[name]() });
  }
  return planned.sort((a, b) => a.path.localeCompare(b.path));
}

type Prettier = typeof import("prettier");

function isMissingModule(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND";
}

async function loadPrettier(): Promise<Prettier> {
  try {
    return await import("prettier");
  } catch (error) {
    if (!isMissingModule(error)) throw error;
    throw new DesignxError(
      "the DesignX registry files are written through the rex/prettier preset, but prettier is not installed; add prettier next to rex or pass --ui none",
      { cause: error },
    );
  }
}

export async function formatDesignxFiles(
  files: readonly PlannedFile[],
): Promise<readonly PlannedFile[]> {
  const prettier = await loadPrettier();
  return Promise.all(
    files.map(async (file) => {
      let content: string;
      try {
        content = await prettier.format(file.content, {
          ...rexPrettierConfig,
          filepath: file.path,
        });
      } catch (error) {
        throw new DesignxError(`cannot format the DesignX file ${file.path} with rex/prettier`, {
          cause: error,
        });
      }
      return { ...file, content };
    }),
  );
}

export function parseDependency(spec: string): readonly [string, string] {
  const at = spec.indexOf("@", spec.startsWith("@") ? 1 : 0);
  if (at === -1) return [spec, "latest"];
  return [spec.slice(0, at), spec.slice(at + 1)];
}

function collect(specs: readonly string[]): Record<string, string> {
  const found: Record<string, string> = {};
  for (const spec of specs) {
    const [name, range] = parseDependency(spec);
    found[name] = range;
  }
  return Object.fromEntries(Object.entries(found).sort(([a], [b]) => a.localeCompare(b)));
}

export function designxDependencies(items: readonly DesignxItem[]): Record<string, string> {
  return collect([
    ...items.flatMap((item) => item.dependencies),
    ...TAILWIND_PACKAGES.map((name) => `${name}@${TAILWIND_VERSION}`),
  ]);
}

export function designxConfig(
  items: readonly DesignxItem[],
  registry: string,
  provided: readonly DesignxProvidedName[] = [],
): string {
  return `${JSON.stringify(
    {
      registry: `${registry.replace(/\/+$/, "")}/{name}.json`,
      theme: DESIGNX_THEME_FILE,
      ui: DESIGNX_UI_DIR,
      tailwind: { plugin: TAILWIND_PACKAGES[0], css: DESIGNX_THEME_FILE },
      items: items.map((item) => item.name),
      provided: Object.fromEntries(provided.map((name) => [name, providedDesignxPath(name)])),
    },
    null,
    2,
  )}\n`;
}

export async function fetchDesignx(
  names: readonly string[] = DESIGNX_STANDARD_SET,
  options: DesignxOptions = {},
): Promise<DesignxInstall> {
  const registry = options.registry ?? DESIGNX_REGISTRY;
  const items = await resolveDesignxItems(names, options);
  const provided = providedDesignxNames(names, items);
  return {
    registry,
    items,
    provided,
    files: [
      ...(await formatDesignxFiles(designxFiles(items, provided))),
      {
        kind: "file",
        path: DESIGNX_CONFIG_FILE,
        content: designxConfig(items, registry, provided),
      },
    ],
    dependencies: designxDependencies(items),
    devDependencies: collect(items.flatMap((item) => item.devDependencies)),
  };
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

function sorted(record: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

export function withDesignxDependencies(packageJson: string, install: DesignxInstall): string {
  const manifest = JSON.parse(packageJson) as PackageJson;
  const next: PackageJson = {
    ...manifest,
    dependencies: sorted({ ...install.dependencies, ...manifest.dependencies }),
  };
  if (Object.keys(install.devDependencies).length > 0) {
    next.devDependencies = sorted({
      ...install.devDependencies,
      ...manifest.devDependencies,
    });
  }
  return `${JSON.stringify(next, null, 2)}\n`;
}

export function withDesignxStylesheet(indexHtml: string): string {
  if (indexHtml.includes(DESIGNX_STYLESHEET_HREF)) return indexHtml;
  if (!indexHtml.includes("</head>")) {
    throw new DesignxError("index.html has no </head> to link the DesignX theme from");
  }
  return indexHtml.replace(
    "</head>",
    `  <link rel="stylesheet" href="${DESIGNX_STYLESHEET_HREF}" />\n  </head>`,
  );
}

export function packageManager(
  userAgent: string | undefined = process.env.npm_config_user_agent,
): string {
  const name = userAgent?.split("/")[0];
  return name === "pnpm" || name === "yarn" || name === "bun" ? name : "npm";
}

export function installPackages(root: string, manager: string = packageManager()): void {
  const result = spawnSync(manager, ["install"], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new DesignxError(
      `${manager} install failed in ${root}${result.error === undefined ? ` with exit code ${String(result.status)}` : `: ${result.error.message}`}`,
      { cause: result.error },
    );
  }
}

export interface AddDesignxOptions extends DesignxOptions {
  readonly install?: boolean;
  readonly overwrite?: boolean;
}

export async function addDesignx(
  root: string,
  names: readonly string[],
  options: AddDesignxOptions = {},
): Promise<readonly string[]> {
  const packageFile = join(root, "package.json");
  if (!existsSync(packageFile)) throw new DesignxError(`${root} has no package.json`);
  const install = await fetchDesignx(names, options);
  const clashes = install.files
    .filter((file) => file.path !== DESIGNX_CONFIG_FILE && existsSync(join(root, file.path)))
    .map((file) => file.path);
  if (clashes.length > 0 && options.overwrite !== true) {
    throw new DesignxError(
      `refusing to overwrite existing files:\n${clashes.map((path) => `  ${path}`).join("\n")}`,
    );
  }
  const written: string[] = [];
  for (const file of install.files) {
    const target = join(root, file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content);
    written.push(file.path);
  }
  writeFileSync(packageFile, withDesignxDependencies(readFileSync(packageFile, "utf8"), install));
  written.push("package.json");
  const indexFile = join(root, "index.html");
  if (existsSync(indexFile)) {
    writeFileSync(indexFile, withDesignxStylesheet(readFileSync(indexFile, "utf8")));
    written.push("index.html");
  }
  if (options.install !== false) installPackages(root);
  return written;
}
