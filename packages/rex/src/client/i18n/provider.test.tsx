import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { actor } from "../../core/actor.ts";
import type { I18nConfig } from "../../core/config.ts";
import { page } from "../../core/page.ts";
import { createRegistry, type RegistrySnapshot } from "../../core/registry.ts";
import { text } from "../../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest } from "../../manifest/build.ts";
import { createRexApp } from "../app.tsx";
import { SSR_ATTRIBUTE } from "../hydrate.ts";
import {
  LocaleSeedContext,
  UNCONFIGURED_I18N,
  i18nFor,
  registerI18n,
  useI18n,
  useLocale,
  useT,
  type I18nState,
} from "./context.ts";
import { formatMessage } from "./format.ts";
import { messageFormatter } from "./formatter.ts";
import { LOCALE_COOKIE, type LocaleSettings } from "./locale.ts";
import { I18nProvider, detectClientLocale } from "./provider.tsx";

const home = page("home", { route: "/", states: ["ready"] });
const detail = page("detail", {
  route: "/detail/:id",
  params: z.object({ id: text({ min: 1 }) }),
  states: ["ready"],
});

const MESSAGES = {
  en: { "cart.items": "{count, plural, =0 {No items} one {# item} other {# items}}" },
  "pt-BR": { "cart.items": "{count, plural, =0 {Nenhum item} one {# item} other {# itens}}" },
} as const;

const SETTINGS: LocaleSettings = { locales: ["en", "pt-BR"], default: "en", routing: "none" };

function appRegistry(config: I18nConfig | null): RegistrySnapshot {
  const registry = createRegistry().register(home, detail).freeze();
  if (config !== null) registerI18n(registry, { config, messages: MESSAGES });
  return registry;
}

const plainRegistry = appRegistry(null);
const noneRegistry = appRegistry({ locales: ["en", "pt-BR"], default: "en", routing: "none" });
const prefixRegistry = appRegistry({ locales: ["en", "pt-BR"], default: "en", routing: "prefix" });
const viewer = actor({ id: "viewer" });

interface Captured {
  state: I18nState | null;
}

function Probe({ captured }: { readonly captured: Captured }) {
  const state = useI18n();
  const locale = useLocale();
  const translate = useT();
  captured.state = state;
  return (
    <div>
      <p data-testid="locale">{state.locale}</p>
      <p data-testid="locales">{locale.locales.join(",")}</p>
      <p data-testid="items">{translate("cart.items", { count: 3 })}</p>
    </div>
  );
}

async function mount(registry: RegistrySnapshot, path: string, seed: string | null = null) {
  const memory = memoryLocation({ path, record: true });
  const RexApp = createRexApp({
    registry,
    manifest: buildManifest(registry),
    actor: viewer,
    baseUrl: "http://rex.test",
  });
  const captured: Captured = { state: null };
  await act(async () => {
    render(
      <RexApp>
        <Router hook={memory.hook}>
          <LocaleSeedContext.Provider value={seed}>
            <I18nProvider>
              <Probe captured={captured} />
            </I18nProvider>
          </LocaleSeedContext.Provider>
        </Router>
      </RexApp>,
    );
  });
  const state = (): I18nState => {
    if (captured.state === null) throw new Error("the probe did not render");
    return captured.state;
  };
  return { memory, state };
}

function withLanguages<T>(languages: readonly string[], run: () => T): T {
  const target = globalThis.navigator;
  const own = Object.getOwnPropertyDescriptor(target, "languages");
  Object.defineProperty(target, "languages", { configurable: true, get: () => languages });
  try {
    return run();
  } finally {
    if (own === undefined) Reflect.deleteProperty(target, "languages");
    else Object.defineProperty(target, "languages", own);
  }
}

function silenced(run: () => void) {
  const original = console.error;
  console.error = () => {};
  try {
    run();
  } finally {
    console.error = original;
  }
}

function clearLocaleCookie() {
  document.cookie = `${LOCALE_COOKIE}=; Path=/; Max-Age=0`;
}

beforeAll(async () => {
  await messageFormatter.load();
});

afterEach(() => {
  cleanup();
  clearLocaleCookie();
  document.documentElement.removeAttribute("lang");
  document.body.innerHTML = "";
});

