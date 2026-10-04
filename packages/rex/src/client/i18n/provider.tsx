import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { RexError } from "../../core/errors.ts";
import { readCookie } from "../agent/outcome.tsx";
import { useRegistry } from "../context.ts";
import { SSR_ATTRIBUTE } from "../hydrate.ts";
import type { RexProviderProps } from "../providers.ts";
import {
  I18nContext,
  LocaleSeedContext,
  UNCONFIGURED_I18N,
  i18nFor,
  type I18nSource,
  type I18nState,
} from "./context.ts";
import {
  LOCALE_COOKIE,
  localeCookie,
  localePrefix,
  localizeHref,
  matchLocale,
  resolveLocale,
  stripLocalePrefix,
  type LocaleSettings,
} from "./locale.ts";

function cookieLocale(source: string): string | null {
  const raw = readCookie(LOCALE_COOKIE, source);
  if (raw === null || raw === "") return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function detectClientLocale(settings: LocaleSettings): string {
  const doc = globalThis.document;
  const cookie = doc === undefined ? null : cookieLocale(doc.cookie);
  const fromCookie = resolveLocale(settings, { cookie });
  if (fromCookie.source === "cookie") return fromCookie.locale;
  if (doc !== undefined && doc.querySelector(`[${SSR_ATTRIBUTE}]`) !== null) {
    const rendered = settings.locales.find((locale) => locale === doc.documentElement.lang);
    if (rendered !== undefined) return rendered;
  }
  const languages = globalThis.navigator?.languages ?? [];
  return resolveLocale(settings, { languages }).locale;
}

function ConfiguredI18n({ source, children }: RexProviderProps & { readonly source: I18nSource }) {
  const settings = source.settings;
  const seed = useContext(LocaleSeedContext);
  const [path, navigate] = useLocation();
  const search = useSearch();
  const [detected] = useState(() => {
    const seeded = seed === null ? null : matchLocale(seed, settings.locales);
    return seeded ?? detectClientLocale(settings);
  });
  const [chosen, setChosen] = useState<string | null>(null);
  const prefixed = settings.routing === "prefix" ? localePrefix(path, settings.locales) : null;
  const locale = prefixed ?? chosen ?? detected;

  const setLocale = useCallback(
    (next: string) => {
      if (!settings.locales.includes(next)) {
        throw new RexError("REX316", `rex: locale "${next}" is not one of ${settings.locales.join(", ")}`);
      }
      if (globalThis.document !== undefined) globalThis.document.cookie = localeCookie(next);
      setChosen(next);
      if (settings.routing === "prefix") {
        const rest = stripLocalePrefix(path, settings.locales);
        navigate(localizeHref(search === "" ? rest : `${rest}?${search}`, next));
      }
    },
    [navigate, path, search, settings],
  );

  useEffect(() => {
    const doc = globalThis.document;
    if (doc !== undefined) doc.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nState>(() => ({ source, locale, setLocale }), [source, locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function I18nProvider({ children }: RexProviderProps) {
  const source = i18nFor(useRegistry());
  if (source === null) {
    return <I18nContext.Provider value={UNCONFIGURED_I18N}>{children}</I18nContext.Provider>;
  }
  return <ConfiguredI18n source={source}>{children}</ConfiguredI18n>;
}
