import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createRegistry } from "../core/registry.ts";
import { page } from "../core/page.ts";
import { REX_MANIFEST_PATH } from "../core/protocol.ts";
import { buildManifest, stableStringify } from "../manifest/build.ts";
import {
  PRERENDER_LIST_FILE,
  PRERENDER_LIST_VERSION,
  parsePrerenderList,
  type PrerenderList,
} from "../server/adapters/static-cache.ts";
import {
  STATIC_OUTPUTS,
  outputFiles,
  runStaticOutputs,
  type StaticOutput,
  type StaticOutputContext,
} from "./outputs.ts";
import {
  NOT_FOUND_FILE,
  STATIC_MANIFEST_FILE,
  prerenderedTextFile,
  writeShellDocuments,
} from "./prerender.ts";

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "rex-outputs-"));
  temporary.push(dir);
  return dir;
}

const home = page("home", {
  route: "/",
  render: "csr",
  chrome: { title: "Home" },
  states: ["ready"],
});
const console_ = page("console", {
  route: "/console",
  render: "ssr",
  chrome: { title: "Console" },
  states: ["ready"],
});
const guide = page("guide", {
  route: "/guide",
  render: "static",
  chrome: { title: "Guide" },
  states: ["ready"],
});
const news = page("news", {
  route: "/news",
  render: "ssg",
  revalidate: 60,
  chrome: { title: "News" },
  states: ["ready"],
});

const registry = createRegistry().register(home, console_, guide, news).freeze();
const manifest = buildManifest(registry, { app: "outputs" });
const SHELL = '<!doctype html><html><body><div id="root"></div></body></html>';

const prerendered: PrerenderList = {
  version: PRERENDER_LIST_VERSION,
  pages: [
    {
      path: "/guide",
      page: "guide",
      render: "static",
      revalidate: null,
      file: "guide/index.html",
      generatedAt: 1,
    },
    {
      path: "/news",
      page: "news",
      render: "ssg",
      revalidate: 60,
      file: "news/index.html",
      generatedAt: 2,
    },
  ],
};

function context(target: StaticOutputContext["target"], shell: string | null): StaticOutputContext {
  const outDir = tempDir();
  return {
    target,
    outDir,
    clientDir: join(outDir, "client"),
    manifest,
    prerendered,
    shell,
  };
}

describe("the static output list", () => {
  it("lists the derived files in their declared order", () => {
    expect(STATIC_OUTPUTS.map((output) => output.id)).toEqual([
      "shell-documents",
      "static-manifest",
      "text-files",
      "prerender-list",
    ]);
    expect(STATIC_OUTPUTS.filter((output) => output.applies("static")).length).toBe(4);
    for (const target of ["node", "bun", "deno", "edge"] as const) {
      expect(
        STATIC_OUTPUTS.filter((output) => output.applies(target)).map((output) => output.id),
        target,
      ).toEqual(["prerender-list"]);
    }
  });

  it("runs every output for the static target and writes what prerender.ts writes", async () => {
    const written = context("static", SHELL);
    const runs = await runStaticOutputs(written);
    expect(runs.map((run) => run.id)).toEqual([
      "shell-documents",
      "static-manifest",
      "text-files",
      "prerender-list",
    ]);
    const { clientDir, outDir } = written;

    expect(outputFiles(runs, "shell-documents")).toEqual([
      {
        file: join(clientDir, "index.html"),
        path: "/",
        page: "home",
        note: "home, the shell document for /",
      },
      {
        file: join(clientDir, "console", "index.html"),
        path: "/console",
        page: "console",
        note: "console, the shell document for /console",
      },
      {
        file: join(clientDir, NOT_FOUND_FILE),
        path: null,
        page: null,
        note: "the shell document for unknown routes",
      },
    ]);
    const reference = tempDir();
    const entries = writeShellDocuments(reference, SHELL, manifest, prerendered);
    for (const entry of entries) {
      expect(readFileSync(join(clientDir, entry.file), "utf8"), entry.file).toBe(
        readFileSync(join(reference, entry.file), "utf8"),
      );
    }

    expect(outputFiles(runs, "static-manifest")).toEqual([
      {
        file: join(clientDir, STATIC_MANIFEST_FILE),
        path: REX_MANIFEST_PATH,
        page: null,
        note: null,
      },
    ]);
    expect(readFileSync(join(clientDir, STATIC_MANIFEST_FILE), "utf8")).toBe(
      stableStringify(manifest),
    );

    expect(outputFiles(runs, "text-files")).toEqual(
      prerendered.pages.map((entry) => ({
        file: join(clientDir, prerenderedTextFile(entry.path)),
        path: entry.path,
        page: entry.page,
        note: null,
      })),
    );

    expect(outputFiles(runs, "prerender-list")).toEqual([
      { file: join(outDir, PRERENDER_LIST_FILE), path: null, page: null, note: null },
    ]);
    expect(
      parsePrerenderList(JSON.parse(readFileSync(join(outDir, PRERENDER_LIST_FILE), "utf8"))),
    ).toEqual(prerendered);
    expect(Object.isFrozen(runs)).toBe(true);
  });

  it("runs only the prerender list for a server target and leaves dist/client alone", async () => {
    const written = context("node", null);
    const runs = await runStaticOutputs(written);
    expect(runs.map((run) => run.id)).toEqual(["prerender-list"]);
    expect(readdirSync(written.outDir)).toEqual([PRERENDER_LIST_FILE]);
    expect(existsSync(written.clientDir)).toBe(false);
    expect(outputFiles(runs, "shell-documents")).toEqual([]);
  });

  it("refuses the static shell documents without the built index.html", async () => {
    await expect(runStaticOutputs(context("static", null))).rejects.toMatchObject({
      code: "REX400",
      message: expect.stringContaining("needs the built index.html"),
    });
  });

  it("runs a given list in order, awaiting each writer, and skips the ones that do not apply", async () => {
    const order: string[] = [];
    const notes: StaticOutput = {
      id: "notes",
      applies: (target) => target !== "edge",
      async write(current) {
        order.push("notes");
        const file = join(current.outDir, "notes.txt");
        await Promise.resolve();
        writeFileSync(file, current.prerendered.pages.map((entry) => entry.path).join("\n"));
        return [
          { file, path: null, page: null, note: `${current.prerendered.pages.length} pages` },
        ];
      },
    };
    const listed: StaticOutput = {
      id: "listed",
      applies: () => true,
      write(current) {
        order.push("listed");
        expect(existsSync(join(current.outDir, "notes.txt"))).toBe(current.target !== "edge");
        return [];
      },
    };
    const node = context("node", null);
    const runs = await runStaticOutputs(node, [notes, listed]);
    expect(order).toEqual(["notes", "listed"]);
    expect(runs).toEqual([
      {
        id: "notes",
        files: [{ file: join(node.outDir, "notes.txt"), path: null, page: null, note: "2 pages" }],
      },
      { id: "listed", files: [] },
    ]);
    expect(readFileSync(join(node.outDir, "notes.txt"), "utf8")).toBe("/guide\n/news");
    order.length = 0;
    expect(
      (await runStaticOutputs(context("edge", null), [notes, listed])).map((run) => run.id),
    ).toEqual(["listed"]);
    expect(order).toEqual(["listed"]);
  });
});
