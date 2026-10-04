import { rex } from "@sidioralabs/rex/vite";
import { defineConfig } from "vitest/config";

const CLIENT_BUNDLE_ONLY = "rex:boundary";

export default defineConfig({
  plugins: rex().filter((plugin) => plugin.name !== CLIENT_BUNDLE_ONLY),
  test: {
    name: "demo",
    environment: "happy-dom",
    include: ["app/pages/*/test/**/*.test.{ts,tsx}"],
  },
});
