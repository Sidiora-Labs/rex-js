import { unsafeHtml } from "@sidioralabs/rex/client";

export default function Markdown({ html }: { readonly html: string }) {
  return <div className="stack">{unsafeHtml(html)}</div>;
}
