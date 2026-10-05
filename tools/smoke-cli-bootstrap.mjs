import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(root, "packages/rex");
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
assert.ok(
  existsSync(join(packageRoot, "dist/cli/index.js")),
  "Build the shared package artifact before this gate",
);
const work = mkdtempSync(join(tmpdir(), "rex-cli-bootstrap-"));
const env = { ...process.env, NODE_PATH: "" };

function command(bin, args, cwd, success = true) {
  const result = spawnSync(bin, args, { cwd, env, encoding: "utf8", timeout: 240_000 });
  assert.ifError(result.error);
  assert.equal(result.signal, null, `${bin} terminated: ${result.signal}`);
  if (success)
    assert.equal(result.status, 0, `${bin} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result;
}

try {
  const packed = join(work, "packed");
  mkdirSync(packed);
  command(
    "pnpm",
    ["pack", "--config.ignore-scripts=true", "--pack-destination", packed],
    packageRoot,
  );
  const archives = readdirSync(packed).filter((file) => file.endsWith(".tgz"));
  assert.equal(archives.length, 1);
  const consumer = join(work, "consumer");
  mkdirSync(consumer);
  const requiredPeers = Object.fromEntries(
    Object.entries(manifest.peerDependencies).filter(
      ([name]) => !manifest.peerDependenciesMeta?.[name]?.optional,
    ),
  );
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({
      name: "rex-cli-bootstrap",
      private: true,
      type: "module",
      dependencies: { ...requiredPeers, [manifest.name]: `file:${join(packed, archives[0])}` },
    }),
  );
  command(
    "npm",
    ["install", "--omit=optional", "--ignore-scripts", "--no-audit", "--no-fund"],
    consumer,
  );
  const installed = join(consumer, "node_modules", manifest.name);
  const require = createRequire(join(installed, "package.json"));
  for (const [name, metadata] of Object.entries(manifest.peerDependenciesMeta)) {
    if (!metadata.optional) continue;
    assert.throws(
      () => require.resolve(name),
      { code: "MODULE_NOT_FOUND" },
      `${name} must not be available to the installed CLI`,
    );
  }
  const cli = join(installed, "dist/cli/index.js");
  const run = (args, success = true) =>
    command(process.execPath, [cli, ...args], consumer, success);
  const help = run(["--help", "--json"]);
  const tree = JSON.parse(help.stdout);
  for (const name of [
    "build",
    "check",
    "dev",
    "make",
    "manifest",
    "migrate",
    "new",
    "promote",
    "version",
  ]) {
    assert.ok(
      tree.commands.some((item) => item.name === name),
      `missing command ${name}`,
    );
    assert.match(run([name, "--help"]).stdout, new RegExp(`Usage: rex ${name}`));
  }
  assert.equal(run(["version"]).stdout.trim(), manifest.version);
  assert.equal(run(["--version"]).stdout.trim(), manifest.version);
  run(["new", "bootstrap-app", "--ui", "none", "--no-install"]);
  assert.ok(existsSync(join(consumer, "bootstrap-app/rex.config.ts")));
  assert.ok(!existsSync(join(consumer, "bootstrap-app/node_modules")));
  const missing = run(["dev", "--no-check"], false);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /optional dependency/);
  assert.match(missing.stderr, /(?:npm|pnpm) (?:add|install)/);
  console.log(
    "CLI bootstrap passed: clean packed install, complete help, version, generation, missing-dependency diagnostic",
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
