import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { actor, type Actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { createRegistry } from "../core/registry.ts";
import { buildManifest } from "../manifest/build.ts";
import { createRexApp } from "./app.tsx";
import basicPage, { greet } from "./fixtures/page-basic/page.ts";
import MainRegion from "./fixtures/page-basic/regions/main/region.tsx";
import * as basicStates from "./fixtures/page-basic/states.tsx";
import BasicView from "./fixtures/page-basic/view.tsx";
import secondPage from "./fixtures/page-second/page.ts";
import * as secondStates from "./fixtures/page-second/states.tsx";
import SecondView from "./fixtures/page-second/view.tsx";
import { createOutcomeStore, OutcomeProvider, type OutcomeStore } from "./outcome.ts";
import { definePageModules, view, type PageModuleSet } from "./page.tsx";
import { Shell, isNavigable } from "./shell.tsx";

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
const manifest = buildManifest(registry);
const viewer = actor({ id: "viewer", permissions: ["view"] });
const stranger = actor({ id: "stranger" });

function mount(path: string, subject: Actor = viewer, modules: readonly PageModuleSet[] = pages) {
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
  const RexApp = createRexApp({
    registry,
    manifest,
    actor: subject,
    baseUrl: "http://rex.test",
    queryClient,
  });
  render(
    <OutcomeProvider store={store}>
      <RexApp>
        <Router hook={memory.hook}>
          <Shell pages={modules} />
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

  it("renders the app-level not-found state inside the shell", () => {
    mount("/missing");
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
});
