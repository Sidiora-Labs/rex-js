import { QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { action } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { always } from "../../core/policy.ts";
import { createRegistry } from "../../core/registry.ts";
import { z } from "zod/mini";
import { buildManifest } from "../../manifest/build.ts";
import { createRexApp } from "../app.tsx";
import basicPage, { greet } from "../fixtures/page-basic/page.ts";
import MainRegion from "../fixtures/page-basic/regions/main/region.tsx";
import * as basicStates from "../fixtures/page-basic/states.tsx";
import BasicView from "../fixtures/page-basic/view.tsx";
import { createOutcomeStore, OutcomeProvider } from "../outcome.ts";
import { definePageModules, region, view, type PageModuleSet } from "../page.tsx";
import { RexRoutes } from "../router.tsx";
import { Shell } from "../shell.tsx";
import {
  ADDRESS_ATTRIBUTES,
  AddressScope,
  actionAttributes,
  findAddressed,
  overlayAttributes,
  pageAttributes,
  readAddresses,
  regionAttributes,
  useAddress,
  type RexAddress,
} from "./address.tsx";

const theme = { current: "theme-a" };

const refresh = action("refresh", {
  input: z.object({}),
  output: z.object({ refreshed: z.boolean() }),
  policy: always(),
  effect: "read",
  label: "Refresh",
  handler: () => ({ refreshed: true }),
});

const board = page("board", {
  route: "/board",
  actions: [refresh],
  regions: ["list"],
  overlays: [{ id: "FilterSheet", dismiss: "both", binding: "region" }],
  states: ["ready"],
});

function Where({ testId }: { readonly testId: string }) {
  const address = useAddress();
  return (
    <p data-testid={testId} className={theme.current}>
      {[
        address.pageAddress,
        address.regionAddress,
        address.overlayAddress,
        address.action("refresh"),
      ]
        .map(String)
        .join(" ")}
    </p>
  );
}

const ListRegion = region("list", ({ act }) => {
  const handle = act(refresh);
  return (
    <AddressScope region="list">
      <div className={`${theme.current} list`}>
        <button type="button" className={theme.current} {...handle.controlProps}>
          Refresh
        </button>
        <Where testId="region-where" />
      </div>
    </AddressScope>
  );
});

function FilterSheet() {
  const address = useAddress();
  return (
    <AddressScope overlay="FilterSheet">
      <div
        role="dialog"
        aria-label="Filter"
        className={`${theme.current} sheet`}
        {...overlayAttributes(address.page ?? "", "FilterSheet")}
      >
        <Where testId="overlay-where" />
      </div>
    </AddressScope>
  );
}

const BoardView = view(() => (
  <div className={theme.current}>
    <ListRegion />
    <FilterSheet />
  </div>
));

const pages: readonly PageModuleSet[] = [
  definePageModules({
    page: basicPage,
    view: BasicView,
    states: basicStates,
    regions: { main: MainRegion },
  }),
  definePageModules({
    page: board,
    view: BoardView,
    states: {},
    regions: { list: ListRegion },
    overlays: { FilterSheet },
  }),
];

const registry = createRegistry().register(greet, refresh, basicPage, board).freeze();
const manifest = buildManifest(registry);
const viewer = actor({ id: "viewer", permissions: ["view"] });

function mount(path: string) {
  const memory = memoryLocation({ path });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        queryFn: ({ queryKey }) => (queryKey[0] === "greeting" ? "Hello" : ["gold"]),
      },
    },
  });
  const RexApp = createRexApp({
    registry,
    manifest,
    actor: viewer,
    baseUrl: "http://rex.test",
    queryClient,
  });
  return render(
    <OutcomeProvider store={createOutcomeStore()}>
      <RexApp>
        <Router hook={memory.hook}>
          <Shell pages={pages} />
        </Router>
      </RexApp>
    </OutcomeProvider>,
  );
}

afterEach(() => {
  cleanup();
  theme.current = "theme-a";
});

describe("address helpers", () => {
  it("derive every address from declaration names only", () => {
    expect(ADDRESS_ATTRIBUTES).toEqual({
      page: "data-rex-page",
      region: "data-rex-region",
      overlay: "data-rex-overlay",
      action: "data-rex",
    });
    expect(pageAttributes("send")).toEqual({ "data-rex-page": "send" });
    expect(regionAttributes("send", "form")).toEqual({ "data-rex-region": "send/form" });
    expect(overlayAttributes("send", "TokenSelectorSheet")).toEqual({
      "data-rex-overlay": "send/TokenSelectorSheet",
    });
    expect(actionAttributes("send", "pick-token")).toEqual({ "data-rex": "send/pick-token" });
    expect(actionAttributes("send", "pick-token")).toEqual(actionAttributes("send", "pick-token"));
    expect(() => regionAttributes("send", "Form")).toThrow();
    expect(() => overlayAttributes("send", "sheet")).toThrow();
    expect(() => actionAttributes("Send", "go")).toThrow();
  });
});

