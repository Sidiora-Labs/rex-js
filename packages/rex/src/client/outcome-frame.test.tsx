import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RexError } from "../core/errors.ts";
import { OutcomeProvider, createOutcomeStore } from "./outcome.ts";
import {
  DEFAULT_SPACE,
  PageOutcome,
  SPACES,
  checkSpace,
  spaceClass,
  type Space,
} from "./outcome-frame.tsx";
import { TokenOutcome } from "./shell/components.ts";

function status(): HTMLElement {
  return screen.getByRole("status", { name: "Outcome" });
}

afterEach(() => {
  cleanup();
});

describe("checkSpace", () => {
  it("accepts every token step and maps it to its space class", () => {
    expect(SPACES).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(DEFAULT_SPACE).toBe(3);
    for (const space of SPACES) {
      expect(checkSpace("Outcome", space)).toBe(space);
      expect(spaceClass(space)).toBe(`rex-space-${space}`);
    }
  });

  it("refuses a step outside 1..8 with REX314 naming the component", () => {
    expect(() => checkSpace("Outcome", 9)).toThrow(
      new RexError("REX314", "Page.Outcome: space must be a token step 1..8, received 9"),
    );
    expect(() => checkSpace("Stack", "3")).toThrow(
      new RexError("REX314", "Page.Stack: space must be a token step 1..8, received 3"),
    );
    expect(() => checkSpace("Outcome", undefined)).toThrow(
      new RexError("REX314", "Page.Outcome: space must be a token step 1..8, received undefined"),
    );
  });
});

describe("PageOutcome", () => {
  it("renders a polite atomic status landmark labelled Outcome at the default space", () => {
    render(
      <PageOutcome>
        <p>Greet: done</p>
      </PageOutcome>,
    );
    const landmark = status();
    expect(landmark.tagName).toBe("SECTION");
    expect(landmark.getAttribute("aria-live")).toBe("polite");
    expect(landmark.getAttribute("aria-atomic")).toBe("true");
    expect(landmark.className).toBe("rex-outcome rex-space-3");
    expect(landmark.textContent).toBe("Greet: done");
  });

  it("applies a declared space step and refuses one outside the scale", () => {
    render(<PageOutcome space={6} />);
    expect(status().className).toBe("rex-outcome rex-space-6");
    expect(status().textContent).toBe("");
    cleanup();
    const original = console.error;
    console.error = () => {};
    try {
      expect(() => render(<PageOutcome space={0 as Space} />)).toThrow(
        "Page.Outcome: space must be a token step 1..8, received 0",
      );
    } finally {
      console.error = original;
    }
  });

  it("is the landmark the token Outcome component renders the page outcome into", async () => {
    const store = createOutcomeStore();
    render(
      <OutcomeProvider store={store}>
        <TokenOutcome page="home" />
      </OutcomeProvider>,
    );
    expect(status().textContent).toBe("");
    await act(async () => {
      store.set("home", {
        actionId: "greet",
        ok: true,
        message: "Greet: done",
        at: new Date(0).toISOString(),
      });
    });
    expect(status().textContent).toBe("Greet: done");
    expect(status().className).toBe("rex-outcome rex-space-3");
  });
});
