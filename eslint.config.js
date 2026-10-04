import { createRequire } from "node:module";

const LINTED_TREES = ["packages/rex/src", "examples/demo"];

const IGNORED = [
  "**/dist/**",
  "**/node_modules/**",
  "**/coverage/**",
  "**/fixtures/**",
  "**/.rex/**",
  "**/e2e/report/**",
  "**/test-results/**",
  "**/playwright-report/**",
  ".codegraph/**",
];

const requireFromRex = createRequire(new URL("packages/rex/package.json", import.meta.url));
const { createJiti } = createRequire(requireFromRex.resolve("eslint"))("jiti");
const jiti = createJiti(import.meta.url, { jsx: true });
const rex = await jiti.import("./packages/rex/src/eslint/index.ts");

function scoped(entry) {
  if (entry.files === undefined) return entry;
  return {
    ...entry,
    files: LINTED_TREES.flatMap((tree) => entry.files.map((pattern) => `${tree}/${pattern}`)),
  };
}

export default [{ name: "rex-js/ignores", ignores: IGNORED }, ...rex.config.map(scoped)];
