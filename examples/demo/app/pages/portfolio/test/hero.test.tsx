import { CONFIRM_PROCEDURE, procedureOf } from "@sidioralabs/rex/client";
import { renderRegion, testServer, type RexRenderResult } from "@sidioralabs/rex/testing";
import { act, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { guest, owner } from "../../../../server.ts";
import { setupWalletTests, walletApp } from "./wallet.ts";

setupWalletTests();

function total(view: RexRenderResult): string | null {
  return view.container.querySelector("[data-demo-total]")?.textContent ?? null;
}

describe("portfolio hero region", () => {
  it("renders the balance hero alone on the page runtime", async () => {
    const view = await renderRegion(walletApp(owner), "portfolio", "hero");
    await waitFor(() => expect(total(view)).toBe("$76580.0002"));
    const hero = view.container.querySelector('[data-rex-region="portfolio/hero"]');
    expect(hero).not.toBeNull();
    const scope = within(hero as HTMLElement);
    expect(scope.getByRole("heading", { level: 3 }).textContent).toBe("Main wallet");
    expect(scope.getByText("4 tokens held")).toBeTruthy();
    expect(scope.getByText("0x5a1e000000000000000000000000000000c0ffee")).toBeTruthy();
    expect(view.container.querySelector('[data-rex-region="portfolio/actions"]')).toBeNull();
    expect(view.container.querySelector('[data-rex-region="portfolio/holdings"]')).toBeNull();
    expect(within(view.container).queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("shows the same wallet to the guest", async () => {
    const view = await renderRegion(walletApp(guest), "portfolio", "hero");
    await waitFor(() => expect(total(view)).toBe("$76580.0002"));
    expect(view.sidecar().page).toBe("portfolio");
  });

  it("is not rendered when the actor may not view the page", async () => {
    const view = await renderRegion(walletApp({ id: "stranger" }), "portfolio", "hero");
    await waitFor(() => expect(view.sidecar().state).toBe("permission-denied"));
    expect(view.container.querySelector('[data-rex-region="portfolio/hero"]')).toBeNull();
  });

  it("shows the new total after a transfer through the real server", async () => {
    const app = walletApp(owner);
    const view = await renderRegion(app, "portfolio", "hero");
    await waitFor(() => expect(total(view)).toBe("$76580.0002"));
    const server = testServer(app);
    const input = { amount: "1" };
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
    await waitFor(() => expect(total(view)).toBe("$73580.0002"));
  });
});
