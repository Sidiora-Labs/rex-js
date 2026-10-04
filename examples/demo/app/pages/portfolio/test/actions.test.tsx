import { DRAFT_QUERY_KEY, OVERLAY_QUERY_KEY } from "@sidioralabs/rex/client";
import { renderRegion, type RexRenderResult } from "@sidioralabs/rex/testing";
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { owner } from "../../../../server.ts";
import { setupWalletTests, walletApp } from "./wallet.ts";

setupWalletTests();

const SHEET = "portfolio/HoldingsFilterSheet";

function trigger(view: RexRenderResult): HTMLElement {
  const found = view.container.querySelector(`[data-rex-overlay-trigger="${SHEET}"]`);
  expect(found).not.toBeNull();
  return found as HTMLElement;
}

function sheet(view: RexRenderResult): HTMLElement | null {
  return view.container.querySelector(`[data-rex-overlay="${SHEET}"]`);
}

function search(view: RexRenderResult): URLSearchParams {
  const last = view.history.at(-1) ?? "";
  return new URLSearchParams(last.includes("?") ? last.slice(last.indexOf("?") + 1) : "");
}

function sheetOpen(view: RexRenderResult): boolean | undefined {
  return view.sidecar().overlays.find((entry) => entry.id === "HoldingsFilterSheet")?.open;
}

async function click(element: Element): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
  });
}

describe("portfolio actions region", () => {
  it("renders the quick actions with no filter applied", async () => {
    const view = await renderRegion(walletApp(owner), "portfolio", "actions");
    const scope = within(view.container);
    expect(scope.getByText("No filter applied")).toBeTruthy();
    expect(scope.getByRole("button", { name: "Send tokens" }).getAttribute("data-rex-nav")).toBe(
      "send",
    );
    expect(trigger(view).getAttribute("aria-expanded")).toBe("false");
    expect(trigger(view).getAttribute("aria-haspopup")).toBe("dialog");
    expect(sheet(view)).toBeNull();
    expect(view.container.querySelector('[data-rex-region="portfolio/holdings"]')).toBeNull();
    expect(sheetOpen(view)).toBe(false);
  });

  it("opens the URL-bound filter sheet, applies a filter and closes", async () => {
    const view = await renderRegion(walletApp(owner), "portfolio", "actions");
    await click(trigger(view));
    await waitFor(() => expect(sheet(view)).not.toBeNull());
    expect(search(view).getAll(OVERLAY_QUERY_KEY)).toEqual(["HoldingsFilterSheet"]);
    expect(trigger(view).getAttribute("aria-expanded")).toBe("true");
    await waitFor(() => expect(sheetOpen(view)).toBe(true));

    const field = within(sheet(view) as HTMLElement).getByLabelText("Symbol or name contains");
    await act(async () => {
      fireEvent.change(field, { target: { value: "eth" } });
    });
    await waitFor(() => expect(within(view.container).getByText('Filtered by "eth"')).toBeTruthy());
    expect(JSON.parse(search(view).get(DRAFT_QUERY_KEY) ?? "null")).toEqual({ query: "eth" });

    await click(within(sheet(view) as HTMLElement).getByRole("button", { name: "Apply filter" }));
    await waitFor(() => expect(sheet(view)).toBeNull());
    expect(search(view).getAll(OVERLAY_QUERY_KEY)).toEqual([]);
    expect(JSON.parse(search(view).get(DRAFT_QUERY_KEY) ?? "null")).toEqual({ query: "eth" });
    expect(within(view.container).getByText('Filtered by "eth"')).toBeTruthy();
    await waitFor(() => expect(sheetOpen(view)).toBe(false));
  });

  it("clears the filter from the sheet", async () => {
    const view = await renderRegion(walletApp(owner), "portfolio", "actions");
    const draft = new URLSearchParams({ [DRAFT_QUERY_KEY]: JSON.stringify({ query: "pax" }) });
    draft.append(OVERLAY_QUERY_KEY, "HoldingsFilterSheet");
    act(() => view.navigate(`/?${draft.toString()}`));
    await waitFor(() => expect(sheet(view)).not.toBeNull());
    expect(within(view.container).getByText('Filtered by "pax"')).toBeTruthy();
    const field = within(sheet(view) as HTMLElement).getByLabelText("Symbol or name contains");
    expect((field as HTMLInputElement).value).toBe("pax");

    await click(within(sheet(view) as HTMLElement).getByRole("button", { name: "Clear filter" }));
    await waitFor(() => expect(within(view.container).getByText("No filter applied")).toBeTruthy());
    expect(search(view).get(DRAFT_QUERY_KEY)).toBeNull();

    const close = view.container.querySelector(`[data-rex-overlay-close="${SHEET}"]`);
    expect(close).not.toBeNull();
    await click(close as Element);
    await waitFor(() => expect(sheet(view)).toBeNull());
  });

  it("navigates to the send page", async () => {
    const view = await renderRegion(walletApp(owner), "portfolio", "actions");
    await click(within(view.container).getByRole("button", { name: "Send tokens" }));
    await waitFor(() => expect(view.history.at(-1)).toBe("/send"));
  });
});
