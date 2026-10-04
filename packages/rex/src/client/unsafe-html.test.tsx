import { cleanup, render } from "@testing-library/react";
import { isValidElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { RexError } from "../core/errors.ts";
import * as client from "./index.ts";
import {
  UNSAFE_HTML_ATTRIBUTE,
  UNSAFE_HTML_TAGS,
  unsafeHtml,
  type UnsafeHtmlTag,
} from "./unsafe-html.tsx";

afterEach(() => {
  cleanup();
});

describe("unsafeHtml", () => {
  it("renders already sanitised markup inside a marked div", () => {
    const element = unsafeHtml("<p>Hello <strong>world</strong></p>");
    expect(isValidElement(element)).toBe(true);
    const { container } = render(element);
    expect(container.children).toHaveLength(1);
    const host = container.firstElementChild as HTMLElement;
    expect(host.tagName).toBe("DIV");
    expect(host.getAttribute(UNSAFE_HTML_ATTRIBUTE)).toBe("");
    expect(host.hasAttribute("class")).toBe(false);
    expect(host.innerHTML).toBe("<p>Hello <strong>world</strong></p>");
    expect(host.querySelector("strong")?.textContent).toBe("world");
  });

  it("renders every permitted host tag with the given class name", () => {
    expect(UNSAFE_HTML_TAGS).toEqual(["div", "span", "section", "article"]);
    for (const tag of UNSAFE_HTML_TAGS) {
      const { container, unmount } = render(
        unsafeHtml("<em>trusted</em>", { as: tag, className: "rex-prose" }),
      );
      const host = container.firstElementChild as HTMLElement;
      expect(host.tagName).toBe(tag.toUpperCase());
      expect(host.className).toBe("rex-prose");
      expect(host.getAttribute(UNSAFE_HTML_ATTRIBUTE)).toBe("");
      expect(host.innerHTML).toBe("<em>trusted</em>");
      unmount();
    }
  });

  it("refuses markup that is not a string and a host tag outside the list with REX314", () => {
    expect(() => unsafeHtml(null as unknown as string)).toThrow(
      new RexError("REX314", "unsafeHtml: html must be a string of already sanitised markup"),
    );
    expect(() => unsafeHtml("<b>x</b>", { as: "script" as UnsafeHtmlTag })).toThrow(
      new RexError("REX314", "unsafeHtml: as must be one of div, span, section, article"),
    );
    expect(client.unsafeHtml).toBe(unsafeHtml);
    expect(client.UNSAFE_HTML_ATTRIBUTE).toBe("data-rex-unsafe-html");
    expect(client.UNSAFE_HTML_TAGS).toBe(UNSAFE_HTML_TAGS);
  });
});
