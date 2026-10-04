import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  REX_ERROR_CATALOG,
  RexError,
  anonymousActor,
  errorDocs,
  type RexErrorCode,
} from "@sidioralabs/rex";
import { createTestApp, renderPage, setupRexTesting } from "@sidioralabs/rex/testing";
import { waitFor, within } from "@testing-library/react";
import app from "rex:app";
import { afterEach, describe, expect, it } from "vitest";
import { REX_ERROR_DOCS } from "../../../../../packages/rex/src/core/errors.docs.ts";

setupRexTesting({ afterEach });

const CODES = (Object.keys(REX_ERROR_CATALOG) as RexErrorCode[]).sort();
const SITE_HOST = readFileSync(resolve(process.cwd(), "public", "CNAME"), "utf8").trim();

function siteApp() {
  return createTestApp(app, { actor: anonymousActor });
}

async function renderError(code: RexErrorCode) {
  const view = await renderPage(siteApp(), "error", { params: { code } });
  await waitFor(() => expect(view.sidecar().state).toBe("ready"));
  await waitFor(() =>
    expect(view.container.querySelector(`[data-site-error="${code}"]`)).not.toBeNull(),
  );
  return view;
}

describe("error page", () => {
  it("declares a static page per code with its loader", () => {
    const error = siteApp().page("error");
    expect(error.route).toBe("/errors/:code");
    expect(error.routeParams).toEqual(["code"]);
    expect(error.render).toBe("static");
    expect(error.chrome.title).toBe("Error code");
    expect(error.chrome.back).toBe("errors");
    expect(error.regions).toEqual(["detail"]);
    expect(error.loaders.map((loader) => [loader.name, loader.action.id])).toEqual([
      ["detail", "errors-detail"],
    ]);
  });

  it("prerenders one path for every code in the catalog", async () => {
    const error = siteApp().page("error");
    expect(error.paths).not.toBeNull();
    const paths = await error.paths?.();
    expect(paths).toEqual(CODES.map((code) => ({ code })));
  });

  it("renders a known code with its area, message, hint, docs URL and area doc", async () => {
    const view = await renderError("REX330");
    const region = view.container.querySelector('[data-rex-region="error/detail"]') as HTMLElement;
    expect(within(region).getByRole("heading", { level: 1, name: "REX330" })).toBeTruthy();
    expect(region.querySelector("[data-site-error-area]")?.textContent).toBe("REX3xx Runtime");
    expect(region.querySelector("[data-site-error-message]")?.textContent).toBe(
      REX_ERROR_CATALOG.REX330,
    );
    expect(region.querySelector("[data-site-error-hint]")?.textContent).toBe(
      REX_ERROR_DOCS.REX330.hint,
    );
    expect(region.querySelector("[data-site-error-docs]")?.textContent).toBe(errorDocs("REX330"));
    const doc = region.querySelector("[data-site-error-doc]");
    expect(doc?.getAttribute("href")).toBe("/docs/architecture");
    expect(doc?.textContent).toBe("Architecture");
    expect(within(region).getByRole("link", { name: "All error codes" }).getAttribute("href")).toBe(
      "/errors",
    );
  });

  it("links the previous and next codes of the catalog", async () => {
    const view = await renderError("REX330");
    const previous = view.container.querySelector("[data-site-error-previous]");
    const next = view.container.querySelector("[data-site-error-next]");
    expect(previous?.getAttribute("data-site-error-previous")).toBe("REX329");
    expect(previous?.getAttribute("href")).toBe("/errors/REX329");
    expect(next?.getAttribute("data-site-error-next")).toBe("REX331");
    expect(next?.getAttribute("href")).toBe("/errors/REX331");
  });

  it("has no previous code on the first entry and no next code on the last", async () => {
    const first = await renderError(CODES[0] as RexErrorCode);
    expect(first.container.querySelector("[data-site-error-previous]")).toBeNull();
    expect(first.container.querySelector("[data-site-error-next]")?.getAttribute("href")).toBe(
      `/errors/${CODES[1]}`,
    );
    first.unmount();
    const last = await renderError(CODES.at(-1) as RexErrorCode);
    expect(last.container.querySelector("[data-site-error-next]")).toBeNull();
    expect(last.container.querySelector("[data-site-error-previous]")?.getAttribute("href")).toBe(
      `/errors/${CODES.at(-2)}`,
    );
  });

  it("serves the docs URL a RexError carries at this page's route", async () => {
    const thrown = new RexError("REX330", "region hero failed to render");
    const docs = new URL(thrown.docs);
    expect(docs.protocol).toBe("https:");
    expect(docs.host).toBe(SITE_HOST);
    const view = await renderPage(siteApp(), "errors");
    await waitFor(() => expect(view.sidecar().page).toBe("errors"));
    view.navigate(docs.pathname);
    await waitFor(() => expect(view.sidecar().page).toBe("error"));
    await waitFor(() => expect(view.sidecar().state).toBe("ready"));
    expect(view.sidecar().params).toEqual({ code: "REX330" });
    await waitFor(() =>
      expect(view.container.querySelector('[data-site-error="REX330"]')).not.toBeNull(),
    );
    expect(view.history.at(-1)).toBe(docs.pathname);
  });

  it("publishes its sidecar with the code param and no actions", async () => {
    const view = await renderError("REX330");
    const sidecar = view.sidecar();
    expect(sidecar.page).toBe("error");
    expect(sidecar.params).toEqual({ code: "REX330" });
    expect(sidecar.state).toBe("ready");
    expect(sidecar.actions).toEqual([]);
    expect(sidecar.overlays).toEqual([]);
    expect(view.container.querySelector('main[data-rex-page="error"]')).not.toBeNull();
    expect(view.href).toBe("/errors/REX330");
  });
});
