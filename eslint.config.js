import { createRequire } from "node:module";
import tseslint from "typescript-eslint";

const APP_TREE = "examples/demo/app";
const TYPESCRIPT_TREES = [
  "packages/rex/src/**/*.{ts,tsx}",
  "examples/demo/*.ts",
  "examples/demo/e2e/**/*.ts",
  "tools/**/*.{mjs,js}",
];

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

function app(entry) {
  if (entry.files === undefined) return entry;
  return { ...entry, files: entry.files.map((pattern) => `${APP_TREE}/${pattern}`) };
}

function typescript(entry) {
  return { ...entry, files: TYPESCRIPT_TREES };
}

const TYPESCRIPT_OPTIONS = {
  name: "rex-js/typescript-options",
  files: TYPESCRIPT_TREES,
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-empty-object-type": ["error", { allowObjectTypes: "always" }],
    "@typescript-eslint/triple-slash-reference": [
      "error",
      { path: "always", types: "prefer-import", lib: "always" },
    ],
  },
};

export default [
  { name: "rex-js/ignores", ignores: IGNORED },
  ...rex.config.map(app),
  ...tseslint.configs.recommended.map(typescript),
  TYPESCRIPT_OPTIONS,
];
