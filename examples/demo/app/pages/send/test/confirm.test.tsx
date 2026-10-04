import { DRAFT_QUERY_KEY } from "@sidioralabs/rex/client";
import { renderRegion, type RexRenderResult } from "@sidioralabs/rex/testing";
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { guest, owner } from "../../../../server.ts";
import { mainAccount, setupWalletTests, tokenBalance, walletApp } from "./wallet.ts";

setupWalletTests();

function summary(view: RexRenderResult): string | null {
  return view.container.querySelector("[data-demo-summary]")?.textContent ?? null;
}

async function sendButton(view: RexRenderResult): Promise<HTMLButtonElement> {
  return waitFor(() => {
    const found = view.container.querySelector(
      '[data-rex-region="send/confirm"] [data-rex="send/send"]',
    );
    expect(found).not.toBeNull();
    return found as HTMLButtonElement;
  });
}

function draftHref(amount: string): string {
  return `/send?${new URLSearchParams({ [DRAFT_QUERY_KEY]: JSON.stringify({ amount }) }).toString()}`;
}

async function click(element: Element): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function confirmDialog(view: RexRenderResult): Promise<HTMLElement> {
  return waitFor(() => {
    const found = view.container.querySelector('[data-rex-confirm="send/send"]');
    expect(found).not.toBeNull();
    return found as HTMLElement;
  });
}

describe("send confirm region", () => {
  it("summarises the default transfer alone", async () => {
    const view = await renderRegion(walletApp(owner), "send", "confirm");
    await waitFor(() => expect(summary(view)).toBe("Send 0.001 (default) ETH to Alice"));
    expect((await sendButton(view)).getAttribute("data-rex-allowed")).toBe("true");
    expect((await sendButton(view)).disabled).toBe(false);
    expect(view.container.querySelector('[data-rex-region="send/form"]')).toBeNull();
    expect(within(view.container).queryByRole("alert")).toBeNull();
  });

  it("reads the amount from the route draft and blocks an invalid one", async () => {
    const view = await renderRegion(walletApp(owner), "send", "confirm");
    await waitFor(() => expect(summary(view)).not.toBeNull());
    act(() => view.navigate(draftHref("5"), { replace: true }));
    await waitFor(() => expect(summary(view)).toBe("Send 5 ETH to Alice"));
    expect((await sendButton(view)).disabled).toBe(false);

    act(() => view.navigate(draftHref("five"), { replace: true }));
    await waitFor(() => expect(summary(view)).toBe("Send five ETH to Alice"));
    expect(within(view.container).getByRole("alert").textContent).toBe(
      "Fix the amount before sending.",
    );
    expect((await sendButton(view)).disabled).toBe(true);
  });

  it("sends the default amount once the confirmation is accepted", async () => {
    const app = walletApp(owner);
    const view = await renderRegion(app, "send", "confirm");
    await waitFor(() => expect(summary(view)).not.toBeNull());
    await click(await sendButton(view));
    const dialog = await confirmDialog(view);
    expect(within(dialog).getByRole("heading", { level: 2 }).textContent).toBe("Confirm Send");
    expect(dialog.textContent).toContain("Send cannot be undone. Input: {}");

    await click(dialog.querySelector('[data-rex-confirm-accept="send/send"]') as Element);
    await waitFor(() =>
      expect(view.sidecar().outcome).toMatchObject({
        action: "send",
        ok: true,
        message: "Send succeeded",
      }),
    );
    expect(await tokenBalance("eth")).toBe("24.999");
    expect((await mainAccount())?.lastTransfer).toBe("Sent 0.001 ETH to Alice");
    const records = await app.ledger.list({ actionId: "send" });
    expect(records.map((record) => [record.outcome, record.actor])).toEqual([["ok", "owner"]]);
  });

  it("records a cancelled send without running it", async () => {
    const app = walletApp(owner);
    const view = await renderRegion(app, "send", "confirm");
    await waitFor(() => expect(summary(view)).not.toBeNull());
    await click(await sendButton(view));
    const dialog = await confirmDialog(view);
    await click(dialog.querySelector('[data-rex-confirm-cancel="send/send"]') as Element);
    await waitFor(() =>
      expect(view.sidecar().outcome).toMatchObject({
        action: "send",
        ok: false,
        message: "Send cancelled",
      }),
    );
    expect(view.container.querySelector('[data-rex-confirm="send/send"]')).toBeNull();
    expect(await app.ledger.list({ actionId: "send" })).toEqual([]);
    expect(await tokenBalance("eth")).toBe("25");
  });

  it("disables sending for the guest with the policy reason", async () => {
    const view = await renderRegion(walletApp(guest), "send", "confirm");
    await waitFor(() => expect(summary(view)).not.toBeNull());
    const button = await sendButton(view);
    expect(button.getAttribute("data-rex-allowed")).toBe("false");
    expect(button.getAttribute("title")).toMatch(/^Not allowed: /);
    expect(button.disabled).toBe(true);
    const entry = view.sidecar().actions.find((item) => item.id === "send");
    expect(entry?.allowed).toBe(false);
    expect(entry?.reason).toEqual(expect.any(String));
  });
});
