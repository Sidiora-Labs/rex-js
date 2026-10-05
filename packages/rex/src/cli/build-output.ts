import { REX_VERSION } from "../index.ts";
import type { ChunkRow, StaticImportClosure } from "../vite/split.ts";
import type { RexCliIO } from "./index.ts";
import { REX_LOGO } from "./logo.ts";

const SHADES = " ░▒▓█";

export function fitLogo(columns: number): string {
  const lines = REX_LOGO.split("\n").filter((line) => line.trim().length > 0);
  const left = Math.min(...lines.map((line) => line.search(/\S/)));
  const source = lines.map((line) => line.slice(left).trimEnd());
  const width = Math.max(...source.map((line) => line.length));
  const target = Math.max(1, Math.min(width, Math.floor(columns)));
  const scale = width / target;
  const height = Math.max(1, Math.round(source.length / scale));
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: target }, (_, x) => {
      let sum = 0;
      let count = 0;
      for (
        let row = Math.floor((y * source.length) / height);
        row < Math.floor(((y + 1) * source.length) / height);
        row++
      ) {
        for (let col = Math.floor(x * scale); col < Math.floor((x + 1) * scale); col++) {
          sum += Math.max(0, SHADES.indexOf(source[row]?.[col] ?? " "));
          count++;
        }
      }
      return SHADES[Math.round(sum / Math.max(1, count))] ?? " ";
    })
      .join("")
      .trimEnd(),
  ).join("\n");
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

export function formatBuildChunks(
  chunks: readonly ChunkRow[],
  closures: readonly StaticImportClosure[],
  columns = 80,
): string {
  const byFile = new Map(closures.map((row) => [row.file, row]));
  const rows = chunks.map((chunk) => {
    const closure = byFile.get(chunk.file);
    return [
      chunk.name,
      kb(chunk.raw),
      kb(chunk.gzip),
      closure === undefined ? "-" : kb(closure.gzip),
      chunk.budget === null ? "-" : `${chunk.budget} KB${chunk.over ? " OVER" : ""}`,
    ];
  });
  const header = ["Chunk", "Raw", "Gzip", "Total gzip", "Budget"];
  const widths = header.map((cell, i) =>
    Math.max(cell.length, ...rows.map((row) => row[i]!.length)),
  );
  const narrow = widths.reduce((sum, width) => sum + width, 0) + 10 > columns;
  const line = (cells: readonly string[]) =>
    `  ${cells
      .map((cell, i) => (i === 0 ? cell.padEnd(widths[i]!) : cell.padStart(widths[i]!)))
      .join("  ")
      .trimEnd()}`;
  const table = narrow
    ? rows.flatMap((row) => [
        `  ${row[0]}`,
        ...row.slice(1).map((cell, i) => `    ${header[i + 1]}: ${cell}`),
      ])
    : [line(header), line(widths.map((width) => "-".repeat(width))), ...rows.map(line)];
  const external = closures
    .filter((row) => row.externalImports.length > 0)
    .map((row) => `  ${row.file}: external imports ${row.externalImports.join(", ")}`);
  return [
    "\n  Client bundles\n",
    ...table,
    "",
    "  Total gzip: static JS closure (own chunk + static imports; measurements, not budgets)",
    "  Shared imports are counted once per row, not once across the table.",
    "  Budgets apply to each chunk's own gzip size.",
    ...external,
    "",
  ].join("\n");
}

export function buildReporter(io: RexCliIO): {
  phase(label: string): void;
  complete(target: string): void;
  failed(): void;
} {
  const started = performance.now();
  const columns = io.columns ?? 80;
  const paint = (code: number, value: string) =>
    io.color ? `\u001b[${code}m${value}\u001b[0m` : value;
  const logo = fitLogo(Math.max(1, Math.min(100, columns - 4)));
  io.out(
    `\n${paint(
      36,
      logo
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n"),
    )}\n\n  ${paint(1, `RexJS v${REX_VERSION}`)}\n  Production build\n\n`,
  );
  let current: { label: string; started: number } | undefined;
  const elapsed = (since: number) => `${((performance.now() - since) / 1000).toFixed(2)}s`;
  const finishPhase = () => {
    if (current !== undefined)
      io.out(
        `  ${paint(32, "[ok]")} ${current.label} ${paint(2, `(${elapsed(current.started)})`)}\n`,
      );
  };
  return {
    phase(label) {
      finishPhase();
      current = { label, started: performance.now() };
      io.out(`  ${paint(36, "[..]")} ${label}\n`);
    },
    complete(target) {
      finishPhase();
      current = undefined;
      io.out(
        `\n  ${paint(32, "Build complete")} in ${elapsed(started)} ${paint(2, `(${target})`)}\n`,
      );
    },
    failed() {
      io.out(
        `\n  ${paint(31, "Build failed")}${current === undefined ? "" : ` during ${current.label.toLowerCase()}`} after ${elapsed(started)}\n`,
      );
      current = undefined;
    },
  };
}
