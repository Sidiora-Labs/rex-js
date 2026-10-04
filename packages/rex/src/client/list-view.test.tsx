import { cleanup, fireEvent, render, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ListView } from "./list-view.tsx";
import { listWindow, type ListWindow } from "./list.tsx";

interface Token {
  readonly id: string;
  readonly symbol: string;
}

const tokens: readonly Token[] = ["eth", "pax", "usdc", "dust", "btc"].map((id) => ({
  id,
  symbol: id.toUpperCase(),
}));

const ADDRESS = "portfolio/tokens";
const NEXT_HREF = "/?page=2&size=2";

interface TokenListViewProps {
  readonly current: ListWindow;
  readonly navigated: string[];
  readonly items?: readonly Token[];
  readonly label?: string | undefined;
  readonly empty?: ReactNode;
}

function TokenListView({
  current,
  navigated,
  items = tokens,
  label,
  empty = <p>Nothing held</p>,
}: TokenListViewProps) {
  return (
    <ListView
      address={ADDRESS}
      window={current}
      items={items}
      itemKey={(token) => token.id}
      label={label}
      empty={empty}
      moreLabel="Load more"
      href={NEXT_HREF}
      navigate={(href) => {
        navigated.push(href);
      }}
    >
      {(token, index) => <span data-token={token.id}>{`${index}:${token.symbol}`}</span>}
    </ListView>
  );
}

function root(): HTMLElement {
  const found = document.querySelector(`[data-rex-list="${ADDRESS}"]`);
  if (!(found instanceof HTMLElement)) throw new Error(`no list ${ADDRESS}`);
  return found;
}

function rows(): HTMLElement[] {
  return [...root().querySelectorAll("li")];
}

function moreLink(): HTMLAnchorElement | null {
  const found = document.querySelector(`[data-rex-list-more="${ADDRESS}"]`);
  return found instanceof HTMLAnchorElement ? found : null;
}

function state(element: HTMLElement): Record<string, string | null> {
  return {
    page: element.getAttribute("data-rex-list-page"),
    size: element.getAttribute("data-rex-list-size"),
    shown: element.getAttribute("data-rex-list-shown"),
    total: element.getAttribute("data-rex-list-total"),
  };
}

afterEach(() => {
  cleanup();
});

describe("ListView", () => {
  it("renders the empty content with the window state and no list", () => {
    render(
      <TokenListView current={listWindow(0, { page: 1, size: 2 })} items={[]} navigated={[]} />,
    );
    const element = root();
    expect(state(element)).toEqual({ page: "1", size: "2", shown: "0", total: "0" });
    expect(element.textContent).toBe("Nothing held");
    expect(element.querySelector("ul")).toBeNull();
    expect(element.querySelector("[role=status]")).toBeNull();
    expect(moreLink()).toBeNull();
  });

  it("renders only the shown rows with the live count and a load-more link", () => {
    const rendered = render(
      <TokenListView current={listWindow(5, { page: 1, size: 2 })} label="Tokens" navigated={[]} />,
    );
    const element = root();
    expect(state(element)).toEqual({ page: "1", size: "2", shown: "2", total: "5" });
    expect(rows().map((row) => row.textContent)).toEqual(["0:ETH", "1:PAX"]);
    expect(rows().every((row) => row.getAttribute("tabindex") === "-1")).toBe(true);
    const list = within(element).getByRole("list", { name: "Tokens" });
    expect(list).toBe(element.querySelector("ul"));
    const status = within(element).getByRole("status");
    expect(status.textContent).toBe("Showing 2 of 5");
    expect(status.getAttribute("aria-live")).toBe("polite");
    const more = moreLink();
    expect(more?.textContent).toBe("Load more");
    expect(more?.getAttribute("href")).toBe(NEXT_HREF);
    expect(element.contains(more)).toBe(true);
    rendered.rerender(
      <TokenListView current={listWindow(5, { page: 1, size: 2 })} navigated={[]} />,
    );
    expect(element.querySelector("ul")?.hasAttribute("aria-label")).toBe(false);
  });

  it("drops the load-more link once the window covers every item", () => {
    render(<TokenListView current={listWindow(5, { page: 3, size: 2 })} navigated={[]} />);
    expect(state(root())).toEqual({ page: "3", size: "2", shown: "5", total: "5" });
    expect(rows().map((row) => row.textContent)).toEqual([
      "0:ETH",
      "1:PAX",
      "2:USDC",
      "3:DUST",
      "4:BTC",
    ]);
    expect(within(root()).getByRole("status").textContent).toBe("Showing 5 of 5");
    expect(moreLink()).toBeNull();
  });

  it("navigates in place on a plain primary click and leaves other clicks to the browser", () => {
    const navigated: string[] = [];
    render(<TokenListView current={listWindow(5, { page: 1, size: 2 })} navigated={navigated} />);
    const link = moreLink();
    if (link === null) throw new Error("no load-more link");
    expect(fireEvent.click(link)).toBe(false);
    expect(navigated).toEqual([NEXT_HREF]);
    for (const init of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ]) {
      expect(fireEvent.click(link, init)).toBe(true);
    }
    expect(navigated).toEqual([NEXT_HREF]);
    const prevent = (event: Event) => {
      event.preventDefault();
    };
    document.addEventListener("click", prevent, { capture: true });
    try {
      expect(fireEvent.click(link)).toBe(false);
    } finally {
      document.removeEventListener("click", prevent, { capture: true });
    }
    expect(navigated).toEqual([NEXT_HREF]);
  });

  it("focuses the first newly shown row after load more and only then", () => {
    const navigated: string[] = [];
    const rendered = render(
      <TokenListView current={listWindow(5, { page: 1, size: 2 })} navigated={navigated} />,
    );
    rendered.rerender(
      <TokenListView current={listWindow(5, { page: 2, size: 2 })} navigated={navigated} />,
    );
    expect(rows()).toHaveLength(4);
    expect(document.activeElement).toBe(document.body);
    const link = moreLink();
    if (link === null) throw new Error("no load-more link");
    fireEvent.click(link);
    expect(navigated).toEqual([NEXT_HREF]);
    expect(document.activeElement).toBe(document.body);
    rendered.rerender(
      <TokenListView current={listWindow(5, { page: 3, size: 2 })} navigated={navigated} />,
    );
    const shown = rows();
    expect(shown).toHaveLength(5);
    expect(document.activeElement).toBe(shown[4]);
    const first = shown[0] as HTMLElement;
    first.focus();
    rendered.rerender(
      <TokenListView current={listWindow(5, { page: 3, size: 2 })} navigated={navigated} />,
    );
    expect(document.activeElement).toBe(first);
  });
});
