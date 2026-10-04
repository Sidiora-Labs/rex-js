import { REX_ERROR_CATALOG, anonymousActor, errorDocs, type RexErrorCode } from "@sidioralabs/rex";
import { createTestApp, renderPage, setupRexTesting } from "@sidioralabs/rex/testing";
import { fireEvent, waitFor, within } from "@testing-library/react";
import app from "rex:app";
import { afterEach, describe, expect, it } from "vitest";
import { REX_ERROR_AREAS } from "../../../../../packages/rex/src/core/errors.docs.ts";

setupRexTesting({ afterEach });

const CODES = (Object.keys(REX_ERROR_CATALOG) as RexErrorCode[]).sort();

function siteApp() {
  return createTestApp(app, { actor: anonymousActor });
}

async function renderCatalog() {
  const view = await renderPage(siteApp(), "errors");
  await waitFor(() => expect(view.sidecar().state).toBe("ready"));
  await waitFor(() =>
    expect(view.container.querySelectorAll("[data-site-error-code]")).toHaveLength(CODES.length),
  );
  return view;
}

function shownCodes(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[data-site-error-code]")].map(
    (item) => item.getAttribute("data-site-error-code") ?? "",
  );
}

describe("errors page", () => {
  it("declares the catalog page prerendered with its loader", () => {
    const errors = siteApp().page("errors");
    expect(errors.route).toBe("/errors");
    expect(errors.render).toBe("ssg");
    expect(errors.draft).toBe("route");
    expect(errors.chrome.title).toBe("Errors");
    expect(errors.chrome.back).toBe("home");
    expect(errors.regions).toEqual(["catalog"]);
    expect(errors.loaders.map((loader) => [loader.name, loader.action.id])).toEqual([
      ["catalog", "errors-catalog"],
    ]);
  });

  it("lists every code of the catalog once, grouped under its area", async () => {
    const view = await renderCatalog();
    const region = view.container.querySelector(
      '[data-rex-region="errors/catalog"]',
    ) as HTMLElement;
    expect(region).not.toBeNull();
    expect(shownCodes(region)).toEqual(CODES);
    const areas = Object.values(REX_ERROR_AREAS);
    const sections = [...region.querySelectorAll("[data-site-error-area]")];
    expect(sections.map((section) => section.getAttribute("data-site-error-area"))).toEqual(
      areas.map((area) => area.prefix),
    );
    for (const [index, section] of sections.entries()) {
      const area = areas[index] as (typeof areas)[number];
      expect(
        within(section as HTMLElement).getByRole("heading", {
          level: 2,
          name: `${area.prefix}xx ${area.title}`,
        }),
      ).toBeTruthy();
      const codes = shownCodes(section as HTMLElement);
      expect(codes.length).toBeGreaterThan(0);
      for (const code of codes) expect(code.startsWith(area.prefix)).toBe(true);
    }
    expect(
      region.querySelector("[data-site-errors-count]")?.getAttribute("data-site-errors-count"),
    ).toBe(String(CODES.length));
  });

  it("shows each code's message and hint and links it to the docs URL the framework emits", async () => {
    const view = await renderCatalog();
    const item = view.container.querySelector('[data-site-error-code="REX330"]') as HTMLElement;
    expect(item.textContent).toContain(REX_ERROR_CATALOG.REX330);
    const link = within(item).getByRole("link", { name: "REX330" });
    expect(link.getAttribute("href")).toBe(new URL(errorDocs("REX330")).pathname);
    for (const code of CODES) {
      const anchor = view.container.querySelector(
        `[data-site-error-code="${code}"] a`,
      ) as HTMLAnchorElement;
      expect(anchor.getAttribute("href")).toBe(new URL(errorDocs(code)).pathname);
    }
  });

  it("filters the catalog on code or message text through the route draft", async () => {
    const view = await renderCatalog();
    const input = view.container.querySelector('input[name="errors-filter"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: "hydration" } });
    await waitFor(() => expect(shownCodes(view.container)).toEqual(["REX310"]));
    expect(view.history.at(-1)).toContain("draft=");
    fireEvent.change(input, { target: { value: "REX33" } });
    await waitFor(() =>
      expect(shownCodes(view.container)).toEqual(CODES.filter((code) => code.startsWith("REX33"))),
    );
    fireEvent.change(input, { target: { value: "no such error" } });
    await waitFor(() =>
      expect(view.container.querySelector("[data-site-errors-empty]")).not.toBeNull(),
    );
    expect(shownCodes(view.container)).toEqual([]);
  });

  it("publishes its sidecar with no actions", async () => {
    const view = await renderCatalog();
    const sidecar = view.sidecar();
    expect(sidecar.page).toBe("errors");
    expect(sidecar.params).toEqual({});
    expect(sidecar.state).toBe("ready");
    expect(sidecar.actions).toEqual([]);
    expect(sidecar.overlays).toEqual([]);
    expect(view.container.querySelector('main[data-rex-page="errors"]')).not.toBeNull();
    expect(
      view.container.querySelector('[data-rex-nav="errors"]')?.getAttribute("aria-current"),
    ).toBe("page");
  });
});
