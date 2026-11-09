import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkWindow,
  computeRange,
  formatResultLine,
  MATRIX,
  majorOf,
  parseResultLine,
  parseResultLines,
  parseResultsTable,
  prepareCopy,
  rangeMajors,
  recordResults,
  renderResultsTable,
} from "./support-window.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

const RESULTS = [
  { tool: "typescript", major: 5, version: "5.9.3", result: "pass", command: "" },
  { tool: "typescript", major: 6, version: "6.0.3", result: "pass", command: "" },
  {
    tool: "typescript",
    major: 7,
    version: "7.0.2",
    result: "fail",
    command: "pnpm -C packages/rex typecheck (exit 2)",
  },
  { tool: "eslint", major: 9, version: "9.39.5", result: "pass", command: "" },
  { tool: "eslint", major: 10, version: "10.14.0", result: "pass", command: "" },
];

test("majorOf reads the major of a version or a caret range", () => {
  assert.equal(majorOf("5.9.3"), 5);
  assert.equal(majorOf("^10.14.0"), 10);
  assert.throws(() => majorOf("latest"), /not a version/);
});

test("a printed result line round-trips through the parser", () => {
  for (const result of RESULTS) {
    assert.deepEqual(parseResultLine(formatResultLine(result)), result);
  }
  assert.equal(
    formatResultLine(RESULTS[2]),
    "support-window typescript 7.0.2 fail: pnpm -C packages/rex typecheck (exit 2)",
  );
});

test("the line parser rejects malformed and contradictory lines", () => {
  assert.equal(parseResultLine("support-window typescript 7.0.2 fail"), null);
  assert.equal(parseResultLine("support-window typescript 6.0.3 pass: pnpm install"), null);
  assert.equal(parseResultLine("support-window typescript 6 pass"), null);
  assert.equal(parseResultLine("$ pnpm install --no-frozen-lockfile"), null);
  assert.deepEqual(
    parseResultLines(
      "$ pnpm install\nsupport-window eslint 10.14.0 pass\nnoise\nsupport-window eslint 9.39.5 pass\n",
    ).map((result) => result.version),
    ["10.14.0", "9.39.5"],
  );
});

test("a rendered table parses back to the same results", () => {
  const markdown = `# Versioning\n\n${renderResultsTable(RESULTS)}\n\nAfter.\n`;
  assert.deepEqual(parseResultsTable(markdown), RESULTS);
});

test("the table parser refuses a row under the wrong major or a failure without a command", () => {
  assert.throws(
    () => parseResultsTable("| `typescript` | 6 | 5.9.3 | pass | |"),
    /listed under major 6/,
  );
  assert.throws(
    () => parseResultsTable("| `typescript` | 7 | 7.0.2 | fail | |"),
    /without a recorded command/,
  );
});

test("recordResults replaces only the results table", () => {
  const before = `# Title\n\nIntro.\n\n${renderResultsTable([{ ...RESULTS[0], result: "fail", command: "x" }])}\n\nTail.\n`;
  const after = recordResults(before, RESULTS);
  assert.ok(after.startsWith("# Title\n\nIntro.\n\n| Package"));
  assert.ok(after.endsWith("\n\nTail.\n"));
  assert.deepEqual(parseResultsTable(after), RESULTS);
  assert.throws(() => recordResults("# Nothing\n", RESULTS), /no support window table/);
});

test("computeRange joins the passing majors in order and leaves failures out", () => {
  assert.equal(computeRange(RESULTS, "typescript"), "^5.9.3 || ^6.0.3");
  assert.equal(computeRange([...RESULTS].reverse(), "eslint"), "^9.39.5 || ^10.14.0");
  assert.deepEqual(rangeMajors("^9.39.5 || ^10.14.0"), [9, 10]);
  assert.throws(
    () => computeRange([{ ...RESULTS[2] }], "typescript"),
    /typescript has no passing major/,
  );
  assert.throws(
    () => computeRange([RESULTS[0], { ...RESULTS[0], version: "5.8.0" }], "typescript"),
    /more than one passing result/,
  );
});

test("checkWindow accepts peers equal to the tested window", () => {
  const rexManifest = {
    peerDependencies: { typescript: "^5.9.3 || ^6.0.3", eslint: "^9.39.5 || ^10.14.0" },
    devDependencies: { typescript: "^5.9.3", eslint: "^9.39.5" },
  };
  assert.deepEqual(checkWindow({ results: RESULTS, rexManifest, rootManifest: {} }), []);
});

test("checkWindow reports a peer that admits a failing major or omits a passing one", () => {
  const problems = checkWindow({
    results: RESULTS,
    rexManifest: {
      peerDependencies: { typescript: "^5.9.3 || ^6.0.3 || ^7.0.2", eslint: "^9.39.5" },
    },
    rootManifest: { devDependencies: { typescript: "^7.0.2" } },
  });
  assert.equal(problems.length, 3);
  assert.match(problems[0], /peerDependencies\.typescript .*"\^5\.9\.3 \|\| \^6\.0\.3"/);
  assert.match(problems[1], /package\.json devDependencies\.typescript \^7\.0\.2 is outside/);
  assert.match(problems[2], /peerDependencies\.eslint .*"\^9\.39\.5 \|\| \^10\.14\.0"/);
});

test("checkWindow reports a matrix version without exactly one recorded result", () => {
  const problems = checkWindow({
    results: [...RESULTS.slice(1), { ...RESULTS[3], tool: "eslint", version: "8.57.1", major: 8 }],
    rexManifest: {
      peerDependencies: { typescript: "^6.0.3", eslint: "^8.57.1 || ^9.39.5 || ^10.14.0" },
    },
    rootManifest: {},
  });
  assert.deepEqual(problems, [
    "docs/versioning.md records 0 results for typescript 5.9.3",
    "docs/versioning.md records eslint 8.57.1, which the matrix does not list",
  ]);
});

test("the matrix lists every current major of TypeScript and ESLint once", () => {
  const keys = MATRIX.map((entry) => `${entry.tool}@${majorOf(entry.version)}`);
  assert.deepEqual(keys, ["typescript@5", "typescript@6", "typescript@7", "eslint@9", "eslint@10"]);
});

test("the repository records a result for every matrix version and its peers match", () => {
  const results = parseResultsTable(readFileSync(join(root, "docs", "versioning.md"), "utf8"));
  const read = (file) => JSON.parse(readFileSync(join(root, file), "utf8"));
  assert.deepEqual(
    checkWindow({
      results,
      rexManifest: read("packages/rex/package.json"),
      rootManifest: read("package.json"),
    }),
    [],
  );
});

test("prepareCopy pins the tool in a temporary workspace holding the package and the site", () => {
  const dir = prepareCopy(root, { tool: "eslint", version: "10.14.0" });
  try {
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    assert.equal(manifest.pnpm.overrides.eslint, "10.14.0");
    const workspace = readFileSync(join(dir, "pnpm-workspace.yaml"), "utf8");
    assert.match(workspace, /^packages:\n {2}- packages\/rex\n {2}- site\n/);
    assert.doesNotMatch(workspace, /examples/);
    assert.ok(existsSync(join(dir, "site", "app", "server", "content", "meta.ts")));
    assert.ok(!existsSync(join(dir, "site", "node_modules")));
    assert.ok(existsSync(join(dir, "packages", "rex", "src", "check", "rules", "typecheck.ts")));
    assert.ok(!existsSync(join(dir, "packages", "rex", "node_modules")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
