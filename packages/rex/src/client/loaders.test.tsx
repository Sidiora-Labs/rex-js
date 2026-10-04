import { ORPCError } from "@orpc/client";
import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeAll, describe, expect, expectTypeOf, it, vi } from "vitest";
import { action } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import { page, type AnyPage, type PageStatesModule } from "../core/page.ts";
import { always } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import type { StateProps } from "../core/states.ts";
import { text } from "../core/schema.ts";
import { z } from "zod/mini";
import { buildManifest } from "../manifest/build.ts";
import { createRexServer } from "../server/app.ts";
import { memoryLedger } from "../server/audit.ts";
import { RENDER_STATUS } from "../server/routes/render.ts";
import { createRexRenderer, registerPageRenderer } from "../server/ssr.ts";
import { readSidecar } from "./agent/sidecar.tsx";
import { startRexEntry, type RexEntryBundle, type StartedRex } from "./entry.tsx";
import { readRexData, type HydrationMismatch } from "./hydrate.ts";
import {
  LOADER_QUERY_SCOPE,
  RexLoaderError,
  isServerSeeded,
  loaderQueryKey,
  useLoader,
  useLoaders,
  type LoaderName,
  type LoaderOutput,
  type LoaderResults,
} from "./loaders.ts";
import { definePageModules, region, view, type PageModuleSet } from "./page.tsx";

interface Note {
  readonly id: string;
  readonly title: string;
}

const INITIAL_NOTES: readonly Note[] = [
  { id: "n1", title: "First note" },
  { id: "n2", title: "Second note" },
];

const notes: Note[] = [];
const calls = { listNotes: 0, readNote: 0, brokenFeed: 0, goneFeed: 0 };

function resetData(): void {
  notes.splice(0, notes.length, ...INITIAL_NOTES);
  calls.listNotes = 0;
  calls.readNote = 0;
  calls.brokenFeed = 0;
  calls.goneFeed = 0;
}

const noteSchema = z.object({ id: text({ min: 1 }), title: text({ min: 1 }) });
const notesOutput = z.object({ items: z.array(noteSchema) });

const listNotes = action("list-notes", {
  input: z.object({}),
  output: notesOutput,
  policy: always(),
  effect: "read",
  label: "List notes",
  handler: () => {
    calls.listNotes += 1;
    return { items: notes.map((note) => ({ ...note })) };
  },
});

const readNote = action("read-note", {
  input: z.object({ id: text({ min: 1 }) }),
  output: noteSchema,
  policy: always(),
  effect: "read",
  label: "Read note",
  handler: (input) => {
    calls.readNote += 1;
    const found = notes.find((note) => note.id === input.id);
    if (found === undefined) throw new ORPCError("NOT_FOUND", { message: `no note ${input.id}` });
    return { ...found };
  },
});

const addNote = action("add-note", {
  input: z.object({ title: text({ min: 1, max: 120 }) }),
  output: noteSchema,
  policy: always(),
  effect: "reversible",
  label: "Add note",
  invalidates: ["list-notes"],
  handler: (input) => {
    const created = { id: `n${notes.length + 1}`, title: input.title };
    notes.push(created);
    return created;
  },
});

const brokenFeed = action("broken-feed", {
  input: z.object({}),
  output: notesOutput,
  policy: always(),
  effect: "read",
  label: "Broken feed",
  handler: () => {
    calls.brokenFeed += 1;
    throw new Error("the feed store is down");
  },
});

const goneFeed = action("gone-feed", {
  input: z.object({}),
  output: notesOutput,
  policy: always(),
  effect: "read",
  label: "Gone feed",
  handler: () => {
    calls.goneFeed += 1;
    throw new ORPCError("NOT_FOUND", { message: "the feed was removed" });
  },
});

const notesPage = page("notes", {
  route: "/notes",
  actions: [addNote],
  regions: ["main"],
  load: { notes: listNotes },
  chrome: { title: "Notes" },
});

const freshPage = page("fresh", {
  route: "/fresh",
  load: { notes: listNotes },
  cache: { staleTime: 60_000 },
  chrome: { title: "Fresh" },
});

const notePage = page("note", {
  route: "/notes/:id",
  params: z.object({ id: text({ min: 1 }) }),
  load: { note: { action: readNote, input: (params: Readonly<Record<string, unknown>>) => ({ id: String(params.id) }) } },
  chrome: { title: "Note" },
});

const brokenPage = page("broken", {
  route: "/broken",
  load: { feed: brokenFeed },
  chrome: { title: "Broken" },
});

const gonePage = page("gone", {
  route: "/gone",
  load: { feed: goneFeed },
  chrome: { title: "Gone" },
});

