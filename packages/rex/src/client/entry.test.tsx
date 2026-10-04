import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { action } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import { isRexError } from "../core/errors.ts";
import { page } from "../core/page.ts";
import { always } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { text } from "../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest } from "../manifest/build.ts";
import { memoryLedger } from "../server/audit.ts";
import { createRexContext } from "../server/context.ts";
import { createRexRenderer } from "../server/ssr.ts";
import { createTestApp, testServer } from "../testing/index.ts";
import { DENSITY_ATTRIBUTE } from "./agent/density.ts";
import { readSidecar } from "./agent/sidecar.tsx";
import type { RexFetch } from "./app.tsx";
import { useActor } from "./context.ts";
import {
  createRexEntry,
  findRootElement,
  startRexEntry,
  type RexEntryBundle,
  type StartRexOptions,
  type StartedRex,
} from "./entry.tsx";
import { RexDataError, SSR_ATTRIBUTE, type HydrationMismatch } from "./hydrate.ts";
import { registerI18n } from "./i18n/context.ts";
import { isServerSeeded, loaderQueryKey, useLoaders } from "./loaders.ts";
import { defaultOutcomeStore } from "./outcome.ts";
import { definePageModules, region, view, type PageModuleSet } from "./page.tsx";

const notes = action("notes", {
  input: z.object({}),
  output: z.object({ items: z.array(text()) }),
  policy: always(),
  effect: "read",
  handler: () => ({ items: ["First", "Second"] }),
});

const home = page("home", {
  route: "/",
  chrome: { title: "msg:home.title" },
  load: { notes },
  regions: ["main"],
  states: ["ready"],
});

const HomeMain = region("main", () => {
  const subject = useActor();
  const { notes: feed } = useLoaders(home);
  return (
    <p data-testid="main">
      {subject.id}: {feed.data?.items.join(", ") ?? "loading"}
    </p>
  );
});

const pages: readonly PageModuleSet[] = [
  definePageModules({
    page: home,
    view: view(() => <HomeMain />),
    states: {},
    regions: { main: HomeMain },
  }),
];

const registry = createRegistry().register(notes, home).freeze();
registerI18n(registry, {
  config: { locales: ["en"], default: "en" },
  messages: { en: { "home.title": "Welcome home" } },
});
const manifest = buildManifest(registry);
const bundle: RexEntryBundle = { registry, manifest, pages };
const owner = actor({ id: "owner" });
const app = createTestApp(bundle, { actor: owner });
const server = testServer(app);
const requests: string[] = [];
const fetch: RexFetch = (input, init) => {
  requests.push(new URL(input instanceof Request ? input.url : String(input)).pathname);
  return server.fetch(input, init);
};

const started: StartedRex[] = [];

function quietClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function rpcCalls(): string[] {
  return requests.filter((path) => path.startsWith("/rex/rpc/"));
}

