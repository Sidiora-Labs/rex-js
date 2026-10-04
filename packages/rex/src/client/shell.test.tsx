import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { actor, type Actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { createRegistry } from "../core/registry.ts";
import { buildManifest } from "../manifest/build.ts";
import { DensityProvider } from "./agent/density.ts";
import { createRexApp, type DensitySlotProps } from "./app.tsx";
import basicPage, { greet } from "./fixtures/page-basic/page.ts";
import MainRegion from "./fixtures/page-basic/regions/main/region.tsx";
import * as basicStates from "./fixtures/page-basic/states.tsx";
import BasicView from "./fixtures/page-basic/view.tsx";
import secondPage from "./fixtures/page-second/page.ts";
import * as secondStates from "./fixtures/page-second/states.tsx";
import SecondView from "./fixtures/page-second/view.tsx";
import { createOutcomeStore, OutcomeProvider, type OutcomeStore } from "./outcome.ts";
import { definePageModules, view, type PageModuleSet } from "./page.tsx";
import { RexProviders } from "./providers.ts";
import { createScreenSource, type MatchMedia, type ScreenSource } from "./screen.ts";
import { AgentOutcome, Shell, isNavigable, type OutcomeSlotProps } from "./shell.tsx";
import {
  PALETTE_TRIGGER_ATTRIBUTE,
  ShellComponentsProvider,
  isApplePlatform,
  resolveShellComponents,
  shortcutText,
  useShellComponents,
  type ShellComponents,
  type ShellFrameProps,
  type ShellNavProps,
} from "./shell/components.ts";

const home = page("home", { route: "/", chrome: { title: "Home" }, states: ["ready"] });
const focus = page("focus", {
  route: "/focus",
  chrome: { title: "Focus", header: false, nav: false, back: "home" },
  states: ["ready"],
});

const pages: readonly PageModuleSet[] = [
  definePageModules({ page: home, view: view(() => <p>Home body</p>), states: {} }),
  definePageModules({ page: focus, view: view(() => <p>Focus body</p>), states: {} }),
  definePageModules({
    page: basicPage,
    view: BasicView,
    states: basicStates,
    regions: { main: MainRegion },
  }),
  definePageModules({ page: secondPage, view: SecondView, states: secondStates }),
];

const registry = createRegistry().register(greet, home, focus, basicPage, secondPage).freeze();
const manifest = buildManifest(registry, { app: "wallet" });
const viewer = actor({ id: "viewer", permissions: ["view"] });
const stranger = actor({ id: "stranger" });

interface MountOptions {
  readonly outcome?: ComponentType<OutcomeSlotProps>;
  readonly components?: ShellComponents;
  readonly screen?: ScreenSource;
}

function stubMatchMedia(width: number, coarse: boolean): MatchMedia {
  const matches = (media: string) =>
    media.split(" and ").every((part) => {
      const [, feature, value = ""] = /\(([a-z-]+):\s*([^)]+)\)/.exec(part) ?? [];
      if (feature === "min-width") return width >= Number.parseFloat(value);
      if (feature === "max-width") return width <= Number.parseFloat(value);
      if (feature === "pointer") return (value === "coarse") === coarse;
      return false;
    });
  return (media) =>
    Object.assign(new EventTarget(), {
      media,
      matches: matches(media),
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
    }) as unknown as MediaQueryList;
}

function screenSource(width: number, coarse = false): ScreenSource {
  return createScreenSource({ matchMedia: stubMatchMedia(width, coarse), width: () => width });
}

function mount(
  path: string,
  subject: Actor = viewer,
  modules: readonly PageModuleSet[] = pages,
  options: MountOptions = {},
) {
  const memory = memoryLocation({ path, record: true });
  const store: OutcomeStore = createOutcomeStore();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        queryFn: ({ queryKey }) => (queryKey[0] === "greeting" ? "Hello" : ["gold"]),
      },
    },
  });
  const source = options.screen;
  function Density({ children }: DensitySlotProps) {
    return source === undefined ? (
      children
    ) : (
      <DensityProvider search="" header={null} screen={source}>
        {children}
      </DensityProvider>
    );
  }
  const RexApp = createRexApp({
    registry,
    manifest,
    actor: subject,
    baseUrl: "http://rex.test",
    queryClient,
    density: Density,
  });
  const shell =
    options.outcome === undefined ? (
      <Shell pages={modules} />
    ) : (
      <RexProviders>
        <Shell pages={modules} outcome={options.outcome} />
      </RexProviders>
    );
  render(
    <OutcomeProvider store={store}>
      <RexApp>
        <Router hook={memory.hook}>
          {options.components === undefined ? (
            shell
          ) : (
            <ShellComponentsProvider components={options.components}>
              {shell}
            </ShellComponentsProvider>
          )}
        </Router>
      </RexApp>
    </OutcomeProvider>,
  );
  return { memory, store };
}

