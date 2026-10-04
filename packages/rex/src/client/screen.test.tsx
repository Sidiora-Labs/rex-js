import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { createRegistry } from "../core/registry.ts";
import { buildManifest } from "../manifest/build.ts";
import { validateSidecar, type SidecarPayload } from "../manifest/sidecar.schema.ts";
import { DENSITY_STORAGE_KEY, DensityProvider, useDensity } from "./agent/density.ts";
import { RexSidecar, readSidecar } from "./agent/sidecar.tsx";
import { createRexApp, type DensitySlotProps } from "./app.tsx";
import * as client from "./index.ts";
import { definePageModules, view, type PageModuleSet } from "./page.tsx";
import {
  COARSE_POINTER_QUERY,
  POINTER_ATTRIBUTE,
  SCREEN_ATTRIBUTE,
  SCREEN_ATTRIBUTES,
  SCREEN_BREAKPOINTS,
  SCREEN_QUERIES,
  ScreenProvider,
  ScreenSeedContext,
  classifyPointer,
  classifyScreen,
  createScreenSource,
  navFormFor,
  readRootScreen,
  screenAttributes,
  screenDensity,
  sheetFormFor,
  useScreen,
  type MatchMedia,
  type ResizeObserverConstructor,
  type ScreenSource,
  type ScreenState,
} from "./screen.ts";
import { Shell, type OutcomeSlotProps } from "./shell.tsx";

class StubMediaQueryList extends EventTarget {
  onchange: ((event: Event) => void) | null = null;
  listeners = 0;

  constructor(
    readonly media: string,
    private readonly viewport: StubViewport,
  ) {
    super();
  }

  get matches(): boolean {
    return this.viewport.evaluate(this.media);
  }

  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    this.listeners += 1;
    super.addEventListener(type, callback, options);
  }

  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void {
    this.listeners -= 1;
    super.removeEventListener(type, callback, options);
  }

  addListener(callback: (event: Event) => void): void {
    this.addEventListener("change", callback);
  }

  removeListener(callback: (event: Event) => void): void {
    this.removeEventListener("change", callback);
  }
}

class StubViewport {
  readonly lists: StubMediaQueryList[] = [];
  readonly observers: Set<{ notify(): void }> = new Set();

  constructor(
    public width: number,
    public coarse: boolean,
  ) {}

  readonly matchMedia: MatchMedia = (media) => {
    const list = new StubMediaQueryList(media, this);
    this.lists.push(list);
    return list as unknown as MediaQueryList;
  };

  evaluate(media: string): boolean {
    return media.split(" and ").every((part) => {
      const [, feature, value = ""] = /\(([a-z-]+):\s*([^)]+)\)/.exec(part) ?? [];
      if (feature === "min-width") return this.width >= Number.parseFloat(value);
      if (feature === "max-width") return this.width <= Number.parseFloat(value);
      if (feature === "pointer") return (value === "coarse") === this.coarse;
      return false;
    });
  }

  change(width: number, coarse: boolean = this.coarse): void {
    const before = this.lists.map((list) => list.matches);
    this.width = width;
    this.coarse = coarse;
    this.lists.forEach((list, index) => {
      if (list.matches !== before[index]) list.dispatchEvent(new Event("change"));
    });
  }

  resizeOnly(width: number): void {
    this.width = width;
    for (const observer of this.observers) observer.notify();
  }

  listening(): number {
    return this.lists.reduce((total, list) => total + list.listeners, 0);
  }

  readonly ResizeObserver: ResizeObserverConstructor = (() => {
    const viewport = this;
    return class StubResizeObserver {
      private targets: Element[] = [];

      constructor(private readonly callback: ResizeObserverCallback) {
        viewport.observers.add(this);
      }

      observe(target: Element): void {
        this.targets.push(target);
      }

      unobserve(target: Element): void {
        this.targets = this.targets.filter((entry) => entry !== target);
      }

      disconnect(): void {
        this.targets = [];
        viewport.observers.delete(this);
      }

      notify(): void {
        if (this.targets.length > 0) this.callback([], this as unknown as ResizeObserver);
      }
    } as unknown as ResizeObserverConstructor;
  })();

  source(): ScreenSource {
    return createScreenSource({
      matchMedia: this.matchMedia,
      ResizeObserver: this.ResizeObserver,
      width: () => this.width,
    });
  }
}

