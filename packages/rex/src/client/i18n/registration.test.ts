import { describe, expect, it } from "vitest";
import type { I18nConfig } from "../../core/config.ts";
import { createRegistry } from "../../core/registry.ts";
import { defineI18n, i18nFor, registerI18n } from "./context.ts";
import { formatMessage } from "./format.ts";
import { messageFormatter } from "./formatter.ts";
import { i18nRegistration, setI18nRegistration, type I18nRegistration } from "./registration.ts";

const CONFIG: I18nConfig = { locales: ["en", "pt-BR"], default: "en", routing: "prefix" };

function registration(messages: Readonly<Record<string, unknown>>): I18nRegistration {
  return { source: defineI18n({ config: CONFIG, messages }), formatter: messageFormatter };
}

describe("i18n registration", () => {
  it("keys registrations by the identity of the registry object", () => {
    const registry = createRegistry().freeze();
    const other = createRegistry().freeze();
    expect(i18nRegistration(registry)).toBeNull();
    const entry = registration({ en: { "home.title": "Home" } });
    setI18nRegistration(registry, entry);
    expect(i18nRegistration(registry)).toBe(entry);
    expect(i18nRegistration(other)).toBeNull();
    expect(i18nRegistration({ ...registry })).toBeNull();
    expect(() => setI18nRegistration("app" as unknown as object, entry)).toThrow(TypeError);
  });

  it("replaces an earlier registration and lets only the current one unregister", () => {
    const registry = createRegistry().freeze();
    const first = registration({ en: { "home.title": "Home" } });
    const second = registration({ "pt-BR": { "home.title": "Início" } });
    const unregisterFirst = setI18nRegistration(registry, first);
    const unregisterSecond = setI18nRegistration(registry, second);
    expect(i18nRegistration(registry)).toBe(second);
    unregisterFirst();
    expect(i18nRegistration(registry)).toBe(second);
    unregisterSecond();
    expect(i18nRegistration(registry)).toBeNull();
    unregisterSecond();
    expect(i18nRegistration(registry)).toBeNull();
  });

  it("backs registerI18n and i18nFor with the lazy message formatter", async () => {
    const registry = createRegistry().freeze();
    const unregister = registerI18n(registry, {
      config: CONFIG,
      messages: { "pt-BR": { "home.title": "Início" } },
    });
    const registered = i18nRegistration(registry);
    if (registered === null) throw new Error("registerI18n left no registration");
    expect(registered.formatter).toBe(messageFormatter);
    expect(registered.source).toBe(i18nFor(registry));
    expect(registered.source.settings).toEqual({
      locales: ["en", "pt-BR"],
      default: "en",
      routing: "prefix",
    });
    expect(registered.source.default).toBe("en");
    expect(registered.source.messages).toEqual({ "pt-BR": { "home.title": "Início" } });
    const loaded = await registered.formatter.load();
    if (!loaded.ok) throw loaded.error;
    expect(loaded.value).toBe(formatMessage);
    expect(loaded.value("Olá {name}", { name: "Ana" }, "pt-BR")).toBe("Olá Ana");
    unregister();
    expect(i18nRegistration(registry)).toBeNull();
    expect(i18nFor(registry)).toBeNull();
  });
});
