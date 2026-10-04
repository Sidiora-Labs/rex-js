import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { createRegistry } from "../../core/registry.ts";
import { REX_DENSITY_HEADER } from "../../core/protocol.ts";
import { memoryLedger } from "../../server/audit.ts";
import { createRexServer } from "../../server/index.ts";
import { createRexApp, type RexFetch } from "../app.tsx";
import {
  DENSITY_ATTRIBUTE,
  DENSITY_STORAGE_KEY,
  DensityProvider,
  densityFromSearch,
  resolveDensity,
  useDensity,
} from "./density.ts";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "density.css"), "utf8");

function rootDensity(): string | null {
  return document.documentElement.getAttribute(DENSITY_ATTRIBUTE);
}

function Probe() {
  const { density, source, setDensity } = useDensity();
  return (
    <div>
      <p data-testid="density">{`${density}:${source}`}</p>
      <button type="button" onClick={() => setDensity(density === "agent" ? "default" : "agent")}>
        Toggle density
      </button>
      <details data-testid="group">
        <summary>Advanced</summary>
        <p>Hidden detail</p>
      </details>
    </div>
  );
}

function shown(): string | null {
  return screen.getByTestId("density").textContent;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("resolveDensity", () => {
  it("prefers the query parameter, then the header, then the stored preference, then default", () => {
    expect(resolveDensity({ query: "agent", header: "default", stored: "default" })).toEqual({
      density: "agent",
      source: "query",
    });
    expect(resolveDensity({ query: "default", header: "agent", stored: "agent" })).toEqual({
      density: "default",
      source: "query",
    });
    expect(resolveDensity({ query: null, header: "agent", stored: "default" })).toEqual({
      density: "agent",
      source: "header",
    });
    expect(resolveDensity({ query: null, header: "default", stored: "agent" })).toEqual({
      density: "default",
      source: "header",
    });
    expect(resolveDensity({ query: null, header: null, stored: "agent" })).toEqual({
      density: "agent",
      source: "stored",
    });
    expect(resolveDensity({})).toEqual({ density: "default", source: "default" });
  });

  it("skips values that are not densities at every level and admits compact as a client preference", () => {
    expect(resolveDensity({ query: "compact", header: "agent" })).toEqual({
      density: "compact",
      source: "query",
    });
    expect(resolveDensity({ query: "wide", header: "agent" })).toEqual({
      density: "agent",
      source: "header",
    });
    expect(resolveDensity({ query: "", header: "wide", stored: "agent" })).toEqual({
      density: "agent",
      source: "stored",
    });
    expect(resolveDensity({ query: "x", header: "y", stored: "z" })).toEqual({
      density: "default",
      source: "default",
    });
    expect(densityFromSearch("?tab=1&density=agent")).toBe("agent");
    expect(densityFromSearch("")).toBeNull();
  });
});

describe("DensityProvider", () => {
  it("applies the query parameter over the header and the stored preference", () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, "default");
    render(
      <DensityProvider search="?density=agent" header="default">
        <Probe />
      </DensityProvider>,
    );
    expect(shown()).toBe("agent:query");
    expect(rootDensity()).toBe("agent");
  });

  it("applies the header over the stored preference", () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, "default");
    render(
      <DensityProvider search="" header="agent">
        <Probe />
      </DensityProvider>,
    );
    expect(shown()).toBe("agent:header");
    expect(rootDensity()).toBe("agent");
  });

  it("applies the stored preference when there is no query parameter or header", () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, "agent");
    render(
      <DensityProvider search="" header={null}>
        <Probe />
      </DensityProvider>,
    );
    expect(shown()).toBe("agent:stored");
    expect(rootDensity()).toBe("agent");
  });

  it("falls back to default, shown as comfortable on the root, and restores the root attribute on unmount", () => {
    const { unmount } = render(
      <DensityProvider search="" header={null}>
        <Probe />
      </DensityProvider>,
    );
    expect(shown()).toBe("default:default");
    expect(rootDensity()).toBe("comfortable");
    unmount();
    expect(rootDensity()).toBeNull();
  });

  it("reads the x-rex-density header the server sends on the manifest response", async () => {
    const home = page("home", { route: "/", states: ["ready"] });
    const registry = createRegistry().register(home).freeze();
    const server = createRexServer({
      registry,
      ledger: memoryLedger(),
      actor: () => actor({ id: "agent-1" }),
    });
    const fetch: RexFetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const headers = new Headers(request.headers);
      headers.set(REX_DENSITY_HEADER, "agent");
      if (request.method !== "GET") headers.set("origin", new URL(request.url).origin);
      return server.fetch(new Request(request.url, { method: request.method, headers }));
    };
    function Density({ children }: { readonly children: React.ReactNode }) {
      return <DensityProvider search="">{children}</DensityProvider>;
    }
    const RexApp = createRexApp({ registry, fetch, baseUrl: "http://rex.test", density: Density });
    render(
      <RexApp>
        <Probe />
      </RexApp>,
    );
    await waitFor(() => expect(shown()).toBe("agent:header"));
    expect(rootDensity()).toBe("agent");
  });

  it("sets and stores an explicit preference with setDensity", async () => {
    render(
      <DensityProvider search="?density=agent" header={null}>
        <Probe />
      </DensityProvider>,
    );
    expect(rootDensity()).toBe("agent");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Toggle density" }));
    });
    expect(shown()).toBe("default:set");
    expect(rootDensity()).toBe("comfortable");
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("default");
  });

  it("expands collapsed groups in agent density, including groups added later", async () => {
    render(
      <DensityProvider search="?density=agent" header={null}>
        <Probe />
      </DensityProvider>,
    );
    expect(screen.getByTestId("group").hasAttribute("open")).toBe(true);
    const later = document.createElement("details");
    await act(async () => {
      document.body.appendChild(later);
    });
    await waitFor(() => expect(later.hasAttribute("open")).toBe(true));
    later.remove();
    cleanup();
    render(
      <DensityProvider search="" header={null}>
        <Probe />
      </DensityProvider>,
    );
    expect(screen.getByTestId("group").hasAttribute("open")).toBe(false);
  });
});

describe("density.css", () => {
  it("zeroes motion, expands groups and enlarges hit targets under agent density", () => {
    expect(css).toMatch(
      /\[data-rex-density="agent"\] \{\n {2}--rex-motion-duration: 0ms;\n {2}--rex-hit-target: 44px;/,
    );
    expect(css).toContain("transition-duration: 0ms !important;");
    expect(css).toContain("animation-duration: 0ms !important;");
    expect(css).toContain('[data-rex-density="agent"] details::details-content');
    expect(css).toContain("content-visibility: visible;");
    expect(css).toContain("min-block-size: max(44px, var(--rex-hit-target));");
    expect(css).toContain("min-inline-size: max(44px, var(--rex-hit-target));");
  });
});
