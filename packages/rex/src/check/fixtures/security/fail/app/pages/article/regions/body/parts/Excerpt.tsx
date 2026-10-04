import { createElement } from "react";

export default function Excerpt({ html }: { readonly html: string }) {
  return createElement("p", { dangerouslySetInnerHTML: { __html: html } });
}
