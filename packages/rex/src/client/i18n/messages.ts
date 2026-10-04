import { RexError } from "../../core/errors.ts";
import { formatMessage, type MessageValue, type MessageValues } from "./format.ts";

export const MSG_PREFIX = "msg:";

export type Messages = Readonly<Record<string, string>>;

export type LocaleMessages = Readonly<Record<string, Messages>>;

export interface MessageRef {
  readonly key: string;
  readonly values: MessageValues;
}

const MESSAGE_KEY = /^[^\s?]+$/;
const CANONICAL_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function isMessageKey(key: unknown): key is string {
  return typeof key === "string" && MESSAGE_KEY.test(key);
}

export function isMessageRef(text: unknown): text is string {
  return typeof text === "string" && text.startsWith(MSG_PREFIX);
}

function assertKey(key: string): void {
  if (!isMessageKey(key)) {
    throw new RexError(
      "REX316",
      `rex: message key ${JSON.stringify(key)} must be non-empty without spaces or "?"`,
    );
  }
}

export function t(key: string, values: MessageValues = {}): string {
  assertKey(key);
  const names = Object.keys(values).sort();
  if (names.length === 0) return `${MSG_PREFIX}${key}`;
  const query = new URLSearchParams(names.map((name) => [name, String(values[name])]));
  return `${MSG_PREFIX}${key}?${query.toString()}`;
}

function decodeValue(raw: string): MessageValue {
  return CANONICAL_NUMBER.test(raw) ? Number(raw) : raw;
}

export function parseMessageRef(text: string): MessageRef | null {
  if (!isMessageRef(text)) return null;
  const body = text.slice(MSG_PREFIX.length);
  const query = body.indexOf("?");
  const key = query === -1 ? body : body.slice(0, query);
  if (!isMessageKey(key)) return null;
  const values: Record<string, MessageValue> = {};
  if (query !== -1) {
    for (const [name, raw] of new URLSearchParams(body.slice(query + 1))) {
      values[name] = decodeValue(raw);
    }
  }
  return Object.freeze({ key, values: Object.freeze(values) });
}

export function validateMessages(locale: string, value: unknown): Messages {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RexError("REX316", `rex: app/locales/${locale}.json must be a flat object of messages`);
  }
  const messages: Record<string, string> = {};
  for (const [key, pattern] of Object.entries(value as Record<string, unknown>)) {
    if (!isMessageKey(key)) {
      throw new RexError(
        "REX316",
        `rex: app/locales/${locale}.json has an invalid key ${JSON.stringify(key)}`,
      );
    }
    if (typeof pattern !== "string") {
      throw new RexError(
        "REX316",
        `rex: app/locales/${locale}.json key "${key}" must be a string message`,
      );
    }
    messages[key] = pattern;
  }
  return Object.freeze(messages);
}

export interface MessageLookup {
  readonly default: string;
  readonly messages: LocaleMessages;
}

export function localeChain(lookup: MessageLookup, locale: string): readonly string[] {
  const chain = [locale];
  const base = locale.split("-")[0] as string;
  if (base !== locale) chain.push(base);
  if (!chain.includes(lookup.default)) chain.push(lookup.default);
  return chain;
}

export function message(
  lookup: MessageLookup | null,
  locale: string,
  key: string,
  values: MessageValues = {},
): string {
  if (lookup === null) return key;
  for (const candidate of localeChain(lookup, locale)) {
    const pattern = lookup.messages[candidate]?.[key];
    if (pattern !== undefined) return formatMessage(pattern, values, candidate);
  }
  return key;
}

export function translate(
  lookup: MessageLookup | null,
  locale: string,
  text: string,
  values: MessageValues = {},
): string {
  const ref = parseMessageRef(text);
  if (ref === null) return text;
  return message(lookup, locale, ref.key, { ...ref.values, ...values });
}
