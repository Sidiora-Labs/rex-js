import { rex } from "@sidioralabs/rex/vite";
import { defineConfig } from "vitest/config";

const CLIENT_BUNDLE_ONLY = "rex:boundary";
const SHELL_COMPONENTS = "app/components/Shell.tsx";

export default defineConfig({
  plugins: rex({ shellComponents: SHELL_COMPONENTS }).filter(
    (plugin) => plugin.name !== CLIENT_BUNDLE_ONLY,
  ),
  test: {
    name: "site",
    environment: "happy-dom",
    include: ["app/pages/*/test/**/*.test.{ts,tsx}", "app/server/**/*.test.ts"],
  },
});
