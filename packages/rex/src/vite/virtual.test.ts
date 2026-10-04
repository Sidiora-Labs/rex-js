import { describe, expect, it } from "vitest";
import * as appModule from "./app-module.ts";
import * as entryModule from "./entry-module.ts";
import * as resolve from "./resolve.ts";
import * as scan from "./scan.ts";
import * as split from "./split.ts";
import * as virtual from "./virtual.ts";

const namespace = (module: object) => module as Readonly<Record<string, unknown>>;

const RESOLVED_IDS = [
  virtual.RESOLVED_APP_MODULE_ID,
  virtual.RESOLVED_MANIFEST_MODULE_ID,
  virtual.RESOLVED_ENTRY_MODULE_ID,
];

const REEXPORTS: readonly (readonly [object, readonly string[]])[] = [
  [scan, ["DECLARATION_FOLDERS", "PAGE_FILES", "RexAppScanError", "scanApp"]],
  [resolve, ["runtimePaths"]],
  [split, ["PAGE_BUDGET_KB", "chunkTable", "formatChunkTable", "pageChunkGroups", "pageChunkName"]],
  [appModule, ["generateAppModule"]],
  [entryModule, ["generateEntryModule", "runtimeStylesheets"]],
];

const OWN_EXPORTS = [
  "APP_MODULE_ID",
  "CLIENT_SPECIFIER",
  "CORE_SPECIFIER",
  "DEFAULT_APP_DIR",
  "ENTRY_MODULE_ID",
  "MANIFEST_MODULE_ID",
  "PAGE_CHUNK_PREFIX",
  "RESOLVED_APP_MODULE_ID",
  "RESOLVED_ENTRY_MODULE_ID",
  "RESOLVED_MANIFEST_MODULE_ID",
  "ROOT_ELEMENT_ID",
  "RUNTIME_STYLESHEETS",
];

describe("vite/virtual", () => {
  it("names the virtual modules and keeps their resolved ids out of the browser namespace", () => {
    expect(virtual.APP_MODULE_ID).toBe("rex:app");
    expect(virtual.MANIFEST_MODULE_ID).toBe("rex:manifest");
    expect(virtual.ENTRY_MODULE_ID).toBe("/@rex/entry");
    expect(virtual.RESOLVED_APP_MODULE_ID).toBe(`\0${virtual.APP_MODULE_ID}`);
    expect(virtual.RESOLVED_MANIFEST_MODULE_ID).toBe(`\0${virtual.MANIFEST_MODULE_ID}`);
    expect(virtual.RESOLVED_ENTRY_MODULE_ID).toBe("\0rex:entry");
    expect(new Set(RESOLVED_IDS).size).toBe(RESOLVED_IDS.length);
    for (const id of RESOLVED_IDS) expect(id.startsWith("\0")).toBe(true);
    expect(virtual.ENTRY_MODULE_ID.startsWith("/@")).toBe(true);
  });

  it("fixes the app folder, the root element, the package specifiers and the runtime stylesheets", () => {
    expect(virtual.DEFAULT_APP_DIR).toBe("app");
    expect(virtual.ROOT_ELEMENT_ID).toBe("root");
    expect(virtual.CORE_SPECIFIER).toBe("@sidioralabs/rex");
    expect(virtual.CLIENT_SPECIFIER).toBe(`${virtual.CORE_SPECIFIER}/client`);
    expect(virtual.RUNTIME_STYLESHEETS).toEqual(["tokens.css", "agent/density.css"]);
    expect(virtual.PAGE_CHUNK_PREFIX).toBe("page-");
  });

  it("re-exports the scan, resolve, split and module generator surfaces by identity", () => {
    for (const [source, names] of REEXPORTS) {
      for (const name of names) {
        expect(namespace(source)[name], name).toBeDefined();
        expect(namespace(virtual)[name], name).toBe(namespace(source)[name]);
      }
    }
  });

  it("exports exactly its own constants plus the re-exported names", () => {
    const expected = [...OWN_EXPORTS, ...REEXPORTS.flatMap(([, names]) => names)].sort();
    expect(Object.keys(virtual).sort()).toEqual(expected);
  });
});
