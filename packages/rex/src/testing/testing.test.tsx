import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DENSITY_ATTRIBUTE } from "../client/agent/density.ts";
import { decodeActorHeader } from "../client/app.tsx";
import { registerReset } from "../client/reset.ts";
import { REX_ACTOR_HEADER } from "../core/protocol.ts";
import { isLazyPageModules, type PageModuleSet } from "../client/page.tsx";
import { memoryLedger } from "../server/audit.ts";
import { notesApp } from "./fixtures/app.ts";
import { SEED_NOTES, listRecords } from "./fixtures/data.ts";
import {
  DEFAULT_PAGE_TIMEOUT,
  RexTestingError,
  createTestApp,
  readSidecar,
  renderPage,
  renderRegion,
  setupRexTesting,
  testOrigin,
  testServer,
  type RexRenderResult,
} from "./index.ts";

setupRexTesting({ afterEach });

const writer = { id: "writer", permissions: ["notes.read", "notes.write"] };
const reader = { id: "reader", permissions: ["notes.read"] };

const SLOW_PAGE_DELAY = 1_200;

function slowNoteApp(): typeof notesApp {
  const pages = notesApp.pages.map((modules): PageModuleSet => {
    if (modules.page.id !== "note" || !isLazyPageModules(modules)) return modules;
    return {
      ...modules,
      load: async () => {
        await new Promise((resolve) => setTimeout(resolve, SLOW_PAGE_DELAY));
        return modules.load();
      },
    };
  });
  return Object.freeze({ ...notesApp, pages });
}

function noteTitles(view: RexRenderResult): string[] {
  return [...view.container.querySelectorAll("[data-note]")].map((item) => item.textContent ?? "");
}

async function addThroughUi(view: RexRenderResult, title: string): Promise<void> {
  const input = within(view.container).getByLabelText("Title");
  await act(async () => {
    fireEvent.change(input, { target: { value: title } });
  });
  const button = view.container.querySelector('[data-rex="notes/add-note"]');
  expect(button).not.toBeNull();
  await act(async () => {
    fireEvent.click(button as Element);
  });
}

describe("createTestApp", () => {
  it("builds a real Rex server for the bundle with the given actor", async () => {
    const app = createTestApp(notesApp, { actor: writer });
    expect(app.actor).toEqual({
      id: "writer",
      roles: [],
      permissions: ["notes.read", "notes.write"],
      attributes: {},
    });
    expect(app.registry).toBe(notesApp.registry);
    expect(app.page("notes").route).toBe("/notes");
    expect(() => app.page("missing")).toThrow(/page "missing" is not registered/);

    const response = await app.server.fetch(new Request(`${app.baseUrl}/rex/manifest`));
    expect(response.status).toBe(200);
    const manifest = (await response.json()) as {
      app: { name: string };
      pages: { id: string }[];
      actions: { id: string }[];
    };
    expect(manifest.app.name).toBe("notes");
    expect(manifest.pages.map((entry) => entry.id)).toEqual(["note", "notes"]);
    expect(manifest.actions.map((entry) => entry.id)).toEqual(["add-note", "list-notes"]);
    expect(decodeActorHeader(response.headers.get(REX_ACTOR_HEADER) ?? "").id).toBe("writer");
  });

  it("uses the supplied server options and rejects a missing bundle or actor", () => {
    const ledger = memoryLedger();
    const app = createTestApp(notesApp, { actor: writer, server: { ledger, app: "renamed" } });
    expect(app.ledger).toBe(ledger);
    expect(() => createTestApp({} as never, { actor: writer })).toThrow(RexTestingError);
    expect(() => createTestApp(notesApp, {} as never)).toThrow(/needs an actor/);
    expect(() => createTestApp(notesApp, { actor: { id: "" } })).toThrow(/id must be a non-empty/);
  });
});

