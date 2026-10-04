import type { ReactElement } from "react";

export const UNSAFE_HTML_ATTRIBUTE = "data-rex-unsafe-html";

export const UNSAFE_HTML_TAGS = ["div", "span", "section", "article"] as const;

export type UnsafeHtmlTag = (typeof UNSAFE_HTML_TAGS)[number];

export interface UnsafeHtmlOptions {
  readonly as?: UnsafeHtmlTag;
  readonly className?: string;
}

export function unsafeHtml(html: string, options: UnsafeHtmlOptions = {}): ReactElement {
  if (typeof html !== "string") {
    throw new TypeError("unsafeHtml: html must be a string of already sanitised markup");
  }
  const Tag = options.as ?? "div";
  if (!(UNSAFE_HTML_TAGS as readonly string[]).includes(Tag)) {
    throw new TypeError(`unsafeHtml: as must be one of ${UNSAFE_HTML_TAGS.join(", ")}`);
  }
  return (
    <Tag
      className={options.className}
      data-rex-unsafe-html=""
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
