import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { discoverApp, runRules } from "../check/engine.ts";
import { namingRule } from "../check/rules/naming.ts";
import { trapsRule } from "../check/rules/traps.ts";
import { actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { createRegistry } from "../core/registry.ts";
import * as client from "./index.ts";
import { Page } from "./layout.tsx";
import {
  DEFAULT_LIST_SIZE,
  LIST_EMPTY_TEXT,
  LIST_MORE_LABEL,
  MAX_LIST_SIZE,
  List,
  listParamNames,
  listSearch,
  listWindow,
  readListParams,
} from "./list.tsx";
import { ActiveRouteContext, resolvePage } from "./router.tsx";
import { standardJsonSchema } from "../manifest/json-schema.ts";

interface Token {
  readonly id: string;
  readonly symbol: string;
}

const tokens: readonly Token[] = ["eth", "pax", "usdc", "dust", "btc"].map((id) => ({
  id,
  symbol: id.toUpperCase(),
}));

const portfolio = page("portfolio", { route: "/", states: ["ready"] });
const registry = createRegistry().register(portfolio).freeze();
const viewer = actor({ id: "viewer" });

function mount(location: string, children: ReactNode) {
  const memory = memoryLocation({ path: location, record: true });
  const view = render(<Router hook={memory.hook}>{children}</Router>);
  return { memory, view };
}

async function mounted(location: string, children: ReactNode) {
  const result = mount(location, children);
  await waitFor(() => expect(document.querySelector("[data-rex-list]")).not.toBeNull());
  return result;
}

interface TokenListProps {
  readonly size?: number;
  readonly params?: { readonly page?: string; readonly size?: string };
}

function TokenList({ size, params }: TokenListProps) {
  return (
    <Page.List
      name="tokens"
      label="Tokens"
      items={tokens}
      itemKey={(token) => token.id}
      {...(size === undefined ? {} : { size })}
      {...(params === undefined ? {} : { params })}
    >
      {(token) => <span data-token={token.id}>{token.symbol}</span>}
    </Page.List>
  );
}

function listRoot(address: string): HTMLElement {
  const found = document.querySelector(`[data-rex-list="${address}"]`);
  if (!(found instanceof HTMLElement)) throw new Error(`no list ${address}`);
  return found;
}

function shownSymbols(address: string): string[] {
  return [...listRoot(address).querySelectorAll("li")].map((item) => item.textContent ?? "");
}

function moreLink(address: string): HTMLAnchorElement | null {
  const found = document.querySelector(`[data-rex-list-more="${address}"]`);
  return found instanceof HTMLAnchorElement ? found : null;
}

function silenced(run: () => void) {
  const original = console.error;
  console.error = () => {};
  try {
    run();
  } finally {
    console.error = original;
  }
}

afterEach(() => {
  cleanup();
});

describe("Page.List", () => {
  it("is part of Page and its helpers are exported from the client entry", () => {
    expect(Page.List).toBe(List);
    expect(client.Page.List).toBe(List);
    expect(client.readListParams).toBe(readListParams);
    expect(client.listWindow).toBe(listWindow);
    expect(client.LIST_MORE_LABEL).toBe("Load more");
    expect("List" in client).toBe(false);
  });

  it("renders the first page with its state, count and a load-more link", async () => {
    await mounted("/", <TokenList size={2} />);
    const root = listRoot("tokens");
    expect(shownSymbols("tokens")).toEqual(["ETH", "PAX"]);
    expect(root.getAttribute("data-rex-list-page")).toBe("1");
    expect(root.getAttribute("data-rex-list-size")).toBe("2");
    expect(root.getAttribute("data-rex-list-shown")).toBe("2");
    expect(root.getAttribute("data-rex-list-total")).toBe("5");
    expect(screen.getByRole("list", { name: "Tokens" })).toBe(root.querySelector("ul"));
    expect(within(root).getByRole("status").textContent).toBe("Showing 2 of 5");
    const more = moreLink("tokens");
    expect(more?.textContent).toBe(LIST_MORE_LABEL);
    expect(more?.getAttribute("href")).toBe("/?page=2&size=2");
  });

  it("reads page and size from the URL and keeps unrelated query keys", async () => {
    await mounted("/?tab=all&page=2&size=2", <TokenList size={3} />);
    expect(shownSymbols("tokens")).toEqual(["ETH", "PAX", "USDC", "DUST"]);
    expect(moreLink("tokens")?.getAttribute("href")).toBe("/?tab=all&page=3&size=2");
  });

  it("appends the next page on load more and focuses the first new row", async () => {
    const { memory } = await mounted("/", <TokenList size={2} />);
    const first = listRoot("tokens").querySelector("li");
    const link = moreLink("tokens");
    if (link === null) throw new Error("no load-more link");
    await act(async () => {
      fireEvent.click(link);
    });
    expect(memory.history).toEqual(["/", "/?page=2&size=2"]);
    expect(shownSymbols("tokens")).toEqual(["ETH", "PAX", "USDC", "DUST"]);
    const rows = listRoot("tokens").querySelectorAll("li");
    expect(rows[0]).toBe(first);
    expect(document.activeElement).toBe(rows[2]);
    expect(within(listRoot("tokens")).getByRole("status").textContent).toBe("Showing 4 of 5");

    const next = moreLink("tokens");
    if (next === null) throw new Error("no second load-more link");
    expect(next.getAttribute("href")).toBe("/?page=3&size=2");
    await act(async () => {
      fireEvent.click(next);
    });
    expect(shownSymbols("tokens")).toEqual(["ETH", "PAX", "USDC", "DUST", "BTC"]);
    expect(document.activeElement).toBe(listRoot("tokens").querySelectorAll("li")[4]);
    expect(moreLink("tokens")).toBeNull();
    expect(listRoot("tokens").getAttribute("data-rex-list-page")).toBe("3");
  });

  it("falls back to the declared size and the first page on malformed params and caps size", async () => {
    await mounted("/?page=0&size=abc", <TokenList size={2} />);
    expect(shownSymbols("tokens")).toEqual(["ETH", "PAX"]);
    cleanup();
    await mounted("/?page=9&size=2", <TokenList />);
    expect(shownSymbols("tokens")).toHaveLength(5);
    expect(listRoot("tokens").getAttribute("data-rex-list-page")).toBe("3");
    expect(moreLink("tokens")).toBeNull();
    expect(readListParams("size=5000", 10)).toEqual({ page: 1, size: MAX_LIST_SIZE });
    expect(readListParams("page=-1&size=1.5")).toEqual({ page: 1, size: DEFAULT_LIST_SIZE });
  });

  it("renders the empty content when there are no items", async () => {
    await mounted(
      "/",
      <Page.List name="tokens" items={[] as readonly Token[]} itemKey={(token) => token.id}>
        {(token) => token.symbol}
      </Page.List>,
    );
    expect(listRoot("tokens").textContent).toBe(LIST_EMPTY_TEXT);
    expect(listRoot("tokens").getAttribute("data-rex-list-total")).toBe("0");
    expect(moreLink("tokens")).toBeNull();
    cleanup();
    await mounted(
      "/",
      <Page.List
        name="tokens"
        items={[] as readonly Token[]}
        itemKey={(token) => token.id}
        empty={<p>No tokens held</p>}
      >
        {(token) => token.symbol}
      </Page.List>,
    );
    expect(screen.getByText("No tokens held")).toBeTruthy();
  });

  it("addresses the list under the active page", async () => {
    const resolution = resolvePage(
      portfolio,
      {},
      "",
      viewer,
      registry,
      standardJsonSchema(portfolio.params, "input"),
    );
    const { memory } = await mounted(
      "/",
      <ActiveRouteContext.Provider value={resolution}>
        <TokenList size={4} />
      </ActiveRouteContext.Provider>,
    );
    const link = moreLink("portfolio/tokens");
    expect(listRoot("portfolio/tokens").contains(link)).toBe(true);
    await act(async () => {
      fireEvent.click(link as HTMLAnchorElement);
    });
    expect(memory.history?.at(-1)).toBe("/?page=2&size=4");
    expect(shownSymbols("portfolio/tokens")).toHaveLength(5);
  });

  it("keeps two lists on one page apart through their param names", async () => {
    await mounted(
      "/",
      <>
        <TokenList size={1} />
        <Page.List
          name="contacts"
          items={["alice", "bob", "carol"]}
          itemKey={(entry) => entry}
          size={1}
          params={{ page: "contactsPage", size: "contactsSize" }}
        >
          {(entry) => entry}
        </Page.List>
      </>,
    );
    await act(async () => {
      fireEvent.click(moreLink("contacts") as HTMLAnchorElement);
    });
    expect(shownSymbols("contacts")).toEqual(["alice", "bob"]);
    expect(shownSymbols("tokens")).toEqual(["ETH"]);
    expect(moreLink("tokens")?.getAttribute("href")).toBe(
      "/?contactsPage=2&contactsSize=1&page=2&size=1",
    );
  });

  it("rejects invalid declarations", () => {
    silenced(() => {
      expect(() => mount("/", <TokenList size={0} />)).toThrow(
        "Page.List: size must be an integer 1..100, received 0",
      );
      cleanup();
      expect(() => mount("/", <TokenList size={MAX_LIST_SIZE + 1} />)).toThrow(
        expect.objectContaining({ name: "RexError", code: "REX314" }),
      );
      cleanup();
      expect(() => mount("/", <TokenList params={{ page: "draft" }} />)).toThrow(
        'Page.List: the page param "draft" is reserved by Rex',
      );
      cleanup();
      expect(() => mount("/", <TokenList params={{ size: "page" }} />)).toThrow(
        'the page and size params must differ, both are "page"',
      );
      cleanup();
      expect(() =>
        mount(
          "/",
          <Page.List name="Tokens" items={tokens} itemKey={(token) => token.id}>
            {(token) => token.symbol}
          </Page.List>,
        ),
      ).toThrow('invalid list name "Tokens"');
    });
  });

  it("computes windows and search strings as pure functions", () => {
    const names = listParamNames();
    expect(names).toEqual({ page: "page", size: "size" });
    expect(listWindow(5, { page: 2, size: 2 })).toEqual({
      page: 2,
      size: 2,
      shown: 4,
      total: 5,
      hasMore: true,
    });
    expect(listWindow(4, { page: 7, size: 2 })).toEqual({
      page: 2,
      size: 2,
      shown: 4,
      total: 4,
      hasMore: false,
    });
    expect(listWindow(0, { page: 1, size: 20 })).toEqual({
      page: 1,
      size: 20,
      shown: 0,
      total: 0,
      hasMore: false,
    });
    expect(listSearch("overlay=Sheet&page=1", names, { page: 2, size: 20 })).toBe(
      "overlay=Sheet&page=2&size=20",
    );
  });
});

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../check/fixtures/lists");

describe("traps/infinite-list", () => {
  it("accepts Page.List with scroll loading, and scroll or lists alone", async () => {
    const app = discoverApp(path.join(fixtures, "pass"));
    const result = await runRules(app, [namingRule, trapsRule]);
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("reports scroll-loading lists that do not use Page.List", async () => {
    const result = await runRules(discoverApp(path.join(fixtures, "fail")), [trapsRule]);
    expect(
      result.findings.map((entry) => [
        entry.file,
        entry.line,
        entry.column,
        entry.rule,
        entry.message,
      ]),
    ).toEqual([
      [
        "app/pages/feed/regions/items/parts/Activity.tsx",
        10,
        5,
        "traps/infinite-list",
        "a scroll listener loads list items on scroll without Page.List",
      ],
      [
        "app/pages/feed/regions/items/parts/Feed.tsx",
        8,
        5,
        "traps/infinite-list",
        "<ul> onScroll loads list items on scroll without Page.List",
      ],
      [
        "app/pages/feed/regions/items/parts/Timeline.tsx",
        10,
        22,
        "traps/infinite-list",
        "an IntersectionObserver loads list items on scroll without Page.List",
      ],
    ]);
    for (const entry of result.findings) {
      expect(entry.severity).toBe("error");
      expect(entry.hint).toContain("Page.List");
      expect(entry.hint).toContain("Load more");
    }
    expect(result.exitCode).toBe(1);
  });
});
