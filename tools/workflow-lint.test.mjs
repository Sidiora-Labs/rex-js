import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { lintPaths, lintWorkflowTexts, packageInvocations, specVersion } from "./workflow-lint.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const tool = join(root, "tools", "workflow-lint.mjs");
const SHA = "fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09";

const CI = `name: CI
on: [push]
permissions:
  contents: read
jobs:
  platform:
    runs-on: \${{ matrix.os }}
    strategy:
      matrix:
        node: ["22.19.0", "24.22.2", "26.13.0"]
        os: [ubuntu-24.04, macos-15, windows-2025]
    steps:
      - uses: actions/checkout@${SHA} # v5.1.0
      - uses: actions/setup-node@${SHA} # v5.0.0
        with:
          node-version: \${{ matrix.node }}
      - run: pnpm -C packages/rex test
  browsers:
    runs-on: ubuntu-24.04
    steps:
      - uses: docker://node@sha256:${"a".repeat(64)}
      - run: pnpm exec playwright install --with-deps chromium firefox webkit
      - run: pnpm dlx publint@0.3.25 package.tgz
  bun:
    runs-on: ubuntu-24.04
    steps:
      - uses: oven-sh/setup-bun@${SHA}
        with:
          bun-version: 1.4.4
      - run: bun smoke.mjs
  deno:
    runs-on: ubuntu-24.04
    steps:
      - uses: denoland/setup-deno@${SHA}
        with:
          deno-version: v2.9.8
      - run: deno run --allow-net smoke.mjs
  workerd:
    runs-on: ubuntu-24.04
    steps:
      - run: |
          pnpm dlx wrangler@4.158.0 dev worker.mjs --port 8787 &
          curl -fsS http://127.0.0.1:8787/rex/health
  codeql:
    runs-on: ubuntu-24.04
    steps:
      - uses: github/codeql-action/analyze@${SHA}
`;

const RELEASE = `name: Release
on:
  push:
    tags:
      - "v*"
jobs:
  prepare:
    runs-on: ubuntu-24.04
    steps:
      - run: |
          git fetch --no-tags origin +refs/heads/main:refs/remotes/origin/main
          if ! git merge-base --is-ancestor "$GITHUB_SHA" origin/main; then exit 1; fi
  checks:
    needs: prepare
    uses: ./.github/workflows/checks.yml
  publish:
    needs: [checks]
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/setup-node@${SHA}
        with:
          node-version: 24.22.2
      - run: npm publish package.tgz --provenance --access public
`;

function lint({ ci = CI, release = RELEASE } = {}) {
  return lintWorkflowTexts([
    { file: "ci.yml", text: ci },
    { file: "release.yml", text: release },
  ]);
}

function rules(findings) {
  return [...new Set(findings.map((entry) => entry.rule))].sort();
}

function messages(findings) {
  return findings.map((entry) => entry.message).join("\n");
}

function replaced(text, from, to) {
  assert.ok(text.includes(from), `fixture lacks ${from}`);
  return text.replace(from, to);
}

function cli(args) {
  return spawnSync(process.execPath, [tool, ...args], { cwd: root, encoding: "utf8" });
}

function withFixtures(files, run) {
  const dir = mkdtempSync(join(tmpdir(), "rex-workflow-lint-"));
  try {
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the repository workflows pass the lint", () => {
  const { files, findings } = lintPaths([join(root, ".github", "workflows")], root);
  assert.ok(files.length >= 4);
  assert.deepEqual(findings, []);
});

test("a complete, pinned workflow set passes and the CLI exits 0", () => {
  assert.deepEqual(lint(), []);
  withFixtures({ "ci.yml": CI, "release.yml": RELEASE }, (dir) => {
    const run = cli([dir]);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /2 workflow file\(s\), no findings/);
  });
});

test("an action pinned by tag or branch is an unpinned action", () => {
  for (const ref of ["v5", "main", "v5.1.0", SHA.slice(0, 12)]) {
    const findings = lint({
      ci: replaced(CI, `actions/checkout@${SHA}`, `actions/checkout@${ref}`),
    });
    assert.deepEqual(rules(findings), ["unpinned-action"], ref);
    assert.match(messages(findings), new RegExp(`actions/checkout@${ref} is not pinned`));
  }
  const docker = lint({
    ci: replaced(CI, /docker:\/\/node@sha256:a+/.exec(CI)[0], "docker://node:24"),
  });
  assert.deepEqual(rules(docker), ["unpinned-action"]);
  const reusable = lint({
    release: replaced(
      RELEASE,
      "./.github/workflows/checks.yml",
      "octo/ci/.github/workflows/checks.yml@v1",
    ),
  });
  assert.deepEqual(rules(reusable), ["unpinned-action"]);
  withFixtures(
    {
      "ci.yml": replaced(CI, `actions/checkout@${SHA}`, "actions/checkout@v5"),
      "release.yml": RELEASE,
    },
    (dir) => {
      const run = cli([dir]);
      assert.equal(run.status, 1);
      assert.match(
        run.stderr,
        /actions\/checkout@v5 is not pinned to a full commit SHA \[unpinned-action\]/,
      );
    },
  );
});

