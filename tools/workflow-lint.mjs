#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const eslintRequire = createRequire(require.resolve("eslint/package.json"));
const eslintrcRequire = createRequire(eslintRequire.resolve("@eslint/eslintrc/package.json"));
const { load } = eslintrcRequire("js-yaml");

export const NODE_LINES = ["22.19", "24", "26"];
export const OS_FAMILIES = ["linux", "macos", "windows"];
export const RUNTIMES = ["bun", "deno", "workerd"];
export const BROWSERS = ["chromium", "firefox", "webkit"];
export const RULES = [
  "invalid-workflow",
  "unpinned-action",
  "floating-version",
  "id-token-install",
  "missing-matrix-entry",
  "missing-codeql",
  "tag-not-on-main",
];

const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /@sha256:[0-9a-f]{64}$/;
const EXACT = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const MATRIX_EXPRESSION = /^\$\{\{\s*matrix\.([\w-]+)\s*\}\}$/;
const OS_PATTERNS = { linux: /^ubuntu-/, macos: /^macos-/, windows: /^windows-/ };
const SETUP_ACTIONS = {
  "actions/setup-node": "node-version",
  "oven-sh/setup-bun": "bun-version",
  "denoland/setup-deno": "deno-version",
};
const RUNTIME_SETUP = { bun: "oven-sh/setup-bun", deno: "denoland/setup-deno" };
const RUNNERS = new Set(["npx", "pnpx", "bunx"]);
const DLX_HOSTS = new Set(["pnpm", "yarn"]);
const INSTALL_VERBS = new Set(["install", "i", "add", "update"]);
const GLOBAL_FLAGS = new Set(["-g", "--global"]);

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finding(file, where, rule, message) {
  return { file, where, rule, message };
}

function actionName(uses) {
  const at = uses.lastIndexOf("@");
  const path = at < 0 ? uses : uses.slice(0, at);
  return path.split("/").slice(0, 2).join("/");
}

function matrixValues(job, key) {
  const matrix = job.strategy?.matrix;
  if (!isObject(matrix)) return null;
  const values = asArray(matrix[key]).map(String);
  for (const entry of asArray(matrix.include)) {
    if (isObject(entry) && entry[key] !== undefined) values.push(String(entry[key]));
  }
  return values.length === 0 ? null : values;
}

function resolveValues(value, job) {
  const text = String(value).trim();
  const match = MATRIX_EXPRESSION.exec(text);
  if (match === null) return [text];
  return matrixValues(job, match[1]) ?? [text];
}

function references(value, key) {
  const match = MATRIX_EXPRESSION.exec(String(value ?? "").trim());
  return match !== null && match[1] === key;
}

function commandsOf(script) {
  return String(script)
    .replace(/\\\r?\n/g, " ")
    .split(/\r?\n|&&|\|\||;|\|/)
    .map((command) => command.trim())
    .filter((command) => command !== "" && !command.startsWith("#"));
}