describe("testServer", () => {
  it("fetches through the real server and records actions in the ledger", async () => {
    const app = createTestApp(notesApp, { actor: writer });
    const server = testServer(app);
    expect(server.ledger).toBe(app.ledger);
    expect(server.server).toBe(app.server);

    const health = await server.fetch("/rex/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });

    const created = await (server.client["add-note"] as (input: unknown) => Promise<unknown>)({
      title: "Ship 0.2",
    });
    expect(created).toEqual({ id: "n3", title: "Ship 0.2" });
    expect(listRecords().map((record) => record.title)).toContain("Ship 0.2");
    const records = await server.ledger.list();
    expect(records.map((record) => [record.actionId, record.outcome, record.actor])).toEqual([
      ["add-note", "ok", "writer"],
    ]);
  });

  it("evaluates policy for the test actor on the server", async () => {
    const server = testServer(createTestApp(notesApp, { actor: reader }));
    const call = server.client["add-note"] as (input: unknown) => Promise<unknown>;
    await expect(call({ title: "Not allowed" })).rejects.toThrow(/forbidden/);
    expect(listRecords()).toEqual(SEED_NOTES);
    const records = await server.ledger.list();
    expect(records.map((record) => [record.actionId, record.outcome])).toEqual([
      ["add-note", "FORBIDDEN"],
    ]);
  });
});

describe("Origin", () => {
  const FOREIGN_ORIGIN = "https://foreign.example";

  function postAddNote(title: string, headers: Record<string, string> = {}): RequestInit {
    return {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ json: { title } }),
    };
  }

  it("sends the test app origin on posts so the security middleware admits them", async () => {
    const app = createTestApp(notesApp, { actor: writer });
    const server = testServer(app);
    expect(testOrigin(app)).toBe("http://rex.test");

    const admitted = await server.fetch("/rex/rpc/add-note", postAddNote("Same origin"));
    expect(admitted.status).toBe(200);
    const output = (await admitted.json()) as { json: unknown };
    expect(output.json).toEqual({ id: "n3", title: "Same origin" });

    const explicit = await server.fetch(
      "/rex/rpc/add-note",
      postAddNote("Explicit origin", { origin: testOrigin(app) }),
    );
    expect(explicit.status).toBe(200);
    expect(listRecords().map((record) => record.title)).toEqual([
      ...SEED_NOTES.map((record) => record.title),
      "Same origin",
      "Explicit origin",
    ]);
    const records = await server.ledger.list();
    expect(records.map((record) => [record.actionId, record.outcome])).toEqual([
      ["add-note", "ok"],
      ["add-note", "ok"],
    ]);
  });

  it("rejects a post from a foreign Origin before the action runs", async () => {
    const app = createTestApp(notesApp, { actor: writer });
    const server = testServer(app);

    const refused = await server.fetch(
      "/rex/rpc/add-note",
      postAddNote("Cross origin", { origin: FOREIGN_ORIGIN }),
    );
    expect(refused.status).toBe(403);
    const body = (await refused.json()) as { code: string; message: string };
    expect(body.code).toBe("FORBIDDEN");
    expect(body.message).toContain(`Origin ${FOREIGN_ORIGIN}`);
    expect(listRecords()).toEqual(SEED_NOTES);
    expect(await server.ledger.list()).toEqual([]);
  });
});

