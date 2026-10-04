export default function Raw({ html }: { readonly html: string }) {
  const dangerouslySetInnerHTML = { __html: html };
  return <span {...{ dangerouslySetInnerHTML }} />;
}
