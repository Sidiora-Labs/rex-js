import { CONFIRM_PROCEDURE, procedureOf } from "@sidioralabs/rex/client";
import { readSidecar, renderPage, testServer, type RexRenderResult } from "@sidioralabs/rex/testing";
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { guest, owner } from "../../../../server.ts";
import { send } from "../../../actions/send.ts";
import { mainAccount, setupWalletTests, tokenBalance, walletApp } from "./wallet.ts";

setupWalletTests();

function regions(view: RexRenderResult): string[] {
  return [...view.container.querySelectorAll('[data-rex-region^="send/"]')].map(
    (element) => element.getAttribute("data-rex-region") ?? "",
  );
}

function selectedToken(view: RexRenderResult): string | null {
  return (
    view.container
      .querySelector("[data-demo-selected-token]")
      ?.getAttribute("data-demo-selected-token") ?? null
  );
}

function sendButton(view: RexRenderResult): HTMLButtonElement {
  const found = view.container.querySelector('main [data-rex="send/send"]');
  expect(found).not.toBeNull();
  return found as HTMLButtonElement;
}

function transfer(view: RexRenderResult): Element | null {
  return view.container.querySelector("[data-demo-transfer]");
}

async function click(element: Element): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
  });
}

describe("send page", () => {
  it("renders the form, confirm and success regions with the wallet", async () => {
    const view = await renderPage(walletApp(owner), "send");
    expect(view.href).toBe("/send");
    expect(within(view.container).getByRole("heading", { level: 1 }).textContent).toBe("Send");
    await waitFor(() => expect(selectedToken(view)).toBe("ETH"));
    expect(regions(view)).toEqual(["send/form", "send/confirm", "send/success"]);
    expect(view.container.querySelector("[data-demo-summary]")?.textContent).toBe(
      "Send 0.001 (default) ETH to Alice",
    );
    expect(transfer(view)?.getAttribute("data-demo-transfer")).toBe("none");
  });

  it("publishes every send action and both region-bound sheets in the sidecar", async () => {
    const view = await renderPage(walletApp(owner), "send");
    await waitFor(() => expect(selectedToken(view)).toBe("ETH"));
    const payload = readSidecar(view.container);
    expect(payload.page).toBe("send");
    expect(payload.state).toBe("ready");
    expect(
      payload.actions
        .map((entry) => [entry.id, entry.allowed, entry.reason, entry.effect])
        .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
    ).toEqual([
      ["pick-contact", true, null, "reversible"],
      ["pick-token", true, null, "reversible"],
      ["send", true, null, "irreversible"],
    ]);
    expect(
      [...payload.overlays].sort((left, right) => left.id.localeCompare(right.id)),
    ).toEqual([
      { id: "ContactPickerSheet", open: false, dismiss: "both" },
      { id: "TokenSelectorSheet", open: false, dismiss: "both" },
    ]);
  });

  it("lists every send action as not allowed for the guest", async () => {
    const view = await renderPage(walletApp(guest), "send");
    await waitFor(() => expect(selectedToken(view)).toBe("ETH"));
    const actions = view.sidecar().actions;
    expect(actions.map((entry) => entry.id).sort()).toEqual(["pick-contact", "pick-token", "send"]);
    for (const entry of actions) {
      expect(entry.allowed).toBe(false);
      expect(entry.reason).toEqual(expect.any(String));
    }
    expect(sendButton(view).getAttribute("data-rex-allowed")).toBe("false");
    expect(sendButton(view).disabled).toBe(true);
  });

  it("sends a typed amount after the irreversible confirmation", async () => {
    const app = walletApp(owner);
    const view = await renderPage(app, "send");
    await waitFor(() => expect(selectedToken(view)).toBe("ETH"));
    await act(async () => {
      fireEvent.change(within(view.container).getByLabelText("Amount in ETH"), {
        target: { value: "2" },
      });
    });
    await waitFor(() =>
      expect(view.container.querySelector("[data-demo-summary]")?.textContent).toBe(
        "Send 2 ETH to Alice",
      ),
    );

    await click(sendButton(view));
    const dialog = await waitFor(() => {
      const found = view.container.querySelector('[data-rex-confirm="send/send"]');
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    expect(dialog.getAttribute("role")).toBe("alertdialog");
    expect(dialog.textContent).toContain('{"amount":"2"}');
    expect(await app.ledger.list({ actionId: "send" })).toEqual([]);

    await click(dialog.querySelector('[data-rex-confirm-accept="send/send"]') as Element);
    await waitFor(() => expect(transfer(view)?.textContent).toBe("Sent 2 ETH to Alice"));
    expect(transfer(view)?.getAttribute("data-demo-transfer")).toBe("sent");
    expect(view.container.querySelector('[data-rex-confirm="send/send"]')).toBeNull();
    expect(await tokenBalance("eth")).toBe("23");
    const records = await app.ledger.list({ actionId: "send" });
    expect(records.map((record) => [record.outcome, record.actor, record.effect])).toEqual([
      ["ok", "owner", "irreversible"],
    ]);
    await waitFor(() =>
      expect(view.sidecar().outcome).toMatchObject({ action: "send", ok: true }),
    );
  });

  it("keeps the balance when the confirmation is cancelled", async () => {
    const app = walletApp(owner);
    const view = await renderPage(app, "send");
    await waitFor(() => expect(selectedToken(view)).toBe("ETH"));
    await click(sendButton(view));
    const cancel = await waitFor(() => {
      const found = view.container.querySelector('[data-rex-confirm-cancel="send/send"]');
      expect(found).not.toBeNull();
      return found as Element;
    });
    await click(cancel);
    await waitFor(() =>
      expect(view.sidecar().outcome).toMatchObject({
        action: "send",
        ok: false,
        message: "Send cancelled",
      }),
    );
    expect(await app.ledger.list({ actionId: "send" })).toEqual([]);
    expect(await tokenBalance("eth")).toBe("25");
    expect((await mainAccount())?.lastTransfer).toBeNull();
    expect(transfer(view)?.getAttribute("data-demo-transfer")).toBe("none");
  });
});

describe("send server", () => {
  it("requires a confirmation token for the irreversible send", async () => {
    const server = testServer(walletApp(owner));
    const call = procedureOf(server.client, "send");
    await expect(call({ amount: "1" })).rejects.toThrow(/irreversible/);
    expect(await tokenBalance("eth")).toBe("25");

    const grant = (await procedureOf(server.client, CONFIRM_PROCEDURE)({
      action: "send",
      input: { amount: "1" },
    })) as { readonly token: string };
    const output = send.output.parse(
      await call({ amount: "1" }, { context: { confirmToken: grant.token } }),
    );
    expect(output).toEqual({ transfer: "Sent 1 ETH to Alice", balance: "24" });
    expect(await tokenBalance("eth")).toBe("24");
  });

  it("refuses the guest before any confirmation is granted", async () => {
    const server = testServer(walletApp(guest));
    await expect(
      procedureOf(server.client, CONFIRM_PROCEDURE)({ action: "send", input: {} }),
    ).rejects.toThrow(/forbidden/);
    expect(await tokenBalance("eth")).toBe("25");
  });
});
