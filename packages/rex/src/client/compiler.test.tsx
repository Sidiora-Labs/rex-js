import { act, cleanup, render, screen } from "@testing-library/react";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ComponentType, ProfilerOnRenderCallback } from "react";
import { build } from "vite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { rex } from "../vite/plugin.ts";
import type { BoardProps, PriceStore } from "./fixtures/compiler/board.tsx";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, "fixtures", "compiler");
const outDir = join(fixtureDir, ".out");
const BUILD_TIMEOUT_MS = 60_000;

interface BoardModule {
  readonly Board: ComponentType<BoardProps>;
  createPriceStore(initial: number): PriceStore;
}

async function compileBoard(compiler: boolean): Promise<{ code: string; module: BoardModule }> {
  const result = await build({
    root: fixtureDir,
    configFile: false,
    logLevel: "silent",
    plugins: rex({ name: "compiler-fixture", compiler }),
    build: {
      write: false,
      minify: false,
      rolldownOptions: {
        input: join(fixtureDir, "board.tsx"),
        external: [/^react(\/.*)?$/],
        preserveEntrySignatures: "strict",
        output: { format: "es" },
      },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs
    .flatMap((output) => ("output" in output ? output.output : []))
    .find((item) => item.type === "chunk" && item.isEntry);
  if (chunk === undefined || chunk.type !== "chunk") throw new Error("no board chunk was built");
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `board-${compiler ? "compiled" : "plain"}.mjs`);
  writeFileSync(file, chunk.code);
  const module = (await import(/* @vite-ignore */ pathToFileURL(file).href)) as BoardModule;
  return { code: chunk.code, module };
}

let compiled: { code: string; module: BoardModule };
let plain: { code: string; module: BoardModule };

beforeAll(async () => {
  compiled = await compileBoard(true);
  plain = await compileBoard(false);
}, BUILD_TIMEOUT_MS);

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

afterEach(() => {
  cleanup();
});

function commitsAfterUpdate(module: BoardModule): Record<string, number> {
  const commits: Record<string, number> = { title: 0, price: 0 };
  const onRender: ProfilerOnRenderCallback = (id) => {
    commits[id] = (commits[id] ?? 0) + 1;
  };
  const store = module.createPriceStore(1);
  render(<module.Board store={store} title="Wallet" onRender={onRender} />);
  expect(screen.getByText("Price 1")).toBeTruthy();
  expect(commits).toEqual({ title: 1, price: 1 });
  act(() => {
    store.set(2);
  });
  expect(screen.getByText("Price 2")).toBeTruthy();
  act(() => {
    store.set(3);
  });
  expect(screen.getByText("Price 3")).toBeTruthy();
  return commits;
}

describe("the React Compiler through the Rex Vite plugin", () => {
  it("compiles the fixture with the compiler runtime and leaves it out when disabled", () => {
    expect(compiled.code).toContain("react/compiler-runtime");
    expect(plain.code).not.toContain("react/compiler-runtime");
  });

  it("re-renders only the part that reads the updated store value", () => {
    expect(commitsAfterUpdate(compiled.module)).toEqual({ title: 1, price: 3 });
  });

  it("re-renders every part without the compiler", () => {
    cleanup();
    expect(commitsAfterUpdate(plain.module)).toEqual({ title: 3, price: 3 });
  });
});
