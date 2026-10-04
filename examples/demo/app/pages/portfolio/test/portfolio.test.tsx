import { procedureOf } from "@sidioralabs/rex/client";
import {
  readSidecar,
  renderPage,
  testServer,
  type RexRenderResult,
} from "@sidioralabs/rex/testing";
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { guest, owner } from "../../../../server.ts";
import { loadWallet } from "../../../actions/load-wallet.ts";
import { setupWalletTests, walletApp } from "./wallet.ts";

setupWalletTests();

const stranger = { id: "stranger" };

function holdings(view: RexRenderResult): string[] {
  return [...view.container.querySelectorAll("[data-demo-holding]")].map(
    (element) => element.getAttribute("data-demo-holding") ?? "",
  );
}

function regions(view: RexRenderResult): string[] {
  return [...view.container.querySelectorAll('[data-rex-region^="portfolio/"]')].map(
    (element) => element.getAttribute("data-rex-region") ?? "",
  );
}

function heading(view: RexRenderResult): string {
  return within(view.container).getByRole("heading", { level: 1 }).textContent ?? "";
}

async function loaded(view: RexRenderResult): Promise<void> {
  await waitFor(() =>
    expect(view.container.querySelector("[data-demo-total]")?.textContent).toBe("$76580.0002"),
  );
}

describe("portfolio page", () => {
  it("renders every region with the wallet loaded from the real server", async () => {
    const app = walletApp(owner);
    const view = await renderPage(app, "portfolio");
    expect(view.href).toBe("/");
    expect(heading(view)).toBe("Portfolio");
    await loaded(view);
    expect(regions(view)).toEqual(["portfolio/hero", "portfolio/actions", "portfolio/holdings"]);
    expect(holdings(view)).toEqual(["dust", "eth", "pax"]);
    expect(within(view.container).getByText("4 tokens held")).toBeTruthy();
    const records = await app.ledger.list({ actionId: "load-wallet" });
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.actor === "owner" && record.outcome === "ok")).toBe(
      true,
    );
  });

  it("publishes a sidecar with the page action and overlay in both densities", async () => {
    const app = walletApp(owner);
    const view = await renderPage(app, "portfolio");
    await loaded(view);
    const payload = readSidecar(view.container);
    expect(payload.page).toBe("portfolio");
    expect(payload.state).toBe("ready");
    expect(payload.params).toEqual({});
    expect(payload.outcome).toBeNull();
    expect(
      payload.actions.map((entry) => [entry.id, entry.allowed, entry.reason, entry.effect]),
    ).toEqual([["toggle-hide-dust", true, null, "reversible"]]);
    expect(payload.overlays).toEqual([{ id: "HoldingsFilterSheet", open: false, dismiss: "both" }]);
    const defaultRegions = regions(view);

    const agent = await renderPage(app, "portfolio", { density: "agent" });
    await loaded(agent);
    expect(document.documentElement.getAttribute("data-rex-density")).toBe("agent");
    expect(agent.sidecar().actions.map((entry) => entry.id)).toEqual(["toggle-hide-dust"]);
    expect(regions(agent)).toEqual(defaultRegions);
  });

  it("lists the dust toggle as not allowed for the guest while showing the wallet", async () => {
    const view = await renderPage(walletApp(guest), "portfolio");
    await loaded(view);
    const [entry] = view.sidecar().actions;
    expect(entry?.id).toBe("toggle-hide-dust");
    expect(entry?.allowed).toBe(false);
    expect(entry?.reason).toEqual(expect.any(String));
    const control = view.container.querySelector('[data-rex="portfolio/toggle-hide-dust"]');
    expect(control?.getAttribute("data-rex-allowed")).toBe("false");
    expect((control as HTMLButtonElement | null)?.disabled).toBe(true);
  });

  it("renders the permission-denied state for an actor without viewer.read", async () => {
    const view = await renderPage(walletApp(stranger), "portfolio");
    await waitFor(() => expect(view.sidecar().state).toBe("permission-denied"));
    expect(within(view.container).getByText("You do not have access to portfolio")).toBeTruthy();
    expect(regions(view)).toEqual([]);
  });

  it("navigates to the send page from the quick actions", async () => {
    const view = await renderPage(walletApp(owner), "portfolio");
    await loaded(view);
    const send = within(view.container).getByRole("button", { name: "Send tokens" });
    expect(send.getAttribute("data-rex-nav")).toBe("send");
    await act(async () => {
      fireEvent.click(send);
    });
    await waitFor(() =>
      expect(
        view.container.querySelector('[data-rex-page="send"]:not([data-rex-page-loading])'),
      ).not.toBeNull(),
    );
    expect(view.history.at(-1)).toBe("/send");
    expect(heading(view)).toBe("Send");
  });
});

describe("portfolio server", () => {
  it("serves load-wallet for the actor and records it in the ledger", async () => {
    const server = testServer(walletApp(owner));
    const wallet = loadWallet.output.parse(await procedureOf(server.client, "load-wallet")({}));
    expect(wallet.totalUsd).toBe("76580.0002");
    expect(wallet.account.hideDust).toBe(false);
    expect(wallet.tokens.map((entry) => [entry.id, entry.valueUsd, entry.dust])).toEqual([
      ["dust", "0.0002", true],
      ["eth", "75000", false],
      ["pax", "80", false],
      ["usdc", "1500", false],
    ]);
    const records = await server.ledger.list();
    expect(records.map((record) => [record.actionId, record.outcome, record.actor])).toEqual([
      ["load-wallet", "ok", "owner"],
    ]);
  });

  it("refuses the dust toggle for the guest on the server", async () => {
    const server = testServer(walletApp(guest));
    await expect(procedureOf(server.client, "toggle-hide-dust")({})).rejects.toThrow(/forbidden/);
    const records = await server.ledger.list({ actionId: "toggle-hide-dust" });
    expect(records.map((record) => [record.outcome, record.actor])).toEqual([
      ["FORBIDDEN", "guest"],
    ]);
  });
});
