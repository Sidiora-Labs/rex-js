import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RexError } from "../core/errors.ts";
import * as client from "./index.ts";
import {
  APP_OUTCOME_KEY,
  OutcomeProvider,
  OutcomeStoreContext,
  createOutcomeStore,
  defaultOutcomeStore,
  useOutcome,
  useOutcomeStore,
  type Outcome,
} from "./outcome.ts";

const AT = new Date(0).toISOString();

function outcome(actionId: string, message: string, ok = true): Outcome {
  return { actionId, ok, message, at: AT };
}

function Current({ page }: { readonly page: string }) {
  const current = useOutcome(page);
  return (
    <p data-testid="outcome">
      {current === null ? "none" : `${current.actionId}: ${current.message}`}
    </p>
  );
}

function shown(): string | null {
  return screen.getByTestId("outcome").textContent;
}

afterEach(() => {
  cleanup();
  defaultOutcomeStore.clear("home");
});

describe("createOutcomeStore", () => {
  it("keeps a frozen copy of the latest outcome per page and clears it", () => {
    const store = createOutcomeStore();
    expect(store.get("home")).toBeNull();
    const sent = outcome("send", "Send: done");
    store.set("home", sent);
    const stored = store.get("home");
    expect(stored).toEqual(sent);
    expect(stored).not.toBe(sent);
    expect(Object.isFrozen(stored)).toBe(true);
    expect(store.get("other")).toBeNull();
    store.set("home", outcome("greet", "Greet: not allowed", false));
    expect(store.get("home")).toEqual(outcome("greet", "Greet: not allowed", false));
    store.clear("home");
    expect(store.get("home")).toBeNull();
  });

  it("notifies subscribers on every set and on a clear that removes an outcome", () => {
    const store = createOutcomeStore();
    const seen: (string | null)[] = [];
    const unsubscribe = store.subscribe(() => seen.push(store.get("home")?.message ?? null));
    store.clear("home");
    store.set("home", outcome("send", "first"));
    store.set("home", outcome("send", "second"));
    store.clear("home");
    store.clear("home");
    unsubscribe();
    store.set("home", outcome("send", "unseen"));
    expect(seen).toEqual(["first", "second", null]);
  });

  it("refuses an empty action id and a timestamp that is not ISO with REX322", () => {
    const store = createOutcomeStore();
    expect(() => store.set("home", { ...outcome("send", "Send: done"), actionId: "" })).toThrow(
      new RexError("REX322", "outcome: actionId must be a non-empty string"),
    );
    expect(() => store.set("home", { ...outcome("send", "Send: done"), at: "yesterday" })).toThrow(
      new RexError("REX322", "outcome: at must be an ISO timestamp"),
    );
    expect(store.get("home")).toBeNull();
  });
});

describe("useOutcome", () => {
  it("re-renders a reader when its page outcome in the provided store changes", async () => {
    const store = createOutcomeStore();
    render(
      <OutcomeProvider store={store}>
        <Current page="home" />
      </OutcomeProvider>,
    );
    expect(shown()).toBe("none");
    await act(async () => {
      store.set("home", outcome("send", "Send: done"));
    });
    expect(shown()).toBe("send: Send: done");
    await act(async () => {
      store.set("other", outcome("greet", "elsewhere"));
    });
    expect(shown()).toBe("send: Send: done");
    await act(async () => {
      store.clear("home");
    });
    expect(shown()).toBe("none");
  });

  it("reads the default store without a provider and is exported from the client entry", async () => {
    let seen: unknown = null;
    function Probe() {
      seen = useOutcomeStore();
      return null;
    }
    render(
      <>
        <Probe />
        <Current page="home" />
      </>,
    );
    expect(seen).toBe(defaultOutcomeStore);
    expect(OutcomeStoreContext.displayName).toBe("RexOutcomeStore");
    expect(APP_OUTCOME_KEY).toBe("app");
    expect(client.createOutcomeStore).toBe(createOutcomeStore);
    expect(client.useOutcome).toBe(useOutcome);
    expect(client.OutcomeProvider).toBe(OutcomeProvider);
    await act(async () => {
      defaultOutcomeStore.set("home", outcome("send", "via the default store"));
    });
    expect(shown()).toBe("send: via the default store");
  });
});
