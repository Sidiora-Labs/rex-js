import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";
import { parseShortcut, RESERVED_SHORTCUTS, validateShortcut } from "../../core/action.ts";
import { DEV_AUDIT_PATH } from "../../server/routes/dev.ts";
import { createHookContext } from "../../vite/plugin.ts";
import {
  DEVTOOLS_ATTRIBUTE,
  DEVTOOLS_AUDIT_PATH,
  DEVTOOLS_DEFINE,
  DEVTOOLS_ENV_KEY,
  DEVTOOLS_SHORTCUT,
} from "./env.ts";
import * as devtools from "./index.ts";
import { devtoolsEnabled, devtoolsHook } from "./vite.ts";

function configOf(plugin: Plugin): unknown {
  const hook = plugin.config;
  if (typeof hook !== "function") {
    throw new Error(`plugin ${plugin.name} must declare config as a function`);
  }
  return Reflect.apply(hook, undefined, [{}, { command: "serve", mode: "development" }]);
}

describe("devtools env", () => {
  it("names the Vite define that gates the devtools", () => {
    expect(DEVTOOLS_ENV_KEY).toBe("REX_DEVTOOLS");
    expect(DEVTOOLS_DEFINE).toBe(`import.meta.env.${DEVTOOLS_ENV_KEY}`);
    expect(DEVTOOLS_DEFINE).toBe("import.meta.env.REX_DEVTOOLS");
    expect(import.meta.env[DEVTOOLS_ENV_KEY]).toBeUndefined();
  });

  it("declares a valid chord for the overlay that is not reserved", () => {
    expect(parseShortcut(DEVTOOLS_SHORTCUT)).toEqual({
      mod: true,
      shift: true,
      alt: false,
      key: "d",
    });
    expect(validateShortcut(DEVTOOLS_SHORTCUT)).toBe(DEVTOOLS_SHORTCUT);
    expect(RESERVED_SHORTCUTS).not.toContain(DEVTOOLS_SHORTCUT);
  });

  it("points the audit panel at the dev audit route and names the overlay attribute", () => {
    expect(DEVTOOLS_AUDIT_PATH).toBe(DEV_AUDIT_PATH);
    expect(DEVTOOLS_AUDIT_PATH.startsWith("/rex/dev/")).toBe(true);
    expect(DEVTOOLS_ATTRIBUTE).toBe("data-rex-devtools");
  });

  it("is re-exported unchanged by the devtools entry", () => {
    expect(devtools.DEVTOOLS_ENV_KEY).toBe(DEVTOOLS_ENV_KEY);
    expect(devtools.DEVTOOLS_DEFINE).toBe(DEVTOOLS_DEFINE);
    expect(devtools.DEVTOOLS_SHORTCUT).toBe(DEVTOOLS_SHORTCUT);
    expect(devtools.DEVTOOLS_AUDIT_PATH).toBe(DEVTOOLS_AUDIT_PATH);
    expect(devtools.DEVTOOLS_ATTRIBUTE).toBe(DEVTOOLS_ATTRIBUTE);
  });

  it("feeds the define into the Vite devtools hook", () => {
    const enabled = createHookContext({ name: "fixture" });
    expect(devtoolsEnabled(enabled)).toBe(true);
    const plugin = devtoolsHook(enabled);
    expect(plugin.name).toBe("rex:devtools");
    expect(configOf(plugin)).toEqual({ define: { [DEVTOOLS_DEFINE]: "true" } });
    const disabled = createHookContext({ name: "fixture", devtools: false });
    expect(devtoolsEnabled(disabled)).toBe(false);
    expect(configOf(devtoolsHook(disabled))).toEqual({ define: { [DEVTOOLS_DEFINE]: "false" } });
  });
});
