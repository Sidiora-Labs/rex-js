import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildManifest } from "../manifest/build.ts";
import { notesApp } from "./fixtures/app.ts";
import { SEED_NOTES, addRecord, listRecords } from "./fixtures/data.ts";
import {
  ACCEPT_LANGUAGE_HEADER,
  RexTestingError,
  TEST_BASE_URL,
  cleanupRex,
  createTestApp,
  readSidecar,
  renderPage,
  renderRegion,
  setupRexTesting,
  testServer,
  type TestAppSource,
} from "./index.ts";

setupRexTesting({ afterEach });

const writer = { id: "writer", permissions: ["notes.read", "notes.write"] };

function noteTitles(container: ParentNode): string[] {
  return [...container.querySelectorAll("[data-note]")].map((item) => item.textContent ?? "");
}

describe("rex/testing entry", () => {
  it("names the test origin, the locale header and the error class", () => {
    expect(TEST_BASE_URL).toBe("http://rex.test");
    expect(new URL(TEST_BASE_URL).origin).toBe(TEST_BASE_URL);
    expect(ACCEPT_LANGUAGE_HEADER).toBe("accept-language");
    const error = new RexTestingError("boom");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("RexTestingError");
    expect(error.message).toBe("rex/testing: boom");
  });

  it("cleans up every mounted render and runs the registered resets", async () => {
    const app = createTestApp(notesApp, { actor: writer });
    const view = await renderPage(app, "notes", { locale: "de" });
    await waitFor(() => expect(noteTitles(view.container)).toEqual(["Buy milk", "Call Ada"]));
    addRecord("Scratch");
    expect(listRecords()).toHaveLength(3);
    expect(document.documentElement.getAttribute("lang")).toBe("de");

    cleanupRex();
    expect(view.container.isConnected).toBe(false);
    expect(document.querySelector("[data-rex-page]")).toBeNull();
    expect(document.documentElement.getAttribute("lang")).toBeNull();
    expect(listRecords()).toEqual(SEED_NOTES);

    cleanupRex();
    expect(document.querySelector("[data-rex-page]")).toBeNull();
    expect(listRecords()).toEqual(SEED_NOTES);
  });

  it("navigates the memory location and records the history", async () => {
    const app = createTestApp(notesApp, { actor: writer });
    const view = await renderPage(app, "notes");
    await waitFor(() => expect(noteTitles(view.container)).toEqual(["Buy milk", "Call Ada"]));

    await act(async () => {
      view.navigate("/notes?filter=ada");
    });
    await waitFor(() => expect(noteTitles(view.container)).toEqual(["Call Ada"]));
    expect(view.history).toEqual(["/notes", "/notes?filter=ada"]);
    expect(view.sidecar().params).toEqual({ filter: "ada" });

    await act(async () => {
      view.navigate("/notes?filter=milk", { replace: true });
    });
    await waitFor(() => expect(noteTitles(view.container)).toEqual(["Buy milk"]));
    expect(view.history).toEqual(["/notes", "/notes?filter=milk"]);
    expect(view.sidecar().params).toEqual({ filter: "milk" });
  });

  it("refuses pages the bundle does not know or has no modules for", async () => {
    const bare: TestAppSource = { name: "notes", registry: notesApp.registry, pages: [] };
    const app = createTestApp(bare, { actor: writer });
    expect(app.pages).toEqual([]);
    await expect(renderRegion(app, "notes", "list")).rejects.toThrow(
      /the app has no page modules for page "notes"/,
    );
    await expect(renderRegion(app, "notes", "list")).rejects.toThrow(RexTestingError);
    await expect(renderPage(app, "missing")).rejects.toThrow(
      /page "missing" is not registered \(pages: note, notes\)/,
    );
    expect(document.querySelector("[data-rex-page]")).toBeNull();
  });

  it("uses the manifest supplied with the bundle and reads the sidecar off the document", async () => {
    const manifest = buildManifest(notesApp.registry, { app: "notes" });
    const app = createTestApp({ ...notesApp, manifest }, { actor: writer });
    expect(app.source.manifest).toBe(manifest);
    const view = await renderPage(app, "notes", { params: { filter: "ada" } });
    expect(view.href).toBe("/notes?filter=ada");
    await waitFor(() => expect(noteTitles(view.container)).toEqual(["Call Ada"]));
    const payload = readSidecar();
    expect(payload).toEqual(view.sidecar());
    expect(payload.page).toBe("notes");
    expect(payload.params).toEqual({ filter: "ada" });
    expect(payload.actions.map((entry) => entry.id)).toEqual(["add-note"]);
  });

  it("resolves string, URL and Request inputs against the test origin", async () => {
    const app = createTestApp(notesApp, { actor: writer });
    const server = testServer(app);
    const inputs = [
      "/rex/health",
      new URL("/rex/health", TEST_BASE_URL),
      new Request(`${TEST_BASE_URL}/rex/health`),
    ];
    for (const input of inputs) {
      const response = await server.fetch(input);
      expect(response.status, String(input)).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
    }
    const posted = await server.fetch(
      new Request(`${TEST_BASE_URL}/rex/rpc/add-note`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: { title: "Via Request" } }),
      }),
    );
    expect(posted.status).toBe(200);
    expect(listRecords().map((record) => record.title)).toContain("Via Request");
    const records = await server.ledger.list({ actionId: "add-note" });
    expect(records.map((record) => [record.outcome, record.actor])).toEqual([["ok", "writer"]]);
  });
});
