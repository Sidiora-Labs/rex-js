import { existsSync } from "node:fs";
import path from "node:path";
import { anonymousActor } from "@sidioralabs/rex";
import { createTestApp, renderPage, setupRexTesting } from "@sidioralabs/rex/testing";
import { waitFor, within } from "@testing-library/react";
import app from "rex:app";
import { afterEach, describe, expect, it } from "vitest";
import { REPOSITORY_URL } from "../../../components/Shell.tsx";

setupRexTesting({ afterEach });

const ROOT = path.resolve(process.cwd(), "..");

const REGIONS: ReadonlyArray<readonly [region: string, heading: string]> = [
  ["sidiora", "Sidiora Labs"],
  ["license", "License"],
  ["governance", "Governance"],
  ["contributing", "Contributing"],
  ["security", "Security"],
];

function siteApp() {
  return createTestApp(app, { actor: anonymousActor });
}

async function aboutPage() {
  const view = await renderPage(siteApp(), "about");
  await waitFor(() => expect(view.sidecar().state).toBe("ready"));
  const main = await waitFor(() => {
    const found = view.container.querySelector('main[data-rex-page="about"]');
    expect(found).not.toBeNull();
    return found;
  });
  return { view, main: main as HTMLElement };
}

describe("about page", () => {
  it("declares a static page at /about with the five regions and no loader", () => {
    const about = siteApp().page("about");
    expect(about.route).toBe("/about");
    expect(about.render).toBe("static");
    expect(about.chrome.title).toBe("About");
    expect(about.chrome.back).toBe("home");
    expect(about.regions).toEqual(REGIONS.map(([region]) => region));
    expect(about.loaders).toEqual([]);
  });

  it("renders every region with its heading", async () => {
    const { main } = await aboutPage();
    for (const [region, heading] of REGIONS) {
      const element = main.querySelector(`[data-rex-region="about/${region}"]`);
      expect(element, region).not.toBeNull();
      expect(
        within(element as HTMLElement).getByRole("heading", { level: 2, name: heading }),
      ).toBeTruthy();
    }
  });

  it("links repository files that exist in the repository from every region", async () => {
    const { main } = await aboutPage();
    const files = [...main.querySelectorAll("a[data-site-repository-file]")];
    expect(files.length).toBeGreaterThan(0);
    for (const link of files) {
      const file = link.getAttribute("data-site-repository-file") as string;
      expect(existsSync(path.join(ROOT, file)), file).toBe(true);
      expect(link.getAttribute("href")).toBe(`${REPOSITORY_URL}/blob/main/${file}`);
    }
    for (const [region] of REGIONS) {
      const element = main.querySelector(`[data-rex-region="about/${region}"]`) as HTMLElement;
      expect(
        element.querySelectorAll("a[data-site-repository-file]").length,
        region,
      ).toBeGreaterThan(0);
    }
    const linked = files.map((link) => link.getAttribute("data-site-repository-file"));
    for (const file of [
      "LICENSE",
      "GOVERNANCE.md",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "MAINTAINERS.md",
    ]) {
      expect(linked).toContain(file);
    }
  });

  it("points every link at the repository or Sidiora Labs on GitHub", async () => {
    const { main } = await aboutPage();
    const hrefs = [...main.querySelectorAll("a[href]")].map(
      (link) => link.getAttribute("href") as string,
    );
    for (const href of hrefs) {
      expect(
        href.startsWith(REPOSITORY_URL) || href === "https://github.com/Sidiora-Labs",
        href,
      ).toBe(true);
    }
    expect(hrefs).toContain(`${REPOSITORY_URL}/security/advisories/new`);
  });

  it("lists the page in the sidecar with no actions and marks it current in the navigation", async () => {
    const { view } = await aboutPage();
    const sidecar = view.sidecar();
    expect(sidecar.page).toBe("about");
    expect(sidecar.actions).toEqual([]);
    expect(sidecar.overlays).toEqual([]);
    const link = view.container.querySelector('[data-rex-nav="about"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
    expect(link?.getAttribute("href")).toBe("/about");
    expect(within(view.container).getByRole("heading", { level: 1 }).textContent).toBe("About");
  });
});