function tokensOf(command) {
  return command
    .split(/\s+/)
    .map((token) => token.replace(/^["']+|["']+$/g, ""))
    .filter((token) => token !== "");
}

function firstOperand(tokens, start) {
  for (let index = start; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.startsWith("--package=")) return token.slice("--package=".length);
    if (token === "-p" || token === "--package") return tokens[index + 1];
    if (!token.startsWith("-")) return token;
  }
  return undefined;
}

export function packageInvocations(script) {
  const found = [];
  for (const command of commandsOf(script)) {
    const tokens = tokensOf(command);
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (RUNNERS.has(token) || (token === "dlx" && DLX_HOSTS.has(tokens[index - 1]))) {
        const spec = firstOperand(tokens, index + 1);
        if (spec !== undefined) found.push({ kind: "download", spec, command });
        break;
      }
      const installer =
        (["npm", "pnpm", "bun"].includes(token) && INSTALL_VERBS.has(tokens[index + 1])) ||
        (token === "yarn" && tokens[index + 1] === "global" && tokens[index + 2] === "add");
      if (installer && tokens.some((entry) => GLOBAL_FLAGS.has(entry) || entry === "global")) {
        const start = index + (token === "yarn" ? 3 : 2);
        for (const spec of tokens.slice(start)) {
          if (!spec.startsWith("-")) found.push({ kind: "global", spec, command });
        }
        break;
      }
    }
  }
  return found;
}

export function specVersion(spec) {
  const bare = spec.startsWith("npm:") ? spec.slice(4) : spec;
  const at = bare.startsWith("@") ? bare.indexOf("@", 1) : bare.indexOf("@");
  return at < 0 ? "" : bare.slice(at + 1);
}

function isLocalSpec(spec) {
  return /^(?:\.{0,2}\/|[A-Za-z]:\\)/.test(spec) || spec.endsWith(".tgz") || spec.includes("://");
}

export function isExactVersion(value) {
  return EXACT.test(String(value));
}

export function osFamily(label) {
  for (const family of OS_FAMILIES) {
    if (OS_PATTERNS[family].test(label)) return family;
  }
  return null;
}

function holdsIdToken(job, workflow) {
  const permissions = job.permissions ?? workflow.permissions;
  if (permissions === "write-all") return true;
  return isObject(permissions) && permissions["id-token"] === "write";
}

function runnerLabels(job) {
  const runsOn = job["runs-on"];
  if (isObject(runsOn)) return asArray(runsOn.labels);
  return asArray(runsOn);
}

function stepsOf(job) {
  return asArray(job.steps).filter(isObject);
}

function lintJob(file, workflow, id, job) {
  const findings = [];
  const at = (suffix) => `jobs.${id}${suffix}`;
  if (job.uses !== undefined) findings.push(...lintUses(file, at(".uses"), job.uses));
  for (const label of runnerLabels(job).flatMap((value) => resolveValues(value, job))) {
    if (label === "latest" || label.endsWith("-latest")) {
      findings.push(
        finding(file, at(".runs-on"), "floating-version", `runner ${label} floats; name the image`),
      );
    }
  }
  const idToken = holdsIdToken(job, workflow);
  for (const [index, step] of stepsOf(job).entries()) {
    const where = at(`.steps[${index}]`);
    if (step.uses !== undefined) findings.push(...lintUses(file, `${where}.uses`, step.uses));
    if (typeof step.uses === "string") findings.push(...lintSetup(file, where, step));
    for (const [key, value] of Object.entries(isObject(step.with) ? step.with : {})) {
      if (key === "check-latest" && String(value) === "true") {
        findings.push(
          finding(file, `${where}.with.${key}`, "floating-version", "check-latest floats"),
        );
      }
      if (key === "node-version-file") {
        findings.push(
          finding(
            file,
            `${where}.with.${key}`,
            "floating-version",
            "node-version-file resolves a version range; name an exact node-version",
          ),
        );
      }
      if (key !== "version" && !key.endsWith("-version")) continue;
      for (const resolved of resolveValues(value, job)) {
        if (!isExactVersion(resolved)) {
          findings.push(
            finding(
              file,
              `${where}.with.${key}`,
              "floating-version",
              `${key} ${resolved} is not an exact version`,
            ),
          );
        }
      }
    }
    if (step.run === undefined) continue;
    for (const invocation of packageInvocations(step.run)) {
      const { kind, spec, command } = invocation;
      if (idToken) {
        findings.push(
          finding(
            file,
            `${where}.run`,
            "id-token-install",
            `a job holding id-token: write must not ${kind === "global" ? "install packages globally" : "download and run packages"}: ${command}`,
          ),
        );
      }
      if (isLocalSpec(spec)) continue;
      if (spec.includes("$") || !isExactVersion(specVersion(spec))) {
        findings.push(
          finding(
            file,
            `${where}.run`,
            "floating-version",
            `${spec} has no exact version: ${command}`,
          ),
        );
      }
    }
  }
  return findings;
}

function lintUses(file, where, uses) {
  if (typeof uses !== "string") {
    return [finding(file, where, "unpinned-action", "uses is not a string")];
  }
  if (uses.startsWith("./")) return [];
  if (uses.startsWith("docker://")) {
    return DIGEST.test(uses)
      ? []
      : [finding(file, where, "unpinned-action", `${uses} is not pinned by sha256 digest`)];
  }
  const at = uses.lastIndexOf("@");
  if (at < 0 || !SHA.test(uses.slice(at + 1))) {
    return [finding(file, where, "unpinned-action", `${uses} is not pinned to a full commit SHA`)];
  }
  return [];
}

function lintSetup(file, where, step) {
  const key = SETUP_ACTIONS[actionName(step.uses)];
  if (key === undefined) return [];
  const settings = isObject(step.with) ? step.with : {};
  if (settings[key] !== undefined || settings[`${key}-file`] !== undefined) return [];
  return [
    finding(
      file,
      `${where}.with`,
      "floating-version",
      `${actionName(step.uses)} without ${key} installs whatever version is current`,
    ),
  ];
}

function platformCombos(job) {
  const matrix = job.strategy?.matrix;
  if (!isObject(matrix)) return [];
  if (!runnerLabels(job).some((label) => references(label, "os"))) return [];
  const setup = stepsOf(job).find(
    (step) => typeof step.uses === "string" && actionName(step.uses) === "actions/setup-node",
  );
  if (setup === undefined || !references(setup.with?.["node-version"], "node")) return [];
  const nodes = asArray(matrix.node).map(String);
  const systems = asArray(matrix.os).map(String);
  let combos = nodes.flatMap((node) => systems.map((os) => ({ node, os })));
  for (const entry of asArray(matrix.exclude).filter(isObject)) {
    const keys = Object.keys(entry);
    if (!keys.every((key) => key === "node" || key === "os")) continue;
    combos = combos.filter((combo) => !keys.every((key) => String(entry[key]) === combo[key]));
  }
  for (const entry of asArray(matrix.include).filter(isObject)) {
    if (entry.node !== undefined && entry.os !== undefined) {
      combos.push({ node: String(entry.node), os: String(entry.os) });
    }
  }
  return combos;
}

function onNodeLine(version, line) {
  const bare = version.replace(/^v/, "");
  return bare === line || bare.startsWith(`${line}.`);
}

function jobFacts(job) {
  const uses = stepsOf(job)
    .map((step) => step.uses)
    .filter((value) => typeof value === "string")
    .map(actionName);
  const commands = stepsOf(job)
    .filter((step) => step.run !== undefined)
    .flatMap((step) => commandsOf(step.run))
    .map(tokensOf);
  const runtimes = new Set();
  for (const runtime of Object.keys(RUNTIME_SETUP)) {
    if (uses.includes(RUNTIME_SETUP[runtime]) && commands.some((tokens) => tokens[0] === runtime)) {
      runtimes.add(runtime);
    }
  }
  const browsers = new Set();
  let codeql = false;
  for (const tokens of commands) {
    if (tokens.some((token) => /^(?:wrangler|workerd)(?:@|$)/.test(token))) runtimes.add("workerd");
    const index = tokens.indexOf("playwright");
    if (index >= 0 && tokens[index + 1] === "install") {
      const named = tokens.slice(index + 2).filter((token) => !token.startsWith("-"));
      for (const browser of named.length === 0 ? BROWSERS : named) browsers.add(browser);
    }
  }
  for (const step of stepsOf(job)) {
    if (typeof step.uses === "string" && step.uses.startsWith("github/codeql-action/analyze@")) {
      codeql = true;
    }
  }
  return { runtimes, browsers, codeql, combos: platformCombos(job) };
}

function tagTriggered(workflow) {
  const on = workflow.on;
  if (!isObject(on) || !isObject(on.push)) return false;
  return asArray(on.push.tags).length > 0;
}

function checksAncestry(job) {
  return stepsOf(job).some((step) =>
    commandsOf(step.run ?? "").some((command) => {
      const tokens = tokensOf(command);
      const index = tokens.indexOf("merge-base");
      return (
        index > 0 &&
        tokens[index - 1] === "git" &&
        tokens.includes("--is-ancestor") &&
        tokens.some((token) => /(?:^|\/)main$/.test(token))
      );
    }),
  );
}

function lintTagAncestry(file, workflow, jobs) {
  if (!tagTriggered(workflow)) return [];
  const guards = Object.keys(jobs).filter((id) => checksAncestry(jobs[id]));
  if (guards.length === 0) {
    return [
      finding(
        file,
        "jobs",
        "tag-not-on-main",
        "a tag-triggered workflow must check with git merge-base --is-ancestor that the tag commit is on main",
      ),
    ];
  }
  const findings = [];
  for (const [id, job] of Object.entries(jobs)) {
    if (!holdsIdToken(job, workflow)) continue;
    const seen = new Set();
    const pending = asArray(job.needs).map(String);
    while (pending.length > 0) {
      const next = pending.pop();
      if (seen.has(next)) continue;
      seen.add(next);
      pending.push(...asArray(jobs[next]?.needs).map(String));
    }
    if (!guards.some((guard) => seen.has(guard))) {
      findings.push(
        finding(
          file,
          `jobs.${id}.needs`,
          "tag-not-on-main",
          `${id} holds id-token: write without needing the tag ancestry check (${guards.join(", ")})`,
        ),
      );
    }
  }
  return findings;
}

export function lintWorkflowTexts(files, label = "workflows") {
  const findings = [];
  const runtimes = new Set();
  const browsers = new Set();
  const combos = [];
  let codeql = false;
  for (const { file, text } of files) {
    let workflow;
    try {
      workflow = load(text);
    } catch (error) {
      findings.push(finding(file, "", "invalid-workflow", error.message.split("\n")[0]));
      continue;
    }
    if (!isObject(workflow) || !isObject(workflow.jobs)) {
      findings.push(finding(file, "", "invalid-workflow", "a workflow needs a jobs mapping"));
      continue;
    }
    const jobs = Object.fromEntries(
      Object.entries(workflow.jobs).filter(([, job]) => isObject(job)),
    );
    for (const [id, job] of Object.entries(jobs)) {
      findings.push(...lintJob(file, workflow, id, job));
      const facts = jobFacts(job);
      for (const runtime of facts.runtimes) runtimes.add(runtime);
      for (const browser of facts.browsers) browsers.add(browser);
      combos.push(...facts.combos);
      codeql ||= facts.codeql;
    }
    findings.push(...lintTagAncestry(file, workflow, jobs));
  }
  for (const line of NODE_LINES) {
    for (const family of OS_FAMILIES) {
      if (!combos.some((combo) => onNodeLine(combo.node, line) && osFamily(combo.os) === family)) {
        findings.push(
          finding(
            label,
            "matrix",
            "missing-matrix-entry",
            `no matrix job runs Node ${line} on ${family} (runs-on and node-version must come from matrix.os and matrix.node)`,
          ),
        );
      }
    }
  }
  for (const runtime of RUNTIMES) {
    if (!runtimes.has(runtime)) {
      findings.push(
        finding(
          label,
          "smoke",
          "missing-matrix-entry",
          runtime === "workerd"
            ? "no job runs the workerd runtime through wrangler or workerd"
            : `no job sets up ${runtime} with ${RUNTIME_SETUP[runtime]} and runs it`,
        ),
      );
    }
  }
  for (const browser of BROWSERS) {
    if (!browsers.has(browser)) {
      findings.push(
        finding(
          label,
          "browsers",
          "missing-matrix-entry",
          `no job installs the ${browser} Playwright browser`,
        ),
      );
    }
  }
  if (!codeql) {
    findings.push(
      finding(label, "codeql", "missing-codeql", "no job runs github/codeql-action/analyze"),
    );
  }
  return findings;
}

export function workflowFiles(paths) {
  const files = [];
  for (const path of paths) {
    if (statSync(path).isDirectory()) {
      for (const name of readdirSync(path).sort()) {
        if (/\.ya?ml$/.test(name)) files.push(join(path, name));
      }
    } else {
      files.push(path);
    }
  }
  return files;
}

export function lintPaths(paths, cwd = process.cwd()) {
  const files = workflowFiles(paths).map((path) => ({
    file: relative(cwd, path) || path,
    text: readFileSync(path, "utf8"),
  }));
  return { files, findings: lintWorkflowTexts(files, paths.join(" ")) };
}

export function formatFinding({ file, where, rule, message }) {
  return `${file}${where === "" ? "" : `: ${where}`}: ${message} [${rule}]`;
}

export function main(argv = process.argv.slice(2), io = {}) {
  const { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd() } = io;
  if (argv.length === 0) {
    stderr.write("usage: node tools/workflow-lint.mjs <workflow directory or file>...\n");
    return 2;
  }
  const { files, findings } = lintPaths(argv, cwd);
  if (files.length === 0) {
    stderr.write(`workflow-lint: no workflow files in ${argv.join(" ")}\n`);
    return 1;
  }
  if (findings.length > 0) {
    for (const entry of findings) stderr.write(`${formatFinding(entry)}\n`);
    stderr.write(`workflow-lint: ${findings.length} finding(s) in ${files.length} file(s)\n`);
    return 1;
  }
  stdout.write(`workflow-lint: ${files.length} workflow file(s), no findings\n`);
  return 0;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main();
}
