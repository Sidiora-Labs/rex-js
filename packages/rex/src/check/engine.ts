import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createSourceLoader, type Finding, type Rule, type SourceLoader } from "./rule.ts";

export const FILE_ROLES = [
  "page",
  "view",
  "states",
  "region",
  "part",
  "hook",
  "overlay",
  "action",
  "entity",
  "policy",
  "flow",
  "component",
  "data",
  "test",
] as const;

export type FileRole = (typeof FILE_ROLES)[number];

export const COMPONENT_ROLES: readonly FileRole[] = [
  "view",
  "states",
  "region",
  "part",
  "overlay",
  "component",
];

export interface AppFile {
  readonly path: string;
  readonly file: string;
  readonly role: FileRole;
  readonly name: string;
  readonly page: string | null;
  readonly region: string | null;
}

export interface AppRegion {
  readonly name: string;
  readonly dir: string;
  readonly file: AppFile | null;
  readonly parts: readonly AppFile[];
}

export interface AppPage {
  readonly id: string;
  readonly dir: string;
  readonly page: AppFile | null;
  readonly view: AppFile | null;
  readonly states: AppFile | null;
  readonly regions: readonly AppRegion[];
  readonly hooks: readonly AppFile[];
  readonly overlays: readonly AppFile[];
  readonly tests: readonly AppFile[];
}

export interface RexApp {
  readonly root: string;
  readonly appDir: string;
  readonly files: readonly AppFile[];
  readonly pages: readonly AppPage[];
  readonly unclassified: readonly string[];
  byRole(role: FileRole): readonly AppFile[];
  fileAt(file: string): AppFile | undefined;
  pageOf(id: string): AppPage | undefined;
  relative(file: string): string;
}

export interface CheckResult {
  readonly findings: readonly Finding[];
  readonly errors: number;
  readonly warnings: number;
  readonly exitCode: 0 | 1;
}

export interface RunRulesOptions {
  readonly sources?: SourceLoader;
}

const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;
const TOP_LEVEL_ROLES: Readonly<Record<string, FileRole>> = {
  actions: "action",
  entities: "entity",
  policies: "policy",
  flows: "flow",
};

function toPosix(file: string): string {
  return file.split(path.sep).join("/");
}

