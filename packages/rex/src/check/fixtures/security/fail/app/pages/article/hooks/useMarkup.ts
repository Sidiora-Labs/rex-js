export function useMarkup(html: string) {
  const props: Record<string, unknown> = {};
  props["dangerouslySetInnerHTML"] = { __html: html };
  return props;
}
