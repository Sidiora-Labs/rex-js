import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { createRegistry } from "../core/registry.ts";
import type { StateProps } from "../core/states.ts";
import { buildManifest } from "../manifest/build.ts";
import { validateSidecar, type SidecarPayload } from "../manifest/sidecar.schema.ts";
import { readSidecar } from "./agent/sidecar.tsx";
import { createRexApp } from "./app.tsx";
import { REGION_ERROR_CODE, regionFailureMessage } from "./boundary.tsx";
import { createOutcomeStore, OutcomeProvider } from "./outcome.ts";
import { definePageModules, region, view, type PageModuleSet } from "./page.tsx";
import { AgentShell } from "./shell.tsx";

const failing = { flaky: true, plain: true };

const fragile = page("fragile", {
  route: "/",
  regions: ["stable", "flaky"],
  states: ["ready", "loading", "recoverable-error"],
});
const plain = page("plain", { route: "/plain", regions: ["broken"], states: ["ready"] });

const Stable = region("stable", () => <p>stable content</p>);
const Flaky = region("flaky", () => {
  if (failing.flaky) throw new Error("ledger unavailable");
  return <p>flaky content</p>;
});
const Broken = region("broken", () => {
  if (failing.plain) throw new Error("plain failure");
  return <p>plain content</p>;
});

function Loading() {
  return <p>loading</p>;
}

function RecoverableError({ error, retry }: StateProps<Readonly<Record<string, unknown>>>) {
  return (
    <div role="alert">
      <p>Region failed: {error?.message}</p>
      <button type="button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}

const pages: readonly PageModuleSet[] = [
  definePageModules({
    page: fragile,
    view: view(() => (
      <>
        <Stable />
        <Flaky />
      </>
    )),
    states: { Loading, RecoverableError },
    regions: { stable: Stable, flaky: Flaky },
  }),
  definePageModules({
    page: plain,
    view: view(() => <Broken />),
    states: {},
    regions: { broken: Broken },
  }),
];

const registry = createRegistry().register(fragile, plain).freeze();
const manifest = buildManifest(registry);
const viewer = actor({ id: "viewer" });

function mount(path: string) {
  const RexApp = createRexApp({
    registry,
    manifest,
    actor: viewer,
    baseUrl: "http://rex.test",
    queryClient: new QueryClient(),
  });
  const memory = memoryLocation({ path });
  render(
    <OutcomeProvider store={createOutcomeStore()}>
      <RexApp>
        <Router hook={memory.hook}>
          <AgentShell pages={pages} />
        </Router>
      </RexApp>
    </OutcomeProvider>,
  );
}

function sidecar(): SidecarPayload {
  const payload = readSidecar(document);
  const checked = validateSidecar(payload);
  expect(checked.valid).toBe(true);
  return payload as SidecarPayload;
}

const originalError = console.error;

beforeEach(() => {
  failing.flaky = true;
  failing.plain = true;
  console.error = () => {};
});

afterEach(() => {
  cleanup();
  console.error = originalError;
});

describe("RegionBoundary", () => {
  it("renders the page's recoverable-error state inside the failing region only", async () => {
    mount("/");
    const flaky = document.querySelector('[data-rex-region="fragile/flaky"]') as HTMLElement;
    const stable = document.querySelector('[data-rex-region="fragile/stable"]') as HTMLElement;
    expect(within(stable).getByText("stable content")).toBeTruthy();
    const scoped = await waitFor(() => {
      const found = flaky.querySelector("[data-rex-region-error]");
      expect(found).not.toBeNull();
      return found;
    });
    expect(scoped?.getAttribute("data-rex-region-error")).toBe("fragile/flaky");
    expect(scoped?.getAttribute("data-rex-error-code")).toBe(REGION_ERROR_CODE);
    expect(within(flaky).getByRole("alert").textContent).toContain("Region failed: ledger unavailable");
    expect(document.querySelector('main[data-rex-page="fragile"]')).not.toBeNull();
  });

  it("reports the recoverable-error state and the REX330 code in the sidecar", async () => {
    mount("/");
    await waitFor(() => expect(sidecar().state).toBe("recoverable-error"));
    const payload = sidecar();
    expect(payload.outcome?.action).toBe("fragile/flaky");
    expect(payload.outcome?.ok).toBe(false);
    expect(payload.outcome?.message).toBe(
      regionFailureMessage("fragile/flaky", new Error("ledger unavailable")),
    );
    expect(payload.outcome?.message.startsWith("REX330 ")).toBe(true);
  });

  it("retries by remounting the region and clears the failure", async () => {
    mount("/");
    const flaky = document.querySelector('[data-rex-region="fragile/flaky"]') as HTMLElement;
    failing.flaky = false;
    await act(async () => {
      fireEvent.click(within(flaky).getByRole("button", { name: "Try again" }));
    });
    expect(within(flaky).getByText("flaky content")).toBeTruthy();
    expect(flaky.querySelector("[data-rex-region-error]")).toBeNull();
    await waitFor(() => expect(sidecar().state).toBe("ready"));
  });

  it("falls back to the default recoverable-error state when the page declares none", async () => {
    mount("/plain");
    const broken = document.querySelector('[data-rex-region="plain/broken"]') as HTMLElement;
    const fallback = broken.querySelector("[data-rex-default-state]");
    expect(fallback?.getAttribute("data-rex-default-state")).toBe("recoverable-error");
    expect(fallback?.textContent).toContain("plain failure");
    failing.plain = false;
    await act(async () => {
      fireEvent.click(within(broken).getByRole("button", { name: "Retry" }));
    });
    expect(screen.getByText("plain content")).toBeTruthy();
  });
});
