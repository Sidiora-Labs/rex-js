import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_DIR = join(ROOT, "packages", "rex");
const SOURCE_CONDITION = "rex-source";
const CONDITION_ORDER = [SOURCE_CONDITION, "types", "default"];
const TARBALL_VARIABLE = "REX_PACKAGE_TARBALL";
const INSTALL_TIMEOUT_MS = 600_000;
const NODE_FLOOR_DOCS = ["README.md", "docs/development.md"];
const SERVER_ENTRIES = [
  ".",
  "./config",
  "./schema",
  "./manifest",
  "./server",
  "./server/node",
  "./server/bun",
  "./server/deno",
  "./server/edge",
  "./server-only",
  "./check/catalog",
];
const BUILD_TOOL_PEERS = ["vite", "typescript", "@vitejs/plugin-react"];
const IMPORT_SCRIPT = `
const results = {};
for (const specifier of JSON.parse(process.argv[1])) {
  try {
    if (specifier.endsWith(".json")) await import(specifier, { with: { type: "json" } });
    else await import(specifier);
    results[specifier] = "ok";
  } catch (error) {
    results[specifier] = String(error?.message ?? error).split("\\n")[0];
  }
}
process.stdout.write(JSON.stringify(results));
`;

const RESOLVE_SCRIPT = `
import { createRequire } from "node:module";
import { join } from "node:path";
const ts = createRequire(join(process.cwd(), "package.json"))("typescript");
const options = {
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
};
const importer = join(process.cwd(), "entries.ts");
const results = {};
for (const specifier of JSON.parse(process.argv[1])) {
  const { resolvedModule } = ts.resolveModuleName(specifier, importer, options, ts.sys);
  results[specifier] = resolvedModule?.resolvedFileName ?? null;
}
process.stdout.write(JSON.stringify(results));
`;

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

const manifest = readJson(join(PACKAGE_DIR, "package.json"));
const rootManifest = readJson(join(ROOT, "package.json"));
const entries = Object.entries(manifest.exports);
const peers = Object.entries(manifest.peerDependencies);
const optional = new Set(
  Object.entries(manifest.peerDependenciesMeta ?? {})
    .filter(([, meta]) => meta.optional === true)
    .map(([name]) => name),
);
const requiredPeers = peers.filter(([name]) => !optional.has(name));
const optionalPeers = peers.filter(([name]) => optional.has(name));

function specifier(key) {
  return key === "." ? manifest.name : `${manifest.name}/${key.slice(2)}`;
}

function relativePath(target) {
  return target.replace(/^\.\//, "");
}

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: INSTALL_TIMEOUT_MS,
  });
}

function pnpmAdd(project, specs) {
  run(
    "pnpm",
    ["add", "--prefer-offline", "--config.auto-install-peers=true", "--reporter=silent", ...specs],
    project,
  );
}

function importAll(project, keys) {
  const output = run(
    process.execPath,
    ["--input-type=module", "-e", IMPORT_SCRIPT, JSON.stringify(keys.map(specifier))],
    project,
  );
  return JSON.parse(output);
}

function allOk(keys) {
  return Object.fromEntries(keys.map((key) => [specifier(key), "ok"]));
}

