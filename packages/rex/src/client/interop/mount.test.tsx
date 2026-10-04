import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
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
import { createTestApp, readSidecar, testServer } from "../../testing/index.ts";
import { useInvoke } from "../agent/confirm.tsx";
import type { RexFetch } from "../app.tsx";
import type { RexEntryBundle } from "../entry.tsx";
import { definePageModules, view, type PageModuleSet } from "../page.tsx";
import { mountRexPage, type MountRexPageOptions, type UnmountRexPage } from "./mount.tsx";

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
    <button type="button" {...hide.controlProps} onClick={() => void hide.invoke({ hide: true })}>
      Hide dust
    </button>
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

function slots(...ids: readonly string[]): HTMLElement[] {
  document.body.innerHTML =
    '<header id="legacy-header"><h1>Legacy wallet</h1></header>' +
    ids.map((id) => `<div id="${id}"></div>`).join("") +
    '<footer id="legacy-footer"><a href="/help">Help</a></footer>';
  return ids.map((id) => document.getElementById(id) as HTMLElement);
}

function entryOptions(ledger: Ledger): MountRexPageOptions {
  const app = createTestApp(bundle, { actor: owner, server: { ledger } });
  const fetch: RexFetch = testServer(app).fetch;
  return { actor: owner, fetch, baseUrl: app.baseUrl };
}

const mounted: UnmountRexPage[] = [];

async function mountPage(
  slot: HTMLElement,
  pageId: string,
  options: MountRexPageOptions,
): Promise<UnmountRexPage> {
  let unmount: UnmountRexPage = () => {};
  await act(async () => {
    unmount = mountRexPage(slot, bundle, pageId, options);
  });
  mounted.push(unmount);
  return unmount;
}

function pageIn(slot: HTMLElement, pageId: string): Element | null {
  return slot.querySelector(`[data-rex-page="${pageId}"]`);
}

function rexError(code: string) {
  return expect.objectContaining({ name: "RexError", code });
}

afterEach(async () => {
  await act(async () => {
    for (const unmount of mounted.splice(0)) unmount();
  });
  cleanup();
  document.body.innerHTML = "";
});

describe("mountRexPage", () => {
  it("refuses non-elements, incomplete bundles, unknown pages and invalid params by code", () => {
    const [slot] = slots("rex-slot") as [HTMLElement];
    const textNode = document.createTextNode("legacy") as unknown as Element;
    expect(() => mountRexPage(textNode, bundle, "portfolio")).toThrow(rexError("REX329"));
    expect(() => mountRexPage({} as Element, bundle, "portfolio")).toThrow(rexError("REX329"));
    expect(() => mountRexPage(slot, null as unknown as RexEntryBundle, "portfolio")).toThrow(
      rexError("REX313"),
    );
    expect(() => mountRexPage(slot, { registry, pages }, "portfolio")).toThrow(rexError("REX313"));
    expect(() => mountRexPage(slot, bundle, "missing")).toThrow(rexError("REX301"));
    expect(() => mountRexPage(slot, bundle, "holding")).toThrow(rexError("REX331"));
    expect(() => mountRexPage(slot, bundle, "holding", { params: { symbol: "" } })).toThrow(
      /mountRexPage: invalid params for page "holding": \S*symbol /,
    );
    expect(slot.childNodes.length).toBe(0);
    expect(document.querySelector("[data-rex-page]")).toBeNull();
  });

  it("mounts the page at its href in a memory router and leaves the browser location alone", async () => {
    const [slot] = slots("rex-slot") as [HTMLElement];
    const before = window.location.href;
    await mountPage(slot, "holding", {
      ...entryOptions(memoryLedger()),
      params: { symbol: "PAX" },
    });
    await waitFor(() =>
      expect(pageIn(slot, "holding")?.querySelector("h2")?.textContent).toBe("Holding PAX"),
    );
    expect(window.location.href).toBe(before);
    expect(window.location.pathname).not.toContain("holdings");
    const sidecar = readSidecar(slot);
    expect(sidecar.page).toBe("holding");
    expect(sidecar.params).toEqual({ symbol: "PAX" });
    expect(document.getElementById("legacy-header")?.textContent).toBe("Legacy wallet");
    expect(document.getElementById("legacy-footer")?.querySelector("a")?.textContent).toBe("Help");
  });

  it("passes the entry options through so onOutcome observes an action invoked from the page", async () => {
    const [slot] = slots("rex-slot") as [HTMLElement];
    const ledger = memoryLedger();
    const seen: string[] = [];
    await mountPage(slot, "portfolio", {
      ...entryOptions(ledger),
      onOutcome: (event) => {
        seen.push(`${event.page}/${event.actionId}:${String(event.ok)}`);
      },
    });
    await waitFor(() => expect(pageIn(slot, "portfolio")).not.toBeNull());
    const control = slot.querySelector<HTMLElement>('[data-rex="portfolio/hide-dust"]');
    expect(control).not.toBeNull();
    await act(async () => {
      fireEvent.click(control as HTMLElement);
    });
    await waitFor(() => expect(seen).toEqual(["portfolio/hide-dust:true"]));
    expect((await ledger.list()).map((record) => `${record.actionId}:${record.outcome}`)).toEqual([
      "hide-dust:ok",
    ]);
  });

  it("keeps one live page per document and lets a second slot take over once it unmounts", async () => {
    const [first, second] = slots("rex-first", "rex-second") as [HTMLElement, HTMLElement];
    const ledger = memoryLedger();
    const unmountFirst = await mountPage(first, "portfolio", entryOptions(ledger));
    await waitFor(() => expect(pageIn(first, "portfolio")).not.toBeNull());
    let unmountSecond: UnmountRexPage = () => {};
    await expect(
      act(async () => {
        unmountSecond = mountRexPage(second, bundle, "holding", {
          ...entryOptions(ledger),
          params: { symbol: "ETH" },
        });
      }),
    ).rejects.toThrow(rexError("REX318"));
    mounted.push(unmountSecond);
    expect(pageIn(first, "portfolio")).not.toBeNull();
    expect(readSidecar(first).page).toBe("portfolio");
    expect(second.querySelector("[data-rex-page]")).toBeNull();
    await act(async () => {
      unmountSecond();
      unmountFirst();
    });
    expect(first.childNodes.length).toBe(0);
    expect(second.childNodes.length).toBe(0);
    expect(document.querySelector("[data-rex-page]")).toBeNull();
    await mountPage(second, "holding", { ...entryOptions(ledger), params: { symbol: "ETH" } });
    await waitFor(() => expect(pageIn(second, "holding")?.textContent).toBe("Holding ETH"));
    expect(readSidecar(second).page).toBe("holding");
    expect(first.childNodes.length).toBe(0);
  });
});
