import { readFileSync } from "node:fs";
import path from "node:path";
import { anonymousActor } from "@sidioralabs/rex";
import { createTestApp, renderPage, renderRegion, setupRexTesting } from "@sidioralabs/rex/testing";
import { waitFor, within } from "@testing-library/react";
import app from "rex:app";
import { afterEach, describe, expect, it } from "vitest";

setupRexTesting({ afterEach });

const ROOT = path.resolve(process.cwd(), "..");
const LINES = readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8").split("\n");

function headings(level: number): string[] {
  const marker = `${"#".repeat(level)} `;
  return LINES.filter((line) => line.startsWith(marker)).map((line) =>
    line.slice(marker.length).trim(),
  );
}

function siteApp() {
  return createTestApp(app, { actor: anonymousActor });
}

async function releasesRegion(): Promise<HTMLElement> {
  const view = await renderRegion(siteApp(), "changelog", "releases");
  await waitFor(() => expect(view.sidecar().state).toBe("ready"));
  const region = view.container.querySelector('[data-rex-region="changelog/releases"]');
  expect(region).not.toBeNull();
  await waitFor(() =>
    expect((region as HTMLElement).querySelectorAll("[data-site-release]").length).toBeGreaterThan(
      0,
    ),
  );
  return region as HTMLElement;
}

describe("changelog page", () => {
  it("declares a static page at /changelog that loads CHANGELOG.md", () => {
    const changelog = siteApp().page("changelog");
    expect(changelog.route).toBe("/changelog");
    expect(changelog.render).toBe("static");
    expect(changelog.chrome.title).toBe("Changelog");
    expect(changelog.chrome.back).toBe("home");
    expect(changelog.regions).toEqual(["releases"]);
    const entry = app.manifest.pages.find((candidate) => candidate.id === "changelog");
    expect(entry?.loaders).toEqual([
      { name: "changelog", action: "read-changelog", input: "params", invalidatedBy: [] },
    ]);
  });

  it("renders every release heading of CHANGELOG.md as a level 2 heading", async () => {
    const region = await releasesRegion();
    const releases = headings(2);
    expect(releases.length).toBeGreaterThan(0);
    expect(
      within(region)
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(releases);
    expect(
      [...region.querySelectorAll("[data-site-release]")].map((release) =>
        release.getAttribute("data-site-release"),
      ),
    ).toEqual(releases);
  });

  it("renders every group of every release as a level 3 heading", async () => {
    const region = await releasesRegion();
    expect(
      within(region)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(headings(3));
  });

  it("renders the commit log as a disclosure that works without JavaScript", async () => {
    const region = await releasesRegion();
    const summaries = LINES.flatMap((line) => {
      const match = /^<summary>(.*)<\/summary>$/.exec(line.trim());
      return match === null ? [] : [match[1] as string];
    });
    const details = [...region.querySelectorAll("details")];
    expect(details.map((element) => element.querySelector("summary")?.textContent)).toEqual(
      summaries,
    );
    const items = LINES.filter((line) => line.startsWith("- ")).length;
    expect(region.querySelectorAll("li").length).toBe(items);
    const commit = LINES.find((line) =>
      line.includes("](https://github.com/Sidiora-Labs/rex-js/commit/"),
    );
    if (commit !== undefined) {
      const href = /\]\((https:\/\/[^)\s]+)\)/.exec(commit)?.[1] as string;
      expect(region.querySelector(`a[href="${href}"]`)).not.toBeNull();
    }
  });

  it("lists the page in the sidecar with no actions and marks it current in the navigation", async () => {
    const view = await renderPage(siteApp(), "changelog");
    await waitFor(() => expect(view.sidecar().state).toBe("ready"));
    const sidecar = view.sidecar();
    expect(sidecar.page).toBe("changelog");
    expect(sidecar.actions).toEqual([]);
    expect(sidecar.overlays).toEqual([]);
    expect(view.container.querySelector('main[data-rex-page="changelog"]')).not.toBeNull();
    const link = view.container.querySelector('[data-rex-nav="changelog"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
    expect(link?.getAttribute("href")).toBe("/changelog");
    expect(within(view.container).getByRole("heading", { level: 1 }).textContent).toBe("Changelog");
  });
});