describe("renderPage", () => {
  it("renders the page in the shell with data loaded from the real server", async () => {
    const app = createTestApp(notesApp, { actor: writer });
    const view = await renderPage(app, "notes");
    expect(view.href).toBe("/notes");
    expect(view.history).toEqual(["/notes"]);
    expect(view.page.id).toBe("notes");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Notes");
    await waitFor(() => expect(noteTitles(view)).toEqual(["Buy milk", "Call Ada"]));
    const records = await app.ledger.list({ actionId: "list-notes" });
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.actor === "writer" && record.outcome === "ok")).toBe(
      true,
    );
  });

  it("puts params in the route and loads lazily split pages", async () => {
    const app = createTestApp(notesApp, { actor: writer });
    const filtered = await renderPage(app, "notes", { params: { filter: "ada" } });
    expect(filtered.href).toBe("/notes?filter=ada");
    await waitFor(() => expect(noteTitles(filtered)).toEqual(["Call Ada"]));

    const detail = await renderPage(app, "note", { params: { noteId: "n2" } });
    expect(filtered.container.isConnected).toBe(false);
    expect(detail.href).toBe("/notes/n2");
    await waitFor(() =>
      expect(detail.container.querySelector('[data-note-detail="n2"]')?.textContent).toBe(
        "Call Ada",
      ),
    );
    await expect(renderPage(app, "note", { params: {} })).rejects.toThrow(
      /invalid params for page "note"/,
    );
  });

  it("invokes actions through the real runtime and refreshes invalidated data", async () => {
    const app = createTestApp(notesApp, { actor: writer });
    const view = await renderPage(app, "notes");
    await waitFor(() => expect(noteTitles(view)).toHaveLength(2));
    await addThroughUi(view, "Write tests");
    await waitFor(() => expect(noteTitles(view)).toEqual(["Buy milk", "Call Ada", "Write tests"]));
    const records = await app.ledger.list({ actionId: "add-note" });
    expect(records.map((record) => [record.outcome, record.actor])).toEqual([["ok", "writer"]]);
    await waitFor(() =>
      expect(view.sidecar().outcome).toMatchObject({ action: "add-note", ok: true }),
    );
    expect(view.outcomes.get("notes")).toMatchObject({ actionId: "add-note", ok: true });
  });

  it("applies density and locale for the render and restores them on unmount", async () => {
    const app = createTestApp(notesApp, { actor: writer });
    const root = document.documentElement;
    expect(root.getAttribute("lang")).toBeNull();
    const view = await renderPage(app, "notes", { density: "agent", locale: "fr-fr" });
    expect(root.getAttribute(DENSITY_ATTRIBUTE)).toBe("agent");
    expect(root.getAttribute("lang")).toBe("fr-FR");
    view.unmount();
    expect(root.getAttribute(DENSITY_ATTRIBUTE)).toBeNull();
    expect(root.getAttribute("lang")).toBeNull();
    expect(view.container.isConnected).toBe(false);

    const plain = await renderPage(app, "notes");
    expect(root.getAttribute(DENSITY_ATTRIBUTE)).toBe("comfortable");
    plain.unmount();
    await expect(renderPage(app, "notes", { density: "compact" as never })).rejects.toThrow(
      /density must be/,
    );
    await expect(renderPage(app, "notes", { locale: "not a locale" })).rejects.toThrow(RangeError);
  });
});

describe("page mount wait", () => {
  it("waits for a slow lazy page past the Testing Library default instead of the clock", async () => {
    expect(DEFAULT_PAGE_TIMEOUT).toBe(15_000);
    const app = createTestApp(slowNoteApp(), { actor: reader });
    const started = Date.now();
    const detail = await renderPage(app, "note", { params: { noteId: "n2" } });
    expect(Date.now() - started).toBeGreaterThan(1_000);
    expect(detail.container.querySelector('[data-rex-page="note"]:not([data-rex-page-loading])')).not.toBeNull();
    await waitFor(() =>
      expect(detail.container.querySelector('[data-note-detail="n2"]')?.textContent).toBe(
        "Call Ada",
      ),
    );
  });

  it("fails with the page and route once pageTimeout passes and rejects an invalid pageTimeout", async () => {
    const app = createTestApp(slowNoteApp(), { actor: reader });
    await expect(
      renderPage(app, "note", { params: { noteId: "n1" }, pageTimeout: 100 }),
    ).rejects.toThrow(/page "note" did not mount at \/notes\/n1 within 100 ms/);
    await expect(renderPage(app, "notes", { pageTimeout: 0 })).rejects.toThrow(
      /pageTimeout must be a positive number of milliseconds/,
    );
    await expect(renderRegion(app, "notes", "list", {}, { pageTimeout: Number.NaN })).rejects.toThrow(
      RexTestingError,
    );
  });
});