test("a floating tool version fails", () => {
  const cases = [
    ["pnpm dlx publint@0.3.25", "pnpm dlx publint"],
    ["pnpm dlx publint@0.3.25", "pnpm dlx publint@latest"],
    ["pnpm dlx publint@0.3.25", "npx --yes publint@^0.3.0"],
    ["pnpm dlx wrangler@4.158.0", "pnpm dlx wrangler@4"],
    ["bun-version: 1.4.4", "bun-version: latest"],
    ["deno-version: v2.9.8", "deno-version: v2.x"],
    ['"26.13.0"', '"lts/*"'],
    ['"26.13.0"', "26"],
    [
      "runs-on: ubuntu-24.04\n    steps:\n      - uses: oven",
      "runs-on: ubuntu-latest\n    steps:\n      - uses: oven",
    ],
    [
      "          bun-version: 1.4.4\n",
      "          bun-version: 1.4.4\n          check-latest: true\n",
    ],
  ];
  for (const [from, to] of cases) {
    const findings = lint({ ci: replaced(CI, from, to) });
    assert.ok(rules(findings).includes("floating-version"), `${to}: ${messages(findings)}`);
  }
  const unversioned = lint({
    ci: replaced(CI, "        with:\n          bun-version: 1.4.4\n", ""),
  });
  assert.deepEqual(rules(unversioned), ["floating-version"]);
  assert.match(messages(unversioned), /oven-sh\/setup-bun without bun-version/);
  const versionFile = lint({
    release: replaced(RELEASE, "node-version: 24.22.2", "node-version-file: package.json"),
  });
  assert.deepEqual(rules(versionFile), ["floating-version"]);
});

test("a job holding id-token: write may not install or download packages", () => {
  const upgrade = lint({
    release: replaced(
      RELEASE,
      "      - run: npm publish",
      "      - run: npm install -g npm@latest && npm --version\n      - run: npm publish",
    ),
  });
  assert.deepEqual(rules(upgrade), ["floating-version", "id-token-install"]);
  const pinned = lint({
    release: replaced(
      RELEASE,
      "      - run: npm publish",
      "      - run: npm i -g npm@11.6.2\n      - run: npm publish",
    ),
  });
  assert.deepEqual(rules(pinned), ["id-token-install"]);
  const dlx = lint({
    release: replaced(
      RELEASE,
      "      - run: npm publish",
      "      - run: pnpm dlx publint@0.3.25 x.tgz\n      - run: npm publish",
    ),
  });
  assert.deepEqual(rules(dlx), ["id-token-install"]);
});

test("a missing matrix entry fails", () => {
  const noWindows = lint({
    ci: replaced(CI, "os: [ubuntu-24.04, macos-15, windows-2025]", "os: [ubuntu-24.04, macos-15]"),
  });
  assert.deepEqual(rules(noWindows), ["missing-matrix-entry"]);
  assert.equal(noWindows.length, 3);
  assert.match(messages(noWindows), /no matrix job runs Node 26 on windows/);
  const excluded = lint({
    ci: replaced(
      CI,
      "        os: [ubuntu-24.04, macos-15, windows-2025]\n",
      '        os: [ubuntu-24.04, macos-15, windows-2025]\n        exclude:\n          - node: "26.13.0"\n            os: macos-15\n',
    ),
  });
  assert.deepEqual(
    messages(excluded),
    "no matrix job runs Node 26 on macos (runs-on and node-version must come from matrix.os and matrix.node)",
  );
  const included = lint({
    ci: replaced(
      CI,
      "        os: [ubuntu-24.04, macos-15, windows-2025]\n",
      '        os: [ubuntu-24.04, macos-15]\n        include:\n          - { node: "22.19.0", os: windows-2025 }\n          - { node: "24.22.2", os: windows-2025 }\n          - { node: "26.13.0", os: windows-2025 }\n',
    ),
  });
  assert.deepEqual(included, []);
  const fixedRunner = lint({
    ci: replaced(CI, "runs-on: ${{ matrix.os }}", "runs-on: ubuntu-24.04"),
  });
  assert.equal(fixedRunner.filter((entry) => entry.rule === "missing-matrix-entry").length, 9);
  const noNode22 = lint({ ci: replaced(CI, '"22.19.0", ', "") });
  assert.match(messages(noNode22), /Node 22\.19 on linux/);
  const noDeno = lint({ ci: replaced(CI, "      - run: deno run --allow-net smoke.mjs\n", "") });
  assert.deepEqual(messages(noDeno), "no job sets up deno with denoland/setup-deno and runs it");
  const noBun = lint({ ci: replaced(CI, "      - run: bun smoke.mjs\n", "") });
  assert.deepEqual(messages(noBun), "no job sets up bun with oven-sh/setup-bun and runs it");
  const noWorkerd = lint({
    ci: replaced(CI, "pnpm dlx wrangler@4.158.0 dev worker.mjs --port 8787 &", "true"),
  });
  assert.deepEqual(
    messages(noWorkerd),
    "no job runs the workerd runtime through wrangler or workerd",
  );
  const chromiumOnly = lint({ ci: replaced(CI, "chromium firefox webkit", "chromium") });
  assert.deepEqual(rules(chromiumOnly), ["missing-matrix-entry"]);
  assert.match(messages(chromiumOnly), /firefox Playwright browser\n.*webkit Playwright browser/);
  const everyBrowser = lint({
    ci: replaced(CI, "--with-deps chromium firefox webkit", "--with-deps"),
  });
  assert.deepEqual(everyBrowser, []);
  const noCodeql = lint({
    ci: replaced(
      CI,
      `      - uses: github/codeql-action/analyze@${SHA}\n`,
      "      - run: echo none\n",
    ),
  });
  assert.deepEqual(rules(noCodeql), ["missing-codeql"]);
});

