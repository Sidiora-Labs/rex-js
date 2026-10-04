import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { actor, type Actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { never } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { buildManifest } from "../manifest/build.ts";
import { createRexApp } from "./app.tsx";
import basicPage, { greet } from "./fixtures/page-basic/page.ts";
import MainRegion from "./fixtures/page-basic/regions/main/region.tsx";
import * as basicStates from "./fixtures/page-basic/states.tsx";
import BasicView from "./fixtures/page-basic/view.tsx";
import {
  definePageModules,
  PageHost,
  region,
  RexPageModuleError,
  isLazyPageModules,
  view,
  type LazyPageModuleSet,
  type LoadedPageModules,
  type PageModuleSet,
} from "./page.tsx";
import { NotFound, RexRoutes } from "./router.tsx";

const basicModules = definePageModules({
  page: basicPage,
  view: BasicView,
  states: basicStates,
  regions: { main: MainRegion },
});

const lite = page("lite", { route: "/lite", policy: never(), states: ["ready", "loading"] });
const liteModules = definePageModules({
  page: lite,
  view: view(() => <p>lite ready</p>),
  states: { Loading: () => <p>lite loading</p> },
});

const Stray = region("stray", () => <p>stray</p>);
const strayPage = page("stray-host", { route: "/stray", regions: ["main"] });
const strayModules = definePageModules({
  page: strayPage,
  view: view(() => <Stray />),
  states: basicStates,
  regions: { main: MainRegion },
});

interface Deferred {
  readonly promise: Promise<LoadedPageModules>;
  resolve(modules: LoadedPageModules): void;
  reject(error: Error): void;
}

function deferred(): Deferred {
  let resolve: (modules: LoadedPageModules) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<LoadedPageModules>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const slow = page("slow", { route: "/slow", states: ["ready", "loading"] });
let slowLoad = deferred();
let slowLoads = 0;
const slowModules: LazyPageModuleSet = {
  page: slow,
  chunk: "page-slow",
  load: () => {
    slowLoads += 1;
    return slowLoad.promise;
  },
};

const modulesById: Record<string, PageModuleSet> = {
  basic: basicModules,
  lite: liteModules,
  "stray-host": strayModules,
  slow: slowModules,
};

const registry = createRegistry().register(greet, basicPage, lite, strayPage, slow).freeze();
const manifest = buildManifest(registry);
const viewer = actor({ id: "viewer", permissions: ["view"] });
const stranger = actor({ id: "stranger" });

class StatusError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Responder = () => unknown;

interface MountOptions {
  readonly greeting?: Responder;
  readonly badges?: Responder;
  readonly subject?: Actor;
  readonly seed?: (client: QueryClient) => void;
  readonly staleTime?: number;
}

function mount(path: string, options: MountOptions = {}) {
  const responders: Record<string, Responder> = {
    greeting: options.greeting ?? (() => "Hello"),
    badges: options.badges ?? (() => ["gold"]),
  };
  const calls: string[] = [];
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: options.staleTime ?? Number.POSITIVE_INFINITY,
        queryFn: async ({ queryKey }) => {
          const name = String(queryKey[0]);
          calls.push(name);
          const responder = responders[name];
          if (responder === undefined) throw new Error(`no responder for ${name}`);
          return responder();
        },
      },
    },
  });
  options.seed?.(queryClient);
  const RexApp = createRexApp({
    registry,
    manifest,
    actor: options.subject ?? viewer,
    baseUrl: "http://rex.test",
    queryClient,
  });
  const memory = memoryLocation({ path });
  render(
    <RexApp>
      <Router hook={memory.hook}>
        <RexRoutes
          render={(resolution) =>
            resolution.kind === "page" ? (
              <PageHost modules={modulesById[resolution.page.id] as PageModuleSet} />
            ) : (
              <NotFound path={resolution.path} />
            )
          }
        />
      </Router>
    </RexApp>,
  );
  return { calls };
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
  Reflect.deleteProperty(navigator, "onLine");
});