async function start(container: Element, options: StartRexOptions): Promise<StartedRex> {
  const results: StartedRex[] = [];
  await act(async () => {
    results.push(startRexEntry(container, bundle, options));
  });
  const result = results[0];
  if (result === undefined) throw new Error("startRexEntry returned nothing");
  started.push(result);
  return result;
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

async function renderDocument(path: string): Promise<string> {
  const renderer = createRexRenderer({ bundle, ledger: memoryLedger() });
  const request = new Request(new URL(path, app.baseUrl), { headers: { accept: "text/html" } });
  const result = await renderer.render(request, await createRexContext(request, () => owner));
  expect(result.kind).toBe("page");
  return new Response(result.body).text();
}

function mountDocument(html: string, path: string): HTMLElement {
  window.history.replaceState(null, "", path);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.documentElement.lang = parsed.documentElement.lang;
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  return findRootElement("root") as HTMLElement;
}

function hydrationErrors(calls: readonly unknown[][]): string[] {
  return calls
    .map((args) => args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(" "))
    .filter((message) => /hydrat|did not match|REX310/i.test(message));
}

function thrownBy(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return null;
}

afterEach(async () => {
  for (const entry of started.splice(0)) {
    await act(async () => {
      entry.root.unmount();
    });
  }
  cleanup();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("lang");
  window.history.replaceState(null, "", "/");
  for (const key of ["home", "app"]) defaultOutcomeStore.clear(key);
  requests.length = 0;
  vi.restoreAllMocks();
});

describe("createRexEntry", () => {
  it("requires the rex:app bundle and names the entry component", () => {
    expect(() => createRexEntry(null as never)).toThrow(
      /rex:app bundle with registry and pages is required/,
    );
    const error = thrownBy(() => createRexEntry({ registry } as never));
    expect(isRexError(error) && error.code).toBe("REX313");
    const RexEntry = createRexEntry(bundle, { actor: owner, fetch, baseUrl: app.baseUrl });
    expect(RexEntry.displayName).toBe("RexEntry");
  });

  it("composes the app, the providers, density and the agent shell around the pages", async () => {
    const memory = memoryLocation({ path: "/", record: true });
    const RexEntry = createRexEntry(bundle, {
      actor: owner,
      fetch,
      baseUrl: app.baseUrl,
      queryClient: quietClient(),
    });
    const { container } = render(
      <Router hook={memory.hook}>
        <RexEntry />
      </Router>,
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Welcome home"),
    );
    expect(container.querySelector("[data-rex-shell]")).not.toBeNull();
    expect(document.documentElement.getAttribute(DENSITY_ATTRIBUTE)).toBe("comfortable");
    expect(screen.getByRole("status", { name: "Outcome" })).toBeDefined();
    await waitFor(() =>
      expect(screen.getByTestId("main").textContent).toBe("owner: First, Second"),
    );
    expect(readSidecar(container)).toMatchObject({ page: "home", state: "ready" });
    expect(rpcCalls()).toEqual(["/rex/rpc/notes"]);
  });
});

describe("findRootElement", () => {
  it("finds the root by id in the given document and reports a missing one as REX463", () => {
    document.body.innerHTML = '<div id="root"></div>';
    expect(findRootElement("root").id).toBe("root");
    const parsed = new DOMParser().parseFromString('<main id="app"></main>', "text/html");
    expect(findRootElement("app", parsed).tagName).toBe("MAIN");
    expect(() => findRootElement("app")).toThrow(
      'rex: index.html has no element with id "app"',
    );
    const error = thrownBy(() => findRootElement("missing", parsed));
    expect(isRexError(error) && error.code).toBe("REX463");
  });
});

describe("startRexEntry", () => {
  it("renders a fresh root into a container that was not server-rendered", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const result = await start(container, {
      actor: owner,
      fetch,
      baseUrl: app.baseUrl,
      queryClient: quietClient(),
    });
    expect(result.mode).toBe("render");
    expect(typeof result.root.unmount).toBe("function");
    await waitFor(() =>
      expect(container.querySelector('[data-testid="main"]')?.textContent).toBe(
        "owner: First, Second",
      ),
    );
    expect(container.querySelector("h1")?.textContent).toBe("Welcome home");
    expect(rpcCalls()).toEqual(["/rex/rpc/notes"]);
  });

  it("hydrates a server-rendered document from its rex data without refetching or mismatches", async () => {
    const html = await renderDocument("/");
    expect(html).toContain(`<div id="root" ${SSR_ATTRIBUTE}="">`);
    expect(html).toContain("<title>Welcome home</title>");
    const container = mountDocument(html, "/");
    expect(container.textContent).toContain("owner: First, Second");
    const serverMain = container.querySelector('[data-testid="main"]');
    const errors = vi.spyOn(console, "error");
    const mismatches: HydrationMismatch[] = [];
    const queryClient = quietClient();
    const result = await start(container, {
      dev: true,
      fetch,
      baseUrl: app.baseUrl,
      queryClient,
      onHydrationMismatch: (mismatch) => {
        mismatches.push(mismatch);
      },
    });
    expect(result.mode).toBe("hydrate");
    expect(container.querySelector('[data-testid="main"]')).toBe(serverMain);
    expect(serverMain?.textContent).toBe("owner: First, Second");
    const query = queryClient
      .getQueryCache()
      .find({ queryKey: loaderQueryKey("home", "notes", {}), exact: true });
    expect(query?.state.data).toEqual({ items: ["First", "Second"] });
    expect(query !== undefined && isServerSeeded(query)).toBe(true);
    await settle();
    expect(rpcCalls()).toEqual([]);
    expect(mismatches).toEqual([]);
    expect(hydrationErrors(errors.mock.calls)).toEqual([]);
    expect(readSidecar(container)).toMatchObject({ page: "home", state: "ready" });
  });

  it("refuses to hydrate a server-rendered root that has no rex data script", () => {
    document.body.innerHTML = `<div id="root" ${SSR_ATTRIBUTE}=""></div>`;
    const container = findRootElement("root");
    const error = thrownBy(() => startRexEntry(container, bundle, { fetch, baseUrl: app.baseUrl }));
    expect(error).toBeInstanceOf(RexDataError);
    expect(error).toMatchObject({
      code: "REX312",
      detail: `rex data: the server-rendered root has no ${SSR_ATTRIBUTE === "data-rex-ssr" ? "application/rex+data" : ""} script to hydrate from`,
    });
  });

  it("reports a markup mismatch in dev mode and recovers by rendering on the client", async () => {
    const html = await renderDocument("/");
    expect(html).toContain("First, Second");
    const container = mountDocument(html.replace("First, Second", "stale text"), "/");
    expect(container.textContent).toContain("owner: stale text");
    const mismatches: HydrationMismatch[] = [];
    await start(container, {
      dev: true,
      fetch,
      baseUrl: app.baseUrl,
      queryClient: quietClient(),
      onHydrationMismatch: (mismatch) => {
        mismatches.push(mismatch);
      },
    });
    await settle();
    await waitFor(() =>
      expect(container.querySelector('[data-testid="main"]')?.textContent).toBe(
        "owner: First, Second",
      ),
    );
    expect(mismatches.length).toBeGreaterThan(0);
    expect(mismatches.every((mismatch) => mismatch.code === "REX310")).toBe(true);
    expect(mismatches[0]?.message).toMatch(/hydrat/i);
    expect(mismatches[0]?.error).toBeInstanceOf(Error);
  });
});
