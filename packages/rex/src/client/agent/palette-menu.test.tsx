import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { action } from "../../core/action.ts";
import { page } from "../../core/page.ts";
import { always, never } from "../../core/policy.ts";
import { boolean } from "../../schema/index.ts";
import { z } from "zod/mini";
import { TokenPaletteItem } from "../shell/components.ts";
import { PaletteMenu } from "./palette-menu.tsx";
import {
  PALETTE_LABEL,
  paletteValue,
  type PaletteActionEntry,
  type PaletteMenuProps,
  type PalettePageEntry,
} from "./palette.tsx";

const hideDust = action("hide-dust", {
  input: z.object({ hide: boolean().default(true) }),
  output: z.object({ hide: boolean() }),
  policy: always(),
  effect: "reversible",
  label: "Hide dust",
  shortcut: "alt+h",
  handler: (input) => ({ hide: input.hide }),
});

const purge = action("purge", {
  input: z.object({}),
  output: z.object({}),
  policy: never(),
  effect: "reversible",
  label: "Purge",
  handler: () => ({}),
});

const portfolio = page("portfolio", {
  route: "/",
  actions: [hideDust, purge],
  chrome: { title: "Portfolio" },
  states: ["ready"],
});
const about = page("about", { route: "/about", chrome: { title: "About" }, states: ["ready"] });

const actions: readonly PaletteActionEntry[] = [
  {
    kind: "action",
    id: "hide-dust",
    label: "Hide dust",
    allowed: true,
    reason: null,
    shortcut: "alt+h",
    action: hideDust,
    affordance: null,
  },
  {
    kind: "action",
    id: "purge",
    label: "Purge",
    allowed: false,
    reason: "never",
    shortcut: null,
    action: purge,
    affordance: null,
  },
];

const pages: readonly PalettePageEntry[] = [
  { kind: "page", id: "about", title: "About", route: "/about", page: about },
  { kind: "page", id: "portfolio", title: "Portfolio", route: "/", page: portfolio },
];

interface Mounted {
  readonly dialog: HTMLElement;
  readonly chosen: PaletteActionEntry[];
  readonly visited: PalettePageEntry[];
  readonly closed: string[];
}

function mount(
  overrides: Partial<Pick<PaletteMenuProps, "page" | "actions" | "pages">> = {},
): Mounted {
  const chosen: PaletteActionEntry[] = [];
  const visited: PalettePageEntry[] = [];
  const closed: string[] = [];
  render(
    <PaletteMenu
      label={PALETTE_LABEL}
      page="portfolio"
      actions={actions}
      pages={pages}
      Item={TokenPaletteItem}
      valueOf={paletteValue}
      onAction={(entry) => chosen.push(entry)}
      onPage={(entry) => visited.push(entry)}
      onClose={() => closed.push("close")}
      {...overrides}
    />,
  );
  return { dialog: screen.getByRole("dialog", { name: PALETTE_LABEL }), chosen, visited, closed };
}

function options(dialog: HTMLElement): string[] {
  return within(dialog)
    .queryAllByRole("option")
    .map((option) => option.getAttribute("data-value") ?? "");
}

async function search(dialog: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.change(within(dialog).getByRole("combobox"), { target: { value } });
  });
}

async function enter(dialog: HTMLElement) {
  await act(async () => {
    fireEvent.keyDown(within(dialog).getByRole("combobox"), { key: "Enter" });
  });
}

afterEach(() => {
  cleanup();
});

describe("PaletteMenu", () => {
  it("renders a modal dialog with addressed, grouped options and focuses the search", () => {
    const { dialog } = mount();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("data-rex-palette")).toBe("");
    expect(document.activeElement).toBe(within(dialog).getByRole("combobox"));
    expect(options(dialog)).toEqual([
      "action:hide-dust",
      "action:purge",
      "page:about",
      "page:portfolio",
    ]);
    expect(within(dialog).getByText("Actions")).toBeTruthy();
    expect(within(dialog).getByText("Pages")).toBeTruthy();
    const [hide, purgeOption, aboutOption] = within(dialog).getAllByRole("option");
    expect(hide?.getAttribute("data-rex-palette-item")).toBe("portfolio/hide-dust");
    expect(hide?.getAttribute("data-rex-allowed")).toBe("true");
    expect(hide?.getAttribute("aria-disabled")).not.toBe("true");
    expect(hide?.textContent).toContain("Hide dust");
    expect(hide?.textContent).toContain("alt+h");
    expect(purgeOption?.getAttribute("data-rex-palette-item")).toBe("portfolio/purge");
    expect(purgeOption?.getAttribute("aria-disabled")).toBe("true");
    expect(purgeOption?.getAttribute("data-rex-allowed")).toBe("false");
    expect(purgeOption?.textContent).toContain("Not allowed: never");
    expect(aboutOption?.getAttribute("data-rex-palette-page")).toBe("about");
    expect(aboutOption?.textContent).toContain("Go to About");
    expect(aboutOption?.textContent).toContain("/about");
  });

  it("addresses items by id alone without a page and omits the Actions group when empty", () => {
    const { dialog } = mount({ page: null });
    const [hide] = within(dialog).getAllByRole("option");
    expect(hide?.getAttribute("data-rex-palette-item")).toBe("hide-dust");
    cleanup();
    const empty = mount({ actions: [] });
    expect(within(empty.dialog).queryByText("Actions")).toBeNull();
    expect(within(empty.dialog).getByText("Pages")).toBeTruthy();
    expect(options(empty.dialog)).toEqual(["page:about", "page:portfolio"]);
  });

  it("filters by label, id and route and says when nothing matches", async () => {
    const { dialog } = mount();
    await search(dialog, "Hide");
    expect(options(dialog)).toEqual(["action:hide-dust"]);
    await search(dialog, "purge");
    expect(options(dialog)).toEqual(["action:purge"]);
    await search(dialog, "/about");
    expect(options(dialog)).toEqual(["page:about"]);
    await search(dialog, "zzz");
    expect(options(dialog)).toEqual([]);
    expect(within(dialog).getByText("No matching action or page.")).toBeTruthy();
  });

  it("selects actions and pages with Enter or click and never selects a disabled action", async () => {
    const { dialog, chosen, visited } = mount();
    await search(dialog, "Hide");
    await enter(dialog);
    expect(chosen).toHaveLength(1);
    expect(chosen[0]).toBe(actions[0]);
    await search(dialog, "about");
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("option"));
    });
    expect(visited).toHaveLength(1);
    expect(visited[0]).toBe(pages[0]);
    await search(dialog, "purge");
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("option"));
    });
    await enter(dialog);
    expect(chosen).toHaveLength(1);
    expect(visited).toHaveLength(1);
  });

  it("closes on Escape and stops that key before window listeners", () => {
    const { dialog, closed } = mount();
    const seen: string[] = [];
    const onKeyDown = (event: KeyboardEvent) => {
      seen.push(event.key);
    };
    window.addEventListener("keydown", onKeyDown);
    try {
      fireEvent.keyDown(within(dialog).getByRole("combobox"), { key: "Escape" });
      expect(closed).toEqual(["close"]);
      fireEvent.keyDown(within(dialog).getByRole("combobox"), { key: "a" });
      expect(seen).toEqual(["a"]);
    } finally {
      window.removeEventListener("keydown", onKeyDown);
    }
  });
});
