import { describe, expect, it } from "vitest";
import { SHELL_NAV_FORMS, SHELL_SHEET_FORMS } from "../client/shell/components.ts";
import { REX_DATA_STATES } from "../core/states.ts";
import { REX_SCREENS } from "../manifest/types.ts";
import {
  DESIGNX_ITEMS,
  DESIGNX_ITEM_KINDS,
  DESIGNX_MAP,
  DESIGNX_PROVIDED,
  DESIGNX_REGISTRY_URL,
  DESIGNX_STANDARD,
  DESIGNX_SURFACES,
  designxItem,
  designxItemKind,
  designxSurfaceItems,
  isDesignxItem,
  isDesignxProvided,
} from "./index.ts";

const BASE_SET = [
  "button",
  "card",
  "field",
  "input",
  "select",
  "sheet",
  "dialog",
  "skeleton",
  "empty",
  "command",
  "table",
  "tabs",
  "tooltip",
  "kbd",
  "badge",
];

describe("rex/designx map", () => {
  it("resolves every surface form to one registry item of the standard set", () => {
    expect(DESIGNX_REGISTRY_URL).toBe("https://dxuireact.com/r");
    expect(DESIGNX_SURFACES.length).toBeGreaterThan(0);
    for (const surface of DESIGNX_SURFACES) {
      const forms = DESIGNX_MAP[surface] as Readonly<Record<string, string>>;
      expect(Object.keys(forms).length, surface).toBeGreaterThan(0);
      for (const [form, item] of Object.entries(forms)) {
        expect(isDesignxItem(item), `${surface}.${form}`).toBe(true);
        expect(DESIGNX_STANDARD, `${surface}.${form}`).toContain(item);
      }
    }
  });

  it("maps the shell slots, the screen forms and the data states", () => {
    expect(designxItem("button", "default")).toBe("button");
    expect(designxItem("paletteItem", "default")).toBe("command");
    expect(designxItem("outcome", "default")).toBe("alert");
    expect(Object.keys(DESIGNX_MAP.sheet).sort()).toEqual([...SHELL_SHEET_FORMS].sort());
    expect(designxItem("sheet", "dialog")).toBe("dialog");
    expect(designxItem("sheet", "bottom-sheet")).toBe("sheet");
    expect(Object.keys(DESIGNX_MAP.nav).sort()).toEqual([...SHELL_NAV_FORMS].sort());
    expect(designxItem("nav", "sidebar")).toBe("sidebar");
    expect(designxItem("nav", "bar")).toBe("navigation-menu");
    expect(designxItem("nav", "dock")).toBe("toolbar");
    expect(Object.keys(DESIGNX_MAP.list).sort()).toEqual([...REX_SCREENS].sort());
    expect(designxItem("list", "desktop")).toBe("data-table");
    expect(designxItem("list", "phone")).toBe("card");
    expect(Object.keys(DESIGNX_MAP.states).sort()).toEqual(
      REX_DATA_STATES.filter((state) => state !== "ready").sort(),
    );
    expect(designxItem("states", "loading")).toBe("skeleton");
    expect(designxItem("states", "empty")).toBe("empty");
    for (const state of ["permission-denied", "recoverable-error", "terminal-error"] as const) {
      expect(designxItem("states", state)).toBe("alert");
    }
    expect(designxItem("states", "stale")).toBe("badge");
    expect(designxItem("states", "offline")).toBe("badge");
    expect(designxSurfaceItems("nav")).toEqual(["navigation-menu", "sidebar", "toolbar"]);
    expect(() => designxItem("button", "wide" as "default")).toThrow(/has no wide form/);
  });

  it("names a standard set of ui, hook, lib and style items that covers the 0.2 base set", () => {
    expect([...DESIGNX_STANDARD]).toEqual([...new Set(DESIGNX_STANDARD)].sort());
    for (const name of BASE_SET) expect(DESIGNX_STANDARD, name).toContain(name);
    for (const name of ["theme", "utils", "form", "number-field", "data-table", "pagination"]) {
      expect(DESIGNX_STANDARD, name).toContain(name);
    }
    for (const name of DESIGNX_STANDARD) {
      expect(DESIGNX_ITEM_KINDS, name).toContain(designxItemKind(name));
    }
    expect(designxItemKind("theme")).toBe("style");
    expect(designxItemKind("utils")).toBe("lib");
    expect(designxItemKind("use-media-query")).toBe("hook");
    expect(Object.keys(DESIGNX_ITEMS).sort()).toEqual([...DESIGNX_STANDARD]);
  });

  it("provides use-mobile through the Rex screen hook instead of installing it", () => {
    expect(isDesignxProvided("use-mobile")).toBe(true);
    expect(isDesignxItem("use-mobile")).toBe(false);
    expect(DESIGNX_STANDARD).not.toContain("use-mobile");
    expect(DESIGNX_PROVIDED["use-mobile"]).toEqual({
      file: "use-screen.ts",
      alias: "@/hooks/use-mobile",
      from: "useScreen from @sidioralabs/rex/client",
    });
  });
});
