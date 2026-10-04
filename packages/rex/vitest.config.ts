import { configDefaults, defineConfig } from "vitest/config";

const exclude = [...configDefaults.exclude, "src/**/fixtures/**"];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude,
        },
      },
      {
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
