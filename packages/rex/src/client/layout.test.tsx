import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import {
  COLUMNS,
  Page,
  SPACES,
  columnsClass,
  spaceClass,
  type Columns,
  type Space,
} from "./layout.tsx";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "tokens.css"), "utf8");

function silenced(run: () => void) {
  const original = console.error;
  console.error = () => {};
  try {
    run();
  } finally {
    console.error = original;
  }
}

afterEach(() => {
  cleanup();
});

describe("layout primitives", () => {
  it("renders Page.Stack as a token-spaced block", () => {
    const { container } = render(
      <Page.Stack space={5}>
        <p>one</p>
        <p>two</p>
      </Page.Stack>,
    );
    const stack = container.firstElementChild as HTMLElement;
    expect(stack.tagName).toBe("DIV");
    expect(stack.className).toBe("rex-stack rex-space-5");
    expect(stack.children).toHaveLength(2);
    expect(stack.getAttribute("style")).toBeNull();
  });

  it("defaults spacing to the middle token step", () => {
    const { container } = render(<Page.Stack />);
    expect((container.firstElementChild as HTMLElement).className).toBe("rex-stack rex-space-3");
  });

  it("renders Page.Grid with column and space tokens", () => {
    const { container } = render(
      <Page.Grid columns={3} space={2}>
        <p>a</p>
      </Page.Grid>,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.tagName).toBe("DIV");
    expect(grid.className).toBe("rex-grid rex-cols-3 rex-space-2");
  });

  it("renders Page.Section as a labelled section landmark with a heading", () => {
    render(
      <Page.Section title="Holdings" space={4}>
        <p>rows</p>
      </Page.Section>,
    );
    const section = screen.getByRole("region", { name: "Holdings" });
    expect(section.tagName).toBe("SECTION");
    expect(section.className).toBe("rex-section rex-space-4");
    const heading = screen.getByRole("heading", { level: 2, name: "Holdings" });
    expect(section.getAttribute("aria-labelledby")).toBe(heading.id);
  });

  it("renders Page.Outcome as a polite live status region", () => {
    render(
      <Page.Outcome>
        <p>Send succeeded</p>
      </Page.Outcome>,
    );
    const outcome = screen.getByRole("status", { name: "Outcome" });
    expect(outcome.tagName).toBe("SECTION");
    expect(outcome.getAttribute("aria-live")).toBe("polite");
    expect(outcome.getAttribute("aria-atomic")).toBe("true");
    expect(outcome.className).toBe("rex-outcome rex-space-3");
    expect(outcome.textContent).toBe("Send succeeded");
  });

  it("rejects values outside the token scale at runtime", () => {
    silenced(() => {
      expect(() => render(<Page.Stack space={9 as Space} />)).toThrow(RangeError);
      expect(() => render(<Page.Grid columns={5 as Columns} />)).toThrow(RangeError);
      expect(() => render(<Page.Section title=" " />)).toThrow(TypeError);
    });
  });

  it("rejects non-token props at the type level", () => {
    function typeOnly() {
      return (
        <>
          <Page.Stack space={8} />
          <Page.Grid columns={4} space={1} />
          {/* @ts-expect-error space must be a token step */}
          <Page.Stack space={9} />
          {/* @ts-expect-error raw CSS lengths are not tokens */}
          <Page.Stack space="12px" />
          {/* @ts-expect-error class names are not accepted */}
          <Page.Stack className="mt-4" />
          {/* @ts-expect-error inline styles are not accepted */}
          <Page.Grid style={{ gap: 3 }} />
          {/* @ts-expect-error columns stop at 4 */}
          <Page.Grid columns={5} />
          {/* @ts-expect-error a section needs a title */}
          <Page.Section />
        </>
      );
    }
    expectTypeOf(typeOnly).toBeFunction();
    expectTypeOf<ComponentProps<typeof Page.Stack>>().toEqualTypeOf<{
      readonly space?: Space;
      readonly children?: ReactNode;
    }>();
    expectTypeOf<Space>().toEqualTypeOf<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>();
    expectTypeOf<Columns>().toEqualTypeOf<1 | 2 | 3 | 4>();
  });
});

describe("tokens.css", () => {
  it("defines a token and a class for every spacing and column step", () => {
    for (const space of SPACES) {
      expect(css).toContain(`--rex-space-${space}:`);
      expect(css).toContain(`.${spaceClass(space)} {\n  --rex-gap: var(--rex-space-${space});`);
    }
    for (const columns of COLUMNS) {
      expect(css).toContain(`.${columnsClass(columns)} {\n  --rex-columns: ${columns};`);
    }
    for (const token of ["--rex-radius-1", "--rex-motion-duration", "--rex-hit-target"]) {
      expect(css).toContain(`${token}:`);
    }
  });

  it("overrides motion, hit targets and grid flattening under agent density", () => {
    expect(css).toMatch(
      /\[data-rex-density="agent"\] \{\n {2}--rex-motion-duration: 0ms;\n {2}--rex-hit-target: 44px;\n\}/,
    );
    expect(css).toMatch(/\[data-rex-density="agent"\] \.rex-grid \{\n {2}--rex-columns: 1;\n\}/);
    expect(css).toContain("transition-duration: 0ms !important;");
    expect(css).toContain("min-block-size: var(--rex-hit-target);");
  });

  it("uses no raw colors", () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});
