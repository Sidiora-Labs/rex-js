import { ORPCError } from "@orpc/server";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { action } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { always } from "../../core/policy.ts";
import { createRegistry } from "../../core/registry.ts";
import { boolean, text } from "../../core/schema.ts";
import { z } from "zod/mini";
import { buildManifest } from "../../manifest/build.ts";
import { memoryLedger } from "../../server/audit.ts";
import { createRexServer } from "../../server/index.ts";
import { useAct } from "../act.ts";
import { createRexApp, type RexFetch } from "../app.tsx";
import { createOutcomeStore, OutcomeProvider, type OutcomeStore } from "../outcome.ts";
import { definePageModules, view, type PageModuleSet } from "../page.tsx";
import { Shell } from "../shell.tsx";
import { OUTCOME_EMPTY_TEXT, OutcomeRegion, outcomeStatusText } from "./outcome.tsx";

const hideDust = action("hide-dust", {
  input: z.object({ hide: boolean() }),
  output: z.object({ hide: boolean() }),
  policy: always(),
  effect: "reversible",
  label: "Hide dust",
  handler: (input) => ({ hide: input.hide }),
});

const archive = action("archive", {
  input: z.object({ id: text({ min: 1 }) }),
  output: z.object({ archived: boolean() }),
  policy: always(),
  effect: "reversible",
  handler: () => {
    throw new ORPCError("CONFLICT", { message: "the account is already archived" });
  },
});

const portfolio = page("portfolio", {
  route: "/",
  params: z.object({ tab: text().optional() }),
  actions: [hideDust, archive],
  states: ["ready"],
});
const about = page("about", { route: "/about", states: ["ready"] });

function Controls() {
  const hide = useAct(hideDust);
  const archiving = useAct(archive);
  return (
    <div>
      <button type="button" {...hide.controlProps} onClick={() => void hide.run({ hide: true })}>
        Hide dust
      </button>
      <button
        type="button"
        {...archiving.controlProps}
        onClick={() => void archiving.run({ id: "acc-1" })}
      >
        Archive
      </button>
    </div>
  );
}

const pages: readonly PageModuleSet[] = [
  definePageModules({ page: portfolio, view: view(() => <Controls />), states: {} }),
  definePageModules({ page: about, view: view(() => <p>About Rex</p>), states: {} }),
];

const registry = createRegistry().register(hideDust, archive, portfolio, about).freeze();
const manifest = buildManifest(registry);
const owner = actor({ id: "owner" });

function mount(path: string) {
  const server = createRexServer({ registry, ledger: memoryLedger(), actor: () => owner });
  const fetch: RexFetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.method !== "GET" && !request.headers.has("origin")) {
      request.headers.set("origin", new URL(request.url).origin);
    }
    return server.fetch(request);
  };
  const RexApp = createRexApp({
    registry,
    manifest,
    actor: owner,
    fetch,
    baseUrl: "http://rex.test",
  });
  const store: OutcomeStore = createOutcomeStore();
  const memory = memoryLocation({ path, record: true });
  const tree = (
    <OutcomeProvider store={store}>
      <RexApp>
        <Router hook={memory.hook}>
          <Shell pages={pages} outcome={OutcomeRegion} />
        </Router>
      </RexApp>
    </OutcomeProvider>
  );
  const rendered = render(tree);
  return { store, memory, rerender: () => rendered.rerender(tree) };
}

function region(): HTMLElement {
  return screen.getByRole("status", { name: "Outcome" });
}

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

async function runAction(name: string, actionId: string) {
  const previous = region()
    .querySelector("[data-rex-outcome]")
    ?.getAttribute("data-rex-outcome-at");
  await click(name);
  await waitFor(() => {
    const entry = region().querySelector("[data-rex-outcome]");
    expect(entry?.getAttribute("data-rex-outcome")).toBe(actionId);
    expect(entry?.getAttribute("data-rex-outcome-at")).not.toBe(previous);
  });
}

afterEach(() => {
  cleanup();
});

describe("OutcomeRegion", () => {
  it("renders a polite live region on every page, empty before any action", async () => {
    mount("/");
    expect(region().getAttribute("aria-live")).toBe("polite");
    expect(region().textContent).toBe(OUTCOME_EMPTY_TEXT);
    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "About" }));
    });
    expect(screen.getByText("About Rex")).toBeTruthy();
    expect(screen.getAllByRole("status", { name: "Outcome" })).toHaveLength(1);
    expect(region().getAttribute("aria-live")).toBe("polite");
    expect(region().textContent).toBe(OUTCOME_EMPTY_TEXT);
  });

  it("states the action label, success and message after a successful action", async () => {
    const { store } = mount("/");
    await runAction("Hide dust", "hide-dust");
    const entry = region().querySelector("[data-rex-outcome]");
    expect(entry?.getAttribute("data-rex-outcome")).toBe("hide-dust");
    expect(entry?.getAttribute("data-rex-outcome-ok")).toBe("true");
    expect(region().textContent).toContain("Hide dust: Succeeded");
    expect(region().textContent).toContain("Hide dust succeeded");
    expect(store.get("portfolio")?.actionId).toBe("hide-dust");
  });

  it("states failure with the server message after a failed action", async () => {
    mount("/");
    await runAction("Archive", "archive");
    const entry = region().querySelector("[data-rex-outcome]");
    expect(entry?.getAttribute("data-rex-outcome")).toBe("archive");
    expect(entry?.getAttribute("data-rex-outcome-ok")).toBe("false");
    expect(region().textContent).toContain("archive: Failed");
    expect(region().textContent).toContain("archive failed: the account is already archived");
    expect(outcomeStatusText({ ok: false })).toBe("Failed");
  });

  it("persists across re-renders and navigation until dismissed", async () => {
    const { rerender, memory } = mount("/");
    await runAction("Hide dust", "hide-dust");
    const before = region().textContent;
    rerender();
    expect(region().textContent).toBe(before);
    await act(async () => {
      memory.navigate("/?tab=all");
    });
    expect(region().textContent).toBe(before);
    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "About" }));
    });
    expect(region().textContent).toBe(OUTCOME_EMPTY_TEXT);
    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "Portfolio" }));
    });
    expect(region().textContent).toBe(before);
    await click("Dismiss the Hide dust outcome");
    expect(region().textContent).toBe(OUTCOME_EMPTY_TEXT);
    rerender();
    expect(region().textContent).toBe(OUTCOME_EMPTY_TEXT);
  });

  it("replaces the outcome with the latest action", async () => {
    mount("/");
    await runAction("Hide dust", "hide-dust");
    await runAction("Archive", "archive");
    expect(region().querySelectorAll("[data-rex-outcome]")).toHaveLength(1);
    expect(region().querySelector("[data-rex-outcome]")?.getAttribute("data-rex-outcome")).toBe(
      "archive",
    );
  });
});
