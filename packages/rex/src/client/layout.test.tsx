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

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "tokens.css"), "utf8");
const densityCss = readFileSync(join(here, "agent", "density.css"), "utf8");

function block(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {\n`);
  if (start === -1) throw new Error(`no rule for ${selector}`);
  return source.slice(start, source.indexOf("\n}\n", start) + 2);
}

function flat(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")");
}

const FLUID_SCALE =
  /^--rex-(?:text|space)-\d: clamp\(calc\([\d.]+rem \* var\(--rex-fluid-min\) \* var\(--rex-density(?:-text)?-scale\)\), calc\(\([\d.]+rem \* var\(--rex-fluid-base\) \+ [\d.]+ \* var\(--rex-fluid-slope\)\) \* var\(--rex-density(?:-text)?-scale\)\), calc\([\d.]+rem \* var\(--rex-fluid-max\) \* var\(--rex-density(?:-text)?-scale\)\)\);$/;

function token(rule: string, name: string): string {
  const found = new RegExp(`--rex-${name}: clamp\\([\\s\\S]*?\\);`).exec(rule)?.[0];
  if (found === undefined) throw new Error(`no fluid token --rex-${name}`);
  return flat(found);
}

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
      const invalidProps = expect.objectContaining({ name: "RexError", code: "REX314" });
      expect(() => render(<Page.Stack space={9 as Space} />)).toThrow(invalidProps);
      expect(() => render(<Page.Grid columns={5 as Columns} />)).toThrow(invalidProps);
      expect(() => render(<Page.Section title=" " />)).toThrow(invalidProps);
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

  it("defines fluid clamp() type and space scales keyed by screen class and scaled by density", () => {
    const root = block(css, ":root,\n[data-rex-screen],\n[data-rex-density]");
    for (const step of [1, 2, 3, 4, 5, 6]) {
      const found = token(root, `text-${step}`);
      expect(found).toMatch(FLUID_SCALE);
      expect(found).toContain("var(--rex-density-text-scale)");
    }
    for (const space of SPACES) {
      const found = token(root, `space-${space}`);
      expect(found).toMatch(FLUID_SCALE);
      expect(found).toContain("var(--rex-density-scale)");
    }
    for (const screen of ["phone", "tablet", "desktop", "wide"]) {
      const rule = block(css, `[data-rex-screen="${screen}"]`);
      for (const variable of ["--rex-fluid-min", "--rex-fluid-max", "--rex-fluid-base"]) {
        expect(rule).toMatch(new RegExp(`${variable}: [\\d.]+;`));
      }
      expect(rule).toMatch(/--rex-fluid-slope: [\d.]+vw;/);
    }
    const phone = block(css, '[data-rex-screen="phone"]');
    const wide = block(css, '[data-rex-screen="wide"]');
    const max = (rule: string) => Number(/--rex-fluid-max: ([\d.]+);/.exec(rule)?.[1]);
    expect(max(phone)).toBeLessThan(max(wide));
  });

  it("scales spacing and type down under compact density and keeps comfortable and agent at one", () => {
    expect(block(densityCss, '[data-rex-density="compact"]')).toMatch(
      /--rex-density-scale: 0\.875;\n {2}--rex-density-text-scale: 0\.9375;/,
    );
    expect(block(densityCss, '[data-rex-density="comfortable"]')).toContain(
      "--rex-density-scale: 1;",
    );
    expect(densityCss).toMatch(
      /\[data-rex-density="agent"\] \{\n {2}--rex-density-scale: 1;\n {2}--rex-density-text-scale: 1;\n\}/,
    );
    expect(block(css, ".rex-stack,\n.rex-section,\n.rex-outcome")).toContain(
      "gap: var(--rex-gap, var(--rex-space-3));",
    );
  });

  it("gives every control a 44px target under a coarse pointer", () => {
    expect(block(css, '[data-rex-pointer="coarse"]')).toContain("--rex-hit-target: 44px;");
    expect(css).toMatch(
      /\[data-rex-pointer="coarse"\]\n {2}:is\(a, button, input, select, textarea, summary, \[role="option"\], \[data-rex\]\) \{\n {2}min-block-size: 44px;\n {2}min-inline-size: 44px;\n\}/,
    );
  });

  it("makes Page.Grid an inline-size container whose columns collapse by container width", () => {
    const grid = block(css, ".rex-grid");
    expect(grid).toContain("container-type: inline-size;");
    expect(flat(grid)).toContain(
      "grid-template-columns: repeat(auto-fit, minmax(min(100%, max(var(--rex-grid-track), (100% - (var(--rex-columns, 1) - 1) * var(--rex-gap, var(--rex-space-3))) / var(--rex-columns, 1))), 1fr));",
    );
    expect(grid).not.toMatch(/vw|vh|px/);
    expect(css).not.toMatch(/@media[^{]*width/);
    expect(css).toMatch(/--rex-grid-track: calc\(var\(--rex-space-8\) \* 4\);/);
    const { container } = render(
      <Page.Grid columns={3}>
        <Page.Stack>
          <p>a</p>
        </Page.Stack>
      </Page.Grid>,
    );
    for (const element of container.querySelectorAll("div")) {
      expect(element.getAttribute("style")).toBeNull();
    }
  });

  it("uses no raw colors", () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});
