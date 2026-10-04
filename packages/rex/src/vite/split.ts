import { gzipSync } from "node:zlib";
import { normalizePath } from "vite";
import { PAGE_CHUNK_PREFIX } from "./virtual.ts";

export const PAGE_BUDGET_KB = 50;

export function pageChunkName(pageId: string): string {
  return `${PAGE_CHUNK_PREFIX}${pageId}`;
}

export function pageIdOfModule(moduleId: string, appPath: string): string | null {
  const prefix = `${normalizePath(appPath)}/pages/`;
  const file = normalizePath(moduleId.split("?")[0] ?? moduleId);
  if (!file.startsWith(prefix)) return null;
  const [pageId, ...rest] = file.slice(prefix.length).split("/");
  if (pageId === undefined || rest.length === 0) return null;
  if (rest.length === 1 && rest[0] === "page.ts") return null;
  return pageId;
}

export interface PageChunkGroup {
  readonly name: (moduleId: string) => string | null;
}

export function pageChunkGroups(appPath: string): PageChunkGroup[] {
  return [
    {
      name: (moduleId) => {
        const pageId = pageIdOfModule(moduleId, appPath);
        return pageId === null ? null : pageChunkName(pageId);
      },
    },
  ];
}

export interface OutputChunkLike {
  readonly type: "chunk";
  readonly name: string;
  readonly fileName: string;
  readonly code: string;
  readonly isEntry: boolean;
}

export interface OutputAssetLike {
  readonly type: "asset";
  readonly fileName: string;
}

export interface ChunkRow {
  readonly name: string;
  readonly file: string;
  readonly raw: number;
  readonly gzip: number;
  readonly budget: number | null;
  readonly over: boolean;
}

export interface ChunkBudgets {
  readonly page: number;
}

export function chunkTable(
  items: readonly (OutputChunkLike | OutputAssetLike)[],
  budgets: ChunkBudgets = { page: PAGE_BUDGET_KB },
): ChunkRow[] {
  return items
    .filter((item): item is OutputChunkLike => item.type === "chunk")
    .map((chunk) => {
      const raw = Buffer.byteLength(chunk.code);
      const gzip = gzipSync(chunk.code).byteLength;
      const budget = chunk.name.startsWith(PAGE_CHUNK_PREFIX) ? budgets.page : null;
      return {
        name: chunk.name,
        file: chunk.fileName,
        raw,
        gzip,
        budget,
        over: budget !== null && gzip > budget * 1024,
      };
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.file < b.file ? -1 : 1));
}

function kilobytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

export function formatChunkTable(rows: readonly ChunkRow[]): string {
  const header = ["chunk", "raw", "gzip", "budget"] as const;
  const body = rows.map((row) => [
    row.name,
    kilobytes(row.raw),
    kilobytes(row.gzip),
    row.budget === null ? "-" : `${row.budget} KB${row.over ? " OVER" : ""}`,
  ]);
  const widths = header.map((title, column) =>
    Math.max(title.length, ...body.map((cells) => (cells[column] as string).length)),
  );
  const line = (cells: readonly string[]) =>
    cells.map((cell, column) => cell.padEnd(widths[column] as number)).join("  ").trimEnd();
  return `${[line(header), ...body.map(line)].join("\n")}\n`;
}