test("a tag-triggered publish that does not check the tag is on main fails", () => {
  const unguarded = lint({
    release: replaced(
      RELEASE,
      '          if ! git merge-base --is-ancestor "$GITHUB_SHA" origin/main; then exit 1; fi\n',
      "          git describe --tags\n",
    ),
  });
  assert.deepEqual(rules(unguarded), ["tag-not-on-main"]);
  const otherBranch = lint({
    release: replaced(RELEASE, '"$GITHUB_SHA" origin/main', '"$GITHUB_SHA" origin/develop'),
  });
  assert.deepEqual(rules(otherBranch), ["tag-not-on-main"]);
  const bypassed = lint({ release: replaced(RELEASE, "    needs: [checks]\n", "") });
  assert.deepEqual(rules(bypassed), ["tag-not-on-main"]);
  assert.match(
    messages(bypassed),
    /publish holds id-token: write without needing the tag ancestry check \(prepare\)/,
  );
  withFixtures(
    { "ci.yml": CI, "release.yml": replaced(RELEASE, "    needs: [checks]\n", "") },
    (dir) => {
      const run = cli([dir]);
      assert.equal(run.status, 1);
      assert.match(run.stderr, /\[tag-not-on-main\]/);
    },
  );
});

test("an unreadable workflow and a missing argument fail", () => {
  assert.deepEqual(rules(lint({ ci: "jobs: [\n" })), [
    "invalid-workflow",
    "missing-codeql",
    "missing-matrix-entry",
  ]);
  const usage = cli([]);
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /usage: node tools\/workflow-lint\.mjs/);
  withFixtures({ "notes.txt": "" }, (dir) => {
    const empty = cli([dir]);
    assert.equal(empty.status, 1);
    assert.match(empty.stderr, /no workflow files/);
  });
});

test("package invocations and their versions are read from run scripts", () => {
  assert.deepEqual(
    packageInvocations("pnpm dlx @arethetypeswrong/cli@0.18.5 --profile esm-only x.tgz").map(
      (entry) => [entry.kind, entry.spec],
    ),
    [["download", "@arethetypeswrong/cli@0.18.5"]],
  );
  assert.deepEqual(
    packageInvocations("npm install -g npm@latest && npm --version\nyarn global add serve").map(
      (entry) => [entry.kind, entry.spec],
    ),
    [
      ["global", "npm@latest"],
      ["global", "serve"],
    ],
  );
  assert.deepEqual(
    packageInvocations("pnpm install --frozen-lockfile\npnpm exec playwright install"),
    [],
  );
  assert.equal(specVersion("@arethetypeswrong/cli@0.18.5"), "0.18.5");
  assert.equal(specVersion("publint"), "");
  assert.equal(specVersion("npm:wrangler@4.158.0"), "4.158.0");
});

test("the demo and the site declare Firefox and WebKit Playwright projects", () => {
  for (const config of ["examples/demo/playwright.config.ts", "site/playwright.config.ts"]) {
    const text = readFileSync(join(root, config), "utf8");
    assert.match(text, /name: "firefox"/, config);
    assert.match(text, /name: "webkit"/, config);
    assert.match(text, /devices\["Desktop Firefox"\]/, config);
    assert.match(text, /devices\["Desktop Safari"\]/, config);
  }
});
