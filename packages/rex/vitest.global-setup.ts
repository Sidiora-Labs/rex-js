import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(fileURLToPath(import.meta.url));

export default function buildDistOnce(): void {
  execFileSync("pnpm", ["run", "build"], { cwd: packageRoot, stdio: "pipe" });
}
