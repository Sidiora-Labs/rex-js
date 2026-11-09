import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { main as runWorkspaceTests, workspacePackages } from "./run-workspace-tests.mjs";
import { PACKAGES as RATIO_PACKAGES } from "./test-ratio.mjs";

const require = createRequire(import.meta.url);
const eslintRequire = createRequire(require.resolve("eslint/package.json"));
const eslintrcRequire = createRequire(eslintRequire.resolve("@eslint/eslintrc/package.json"));
const { load } = eslintrcRequire("js-yaml");
const requiredJobs = ["verify", "lint", "coverage", "demo", "docs", "supply-chain", "package"];

const root = fileURLToPath(new URL("..", import.meta.url));

function manifest(dir) {
  return JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8"));
}

function gateCommands(script) {
  const text = readFileSync(join(root, "tools", script), "utf8");
  const commands = [];
  for (const line of text.split("\n")) {
    const match = /^gate (\S+) (.+)$/.exec(line);
    if (match) commands.push(match[2]);
  }
  return { text, commands };
}

function sink() {
  const chunks = [];
  return { write: (chunk) => chunks.push(chunk), text: () => chunks.join("") };
}

function workflow(name) {
  return load(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), "utf8"));
}

function requiredStep(job, command) {
  const step = job.steps.find((entry) => entry.run === command);
  assert.ok(step, `missing command: ${command}`);
  assert.equal(step.if, undefined);
  assert.equal(step["continue-on-error"] ?? false, false);
  return step;
}

for (const name of ["ci", "release"]) {
  test(`${name} enforces the ratio in a required verification job`, () => {
    const callers = workflow(name).jobs;
    assert.equal(callers.checks.uses, "./.github/workflows/checks.yml");
    assert.equal(callers.checks.if, undefined);
    assert.equal(callers.checks["continue-on-error"] ?? false, false);
    const gate = name === "ci" ? callers.gate : callers.publish;
    assert.ok(gate.needs.includes("checks"), `${name} must require the checks workflow`);
    const checks = workflow("checks");
    assert.deepEqual(Object.keys(checks.on), ["workflow_call"]);
    const { jobs } = checks;
    const verify = jobs.verify;
    assert.equal(verify.if, undefined);
    assert.equal(verify["continue-on-error"] ?? false, false);
    requiredStep(verify, "node --test tools/qualification-gates.test.mjs");
    requiredStep(verify, "node tools/test-ratio.mjs --check");
    requiredStep(verify, "pnpm -r typecheck");
    requiredStep(verify, "pnpm -C packages/rex test");
    requiredStep(jobs.coverage, "pnpm -C packages/rex exec vitest run --coverage");
    for (const id of requiredJobs) {
      assert.ok(jobs[id], `checks must define ${id}`);
      assert.equal(jobs[id].if, undefined);
      assert.equal(jobs[id]["continue-on-error"] ?? false, false);
    }
  });
}

test("CI rejects skipped and cancelled prerequisites as well as failures", () => {
  const { gate } = workflow("ci").jobs;
  assert.equal(gate.if, "${{ always() }}");
  const reject = gate.steps.find((step) => step.run === "exit 1");
  assert.ok(reject);
  assert.equal(reject["continue-on-error"] ?? false, false);
  assert.equal(
    reject.if,
    "${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') || contains(needs.*.result, 'skipped') }}",
  );
});

test("release publishes the uploaded smoke-tested tarball without rebuilding", () => {
  const { jobs } = workflow("release");
  assert.equal(jobs.publish.if, undefined);
  const steps = workflow("checks").jobs.package.steps;
  const smokeIndex = steps.findIndex((step) =>
    step.run?.includes('sh tools/smoke-package.sh "$1"'),
  );
  assert.ok(smokeIndex >= 0);
  const smoke = steps[smokeIndex];
  assert.equal(smoke.if, undefined);
  assert.equal(smoke["continue-on-error"] ?? false, false);
  assert.ok(smoke.run.includes('set -- "$RUNNER_TEMP"/package/*.tgz'));
  const uploadIndex = steps.findIndex(
    (step) => step.uses?.startsWith("actions/upload-artifact@") && step.with?.name === "package",
  );
  assert.ok(uploadIndex > smokeIndex);
  const upload = steps[uploadIndex];
  assert.equal(upload.if, undefined);
  assert.equal(upload.with.path, "${{ runner.temp }}/package/*.tgz");
  assert.equal(upload.with["if-no-files-found"], "error");
  const publishSteps = jobs.publish.steps;
  const downloadIndex = publishSteps.findIndex(
    (step) => step.uses?.startsWith("actions/download-artifact@") && step.with?.name === "package",
  );
  assert.ok(downloadIndex >= 0);
  assert.equal(publishSteps[downloadIndex].with.path, "${{ runner.temp }}/package");
  const publishIndex = publishSteps.findIndex((step) => step.run?.includes('npm publish "$1"'));
  assert.ok(publishIndex > downloadIndex);
  assert.ok(publishSteps[publishIndex].run.includes('set -- "$RUNNER_TEMP"/package/*.tgz'));
  assert.ok(publishSteps[publishIndex].run.includes("--provenance"));
  for (const step of publishSteps) {
    assert.doesNotMatch(step.run ?? "", /\b(?:pnpm|npm|rex)\s+(?:run\s+)?(?:build|pack)\b/);
  }
});