describe("the @sidioralabs/rex exports map", () => {
  it("resolves every entry to dist and reaches src only through the rex-source condition", () => {
    assert.equal(manifest.publishConfig?.exports, undefined);
    assert.ok(entries.length > 0);
    for (const [key, target] of entries) {
      if (key.endsWith(".json")) {
        assert.equal(target, `./${key.slice(2)}`, key);
        continue;
      }
      assert.deepEqual(Object.keys(target), CONDITION_ORDER, key);
      assert.match(target[SOURCE_CONDITION], /^\.\/src\/.+\.tsx?$/, key);
      assert.ok(existsSync(join(PACKAGE_DIR, target[SOURCE_CONDITION])), key);
      const base = target[SOURCE_CONDITION].replace(/^\.\/src\//, "./dist/").replace(/\.tsx?$/, "");
      assert.equal(target.types, `${base}.d.ts`, key);
      assert.equal(target.default, `${base}.js`, key);
    }
  });

  it("selects rex-source in the workspace TypeScript and Vitest configs", () => {
    const base = readJson(join(ROOT, "tsconfig.base.json"));
    assert.deepEqual(base.compilerOptions.customConditions, [SOURCE_CONDITION]);
    const site = readJson(join(ROOT, "site", "tsconfig.json"));
    assert.deepEqual(site.compilerOptions.customConditions, [SOURCE_CONDITION]);
    assert.equal(readJson(join(PACKAGE_DIR, "tsconfig.json")).compilerOptions.paths, undefined);
    for (const config of [
      "packages/rex/vitest.config.ts",
      "examples/demo/vitest.config.ts",
      "site/vitest.config.ts",
    ]) {
      const text = readFileSync(join(ROOT, config), "utf8");
      assert.ok(text.includes(`"${SOURCE_CONDITION}"`), config);
      assert.match(text, /conditions: \[SOURCE_CONDITION, \.\.\.defaultClientConditions\]/, config);
      assert.match(text, /conditions: \[SOURCE_CONDITION, \.\.\.defaultServerConditions\]/, config);
    }
  });

  it("states one Node floor in the package, the root manifest and the documents", () => {
    const range = manifest.engines.node;
    assert.equal(rootManifest.engines.node, range);
    for (const document of NODE_FLOOR_DOCS) {
      assert.ok(readFileSync(join(ROOT, document), "utf8").includes(`\`${range}\``), document);
    }
  });

  it("emits source maps and declaration maps and runs no package install in its build", () => {
    const build = readJson(join(PACKAGE_DIR, "tsconfig.build.json"));
    assert.equal(build.compilerOptions.sourceMap, true);
    assert.equal(build.compilerOptions.declarationMap, true);
    assert.doesNotMatch(
      manifest.scripts.build,
      /\b(?:pnpm|npm|yarn|bun)\b[^&|;]*\b(?:install|i|add)\b/,
    );
  });

  it("marks wouter, cmdk and @hono/node-server required and the build tools optional", () => {
    for (const peer of ["wouter", "cmdk", "@hono/node-server"]) {
      assert.ok(manifest.peerDependencies[peer], peer);
      assert.equal(optional.has(peer), false, peer);
    }
    for (const peer of BUILD_TOOL_PEERS) {
      assert.ok(manifest.peerDependencies[peer], peer);
      assert.equal(optional.has(peer), true, peer);
    }
  });
});

describe("the packed @sidioralabs/rex tarball", { timeout: INSTALL_TIMEOUT_MS * 3 }, () => {
  let work;
  let tarball;
  let project;

  before(() => {
    work = mkdtempSync(join(tmpdir(), "rex-package-exports-"));
    const given = process.env[TARBALL_VARIABLE];
    if (given !== undefined && given !== "") {
      tarball = resolve(given);
    } else {
      assert.ok(
        existsSync(join(PACKAGE_DIR, "dist", "index.js")),
        "packages/rex/dist is missing: run pnpm -C packages/rex build first",
      );
      const destination = join(work, "pack");
      run("pnpm", ["pack", "--pack-destination", destination], PACKAGE_DIR);
      const packed = readdirSync(destination).filter((name) => name.endsWith(".tgz"));
      assert.equal(packed.length, 1, `expected one tarball in ${destination}`);
      tarball = join(destination, packed[0]);
    }
    assert.ok(existsSync(tarball), `tarball not found: ${tarball}`);
    project = join(work, "consumer");
    mkdirSync(project);
    writeFileSync(
      join(project, "package.json"),
      `${JSON.stringify({ name: "rex-package-exports", private: true, type: "module" }, null, 2)}\n`,
    );
  });

  after(() => {
    if (work !== undefined) rmSync(work, { recursive: true, force: true });
  });

  it("ships every entry from dist with source maps and declaration maps and no source", () => {
    const files = new Set(
      run("tar", ["-tzf", tarball], work)
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => line.replace(/^package\//, "")),
    );
    for (const file of files) assert.equal(file.startsWith("src/"), false, file);
    const packed = JSON.parse(run("tar", ["-xzOf", tarball, "package/package.json"], work));
    assert.deepEqual(packed.exports, manifest.exports);
    assert.equal(packed.publishConfig?.exports, undefined);
    for (const [key, target] of entries) {
      if (typeof target === "string") {
        assert.ok(files.has(relativePath(target)), key);
        continue;
      }
      const code = relativePath(target.default);
      const types = relativePath(target.types);
      for (const file of [code, `${code}.map`, types, `${types}.map`]) {
        assert.ok(files.has(file), `${key}: ${file}`);
      }
      assert.match(
        readTarText(tarball, work, code),
        /\/\/# sourceMappingURL=\S+\.js\.map\s*$/,
        key,
      );
    }
  });

  it("imports the server entries with only the required peers and no build-tool peer", () => {
    pnpmAdd(project, [tarball, ...requiredPeers.map(([name, range]) => `${name}@${range}`)]);
    for (const [name] of optionalPeers) {
      assert.equal(existsSync(join(project, "node_modules", name)), false, name);
    }
    assert.deepEqual(importAll(project, SERVER_ENTRIES), allOk(SERVER_ENTRIES));
  });

  it("imports every exports key with node once the real peers are installed", () => {
    pnpmAdd(
      project,
      optionalPeers.map(([name, range]) => `${name}@${range}`),
    );
    const keys = entries.map(([key]) => key);
    assert.deepEqual(importAll(project, keys), allOk(keys));
  });

  it("resolves the types of every entry", () => {
    const keys = entries.map(([key]) => key).filter((key) => !key.endsWith(".json"));
    writeFileSync(
      join(project, "entries.ts"),
      keys.map((key, index) => `export * as entry${index} from "${specifier(key)}";\n`).join(""),
    );
    writeFileSync(
      join(project, "tsconfig.json"),
      `${JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            skipLibCheck: true,
            noEmit: true,
            types: [],
          },
          files: ["entries.ts"],
        },
        null,
        2,
      )}\n`,
    );
    const tsc = join(project, "node_modules", "typescript", "bin", "tsc");
    run(process.execPath, [tsc, "-p", "tsconfig.json"], project);
    const resolved = JSON.parse(
      run(
        process.execPath,
        ["--input-type=module", "-e", RESOLVE_SCRIPT, JSON.stringify(keys.map(specifier))],
        project,
      ),
    );
    for (const key of keys) {
      const types = relativePath(manifest.exports[key].types);
      assert.ok(
        resolved[specifier(key)]?.endsWith(`/@sidioralabs/rex/${types}`),
        `${key} types resolved to ${resolved[specifier(key)]}`,
      );
    }
  });
});

function readTarText(file, cwd, path) {
  return run("tar", ["-xzOf", file, `package/${path}`], cwd);
}