function statesFor(label: string): Readonly<Record<string, unknown>> {
  return {
    Loading: () => <p>{label} is loading</p>,
    Empty: () => <p>{label} is empty</p>,
    Stale: () => <p>{label} may be stale</p>,
    Partial: () => <p>{label} is partial</p>,
    Offline: () => <p>{label} is offline</p>,
    PermissionDenied: () => <p>You cannot open {label}</p>,
    RecoverableError: ({ error }: StateProps) => (
      <p>
        {label} failed: {error?.message}
      </p>
    ),
    TerminalError: ({ error }: StateProps) => (
      <p>
        {label} is unavailable: {error?.message}
      </p>
    ),
  };
}

function NoteList({ testId }: { readonly testId: string }) {
  const query = useLoader(notesPage, "notes");
  expectTypeOf(query.data).toEqualTypeOf<z.output<typeof notesOutput> | undefined>();
  return (
    <ul data-testid={testId}>
      {(query.data?.items ?? []).map((note) => (
        <li key={note.id}>{note.title}</li>
      ))}
    </ul>
  );
}

const NotesMain = region("main", ({ act: useAct }) => {
  const add = useAct(addNote);
  return (
    <button
      type="button"
      {...add.controlProps}
      onClick={() => {
        void add.run({ title: "Third note" });
      }}
    >
      Add note
    </button>
  );
});

const NotesView = view(() => (
  <>
    <NoteList testId="first-list" />
    <NoteList testId="second-list" />
    <NotesMain />
  </>
));

function FreshCount() {
  const all = useLoaders(freshPage);
  expectTypeOf(all).toEqualTypeOf<LoaderResults<typeof freshPage>>();
  return <p data-testid="fresh-count">{all.notes.data?.items.length ?? 0} fresh notes</p>;
}

const FreshView = view(() => <FreshCount />);

function NoteTitle() {
  const query = useLoader(notePage, "note");
  expectTypeOf(query.data).toEqualTypeOf<z.output<typeof noteSchema> | undefined>();
  return <h2 data-testid="note-title">{query.data?.title}</h2>;
}

const NoteView = view(() => <NoteTitle />);

function BrokenFeedLength() {
  const query = useLoader(brokenPage, "feed");
  return <p>{query.data?.items.length ?? 0} feed items</p>;
}

function GoneFeedLength() {
  const query = useLoader(gonePage, "feed");
  return <p>{query.data?.items.length ?? 0} feed items</p>;
}

const BrokenView = view(() => <BrokenFeedLength />);
const GoneView = view(() => <GoneFeedLength />);

const registry = createRegistry()
  .register(
    listNotes,
    readNote,
    addNote,
    brokenFeed,
    goneFeed,
    notesPage,
    freshPage,
    notePage,
    brokenPage,
    gonePage,
  )
  .freeze();
const manifest = buildManifest(registry, { app: "loaders-fixture" });

function eager(
  declared: AnyPage,
  label: string,
  pageView: ComponentType,
  regions: Readonly<Record<string, ComponentType>> = {},
): PageModuleSet {
  return definePageModules({
    page: declared,
    view: pageView,
    states: statesFor(label) as PageStatesModule<AnyPage>,
    regions,
    overlays: {},
  });
}

const bundle: RexEntryBundle = {
  registry,
  manifest,
  pages: [
    eager(notesPage, "Notes", NotesView, { main: NotesMain }),
    eager(freshPage, "Fresh", FreshView),
    eager(notePage, "Note", NoteView),
    eager(brokenPage, "Broken feed", BrokenView),
    eager(gonePage, "Gone feed", GoneView),
  ],
};

const owner = actor({ id: "owner", roles: ["owner"] });
const server = createRexServer({
  registry,
  ledger: memoryLedger(),
  actor: () => owner,
  app: "loaders-fixture",
});

const rpcCalls: string[] = [];

function serverFetch(input: Request | string | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const path = new URL(request.url).pathname;
  if (path.startsWith("/rex/rpc/")) rpcCalls.push(path.slice("/rex/rpc/".length));
  if (request.method !== "GET" && !request.headers.has("origin")) {
    request.headers.set("origin", new URL(request.url).origin);
  }
  return Promise.resolve(server.fetch(request));
}

beforeAll(() => {
  registerPageRenderer(registry, createRexRenderer({ bundle }));
});

const started: StartedRex[] = [];

afterEach(async () => {
  for (const entry of started.splice(0)) {
    await act(async () => {
      entry.root.unmount();
    });
  }
  cleanup();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
  rpcCalls.length = 0;
  vi.restoreAllMocks();
});

resetData();

function quietClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

