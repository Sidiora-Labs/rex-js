#!/usr/bin/env node
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Application, Converter, ReflectionKind, TSConfigReader, TypeDocReader } from "typedoc";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_DIR = join(ROOT, "packages", "rex");
export const API_DIR = join(ROOT, "docs", "api");
export const TYPEDOC_CONFIG = join(ROOT, "typedoc.json");

export function packageEntries() {
  const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, "package.json"), "utf8"));
  const entries = [];
  for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
    if (typeof target !== "string" || !/\.tsx?$/.test(target)) continue;
    entries.push({
      specifier: subpath === "." ? manifest.name : `${manifest.name}/${subpath.slice(2)}`,
      file: resolve(PACKAGE_DIR, target),
    });
  }
  if (entries.length === 0)
    throw new Error("packages/rex/package.json declares no TypeScript entries in exports");
  return entries;
}

function sameFile(a, b) {
  return resolve(a).split("\\").join("/") === resolve(b).split("\\").join("/");
}

export async function generateApi(out) {
  const entries = packageEntries();
  const app = await Application.bootstrapWithPlugins(
    { options: TYPEDOC_CONFIG, entryPoints: entries.map((entry) => entry.file), out },
    [new TypeDocReader(), new TSConfigReader()],
  );
  app.converter.on(Converter.EVENT_RESOLVE_BEGIN, (context) => {
    for (const module of context.project.getReflectionsByKind(ReflectionKind.Module)) {
      const symbol = context.getSymbolFromReflection(module);
      const file = symbol?.declarations?.[0]?.getSourceFile().fileName;
      const entry =
        file === undefined
          ? undefined
          : entries.find((candidate) => sameFile(candidate.file, file));
      if (entry !== undefined) module.name = entry.specifier;
    }
  });
  const project = await app.convert();
  if (project === undefined) throw new Error("typedoc could not convert the package entries");
  await app.generateOutputs(project);
  if (app.logger.hasErrors())
    throw new Error("typedoc reported errors while generating the API reference");
}

function listFiles(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...listFiles(path, base));
    else files.push(relative(base, path).split("\\").join("/"));
  }
  return files;
}

export function compareTrees(expectedDir, actualDir) {
  const expected = listFiles(expectedDir);
  const actual = listFiles(actualDir);
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const problems = [];
  for (const file of expected) {
    if (!actualSet.has(file)) problems.push(`missing ${file}`);
    else if (
      readFileSync(join(expectedDir, file), "utf8") !== readFileSync(join(actualDir, file), "utf8")
    ) {
      problems.push(`stale ${file}`);
    }
  }
  for (const file of actual) if (!expectedSet.has(file)) problems.push(`extra ${file}`);
  return problems;
}

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

export async function main(argv = process.argv.slice(2)) {
  const target = resolve(optionValue(argv, "--out") ?? API_DIR);
  const shown = relative(process.cwd(), target) || target;
  if (argv.includes("--check")) {
    const scratch = mkdtempSync(join(tmpdir(), "rex-docs-api-"));
    try {
      const fresh = join(scratch, "api");
      await generateApi(fresh);
      const problems = compareTrees(fresh, target);
      if (problems.length === 0) {
        process.stdout.write(`${shown} is up to date (${listFiles(fresh).length} files)\n`);
        return 0;
      }
      process.stderr.write(
        `${shown} is stale; run pnpm docs:api to regenerate it from the package entries\n${problems
          .map((problem) => `  ${problem}\n`)
          .join("")}`,
      );
      return 1;
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
  await generateApi(target);
  process.stdout.write(`wrote ${shown} (${listFiles(target).length} files)\n`);
  return 0;
}

function isMain() {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return pathToFileURL(realpathSync(entry)).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isMain()) {
  process.exitCode = await main();
}
