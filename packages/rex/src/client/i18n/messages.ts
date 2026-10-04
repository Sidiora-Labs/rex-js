import { formatMessage, type MessageValues } from "./format.ts";
import { resolveMessage, resolveText, type MessageLookup } from "./lookup.ts";

export * from "./lookup.ts";

export function message(
  lookup: MessageLookup | null,
  locale: string,
  key: string,
  values: MessageValues = {},
): string {
  return resolveMessage(lookup, locale, key, values, formatMessage);
}

export function translate(
  lookup: MessageLookup | null,
  locale: string,
  text: string,
  values: MessageValues = {},
): string {
  return resolveText(lookup, locale, text, values, formatMessage);
}
