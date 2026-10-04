import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { KeyboardEvent, ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { OverlayDismiss } from "../core/overlay.ts";
import { OverlaySurface } from "./overlay-surface.tsx";
import {
  OVERLAY_DISMISS_LABEL,
  OVERLAY_FORM_ATTRIBUTE,
  type OverlaySurfaceProps,
} from "./overlay.tsx";
import {
  DEFAULT_SHELL_COMPONENTS,
  SHEET_FORM_ATTRIBUTE,
  SHELL_SHEET_FORMS,
  type ShellSheetForm,
} from "./shell/components.ts";

const ADDRESS = "send/TokenSheet";

interface MountOptions {
  readonly dismiss?: OverlayDismiss;
  readonly escape?: boolean;
  readonly closeLabel?: string | null;
  readonly form?: ShellSheetForm;
  readonly children?: ReactNode;
}

function mount(options: MountOptions = {}) {
  let hides = 0;
  const outer: string[] = [];
  const props: OverlaySurfaceProps = {
    address: ADDRESS,
    dismiss: options.dismiss ?? "both",
    title: "Token sheet",
    form: options.form ?? "dialog",
    escape: options.escape ?? true,
    closeLabel: "closeLabel" in options ? (options.closeLabel ?? null) : OVERLAY_DISMISS_LABEL,
    hide: () => {
      hides += 1;
    },
    Sheet: DEFAULT_SHELL_COMPONENTS.Sheet,
    Button: DEFAULT_SHELL_COMPONENTS.Button,
  };
  const result = render(
    <div onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => outer.push(event.key)}>
      <OverlaySurface {...props}>{options.children}</OverlaySurface>
    </div>,
  );
  return {
    ...result,
    hides: () => hides,
    outer,
    dialog: () => screen.getByRole("dialog"),
  };
}

function opener(): HTMLElement {
  const button = render(<button type="button">Open</button>).getByRole("button", { name: "Open" });
  button.focus();
  return button;
}

async function key(target: Element, init: KeyboardEventInit & { key: string }): Promise<boolean> {
  let accepted = true;
  await act(async () => {
    accepted = fireEvent.keyDown(target, init);
  });
  return accepted;
}

afterEach(() => {
  cleanup();
});

describe("OverlaySurface", () => {
  it("renders a modal dialog labelled by the sheet title with its address, dismissal and form", () => {
    for (const form of SHELL_SHEET_FORMS) {
      const { dialog, hides } = mount({ form, children: <p>Pick a token</p> });
      const surface = dialog();
      expect(surface.getAttribute("aria-modal")).toBe("true");
      expect(surface.tabIndex).toBe(-1);
      expect(surface.getAttribute("data-rex-overlay")).toBe(ADDRESS);
      expect(surface.getAttribute("data-rex-overlay-dismiss")).toBe("both");
      expect(surface.getAttribute(OVERLAY_FORM_ATTRIBUTE)).toBe(form);
      const title = within(surface).getByRole("heading", { level: 2 });
      expect(title.textContent).toBe("Token sheet");
      expect(surface.getAttribute("aria-labelledby")).toBe(title.id);
      expect(screen.getByRole("dialog", { name: "Token sheet" })).toBe(surface);
      const sheet = surface.querySelector(`[${SHEET_FORM_ATTRIBUTE}]`) as HTMLElement;
      expect(sheet.getAttribute(SHEET_FORM_ATTRIBUTE)).toBe(form);
      expect(sheet.textContent).toContain("Pick a token");
      expect(sheet.querySelector(".rex-sheet-handle") !== null).toBe(form === "bottom-sheet");
      const close = within(surface).getByRole("button", { name: OVERLAY_DISMISS_LABEL });
      expect(close.getAttribute("data-rex-overlay-close")).toBe(ADDRESS);
      expect(close.getAttribute("type")).toBe("button");
      fireEvent.click(close);
      expect(hides()).toBe(1);
      cleanup();
    }
  });

  it("moves focus to the first focusable item and returns it to the opener on close", () => {
    const trigger = opener();
    expect(document.activeElement).toBe(trigger);
    const { dialog, unmount } = mount({
      children: (
        <label>
          Search tokens
          <input type="text" />
        </label>
      ),
    });
    expect(document.activeElement).toBe(within(dialog()).getByRole("textbox"));
    unmount();
    expect(document.activeElement).toBe(trigger);
  });

  it("focuses the surface itself when nothing inside can take focus and keeps Tab there", async () => {
    const { dialog } = mount({ closeLabel: null, children: <p>Notes are public</p> });
    const surface = dialog();
    expect(within(surface).queryByRole("button")).toBeNull();
    expect(document.activeElement).toBe(surface);
    expect(await key(surface, { key: "Tab" })).toBe(false);
    expect(document.activeElement).toBe(surface);
    expect(await key(surface, { key: "Tab", shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(surface);
  });

  it("wraps Tab and Shift+Tab at the ends of the focusable items", async () => {
    const { dialog } = mount({
      children: (
        <>
          <input type="text" aria-label="Amount" />
          <button type="button">Pick gold</button>
        </>
      ),
    });
    const surface = dialog();
    const amount = within(surface).getByRole("textbox", { name: "Amount" });
    const pick = within(surface).getByRole("button", { name: "Pick gold" });
    const close = within(surface).getByRole("button", { name: OVERLAY_DISMISS_LABEL });
    expect(document.activeElement).toBe(amount);
    close.focus();
    expect(await key(close, { key: "Tab" })).toBe(false);
    expect(document.activeElement).toBe(amount);
    expect(await key(amount, { key: "Tab", shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(close);
    pick.focus();
    expect(await key(pick, { key: "Tab" })).toBe(true);
    expect(document.activeElement).toBe(pick);
    surface.focus();
    expect(await key(surface, { key: "Tab", shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(close);
  });

  it("closes on Escape only when the overlay dismisses on escape and keeps the key inside", async () => {
    const escaping = mount({
      dismiss: "escape",
      closeLabel: null,
      children: <input type="text" />,
    });
    const input = within(escaping.dialog()).getByRole("textbox");
    expect(await key(input, { key: "Escape" })).toBe(false);
    expect(escaping.hides()).toBe(1);
    expect(escaping.outer).toEqual([]);
    expect(await key(input, { key: "Enter" })).toBe(true);
    expect(escaping.outer).toEqual(["Enter"]);
    cleanup();
    const buttonOnly = mount({ dismiss: "button", escape: false, children: <input type="text" /> });
    const field = within(buttonOnly.dialog()).getByRole("textbox");
    expect(await key(field, { key: "Escape" })).toBe(true);
    expect(buttonOnly.hides()).toBe(0);
    expect(buttonOnly.outer).toEqual(["Escape"]);
    fireEvent.click(
      within(buttonOnly.dialog()).getByRole("button", { name: OVERLAY_DISMISS_LABEL }),
    );
    expect(buttonOnly.hides()).toBe(1);
  });
});