describe("PageHost", () => {
  it("renders the view with its region landmark when the page is ready", async () => {
    mount("/basic/ada");
    await waitFor(() => expect(screen.getByText("Hello ada")).toBeTruthy());
    const root = document.querySelector("[data-rex-page]");
    expect(root?.tagName).toBe("MAIN");
    expect(root?.getAttribute("data-rex-page")).toBe("basic");
    const landmark = screen.getByRole("region", { name: "Main" });
    expect(landmark.tagName).toBe("SECTION");
    expect(landmark.getAttribute("data-rex-region")).toBe("basic/main");
    expect(screen.getByText("Badges: gold")).toBeTruthy();
    expect(screen.getByText("State: ready")).toBeTruthy();
  });

  it("gives regions act, nav, params and state through the render context", async () => {
    mount("/basic/ada");
    const button = await screen.findByRole("button", { name: "Greet" });
    expect(button.getAttribute("data-rex")).toBe("basic/greet");
    expect(button.getAttribute("data-rex-allowed")).toBe("false");
    expect(button.getAttribute("title")).toBe("Not allowed: never");
  });

  it("renders the Loading export while the first fetch is in flight", async () => {
    mount("/basic/ada", { greeting: () => new Promise(() => {}) });
    await waitFor(() => expect(screen.getByText("Loading greeting for ada")).toBeTruthy());
    expect(document.querySelector("[data-rex-region]")).toBeNull();
    expect(document.querySelector("[data-rex-page]")?.getAttribute("data-rex-page")).toBe("basic");
  });

  it("renders the Empty export when the queries return no content", async () => {
    mount("/basic/ada", { greeting: () => null, badges: () => [] });
    await waitFor(() => expect(screen.getByText("No greeting yet")).toBeTruthy());
  });

  it("renders the Partial export when a query has not produced data", async () => {
    const { calls } = mount("/basic/ada?badges=false");
    await waitFor(() => expect(screen.getByText("Badges are unavailable")).toBeTruthy());
    expect(calls).toEqual(["greeting"]);
  });

  it("renders the Stale export when a refetch fails over cached data", async () => {
    mount("/basic/ada", {
      greeting: () => Promise.reject(new StatusError("down", 503)),
      staleTime: 0,
      seed: (client) => {
        client.setQueryData(["greeting", "ada"], "Hello");
        client.setQueryData(["badges", "ada"], ["gold"]);
      },
    });
    await waitFor(() => expect(screen.getByText("Greeting may be out of date")).toBeTruthy());
  });

  it("renders the RecoverableError export and retries into the view", async () => {
    let attempts = 0;
    mount("/basic/ada", {
      greeting: () => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new StatusError("down", 503)) : "Hello";
      },
    });
    await waitFor(() => expect(screen.getByText("Greeting failed: down")).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });
    await waitFor(() => expect(screen.getByText("Hello ada")).toBeTruthy());
    expect(attempts).toBe(2);
  });

  it("renders the TerminalError export for a client error", async () => {
    mount("/basic/ada", { greeting: () => Promise.reject(new StatusError("not found", 404)) });
    await waitFor(() => expect(screen.getByText("Greeting unavailable: not found")).toBeTruthy());
  });

  it("renders the TerminalError export for params that fail the schema", async () => {
    mount("/basic/ada?badges=maybe");
    await waitFor(() =>
      expect(screen.getByText(/^Greeting unavailable: invalid params: badges /)).toBeTruthy(),
    );
  });

  it("renders the PermissionDenied export without running the page queries", async () => {
    const { calls } = mount("/basic/ada", { subject: stranger });
    expect(screen.getByText("You cannot view greetings")).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it("renders the Offline export when the browser is offline", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    mount("/basic/ada");
    expect(screen.getByText("Offline")).toBeTruthy();
  });

  it("falls back to a text state for a state the page does not declare", () => {
    mount("/lite", { subject: viewer });
    const fallback = document.querySelector("[data-rex-default-state]");
    expect(fallback?.getAttribute("data-rex-default-state")).toBe("permission-denied");
    expect(fallback?.textContent).toBe("You do not have access to this page");
  });

  it("refuses a region the active page does not declare", () => {
    silenced(() => {
      expect(() => mount("/stray")).toThrow('region "stray" is not declared by page "stray-host"');
    });
  });
});

describe("page modules", () => {
  it("validates the module set against the page declaration", () => {
    const { Loading: _loading, ...withoutLoading } = basicStates;
    expect(() =>
      definePageModules({
        page: basicPage,
        view: BasicView,
        states: withoutLoading as unknown as typeof basicStates,
        regions: { main: MainRegion },
      }),
    ).toThrow(new RexPageModuleError("basic", "states.tsx must export Loading"));
    expect(() =>
      definePageModules({ page: basicPage, view: BasicView, states: basicStates, regions: {} }),
    ).toThrow('page "basic" modules: missing regions main');
    expect(() =>
      definePageModules({
        page: basicPage,
        view: BasicView,
        states: basicStates,
        regions: { main: MainRegion, side: MainRegion },
      }),
    ).toThrow('page "basic" modules: undeclared regions side');
  });

  it("validates region names and keeps regions out of the view's props", () => {
    expect(() => region("Bad Name", () => null)).toThrow("invalid region name");
    expect(MainRegion.rexKind).toBe("region");
    expect(MainRegion.regionName).toBe("main");
    expect(BasicView.rexKind).toBe("view");
    silenced(() => {
      expect(() => render(<MainRegion />)).toThrow("must render inside a PageHost");
    });
  });
});

describe("lazy page modules", () => {
  it("shows the loading state under Suspense until the page chunk loads, then the view", async () => {
    slowLoad = deferred();
    slowLoads = 0;
    expect(isLazyPageModules(slowModules)).toBe(true);
    expect(isLazyPageModules(basicModules)).toBe(false);
    mount("/slow");
    const loading = document.querySelector("[data-rex-page-loading]");
    expect(loading?.getAttribute("data-rex-page")).toBe("slow");
    expect(
      loading?.querySelector("[data-rex-default-state]")?.getAttribute("data-rex-default-state"),
    ).toBe("loading");
    expect(screen.getByRole("status").textContent).toBe("Loading");
    expect(screen.queryByText("slow ready")).toBeNull();
    await act(async () => {
      slowLoad.resolve({
        view: view(() => <p>slow ready</p>),
        states: { Loading: () => <p>slow loading</p> },
      });
      await slowLoad.promise;
    });
    await waitFor(() => expect(screen.getByText("slow ready")).toBeTruthy());
    expect(document.querySelector("[data-rex-page-loading]")).toBeNull();
    expect(document.querySelector('main[data-rex-page="slow"]')).not.toBeNull();
    expect(slowLoads).toBe(1);
  });
});
