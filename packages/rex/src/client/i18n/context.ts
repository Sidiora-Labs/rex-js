import { createContext, useCallback, useContext } from "react";
import type { I18nConfig } from "../../core/config.ts";
import type { MessageValues } from "./format.ts";
import { localeSettings, type LocaleSettings } from "./locale.ts";
import {
  message,
  translate,
  validateMessages,
  type LocaleMessages,
  type MessageLookup,
} from "./messages.ts";

export const UNCONFIGURED_LOCALE = "en";

export interface I18nInput {
  readonly config: I18nConfig;
  readonly messages: Readonly<Record<string, unknown>>;
}

export interface I18nSource extends MessageLookup {
  readonly settings: LocaleSettings;
  readonly messages: LocaleMessages;
}

export function defineI18n(input: I18nInput): I18nSource {
  const settings = localeSettings(input.config);
  const messages: Record<string, LocaleMessages[string]> = {};
  for (const [locale, value] of Object.entries(input.messages)) {
    if (!settings.locales.includes(locale)) {
      throw new TypeError(
        `rex: app/locales/${locale}.json is not one of i18n.locales (${settings.locales.join(", ")})`,
      );
    }
    messages[locale] = validateMessages(locale, value);
  }
  return Object.freeze({
    settings,
    default: settings.default,
    messages: Object.freeze(messages),
  });
}

const sources = new WeakMap<object, I18nSource>();

export function registerI18n(registry: object, input: I18nInput | I18nSource): () => void {
  if (typeof registry !== "object" || registry === null) {
    throw new TypeError("registerI18n: registry must be the app registry object");
  }
  const source = "settings" in input ? input : defineI18n(input);
  sources.set(registry, source);
  return () => {
    if (sources.get(registry) === source) sources.delete(registry);
  };
}

export function i18nFor(registry: object): I18nSource | null {
  return sources.get(registry) ?? null;
}

export interface I18nState {
  readonly source: I18nSource | null;
  readonly locale: string;
  setLocale(locale: string): void;
}

function notConfigured(): never {
  throw new Error("rex: i18n is not configured; register app/locales with registerI18n");
}

export const UNCONFIGURED_I18N: I18nState = Object.freeze({
  source: null,
  locale: UNCONFIGURED_LOCALE,
  setLocale: notConfigured,
});

export const I18nContext = createContext<I18nState>(UNCONFIGURED_I18N);
I18nContext.displayName = "RexI18n";

export const LocaleSeedContext = createContext<string | null>(null);
LocaleSeedContext.displayName = "RexLocaleSeed";

export function useI18n(): I18nState {
  return useContext(I18nContext);
}

export interface LocaleInfo {
  readonly locale: string;
  readonly locales: readonly string[];
  readonly defaultLocale: string;
  readonly routing: LocaleSettings["routing"] | null;
  set(locale: string): void;
}

export function useLocale(): LocaleInfo {
  const state = useI18n();
  const settings = state.source?.settings ?? null;
  return {
    locale: state.locale,
    locales: settings?.locales ?? [state.locale],
    defaultLocale: settings?.default ?? state.locale,
    routing: settings?.routing ?? null,
    set: state.setLocale,
  };
}

export type Translate = (key: string, values?: MessageValues) => string;

export function useT(): Translate {
  const { source, locale } = useI18n();
  return useCallback<Translate>(
    (key, values = {}) => message(source, locale, key, values),
    [source, locale],
  );
}

export type TextResolver = (text: string, values?: MessageValues) => string;

export function useText(): TextResolver {
  const { source, locale } = useI18n();
  return useCallback<TextResolver>(
    (text, values = {}) => translate(source, locale, text, values),
    [source, locale],
  );
}