test("every workspace package has a typecheck and a test script that the root scripts run", () => {
  const packages = workspacePackages(root);
  assert.deepEqual(
    packages.map((pkg) => pkg.dir),
    ["packages/rex", "examples/demo", "site"],
  );
  for (const pkg of packages) {
    assert.equal(typeof pkg.scripts.typecheck, "string", `${pkg.dir} has no typecheck script`);
    assert.equal(typeof pkg.scripts.test, "string", `${pkg.dir} has no test script`);
  }
  const { scripts } = manifest(".");
  assert.equal(scripts.typecheck, "pnpm -r typecheck");
  assert.equal(scripts.test, "node tools/run-workspace-tests.mjs");
});

test("the workspace test runner continues after a failing package and exits non-zero with a summary", () => {
  const workspace = mkdtempSync(join(tmpdir(), "rex-workspace-tests-"));
  try {
    const write = (dir, data) => {
      mkdirSync(join(workspace, dir), { recursive: true });
      writeFileSync(join(workspace, dir, "package.json"), JSON.stringify(data));
    };
    writeFileSync(
      join(workspace, "pnpm-workspace.yaml"),
      "packages:\n  - a-app\n  - m-docs\n  - z-base\n",
    );
    write(".", { name: "fixture-root", private: true });
    write("z-base", {
      name: "base",
      private: true,
      scripts: { test: 'node -e "process.exit(3)"' },
    });
    write("a-app", {
      name: "app",
      private: true,
      dependencies: { base: "workspace:*" },
      scripts: { test: "node -e \"require('node:fs').writeFileSync('ran', '')\"" },
    });
    write("m-docs", { name: "docs", private: true });
    const stdout = sink();
    const stderr = sink();
    const status = runWorkspaceTests([], { root: workspace, stdout, stderr, stdio: "ignore" });
    assert.equal(status, 1);
    assert.ok(existsSync(join(workspace, "a-app", "ran")), "the package after the failure ran");
    const summary = stdout.text().split("run-workspace-tests summary\n")[1] ?? "";
    const rows = summary.trimEnd().split("\n");
    assert.equal(rows.length, 3);
    assert.match(rows[0], /^ {2}FAIL {2}base +z-base {2}exit 3, /);
    assert.match(rows[1], /^ {2}pass {2}app +a-app {2}\d+\.\ds$/);
    assert.match(rows[2], /^ {2}FAIL {2}docs +m-docs {2}no test script$/);
    assert.equal(stderr.text(), "run-workspace-tests: 2 of 3 packages failed: base, docs\n");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("the gate scripts run every wired gate and fail when any of them fails", () => {
  const required = {
    "gate-test.sh": [
      "node tools/run-workspace-tests.mjs",
      "node tools/test-ratio.mjs --check",
      "node tools/navigation-races.mjs",
      "node tools/smoke-cli-bootstrap.mjs",
    ],
    "gate-lint.sh": [
      "pnpm -r typecheck",
      "pnpm lint",
      "pnpm format:check",
      "pnpm -C examples/demo exec rex check --runtime",
      "pnpm -C site exec rex check --runtime",
      "pnpm audit --prod",
      "node tools/license-review.mjs",
    ],
  };
  for (const [script, commands] of Object.entries(required)) {
    const gate = gateCommands(script);
    for (const command of commands) {
      assert.ok(gate.commands.includes(command), `${script} must run ${command}`);
    }
    assert.match(
      gate.text,
      /^gate\(\) \{\n {2}name="\$1"\n {2}shift\n {2}"\$@" \|\| failed="\$failed \$name"\n\}$/m,
    );
    assert.match(
      gate.text,
      /^if \[ -n "\$failed" \]; then\n {2}echo "[^"]+" >&2\n {2}exit 1\nfi\n$/m,
    );
    assert.doesNotMatch(gate.text, /\|\|\s*(?:true\b|:(?:\s|$))|set \+e/m);
  }
});

test("coverage covers src/testing and the ratio checks the results the suites record", async () => {
  const { default: config } = await import(
    new URL("../packages/rex/vitest.config.ts", import.meta.url).href
  );
  const { coverage } = config.test;
  assert.equal(coverage.reportOnFailure, true);
  assert.deepEqual(coverage.include, ["src/**/*.{ts,tsx}"]);
  assert.ok(!coverage.exclude.some((pattern) => pattern.startsWith("src/testing")));
  assert.deepEqual(coverage.thresholds, { statements: 90, branches: 80, functions: 90, lines: 90 });
  const [rex, demo] = RATIO_PACKAGES;
  assert.equal(rex.dir, "packages/rex");
  assert.ok(config.test.reporters.includes("json"));
  assert.equal(config.test.outputFile.json, rex.results);
  assert.equal(demo.dir, "examples/demo");
  const { scripts } = manifest(demo.dir);
  assert.ok(scripts["test:unit"].includes(`--outputFile.json=${demo.results}`));
  assert.ok(scripts["test:unit"].includes("--reporter=json"));
  assert.ok(scripts.test.includes("pnpm run test:unit"));
});
