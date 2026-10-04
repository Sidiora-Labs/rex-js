import { anonymousActor } from "@sidioralabs/rex";
import { createTestApp, renderPage, renderRegion, setupRexTesting } from "@sidioralabs/rex/testing";
import { waitFor, within } from "@testing-library/react";
import app from "rex:app";
import { afterEach, describe, expect, it } from "vitest";
import { readStandards } from "../../../server/content/standards.ts";

setupRexTesting({ afterEach });

function siteApp() {
  return createTestApp(app, { actor: anonymousActor });
}

function rowIds(container: ParentNode, selector: string, attribute: string): string[] {
  return [...container.querySelectorAll(selector)].map(
    (element) => element.getAttribute(attribute) ?? "",
  );
}

describe("standards page", () => {
  it("declares a static page at /standards that loads the standards table", () => {
    const standards = siteApp().page("standards");
    expect(standards.route).toBe("/standards");
    expect(standards.render).toBe("static");
    expect(standards.chrome.title).toBe("Standards");
    expect(standards.chrome.back).toBe("home");
    expect(standards.regions).toEqual(["table"]);
    expect(standards.loaders.map((loader) => [loader.name, loader.action.id])).toEqual([
      ["standards", "read-standards"],
    ]);
    const entry = app.manifest.pages.find((candidate) => candidate.id === "standards");
    expect(entry?.loaders).toEqual([
      { name: "standards", action: "read-standards", input: "params", invalidatedBy: [] },
    ]);
  });

  it("renders one table row and one card per [standard.*] item with its status", async () => {
    const expected = readStandards();
    const view = await renderPage(siteApp(), "standards");
    await waitFor(() => expect(view.sidecar().state).toBe("ready"));
    const region = await waitFor(() => {
      const found = view.container.querySelector('[data-rex-region="standards/table"]');
      expect(found).not.toBeNull();
      return found;
    });
    const scope = region as HTMLElement;
    await waitFor(() =>
      expect(scope.querySelectorAll("tr[data-site-standard]")).toHaveLength(expected.total),
    );
    expect(rowIds(scope, "tr[data-site-standard]", "data-site-standard")).toEqual(
      expected.items.map((item) => item.id),
    );
    expect(rowIds(scope, "li[data-site-standard-card]", "data-site-standard-card")).toEqual(
      expected.items.map((item) => item.id),
    );
    for (const item of expected.items) {
      const row = scope.querySelector(`tr[data-site-standard="${item.id}"]`) as HTMLElement;
      expect(row.textContent).toContain(item.requirement);
      expect(
        row.querySelector("[data-site-standard-status]")?.getAttribute("data-site-standard-status"),
        item.id,
      ).toBe(item.status);
      expect(rowIds(row, "[data-site-task]", "data-site-task")).toEqual(
        item.tasks.map((task) => task.id),
      );
      if (item.tasks.length === 0) {
        expect(row.querySelector("[data-site-task-none]")?.textContent).toBe(
          `No owning task, recorded as ${item.recorded}`,
        );
      }
      for (const task of item.tasks) {
        expect(row.querySelector(`[data-site-task="${task.id}"]`)?.textContent).toBe(
          `${task.id} ${task.status}`,
        );
      }
      const card = scope.querySelector(`li[data-site-standard-card="${item.id}"]`) as HTMLElement;
      expect(
        card
          .querySelector("[data-site-standard-status]")
          ?.getAttribute("data-site-standard-status"),
      ).toBe(item.status);
    }
  });

  it("states how many standards are met and links the spec it reads", async () => {
    const expected = readStandards();
    const view = await renderRegion(siteApp(), "standards", "table");
    await waitFor(() => expect(view.sidecar().state).toBe("ready"));
    const region = await waitFor(() => {
      const found = view.container.querySelector('[data-rex-region="standards/table"]');
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    await waitFor(() =>
      expect(
        within(region).getByText(`${expected.met} of ${expected.total} standards met`),
      ).toBeTruthy(),
    );
    expect(within(region).getByRole("heading", { level: 2 }).textContent).toBe(
      "The framework standards Rex 0.2 is held to",
    );
    const source = within(region).getByRole("link", { name: "spec/rex-v02/spec.kvx" });
    expect(source.getAttribute("href")).toBe(
      "https://github.com/Sidiora-Labs/rex-js/blob/main/spec/rex-v02/spec.kvx",
    );
  });

  it("lists the page in the sidecar with no actions and marks it current in the navigation", async () => {
    const view = await renderPage(siteApp(), "standards");
    await waitFor(() => expect(view.sidecar().state).toBe("ready"));
    const sidecar = view.sidecar();
    expect(sidecar.page).toBe("standards");
    expect(sidecar.actions).toEqual([]);
    expect(sidecar.overlays).toEqual([]);
    expect(view.container.querySelector('main[data-rex-page="standards"]')).not.toBeNull();
    const link = view.container.querySelector('[data-rex-nav="standards"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
    expect(link?.getAttribute("href")).toBe("/standards");
    expect(within(view.container).getByRole("heading", { level: 1 }).textContent).toBe("Standards");
  });
});