const home = page("home", { route: "/", chrome: { title: "Home" }, states: ["ready"] });
const registry = createRegistry().register(home).freeze();
const manifest = buildManifest(registry);
const pages: readonly PageModuleSet[] = [
  definePageModules({ page: home, view: view(() => <p>Home body</p>), states: {} }),
];

function Probe() {
  const state = useScreen();
  return <p data-testid="screen">{`${state.screen}:${state.pointer}:${state.density}`}</p>;
}

function shown(): string | null {
  return screen.getByTestId("screen").textContent;
}

function rootAttributes() {
  const root = document.documentElement;
  return {
    screen: root.getAttribute(SCREEN_ATTRIBUTE),
    pointer: root.getAttribute(POINTER_ATTRIBUTE),
    density: root.getAttribute(SCREEN_ATTRIBUTES.density),
  };
}

function SidecarSlot(_props: OutcomeSlotProps) {
  return <RexSidecar />;
}

function mountApp(viewport: StubViewport, search = "") {
  const source = viewport.source();
  function Density({ children }: DensitySlotProps) {
    return (
      <DensityProvider search={search} header={null} screen={source}>
        {children}
      </DensityProvider>
    );
  }
  const RexApp = createRexApp({
    registry,
    manifest,
    actor: actor({ id: "viewer" }),
    baseUrl: "http://rex.test",
    density: Density,
  });
  const memory = memoryLocation({ path: "/" });
  return render(
    <RexApp>
      <Router hook={memory.hook}>
        <Shell pages={pages} outcome={SidecarSlot} />
        <Probe />
      </Router>
    </RexApp>,
  );
}

function sidecar(): SidecarPayload {
  const result = validateSidecar(readSidecar(document));
  if (!result.valid) throw new Error(JSON.stringify(result.issues));
  expect(window.__rex).toEqual(result.payload);
  return result.payload;
}

function clearRoot() {
  for (const name of Object.values(SCREEN_ATTRIBUTES)) {
    document.documentElement.removeAttribute(name);
  }
}

beforeEach(() => {
  localStorage.clear();
  clearRoot();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  clearRoot();
});

describe("screen classification", () => {
  it("classifies the screen at 600, 1024 and 1600 px and the pointer by coarseness", () => {
    expect(SCREEN_BREAKPOINTS).toEqual({ phone: 600, tablet: 1024, desktop: 1600 });
    expect(classifyScreen(320)).toBe("phone");
    expect(classifyScreen(599)).toBe("phone");
    expect(classifyScreen(600)).toBe("tablet");
    expect(classifyScreen(1023)).toBe("tablet");
    expect(classifyScreen(1024)).toBe("desktop");
    expect(classifyScreen(1599)).toBe("desktop");
    expect(classifyScreen(1600)).toBe("wide");
    expect(classifyPointer(true)).toBe("coarse");
    expect(classifyPointer(false)).toBe("fine");
    expect(COARSE_POINTER_QUERY).toBe("(pointer: coarse)");
  });

  it("matches exactly one screen query at every width", () => {
    const viewport = new StubViewport(0, false);
    for (const width of [320, 599, 600, 1023, 1024, 1599, 1600, 2560]) {
      viewport.width = width;
      const matched = Object.entries(SCREEN_QUERIES)
        .filter(([, query]) => viewport.evaluate(query))
        .map(([name]) => name);
      expect(matched).toEqual([classifyScreen(width)]);
    }
  });

  it("maps density preferences to comfortable, compact and agent", () => {
    expect(screenDensity("default")).toBe("comfortable");
    expect(screenDensity("comfortable")).toBe("comfortable");
    expect(screenDensity(null)).toBe("comfortable");
    expect(screenDensity("compact")).toBe("compact");
    expect(screenDensity("agent")).toBe("agent");
  });

  it("picks the overlay and navigation form for each screen", () => {
    expect(sheetFormFor("phone")).toBe("bottom-sheet");
    expect(sheetFormFor("tablet")).toBe("dialog");
    expect(sheetFormFor("desktop")).toBe("dialog");
    expect(sheetFormFor("wide")).toBe("dialog");
    expect(navFormFor("phone")).toBe("dock");
    expect(navFormFor("tablet")).toBe("bar");
    expect(navFormFor("desktop")).toBe("sidebar");
    expect(navFormFor("wide")).toBe("sidebar");
  });

  it("is exported from the client entry", () => {
    expect(client.useScreen).toBe(useScreen);
    expect(client.ScreenProvider).toBe(ScreenProvider);
    expect(client.classifyScreen).toBe(classifyScreen);
  });
});

