import { DRAFT_QUERY_KEY } from "@sidioralabs/rex/client";
import { renderRegion, type RexRenderResult } from "@sidioralabs/rex/testing";
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { guest, owner } from "../../../../server.ts";
import { mainAccount, setupWalletTests, walletApp } from "./wallet.ts";

setupWalletTests();

const TOKEN_SHEET = "send/TokenSelectorSheet";
const CONTACT_SHEET = "send/ContactPickerSheet";

function selected(view: RexRenderResult, kind: "token" | "contact"): string | null {
  const attribute = `data-demo-selected-${kind}`;
  return view.container.querySelector(`[${attribute}]`)?.getAttribute(attribute) ?? null;
}

function sheet(view: RexRenderResult, address: string): HTMLElement | null {
  return view.container.querySelector(`[data-rex-overlay="${address}"]`);
}

function sheetOpen(view: RexRenderResult, id: string): boolean | undefined {
  return view.sidecar().overlays.find((entry) => entry.id === id)?.open;
}

async function click(element: Element): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function openSheet(view: RexRenderResult, address: string): Promise<HTMLElement> {
  const trigger = view.container.querySelector(`[data-rex-overlay-trigger="${address}"]`);
  expect(trigger).not.toBeNull();
  await click(trigger as Element);
  return waitFor(() => {
    const found = sheet(view, address);
    expect(found).not.toBeNull();
    return found as HTMLElement;
  });
}

describe("send form region", () => {
  it("shows the selected token, recipient and amount field alone", async () => {
    const view = await renderRegion(walletApp(owner), "send", "form");
    await waitFor(() => expect(selected(view, "token")).toBe("ETH"));
    expect(selected(view, "contact")).toBe("Alice");
    const scope = within(view.container);
    expect(scope.getByText("ETH (Ether), balance 25")).toBeTruthy();
    expect(scope.getByText("Alice (0xa11ce00000000000000000000000000000000001)")).toBeTruthy();
    expect(scope.getByLabelText("Amount in ETH")).toBeTruthy();
    expect(scope.getByText("Available 25 ETH. Leave empty to send the default 0.001.")).toBeTruthy();
    expect(view.container.querySelector('[data-rex-region="send/confirm"]')).toBeNull();
    expect(view.container.querySelector('[data-rex-region="send/success"]')).toBeNull();
  });

  it("cycles the token and recipient through the real pick actions", async () => {
    const app = walletApp(owner);
    const view = await renderRegion(app, "send", "form");
    await waitFor(() => expect(selected(view, "token")).toBe("ETH"));

    await click(within(view.container).getByRole("button", { name: "Next token" }));
    await waitFor(() => expect(selected(view, "token")).toBe("PAX"));
    expect(within(view.container).getByLabelText("Amount in PAX")).toBeTruthy();
    await click(within(view.container).getByRole("button", { name: "Next recipient" }));
    await waitFor(() => expect(selected(view, "contact")).toBe("Bob"));

    const account = await mainAccount();
    expect([account?.sendToken, account?.sendContact]).toEqual(["pax", "bob"]);
    const records = await app.ledger.list();
    expect(
      records
        .filter((record) => record.actionId !== "load-wallet")
        .map((record) => [record.actionId, record.outcome, record.actor]),
    ).toEqual([
      ["pick-token", "ok", "owner"],
      ["pick-contact", "ok", "owner"],
    ]);
  });

  it("picks a token from the region-bound selector sheet", async () => {
    const view = await renderRegion(walletApp(owner), "send", "form");
    await waitFor(() => expect(selected(view, "token")).toBe("ETH"));
    const dialog = await openSheet(view, TOKEN_SHEET);
    await waitFor(() => expect(sheetOpen(view, "TokenSelectorSheet")).toBe(true));
    expect(dialog.querySelector('[data-rex-choice="eth"]')?.getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(dialog.querySelectorAll("[data-rex-choice]")).toHaveLength(4);

    await click(dialog.querySelector('[data-rex-choice="usdc"]') as Element);
    await waitFor(() => expect(selected(view, "token")).toBe("USDC"));
    await waitFor(() => expect(sheet(view, TOKEN_SHEET)).toBeNull());
    expect(sheetOpen(view, "TokenSelectorSheet")).toBe(false);
    expect((await mainAccount())?.sendToken).toBe("usdc");
  });

  it("picks a recipient by typing in the contact picker and submitting", async () => {
    const view = await renderRegion(walletApp(owner), "send", "form");
    await waitFor(() => expect(selected(view, "contact")).toBe("Alice"));
    const dialog = await openSheet(view, CONTACT_SHEET);
    const query = within(dialog).getByLabelText("Type a name or address, then press Enter");

    await act(async () => {
      fireEvent.change(query, { target: { value: "zzz" } });
    });
    expect(within(dialog).getByText('No contact matches "zzz"')).toBeTruthy();

    await act(async () => {
      fireEvent.change(query, { target: { value: "car" } });
    });
    expect(
      [...dialog.querySelectorAll("[data-rex-choice]")].map((element) =>
        element.getAttribute("data-rex-choice"),
      ),
    ).toEqual(["carol"]);
    await act(async () => {
      fireEvent.submit(query.closest("form") as HTMLFormElement);
    });
    await waitFor(() => expect(selected(view, "contact")).toBe("Carol"));
    await waitFor(() => expect(sheet(view, CONTACT_SHEET)).toBeNull());
    expect((await mainAccount())?.sendContact).toBe("carol");
  });

  it("keeps the typed amount in the route draft and flags an invalid one", async () => {
    const view = await renderRegion(walletApp(owner), "send", "form");
    await waitFor(() => expect(selected(view, "token")).toBe("ETH"));
    const amount = within(view.container).getByLabelText("Amount in ETH");

    await act(async () => {
      fireEvent.change(amount, { target: { value: "abc" } });
    });
    expect(within(view.container).getByRole("alert").textContent).toBe(
      "Enter a decimal amount such as 0.5",
    );
    expect(amount.getAttribute("aria-invalid")).toBe("true");
    const last = view.history.at(-1) ?? "";
    const search = new URLSearchParams(last.slice(last.indexOf("?") + 1));
    expect(JSON.parse(search.get(DRAFT_QUERY_KEY) ?? "null")).toEqual({ amount: "abc" });

    await act(async () => {
      fireEvent.change(amount, { target: { value: "0.5" } });
    });
    expect(within(view.container).queryByRole("alert")).toBeNull();
    expect(amount.getAttribute("aria-invalid")).toBe("false");
  });

  it("disables the pick controls for the guest", async () => {
    const app = walletApp(guest);
    const view = await renderRegion(app, "send", "form");
    await waitFor(() => expect(selected(view, "token")).toBe("ETH"));
    for (const name of ["Next token", "Next recipient"]) {
      const control = within(view.container).getByRole("button", { name });
      expect(control.getAttribute("data-rex-allowed")).toBe("false");
      expect((control as HTMLButtonElement).disabled).toBe(true);
    }
    expect(view.container.querySelector('[data-rex="send/pick-token"]')).not.toBeNull();
    expect(view.container.querySelector('[data-rex="send/pick-contact"]')).not.toBeNull();
  });
});
