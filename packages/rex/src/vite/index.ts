/// <reference path="./rex-app.d.ts" />
export {
  APP_MODULE_ID,
  CLIENT_SPECIFIER,
  CORE_SPECIFIER,
  DEFAULT_APP_DIR,
  ENTRY_MODULE_ID,
  RESOLVED_APP_MODULE_ID,
  RESOLVED_ENTRY_MODULE_ID,
  ROOT_ELEMENT_ID,
  RUNTIME_STYLESHEETS,
} from "./virtual.ts";
export {
  DECLARATION_FOLDERS,
  PAGE_FILES,
  RexAppScanError,
  scanApp,
  type AppScan,
  type ScannedNamedFile,
  type ScannedPage,
} from "./scan.ts";
export {
  resolveRuntimeEntry,
  runtimePaths,
  type ResolveContext,
  type RuntimePaths,
} from "./resolve.ts";
export {
  appModuleHook,
  generateAppModule,
  watchApp,
  type AppModuleOptions,
  type RexAppBundle,
  type RexPageModule,
} from "./app-module.ts";
export {
  entryModuleHook,
  generateEntryModule,
  runtimeStylesheets,
  type EntryModuleOptions,
} from "./entry-module.ts";
export {
  API_PREFIX,
  DENSITY_HEADER,
  DENSITY_QUERY,
  DENSITY_VALUES,
  devServerHook,
  forwardDensity,
  isApiPath,
  mountServer,
  type RexFetchApp,
  type RexServerSource,
} from "./dev-server.ts";
export {
  REX_HOOKS,
  configHook,
  reactHook,
  type RexHook,
  type RexHookContext,
  type RexHookState,
} from "./hooks.ts";
export {
  ALLOWED_ENV_NAMES,
  APP_SERVER_DIR,
  BOUNDARY_IMPORT_CODE,
  PUBLIC_ENV_PREFIX,
  SECRET_LEAK_CODE,
  SERVER_ONLY_HANDLER_MESSAGE,
  SERVER_ONLY_SPECIFIER,
  SERVER_SPECIFIER,
  boundaryError,
  boundaryHook,
  boundaryViolation,
  collectEnvReferences,
  findSecretNames,
  isActionModule,
  isPublicEnvName,
  serverOnlyModulePaths,
  stripActionHandlers,
  type BoundaryErrorCode,
  type BoundaryLog,
  type BoundaryViolation,
} from "./boundary.ts";
export { assemblePlugins, createHookContext, rex, type RexPluginOptions } from "./plugin.ts";
export { rex as default } from "./plugin.ts";