describe("createScreenSource", () => {
  it("reads the screen and pointer through matchMedia and follows change events", () => {
    const viewport = new StubViewport(390, true);
    const source = viewport.source();
    expect(source.get()).toEqual({ screen: "phone", pointer: "coarse" });
    const seen: string[] = [];
    const unsubscribe = source.subscribe(() => {
      seen.push(`${source.get().screen}:${source.get().pointer}`);
    });
    expect(viewport.listening()).toBe(5);
    viewport.change(820);
    viewport.change(1440, false);
    viewport.change(1440, false);
    viewport.change(1920);
    expect(seen).toEqual(["tablet:coarse", "desktop:fine", "wide:fine"]);
    unsubscribe();
    expect(viewport.listening()).toBe(0);
    expect(viewport.observers.size).toBe(0);
  });

  it("refreshes from a ResizeObserver on the root when no media query fires", () => {
    const viewport = new StubViewport(1280, false);
    const source = viewport.source();
    const seen: string[] = [];
    const unsubscribe = source.subscribe(() => seen.push(source.get().screen));
    expect(viewport.observers.size).toBe(1);
    viewport.resizeOnly(500);
    expect(seen).toEqual(["phone"]);
    unsubscribe();
  });

  it("keeps the snapshot identity while nothing changes", () => {
    const viewport = new StubViewport(1280, false);
    const source = viewport.source();
    const first = source.get();
    const unsubscribe = source.subscribe(() => {});
    viewport.resizeOnly(1300);
    expect(source.get()).toBe(first);
    unsubscribe();
  });
});

describe("ScreenProvider and useScreen", () => {
  it("writes data-rex-screen, data-rex-pointer and data-rex-density on the root and keeps them current", async () => {
    const viewport = new StubViewport(390, true);
    const { unmount } = mountApp(viewport);
    expect(rootAttributes()).toEqual({
      screen: "phone",
      pointer: "coarse",
      density: "comfortable",
    });
    expect(shown()).toBe("phone:coarse:comfortable");
    await act(async () => {
      viewport.change(1440, false);
    });
    expect(rootAttributes()).toEqual({
      screen: "desktop",
      pointer: "fine",
      density: "comfortable",
    });
    expect(shown()).toBe("desktop:fine:comfortable");
    unmount();
    expect(rootAttributes()).toEqual({ screen: null, pointer: null, density: null });
  });

  it("follows the compact and agent densities the app or the user asks for", async () => {
    const viewport = new StubViewport(820, false);
    mountApp(viewport, "?density=compact");
    expect(rootAttributes().density).toBe("compact");
    expect(shown()).toBe("tablet:fine:compact");
    cleanup();
    localStorage.setItem(DENSITY_STORAGE_KEY, "agent");
    mountApp(viewport);
    expect(rootAttributes().density).toBe("agent");
    expect(shown()).toBe("tablet:fine:agent");
  });

  it("switches density at runtime through setDensity", async () => {
    const viewport = new StubViewport(1440, false);
    function Toggle() {
      const { setDensity } = useDensity();
      return (
        <button type="button" onClick={() => setDensity("compact")}>
          Compact
        </button>
      );
    }
    render(
      <DensityProvider search="" header={null} screen={viewport.source()}>
        <Probe />
        <Toggle />
      </DensityProvider>,
    );
    expect(shown()).toBe("desktop:fine:comfortable");
    await act(async () => {
      screen.getByRole("button", { name: "Compact" }).click();
    });
    expect(shown()).toBe("desktop:fine:compact");
    expect(rootAttributes().density).toBe("compact");
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("compact");
  });

  it("reads the live screen without a provider", () => {
    render(<Probe />);
    expect(shown()).toBe("desktop:fine:comfortable");
  });
});

