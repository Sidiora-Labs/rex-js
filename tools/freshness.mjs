#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire, register } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_DIR = join(ROOT, "packages", "rex");
const SOURCE_DIR = join(PACKAGE_DIR, "src");
const DEMO_DIR = join(ROOT, "examples", "demo");
export const REFERENCE_DOC = "docs/reference.md";
export const CLI_DOC = "docs/cli.md";
export const README = "README.md";
export const API_INDEX = "docs/api/README.md";
export const CHANGELOG = "CHANGELOG.md";
export const TYPEDOC_CONFIG = "typedoc.json";
export const CLI_DOCS = [README, CLI_DOC];
export const NODE_FLOOR_DOCS = [
  { file: README, required: true },
  { file: "docs/development.md", required: true },
  { file: "CONTRIBUTING.md", required: false },
];
export const CHECKS = ["exports", "cli", "node", "versions", "errors", "api", "pointers", "links"];
const GLOBAL_FLAGS = ["--help", "-h"];
const HELP_JSON_FLAG = "--json";
const COMMAND_WORD = /^[a-z][a-z0-9-]*$/;
const RUNNERS = new Set(["exec", "npx", "dlx", "pnpx"]);
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;

function readText(root, file) {
  return readFileSync(join(root, file), "utf8");
}

function readJson(root, file) {
  return JSON.parse(readText(root, file));
}

function shown(file) {
  return relative(ROOT, file).split("\\").join("/");
}

export function exportEntries(manifest) {
  const entries = [];
  for (const [key, target] of Object.entries(manifest.exports ?? {})) {
    if (typeof target !== "string" || !/\.tsx?$/.test(target)) continue;
    entries.push({
      key,
      specifier: key === "." ? manifest.name : `${manifest.name}/${key.slice(2)}`,
      source: `packages/rex/${target.replace(/^\.\//, "")}`,
    });
  }
  return entries;
}

export function apiPages(apiIndex) {
  const pages = new Map();
  for (const match of apiIndex.matchAll(/^\s*-\s+\[([^\]]+)\]\(([^)]+)\)/gm)) {
    pages.set(match[1], match[2]);
  }
  return pages;
}

