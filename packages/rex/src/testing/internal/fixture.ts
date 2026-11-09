import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODULES_DIR = "node_modules";
const PACKAGE_SCOPE = "@sidioralabs";
const PACKAGE_DIR = "rex";
const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const packageRoot = dirname(sourceRoot);
const packageModules = join(packageRoot, MODULES_DIR);

export interface FixtureCopy {
  readonly dir: string;
  readonly remove: () => void;
}

export function fixtureSource(name: string): string {
  const source = join(sourceRoot, name);
  if (!existsSync(source)) throw new Error(`No fixture named ${name} under src`);
  return source;
}

function linkPackageModules(dir: string): void {
  const modules = join(dir, MODULES_DIR);
  mkdirSync(modules);
  for (const entry of readdirSync(packageModules)) {
    if (entry.startsWith(".")) continue;
    symlinkSync(realpathSync(join(packageModules, entry)), join(modules, entry), "dir");
  }
  mkdirSync(join(modules, PACKAGE_SCOPE), { recursive: true });
  symlinkSync(realpathSync(packageRoot), join(modules, PACKAGE_SCOPE, PACKAGE_DIR), "dir");
}

export function copyFixture(name: string): FixtureCopy {
  const source = fixtureSource(name);
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `rex-fixture-${basename(name)}-`)));
  cpSync(source, dir, {
    recursive: true,
    filter: (path) => basename(path) !== MODULES_DIR,
  });
  linkPackageModules(dir);
  return { dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
}

export async function withFixture(
  name: string,
  run: (dir: string) => Promise<void>,
): Promise<void> {
  const copy = copyFixture(name);
  try {
    await run(copy.dir);
  } finally {
    copy.remove();
  }
}
