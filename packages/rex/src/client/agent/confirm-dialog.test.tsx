import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { action } from "../../core/action.ts";
import { always } from "../../core/policy.ts";
import { money, text } from "../../schema/index.ts";
import { z } from "zod/mini";
import { ConfirmDialog } from "./confirm-dialog.tsx";
import type { ConfirmPending, ConfirmRequest } from "./confirm.tsx";

const send = action("send", {
  input: z.object({ to: text({ min: 1 }), amount: money() }),
  output: z.object({ txId: text() }),
  policy: always(),
  effect: "irreversible",
  label: "Send",
  handler: (input) => ({ txId: `tx-${input.to}-${input.amount}` }),
});

const purge = action("purge", {
  input: z.object({}),
  output: z.object({}),
  policy: always(),
  effect: "irreversible",
  handler: () => ({}),
});

const sendRequest: ConfirmRequest = {
  page: "portfolio",
  action: send,
  input: { to: "carol", amount: "3" },
};

interface Mounted {
  readonly settled: boolean[];
  readonly resolved: boolean[];
  readonly dialog: HTMLElement;
  rerender(request: ConfirmRequest): void;
}

function pendingFor(request: ConfirmRequest, resolved: boolean[]): ConfirmPending {
  return { request, resolve: (accepted) => resolved.push(accepted), opener: null };
}

function mount(request: ConfirmRequest, address = "portfolio/send"): Mounted {
  const settled: boolean[] = [];
  const resolved: boolean[] = [];
  const settle = (accepted: boolean) => settled.push(accepted);
  const view = render(
    <ConfirmDialog pending={pendingFor(request, resolved)} address={address} settle={settle} />,
  );
  return {
    settled,
    resolved,
    dialog: screen.getByRole("alertdialog"),
    rerender: (next) =>
      view.rerender(
        <ConfirmDialog pending={pendingFor(next, resolved)} address={address} settle={settle} />,
      ),
  };
}

function accept(dialog: HTMLElement): HTMLElement {
  return within(dialog).getByRole("button", { name: /^Confirm / });
}

function cancel(dialog: HTMLElement): HTMLElement {
  return within(dialog).getByRole("button", { name: "Cancel" });
}

afterEach(() => {
  cleanup();
});

describe("ConfirmDialog", () => {
  it("describes the action, its input and its address, and focuses the accept control", () => {
    const { dialog } = mount(sendRequest);
    expect(screen.getByRole("alertdialog", { name: "Confirm Send" })).toBe(dialog);
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("data-rex-confirm")).toBe("portfolio/send");
    const body = document.getElementById(dialog.getAttribute("aria-describedby") ?? "");
    expect(body?.textContent).toBe('Send cannot be undone. Input: {"to":"carol","amount":"3"}');
    expect(accept(dialog).getAttribute("data-rex-confirm-accept")).toBe("portfolio/send");
    expect(cancel(dialog).getAttribute("data-rex-confirm-cancel")).toBe("portfolio/send");
    expect(document.activeElement).toBe(accept(dialog));
  });

  it("names an unlabelled action by its id and describes input that is not JSON", () => {
    const { dialog } = mount({ page: null, action: purge, input: 10n }, "purge");
    expect(screen.getByRole("alertdialog", { name: "Confirm purge" })).toBe(dialog);
    expect(dialog.textContent).toContain("purge cannot be undone. Input: 10");
    expect(accept(dialog).textContent).toBe("Confirm purge");
    cleanup();
    const next = mount({ page: null, action: purge, input: undefined }, "purge");
    expect(next.dialog.querySelector("code")?.textContent).toBe("");
  });

  it("settles true from the accept control and false from cancel without resolving itself", () => {
    const { dialog, settled, resolved } = mount(sendRequest);
    fireEvent.click(accept(dialog));
    fireEvent.click(cancel(dialog));
    expect(settled).toEqual([true, false]);
    expect(resolved).toEqual([]);
  });

  it("settles false on Escape and keeps that key from window listeners", () => {
    const { dialog, settled } = mount(sendRequest);
    const seen: string[] = [];
    const onKeyDown = (event: KeyboardEvent) => {
      seen.push(event.key);
    };
    window.addEventListener("keydown", onKeyDown);
    try {
      expect(fireEvent.keyDown(accept(dialog), { key: "Escape" })).toBe(false);
      expect(settled).toEqual([false]);
      expect(fireEvent.keyDown(accept(dialog), { key: "Enter" })).toBe(true);
      expect(seen).toEqual(["Enter"]);
    } finally {
      window.removeEventListener("keydown", onKeyDown);
    }
  });

  it("traps Tab between the accept and cancel controls", () => {
    const { dialog } = mount(sendRequest);
    const first = accept(dialog);
    const last = cancel(dialog);
    expect(fireEvent.keyDown(first, { key: "Tab" })).toBe(true);
    expect(document.activeElement).toBe(first);
    last.focus();
    expect(fireEvent.keyDown(last, { key: "Tab" })).toBe(false);
    expect(document.activeElement).toBe(first);
    expect(fireEvent.keyDown(first, { key: "Tab", shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(last);
    expect(fireEvent.keyDown(last, { key: "Tab", shiftKey: true })).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it("moves focus back to the accept control for every new request", () => {
    const { dialog, rerender } = mount(sendRequest);
    cancel(dialog).focus();
    expect(document.activeElement).toBe(cancel(dialog));
    rerender({ ...sendRequest, input: { to: "dave", amount: "4" } });
    expect(document.activeElement).toBe(accept(dialog));
    expect(dialog.textContent).toContain('{"to":"dave","amount":"4"}');
  });
});