describe("addressing on the fixture page", () => {
  it("renders data-rex-page, data-rex-region and data-rex on the basic fixture", async () => {
    mount("/basic/ada");
    await waitFor(() => expect(screen.getByText("Hello ada")).toBeTruthy());
    const main = document.querySelector("main");
    expect(main?.getAttribute("data-rex-page")).toBe("basic");
    expect(findAddressed(document, "region", "basic/main")).toHaveLength(1);
    const greetButton = screen.getByRole("button", { name: "Greet" });
    expect(greetButton.getAttribute("data-rex")).toBe("basic/greet");
    expect(readAddresses(document)).toEqual([
      { kind: "page", address: "basic" },
      { kind: "region", address: "basic/main" },
      { kind: "action", address: "basic/greet" },
    ]);
  });

  it("renders the overlay address and resolves useAddress inside region and overlay scopes", () => {
    mount("/board");
    expect(readAddresses(document)).toEqual([
      { kind: "page", address: "board" },
      { kind: "region", address: "board/list" },
      { kind: "overlay", address: "board/FilterSheet" },
      { kind: "action", address: "board/refresh" },
    ]);
    expect(screen.getByRole("dialog", { name: "Filter" }).getAttribute("data-rex-overlay")).toBe(
      "board/FilterSheet",
    );
    expect(screen.getByTestId("region-where").textContent).toBe(
      "board board/list null board/refresh",
    );
    expect(screen.getByTestId("overlay-where").textContent).toBe(
      "board null board/FilterSheet board/refresh",
    );
  });

  it("keeps every attribute unchanged when class names change", async () => {
    mount("/board");
    const before = readAddresses(document);
    const classesBefore = [...document.querySelectorAll("[class]")].map((el) => el.className);
    cleanup();
    theme.current = "theme-b";
    mount("/board");
    const after = readAddresses(document);
    const classesAfter = [...document.querySelectorAll("[class]")].map((el) => el.className);
    expect(classesAfter).not.toEqual(classesBefore);
    expect(classesAfter.some((name) => name.includes("theme-b"))).toBe(true);
    expect(after).toEqual(before);

    cleanup();
    mount("/basic/ada");
    await waitFor(() => expect(screen.getByText("Hello ada")).toBeTruthy());
    const basicBefore = readAddresses(document);
    cleanup();
    theme.current = "theme-c";
    mount("/basic/ada");
    await waitFor(() => expect(screen.getByText("Hello ada")).toBeTruthy());
    expect(readAddresses(document)).toEqual(basicBefore);
  });
});

describe("useAddress", () => {
  it("returns null addresses outside an active page", () => {
    const seen: { current: RexAddress | null } = { current: null };
    function Probe() {
      seen.current = useAddress();
      return null;
    }
    const RexApp = createRexApp({ registry, manifest, actor: viewer, baseUrl: "http://rex.test" });
    const memory = memoryLocation({ path: "/nowhere" });
    render(
      <RexApp>
        <Router hook={memory.hook}>
          <RexRoutes render={() => <Probe />} />
        </Router>
      </RexApp>,
    );
    expect(seen.current?.page).toBeNull();
    expect(seen.current?.pageAddress).toBeNull();
    expect(seen.current?.regionAddress).toBeNull();
    expect(seen.current?.action("refresh")).toBeNull();
  });

  it("refuses a scope for a region or overlay the page does not declare", () => {
    const original = console.error;
    console.error = () => {};
    try {
      const RexApp = createRexApp({
        registry,
        manifest,
        actor: viewer,
        baseUrl: "http://rex.test",
      });
      const memory = memoryLocation({ path: "/board" });
      expect(() =>
        render(
          <RexApp>
            <Router hook={memory.hook}>
              <RexRoutes render={() => <AddressScope region="missing">x</AddressScope>} />
            </Router>
          </RexApp>,
        ),
      ).toThrow('rex: region "missing" is not declared by page "board"');
      cleanup();
      expect(() =>
        render(
          <RexApp>
            <Router hook={memory.hook}>
              <RexRoutes render={() => <AddressScope overlay="OtherSheet">x</AddressScope>} />
            </Router>
          </RexApp>,
        ),
      ).toThrow('rex: overlay "OtherSheet" is not declared by page "board"');
    } finally {
      console.error = original;
    }
  });
});
