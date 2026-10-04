import { describe, expect, expectTypeOf, it } from "vitest";
import {
  DESIGNX_ITEMS,
  DESIGNX_ITEM_KINDS,
  DESIGNX_MAP,
  DESIGNX_PROVIDED,
  DESIGNX_SINGLE_FORM,
  DESIGNX_STANDARD,
  DESIGNX_SURFACES,
  DESIGNX_THEME_ITEM,
  designxItem,
  designxItemKind,
  designxSurfaceItems,
  isDesignxItem,
  isDesignxProvided,
  type DesignxItemKind,
  type DesignxItemName,
  type DesignxSurface,
} from "./index.ts";

type Forms = Readonly<Record<string, DesignxItemName>>;

function formsOf(surface: DesignxSurface): Forms {
  return DESIGNX_MAP[surface] as Forms;
}

describe("rex/designx registry", () => {
  it("freezes every table so surfaces cannot be re-pointed at runtime", () => {
    expect(Object.isFrozen(DESIGNX_ITEMS)).toBe(true);
    expect(Object.isFrozen(DESIGNX_PROVIDED)).toBe(true);
    expect(Object.isFrozen(DESIGNX_PROVIDED["use-mobile"])).toBe(true);
    expect(Object.isFrozen(DESIGNX_MAP)).toBe(true);
    expect(Object.isFrozen(DESIGNX_SURFACES)).toBe(true);
    expect(Object.isFrozen(DESIGNX_STANDARD)).toBe(true);
    for (const surface of DESIGNX_SURFACES) {
      expect(Object.isFrozen(formsOf(surface)), surface).toBe(true);
    }
    expect([...DESIGNX_SURFACES]).toEqual(Object.keys(DESIGNX_MAP));
    expect(DESIGNX_SINGLE_FORM).toBe("default");
  });

  it("dedups and sorts the items a surface resolves to", () => {
    expect(designxSurfaceItems("list")).toEqual(["card", "data-table"]);
    expect(designxSurfaceItems("states")).toEqual(["alert", "badge", "empty", "skeleton"]);
    expect(designxSurfaceItems("sheet")).toEqual(["dialog", "sheet"]);
    expect(designxSurfaceItems("button")).toEqual(["button"]);
    for (const surface of DESIGNX_SURFACES) {
      const items = designxSurfaceItems(surface);
      expect(items, surface).toEqual([...new Set(Object.values(formsOf(surface)))].sort());
      expect(items.length, surface).toBeGreaterThan(0);
    }
  });

  it("partitions the items by kind and maps the hook surfaces to hooks", () => {
    const byKind: Record<DesignxItemKind, string[]> = { ui: [], hook: [], lib: [], style: [] };
    for (const name of Object.keys(DESIGNX_ITEMS) as DesignxItemName[]) {
      const kind = designxItemKind(name);
      expect(kind, name).toBe(DESIGNX_ITEMS[name]);
      expect(DESIGNX_ITEM_KINDS, name).toContain(kind);
      byKind[kind].push(name);
    }
    expect(byKind.style).toEqual(["theme"]);
    expect(byKind.lib).toEqual(["utils"]);
    expect(byKind.hook).toEqual(["use-media-query", "use-touch-capable"]);
    expect(byKind.ui.length).toBeGreaterThan(30);
    expect(designxItem("mediaQuery", "default")).toBe("use-media-query");
    expect(designxItem("touch", "default")).toBe("use-touch-capable");
    for (const surface of DESIGNX_SURFACES) {
      for (const item of designxSurfaceItems(surface)) {
        expect(["ui", "hook"], `${surface} ${item}`).toContain(designxItemKind(item));
      }
    }
    expectTypeOf<DesignxItemKind>().toEqualTypeOf<"ui" | "hook" | "lib" | "style">();
  });

  it("rejects unknown forms and recognises names by own property only", () => {
    expect(() => designxItem("sheet", "drawer" as "dialog")).toThrow(
      new Error("rex/designx: the sheet surface has no drawer form"),
    );
    expect(() => designxItem("list", "wide-screen" as "phone")).toThrow(
      /the list surface has no wide-screen form/,
    );
    expect(isDesignxItem("drawer")).toBe(false);
    expect(isDesignxItem("hasOwnProperty")).toBe(false);
    expect(isDesignxItem("theme")).toBe(true);
    expect(isDesignxProvided("theme")).toBe(false);
    expect(isDesignxProvided("constructor")).toBe(false);
    expect(isDesignxProvided("use-mobile")).toBe(true);
  });

  it("covers the theme and every surface item in the standard set exactly once", () => {
    expect(DESIGNX_THEME_ITEM).toBe("theme");
    expect(designxItemKind(DESIGNX_THEME_ITEM)).toBe("style");
    expect(DESIGNX_STANDARD).toContain(DESIGNX_THEME_ITEM);
    expect([...DESIGNX_STANDARD]).toEqual([...new Set(DESIGNX_STANDARD)].sort());
    for (const surface of DESIGNX_SURFACES) {
      for (const item of designxSurfaceItems(surface)) {
        expect(DESIGNX_STANDARD, `${surface} ${item}`).toContain(item);
      }
    }
    expect(DESIGNX_STANDARD).toHaveLength(Object.keys(DESIGNX_ITEMS).length);
    for (const name of Object.keys(DESIGNX_PROVIDED)) {
      expect(DESIGNX_STANDARD, name).not.toContain(name);
    }
  });
});
