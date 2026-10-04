import { unsafeHtml } from "@sidioralabs/rex/client";

export default function Rendered({ html }: { readonly html: string }) {
  return unsafeHtml(html, { as: "section", className: "prose" });
}
