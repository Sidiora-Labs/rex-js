import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const cli = createRequire(import.meta.url).resolve("@playwright/test/cli");
const phases = ["functional", "timing"];

let failed = false;
for (const phase of phases) {
  const run = spawnSync(process.execPath, [cli, "test", ...process.argv.slice(2)], {
    stdio: "inherit",
    env: { ...process.env, REX_SITE_PHASE: phase },
  });
  if (run.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
