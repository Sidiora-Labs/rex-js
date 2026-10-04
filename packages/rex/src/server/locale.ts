import { parse as parseCookieHeader } from "hono/utils/cookie";
import type { I18nConfig } from "../core/config.ts";
import {
  LOCALE_COOKIE,
  localeSettings,
  resolveLocale,
  type LocaleResolution,
  type LocaleSettings,
} from "../client/i18n/locale.ts";

export { LOCALE_COOKIE, type LocaleResolution, type LocaleSettings };

export const ACCEPT_LANGUAGE_HEADER = "accept-language";

interface WeightedLanguage {
  readonly tag: string;
  readonly quality: number;
  readonly order: number;
}

export function parseAcceptLanguage(header: string | null): readonly string[] {
  if (header === null || header.trim() === "") return [];
  const weighted: WeightedLanguage[] = [];
  header.split(",").forEach((part, order) => {
    const [rawTag, ...parameters] = part.trim().split(";");
    const tag = (rawTag ?? "").trim();
    if (tag === "" || tag === "*") return;
    let quality = 1;
    for (const parameter of parameters) {
      const [name, value] = parameter.trim().split("=");
      if (name?.trim() === "q" && value !== undefined) quality = Number(value.trim());
    }
    if (!Number.isFinite(quality) || quality <= 0) return;
    weighted.push({ tag, quality, order });
  });
  return weighted
    .sort((a, b) => b.quality - a.quality || a.order - b.order)
    .map((entry) => entry.tag);
}

export function requestLocaleCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (header === null) return null;
  return parseCookieHeader(header, LOCALE_COOKIE)[LOCALE_COOKIE] ?? null;
}

export function resolveRequestLocale(
  request: Request,
  i18n: I18nConfig | LocaleSettings,
): LocaleResolution {
  const settings = localeSettings(i18n);
  return resolveLocale(settings, {
    pathname: new URL(request.url).pathname,
    cookie: requestLocaleCookie(request),
    languages: parseAcceptLanguage(request.headers.get(ACCEPT_LANGUAGE_HEADER)),
  });
}
