import type { I18nConfig, I18nRouting } from "../../core/config.ts";

export const LOCALE_COOKIE = "rex-locale";
export const LOCALE_COOKIE_MAX_AGE = 31_536_000;

export const LOCALE_SOURCES = ["prefix", "cookie", "accept-language", "default"] as const;
export type LocaleSource = (typeof LOCALE_SOURCES)[number];

export interface LocaleSettings {
  readonly locales: readonly string[];
  readonly default: string;
  readonly routing: I18nRouting;
}

export interface LocaleResolution {
  readonly locale: string;
  readonly source: LocaleSource;
}

export interface LocaleInputs {
  readonly pathname?: string | null;
  readonly cookie?: string | null;
  readonly languages?: readonly string[];
}

export function localeSettings(config: I18nConfig): LocaleSettings {
  const locales = config.locales;
  if (!Array.isArray(locales) || locales.length === 0) {
    throw new TypeError("rex: i18n.locales must list at least one locale");
  }
  if (!locales.includes(config.default)) {
    throw new TypeError(`rex: i18n.default "${config.default}" must be one of i18n.locales`);
  }
  const routing = config.routing ?? "none";
  if (routing !== "prefix" && routing !== "none") {
    throw new TypeError('rex: i18n.routing must be "prefix" or "none"');
  }
  return Object.freeze({ locales: Object.freeze([...locales]), default: config.default, routing });
}

export function matchLocale(candidate: string, locales: readonly string[]): string | null {
  const wanted = candidate.trim().toLowerCase();
  if (wanted === "") return null;
  const exact = locales.find((locale) => locale.toLowerCase() === wanted);
  if (exact !== undefined) return exact;
  const base = wanted.split("-")[0] as string;
  return locales.find((locale) => (locale.toLowerCase().split("-")[0] as string) === base) ?? null;
}

export function negotiateLocale(
  candidates: readonly string[],
  locales: readonly string[],
): string | null {
  for (const candidate of candidates) {
    const found = matchLocale(candidate, locales);
    if (found !== null) return found;
  }
  return null;
}

export function localePrefix(pathname: string, locales: readonly string[]): string | null {
  const segment = pathname.split("/")[1] ?? "";
  if (segment === "") return null;
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return null;
  }
  return locales.find((locale) => locale.toLowerCase() === decoded.toLowerCase()) ?? null;
}

export function stripLocalePrefix(pathname: string, locales: readonly string[]): string {
  const locale = localePrefix(pathname, locales);
  if (locale === null) return pathname;
  return pathname.slice(locale.length + 1) || "/";
}

export function localizeHref(href: string, locale: string): string {
  const split = href.search(/[?#]/);
  const path = split === -1 ? href : href.slice(0, split);
  const rest = split === -1 ? "" : href.slice(split);
  return `/${locale}${path === "/" ? "" : path}${rest}`;
}

export function resolveLocale(settings: LocaleSettings, inputs: LocaleInputs): LocaleResolution {
  if (settings.routing === "prefix" && typeof inputs.pathname === "string") {
    const prefixed = localePrefix(inputs.pathname, settings.locales);
    if (prefixed !== null) return { locale: prefixed, source: "prefix" };
  }
  if (typeof inputs.cookie === "string") {
    const cookie = matchLocale(inputs.cookie, settings.locales);
    if (cookie !== null) return { locale: cookie, source: "cookie" };
  }
  const accepted = negotiateLocale(inputs.languages ?? [], settings.locales);
  if (accepted !== null) return { locale: accepted, source: "accept-language" };
  return { locale: settings.default, source: "default" };
}

export function localeCookie(locale: string): string {
  return `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}