export function referenceSections(reference) {
  const sections = new Set();
  for (const match of reference.matchAll(/^#{2,4}\s+(.+?)\s*$/gm)) {
    sections.add(match[1].replace(/`/g, "").trim());
  }
  return sections;
}

export function checkExports({ root, manifest, reference, apiIndex, typedoc }) {
  const problems = [];
  const entries = exportEntries(manifest);
  const sections = referenceSections(reference);
  const pages = apiPages(apiIndex);
  for (const entry of entries) {
    const label = `export "${entry.key}" (${entry.specifier})`;
    if (!existsSync(join(root, entry.source))) {
      problems.push(`${label} points at ${entry.source}, which does not exist`);
    }
    if (!sections.has(entry.specifier)) {
      problems.push(`${label} has no section in ${REFERENCE_DOC}`);
    }
    const page = pages.get(entry.specifier);
    if (page === undefined) {
      problems.push(`${label} has no page listed in ${API_INDEX}`);
    } else if (!existsSync(join(root, dirname(API_INDEX), page))) {
      problems.push(`${label} has no API page at ${join(dirname(API_INDEX), page)}`);
    }
  }
  const declared = [...(typedoc.entryPoints ?? [])].sort();
  const expected = entries.map((entry) => entry.source).sort();
  if (JSON.stringify(declared) !== JSON.stringify(expected)) {
    const missing = expected.filter((file) => !declared.includes(file));
    const extra = declared.filter((file) => !expected.includes(file));
    problems.push(
      `${TYPEDOC_CONFIG} entryPoints differ from the package exports (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`,
    );
  }
  return problems;
}

export function commandIndex(listing) {
  const index = new Map();
  const visit = (command, path) => {
    const flags = new Set(GLOBAL_FLAGS);
    for (const option of command.options) {
      flags.add(option.long);
      if (option.short !== null) flags.add(option.short);
    }
    index.set(path, {
      path,
      leaf: command.commands.length === 0,
      options: command.options.map((option) => option.long),
      flags,
      commands: new Map(command.commands.map((child) => [child.name, child])),
    });
    for (const child of command.commands) {
      visit(child, path === "" ? child.name : `${path} ${child.name}`);
    }
  };
  visit(listing, "");
  return index;
}

function codeSpans(line) {
  const spans = [];
  for (const match of line.matchAll(/(`+)((?:(?!\1)[\s\S])+?)\1/g)) {
    spans.push(match[2].replace(/\\\|/g, "|").trim());
  }
  return spans;
}

function sources(markdown) {
  const found = [];
  let fence = null;
  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    const number = index + 1;
    const open = FENCE.exec(line);
    if (fence === null && open) {
      fence = open[1];
      continue;
    }
    if (fence !== null) {
      const close = FENCE.exec(line);
      if (
        close &&
        close[1][0] === fence[0] &&
        close[1].length >= fence.length &&
        line.trim() === close[1]
      ) {
        fence = null;
        continue;
      }
      const command = line.replace(/(^|\s)#.*$/, "");
      for (const part of command.split(/\s(?:&&|\|\||\||;)\s/))
        found.push({ line: number, text: part });
      continue;
    }
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    if (heading) found.push({ line: number, text: heading[1].replace(/`/g, "") });
    for (const span of codeSpans(line)) found.push({ line: number, text: span });
  }
  return found;
}

function flagOf(token) {
  const long = /^[[(]*(--[a-z][a-z0-9-]*)/.exec(token);
  if (long) return long[1];
  const short = /^[[(]*(-[a-zA-Z])(?=$|[\]),:|=])/.exec(token);
  return short ? short[1] : null;
}

export function documentedCommands(markdown, listing) {
  const index = commandIndex(listing);
  const statements = [];
  for (const source of sources(markdown)) {
    const tokens = source.text.split(/\s+/).filter((token) => token.length > 0);
    for (const [position, token] of tokens.entries()) {
      if (token !== "rex") continue;
      if (position > 0 && !RUNNERS.has(tokens[position - 1])) continue;
      const rest = tokens.slice(position + 1);
      const end = rest.indexOf("rex");
      const words = end === -1 ? rest : rest.slice(0, end);
      if (words.length === 0) continue;
      const first = words[0];
      if (!first.startsWith("-") && !COMMAND_WORD.test(first)) continue;
      let path = "";
      let used = 0;
      let unknown = null;
      while (used < words.length) {
        const word = words[used];
        const node = index.get(path);
        if (!COMMAND_WORD.test(word) || node.leaf) break;
        if (!node.commands.has(word)) {
          unknown = path === "" ? word : `${path} ${word}`;
          break;
        }
        path = path === "" ? word : `${path} ${word}`;
        used += 1;
      }
      const flags = words
        .slice(used)
        .map(flagOf)
        .filter((flag) => flag !== null);
      statements.push({ line: source.line, path, flags, unknown });
    }
  }
  return statements;
}

export function checkCliDoc(listing, file, markdown) {
  const index = commandIndex(listing);
  const problems = [];
  const documented = new Map();
  for (const statement of documentedCommands(markdown, listing)) {
    if (statement.unknown !== null) {
      problems.push(
        `${file}:${statement.line} documents "rex ${statement.unknown}", which the CLI does not register`,
      );
      continue;
    }
    const node = index.get(statement.path);
    const known = new Set(node.flags);
    if (statement.flags.includes("--help") || statement.flags.includes("-h"))
      known.add(HELP_JSON_FLAG);
    for (const flag of statement.flags) {
      if (!known.has(flag)) {
        problems.push(
          `${file}:${statement.line} documents ${flag} for "rex${statement.path === "" ? "" : ` ${statement.path}`}", which the CLI does not declare`,
        );
      }
    }
    const seen = documented.get(statement.path) ?? new Set();
    for (const flag of statement.flags) seen.add(flag);
    documented.set(statement.path, seen);
  }
  for (const node of index.values()) {
    if (!node.leaf || node.path === "") continue;
    const seen = documented.get(node.path);
    if (seen === undefined) {
      problems.push(`${file} does not document "rex ${node.path}"`);
      continue;
    }
    for (const flag of node.options) {
      if (!seen.has(flag)) problems.push(`${file} does not document ${flag} of "rex ${node.path}"`);
    }
  }
  return problems;
}

function versionKey(version) {
  const parts = version.split(".").map(Number);
  while (parts.length > 1 && parts[parts.length - 1] === 0) parts.pop();
  return parts.join(".");
}

export function engineFloor(range) {
  const match = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(range ?? "");
  if (match === null) return null;
  return versionKey(
    match
      .slice(1)
      .filter((part) => part !== undefined)
      .join("."),
  );
}

export function quotedNodeFloors(markdown) {
  const quotes = [];
  const pattern =
    /\bNode(?:\.js)?\s+(?:>=\s*)?v?(\d+(?:\.\d+){0,2})(?=\+|\s+or\s+(?:later|newer|higher|above)\b)/g;
  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    for (const match of line.matchAll(pattern)) {
      quotes.push({ line: index + 1, version: versionKey(match[1]) });
    }
  }
  return quotes;
}

export function checkNodeFloor(engines, documents) {
  const floor = engineFloor(engines);
  if (floor === null)
    return [`package.json engines.node ${JSON.stringify(engines)} names no version`];
  const problems = [];
  for (const document of documents) {
    const quotes = quotedNodeFloors(document.text);
    if (quotes.length === 0 && document.required) {
      problems.push(`${document.file} does not quote the Node floor (Node ${floor} or later)`);
    }
    for (const quote of quotes) {
      if (quote.version !== floor) {
        problems.push(
          `${document.file}:${quote.line} quotes Node ${quote.version}; package.json engines.node is ${JSON.stringify(engines)} (Node ${floor})`,
        );
      }
    }
  }
  return problems;
}

export function changelogHead(changelog) {
  const match = /^##\s+(.+?)\s*$/m.exec(changelog);
  return match === null ? null : match[1];
}

export function checkVersions({ packageVersion, rexVersion, newAppRex, changelog }) {
  const problems = [];
  if (rexVersion !== packageVersion) {
    problems.push(
      `REX_VERSION is ${rexVersion}; packages/rex/package.json version is ${packageVersion}`,
    );
  }
  if (newAppRex !== `^${rexVersion}`) {
    problems.push(
      `rex new writes @sidioralabs/rex ${JSON.stringify(newAppRex)}; REX_VERSION is ${rexVersion}`,
    );
  }
  const head = changelogHead(changelog);
  const escaped = rexVersion.replace(/\./g, "\\.");
  if (head === null) {
    problems.push(`${CHANGELOG} has no version heading`);
  } else if (!new RegExp(`^${escaped}(?:\\s|$)`).test(head) && !/\bunreleased\b/i.test(head)) {
    problems.push(
      `${CHANGELOG} starts with "## ${head}"; expected ${rexVersion} or an unreleased entry`,
    );
  }
  return problems;
}

let typescriptHooks = false;

function typescriptUrl() {
  return pathToFileURL(createRequire(join(ROOT, "package.json")).resolve("typescript")).href;
}

function registerTypeScript() {
  if (typescriptHooks) return;
  typescriptHooks = true;
  const hooks = `
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const ts = (await import(${JSON.stringify(typescriptUrl())})).default;
const scope = ${JSON.stringify(pathToFileURL(SOURCE_DIR).href + "/")};
export async function load(url, context, next) {
  const path = url.split("?")[0];
  if (!path.startsWith(scope) || !/\\.tsx?$/.test(path)) return next(url, context);
  const fileName = fileURLToPath(path);
  const output = ts.transpileModule(await readFile(fileName, "utf8"), {
    fileName,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      verbatimModuleSyntax: true,
    },
  });
  return { format: "module", source: output.outputText, shortCircuit: true };
}
`;
  register(`data:text/javascript,${encodeURIComponent(hooks)}`);
}

export async function loadCli() {
  registerTypeScript();
  const load = (file) => import(pathToFileURL(join(SOURCE_DIR, file)).href);
  const [cli, core, created] = await Promise.all([
    load("cli/index.ts"),
    load("index.ts"),
    load("cli/commands/new.ts"),
  ]);
  const listing = await cli.commandListing({
    cwd: ROOT,
    out: () => undefined,
    err: () => undefined,
  });
  const plan = created.baseAppPlan("freshness");
  const packageFile = plan.find((entry) => entry.kind === "file" && entry.path === "package.json");
  const newAppRex = JSON.parse(packageFile.content).dependencies["@sidioralabs/rex"];
  return { listing, rexVersion: core.REX_VERSION, newAppRex };
}

function runTool(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8" });
  if (result.error !== undefined) {
    return [`${[command, ...args].join(" ")} could not run: ${result.error.message}`];
  }
  if (result.status === 0) return [];
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return [
    `${[command, ...args].join(" ")} exited ${result.status}${output === "" ? "" : `:\n${output}`}`,
  ];
}

export async function runChecks({ skip = [] } = {}) {
  const results = [];
  const active = CHECKS.filter((name) => !skip.includes(name));
  const manifest = readJson(ROOT, "packages/rex/package.json");
  const needsCli = active.includes("cli") || active.includes("versions");
  const cli = needsCli ? await loadCli() : null;
  for (const name of active) {
    let problems;
    if (name === "exports") {
      problems = checkExports({
        root: ROOT,
        manifest,
        reference: readText(ROOT, REFERENCE_DOC),
        apiIndex: readText(ROOT, API_INDEX),
        typedoc: readJson(ROOT, TYPEDOC_CONFIG),
      });
    } else if (name === "cli") {
      problems = CLI_DOCS.flatMap((file) => checkCliDoc(cli.listing, file, readText(ROOT, file)));
    } else if (name === "node") {
      problems = checkNodeFloor(
        readJson(ROOT, "package.json").engines?.node,
        NODE_FLOOR_DOCS.map((document) => ({ ...document, text: readText(ROOT, document.file) })),
      );
    } else if (name === "versions") {
      problems = checkVersions({
        packageVersion: manifest.version,
        rexVersion: cli.rexVersion,
        newAppRex: cli.newAppRex,
        changelog: readText(ROOT, CHANGELOG),
      });
    } else if (name === "errors") {
      problems = runTool(process.execPath, ["tools/docs-errors.mjs", "--check"]);
    } else if (name === "api") {
      problems = runTool(process.execPath, ["tools/docs-api.mjs", "--check"]);
    } else if (name === "pointers") {
      problems = runTool("cg", ["spec", "render", "--check"]);
    } else {
      problems = runTool(process.execPath, ["tools/check-links.mjs"]);
    }
    results.push({ name, problems });
  }
  return results;
}

function walk(dir, keep) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const name of readdirSync(dir).sort()) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walk(path, keep));
    else if (keep(path)) files.push(path);
  }
  return files;
}

const SCRIPT = /\.tsx?$/;
const TEST_FILE = /\.(test|spec)\.tsx?$/;
const isFixture = (file) => /[\\/]fixtures[\\/]/.test(file);
const isDeclarationFile = (file) => file.endsWith(".d.ts");
const isTestHelper = (file) =>
  TEST_FILE.test(file) ||
  file === join(SOURCE_DIR, "core", "store.conformance.ts") ||
  file.startsWith(join(DEMO_DIR, "e2e") + "/") ||
  /[\\/]test[\\/]/.test(relative(DEMO_DIR, file));

function referenceGroups() {
  const packageFiles = walk(SOURCE_DIR, (file) => SCRIPT.test(file) && !isDeclarationFile(file));
  const demoFiles = walk(DEMO_DIR, (file) => SCRIPT.test(file) && !isDeclarationFile(file));
  const all = [...packageFiles, ...demoFiles];
  return {
    source: packageFiles.filter((file) => !isFixture(file) && !isTestHelper(file)),
    demo: demoFiles.filter((file) => !isFixture(file) && !isTestHelper(file)),
    helpers: all
      .filter((file) => !isFixture(file) && isTestHelper(file))
      .sort((a, b) => shown(a).localeCompare(shown(b))),
    fixtures: all.filter(isFixture).sort((a, b) => shown(a).localeCompare(shown(b))),
  };
}

function declarationLine(ts, node, source) {
  const text = node
    .getText(source)
    .split(/\r?\n/)[0]
    .replace(/\s*\{\s*$/, "")
    .trim();
  return text.length > 100 ? `${text.slice(0, 97)}...` : text;
}

function code(text) {
  const escaped = text.replace(/\|/g, "\\|");
  return escaped.includes("`") ? `\`\` ${escaped} \`\`` : `\`${escaped}\``;
}

function declarations(ts, file, withHelpers) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const rows = [];
  for (const statement of source.statements) {
    let kind = null;
    let names = [];
    if (ts.isInterfaceDeclaration(statement)) [kind, names] = ["interface", [statement.name.text]];
    else if (ts.isTypeAliasDeclaration(statement)) [kind, names] = ["type", [statement.name.text]];
    else if (ts.isClassDeclaration(statement) && statement.name)
      [kind, names] = ["class", [statement.name.text]];
    else if (ts.isEnumDeclaration(statement)) [kind, names] = ["enum", [statement.name.text]];
    else if (withHelpers && ts.isFunctionDeclaration(statement) && statement.name) {
      [kind, names] = ["function", [statement.name.text]];
    } else if (
      withHelpers &&
      ts.isVariableStatement(statement) &&
      (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
    ) {
      const helpers = statement.declarationList.declarations.filter(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.initializer !== undefined &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer)),
      );
      [kind, names] = ["constant", helpers.map((declaration) => declaration.name.text)];
    }
    for (const name of names)
      rows.push(`| \`${name}\` | ${kind} | ${code(declarationLine(ts, statement, source))} |`);
  }
  return rows;
}

function fileSections(ts, files, withHelpers) {
  const lines = [];
  for (const file of files) {
    const rows = declarations(ts, file, withHelpers);
    if (rows.length === 0) continue;
    lines.push(
      `### \`${shown(file)}\``,
      "",
      "| Symbol | Kind | Declaration |",
      "| --- | --- | --- |",
      ...rows,
      "",
    );
  }
  return lines;
}

export async function renderReference() {
  const ts = (await import(typescriptUrl())).default;
  const manifest = readJson(ROOT, "packages/rex/package.json");
  const pages = apiPages(readText(ROOT, API_INDEX));
  const groups = referenceGroups();
  const lines = [
    "# Source reference",
    "",
    "An index of the package entries and of the named types, classes, interfaces and test helpers in the repository, with the declaration of each one. It is generated from the source files by `node tools/freshness.mjs --write-reference` (long declarations are shortened with `...`), and `node tools/freshness.mjs --check` fails when a package entry has no section here. Exported functions and constants are documented in the topic pages linked from the [README](../README.md#documentation).",
    "",
    "## Package entries",
    "",
    "Every key of `exports` in `packages/rex/package.json`, with the source file it resolves to in the workspace and its page in the [API reference](api/README.md).",
    "",
  ];
  for (const entry of exportEntries(manifest)) {
    const page = pages.get(entry.specifier);
    lines.push(`### \`${entry.specifier}\``, "");
    lines.push(
      `Export \`${entry.key}\`, source [\`${entry.source}\`](../${entry.source})${page === undefined ? "" : `, API page [${entry.specifier}](api/${page})`}.`,
      "",
    );
  }
  lines.push(
    "## Package source",
    "",
    "Public and module-internal types, classes and interfaces of `packages/rex/src`. The prose documentation explains how they fit together: see [primitives.md](primitives.md), [architecture.md](architecture.md), [agent-contract.md](agent-contract.md), [cli.md](cli.md) and [convention.md](convention.md).",
    "",
    ...fileSections(ts, groups.source, false),
    "## Demo application",
    "",
    "Prop types and data types of the wallet demo in `examples/demo`, including the server's `DemoApp` type. The demo is described in the [README](../README.md#the-demo-and-the-operability-walk).",
    "",
    ...fileSections(ts, groups.demo, false),
    "## Test helpers",
    "",
    "Top-level helper functions, components and types declared inside test files, the store conformance module and the Playwright specs. They exist only to exercise the code; see [development.md](development.md#tests).",
    "",
    ...fileSections(ts, groups.helpers, true),
    "## Test fixtures",
    "",
    "Types declared in the fixture apps that the checker and client tests load.",
    "",
    ...fileSections(ts, groups.fixtures, false),
  );
  return `${lines.join("\n").trimEnd()}\n`;
}

function optionValues(argv, name) {
  const values = [];
  for (const [index, arg] of argv.entries()) {
    if (arg === name && argv[index + 1] !== undefined) values.push(argv[index + 1]);
  }
  return values;
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes("--write-reference")) {
    writeFileSync(join(ROOT, REFERENCE_DOC), await renderReference());
    process.stdout.write(`wrote ${REFERENCE_DOC}\n`);
    return 0;
  }
  if (!argv.includes("--check")) {
    process.stderr.write(
      `usage: node tools/freshness.mjs --check [--skip <${CHECKS.join("|")}>]... | --write-reference\n`,
    );
    return 2;
  }
  const skip = optionValues(argv, "--skip");
  const unknown = skip.filter((name) => !CHECKS.includes(name));
  if (unknown.length > 0) {
    process.stderr.write(
      `freshness: unknown check ${unknown.join(", ")}; known checks: ${CHECKS.join(", ")}\n`,
    );
    return 2;
  }
  const results = await runChecks({ skip });
  let failed = 0;
  for (const name of skip) process.stdout.write(`freshness: ${name} skipped (--skip ${name})\n`);
  for (const result of results) {
    if (result.problems.length === 0) {
      process.stdout.write(`freshness: ${result.name} ok\n`);
      continue;
    }
    failed += result.problems.length;
    process.stderr.write(
      `freshness: ${result.name} failed\n${result.problems.map((problem) => `  ${problem.split("\n").join("\n    ")}\n`).join("")}`,
    );
  }
  if (failed > 0) {
    process.stderr.write(`freshness: ${failed} problem${failed === 1 ? "" : "s"}\n`);
    return 1;
  }
  process.stdout.write("freshness: the docs match the code\n");
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
