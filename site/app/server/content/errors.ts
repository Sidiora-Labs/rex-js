import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REX_ERROR_CATALOG, errorDocs, type RexErrorCode } from "@sidioralabs/rex";
import {
  REX_ERROR_AREAS,
  REX_ERROR_DOCS,
  errorArea,
  type RexErrorArea,
} from "../../../../packages/rex/src/core/errors.docs.ts";

export const REPOSITORY_ROOT = resolve(process.cwd(), "..");

export const ERROR_AREA_DOCS: Readonly<Record<RexErrorArea, string>> = Object.freeze({
  config: "cli",
  declaration: "primitives",
  runtime: "architecture",
  server: "platforms",
  checker: "convention",
  cli: "cli",
});

export interface ErrorAreaDoc {
  readonly slug: string;
  readonly title: string;
  readonly href: string;
}

export interface ErrorEntry {
  readonly code: RexErrorCode;
  readonly area: RexErrorArea;
  readonly areaTitle: string;
  readonly message: string;
  readonly hint: string;
  readonly docs: string;
  readonly route: string;
}

export interface ErrorAreaGroup {
  readonly id: RexErrorArea;
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
  readonly prefix: string;
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

const DOC_TITLE = /^# (.+)$/m;

export function errorCodes(): RexErrorCode[] {
  return (Object.keys(REX_ERROR_CATALOG) as RexErrorCode[]).sort();
}

export function errorRoute(code: RexErrorCode): string {
  return new URL(errorDocs(code)).pathname;
}

export function areaDoc(area: RexErrorArea): ErrorAreaDoc {
  const slug = ERROR_AREA_DOCS[area];
  const source = readFileSync(resolve(REPOSITORY_ROOT, "docs", `${slug}.md`), "utf8");
  const title = DOC_TITLE.exec(source)?.[1];
  if (title === undefined) {
    throw new Error(`docs/${slug}.md has no first-level heading to title the ${area} error area`);
  }
  return { slug, title: title.trim(), href: `/docs/${slug}` };
}

export function errorEntry(code: RexErrorCode): ErrorEntry {
  const area = errorArea(code);
  return {
    code,
    area,
    areaTitle: REX_ERROR_AREAS[area].title,
    message: REX_ERROR_CATALOG[code],
    hint: REX_ERROR_DOCS[code].hint,
    docs: errorDocs(code),
    route: errorRoute(code),
  };
}

export function errorCatalog(): ErrorCatalog {
  const codes = errorCodes();
  const areas = (Object.keys(REX_ERROR_AREAS) as RexErrorArea[])
    .map((id) => ({
      id,
      prefix: REX_ERROR_AREAS[id].prefix,
      title: REX_ERROR_AREAS[id].title,
      doc: areaDoc(id),
      entries: codes.filter((code) => errorArea(code) === id).map(errorEntry),
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
    prefix: REX_ERROR_AREAS[entry.area].prefix,
    doc: areaDoc(entry.area),
    previous: codes[index - 1] ?? null,
    next: codes[index + 1] ?? null,
  };
}

export function errorSearchEntries(): ErrorSearchEntry[] {
  return errorCodes().map((code) => {
    const entry = errorEntry(code);
    return {
      title: `${code} ${entry.message}`,
      route: entry.route,
      headings: [entry.areaTitle],
      summary: entry.hint,
    };
  });
}
