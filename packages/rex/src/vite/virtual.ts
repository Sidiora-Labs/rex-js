export const APP_MODULE_ID = "rex:app";
export const RESOLVED_APP_MODULE_ID = "\0rex:app";
export const ENTRY_MODULE_ID = "/@rex/entry";
export const RESOLVED_ENTRY_MODULE_ID = "\0rex:entry";
export const DEFAULT_APP_DIR = "app";
export const ROOT_ELEMENT_ID = "root";
export const CORE_SPECIFIER = "@sidioralabs/rex";
export const CLIENT_SPECIFIER = "@sidioralabs/rex/client";
export const RUNTIME_STYLESHEETS = ["tokens.css", "agent/density.css"] as const;

export {
  DECLARATION_FOLDERS,
  PAGE_FILES,
  RexAppScanError,
  scanApp,
  type AppScan,
  type ScannedNamedFile,
  type ScannedPage,
} from "./scan.ts";
export { runtimePaths, type RuntimePaths } from "./resolve.ts";
export {
  generateAppModule,
  type AppModuleOptions,
  type RexAppBundle,
  type RexPageModule,
} from "./app-module.ts";
export {
  generateEntryModule,
  runtimeStylesheets,
  type EntryModuleOptions,
} from "./entry-module.ts";
