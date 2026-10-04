import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { createRegistry } from "../core/registry.ts";
import { buildManifest } from "../manifest/build.ts";
import { STATIC_HOST_ENV_KEY } from "../vite/entry-module.ts";
import { createRexApp } from "./app.tsx";
import { useNav } from "./nav.ts";
import {
  RexRoutes,
  type NavigateEventLike,
  type NavigationDestinationLike,
  type NavigationInterceptOptions,
  type NavigationType,
  type RouteResolution,
} from "./router.tsx";

const home = page("home", { route: "/", chrome: { title: "Home" } });
const guide = page("guide", { route: "/guide", chrome: { title: "Guide", back: "home" } });

const registry = createRegistry().register(home, guide).freeze();
const manifest = buildManifest(registry);
const reader = actor({ id: "reader" });

function Screen({ resolution }: { readonly resolution: RouteResolution }) {
  const nav = useNav();
  if (resolution.kind === "not-found") return <p data-testid="page">not-found</p>;
  return (
    <div>
      <p data-testid="page">{resolution.page.id}</p>
      <button type="button" onClick={() => nav.to(guide)}>
        open guide
      </button>
    </div>
  );
}

function mount(path: string, base = "") {
  const memory = memoryLocation({ path, record: true });
  const RexApp = createRexApp({ registry, manifest, actor: reader, baseUrl: "http://rex.test" });
  render(
    <RexApp>
      <Router base={base} hook={memory.hook}>
        <RexRoutes render={(resolution) => <Screen resolution={resolution} />} />
      </Router>
    </RexApp>,
  );
  return memory;
}

class RecordedNavigateEvent extends Event implements NavigateEventLike {
  readonly navigationType: NavigationType = "push";
  readonly canIntercept = true;
  readonly hashChange = false;
  readonly downloadRequest = null;
  readonly formData = null;
  readonly destination: NavigationDestinationLike;
  readonly intercepts: NavigationInterceptOptions[] = [];

  constructor(url: string) {
    super("navigate", { cancelable: true });
    this.destination = { url, sameDocument: false };
  }

  intercept(options: NavigationInterceptOptions = {}): void {
    this.intercepts.push(options);
  }
}

function installNavigation(): EventTarget {
  const navigation = new EventTarget();
  Object.defineProperty(globalThis, "navigation", {
    configurable: true,
    writable: true,
    value: navigation,
  });
  return navigation;
}

async function documentAt(href: string): Promise<void> {
  await vi.waitFor(() => expect(`${window.location.pathname}${window.location.search}`).toBe(href));
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  Reflect.deleteProperty(globalThis, "navigation");
  window.history.replaceState(null, "", "/");
});

describe("route changes in a static build", () => {
  it("routes a route change through the router outside a static build", async () => {
    window.history.replaceState(null, "", "/start");
    const memory = mount("/");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "open guide" }));
    });
    expect(memory.history).toEqual(["/", "/guide"]);
    expect(screen.getByTestId("page").textContent).toBe("guide");
    expect(window.location.pathname).toBe("/start");
  });

  it("loads the target as a document at the router base instead of a router transition", async () => {
    vi.stubEnv(STATIC_HOST_ENV_KEY, "true");
    window.history.replaceState(null, "", "/start");
    const memory = mount("/docs", "/docs");
    expect(screen.getByTestId("page").textContent).toBe("home");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "open guide" }));
    });
    await documentAt("/docs/guide");
    expect(memory.history).toEqual(["/docs"]);
    expect(screen.getByTestId("page").textContent).toBe("home");
  });

  it("intercepts a same-origin navigate event outside a static build", async () => {
    const navigation = installNavigation();
    const memory = mount("/");
    const event = new RecordedNavigateEvent(`${location.origin}/guide`);
    await act(async () => {
      navigation.dispatchEvent(event);
      for (const options of event.intercepts) await options.handler?.();
    });
    expect(event.intercepts).toHaveLength(1);
    expect(memory.history.at(-1)).toBe("/guide");
  });

  it("leaves same-origin navigate events to the browser in a static build", async () => {
    vi.stubEnv(STATIC_HOST_ENV_KEY, "true");
    const navigation = installNavigation();
    const memory = mount("/");
    const event = new RecordedNavigateEvent(`${location.origin}/guide`);
    await act(async () => {
      navigation.dispatchEvent(event);
    });
    expect(event.intercepts).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
    expect(memory.history).toEqual(["/"]);
    expect(screen.getByTestId("page").textContent).toBe("home");
  });
});