function heading(): string | null {
  return screen.getByRole("heading", { level: 1 }).textContent;
}

function navLinks() {
  return within(screen.getByRole("navigation", { name: "Pages" })).getAllByRole("link");
}

function SidebarFrame({ appName, links, palette, children }: ShellFrameProps) {
  const { Nav } = useShellComponents();
  return (
    <div data-testid="sidebar-frame">
      <aside aria-label={appName}>
        <Nav links={links} form="sidebar" />
        {palette === null ? null : (
          <button type="button" data-rex-palette-trigger={palette.address} onClick={palette.onOpen}>
            {palette.label}
          </button>
        )}
      </aside>
      <div data-testid="sidebar-content">{children}</div>
    </div>
  );
}

function SidebarNav({ links, form }: ShellNavProps) {
  return (
    <nav aria-label="Pages" data-form={form}>
      <ol>
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={link.href}
              data-rex-nav={link.address}
              aria-current={link.current ? "page" : undefined}
              onClick={link.onClick}
            >
              {link.label.toUpperCase()}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

afterEach(() => {
  cleanup();
});

describe("Shell", () => {
  it("renders the header title from the active page chrome", () => {
    mount("/");
    expect(heading()).toBe("Home");
    expect(screen.getByText("Home body")).toBeTruthy();
    expect(document.querySelector("main")?.getAttribute("data-rex-page")).toBe("home");
  });

  it("lists navigable pages from their chrome and marks the active one", () => {
    mount("/");
    const links = navLinks();
    expect(links.map((link) => link.textContent)).toEqual(["Home", "Second"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/second"]);
    expect(links.map((link) => link.getAttribute("data-rex-nav"))).toEqual(["home", "second"]);
    expect(links[0]?.getAttribute("aria-current")).toBe("page");
    expect(links[1]?.getAttribute("aria-current")).toBeNull();
    expect(registry.pages.filter(isNavigable).map((p) => p.id)).toEqual(["home", "second"]);
  });

  it("navigates through the nav and updates header and body", async () => {
    const { memory } = mount("/");
    await click(navLinks()[1] as HTMLElement);
    expect(memory.history.at(-1)).toBe("/second");
    expect(heading()).toBe("Second");
    expect(screen.getByText("Second page body")).toBeTruthy();
    expect(navLinks()[1]?.getAttribute("aria-current")).toBe("page");
  });

  it("offers the declared back target and carries matching params", async () => {
    const { memory } = mount("/second?name=ada");
    const back = screen.getByRole("button", { name: "Back to Basic" });
    expect(back.getAttribute("data-rex-nav")).toBe("basic");
    await click(back);
    expect(memory.history.at(-1)).toBe("/basic/ada");
    expect(heading()).toBe("Basic");
    await waitFor(() => expect(screen.getByText("Hello ada")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /^Back to / })).toBeNull();
  });

  it("hides the header and the nav for pages whose chrome turns them off", () => {
    mount("/focus");
    expect(screen.getByText("Focus body")).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("renders the permission-denied state with a control to the recovery target", async () => {
    const { memory } = mount("/second", stranger);
    expect(heading()).toBe("Second");
    expect(screen.getByText("You cannot open the second page")).toBeTruthy();
    expect(screen.queryByText("Second page body")).toBeNull();
    const recover = screen.getByRole("button", { name: "Go to Home" });
    expect(recover.getAttribute("data-rex-nav")).toBe("home");
    await click(recover);
    expect(memory.history.at(-1)).toBe("/");
    expect(heading()).toBe("Home");
    expect(screen.queryByRole("button", { name: "Go to Home" })).toBeNull();
  });

  it("renders the app-level not-found state inside the shell", async () => {
    mount("/missing");
    await screen.findByRole("alert");
    expect(heading()).toBe("Page not found");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("alert").textContent).toBe("No page matches /missing.");
    expect(navLinks()).toHaveLength(2);
  });

  it("renders the outcome slot for the active page", async () => {
    const { store } = mount("/");
    const outcome = screen.getByRole("status", { name: "Outcome" });
    expect(outcome.textContent).toBe("");
    await act(async () => {
      store.set("home", {
        actionId: "greet",
        ok: false,
        message: "Greet: not allowed (never)",
        at: new Date(0).toISOString(),
      });
    });
    expect(screen.getByRole("status", { name: "Outcome" }).textContent).toBe(
      "Greet: not allowed (never)",
    );
  });

  it("requires a module set for every registered page", () => {
    const original = console.error;
    console.error = () => {};
    try {
      expect(() => mount("/", viewer, pages.slice(1))).toThrow(
        'rex: Shell has no module set for page "home"',
      );
    } finally {
      console.error = original;
    }
  });

  it("renders the default frame with the app bar, the primary navigation and the content landmarks", () => {
    mount("/", viewer, pages, { screen: screenSource(820) });
    const frame = document.querySelector("[data-rex-shell] > [data-rex-frame]");
    expect(frame).not.toBeNull();
    const banner = screen.getByRole("banner");
    expect(frame?.contains(banner)).toBe(true);
    expect(banner.querySelector(".rex-frame-name")?.textContent).toBe("wallet");
    const nav = within(banner).getByRole("navigation", { name: "Pages" });
    expect(nav.getAttribute("data-rex-nav-form")).toBe("bar");
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("data-rex-nav")),
    ).toEqual(["home", "second"]);
    const content = frame?.querySelector(".rex-frame-content");
    const main = screen.getByRole("main");
    expect(main.getAttribute("data-rex-page")).toBe("home");
    expect(content?.contains(main)).toBe(true);
    expect(content?.contains(screen.getByRole("status", { name: "Outcome" }))).toBe(true);
    expect(content?.contains(screen.getByRole("heading", { level: 1 }))).toBe(true);
    expect(banner.contains(main)).toBe(false);
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(document.querySelector(`[${PALETTE_TRIGGER_ATTRIBUTE}]`)).toBeNull();
  });

  it("keeps the app bar without the navigation on pages whose chrome turns the nav off", () => {
    mount("/focus");
    const banner = screen.getByRole("banner");
    expect(banner.querySelector(".rex-frame-name")?.textContent).toBe("wallet");
    expect(within(banner).queryByRole("navigation")).toBeNull();
    expect(banner.contains(screen.getByRole("main"))).toBe(false);
  });

  it("shows the palette trigger with its visible shortcut and opens the palette from it", async () => {
    mount("/", viewer, pages, { outcome: AgentOutcome });
    const trigger = within(screen.getByRole("banner")).getByRole("button", {
      name: /Command palette/,
    });
    expect(trigger.getAttribute(PALETTE_TRIGGER_ATTRIBUTE)).toBe("palette");
    expect(trigger.getAttribute("aria-keyshortcuts")).toBe("Control+K Meta+K");
    expect(trigger.querySelector("kbd")?.textContent).toBe(
      shortcutText("mod+k", isApplePlatform()),
    );
    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();
    trigger.focus();
    await click(trigger);
    const palette = await screen.findByRole("dialog", { name: "Command palette" });
    const values = within(palette)
      .getAllByRole("option")
      .map((option) => option.getAttribute("data-value"));
    expect(values).toEqual(expect.arrayContaining(["page:home", "page:second"]));
    await act(async () => {
      fireEvent.keyDown(palette, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("renders an overriding Frame and Nav in place of the default frame", async () => {
    const components = resolveShellComponents({ Frame: SidebarFrame, Nav: SidebarNav });
    const { memory } = mount("/", viewer, pages, { outcome: AgentOutcome, components });
    expect(document.querySelector("[data-rex-frame]")).toBeNull();
    expect(screen.queryByRole("banner")).toBeNull();
    const frame = screen.getByTestId("sidebar-frame");
    const sidebar = within(frame).getByRole("complementary", { name: "wallet" });
    const nav = within(sidebar).getByRole("navigation", { name: "Pages" });
    expect(nav.getAttribute("data-form")).toBe("sidebar");
    expect(navLinks().map((link) => link.textContent)).toEqual(["HOME", "SECOND"]);
    expect(navLinks().map((link) => link.getAttribute("data-rex-nav"))).toEqual(["home", "second"]);
    expect(navLinks()[0]?.getAttribute("aria-current")).toBe("page");
    expect(
      within(sidebar)
        .getByRole("button", { name: "Command palette" })
        .getAttribute(PALETTE_TRIGGER_ATTRIBUTE),
    ).toBe("palette");
    const content = screen.getByTestId("sidebar-content");
    expect(content.contains(screen.getByRole("main"))).toBe(true);
    expect(content.contains(screen.getByRole("heading", { level: 1 }))).toBe(true);
    await click(navLinks()[1] as HTMLElement);
    expect(memory.history.at(-1)).toBe("/second");
    expect(heading()).toBe("Second");
    expect(navLinks()[1]?.getAttribute("aria-current")).toBe("page");
  });
});

describe("navigation forms by screen", () => {
  function addresses(nav: HTMLElement): (string | null)[] {
    return within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("data-rex-nav"));
  }

  it("renders the Nav as a sidebar beside the content on desktop and wide screens", async () => {
    for (const width of [1280, 1920]) {
      const { memory } = mount("/", viewer, pages, { screen: screenSource(width) });
      const frame = document.querySelector("[data-rex-frame]") as HTMLElement;
      expect(frame.getAttribute("data-rex-nav-form")).toBe("sidebar");
      const nav = screen.getByRole("navigation", { name: "Pages" });
      expect(nav.getAttribute("data-rex-nav-form")).toBe("sidebar");
      expect(screen.getByRole("banner").contains(nav)).toBe(false);
      expect(nav.closest(".rex-frame-aside")?.parentElement?.className).toBe("rex-frame-body");
      expect(addresses(nav)).toEqual(["home", "second"]);
      const content = frame.querySelector(".rex-frame-content") as HTMLElement;
      expect(content.contains(screen.getByRole("main"))).toBe(true);
      expect(content.contains(nav)).toBe(false);
      await click(navLinks()[1] as HTMLElement);
      expect(memory.history.at(-1)).toBe("/second");
      expect(navLinks()[1]?.getAttribute("aria-current")).toBe("page");
      cleanup();
    }
  });

  it("renders the Nav as a bar in the app bar on tablet", () => {
    mount("/", viewer, pages, { screen: screenSource(820) });
    const nav = within(screen.getByRole("banner")).getByRole("navigation", { name: "Pages" });
    expect(nav.getAttribute("data-rex-nav-form")).toBe("bar");
    expect(document.querySelector(".rex-frame-aside")).toBeNull();
  });

  it("renders the Nav as a dock after the content on phone with the same addresses", async () => {
    const { memory } = mount("/", viewer, pages, { screen: screenSource(390, true) });
    const frame = document.querySelector("[data-rex-frame]") as HTMLElement;
    expect(frame.getAttribute("data-rex-nav-form")).toBe("dock");
    const nav = screen.getByRole("navigation", { name: "Pages" });
    expect(nav.getAttribute("data-rex-nav-form")).toBe("dock");
    expect(nav.parentElement).toBe(frame);
    expect(frame.lastElementChild).toBe(nav);
    expect(screen.getByRole("banner").contains(nav)).toBe(false);
    expect(addresses(nav)).toEqual(["home", "second"]);
    expect(navLinks().map((link) => link.getAttribute("href"))).toEqual(["/", "/second"]);
    await click(navLinks()[1] as HTMLElement);
    expect(memory.history.at(-1)).toBe("/second");
    expect(heading()).toBe("Second");
    expect(navLinks()[1]?.getAttribute("aria-current")).toBe("page");
  });

  it("keeps the content mounted when the screen changes the navigation form", async () => {
    let width = 1280;
    const lists: { list: EventTarget; media: string }[] = [];
    const matchMedia: MatchMedia = (media) => {
      const list = Object.defineProperties(new EventTarget(), {
        media: { value: media },
        matches: { get: () => stubMatchMedia(width, width < 600)(media).matches },
        onchange: { value: null },
        addListener: { value: () => {} },
        removeListener: { value: () => {} },
      });
      lists.push({ list, media });
      return list as unknown as MediaQueryList;
    };
    mount("/", viewer, pages, {
      screen: createScreenSource({ matchMedia, width: () => width }),
    });
    const main = screen.getByRole("main");
    expect(
      screen.getByRole("navigation", { name: "Pages" }).getAttribute("data-rex-nav-form"),
    ).toBe("sidebar");
    await act(async () => {
      width = 390;
      for (const { list } of lists) list.dispatchEvent(new Event("change"));
    });
    expect(
      screen.getByRole("navigation", { name: "Pages" }).getAttribute("data-rex-nav-form"),
    ).toBe("dock");
    expect(screen.getByRole("main")).toBe(main);
  });

  it("omits the sidebar when the page turns its navigation off", () => {
    mount("/focus", viewer, pages, { screen: screenSource(1280) });
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(document.querySelector(".rex-frame-aside")).toBeNull();
    expect(document.querySelector("[data-rex-frame]")?.hasAttribute("data-rex-nav-form")).toBe(
      false,
    );
  });
});
