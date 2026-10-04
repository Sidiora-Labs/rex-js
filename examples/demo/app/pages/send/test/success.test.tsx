import { CONFIRM_PROCEDURE, procedureOf } from "@sidioralabs/rex/client";
import { renderRegion, testServer, type RexRenderResult } from "@sidioralabs/rex/testing";
import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { guest, owner } from "../../../../server.ts";
import { setupWalletTests, walletApp } from "./wallet.ts";

setupWalletTests();

function receipt(view: RexRenderResult): Element | null {
  return view.container.querySelector("[data-demo-transfer]");
}

describe("send success region", () => {
  it("states that no transfer has been sent yet", async () => {
    const view = await renderRegion(walletApp(owner), "send", "success");
    await waitFor(() => expect(receipt(view)).not.toBeNull());
    expect(receipt(view)?.getAttribute("data-demo-transfer")).toBe("none");
    expect(receipt(view)?.textContent).toBe("No transfer has been sent from this wallet yet.");
    expect(view.container.querySelector('[data-rex-region="send/success"]')).not.toBeNull();
    expect(view.container.querySelector('[data-rex-region="send/confirm"]')).toBeNull();
  });

  it("shows the last transfer sent through the real server", async () => {
    const app = walletApp(owner);
    const view = await renderRegion(app, "send", "success");
    await waitFor(() => expect(receipt(view)?.getAttribute("data-demo-transfer")).toBe("none"));
    const server = testServer(app);
    const input = { amount: "1.5" };
    const grant = (await procedureOf(
      server.client,
      CONFIRM_PROCEDURE,
    )({
      action: "send",
      input,
    })) as { readonly token: string };
    await procedureOf(server.client, "send")(input, { context: { confirmToken: grant.token } });
    await act(async () => {
      await view.queryClient.invalidateQueries();
    });
    await waitFor(() => expect(receipt(view)?.textContent).toBe("Sent 1.5 ETH to Alice"));
    expect(receipt(view)?.getAttribute("data-demo-transfer")).toBe("sent");
    const records = await app.ledger.list({ actionId: "send" });
    expect(records.map((record) => [record.outcome, record.actor])).toEqual([["ok", "owner"]]);
  });

  it("keeps the receipt empty when the guest is refused", async () => {
    const app = walletApp(guest);
    const view = await renderRegion(app, "send", "success");
    await waitFor(() => expect(receipt(view)?.getAttribute("data-demo-transfer")).toBe("none"));
    const server = testServer(app);
    await expect(
      procedureOf(server.client, CONFIRM_PROCEDURE)({ action: "send", input: {} }),
    ).rejects.toThrow(/forbidden/);
    await act(async () => {
      await view.queryClient.invalidateQueries();
    });
    expect(receipt(view)?.getAttribute("data-demo-transfer")).toBe("none");
  });
});
