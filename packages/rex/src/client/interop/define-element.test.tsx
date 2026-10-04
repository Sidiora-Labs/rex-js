import { act, cleanup, fireEvent } from "@testing-library/react";
import { memo, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RexError, isRexError } from "../../core/errors.ts";
import {
  attributeName,
  coerceAttribute,
  defineElement,
  type ElementPropKind,
  type RexElementConstructor,
} from "./define-element.tsx";

interface BadgeProps {
  readonly symbol?: string;
  readonly amount?: number;
  readonly muted?: boolean;
  readonly tags?: readonly string[];
}

function Badge({ symbol = "?", amount = 0, muted = false, tags = [] }: BadgeProps) {
  return (
    <span data-badge={symbol}>
      {`${symbol} ${amount.toFixed(2)} ${muted ? "muted" : "live"}${tags.length > 0 ? ` ${tags.join(",")}` : ""}`}
    </span>
  );
}

function Counter({ step = 1 }: { readonly step?: number }) {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount((current) => current + step)}>
      {`count ${count}`}
    </button>
  );
}

const BadgeElement = defineElement("rex-test-badge", Badge, {
  props: { symbol: "string", amount: "number", muted: "boolean", tags: "json" },
});

const CounterElement = defineElement("rex-test-counter", Counter, { props: { step: "number" } });

function thrown(run: () => unknown): RexError {
  try {
    run();
  } catch (error) {
    if (isRexError(error)) return error;
    throw error;
  }
  throw new Error("expected a RexError");
}

async function connect(element: HTMLElement, parent: HTMLElement = document.body): Promise<void> {
  await act(async () => {
    parent.append(element);
  });
}

afterEach(async () => {
  await act(async () => {
    document.body.innerHTML = "";
  });
  cleanup();
});

describe("attributeName", () => {
  it("dashes every capital letter of a camelCase prop", () => {
    expect(attributeName("symbol")).toBe("symbol");
    expect(attributeName("maxItems")).toBe("max-items");
    expect(attributeName("maxItemsPerPage")).toBe("max-items-per-page");
    expect(attributeName("ariaLabel")).toBe("aria-label");
    expect(attributeName("data-x")).toBe("data-x");
  });
});

describe("coerceAttribute", () => {
  it("reads a boolean from the attribute's presence", () => {
    expect(coerceAttribute("rex-x", "on", "boolean", null)).toBe(false);
    expect(coerceAttribute("rex-x", "on", "boolean", "false")).toBe(false);
    expect(coerceAttribute("rex-x", "on", "boolean", "")).toBe(true);
    expect(coerceAttribute("rex-x", "on", "boolean", "true")).toBe(true);
    expect(coerceAttribute("rex-x", "on", "boolean", "0")).toBe(true);
  });

  it("leaves a missing attribute undefined and passes a string through", () => {
    expect(coerceAttribute("rex-x", "label", "string", null)).toBeUndefined();
    expect(coerceAttribute("rex-x", "count", "number", null)).toBeUndefined();
    expect(coerceAttribute("rex-x", "data", "json", null)).toBeUndefined();
    expect(coerceAttribute("rex-x", "label", "string", "")).toBe("");
    expect(coerceAttribute("rex-x", "label", "string", "PAX")).toBe("PAX");
  });

  it("parses numbers and JSON and rejects malformed values with REX319", () => {
    expect(coerceAttribute("rex-x", "count", "number", "4")).toBe(4);
    expect(coerceAttribute("rex-x", "count", "number", "12.5")).toBe(12.5);
    expect(coerceAttribute("rex-x", "count", "number", "-1e3")).toBe(-1000);
    expect(coerceAttribute("rex-x", "data", "json", '{"a":1}')).toEqual({ a: 1 });
    expect(coerceAttribute("rex-x", "data", "json", "[1,2]")).toEqual([1, 2]);
    expect(coerceAttribute("rex-x", "data", "json", "null")).toBeNull();
    for (const [attribute, kind, value, detail] of [
      ["count", "number", "four", 'rex: <rex-x> attribute "count" is not a number: four'],
      ["count", "number", " ", 'rex: <rex-x> attribute "count" is not a number:  '],
      ["data", "json", "{", 'rex: <rex-x> attribute "data" is not JSON: {'],
      ["data", "json", "", 'rex: <rex-x> attribute "data" is not JSON: '],
    ] as const satisfies readonly (readonly [string, ElementPropKind, string, string])[]) {
      const error = thrown(() => coerceAttribute("rex-x", attribute, kind, value));
      expect(error).toBeInstanceOf(RexError);
      expect(error.code).toBe("REX319");
      expect(error.detail).toBe(detail);
    }
  });
});

