import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REX_ERROR_CATALOG, errorDocs, type RexErrorCode } from "@sidioralabs/rex";

export const REPOSITORY_ROOT = resolve(process.cwd(), "..");

export const ERRORS_DOC = resolve(REPOSITORY_ROOT, "docs", "errors.md");

export const ERROR_AREA_DOCS: Readonly<Record<string, string>> = Object.freeze({
  REX1: "cli",
  REX2: "primitives",
  REX3: "architecture",
  REX4: "platforms",
  REX5: "convention",
  REX6: "cli",
});

export interface ErrorAreaDoc {
  readonly slug: string;
  readonly title: string;
  readonly href: string;
}

export interface ErrorArea {
  readonly prefix: string;
  readonly title: string;
}

export interface ErrorEntry {
  readonly code: RexErrorCode;
  readonly prefix: string;
  readonly areaTitle: string;
  readonly message: string;
  readonly hint: string;
  readonly docs: string;
  readonly route: string;
}

export interface ErrorAreaGroup {
  readonly prefix: string;
  readonly title: string;
  readonly doc: ErrorAreaDoc;
  readonly entries: ErrorEntry[];
}

export interface ErrorCatalog {
  readonly count: number;
  readonly areas: ErrorAreaGroup[];
}

export interface ErrorDetail extends ErrorEntry {
  readonly doc: ErrorAreaDoc;
  readonly previous: RexErrorCode | null;
  readonly next: RexErrorCode | null;
}

export interface ErrorSearchEntry {
  readonly title: string;
  readonly route: string;
  readonly headings: string[];
  readonly summary: string;
}

interface ErrorsDoc {
  readonly areas: ErrorArea[];
  readonly hints: ReadonlyMap<string, string>;
}

const DOC_TITLE = /^# (.+)$/m;
const AREA_HEADING = /^## (REX\d)xx (.+)$/;
const CODE_ROW = /^\| \[(REX\d{3})\]\(\S+\) \| ((?:[^|\\]|\\.)*) \| ((?:[^|\\]|\\.)*) \|$/;

function cell(text: string): string {
  return text.replace(/\\\|/g, "|");
}

export function readErrorsDoc(): ErrorsDoc {
  const areas: ErrorArea[] = [];
  const hints = new Map<string, string>();
  for (const line of readFileSync(ERRORS_DOC, "utf8").split("\n")) {
    const heading = AREA_HEADING.exec(line);
    if (heading !== null) {
      areas.push({ prefix: heading[1] as string, title: (heading[2] as string).trim() });
      continue;
    }
    const row = CODE_ROW.exec(line);
    if (row !== null) hints.set(row[1] as string, cell(row[3] as string));
  }
  return { areas, hints };
}

export function errorCodes(): RexErrorCode[] {
  return (Object.keys(REX_ERROR_CATALOG) as RexErrorCode[]).sort();
}

export function errorRoute(code: RexErrorCode): string {
  return new URL(errorDocs(code)).pathname;
}

export function areaDoc(prefix: string): ErrorAreaDoc {
  const slug = ERROR_AREA_DOCS[prefix];
  if (slug === undefined) {
    throw new Error(
      `docs/errors.md lists the area ${prefix}xx, which has no doc page in ERROR_AREA_DOCS`,
    );
  }
  const source = readFileSync(resolve(REPOSITORY_ROOT, "docs", `${slug}.md`), "utf8");
  const title = DOC_TITLE.exec(source)?.[1];
  if (title === undefined) {
    throw new Error(
      `docs/${slug}.md has no first-level heading to title the ${prefix}xx error area`,
    );
  }
  return { slug, title: title.trim(), href: `/docs/${slug}` };
}

function areaOf(doc: ErrorsDoc, code: RexErrorCode): ErrorArea {
  const area = doc.areas.find((candidate) => code.startsWith(candidate.prefix));
  if (area === undefined) {
    throw new Error(`docs/errors.md has no area heading for ${code}; run pnpm docs:errors`);
  }
  return area;
}

function entryOf(doc: ErrorsDoc, code: RexErrorCode): ErrorEntry {
  const area = areaOf(doc, code);
  const hint = doc.hints.get(code);
  if (hint === undefined) {
    throw new Error(`docs/errors.md has no row for ${code}; run pnpm docs:errors`);
  }
  return {
    code,
    prefix: area.prefix,
    areaTitle: area.title,
    message: REX_ERROR_CATALOG[code],
    hint,
    docs: errorDocs(code),
    route: errorRoute(code),
  };
}

export function errorEntry(code: RexErrorCode): ErrorEntry {
  return entryOf(readErrorsDoc(), code);
}

export function errorCatalog(): ErrorCatalog {
  const doc = readErrorsDoc();
  const codes = errorCodes();
  const entries = codes.map((code) => entryOf(doc, code));
  const areas = doc.areas
    .map((area) => ({
      prefix: area.prefix,
      title: area.title,
      doc: areaDoc(area.prefix),
      entries: entries.filter((entry) => entry.prefix === area.prefix),
    }))
    .filter((group) => group.entries.length > 0);
  return { count: codes.length, areas };
}

export function errorDetail(code: RexErrorCode): ErrorDetail {
  const codes = errorCodes();
  const index = codes.indexOf(code);
  const entry = errorEntry(code);
  return {
    ...entry,
    doc: areaDoc(entry.prefix),
    previous: codes[index - 1] ?? null,
    next: codes[index + 1] ?? null,
  };
}

export function errorSearchEntries(): ErrorSearchEntry[] {
  const doc = readErrorsDoc();
  return errorCodes().map((code) => {
    const entry = entryOf(doc, code);
    return {
      title: `${code} ${entry.message}`,
      route: entry.route,
      headings: [entry.areaTitle],
      summary: entry.hint,
    };
  });
}