describe("renderRegion", () => {
  it("renders one region in isolation on the page runtime", async () => {
    const app = createTestApp(notesApp, { actor: writer });
    const view = await renderRegion(app, "notes", "composer");
    expect(view.container.querySelector('[data-rex-region="notes/composer"]')).not.toBeNull();
    expect(view.container.querySelector('[data-rex-region="notes/list"]')).toBeNull();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();

    await addThroughUi(view, "From a region");
    await waitFor(() =>
      expect(view.sidecar().outcome).toMatchObject({ action: "add-note", ok: true }),
    );
    expect(listRecords().map((record) => record.title)).toContain("From a region");
    const records = await app.ledger.list({ actionId: "add-note" });
    expect(records.map((record) => record.outcome)).toEqual(["ok"]);
  });

  it("loads lazy page modules and resolves params for the region", async () => {
    const app = createTestApp(notesApp, { actor: reader });
    const view = await renderRegion(app, "note", "detail", {}, { params: { noteId: "n1" } });
    await waitFor(() =>
      expect(view.container.querySelector('[data-note-detail="n1"]')?.textContent).toBe(
        "Buy milk",
      ),
    );
    expect(view.sidecar().page).toBe("note");
    await expect(renderRegion(app, "note", "missing")).rejects.toThrow(
      /region "missing" is not declared by page "note"/,
    );
  });
});

describe("readSidecar", () => {
  it("returns the validated sidecar of the rendered page", async () => {
    const app = createTestApp(notesApp, { actor: writer });
    const view = await renderPage(app, "notes", { params: { filter: "milk" } });
    const payload = readSidecar(view.container);
    expect(payload).toEqual(view.sidecar());
    expect(payload.page).toBe("notes");
    expect(payload.params).toEqual({ filter: "milk" });
    expect(
      payload.actions.map((entry) => [entry.id, entry.allowed, entry.reason, entry.effect]),
    ).toEqual([["add-note", true, null, "reversible"]]);
  });

  it("reports the actor's policy and fails without exactly one sidecar", async () => {
    const app = createTestApp(notesApp, { actor: reader });
    const view = await renderPage(app, "notes");
    await waitFor(() => expect(noteTitles(view)).toEqual(["Buy milk", "Call Ada"]));
    const [entry] = readSidecar(view.container).actions;
    expect(entry?.id).toBe("add-note");
    expect(entry?.allowed).toBe(false);
    expect(entry?.reason).not.toBeNull();
    const button = view.container.querySelector('[data-rex="notes/add-note"]');
    expect(button?.getAttribute("data-rex-allowed")).toBe("false");
    expect(() => readSidecar(document.createElement("div"))).toThrow(/exactly one sidecar/);
  });
});

describe("resets between renders", () => {
  it("unmounts the previous render and runs every registered reset before the next", async () => {
    let resets = 0;
    const unregister = registerReset(() => {
      resets += 1;
    });
    try {
      const app = createTestApp(notesApp, { actor: writer });
      const first = await renderPage(app, "notes");
      expect(resets).toBe(1);
      await waitFor(() => expect(noteTitles(first)).toHaveLength(2));
      await addThroughUi(first, "Temporary");
      await waitFor(() => expect(listRecords()).toHaveLength(3));

      const second = await renderPage(app, "notes");
      expect(resets).toBe(2);
      expect(first.container.isConnected).toBe(false);
      expect(listRecords()).toEqual(SEED_NOTES);
      await waitFor(() => expect(noteTitles(second)).toEqual(["Buy milk", "Call Ada"]));
      expect(document.querySelectorAll("[data-rex-page]")).toHaveLength(1);
    } finally {
      unregister();
    }
  });

  it("leaves a render mounted for the after-each cleanup", async () => {
    const app = createTestApp(notesApp, { actor: writer });
    const view = await renderPage(app, "notes", { locale: "de" });
    await waitFor(() => expect(noteTitles(view)).toHaveLength(2));
    await addThroughUi(view, "Left behind");
    await waitFor(() => expect(listRecords()).toHaveLength(3));
    expect(document.documentElement.getAttribute("lang")).toBe("de");
  });

  it("finds the previous render cleaned up by setupRexTesting", () => {
    expect(document.querySelector("[data-rex-page]")).toBeNull();
    expect(document.documentElement.getAttribute("lang")).toBeNull();
    expect(listRecords()).toEqual(SEED_NOTES);
    expect(() => setupRexTesting({} as never)).toThrow(/afterEach/);
  });
});
