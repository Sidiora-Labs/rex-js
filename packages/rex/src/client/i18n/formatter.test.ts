import { describe, expect, it } from "vitest";
import { createRegistry } from "../../core/registry.ts";
import { registerI18n } from "./context.ts";
import { formatMessage } from "./format.ts";
import { messageFormatter } from "./formatter.ts";
import { i18nRegistration } from "./registration.ts";

describe("messageFormatter", () => {
  it("is the lazy module for the formatter and resolves to formatMessage once", async () => {
    expect(messageFormatter.id).toBe("rex.i18n-format");
    expect(messageFormatter.label).toBe("the message formatter");
    expect(messageFormatter.peek()).toBeNull();
    const loaded = await messageFormatter.load();
    if (!loaded.ok) throw loaded.error;
    expect(loaded.value).toBe(formatMessage);
    expect(messageFormatter.peek()).toBe(loaded);
    expect(await messageFormatter.load()).toBe(loaded);
  });

  it("formats patterns for a locale through the loaded module", async () => {
    const loaded = await messageFormatter.load();
    if (!loaded.ok) throw loaded.error;
    expect(loaded.value("{n, plural, one {# file} other {# files}}", { n: 1200 }, "de")).toBe(
      "1.200 files",
    );
    expect(loaded.value("Hi {name}", { name: "Ada" }, "en")).toBe("Hi Ada");
    expect(loaded.value("Hi {name}", {}, "en")).toBe("Hi {name}");
  });

  it("is the formatter registerI18n attaches to the app registry", () => {
    const registry = createRegistry().freeze();
    const unregister = registerI18n(registry, {
      config: { locales: ["en"], default: "en" },
      messages: { en: { hi: "Hi" } },
    });
    expect(i18nRegistration(registry)?.formatter).toBe(messageFormatter);
    unregister();
    expect(i18nRegistration(registry)).toBeNull();
  });
});
