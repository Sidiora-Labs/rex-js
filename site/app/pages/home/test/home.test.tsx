import { anonymousActor } from "@sidioralabs/rex";
import { createTestApp, renderPage, renderRegion, setupRexTesting } from "@sidioralabs/rex/testing";
import { waitFor, within } from "@testing-library/react";
import app from "rex:app";
import { afterEach, describe, expect, it } from "vitest";

setupRexTesting({ afterEach });

const HEADINGS: ReadonlyArray<readonly [region: string, level: number, text: string]> = [
  ["hero", 1, "The UI framework agents can operate"],
  ["pitch", 2, "One way to build it, one DOM to operate it"],
  ["primitives", 2, "Five declarations and the manifest"],
  ["how-it-works", 2, "How an agent operates a Rex page"],
  ["install", 2, "Install"],
  ["features", 2, "Features"],
  ["live-sidecar", 2, "This page's own sidecar"],
  ["footer", 2, "Rex by Sidiora Labs"],
];

function siteApp() {
  return createTestApp(app, { actor: anonymousActor });
}

describe("home page", () => {
  it("declares the regions of the design in order and renders at build time", () => {
    const home = siteApp().page("home");
    expect(home.route).toBe("/");
    expect(home.render).toBe("ssg");
    expect(home.chrome.title).toBe("Home");
    expect(home.regions).toEqual(HEADINGS.map(([region]) => region));
  });

  it("renders every region with its heading in the shell", async () => {
    const view = await renderPage(siteApp(), "home");
    await waitFor(() => expect(view.sidecar().state).toBe("ready"));
    const main = view.container.querySelector('main[data-rex-page="home"]');
    expect(main).not.toBeNull();
    for (const [region, level, text] of HEADINGS) {
      const element = main?.querySelector(`[data-rex-region="home/${region}"]`);
      expect(element, region).not.toBeNull();
      expect(
        within(element as HTMLElement).getByRole("heading", { level, name: text }),
      ).toBeTruthy();
    }
    expect(within(main as HTMLElement).getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("lists the page in the sidecar with no actions", async () => {
    const view = await renderPage(siteApp(), "home");
    await waitFor(() => expect(view.sidecar().state).toBe("ready"));
    const sidecar = view.sidecar();
    expect(sidecar.page).toBe("home");
    expect(sidecar.actions).toEqual([]);
    expect(sidecar.overlays).toEqual([]);
  });

  it("navigates from the shell with data-rex-nav and marks home current", async () => {
    const view = await renderPage(siteApp(), "home");
    await waitFor(() => expect(view.sidecar().state).toBe("ready"));
    const link = view.container.querySelector('[data-rex-nav="home"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute("aria-current")).toBe("page");
    expect(link?.getAttribute("href")).toBe("/");
  });

  it("renders the shell with the mark in both schemes, the GitHub link and the theme toggle", async () => {
    const view = await renderPage(siteApp(), "home");
    await waitFor(() => expect(view.sidecar().state).toBe("ready"));
    const marks = [...view.container.querySelectorAll("[data-site-mark] img")];
    expect(marks.map((image) => image.getAttribute("src"))).toEqual([
      "/mark-light.png",
      "/mark-dark.png",
    ]);
    const github = view.container.querySelector("[data-site-github]");
    expect(github?.getAttribute("href")).toBe("https://github.com/Sidiora-Labs/rex-js");
    expect(view.container.querySelector("[data-site-theme-toggle]")).not.toBeNull();
  });

  it("renders a region alone on the page runtime", async () => {
    const view = await renderRegion(siteApp(), "home", "install");
    await waitFor(() => expect(view.sidecar().state).toBe("ready"));
    expect(view.container.querySelector('[data-rex-region="home/install"]')).not.toBeNull();
    expect(view.container.querySelector('[data-rex-region="home/hero"]')).toBeNull();
  });
});
