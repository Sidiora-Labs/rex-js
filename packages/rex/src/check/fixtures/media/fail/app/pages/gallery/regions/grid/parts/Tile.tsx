import { createElement } from "react";

export default function Tile({ src, label }: { readonly src: string; readonly label: string }) {
  return createElement("img", { src, alt: label });
}
