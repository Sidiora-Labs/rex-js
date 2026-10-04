import { renderRegion } from "@sidioralabs/rex/testing";
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { owner } from "../../../../server.ts";
import { setupWalletTests, walletApp } from "./wallet.ts";

setupWalletTests();

async function click(element: Element): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
  });
}

describe("portfolio holdings column menu", () => {
  it(
    "opens the View menu with its label grouped and one checkbox per hideable column",
    { timeout: 20_000 },
    async () => {
      const view = await renderRegion(walletApp(owner), "portfolio", "holdings");
      await waitFor(() =>
        expect(view.container.querySelectorAll("[data-demo-holding]").length).toBeGreaterThan(0),
      );
      const trigger = within(view.container).getByRole("button", { name: "View" });
      await click(trigger);

      const menu = await within(document.body).findByRole("menu");
      const label = within(menu).getByText("Toggle columns");
      expect(label.closest('[role="group"]')).not.toBeNull();
      expect(
        within(menu)
          .getAllByRole("menuitemcheckbox")
          .map((item) => item.textContent?.trim()),
      ).toEqual(["name", "balance", "value", "change"]);
      expect(view.container.textContent).not.toContain("REX330");
      expect(within(view.container).getByText("Name")).toBeTruthy();

      await click(within(menu).getByRole("menuitemcheckbox", { name: "name" }));
      await waitFor(() => expect(within(view.container).queryByText("Name")).toBeNull());
      expect(view.container.textContent).not.toContain("REX330");
    },
  );
});