describe("sidecar screen fields", () => {
  it("carries screen, pointer and density and updates them on change", async () => {
    const viewport = new StubViewport(390, true);
    mountApp(viewport);
    expect(sidecar()).toMatchObject({
      page: "home",
      screen: "phone",
      pointer: "coarse",
      density: "comfortable",
    });
    await act(async () => {
      viewport.change(1700, false);
    });
    expect(sidecar()).toMatchObject({ screen: "wide", pointer: "fine", density: "comfortable" });
  });

  it("validates the three fields together", () => {
    const base = {
      version: 1,
      page: "home",
      params: {},
      state: "ready",
      actions: [],
      overlays: [],
      outcome: null,
    };
    const fitted = { ...base, screen: "tablet", pointer: "coarse", density: "compact" };
    expect(validateSidecar(fitted)).toEqual({ valid: true, payload: fitted });
    expect(validateSidecar(base).valid).toBe(true);
    const partial = validateSidecar({ ...base, screen: "phone" });
    expect(partial.valid).toBe(false);
    if (!partial.valid) {
      expect(partial.issues.map((issue) => issue.path)).toEqual(["pointer", "density"]);
    }
    expect(validateSidecar({ ...fitted, screen: "watch" }).valid).toBe(false);
    expect(validateSidecar({ ...fitted, density: "default" }).valid).toBe(false);
  });
});

describe("server seed and hydration", () => {
  const phone: ScreenState = { screen: "phone", pointer: "coarse", density: "comfortable" };

  function Seeded({ children }: { readonly children: ReactNode }) {
    return (
      <ScreenSeedContext.Provider value={phone}>
        <ScreenProvider density="comfortable">{children}</ScreenProvider>
      </ScreenSeedContext.Provider>
    );
  }

  it("renders the server seed and reads it back from the root attributes", () => {
    const html = renderToString(
      <Seeded>
        <Probe />
      </Seeded>,
    );
    expect(html).toContain("phone:coarse:comfortable");
    expect(screenAttributes(phone)).toEqual({
      "data-rex-screen": "phone",
      "data-rex-pointer": "coarse",
      "data-rex-density": "comfortable",
    });
    const element = document.createElement("html");
    for (const [name, value] of Object.entries(screenAttributes(phone))) {
      element.setAttribute(name, value);
    }
    expect(readRootScreen(element)).toEqual(phone);
    element.setAttribute(SCREEN_ATTRIBUTE, "watch");
    expect(readRootScreen(element)).toBeNull();
  });

  it("hydrates on the server's screen and then follows the live screen", async () => {
    const viewport = new StubViewport(1440, false);
    const source = viewport.source();
    const container = document.createElement("div");
    container.innerHTML = renderToString(
      <Seeded>
        <Probe />
      </Seeded>,
    );
    document.body.appendChild(container);
    for (const [name, value] of Object.entries(screenAttributes(phone))) {
      document.documentElement.setAttribute(name, value);
    }
    const errors: unknown[] = [];
    const hydrated: { root: Root | null } = { root: null };
    await act(async () => {
      hydrated.root = hydrateRoot(
        container,
        <ScreenProvider density="comfortable" source={source}>
          <Probe />
        </ScreenProvider>,
        { onRecoverableError: (error) => errors.push(error) },
      );
    });
    expect(errors).toEqual([]);
    expect(container.textContent).toBe("desktop:fine:comfortable");
    expect(rootAttributes()).toMatchObject({ screen: "desktop", pointer: "fine" });
    await act(async () => {
      hydrated.root?.unmount();
    });
    container.remove();
  });
});
