import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  PAGE_BUDGET_KB,
  chunkTable,
  formatChunkTable,
  pageChunkGroups,
  pageChunkName,
  pageIdOfModule,
  type ChunkRow,
  type OutputAssetLike,
  type OutputChunkLike,
} from "./split.ts";
import { PAGE_CHUNK_PREFIX } from "./virtual.ts";

const appPath = "/srv/site/app";
const HOME_CODE = "export const home = 1;\n".repeat(40);

const items: readonly (OutputChunkLike | OutputAssetLike)[] = [
  {
    type: "chunk",
    name: "page-home",
    fileName: "assets/page-home-1.js",
    code: HOME_CODE,
    isEntry: false,
  },
  {
    type: "chunk",
    name: "index",
    fileName: "assets/index-2.js",
    code: "console.log(1);",
    isEntry: true,
  },
  { type: "asset", fileName: "assets/index-3.css" },
  {
    type: "chunk",
    name: "page-note",
    fileName: "assets/page-note-4.js",
    code: "é".repeat(8),
    isEntry: false,
  },
  { type: "chunk", name: "index", fileName: "assets/index-0.js", code: "x", isEntry: false },
];

describe("page chunks", () => {
  it("names a page chunk after its page id", () => {
    expect(PAGE_BUDGET_KB).toBe(50);
    expect(pageChunkName("home")).toBe("page-home");
    expect(pageChunkName("notes.archive")).toBe(`${PAGE_CHUNK_PREFIX}notes.archive`);
  });

  it("assigns every module under a page folder except page.ts to that page", () => {
    expect(pageIdOfModule("/srv/site/app/pages/home/view.tsx", appPath)).toBe("home");
    expect(pageIdOfModule("/srv/site/app/pages/home/view.tsx?v=abc", appPath)).toBe("home");
    expect(pageIdOfModule("/srv/site/app/pages/home/regions/list/parts/Row.tsx", appPath)).toBe(
      "home",
    );
    expect(pageIdOfModule("/srv/site/app/pages/home/regions/list/page.ts", appPath)).toBe("home");
    expect(pageIdOfModule("/srv/site/app/pages/home/page.ts", appPath)).toBeNull();
    expect(pageIdOfModule("/srv/site/app/pages/home/page.ts?t=1", appPath)).toBeNull();
    expect(pageIdOfModule("/srv/site/app/pages/home", appPath)).toBeNull();
    expect(pageIdOfModule("/srv/site/app/actions/add.ts", appPath)).toBeNull();
    expect(pageIdOfModule("/srv/site/application/pages/home/view.tsx", appPath)).toBeNull();
    expect(pageIdOfModule("/srv/other/app/pages/home/view.tsx", appPath)).toBeNull();
    expect(pageIdOfModule("\0rex:app", appPath)).toBeNull();
  });

  it("describes one non-recursive code splitting group that names page chunks", () => {
    const groups = pageChunkGroups(appPath);
    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group?.includeDependenciesRecursively).toBe(false);
    expect(group?.name("/srv/site/app/pages/note/states.tsx")).toBe("page-note");
    expect(group?.name("/srv/site/app/pages/note/page.ts")).toBeNull();
    expect(group?.name("/srv/site/node_modules/react/index.js")).toBeNull();
  });
});

describe("chunkTable", () => {
  it("measures every chunk, skips assets and sorts by name then file", () => {
    const rows = chunkTable(items);
    expect(rows.map((row) => [row.name, row.file])).toEqual([
      ["index", "assets/index-0.js"],
      ["index", "assets/index-2.js"],
      ["page-home", "assets/page-home-1.js"],
      ["page-note", "assets/page-note-4.js"],
    ]);
    const home = rows[2] as ChunkRow;
    expect(home.raw).toBe(Buffer.byteLength(HOME_CODE));
    expect(home.gzip).toBe(gzipSync(HOME_CODE).byteLength);
    expect(home.gzip).toBeGreaterThan(0);
    expect(home.gzip).toBeLessThan(home.raw);
    const note = rows[3] as ChunkRow;
    expect(note.raw).toBe(16);
    expect(note.gzip).toBeGreaterThan(0);
  });

  it("budgets page chunks only and flags the ones over the gzip budget", () => {
    const rows = chunkTable(items);
    expect(rows.map((row) => [row.name, row.budget, row.over])).toEqual([
      ["index", null, false],
      ["index", null, false],
      ["page-home", PAGE_BUDGET_KB, false],
      ["page-note", PAGE_BUDGET_KB, false],
    ]);
    const tight = chunkTable(items, { page: 0 });
    expect(tight.map((row) => [row.name, row.budget, row.over])).toEqual([
      ["index", null, false],
      ["index", null, false],
      ["page-home", 0, true],
      ["page-note", 0, true],
    ]);
    const home = chunkTable(items, { page: 1 / 1024 }).find((row) => row.name === "page-home");
    expect(home?.over).toBe(home !== undefined && home.gzip > 1);
  });
});

describe("formatChunkTable", () => {
  it("lays the rows out in aligned columns with KB figures and an OVER marker", () => {
    const rows: ChunkRow[] = [
      { name: "index", file: "assets/index.js", raw: 2048, gzip: 1024, budget: null, over: false },
      {
        name: "page-home",
        file: "assets/page-home.js",
        raw: 61440,
        gzip: 52224,
        budget: 50,
        over: true,
      },
      {
        name: "page-note",
        file: "assets/page-note.js",
        raw: 10240,
        gzip: 3072,
        budget: 50,
        over: false,
      },
    ];
    expect(formatChunkTable(rows)).toBe(
      [
        "chunk      raw       gzip      budget",
        "index      2.00 KB   1.00 KB   -",
        "page-home  60.00 KB  51.00 KB  50 KB OVER",
        "page-note  10.00 KB  3.00 KB   50 KB",
        "",
      ].join("\n"),
    );
  });

  it("prints only the header for no rows", () => {
    expect(formatChunkTable([])).toBe("chunk  raw  gzip  budget\n");
  });
});
