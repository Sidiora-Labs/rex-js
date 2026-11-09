#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(packageRoot, "src", "version.ts");
const { version } = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(
    `packages/rex/package.json version ${JSON.stringify(version)} is not a release version`,
  );
  process.exit(1);
}

const source = `export const REX_VERSION: string = ${JSON.stringify(version)};\n`;
let current = null;
try {
  current = readFileSync(target, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

if (process.argv.includes("--check")) {
  if (current !== source) {
    console.error(
      `src/version.ts does not match packages/rex/package.json version ${version}; run node scripts/write-version.mjs`,
    );
    process.exit(1);
  }
} else if (current !== source) {
  writeFileSync(target, source);
}
