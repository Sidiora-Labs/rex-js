import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { createRef, useCallback, useState } from "react";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import { Native, type NativeMount, type NativeProps, type NativeTag } from "./native.tsx";

afterEach(() => {
  cleanup();
});

describe("Native", () => {
  it("renders a div by default and passes HTML attributes through without children", () => {
    const ref = createRef<HTMLElement>();
    const { container } = render(
      <Native
        ref={ref}
        id="chart"
        className="panel"
        data-rex-native="chart"
        aria-label="Chart"
        tabIndex={0}
      />,
    );
    const node = container.firstElementChild;
    expect(node).toBe(ref.current);
    expect(node?.tagName).toBe("DIV");
    expect(node?.id).toBe("chart");
    expect(node?.className).toBe("panel");
    expect(node?.getAttribute("data-rex-native")).toBe("chart");
    expect(node?.getAttribute("aria-label")).toBe("Chart");
    expect(node?.getAttribute("tabindex")).toBe("0");
    expect(node?.childNodes).toHaveLength(0);
    expect(Native.displayName).toBe("Native");
    expectTypeOf<NativeProps>().not.toHaveProperty("children");
    expectTypeOf<NativeProps>().not.toHaveProperty("dangerouslySetInnerHTML");
    expectTypeOf<NativeProps["as"]>().toEqualTypeOf<NativeTag | undefined>();
  });

  it("hands the node to mount once and accepts a mount without cleanup", () => {
    const seen: HTMLElement[] = [];
    const mount: NativeMount = (node) => {
      seen.push(node);
      node.dataset.drawn = "yes";
    };
    const ref = createRef<HTMLElement>();
    const rendered = render(<Native ref={ref} as="span" mount={mount} />);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(ref.current);
    expect(ref.current?.tagName).toBe("SPAN");
    expect(ref.current?.dataset.drawn).toBe("yes");
    rendered.rerender(<Native ref={ref} as="span" mount={mount} title="same node" />);
    expect(seen).toHaveLength(1);
    expect(ref.current?.getAttribute("title")).toBe("same node");
    expect(() => rendered.unmount()).not.toThrow();
    expect(ref.current).toBeNull();
  });

  it("re-creates the node and re-runs mount with cleanup when the tag changes", async () => {
    const log: string[] = [];
    const ref = createRef<HTMLElement>();
    const mount: NativeMount = (node) => {
      log.push(`mount ${node.tagName}`);
      return () => {
        log.push(`cleanup ${node.tagName}`);
      };
    };
    function Host() {
      const [as, setAs] = useState<NativeTag>("div");
      return (
        <>
          <Native ref={ref} as={as} mount={mount} />
          <button type="button" onClick={() => setAs("section")}>
            Switch
          </button>
        </>
      );
    }
    const rendered = render(<Host />);
    const first = ref.current;
    expect(first?.tagName).toBe("DIV");
    await act(async () => {
      fireEvent.click(rendered.getByRole("button", { name: "Switch" }));
    });
    expect(ref.current?.tagName).toBe("SECTION");
    expect(ref.current).not.toBe(first);
    expect(first?.isConnected).toBe(false);
    expect(log).toEqual(["mount DIV", "cleanup DIV", "mount SECTION"]);
    rendered.unmount();
    expect(log).toEqual(["mount DIV", "cleanup DIV", "mount SECTION", "cleanup SECTION"]);
  });

  it("re-runs mount on the same node when the mount function changes", async () => {
    const log: string[] = [];
    function Host() {
      const [series, setSeries] = useState("price");
      const mount = useCallback(
        (node: HTMLElement) => {
          node.textContent = series;
          log.push(`mount ${series}`);
          return () => {
            log.push(`cleanup ${series}`);
          };
        },
        [series],
      );
      return (
        <>
          <Native as="figure" data-series={series} mount={mount} />
          <button type="button" onClick={() => setSeries("volume")}>
            Volume
          </button>
        </>
      );
    }
    const rendered = render(<Host />);
    const figure = rendered.container.querySelector("figure");
    expect(figure?.textContent).toBe("price");
    await act(async () => {
      fireEvent.click(rendered.getByRole("button", { name: "Volume" }));
    });
    expect(rendered.container.querySelector("figure")).toBe(figure);
    expect(figure?.textContent).toBe("volume");
    expect(figure?.getAttribute("data-series")).toBe("volume");
    expect(log).toEqual(["mount price", "cleanup price", "mount volume"]);
  });
});
