import { defaultClientConditions, defaultServerConditions } from "vite";
import { configDefaults, defineConfig } from "vitest/config";

const exclude = [...configDefaults.exclude, "src/**/fixtures/**"];
const serialCli = ["src/cli/cli.test.ts", "src/cli/commands.test.ts"];
const SOURCE_CONDITION = "rex-source";
const resolve = { conditions: [SOURCE_CONDITION, ...defaultClientConditions] };
const ssr = { resolve: { conditions: [SOURCE_CONDITION, ...defaultServerConditions] } };

export default defineConfig({
  test: {
    globalSetup: ["./vitest.global-setup.ts"],
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
          exclude: [...exclude, ...serialCli],
        },
      },
      {
        resolve,
        ssr,
        test: {
          name: "cli",
          environment: "node",
          include: serialCli,
          exclude,
          fileParallelism: false,
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
