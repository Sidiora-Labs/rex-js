import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { createElement, createRef, useCallback, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { action } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { always } from "../../core/policy.ts";
import { createRegistry } from "../../core/registry.ts";
import { boolean, text } from "../../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest } from "../../manifest/build.ts";
import { memoryLedger, type Ledger } from "../../server/audit.ts";
import { createRexServer } from "../../server/index.ts";
import { useInvoke } from "../agent/confirm.tsx";
import { readSidecar } from "../agent/sidecar.tsx";
import type { RexFetch } from "../app.tsx";
import type { RexEntryBundle } from "../entry.tsx";
import { definePageModules, view, type PageModuleSet } from "../page.tsx";
import { attributeName, coerceAttribute, defineElement } from "./define-element.tsx";
import { mountRexPage, type UnmountRexPage } from "./mount.tsx";
import { Native } from "./native.tsx";

interface HoldingChipProps {
  readonly symbol?: string;
  readonly amount?: number;
  readonly muted?: boolean;
  readonly tags?: readonly string[];
}

function HoldingChip({ symbol = "?", amount = 0, muted = false, tags = [] }: HoldingChipProps) {
  return (
    <span data-chip={symbol}>
      {`${symbol} ${amount.toFixed(2)} ${muted ? "muted" : "live"}${tags.length > 0 ? ` ${tags.join(",")}` : ""}`}
    </span>
  );
}

const HoldingChipElement = defineElement("rex-holding-chip", HoldingChip, {
  props: { symbol: "string", amount: "number", muted: "boolean", tags: "json" },
});

const hideDust = action("hide-dust", {
  input: z.object({ hide: boolean().default(true) }),
  output: z.object({ hide: boolean() }),
  policy: always(),
  effect: "reversible",
  label: "Hide dust",
  handler: (input) => ({ hide: input.hide }),
});

const portfolio = page("portfolio", { route: "/", actions: [hideDust], states: ["ready"] });
const holding = page("holding", {
  route: "/holdings/:symbol",
  params: z.object({ symbol: text({ min: 1 }) }),
  states: ["ready"],
  chrome: { nav: false },
});

function Controls() {
  const hide = useInvoke(hideDust);
  return (
    <div>
      <button type="button" {...hide.controlProps} onClick={() => void hide.invoke({ hide: true })}>
        Hide dust
      </button>
      {createElement("rex-holding-chip", { symbol: "ETH", amount: "2", tabIndex: 0 })}
    </div>
  );
}

const pages: readonly PageModuleSet[] = [
  definePageModules({ page: portfolio, view: view(() => <Controls />), states: {} }),
  definePageModules({
    page: holding,
    view: view<{ symbol: string }>(({ params }) => <h2>Holding {params.symbol}</h2>),
    states: {},
  }),
];

const registry = createRegistry().register(hideDust, portfolio, holding).freeze();
const bundle: RexEntryBundle = { registry, manifest: buildManifest(registry), pages };
const owner = actor({ id: "owner", permissions: [] });

interface Host {
  readonly slot: HTMLElement;
  readonly header: HTMLElement;
  readonly footer: HTMLElement;
}

function plainDocument(): Host {
  document.body.innerHTML =
    '<header id="legacy-header"><h1>Legacy wallet</h1></header>' +
    '<div id="rex-slot"></div>' +
    '<footer id="legacy-footer"><a href="/help">Help</a></footer>';
  return {
    slot: document.getElementById("rex-slot") as HTMLElement,
    header: document.getElementById("legacy-header") as HTMLElement,
    footer: document.getElementById("legacy-footer") as HTMLElement,
  };
}

function serverFetch(ledger: Ledger): RexFetch {
  const server = createRexServer({ registry, ledger, actor: () => owner });
  return async (input, init) =>
    server.fetch(input instanceof Request ? input : new Request(input, init));
}

const mounted: UnmountRexPage[] = [];

async function mountPage(
  slot: HTMLElement,
  pageId: string,
  ledger: Ledger,
  params?: Readonly<Record<string, unknown>>,
): Promise<UnmountRexPage> {
  let unmount: UnmountRexPage = () => {};
  await act(async () => {
    unmount = mountRexPage(slot, bundle, pageId, {
      actor: owner,
      fetch: serverFetch(ledger),
      baseUrl: "http://rex.test",
      ...(params === undefined ? {} : { params }),
    });
  });
  mounted.push(unmount);
  return unmount;
}

async function audited(ledger: Ledger): Promise<string[]> {
  return (await ledger.list()).map((record) => `${record.actionId}:${record.outcome}`);
}

afterEach(async () => {
  await act(async () => {
    for (const unmount of mounted.splice(0)) unmount();
  });
  cleanup();
  document.body.innerHTML = "";
});

describe("defineElement", () => {
  it("renders a part as a custom element with attributes mapped to typed props", async () => {
    expect(customElements.get("rex-holding-chip")).toBe(HoldingChipElement);
    expect(HoldingChipElement.observedAttributes).toEqual(["symbol", "amount", "muted", "tags"]);
    const element = document.createElement("rex-holding-chip");
    element.setAttribute("symbol", "PAX");
    element.setAttribute("amount", "12.5");
    element.setAttribute("muted", "");
    element.setAttribute("tags", '["stable","core"]');
    await act(async () => {
      document.body.append(element);
    });
    expect(element.querySelector("[data-chip]")?.textContent).toBe("PAX 12.50 muted stable,core");

    await act(async () => {
      element.setAttribute("amount", "3");
      element.removeAttribute("muted");
      element.removeAttribute("tags");
    });
    expect(element.textContent).toBe("PAX 3.00 live");

    await act(async () => {
      element.remove();
    });
    expect(element.innerHTML).toBe("");
  });

  it("keeps the rendered part when the element moves within the document", async () => {
    const first = document.createElement("section");
    const second = document.createElement("section");
    document.body.append(first, second);
    const element = document.createElement("rex-holding-chip");
    element.setAttribute("symbol", "ETH");
    await act(async () => {
      first.append(element);
    });
    await act(async () => {
      second.append(element);
    });
    expect(second.querySelector("[data-chip]")?.textContent).toBe("ETH 0.00 live");
    await act(async () => {
      element.setAttribute("amount", "1");
    });
    expect(element.textContent).toBe("ETH 1.00 live");
  });

  it("maps camelCase props to dashed attributes and coerces each kind", () => {
    expect(attributeName("maxItems")).toBe("max-items");
    expect(attributeName("symbol")).toBe("symbol");
    expect(coerceAttribute("rex-x", "on", "boolean", null)).toBe(false);
    expect(coerceAttribute("rex-x", "on", "boolean", "false")).toBe(false);
    expect(coerceAttribute("rex-x", "on", "boolean", "on")).toBe(true);
    expect(coerceAttribute("rex-x", "label", "string", null)).toBeUndefined();
    expect(coerceAttribute("rex-x", "count", "number", "4")).toBe(4);
    expect(() => coerceAttribute("rex-x", "count", "number", "four")).toThrow(
      'rex: <rex-x> attribute "count" is not a number: four',
    );
    expect(coerceAttribute("rex-x", "data", "json", '{"a":1}')).toEqual({ a: 1 });
    expect(() => coerceAttribute("rex-x", "data", "json", "{")).toThrow(
      'rex: <rex-x> attribute "data" is not JSON: {',
    );
  });

  it("rejects invalid and duplicate tag names", () => {
    expect(() => defineElement("chip", HoldingChip, { props: {} })).toThrow(
      'defineElement: "chip" is not a custom element name',
    );
    expect(() => defineElement("Rex-Chip", HoldingChip, { props: {} })).toThrow(
      "is not a custom element name",
    );
    expect(() => defineElement("rex-holding-chip", HoldingChip, { props: {} })).toThrow(
      "defineElement: <rex-holding-chip> is already defined",
    );
  });
});

describe("mountRexPage", () => {
  it("mounts a page with its providers inside a plain document, invokes an action through its sidecar address and unmounts cleanly", async () => {
    const { slot, header, footer } = plainDocument();
    const before = { header: header.outerHTML, footer: footer.outerHTML };
    const ledger = memoryLedger();
    const unmount = await mountPage(slot, "portfolio", ledger);

    await waitFor(() => expect(slot.querySelector('[data-rex-page="portfolio"]')).not.toBeNull());
    expect(slot.querySelector('[data-rex-page="portfolio"] [data-chip="ETH"]')?.textContent).toBe(
      "ETH 2.00 live",
    );
    expect(header.outerHTML).toBe(before.header);
    expect(footer.outerHTML).toBe(before.footer);
    expect(document.body.firstElementChild).toBe(header);
    expect(document.body.lastElementChild).toBe(footer);

    const sidecar = readSidecar(slot) as {
      page: string;
      actions: { id: string; allowed: boolean }[];
    };
    expect(sidecar.page).toBe("portfolio");
    const entry = sidecar.actions.find((item) => item.id === "hide-dust");
    expect(entry?.allowed).toBe(true);
    const address = `${sidecar.page}/${entry?.id}`;
    const control = slot.querySelector<HTMLElement>(`[data-rex="${address}"]`);
    expect(control).not.toBeNull();
    await act(async () => {
      fireEvent.click(control as HTMLElement);
    });
    await waitFor(async () => expect(await audited(ledger)).toEqual(["hide-dust:ok"]));
    await waitFor(() =>
      expect(
        slot.querySelector('[data-rex-outcome="hide-dust"][data-rex-outcome-ok="true"]'),
      ).not.toBeNull(),
    );

    const chip = slot.querySelector("rex-holding-chip") as HTMLElement;
    await act(async () => {
      unmount();
    });
    expect(slot.childNodes.length).toBe(0);
    expect(chip.isConnected).toBe(false);
    expect(chip.innerHTML).toBe("");
    expect(document.querySelector("[data-rex-page]")).toBeNull();
    expect(document.querySelector("[data-rex-sidecar]")).toBeNull();
    expect(window.__rex).toBeUndefined();
    expect(header.outerHTML).toBe(before.header);
    expect(footer.outerHTML).toBe(before.footer);
    expect(document.body.children).toHaveLength(3);
    await act(async () => {
      unmount();
    });
    expect(slot.childNodes.length).toBe(0);
  });

  it("mounts the requested page with its params", async () => {
    const { slot } = plainDocument();
    await mountPage(slot, "holding", memoryLedger(), { symbol: "PAX" });
    await waitFor(() =>
      expect(slot.querySelector('[data-rex-page="holding"] h2')?.textContent).toBe("Holding PAX"),
    );
    expect((readSidecar(slot) as { params: unknown }).params).toEqual({ symbol: "PAX" });
  });

  it("refuses unknown pages, invalid params and non-elements", () => {
    const { slot } = plainDocument();
    expect(() => mountRexPage(slot, bundle, "missing")).toThrow(
      'mountRexPage: page "missing" is not registered in this app',
    );
    expect(() => mountRexPage(slot, bundle, "holding", { params: { symbol: "" } })).toThrow(
      'mountRexPage: invalid params for page "holding"',
    );
    expect(() => mountRexPage(null as unknown as Element, bundle, "portfolio")).toThrow(
      "mountRexPage: element must be a DOM element",
    );
    expect(slot.childNodes.length).toBe(0);
  });
});

describe("Native", () => {
  it("exposes its DOM node by ref and hands it to plain JS with cleanup on unmount", async () => {
    const ref = createRef<HTMLElement>();
    const log: string[] = [];
    function Chart() {
      const [label, setLabel] = useState("Price chart");
      const mount = useCallback((node: HTMLElement) => {
        const bar = document.createElement("div");
        bar.className = "bar";
        bar.textContent = "drawn by plain JS";
        node.append(bar);
        log.push(`mount ${node.tagName.toLowerCase()}`);
        return () => {
          bar.remove();
          log.push("cleanup");
        };
      }, []);
      return (
        <>
          <Native ref={ref} as="figure" aria-label={label} mount={mount} />
          <button type="button" onClick={() => setLabel("Volume chart")}>
            Relabel
          </button>
        </>
      );
    }
    const rendered = render(<Chart />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current?.tagName).toBe("FIGURE");
    expect(ref.current?.querySelector(".bar")?.textContent).toBe("drawn by plain JS");
    await act(async () => {
      fireEvent.click(rendered.getByRole("button", { name: "Relabel" }));
    });
    expect(ref.current?.getAttribute("aria-label")).toBe("Volume chart");
    expect(ref.current?.querySelectorAll(".bar")).toHaveLength(1);
    expect(log).toEqual(["mount figure"]);
    rendered.unmount();
    expect(log).toEqual(["mount figure", "cleanup"]);
    expect(ref.current).toBeNull();
  });
});