describe("defineElement", () => {
  it("registers a constructor that reflects its tag and observed attributes", () => {
    expect(customElements.get("rex-test-badge")).toBe(BadgeElement);
    expect(BadgeElement.tagName).toBe("rex-test-badge");
    expect(BadgeElement.observedAttributes).toEqual(["symbol", "amount", "muted", "tags"]);
    expect(Object.isFrozen(BadgeElement.observedAttributes)).toBe(true);
    expect(Object.getPrototypeOf(BadgeElement)).toBe(HTMLElement);
    expect(document.createElement("rex-test-badge")).toBeInstanceOf(BadgeElement);
    const Multi: RexElementConstructor = defineElement("rex-test-multi", Badge, {
      props: { tags: "json", amount: "number" },
    });
    expect(Multi.observedAttributes).toEqual(["tags", "amount"]);
    expect(customElements.get("rex-test-multi")).toBe(Multi);
  });

  it("renders the part from its attributes once connected and follows attribute changes", async () => {
    const element = document.createElement("rex-test-badge");
    element.setAttribute("symbol", "PAX");
    element.setAttribute("amount", "12.5");
    element.setAttribute("muted", "");
    element.setAttribute("tags", '["stable","core"]');
    expect(element.innerHTML).toBe("");
    await connect(element);
    expect(element.querySelector("[data-badge]")?.textContent).toBe("PAX 12.50 muted stable,core");
    await act(async () => {
      element.setAttribute("amount", "3");
      element.setAttribute("muted", "false");
      element.removeAttribute("tags");
    });
    expect(element.textContent).toBe("PAX 3.00 live");
    await act(async () => {
      element.removeAttribute("symbol");
      element.removeAttribute("amount");
    });
    expect(element.textContent).toBe("? 0.00 live");
  });

  it("upgrades markup parsed from HTML", async () => {
    await act(async () => {
      document.body.innerHTML =
        '<rex-test-badge symbol="BTC" amount="1" tags=\'["core"]\'></rex-test-badge>';
    });
    const element = document.body.firstElementChild;
    expect(element).toBeInstanceOf(BadgeElement);
    expect(element?.querySelector('[data-badge="BTC"]')?.textContent).toBe("BTC 1.00 live core");
  });

  it("keeps the part's state across a move and resets it after a removal", async () => {
    const first = document.createElement("section");
    const second = document.createElement("section");
    document.body.append(first, second);
    const element = document.createElement("rex-test-counter");
    element.setAttribute("step", "2");
    await connect(element, first);
    const button = () => element.querySelector("button") as HTMLButtonElement;
    expect(button().textContent).toBe("count 0");
    await act(async () => {
      fireEvent.click(button());
    });
    expect(button().textContent).toBe("count 2");

    await act(async () => {
      second.append(element);
    });
    expect(second.contains(element)).toBe(true);
    expect(button().textContent).toBe("count 2");
    await act(async () => {
      element.setAttribute("step", "5");
    });
    await act(async () => {
      fireEvent.click(button());
    });
    expect(button().textContent).toBe("count 7");

    await act(async () => {
      element.remove();
    });
    expect(element.isConnected).toBe(false);
    expect(element.innerHTML).toBe("");
    await connect(element, first);
    expect(button().textContent).toBe("count 0");
  });

  it("accepts a memoized part object as the component", async () => {
    const Memoized = defineElement("rex-test-memo", memo(Badge), { props: { symbol: "string" } });
    expect(customElements.get("rex-test-memo")).toBe(Memoized);
    const element = document.createElement("rex-test-memo");
    element.setAttribute("symbol", "ETH");
    await connect(element);
    expect(element.textContent).toBe("ETH 0.00 live");
  });

  it("refuses invalid names, parts, prop kinds and duplicates with REX319", () => {
    for (const name of ["chip", "Rex-Chip", "rex chip", "", "-rex", "1rex-chip"]) {
      const error = thrown(() => defineElement(name, Badge, { props: {} }));
      expect(error.code).toBe("REX319");
      expect(error.detail).toBe(
        `defineElement: "${name}" is not a custom element name; use lowercase letters with a dash, for example rex-holding-row`,
      );
    }
    for (const part of [null, "div", 42]) {
      const error = thrown(() =>
        defineElement("rex-test-no-part", part as unknown as typeof Badge, { props: {} }),
      );
      expect(error.code).toBe("REX319");
      expect(error.detail).toBe("defineElement: <rex-test-no-part> needs a part component");
    }
    expect(customElements.get("rex-test-no-part")).toBeUndefined();
    const kind = thrown(() =>
      defineElement("rex-test-kind", Badge, {
        props: { symbol: "text" as unknown as ElementPropKind },
      }),
    );
    expect(kind.code).toBe("REX319");
    expect(kind.detail).toBe(
      'defineElement: <rex-test-kind> prop "symbol" has the unknown kind text',
    );
    expect(customElements.get("rex-test-kind")).toBeUndefined();
    const duplicate = thrown(() => defineElement("rex-test-badge", Badge, { props: {} }));
    expect(duplicate.code).toBe("REX319");
    expect(duplicate.detail).toBe("defineElement: <rex-test-badge> is already defined");
    expect(customElements.get("rex-test-badge")).toBe(BadgeElement);
  });

  it("reports REX327 when the environment has no custom element registry", () => {
    vi.stubGlobal("customElements", undefined);
    try {
      const error = thrown(() => defineElement("rex-test-nodom", Badge, { props: {} }));
      expect(error.code).toBe("REX327");
      expect(error.detail).toBe("defineElement: <rex-test-nodom> needs a DOM with customElements");
    } finally {
      vi.unstubAllGlobals();
    }
    expect(customElements.get("rex-test-nodom")).toBeUndefined();
    expect(customElements.get("rex-test-badge")).toBe(BadgeElement);
  });
});