async function mount(path: string, queryClient: QueryClient): Promise<HTMLElement> {
  window.history.replaceState(null, "", path);
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    started.push(startRexEntry(container, bundle, { actor: owner, fetch: serverFetch, queryClient }));
  });
  return container;
}

async function unmountAll(): Promise<void> {
  for (const entry of started.splice(0)) {
    await act(async () => {
      entry.root.unmount();
    });
  }
  document.body.innerHTML = "";
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

function request(path: string): Request {
  return new Request(new URL(path, window.location.origin), { headers: { accept: "text/html" } });
}

function mountDocument(html: string, path: string): HTMLElement {
  window.history.replaceState(null, "", path);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  const container = document.getElementById("root");
  if (container === null) throw new Error("the document has no root element");
  return container;
}

async function hydrateDocument(
  container: HTMLElement,
  queryClient: QueryClient,
  mismatches: HydrationMismatch[],
): Promise<StartedRex> {
  let result: StartedRex | null = null;
  await act(async () => {
    result = startRexEntry(container, bundle, {
      dev: true,
      fetch: serverFetch,
      queryClient,
      onHydrationMismatch: (mismatch) => {
        mismatches.push(mismatch);
      },
    });
  });
  if (result === null) throw new Error("startRexEntry returned nothing");
  started.push(result);
  return result;
}

function hydrationErrors(calls: readonly unknown[][]): string[] {
  return calls
    .map((args) => args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(" "))
    .filter((message) => /hydrat|did not match|REX310/i.test(message));
}

describe("page loaders", () => {
  it("types useLoader and useLoaders from the page load map and maps params through the input", async () => {
    resetData();
    expectTypeOf<LoaderName<typeof notesPage>>().toEqualTypeOf<"notes">();
    expectTypeOf<LoaderOutput<(typeof notesPage)["load"]["notes"]>>().toEqualTypeOf<
      z.output<typeof notesOutput>
    >();
    expectTypeOf<LoaderOutput<(typeof notePage)["load"]["note"]>>().toEqualTypeOf<
      z.output<typeof noteSchema>
    >();
    expect(manifest.pages.find((entry) => entry.id === "note")?.loaders).toEqual([
      { name: "note", action: "read-note", input: "mapped" },
    ]);

    const queryClient = quietClient();
    const container = await mount("/notes/n2", queryClient);
    await waitFor(() =>
      expect(container.querySelector('[data-testid="note-title"]')?.textContent).toBe("Second note"),
    );
    const key = loaderQueryKey("note", "note", { id: "n2" });
    expect(key[0]).toBe(LOADER_QUERY_SCOPE);
    expect(queryClient.getQueryData(key)).toEqual({ id: "n2", title: "Second note" });
    expect(calls.readNote).toBe(1);
  });

  it("dedupes concurrent consumers of one loader to a single request", async () => {
    resetData();
    const container = await mount("/notes", quietClient());
    await waitFor(() => {
      expect(container.querySelector('[data-testid="first-list"]')?.textContent).toBe(
        "First noteSecond note",
      );
      expect(container.querySelector('[data-testid="second-list"]')?.textContent).toBe(
        "First noteSecond note",
      );
    });
    await settle();
    expect(calls.listNotes).toBe(1);
    expect(rpcCalls.filter((name) => name === "list-notes")).toHaveLength(1);
  });

  it("honours cache.staleTime: a fresh page reuses its data on remount while a default page refetches", async () => {
    resetData();
    const queryClient = quietClient();
    let container = await mount("/fresh", queryClient);
    await waitFor(() =>
      expect(container.querySelector('[data-testid="fresh-count"]')?.textContent).toBe("2 fresh notes"),
    );
    expect(calls.listNotes).toBe(1);
    await unmountAll();
    container = await mount("/fresh", queryClient);
    expect(container.querySelector('[data-testid="fresh-count"]')?.textContent).toBe("2 fresh notes");
    await settle();
    expect(calls.listNotes).toBe(1);
    await unmountAll();

    container = await mount("/notes", queryClient);
    await waitFor(() =>
      expect(container.querySelector('[data-testid="first-list"]')?.textContent).toBe(
        "First noteSecond note",
      ),
    );
    expect(calls.listNotes).toBe(2);
    await unmountAll();
    container = await mount("/notes", queryClient);
    await waitFor(() => expect(calls.listNotes).toBe(3));
    expect(container.querySelector('[data-testid="first-list"]')?.textContent).toBe(
      "First noteSecond note",
    );
  });

  it("refetches the affected loaders after a mutating action that declares invalidates", async () => {
    resetData();
    const container = await mount("/notes", quietClient());
    await waitFor(() =>
      expect(container.querySelector('[data-testid="first-list"]')?.textContent).toBe(
        "First noteSecond note",
      ),
    );
    expect(calls.listNotes).toBe(1);
    const button = container.querySelector('[data-rex-region="notes/main"] button');
    expect(button).not.toBeNull();
    await act(async () => {
      (button as HTMLButtonElement).click();
    });
    await waitFor(() =>
      expect(container.querySelector('[data-testid="first-list"]')?.textContent).toBe(
        "First noteSecond noteThird note",
      ),
    );
    expect(container.querySelector('[data-testid="second-list"]')?.textContent).toBe(
      "First noteSecond noteThird note",
    );
    expect(calls.listNotes).toBe(2);
    expect(rpcCalls).toEqual(["list-notes", "add-note", "list-notes"]);
  });

  it("runs loaders in process during SSR, dehydrates them and hydrates the client without a request", async () => {
    resetData();
    const response = await server.fetch(request("/notes"));
    expect(response.status).toBe(RENDER_STATUS.page);
    const html = await response.text();
    expect(calls.listNotes).toBe(1);
    expect(rpcCalls).toEqual([]);

    const container = mountDocument(html, "/notes");
    const data = readRexData(document);
    expect(data?.page).toBe("notes");
    const key = loaderQueryKey("notes", "notes", {});
    expect(data?.queries.queries).toHaveLength(1);
    expect(data?.queries.queries[0]?.queryKey).toEqual(key);
    expect(data?.queries.queries[0]?.state.data).toEqual({ items: INITIAL_NOTES });
    expect(container.querySelector('[data-testid="first-list"]')?.textContent).toBe(
      "First noteSecond note",
    );
    expect(readSidecar(container)).toMatchObject({ page: "notes", state: "ready" });

    const errors = vi.spyOn(console, "error");
    const mismatches: HydrationMismatch[] = [];
    const queryClient = quietClient();
    const serverList = container.querySelector('[data-testid="first-list"]');
    const result = await hydrateDocument(container, queryClient, mismatches);
    expect(result.mode).toBe("hydrate");
    expect(container.querySelector('[data-testid="first-list"]')).toBe(serverList);
    expect(container.querySelector('[data-testid="second-list"]')?.textContent).toBe(
      "First noteSecond note",
    );
    const query = queryClient.getQueryCache().find({ queryKey: key, exact: true });
    expect(query).toBeDefined();
    expect(isServerSeeded(query as NonNullable<typeof query>)).toBe(true);
    await settle();
    expect(rpcCalls).toEqual([]);
    expect(calls.listNotes).toBe(1);
    expect(mismatches).toEqual([]);
    expect(hydrationErrors(errors.mock.calls)).toEqual([]);
  });

  it("maps a failing loader to the recoverable-error state on the server, in the sidecar and after hydration", async () => {
    resetData();
    const response = await server.fetch(request("/broken"));
    expect(response.status).toBe(RENDER_STATUS.failed);
    expect(response.headers.get("x-rex-page")).toBe("broken");
    const html = await response.text();
    expect(calls.brokenFeed).toBe(1);
    expect(html).not.toContain("the feed store is down");

    const container = mountDocument(html, "/broken");
    expect(container.hasAttribute("data-rex-ssr")).toBe(true);
    expect(container.textContent).toContain("Broken feed failed: Internal server error");
    expect(readSidecar(container)).toMatchObject({ page: "broken", state: "recoverable-error" });
    const data = readRexData(document);
    expect(data?.queries.queries[0]?.state.status).toBe("error");

    const errors = vi.spyOn(console, "error");
    const mismatches: HydrationMismatch[] = [];
    const queryClient = quietClient();
    await hydrateDocument(container, queryClient, mismatches);
    await settle();
    expect(container.textContent).toContain("Broken feed failed: Internal server error");
    expect(readSidecar(container)).toMatchObject({ page: "broken", state: "recoverable-error" });
    const error = queryClient.getQueryState(loaderQueryKey("broken", "feed", {}))?.error;
    expect(error).toBeInstanceOf(RexLoaderError);
    expect(error).toMatchObject({ page: "broken", loader: "feed", status: 500 });
    expect(calls.brokenFeed).toBe(1);
    expect(mismatches).toEqual([]);
    expect(hydrationErrors(errors.mock.calls)).toEqual([]);
  });

  it("maps a client-side loader failure with a terminal status to the terminal-error state", async () => {
    resetData();
    const container = await mount("/gone", quietClient());
    await waitFor(() =>
      expect(container.textContent).toContain("Gone feed is unavailable: the feed was removed"),
    );
    expect(readSidecar(container)).toMatchObject({ page: "gone", state: "terminal-error" });
    expect(calls.goneFeed).toBe(1);
  });
});
