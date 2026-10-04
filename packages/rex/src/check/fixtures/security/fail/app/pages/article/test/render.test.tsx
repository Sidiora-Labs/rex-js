export function Probe({ html }: { readonly html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
