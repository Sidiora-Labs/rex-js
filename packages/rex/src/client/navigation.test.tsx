import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { createRegistry } from "../core/registry.ts";
import { text, z } from "../core/schema.ts";
import { buildManifest } from "../manifest/build.ts";
import { createRexApp } from "./app.tsx";
import { useNav } from "./nav.ts";
import { definePageModules, view, type PageModuleSet } from "./page.tsx";
import type {
  NavigateEventLike,
  NavigationDestinationLike,
  NavigationInterceptOptions,
  NavigationType,
} from "./router.tsx";
import { Shell } from "./shell.tsx";

const home = page("home", { route: "/", chrome: { title: "Home" }, states: ["ready"] });
const detail = page("detail", {
  route: "/detail/:id",
  params: z.object({ id: text({ min: 1 }) }),
  chrome: { title: "Detail", nav: false, back: "home" },
  transition: "view",
  states: ["ready"],
});
const bare = page("bare", {
  route: "/bare",
  chrome: { title: "Bare", header: false },
  states: ["ready"],
});

function HomeView() {
  const nav = useNav();
  return (
    <div>
      <p>Home body</p>
      <button type="button" onClick={() => nav.to(detail, { id: "7" })}>
        open detail
      </button>
    </div>
  );
}

const pages: readonly PageModuleSet[] = [
  definePageModules({ page: home, view: view(() => <HomeView />), states: {} }),
  definePageModules({
    page: detail,
    view: view<{ readonly id: string }>(({ params }) => <p>Detail body {params.id}</p>),
    states: {},
  }),
  definePageModules({ page: bare, view: view(() => <p>Bare body</p>), states: {} }),
];

const registry = createRegistry().register(home, detail, bare).freeze();
const manifest = buildManifest(registry);
const viewer = actor({ id: "viewer" });

function mount(path: string) {
  const memory = memoryLocation({ path, record: true });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const RexApp = createRexApp({
    registry,
    manifest,
    actor: viewer,
    baseUrl: "http://rex.test",
    queryClient,
  });
  render(
    <RexApp>
      <Router hook={memory.hook}>
        <Shell pages={pages} />
      </Router>
    </RexApp>,
  );
  return memory;
}

function announcer(): HTMLElement {
  const region = document.querySelector<HTMLElement>("[data-rex-announcer]");
  if (region === null) throw new Error("the shell renders no announcer");
  return region;
}

function activePage(): string | null {
  return document.querySelector("main")?.getAttribute("data-rex-page") ?? null;
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

function navLink(name: string): HTMLElement {
  return within(screen.getByRole("navigation", { name: "Pages" })).getByRole("link", { name });
}

interface RecordedTransition {
  readonly pageBefore: string | null;
  pageAfter: string | null;
}

function injectViewTransitions(): RecordedTransition[] {
  const recorded: RecordedTransition[] = [];
  const startViewTransition = (
    update?: ViewTransitionUpdateCallback | StartViewTransitionOptions,
  ): ViewTransition => {
    const entry: RecordedTransition = { pageBefore: activePage(), pageAfter: null };
    recorded.push(entry);
    const callback = typeof update === "function" ? update : update?.update;
    const updateCallbackDone = Promise.resolve().then(async () => {
      await callback?.();
      entry.pageAfter = activePage();
    });
    return {
      updateCallbackDone,
      ready: updateCallbackDone,
      finished: updateCallbackDone,
      skipTransition: () => undefined,
      types: new Set<string>() as ViewTransitionTypeSet,
    };
  };
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    writable: true,
    value: startViewTransition,
  });
  return recorded;
}

interface NavigateInit {
  readonly url: string;
  readonly navigationType?: NavigationType;
  readonly sameDocument?: boolean;
  readonly formData?: FormData | null;
}

class TestNavigateEvent extends Event implements NavigateEventLike {
  readonly navigationType: NavigationType;
  readonly canIntercept = true;
  readonly hashChange = false;
  readonly downloadRequest = null;
  readonly formData: FormData | null;
  readonly destination: NavigationDestinationLike;
  readonly intercepts: NavigationInterceptOptions[] = [];

  constructor(init: NavigateInit) {
    super("navigate", { cancelable: true });
    this.navigationType = init.navigationType ?? "push";
    this.formData = init.formData ?? null;
    this.destination = { url: init.url, sameDocument: init.sameDocument ?? false };
  }

  intercept(options: NavigationInterceptOptions = {}): void {
    if (!this.canIntercept) throw new DOMException("cannot intercept", "SecurityError");
    this.intercepts.push(options);
  }
}

class TestNavigation extends EventTarget {
  readonly events: TestNavigateEvent[] = [];

