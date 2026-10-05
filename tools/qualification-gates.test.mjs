import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const eslintRequire = createRequire(require.resolve("eslint/package.json"));
const eslintrcRequire = createRequire(eslintRequire.resolve("@eslint/eslintrc/package.json"));
const { load } = eslintrcRequire("js-yaml");
const requiredJobs = ["verify", "lint", "coverage", "demo", "docs", "supply-chain", "package"];

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
    const { jobs } = workflow(name);
    const verify = jobs.verify;
    assert.equal(verify.if, undefined);
    assert.equal(verify["continue-on-error"] ?? false, false);
    requiredStep(verify, "node --test tools/qualification-gates.test.mjs");
    requiredStep(verify, "node tools/test-ratio.mjs --check");
    requiredStep(verify, "pnpm -r typecheck");
    requiredStep(verify, "pnpm -C packages/rex test");
    requiredStep(jobs.coverage, "pnpm -C packages/rex exec vitest run --coverage");
    const gate = name === "ci" ? jobs.gate : jobs.publish;
    for (const id of requiredJobs) {
      assert.ok(gate.needs.includes(id), `${name} must require ${id}`);
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
  const steps = jobs.package.steps;
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