describe("detectClientLocale", () => {
  it("prefers the cookie, then the server-rendered lang, then the browser languages, then the default", () => {
    withLanguages(["de-DE", "pt-PT"], () => {
      document.cookie = `${LOCALE_COOKIE}=pt%2DBR; Path=/`;
      document.documentElement.lang = "en";
      expect(detectClientLocale(SETTINGS)).toBe("pt-BR");
      clearLocaleCookie();
      expect(detectClientLocale(SETTINGS)).toBe("pt-BR");
    });
    withLanguages(["de-DE"], () => {
      expect(detectClientLocale(SETTINGS)).toBe("en");
      document.documentElement.lang = "pt-BR";
      expect(detectClientLocale(SETTINGS)).toBe("en");
      const marker = document.createElement("div");
      marker.setAttribute(SSR_ATTRIBUTE, "");
      document.body.append(marker);
      expect(detectClientLocale(SETTINGS)).toBe("pt-BR");
      document.documentElement.lang = "fr";
      expect(detectClientLocale(SETTINGS)).toBe("en");
      document.cookie = `${LOCALE_COOKIE}=en; Path=/`;
      document.documentElement.lang = "pt-BR";
      expect(detectClientLocale(SETTINGS)).toBe("en");
    });
  });
});

describe("I18nProvider", () => {
  it("requires the RexApp runtime", () => {
    silenced(() => {
      expect(() =>
        render(
          <I18nProvider>
            <p>orphan</p>
          </I18nProvider>,
        ),
      ).toThrow(expect.objectContaining({ name: "RexError", code: "REX306" }));
    });
  });

  it("provides the unconfigured state when the registry has no i18n", async () => {
    const { state } = await mount(plainRegistry, "/");
    expect(state()).toBe(UNCONFIGURED_I18N);
    expect(screen.getByTestId("locale").textContent).toBe("en");
    expect(screen.getByTestId("locales").textContent).toBe("en");
    expect(screen.getByTestId("items").textContent).toBe("cart.items");
    expect(() => state().setLocale("pt-BR")).toThrow(
      expect.objectContaining({ name: "RexError", code: "REX316" }),
    );
    expect(document.documentElement.hasAttribute("lang")).toBe(false);
  });

  it("resolves the cookie locale without routing, formats messages and switches in place", async () => {
    document.cookie = `${LOCALE_COOKIE}=pt-BR; Path=/`;
    const { memory, state } = await mount(noneRegistry, "/detail/4");
    expect(state().locale).toBe("pt-BR");
    expect(state().source).toBe(i18nFor(noneRegistry));
    expect(state().format).toBe(formatMessage);
    expect(screen.getByTestId("locales").textContent).toBe("en,pt-BR");
    expect(screen.getByTestId("items").textContent).toBe("3 itens");
    expect(document.documentElement.lang).toBe("pt-BR");
    await act(async () => {
      state().setLocale("en");
    });
    expect(state().locale).toBe("en");
    expect(screen.getByTestId("items").textContent).toBe("3 items");
    expect(document.documentElement.lang).toBe("en");
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=en`);
    expect(memory.history).toEqual(["/detail/4"]);
  });

  it("rejects a locale outside the configured list without changing anything", async () => {
    const { state } = await mount(noneRegistry, "/");
    const before = state();
    expect(() => before.setLocale("fr")).toThrow('rex: locale "fr" is not one of en, pt-BR');
    expect(() => before.setLocale("fr")).toThrow(
      expect.objectContaining({ name: "RexError", code: "REX316" }),
    );
    expect(state()).toBe(before);
    expect(state().locale).toBe("en");
    expect(document.cookie).not.toContain(`${LOCALE_COOKIE}=fr`);
    expect(document.documentElement.lang).toBe("en");
  });

  it("takes the locale from the path prefix and keeps the route and query when switching", async () => {
    document.cookie = `${LOCALE_COOKIE}=en; Path=/`;
    const { memory, state } = await mount(prefixRegistry, "/pt-br/detail/9?tab=x");
    expect(state().locale).toBe("pt-BR");
    expect(screen.getByTestId("items").textContent).toBe("3 itens");
    expect(document.documentElement.lang).toBe("pt-BR");
    await act(async () => {
      state().setLocale("en");
    });
    expect(memory.history).toEqual(["/pt-br/detail/9?tab=x", "/en/detail/9?tab=x"]);
    expect(state().locale).toBe("en");
    expect(screen.getByTestId("items").textContent).toBe("3 items");
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=en`);
    expect(document.documentElement.lang).toBe("en");
  });

  it("seeds the detected locale from LocaleSeedContext ahead of the cookie", async () => {
    document.cookie = `${LOCALE_COOKIE}=pt-BR; Path=/`;
    const seeded = await mount(noneRegistry, "/", "EN");
    expect(seeded.state().locale).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    cleanup();
    const unmatched = await mount(noneRegistry, "/", "fr");
    expect(unmatched.state().locale).toBe("pt-BR");
    expect(document.documentElement.lang).toBe("pt-BR");
  });
});
