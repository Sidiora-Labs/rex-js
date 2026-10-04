import "rex:render";
import { startRexEntry, type StartRexOptions, type StartedRex } from "@sidioralabs/rex/client";
import { readSidecar, testServer } from "@sidioralabs/rex/testing";
import { act, waitFor } from "@testing-library/react";
import app from "rex:app";
import { afterEach, describe, expect, it, vi } from "vitest";
import { owner } from "../../../../server.ts";
import { setupWalletTests, walletApp } from "./wallet.ts";

setupWalletTests();

type HydrationMismatch = Parameters<NonNullable<StartRexOptions["onHydrationMismatch"]>>[0];

const started: { current: StartedRex | null } = { current: null };

afterEach(async () => {
  const root = started.current?.root;
  started.current = null;
  if (root !== undefined) {
    await act(async () => {
      root.unmount();
    });
  }
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

function mountDocument(html: string): HTMLElement {
  window.history.replaceState(null, "", "/");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  const container = document.getElementById("root");
  if (container === null) throw new Error("the server document has no root element");
  return container;
}

function hydrationErrors(calls: readonly unknown[][]): string[] {
  return calls
    .map((args) => args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(" "))
    .filter((message) => /hydrat|did not match|REX310/i.test(message));
}

describe("portfolio server render", () => {
  it("hydrates the server-rendered portfolio with no hydration warning and one sidecar payload", async () => {
    const demo = walletApp(owner);
    const server = testServer(demo);
    const response = await server.fetch("/", { headers: { accept: "text/html" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("x-rex-page")).toBe("portfolio");
    const container = mountDocument(await response.text());
    expect(container.hasAttribute("data-rex-ssr")).toBe(true);
    expect(container.querySelector("[data-demo-total]")?.textContent).toBe("$76,580.00");
    const serverSidecar = readSidecar(container);
    expect(serverSidecar.page).toBe("portfolio");
    expect(serverSidecar.state).toBe("ready");
    const serverScript = container.querySelector("script#rex-page");

    const errors = vi.spyOn(console, "error");
    const mismatches: HydrationMismatch[] = [];
    await act(async () => {
      started.current = startRexEntry(container, app, {
        dev: true,
        baseUrl: demo.baseUrl,
        fetch: server.fetch,
        onHydrationMismatch: (mismatch) => {
          mismatches.push(mismatch);
        },
      });
    });
    expect(started.current?.mode).toBe("hydrate");
    await waitFor(() => expect(window.__rex).toBeDefined());

    expect(container.querySelector("script#rex-page")).toBe(serverScript);
    expect(readSidecar(container)).toEqual(window.__rex);
    expect(window.__rex).toEqual(serverSidecar);
    expect(container.querySelector("[data-demo-total]")?.textContent).toBe("$76,580.00");
    expect(mismatches).toEqual([]);
    expect(hydrationErrors(errors.mock.calls)).toEqual([]);
  });
});
