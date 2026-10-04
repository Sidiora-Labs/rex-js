import { describe, expect, it } from "vitest";
import * as appModule from "./app-module.ts";
import * as boundary from "./boundary.ts";
import * as devServer from "./dev-server.ts";
import * as entryModule from "./entry-module.ts";
import * as hmr from "./hmr.ts";
import * as hooks from "./hooks.ts";
import * as index from "./index.ts";
import plugin, { rex } from "./index.ts";
import * as nonce from "./nonce.ts";
import * as overlay from "./overlay.ts";
import * as pluginModule from "./plugin.ts";
import * as resolve from "./resolve.ts";
import * as scan from "./scan.ts";
import * as shellComponents from "./shell-components.ts";
import * as virtual from "./virtual.ts";

const namespace = (module: object) => module as Readonly<Record<string, unknown>>;

const SURFACE: readonly (readonly [string, object, readonly string[]])[] = [
  [
    "virtual",
    virtual,
    [
      "APP_MODULE_ID",
      "CLIENT_SPECIFIER",
      "CORE_SPECIFIER",
      "DEFAULT_APP_DIR",
      "ENTRY_MODULE_ID",
      "RESOLVED_APP_MODULE_ID",
      "RESOLVED_ENTRY_MODULE_ID",
      "ROOT_ELEMENT_ID",
      "RUNTIME_STYLESHEETS",
    ],
  ],
  ["scan", scan, ["DECLARATION_FOLDERS", "PAGE_FILES", "RexAppScanError", "scanApp"]],
  ["resolve", resolve, ["resolveRuntimeEntry", "runtimePaths"]],
  [
    "app-module",
    appModule,
    ["appModuleHook", "generateAppModule", "invalidateAppModule", "watchApp"],
  ],
  ["shell-components", shellComponents, ["shellComponentsHook"]],
  ["entry-module", entryModule, ["entryModuleHook", "generateEntryModule", "runtimeStylesheets"]],
  [
    "dev-server",
    devServer,
    [
      "API_PREFIX",
      "DENSITY_HEADER",
      "DENSITY_QUERY",
      "DENSITY_VALUES",
      "devServerHook",
      "forwardDensity",
      "isApiPath",
      "mountServer",
    ],
  ],
  [
    "hmr",
    hmr,
    [
      "PAGE_DECLARATION_FILE",
      "PAGE_RELOAD_CODE",
      "REX_NOTICE_EVENT",
      "hmrHook",
      "invalidatePage",
      "pageIdOfDeclaration",
      "pageReloadNotice",
    ],
  ],
  ["hooks", hooks, ["REX_HOOKS", "configHook", "reactHook"]],
  ["nonce", nonce, ["CSP_NONCE_META_PROPERTY", "applyNonce", "nonceHook", "nonceMetaTag"]],
  [
    "boundary",
    boundary,
    [
      "ALLOWED_ENV_NAMES",
      "APP_SERVER_DIR",
      "BOUNDARY_IMPORT_CODE",
      "PUBLIC_ENV_PREFIX",
      "SECRET_LEAK_CODE",
      "SERVER_ONLY_HANDLER_CODE",
      "SERVER_ONLY_HANDLER_MESSAGE",
      "SERVER_ONLY_SPECIFIER",
      "SERVER_SPECIFIER",
      "boundaryError",
      "boundaryHook",
      "boundaryViolation",
      "collectEnvReferences",
      "findSecretNames",
      "isActionModule",
      "isPublicEnvName",
      "serverOnlyModulePaths",
      "stripActionHandlers",
    ],
  ],
  [
    "overlay",
    overlay,
    [
      "OVERLAY_PLUGIN",
      "appStackFrame",
      "attachOverlayFields",
      "checkAppModules",
      "locateAppError",
      "overlayError",
      "overlayHook",
      "reportAppError",
    ],
  ],
  ["plugin", pluginModule, ["assemblePlugins", "createHookContext", "rex"]],
];

describe("vite/index", () => {
  it("re-exports every name of the plugin surface by identity", () => {
    for (const [module, source, names] of SURFACE) {
      for (const name of names) {
        const value = namespace(source)[name];
        expect(value, `${module}.${name}`).toBeDefined();
        expect(namespace(index)[name], `${module}.${name}`).toBe(value);
      }
    }
  });

  it("default-exports the rex plugin factory", () => {
    expect(plugin).toBe(pluginModule.rex);
    expect(rex).toBe(pluginModule.rex);
    expect(index.default).toBe(pluginModule.rex);
    expect(typeof plugin).toBe("function");
  });

  it("exports exactly the documented surface", () => {
    const expected = [...SURFACE.flatMap(([, , names]) => names), "default"].sort();
    expect(new Set(expected).size).toBe(expected.length);
    expect(Object.keys(index).sort()).toEqual(expected);
  });
});