  async navigate(init: NavigateInit): Promise<TestNavigateEvent> {
    const event = new TestNavigateEvent(init);
    this.events.push(event);
    this.dispatchEvent(event);
    for (const options of event.intercepts) await options.handler?.();
    return event;
  }
}

function injectNavigation(): TestNavigation {
  const navigation = new TestNavigation();
  Object.defineProperty(globalThis, "navigation", {
    configurable: true,
    writable: true,
    value: navigation,
  });
  return navigation;
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(document, "startViewTransition");
  Reflect.deleteProperty(globalThis, "navigation");
});

describe("focus and announcements", () => {
  it("leaves focus and the announcer alone on the first render", () => {
    mount("/");
    expect(announcer().textContent).toBe("");
    expect(announcer().getAttribute("aria-live")).toBe("polite");
    expect(announcer().getAttribute("aria-atomic")).toBe("true");
    expect(document.activeElement).toBe(document.body);
  });

  it("focuses the page heading and announces the title after a route change", async () => {
    const memory = mount("/");
    await click(screen.getByRole("button", { name: "open detail" }));
    expect(memory.history.at(-1)).toBe("/detail/7");
    expect(screen.getByText("Detail body 7")).toBeTruthy();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Detail");
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute("tabindex")).toBe("-1");
    expect(announcer().textContent).toBe("Detail");
  });

  it("focuses the main landmark when the page renders no heading", async () => {
    mount("/");
    await click(navLink("Bare"));
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    const main = document.querySelector("main");
    expect(main?.getAttribute("data-rex-page")).toBe("bare");
    expect(document.activeElement).toBe(main);
    expect(announcer().textContent).toBe("Bare");
    await click(navLink("Home"));
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
    expect(announcer().textContent).toBe("Home");
  });
});

describe("view transitions", () => {
  it("runs a route change to a view-transition page inside document.startViewTransition", async () => {
    const recorded = injectViewTransitions();
    const memory = mount("/");
    await click(screen.getByRole("button", { name: "open detail" }));
    expect(recorded).toEqual([{ pageBefore: "home", pageAfter: "detail" }]);
    expect(memory.history.at(-1)).toBe("/detail/7");
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
    expect(announcer().textContent).toBe("Detail");
  });

  it("navigates without a view transition when the target page declares none", async () => {
    const recorded = injectViewTransitions();
    const memory = mount("/");
    await click(navLink("Bare"));
    expect(recorded).toEqual([]);
    expect(memory.history.at(-1)).toBe("/bare");
    expect(activePage()).toBe("bare");
  });
});

describe("Navigation API", () => {
  it("intercepts a same-origin navigate event and routes it through RexRoutes", async () => {
    const recorded = injectViewTransitions();
    const navigation = injectNavigation();
    const memory = mount("/");
    let event: TestNavigateEvent | undefined;
    await act(async () => {
      event = await navigation.navigate({ url: `${location.origin}/detail/9?ref=link` });
    });
    expect(event?.intercepts).toHaveLength(1);
    expect(event?.intercepts[0]?.focusReset).toBe("manual");
    expect(memory.history.at(-1)).toBe("/detail/9?ref=link");
    expect(screen.getByText("Detail body 9")).toBeTruthy();
    expect(recorded).toEqual([{ pageBefore: "home", pageAfter: "detail" }]);
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
    expect(announcer().textContent).toBe("Detail");
  });

  it("leaves cross-origin, unrouted, same-document, form and traverse navigations to the browser", async () => {
    const navigation = injectNavigation();
    const memory = mount("/");
    const formData = new FormData();
    formData.set("_csrf", "token");
    const events: TestNavigateEvent[] = [];
    await act(async () => {
      events.push(await navigation.navigate({ url: "https://elsewhere.test/detail/1" }));
      events.push(await navigation.navigate({ url: `${location.origin}/rex/form/greet` }));
      events.push(
        await navigation.navigate({ url: `${location.origin}/bare`, sameDocument: true }),
      );
      events.push(await navigation.navigate({ url: `${location.origin}/bare`, formData }));
      events.push(
        await navigation.navigate({ url: `${location.origin}/bare`, navigationType: "traverse" }),
      );
      events.push(
        await navigation.navigate({ url: `${location.origin}/bare`, navigationType: "reload" }),
      );
    });
    expect(events.map((event) => event.intercepts.length)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(memory.history).toEqual(["/"]);
    expect(activePage()).toBe("home");
  });

  it("stops intercepting once RexRoutes unmounts", async () => {
    const navigation = injectNavigation();
    mount("/");
    cleanup();
    const event = await navigation.navigate({ url: `${location.origin}/bare` });
    expect(event.intercepts).toHaveLength(0);
  });
});
