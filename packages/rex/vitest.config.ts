import { defaultClientConditions, defaultServerConditions } from "vite";
import { configDefaults, defineConfig } from "vitest/config";

const exclude = [...configDefaults.exclude, "src/**/fixtures/**"];
const SOURCE_CONDITION = "rex-source";
const resolve = { conditions: [SOURCE_CONDITION, ...defaultClientConditions] };
const ssr = { resolve: { conditions: [SOURCE_CONDITION, ...defaultServerConditions] } };

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.conformance.ts",
        "src/**/fixtures/**",
        "src/testing/**",
        "src/**/*.d.ts",
        "src/**/*.generated.*",
      ],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
    },
    projects: [
      {
        resolve,
        ssr,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude,
        },
      },
      {
        resolve,
        ssr,
        test: {
          name: "dom",
          environment: "happy-dom",
          include: ["src/**/*.test.tsx"],
          exclude,
        },
      },
    ],
  },
});
