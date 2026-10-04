export const STATIC_LOADER_DEFAULTS = Object.freeze({
  staleTime: Number.POSITIVE_INFINITY,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
} as const);

export function isStaticHost(): boolean {
  const flag: unknown = import.meta.env.REX_STATIC_HOST;
  return flag === true || flag === "true";
}

export type DocumentLocation = Pick<Location, "assign" | "replace">;

export function navigateDocument(
  href: string,
  options: { readonly replace: boolean },
  target: DocumentLocation = globalThis.location,
): void {
  if (options.replace) target.replace(href);
  else target.assign(href);
}
