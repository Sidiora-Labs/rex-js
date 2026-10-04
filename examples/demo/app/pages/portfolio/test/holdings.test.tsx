import { DRAFT_QUERY_KEY } from "@sidioralabs/rex/client";
import { renderRegion, type RexRenderResult } from "@sidioralabs/rex/testing";
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { guest, owner } from "../../../../server.ts";
import { mainAccount, setupWalletTests, walletApp } from "./wallet.ts";

setupWalletTests();

function holdings(view: RexRenderResult): string[] {
  return [...view.container.querySelectorAll("[data-demo-holding]")].map(
    (element) => element.getAttribute("data-demo-holding") ?? "",
  );
}

function dust(view: RexRenderResult): string | null {
  return view.container.querySelector("[data-demo-dust]")?.getAttribute("data-demo-dust") ?? null;
}

function draftHref(query: string): string {
  return `/?${new URLSearchParams({ [DRAFT_QUERY_KEY]: JSON.stringify({ query }) }).toString()}`;
}

async function click(element: Element): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
  });
}

describe("portfolio holdings region", () => {
  it("lists every holding in the data table with the dust switch", async () => {
    const view = await renderRegion(walletApp(owner), "portfolio", "holdings");
    await waitFor(() => expect(holdings(view)).toEqual(["dust", "eth", "pax", "usdc"]));
    expect(view.container.querySelector('[data-rex-region="portfolio/hero"]')).toBeNull();
    const scope = within(view.container);
    expect(scope.getByRole("heading", { level: 2 }).textContent).toBe("Holdings");
    expect(scope.getByText("4 tokens")).toBeTruthy();
    expect(scope.getByText("Dust is shown")).toBeTruthy();
    expect(scope.getByRole("table")).toBeTruthy();
    expect(scope.getByLabelText("Search holdings")).toBeTruthy();
    expect(view.container.querySelector("[data-rex-list-more]")).toBeNull();
    const toggle = view.container.querySelector('[data-rex="portfolio/toggle-hide-dust"]');
    expect(toggle?.getAttribute("role")).toBe("switch");
    expect(toggle?.getAttribute("aria-checked")).toBe("false");
  });

  it("hides and shows dust through the real toggle-hide-dust action", async () => {
    const app = walletApp(owner);
    const view = await renderRegion(app, "portfolio", "holdings");
    await waitFor(() => expect(dust(view)).toBe("shown"));
    const toggle = () =>
      view.container.querySelector('[data-rex="portfolio/toggle-hide-dust"]') as Element;
    expect(toggle().getAttribute("data-rex-allowed")).toBe("true");
    expect(toggle().getAttribute("aria-checked")).toBe("false");

    await click(toggle());
    await waitFor(() => expect(dust(view)).toBe("hidden"));
    expect(within(view.container).getByText("Dust is hidden (1 token under $1)")).toBeTruthy();
    expect(holdings(view)).toEqual(["eth", "pax", "usdc"]);
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    expect((await mainAccount())?.hideDust).toBe(true);
    await waitFor(() =>
      expect(view.sidecar().outcome).toMatchObject({ action: "toggle-hide-dust", ok: true }),
    );

    await click(toggle());
    await waitFor(() => expect(dust(view)).toBe("shown"));
    expect(holdings(view)).toEqual(["dust", "eth", "pax", "usdc"]);
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    expect((await mainAccount())?.hideDust).toBe(false);
    const records = await app.ledger.list({ actionId: "toggle-hide-dust" });
    expect(records.map((record) => [record.outcome, record.actor])).toEqual([
      ["ok", "owner"],
      ["ok", "owner"],
    ]);
  });

  it("filters holdings by the route draft", async () => {
    const view = await renderRegion(walletApp(owner), "portfolio", "holdings");
    await waitFor(() => expect(holdings(view)).toHaveLength(4));
    act(() => view.navigate(draftHref("usd"), { replace: true }));
    await waitFor(() => expect(holdings(view)).toEqual(["usdc"]));
    act(() => view.navigate(draftHref("ether"), { replace: true }));
    await waitFor(() => expect(holdings(view)).toEqual(["eth"]));
    act(() => view.navigate(draftHref("zzz"), { replace: true }));
    await waitFor(() => expect(holdings(view)).toEqual([]));
    expect(within(view.container).getByText('No holding matches "zzz"')).toBeTruthy();
  });

  it("disables the dust toggle for the guest", async () => {
    const app = walletApp(guest);
    const view = await renderRegion(app, "portfolio", "holdings");
    await waitFor(() => expect(dust(view)).toBe("shown"));
    const toggle = view.container.querySelector('[data-rex="portfolio/toggle-hide-dust"]');
    expect(toggle?.getAttribute("data-rex-allowed")).toBe("false");
    expect(toggle?.getAttribute("title")).toMatch(/^Not allowed: /);
    expect(toggle?.getAttribute("aria-disabled")).toBe("true");
    expect(toggle?.hasAttribute("data-disabled")).toBe(true);
    expect(await app.ledger.list({ actionId: "toggle-hide-dust" })).toEqual([]);
  });
});
