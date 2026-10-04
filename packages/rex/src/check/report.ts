import { RexError } from "../core/errors.ts";
import { compareFindings } from "./engine.ts";
import type { Finding } from "./rule.ts";

export const REPORT_FORMATS = ["json", "human"] as const;

export type ReportFormat = (typeof REPORT_FORMATS)[number];

function ordered(entry: Finding): Finding {
  return {
    rule: entry.rule,
    severity: entry.severity,
    file: entry.file,
    line: entry.line,
    column: entry.column,
    message: entry.message,
    hint: entry.hint,
  };
}

export function formatJson(findings: readonly Finding[]): string {
  return `${JSON.stringify([...findings].sort(compareFindings).map(ordered), null, 2)}\n`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function formatHuman(findings: readonly Finding[]): string {
  if (findings.length === 0) return "No findings.\n";
  const sorted = [...findings].sort(compareFindings);
  const groups = new Map<string, Finding[]>();
  for (const entry of sorted) {
    const group = groups.get(entry.file);
    if (group) group.push(entry);
    else groups.set(entry.file, [entry]);
  }
  const lines: string[] = [];
  for (const [file, entries] of groups) {
    lines.push(file);
    const positions = entries.map((entry) => `${entry.line}:${entry.column}`);
    const width = Math.max(...positions.map((position) => position.length));
    entries.forEach((entry, index) => {
      const position = (positions[index] as string).padEnd(width);
      lines.push(`  ${position}  ${entry.severity.padEnd(7)}  ${entry.rule}  ${entry.message}`);
      lines.push(`  ${" ".repeat(width)}  hint: ${entry.hint}`);
    });
    lines.push("");
  }
  const errors = sorted.filter((entry) => entry.severity === "error").length;
  const warnings = sorted.length - errors;
  lines.push(
    `${plural(sorted.length, "problem")} (${plural(errors, "error")}, ${plural(warnings, "warning")}) in ${plural(groups.size, "file")}`,
  );
  return `${lines.join("\n")}\n`;
}

export function formatFindings(findings: readonly Finding[], format: ReportFormat): string {
  if (format === "json") return formatJson(findings);
  if (format === "human") return formatHuman(findings);
  throw new RexError("REX506", `formatFindings: unknown format ${JSON.stringify(format)}`);
}
