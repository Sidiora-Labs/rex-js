import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useMemo, useState, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { actor } from "../../core/actor.ts";
import type { I18nConfig } from "../../core/config.ts";
import { isRexError } from "../../core/errors.ts";
import { createRegistry } from "../../core/registry.ts";
import { buildManifest } from "../../manifest/build.ts";
import { createRexApp } from "../app.tsx";
import {
  I18nContext,
  LocaleSeedContext,
  UNCONFIGURED_I18N,
  UNCONFIGURED_LOCALE,
  defineI18n,
  i18nFor,
  registerI18n,
  useI18n,
  useLocale,
  useT,
  useText,
  type I18nSource,
  type I18nState,
  type LocaleInfo,
  type TextResolver,
  type Translate,
} from "./context.ts";
import { formatMessage } from "./format.ts";
import { messageFormatter } from "./formatter.ts";
import { LOCALE_COOKIE } from "./locale.ts";
import { t } from "./lookup.ts";
import { I18nProvider } from "./provider.tsx";
import { i18nRegistration } from "./registration.ts";

const CONFIG: I18nConfig = { locales: ["en", "pt-BR"], default: "en", routing: "prefix" };
const MESSAGES = {
  en: {
    "home.title": "Home",
    greeting: "Hello {name}",
    "cart.items": "{count, plural, one {# item} other {# items}}",
  },
  "pt-BR": { "home.title": "Início", greeting: "Olá {name}" },
};

interface Captured {
  readonly state: I18nState;
  readonly locale: LocaleInfo;
  readonly translate: Translate;
  readonly text: TextResolver;
}

const captures: Captured[] = [];

function Probe() {
  const state = useI18n();
  const locale = useLocale();
  const translate = useT();
  const text = useText();
  captures.push({ state, locale, translate, text });
  return (
    <div>
      <p data-testid="locale">{locale.locale}</p>
      <p data-testid="items">{translate("cart.items", { count: 2 })}</p>
      <p data-testid="text">{text(t("greeting", { name: "Ana" }))}</p>
      <button type="button" onClick={() => locale.set("pt-BR")}>
        to pt-BR
      </button>
      <button type="button" onClick={() => locale.set("en")}>
        to en
      </button>
    </div>
  );
}

interface ConfiguredProps {
  readonly source: I18nSource;
  readonly locale: string;
  readonly children: ReactNode;
}

