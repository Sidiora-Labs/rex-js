import { rex } from "@sidioralabs/rex/vite";
import { defaultClientConditions, defaultServerConditions } from "vite";
import { defineConfig } from "vitest/config";

const CLIENT_BUNDLE_ONLY = "rex:boundary";
const SOURCE_CONDITION = "rex-source";

export default defineConfig({
  plugins: rex().filter((plugin) => plugin.name !== CLIENT_BUNDLE_ONLY),
  resolve: { conditions: [SOURCE_CONDITION, ...defaultClientConditions] },
  ssr: { resolve: { conditions: [SOURCE_CONDITION, ...defaultServerConditions] } },
  test: {
    name: "demo",
    environment: "happy-dom",
    include: ["app/pages/*/test/**/*.test.{ts,tsx}"],
  },
});
