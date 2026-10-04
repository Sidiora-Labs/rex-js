import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REX_ERROR_CATALOG, RexError, errorDocs, type RexErrorCode } from "@sidioralabs/rex";
import { describe, expect, it } from "vitest";
import {
  REX_ERROR_AREAS,
  REX_ERROR_DOCS,
  errorArea,
} from "../../../../packages/rex/src/core/errors.docs.ts";
import {
  ERRORS_DOC,
  ERROR_AREA_DOCS,
  REPOSITORY_ROOT,
  errorCatalog,
  errorCodes,
  errorDetail,
  errorEntry,
  errorSearchEntries,
} from "./errors.ts";

const CODES = (Object.keys(REX_ERROR_CATALOG) as RexErrorCode[]).sort();
const AREAS = Object.values(REX_ERROR_AREAS);
const PREFIXES = AREAS.map((area) => area.prefix);

describe("error catalog reader", () => {
  it("reads the areas and hints from docs/errors.md, generated from the package's catalog", () => {
    const doc = readFileSync(ERRORS_DOC, "utf8");
    for (const area of AREAS) expect(doc).toContain(`\n## ${area.prefix}xx ${area.title}\n`);
    for (const code of CODES) expect(doc).toContain(`| [${code}](${errorDocs(code)}) |`);
  });

  it("reads every code of the package's catalog", () => {
    expect(errorCodes()).toEqual(CODES);
    expect(CODES.length).toBeGreaterThan(100);
  });

  it("carries the code, area, message, hint and the docs URL a RexError emits", () => {
    for (const code of CODES) {
      const entry = errorEntry(code);
      const area = REX_ERROR_AREAS[errorArea(code)];
      expect(entry.prefix).toBe(area.prefix);
      expect(entry.areaTitle).toBe(area.title);
      expect(entry.message).toBe(REX_ERROR_CATALOG[code]);
      expect(entry.hint).toBe(REX_ERROR_DOCS[code].hint);
      expect(entry.docs).toBe(new RexError(code, "probe").docs);
      expect(entry.route).toBe(`/errors/${code}`);
    }
  });

  it("groups the catalog by area in the framework's order", () => {
    const catalog = errorCatalog();
    expect(catalog.count).toBe(CODES.length);
    expect(catalog.areas.map((area) => area.prefix)).toEqual(PREFIXES);
    expect(catalog.areas.map((area) => area.title)).toEqual(AREAS.map((area) => area.title));
    expect(catalog.areas.flatMap((area) => area.entries.map((entry) => entry.code))).toEqual(CODES);
    for (const area of catalog.areas) {
      for (const entry of area.entries) {
        expect(entry.prefix).toBe(area.prefix);
        expect(REX_ERROR_AREAS[errorArea(entry.code)].prefix).toBe(area.prefix);
      }
    }
  });

  it("links every area to a doc page that exists in the repository", () => {
    expect(Object.keys(ERROR_AREA_DOCS).sort()).toEqual([...PREFIXES].sort());
    for (const area of errorCatalog().areas) {
      const file = resolve(REPOSITORY_ROOT, "docs", `${ERROR_AREA_DOCS[area.prefix]}.md`);
      expect(existsSync(file), file).toBe(true);
      expect(area.doc.href).toBe(`/docs/${ERROR_AREA_DOCS[area.prefix]}`);
      expect(readFileSync(file, "utf8").split("\n")[0]).toBe(`# ${area.doc.title}`);
    }
  });

  it("names the previous and next code of each entry", () => {
    const first = errorDetail(CODES[0] as RexErrorCode);
    expect(first.previous).toBeNull();
    expect(first.next).toBe(CODES[1]);
    const last = errorDetail(CODES.at(-1) as RexErrorCode);
    expect(last.next).toBeNull();
    expect(last.previous).toBe(CODES.at(-2));
    const detail = errorDetail("REX330");
    expect([detail.previous, detail.next]).toEqual(["REX329", "REX331"]);
    expect(detail.prefix).toBe("REX3");
    expect(detail.doc.href).toBe("/docs/architecture");
  });

  it("exposes one search entry per code at its route", () => {
    const entries = errorSearchEntries();
    expect(entries.map((entry) => entry.route)).toEqual(CODES.map((code) => `/errors/${code}`));
    expect(entries.find((entry) => entry.route === "/errors/REX310")?.title).toBe(
      `REX310 ${REX_ERROR_CATALOG.REX310}`,
    );
    for (const code of CODES) expect(new URL(errorDocs(code)).pathname).toBe(`/errors/${code}`);
  });
});