function Configured({ source, locale: initial, children }: ConfiguredProps) {
  const [locale, setLocale] = useState(initial);
  const value = useMemo<I18nState>(
    () => ({ source, locale, format: formatMessage, setLocale }),
    [source, locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function last(): Captured {
  const captured = captures.at(-1);
  if (captured === undefined) throw new Error("the probe has not rendered");
  return captured;
}

function thrownBy(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return null;
}

async function click(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

afterEach(() => {
  cleanup();
  captures.length = 0;
  document.cookie = `${LOCALE_COOKIE}=; Path=/; Max-Age=0`;
  document.documentElement.removeAttribute("lang");
});

describe("defineI18n", () => {
  it("validates the config and message files into a frozen lookup", () => {
    const source = defineI18n({ config: CONFIG, messages: MESSAGES });
    expect(source.settings).toEqual({ locales: ["en", "pt-BR"], default: "en", routing: "prefix" });
    expect(source.default).toBe("en");
    expect(source.messages).toEqual(MESSAGES);
    expect(Object.isFrozen(source)).toBe(true);
    expect(Object.isFrozen(source.messages)).toBe(true);
    expect(Object.isFrozen(source.messages.en)).toBe(true);
    const bare = defineI18n({ config: { locales: ["en"], default: "en" }, messages: {} });
    expect(bare.settings.routing).toBe("none");
    expect(bare.messages).toEqual({});
  });

  it("rejects message files outside i18n.locales and invalid setups with REX316", () => {
    expect(() => defineI18n({ config: CONFIG, messages: { fr: {} } })).toThrow(
      /app\/locales\/fr\.json is not one of i18n\.locales \(en, pt-BR\)/,
    );
    expect(() => defineI18n({ config: { locales: [], default: "en" }, messages: {} })).toThrow(
      /at least one locale/,
    );
    const error = thrownBy(() => defineI18n({ config: CONFIG, messages: { en: { title: 1 } } }));
    expect(isRexError(error) && error.code).toBe("REX316");
  });
});

describe("registerI18n", () => {
  it("attaches the source and the lazy formatter to the registry until unregistered", async () => {
    const registry = createRegistry().freeze();
    expect(i18nFor(registry)).toBeNull();
    const unregister = registerI18n(registry, { config: CONFIG, messages: MESSAGES });
    const source = i18nFor(registry);
    expect(source?.messages).toEqual(MESSAGES);
    expect(source?.settings.locales).toEqual(["en", "pt-BR"]);
    expect(i18nRegistration(registry)?.formatter).toBe(messageFormatter);
    const loaded = await messageFormatter.load();
    expect(loaded.ok && loaded.value).toBe(formatMessage);
    unregister();
    expect(i18nFor(registry)).toBeNull();
  });

  it("accepts a defined source and lets a newer registration outlive a stale unregister", () => {
    const registry = createRegistry().freeze();
    const source = defineI18n({ config: CONFIG, messages: MESSAGES });
    const first = registerI18n(registry, {
      config: { locales: ["en"], default: "en" },
      messages: {},
    });
    registerI18n(registry, source);
    expect(i18nFor(registry)).toBe(source);
    first();
    expect(i18nFor(registry)).toBe(source);
  });

  it("rejects a registry that is not an object with REX329", () => {
    const error = thrownBy(() =>
      registerI18n("registry" as never, { config: CONFIG, messages: MESSAGES }),
    );
    expect(isRexError(error) && error.code).toBe("REX329");
    expect(error).toMatchObject({
      detail: "registerI18n: registry must be the app registry object",
    });
    expect(() => registerI18n(null as never, { config: CONFIG, messages: MESSAGES })).toThrow(
      /registry must be the app registry object/,
    );
    expect(i18nFor({})).toBeNull();
  });
});

describe("hooks without a provider", () => {
  it("expose the unconfigured state and resolve keys and refs to their keys", () => {
    render(<Probe />);
    const { state, locale, translate, text } = last();
    expect(state).toBe(UNCONFIGURED_I18N);
    expect(UNCONFIGURED_LOCALE).toBe("en");
    expect(UNCONFIGURED_I18N).toMatchObject({ source: null, locale: "en", format: null });
    expect(Object.isFrozen(UNCONFIGURED_I18N)).toBe(true);
    expect(I18nContext.displayName).toBe("RexI18n");
    expect(LocaleSeedContext.displayName).toBe("RexLocaleSeed");
    expect(locale).toEqual({
      locale: "en",
      locales: ["en"],
      defaultLocale: "en",
      routing: null,
      set: UNCONFIGURED_I18N.setLocale,
    });
    expect(translate("cart.items", { count: 2 })).toBe("cart.items");
    expect(text(t("greeting", { name: "Ana" }))).toBe("greeting");
    expect(text("Plain")).toBe("Plain");
    expect(screen.getByTestId("items").textContent).toBe("cart.items");
    const error = thrownBy(() => locale.set("pt-BR"));
    expect(isRexError(error) && error.code).toBe("REX316");
    expect(error).toMatchObject({
      detail: "rex: i18n is not configured; register app/locales with registerI18n",
    });
  });
});

describe("hooks with a configured state", () => {
  it("read the settings, translate along the locale chain and resolve msg: refs", async () => {
    const source = defineI18n({ config: CONFIG, messages: MESSAGES });
    const tree = () => (
      <Configured source={source} locale="pt-BR">
        <Probe />
      </Configured>
    );
    const { rerender } = render(tree());
    const first = last();
    expect(first.state.source).toBe(source);
    expect(first.locale).toMatchObject({
      locale: "pt-BR",
      locales: ["en", "pt-BR"],
      defaultLocale: "en",
      routing: "prefix",
    });
    expect(screen.getByTestId("items").textContent).toBe("2 items");
    expect(screen.getByTestId("text").textContent).toBe("Olá Ana");
    expect(first.translate("home.title")).toBe("Início");
    expect(first.text("msg:home.title")).toBe("Início");
    expect(first.translate("missing.key")).toBe("missing.key");

    rerender(tree());
    expect(captures.length).toBeGreaterThan(1);
    expect(last().translate).toBe(first.translate);
    expect(last().text).toBe(first.text);

    await click("to en");
    expect(screen.getByTestId("locale").textContent).toBe("en");
    expect(screen.getByTestId("text").textContent).toBe("Hello Ana");
    expect(last().translate).not.toBe(first.translate);
    expect(last().translate("home.title")).toBe("Home");
  });
});

describe("I18nProvider integration", () => {
  function rexApp(
    registry: ReturnType<typeof createRegistry>["freeze"] extends () => infer R ? R : never,
  ) {
    return createRexApp({
      registry,
      manifest: buildManifest(registry),
      actor: actor({ id: "viewer" }),
      baseUrl: "http://rex.test",
    });
  }

  it("serves the unconfigured state when the registry has no locales", () => {
    const registry = createRegistry().freeze();
    const RexApp = rexApp(registry);
    render(
      <RexApp>
        <I18nProvider>
          <Probe />
        </I18nProvider>
      </RexApp>,
    );
    expect(last().state).toBe(UNCONFIGURED_I18N);
    expect(screen.getByTestId("text").textContent).toBe("greeting");
    expect(screen.getByTestId("locale").textContent).toBe(UNCONFIGURED_LOCALE);
  });

  it("serves the registered source, switches the locale and writes the cookie", async () => {
    const registry = createRegistry().freeze();
    registerI18n(registry, {
      config: { locales: ["en", "pt-BR"], default: "en", routing: "none" },
      messages: MESSAGES,
    });
    await messageFormatter.load();
    const RexApp = rexApp(registry);
    render(
      <RexApp>
        <I18nProvider>
          <Probe />
        </I18nProvider>
      </RexApp>,
    );
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("2 items"));
    expect(last().state.source).toBe(i18nFor(registry));
    expect(last().state.format).toBe(formatMessage);
    expect(last().locale).toMatchObject({
      locale: "en",
      locales: ["en", "pt-BR"],
      defaultLocale: "en",
      routing: "none",
    });
    await click("to pt-BR");
    expect(screen.getByTestId("locale").textContent).toBe("pt-BR");
    expect(screen.getByTestId("text").textContent).toBe("Olá Ana");
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=pt-BR`);
    expect(document.documentElement.lang).toBe("pt-BR");
    const error = thrownBy(() => last().locale.set("fr"));
    expect(isRexError(error) && error.code).toBe("REX316");
    expect(error).toMatchObject({ detail: 'rex: locale "fr" is not one of en, pt-BR' });
  });
});