function isDirectory(candidate: string): boolean {
  try {
    return statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function listDirectories(dir: string): string[] {
  if (!isDirectory(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function walk(dir: string, found: string[]): void {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (entry.isFile() && SOURCE_FILE.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      found.push(full);
    }
  }
}

interface Classification {
  readonly role: FileRole;
  readonly page: string | null;
  readonly region: string | null;
}

export function classify(relativeToApp: string): Classification | null {
  const segments = toPosix(relativeToApp).split("/");
  const base = segments.at(-1) ?? "";
  const isTsx = base.endsWith(".tsx");
  const isTs = base.endsWith(".ts") && !isTsx;
  const [top, second, third, fourth, fifth, sixth] = segments;

  if (top === "pages" && second !== undefined && segments.length >= 3) {
    const pageId = second;
    if (third === "test") return { role: "test", page: pageId, region: null };
    if (TEST_FILE.test(base)) return { role: "test", page: pageId, region: null };
    if (segments.length === 3) {
      if (base === "page.ts") return { role: "page", page: pageId, region: null };
      if (base === "view.tsx") return { role: "view", page: pageId, region: null };
      if (base === "states.tsx") return { role: "states", page: pageId, region: null };
      return null;
    }
    if (third === "hooks" && segments.length === 4 && (isTs || isTsx)) {
      return { role: "hook", page: pageId, region: null };
    }
    if (third === "overlays" && segments.length === 4 && isTsx) {
      return { role: "overlay", page: pageId, region: null };
    }
    if (third === "regions" && fourth !== undefined) {
      if (segments.length === 5 && fifth === "region.tsx") {
        return { role: "region", page: pageId, region: fourth };
      }
      if (segments.length === 6 && fifth === "parts" && sixth !== undefined && isTsx) {
        return { role: "part", page: pageId, region: fourth };
      }
    }
    return null;
  }
  if (TEST_FILE.test(base)) return { role: "test", page: null, region: null };
  if (top !== undefined && segments.length === 2 && isTs) {
    const role = TOP_LEVEL_ROLES[top];
    if (role) return { role, page: null, region: null };
  }
  if (top === "components" && segments.length >= 2) {
    return { role: "component", page: null, region: null };
  }
  if (top === "data" && segments.length >= 2) return { role: "data", page: null, region: null };
  return null;
}

export function discoverApp(root: string): RexApp {
  const absoluteRoot = path.resolve(root);
  const appDir = path.join(absoluteRoot, "app");
  if (!isDirectory(appDir)) {
    throw new Error(`discoverApp: no app directory at ${appDir}`);
  }
  const relative = (file: string) => toPosix(path.relative(absoluteRoot, path.resolve(file)));

  const sources: string[] = [];
  walk(appDir, sources);
  const files: AppFile[] = [];
  const unclassified: string[] = [];
  for (const full of sources) {
    const classification = classify(path.relative(appDir, full));
    if (classification === null) {
      unclassified.push(relative(full));
      continue;
    }
    files.push(
      Object.freeze({
        path: full,
        file: relative(full),
        role: classification.role,
        name: path.basename(full).replace(SOURCE_FILE, ""),
        page: classification.page,
        region: classification.region,
      }),
    );
  }
  files.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));

  const pagesDir = path.join(appDir, "pages");
  const pages: AppPage[] = listDirectories(pagesDir).map((id) => {
    const dir = path.join(pagesDir, id);
    const own = files.filter((file) => file.page === id);
    const single = (role: FileRole) => own.find((file) => file.role === role) ?? null;
    const regions: AppRegion[] = listDirectories(path.join(dir, "regions")).map((name) =>
      Object.freeze({
        name,
        dir: path.join(dir, "regions", name),
        file: own.find((file) => file.role === "region" && file.region === name) ?? null,
        parts: Object.freeze(own.filter((file) => file.role === "part" && file.region === name)),
      }),
    );
    return Object.freeze({
      id,
      dir,
      page: single("page"),
      view: single("view"),
      states: single("states"),
      regions: Object.freeze(regions),
      hooks: Object.freeze(own.filter((file) => file.role === "hook")),
      overlays: Object.freeze(own.filter((file) => file.role === "overlay")),
      tests: Object.freeze(own.filter((file) => file.role === "test")),
    });
  });

  const byPath = new Map(files.map((file) => [file.path, file]));
  const byRole = new Map<FileRole, readonly AppFile[]>(
    FILE_ROLES.map((role) => [role, Object.freeze(files.filter((file) => file.role === role))]),
  );
  const byPage = new Map(pages.map((entry) => [entry.id, entry]));

  return Object.freeze({
    root: absoluteRoot,
    appDir,
    files: Object.freeze(files),
    pages: Object.freeze(pages),
    unclassified: Object.freeze(unclassified),
    byRole: (role: FileRole) => byRole.get(role) ?? Object.freeze([]),
    fileAt: (file: string) => byPath.get(path.resolve(absoluteRoot, file)),
    pageOf: (id: string) => byPage.get(id),
    relative,
  });
}

export function compareFindings(a: Finding, b: Finding): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  if (a.line !== b.line) return a.line - b.line;
  if (a.column !== b.column) return a.column - b.column;
  if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1;
  return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
}

export function exitCodeFor(findings: readonly Finding[]): 0 | 1 {
  return findings.some((entry) => entry.severity === "error") ? 1 : 0;
}

export function summarize(findings: readonly Finding[]): CheckResult {
  const sorted = Object.freeze([...findings].sort(compareFindings));
  const errors = sorted.filter((entry) => entry.severity === "error").length;
  return Object.freeze({
    findings: sorted,
    errors,
    warnings: sorted.length - errors,
    exitCode: exitCodeFor(sorted),
  });
}

export async function runRules(
  app: RexApp,
  rules: readonly Rule[],
  options: RunRulesOptions = {},
): Promise<CheckResult> {
  const sources = options.sources ?? createSourceLoader();
  const seen = new Set<string>();
  const findings: Finding[] = [];
  for (const rule of rules) {
    if (seen.has(rule.id)) throw new Error(`runRules: rule "${rule.id}" is listed twice`);
    seen.add(rule.id);
    let produced: readonly Finding[];
    try {
      produced = await rule.check({ app, sources });
    } catch (error) {
      throw new Error(`runRules: rule "${rule.id}" failed: ${(error as Error).message}`, {
        cause: error,
      });
    }
    for (const entry of produced) {
      if (entry.rule !== rule.id && !entry.rule.startsWith(`${rule.id}/`)) {
        throw new Error(
          `runRules: rule "${rule.id}" reported a finding attributed to "${entry.rule}"`,
        );
      }
      findings.push(entry);
    }
  }
  return summarize(findings);
}
