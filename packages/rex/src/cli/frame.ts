import { existsSync, readFileSync } from "node:fs";
import { explainRexError } from "../core/errors.docs.ts";
import { isRexError, type RexError } from "../core/errors.ts";

export const FRAME_CONTEXT_LINES = 2;

export interface SourceFrameOptions {
  readonly column?: number | null;
  readonly context?: number;
}

export function sourceFrame(source: string, line: number, options: SourceFrameOptions = {}): string {
  const lines = source.split(/\r?\n/);
  if (!Number.isInteger(line) || line < 1 || line > lines.length) return "";
  const context = options.context ?? FRAME_CONTEXT_LINES;
  const first = Math.max(1, line - context);
  const last = Math.min(lines.length, line + context);
  const width = String(last).length;
  const rows: string[] = [];
  for (let current = first; current <= last; current += 1) {
    const text = (lines[current - 1] as string).replace(/\t/g, "  ");
    const gutter = `${String(current).padStart(width)} |`;
    const marker = current === line ? ">" : " ";
    rows.push(`${marker} ${gutter}${text === "" ? "" : ` ${text}`}`);
    const column = options.column;
    if (current === line && column !== undefined && column !== null && column >= 1) {
      const before = (lines[current - 1] as string).slice(0, column - 1).replace(/[^\t]/g, " ");
      rows.push(`  ${" ".repeat(width)} | ${before.replace(/\t/g, "  ")}^`);
    }
  }
  return rows.join("\n");
}

export function fileFrame(error: RexError, options: SourceFrameOptions = {}): string {
  if (error.file === null || error.line === null || !existsSync(error.file)) return "";
  return sourceFrame(readFileSync(error.file, "utf8"), error.line, {
    ...options,
    column: error.column,
  });
}

export function locatedRexError(error: unknown): RexError | null {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    if (isRexError(current) && current.file !== null && current.line !== null) return current;
    current = current.cause;
  }
  return null;
}

export function formatCliError(error: unknown): string {
  if (!isRexError(error)) {
    return `rex: ${error instanceof Error ? error.message : String(error)}`;
  }
  const frame = fileFrame(error);
  return frame === ""
    ? `rex: ${explainRexError(error)}`
    : `rex: ${explainRexError(error)}\n\n${frame}`;
}

export function causeFrame(error: unknown): string {
  const located = locatedRexError(error);
  return located === null ? "" : fileFrame(located);
}
