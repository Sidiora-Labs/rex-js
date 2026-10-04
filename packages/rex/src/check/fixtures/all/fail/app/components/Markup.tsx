export default function Markup({ html }: { readonly html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
