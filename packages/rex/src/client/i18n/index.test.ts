import { describe, expect, it } from "vitest";
import * as context from "./context.ts";
import * as format from "./format.ts";
import * as formatter from "./formatter.ts";
import * as index from "./index.ts";
import * as locale from "./locale.ts";
import * as lookup from "./lookup.ts";
import * as messages from "./messages.ts";
import * as provider from "./provider.tsx";
import * as registration from "./registration.ts";

const starred = { format, messages, locale, context } as const;

function exported(module: object): Record<string, unknown> {
  return module as Record<string, unknown>;
}

function names(module: object): string[] {
  return Object.keys(module).sort();
}

describe("i18n index", () => {
  it("re-exports the format, messages, locale and context modules by identity", () => {
    for (const [name, module] of Object.entries(starred)) {
      expect(names(module).length, name).toBeGreaterThan(0);
      for (const key of names(module)) {
        expect(exported(index)[key], `${name}.${key}`).toBe(exported(module)[key]);
      }
    }
  });

  it("exposes only I18nProvider and detectClientLocale from the provider", () => {
    expect(index.I18nProvider).toBe(provider.I18nProvider);
    expect(index.detectClientLocale).toBe(provider.detectClientLocale);
    const expected = [
      ...new Set([
        ...Object.values(starred).flatMap((module) => Object.keys(module)),
        "I18nProvider",
        "detectClientLocale",
      ]),
    ].sort();
    expect(expected).toContain("registerI18n");
    expect(expected).toContain("formatMessage");
    expect(names(index)).toEqual(expected);
  });

  it("keeps the lazy formatter and the registration store out of the public entry", () => {
    expect(names(formatter)).toEqual(["messageFormatter"]);
    expect(names(registration)).toEqual(["i18nRegistration", "setI18nRegistration"]);
    for (const key of [...names(formatter), ...names(registration)]) {
      expect(index).not.toHaveProperty(key);
    }
  });

  it("carries the lookup helpers through messages so msg: refs round-trip", () => {
    for (const key of names(lookup)) {
      expect(exported(index)[key], key).toBe(exported(lookup)[key]);
    }
    const catalog = { default: "en", messages: { en: { hi: "Hi {name}" } } };
    expect(index.translate(catalog, "en", index.t("hi", { name: "Ada" }))).toBe("Hi Ada");
    expect(index.message(catalog, "en", "hi", { name: "Grace" })).toBe("Hi Grace");
  });
});
