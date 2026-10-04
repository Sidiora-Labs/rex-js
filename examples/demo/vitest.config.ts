import { runnerImport } from "vite";
import { defineConfig } from "vitest/config";

type RexVite = typeof import("@sidioralabs/rex/vite");

const CLIENT_BUNDLE_ONLY = "rex:boundary";

const { module: rexVite } = await runnerImport<RexVite>("@sidioralabs/rex/vite");

export default defineConfig({
  plugins: rexVite.rex().filter((plugin) => plugin.name !== CLIENT_BUNDLE_ONLY),
  test: {
    name: "demo",
    environment: "happy-dom",
    include: ["app/pages/*/test/**/*.test.{ts,tsx}"],
  },
});
