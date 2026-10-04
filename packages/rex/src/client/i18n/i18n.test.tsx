import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router, useRouter, type Parser } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { runGenerators } from "../../cli/generators.ts";
import { DEFAULT_APP_LOCALE, localeFilePath } from "../../cli/gen/i18n.ts";
import { action } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import type { I18nConfig } from "../../core/config.ts";
import { page, titleFromId } from "../../core/page.ts";
import { always } from "../../core/policy.ts";
import { createRegistry, type RegistrySnapshot } from "../../core/registry.ts";
import { boolean, text, z } from "../../core/schema.ts";
import { buildManifest } from "../../manifest/build.ts";
import { createRexContext } from "../../server/context.ts";
import { parseAcceptLanguage, resolveRequestLocale } from "../../server/locale.ts";
import { createRexRenderer } from "../../server/ssr.ts";
import { readSidecar } from "../agent/sidecar.tsx";
import { createRexApp } from "../app.tsx";
import { useNav } from "../nav.ts";
import { createOutcomeStore, OutcomeProvider, type OutcomeStore } from "../outcome.ts";
import { definePageModules, view, type PageModuleSet } from "../page.tsx";
import { RexProviders } from "../providers.ts";
import { routableDestination, type NavigateEventLike } from "../router.tsx";
import { AgentOutcome, Shell } from "../shell.tsx";
import { registerI18n, useLocale, useT, useText } from "./context.ts";
import { MessageFormatError, formatMessage } from "./format.ts";
import {
  LOCALE_COOKIE,
  localePrefix,
  localizeHref,
  matchLocale,
  resolveLocale,
  stripLocalePrefix,
  type LocaleSettings,
} from "./locale.ts";
import { MSG_PREFIX, message, parseMessageRef, t, translate } from "./messages.ts";

const send = action("send", {
  input: z.object({}),
  output: z.object({ sent: boolean() }),
  policy: always(),
  effect: "reversible",
  label: "msg:send.label",
  handler: () => ({ sent: true }),
});

const home = page("home", {
  route: "/",
  actions: [send],
  chrome: { title: "msg:home.title" },
  states: ["ready"],
});

const detail = page("detail", {
  route: "/detail/:id",
  params: z.object({ id: text({ min: 1 }) }),
  chrome: { title: "msg:detail.title", nav: false, back: "home" },
  states: ["ready"],
});

const MESSAGES = {
  en: {
    "home.title": "Home",
    "detail.title": "Detail",
    "send.label": "Send funds",
    "send.done": "Sent {amount} to {name}",
    "cart.items": "{count, plural, =0 {No items} one {# item} other {# items}}",
  },
  "pt-BR": {
    "home.title": "Início",
    "detail.title": "Detalhe",
    "send.label": "Enviar fundos",
    "send.done": "Enviado {amount} para {name}",
    "cart.items": "{count, plural, =0 {Nenhum item} one {# item} other {# itens}}",
  },
} as const;

const PREFIX: I18nConfig = { locales: ["en", "pt-BR"], default: "en", routing: "prefix" };
const NONE: I18nConfig = { locales: ["en", "pt-BR"], default: "en", routing: "none" };

function HomeView() {
  const translateKey = useT();
  const resolve = useText();
  const locale = useLocale();
  const nav = useNav();
  const detailHref = nav.href(detail, { id: "7" });
  return (
    <div>
      <p data-testid="items">{translateKey("cart.items", { count: 3 })}</p>
      <p data-testid="none">{translateKey("cart.items", { count: 0 })}</p>
      <p data-testid="resolved">{resolve(t("send.done", { amount: 5, name: "Ana" }))}</p>
      <p data-testid="locale">{locale.locale}</p>
      <a data-testid="detail-link" href={detailHref.ok ? detailHref.href : undefined}>
        detail
      </a>
      <button type="button" onClick={() => nav.to(detail, { id: "7" })}>
        open detail
      </button>
      <button type="button" onClick={() => locale.set("pt-BR")}>
        to pt-BR
      </button>
      <button type="button" onClick={() => locale.set("en")}>
        to en
      </button>
    </div>
  );
}

function DetailView({ params }: { readonly params: { readonly id: string } }) {
  const locale = useLocale();
  return (
    <div>
      <p>Detail body {params.id}</p>
      <button type="button" onClick={() => locale.set("en")}>
        detail to en
      </button>
    </div>
  );
}

const pages: readonly PageModuleSet[] = [
  definePageModules({ page: home, view: view(() => <HomeView />), states: {} }),
  definePageModules({
    page: detail,
    view: view<{ readonly id: string }>(({ params }) => <DetailView params={params} />),
    states: {},
  }),
];

function appRegistry(config: I18nConfig): RegistrySnapshot {
  const registry = createRegistry().register(send, home, detail).freeze();
  registerI18n(registry, { config, messages: MESSAGES });
  return registry;
}

const prefixRegistry = appRegistry(PREFIX);
const noneRegistry = appRegistry(NONE);
const viewer = actor({ id: "viewer" });

function mount(registry: RegistrySnapshot, path: string) {
  const memory = memoryLocation({ path, record: true });
  const store: OutcomeStore = createOutcomeStore();
  const RexApp = createRexApp({
    registry,
    manifest: buildManifest(registry),
    actor: viewer,
    baseUrl: "http://rex.test",
  });
  render(
    <OutcomeProvider store={store}>
      <RexApp>
        <Router hook={memory.hook}>
          <RexProviders>
            <Shell pages={pages} outcome={AgentOutcome} />
          </RexProviders>
        </Router>
      </RexApp>
    </OutcomeProvider>,
  );
  return { memory, store };
}

function heading(): string {
  return screen.getByRole("heading", { level: 1 }).textContent ?? "";
}

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

function serverRequest(url: string, headers: Readonly<Record<string, string>> = {}): Request {
  const request = new Request(url);
  for (const [name, value] of Object.entries(headers)) request.headers.set(name, value);
  return request;
}

function clearLocaleCookie() {
  document.cookie = `${LOCALE_COOKIE}=; Path=/; Max-Age=0`;
}

afterEach(() => {
  cleanup();
  clearLocaleCookie();
  document.documentElement.removeAttribute("lang");
});

describe("message formatter", () => {
  it("fills placeholders and formats numbers for the locale", () => {
    expect(formatMessage("Hello {name}!", { name: "Ana" }, "en")).toBe("Hello Ana!");
    expect(formatMessage("{n} coins", { n: 1234.5 }, "en")).toBe("1,234.5 coins");
    expect(formatMessage("{n, number} coins", { n: "1234.5" }, "pt-BR")).toBe("1.234,5 coins");
    expect(formatMessage("Hello {name}", {}, "en")).toBe("Hello {name}");
  });

  it("selects plural forms through Intl.PluralRules with exact matches and offsets", () => {
    const items = "{count, plural, =0 {No items} one {# item} other {# items}}";
    expect(formatMessage(items, { count: 0 }, "en")).toBe("No items");
    expect(formatMessage(items, { count: 1 }, "en")).toBe("1 item");
    expect(formatMessage(items, { count: 2500 }, "en")).toBe("2,500 items");
    const polish = "{n, plural, one {# plik} few {# pliki} many {# plików} other {# pliku}}";
    expect(formatMessage(polish, { n: 1 }, "pl")).toBe("1 plik");
    expect(formatMessage(polish, { n: 3 }, "pl")).toBe("3 pliki");
    expect(formatMessage(polish, { n: 5 }, "pl")).toBe("5 plików");
    const guests = "{n, plural, offset:1 =0 {nobody} =1 {{host}} one {{host} and # other} other {{host} and # others}}";
    expect(formatMessage(guests, { n: 1, host: "Ana" }, "en")).toBe("Ana");
    expect(formatMessage(guests, { n: 2, host: "Ana" }, "en")).toBe("Ana and 1 other");
    expect(formatMessage(guests, { n: 4, host: "Ana" }, "en")).toBe("Ana and 3 others");
    const place = "{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}";
    expect([1, 2, 3, 4, 11].map((n) => formatMessage(place, { n }, "en"))).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
    ]);
  });

  it("selects branches, nests arguments and honours apostrophe quoting", () => {
    const pronoun = "{who, select, she {She has {count, plural, one {# file} other {# files}}} other {They have #}}";
    expect(formatMessage(pronoun, { who: "she", count: 2 }, "en")).toBe("She has 2 files");
    expect(formatMessage(pronoun, { who: "x", count: 2 }, "en")).toBe("They have #");
    expect(formatMessage("It''s '{literal}' {v}", { v: 1 }, "en")).toBe("It's {literal} 1");
    expect(formatMessage("{n, plural, other {'#' is #}}", { n: 3 }, "en")).toBe("# is 3");
  });

  it("rejects malformed patterns with the position", () => {
    expect(() => formatMessage("Hello {name", {}, "en")).toThrow(MessageFormatError);
    expect(() => formatMessage("Hello }", {}, "en")).toThrow(/unmatched \}/);
    expect(() => formatMessage("{n, plural, one {x}}", { n: 1 }, "en")).toThrow(/"other"/);
    expect(() => formatMessage("{n, date}", { n: 1 }, "en")).toThrow(/unsupported argument type/);
  });
});

describe("msg: keys and catalogs", () => {
  it("encodes values into msg: references and parses them back", () => {
    expect(t("home.title")).toBe(`${MSG_PREFIX}home.title`);
    const ref = t("send.done", { name: "Ana Lu", amount: 5 });
    expect(ref).toBe("msg:send.done?amount=5&name=Ana+Lu");
    expect(parseMessageRef(ref)).toEqual({ key: "send.done", values: { amount: 5, name: "Ana Lu" } });
    expect(parseMessageRef("Send")).toBeNull();
    expect(() => t("bad key")).toThrow(TypeError);
  });

  it("resolves through the locale, its base language, then the default, then the key", () => {
    const lookup = {
      default: "en",
      messages: { en: { a: "A en", b: "B en" }, pt: { a: "A pt" }, "pt-BR": { c: "C br" } },
    };
    expect(message(lookup, "pt-BR", "c")).toBe("C br");
    expect(message(lookup, "pt-BR", "a")).toBe("A pt");
    expect(message(lookup, "pt-BR", "b")).toBe("B en");
    expect(message(lookup, "pt-BR", "missing.key")).toBe("missing.key");
    expect(translate(lookup, "en", "Literal label")).toBe("Literal label");
    expect(translate(null, "en", "msg:a")).toBe("a");
  });

  it("rejects message files that are not flat string maps or not configured locales", () => {
    const registry = createRegistry().freeze();
    expect(() =>
      registerI18n(registry, { config: PREFIX, messages: { en: { title: 3 } } }),
    ).toThrow(/must be a string message/);
    expect(() => registerI18n(registry, { config: PREFIX, messages: { fr: {} } })).toThrow(
      /not one of i18n.locales/,
    );
    expect(() =>
      registerI18n(registry, { config: { locales: ["en"], default: "fr" }, messages: {} }),
    ).toThrow(/i18n.default/);
  });
});

describe("locale resolution", () => {
  const settings: LocaleSettings = { locales: ["en", "pt-BR"], default: "en", routing: "prefix" };

  it("matches locale tags exactly, then by base language", () => {
    expect(matchLocale("PT-br", settings.locales)).toBe("pt-BR");
    expect(matchLocale("pt-PT", settings.locales)).toBe("pt-BR");
    expect(matchLocale("fr", settings.locales)).toBeNull();
    expect(localePrefix("/pt-br/detail/7", settings.locales)).toBe("pt-BR");
    expect(localePrefix("/detail/7", settings.locales)).toBeNull();
    expect(stripLocalePrefix("/pt-BR/detail/7", settings.locales)).toBe("/detail/7");
    expect(stripLocalePrefix("/pt-BR", settings.locales)).toBe("/");
    expect(localizeHref("/", "pt-BR")).toBe("/pt-BR");
    expect(localizeHref("/detail/7?tab=a", "en")).toBe("/en/detail/7?tab=a");
  });

  it("resolves the prefix, then the cookie, then Accept-Language, then the default", () => {
    const all = { pathname: "/pt-BR/x", cookie: "en", languages: ["en"] };
    expect(resolveLocale(settings, all)).toEqual({ locale: "pt-BR", source: "prefix" });
    expect(resolveLocale(settings, { ...all, pathname: "/x", cookie: "pt-BR" })).toEqual({
      locale: "pt-BR",
      source: "cookie",
    });
    expect(resolveLocale(settings, { pathname: "/x", cookie: "fr", languages: ["de", "pt"] })).toEqual({
      locale: "pt-BR",
      source: "accept-language",
    });
    expect(resolveLocale(settings, { pathname: "/x", cookie: null, languages: ["de"] })).toEqual({
      locale: "en",
      source: "default",
    });
    expect(resolveLocale({ ...settings, routing: "none" }, all)).toEqual({ locale: "en", source: "cookie" });
  });

  it("parses Accept-Language by quality and resolves requests on the server", async () => {
    expect(parseAcceptLanguage("fr;q=0.2, pt-BR, en;q=0.8, *;q=0.1, de;q=0")).toEqual([
      "pt-BR",
      "en",
      "fr",
    ]);
    const request = (path: string, headers: Record<string, string> = {}) =>
      serverRequest(`http://rex.test${path}`, headers);
    expect(resolveRequestLocale(request("/pt-BR/detail/7", { cookie: "rex-locale=en" }), PREFIX)).toEqual({
      locale: "pt-BR",
      source: "prefix",
    });
    expect(
      resolveRequestLocale(
        request("/detail/7", { cookie: "theme=dark; rex-locale=pt-BR", "accept-language": "en" }),
        PREFIX,
      ),
    ).toEqual({ locale: "pt-BR", source: "cookie" });
    expect(
      resolveRequestLocale(request("/", { "accept-language": "fr-CA, pt;q=0.9, en;q=0.5" }), NONE),
    ).toEqual({ locale: "pt-BR", source: "accept-language" });
    expect(resolveRequestLocale(request("/", { "accept-language": "fr" }), NONE)).toEqual({
      locale: "en",
      source: "default",
    });
    const context = await createRexContext(
      request("/en/detail/7", { "accept-language": "pt-BR" }),
      () => viewer,
      PREFIX,
    );
    expect(context.locale).toBe("en");
    const plain = await createRexContext(request("/"), () => viewer);
    expect(plain.locale).toBeUndefined();
  });

  it("keeps the locale prefix when the Navigation API destination is routed", () => {
    let parser: Parser | null = null;
    function CaptureParser() {
      parser = useRouter().parser;
      return null;
    }
    render(<CaptureParser />);
    if (parser === null) throw new Error("the default router exposes no parser");
    const event = {
      canIntercept: true,
      hashChange: false,
      downloadRequest: null,
      formData: null,
      navigationType: "push",
      destination: { url: "http://rex.test/pt-BR/detail/7", sameDocument: false },
    } as unknown as NavigateEventLike;
    const scope = {
      pages: [home, detail],
      origin: "http://rex.test",
      base: "",
      parser: parser as Parser,
    };
    expect(routableDestination(event, { ...scope, locales: ["en", "pt-BR"] })).toEqual({
      page: detail,
      href: "/pt-BR/detail/7",
    });
    expect(routableDestination(event, scope)).toBeNull();
    const bare = {
      ...event,
      destination: { url: "http://rex.test/detail/7", sameDocument: false },
    } as unknown as NavigateEventLike;
    expect(routableDestination(bare, { ...scope, locales: ["en", "pt-BR"] })).toBeNull();
  });
});

describe("prefix routing", () => {
  it("mounts every page under /:locale and resolves titles, messages and lang", async () => {
    mount(prefixRegistry, "/pt-BR");
    expect(heading()).toBe("Início");
    expect(screen.getByTestId("items").textContent).toBe("3 itens");
    expect(screen.getByTestId("none").textContent).toBe("Nenhum item");
    expect(screen.getByTestId("resolved").textContent).toBe("Enviado 5 para Ana");
    expect(screen.getByTestId("locale").textContent).toBe("pt-BR");
    expect(document.documentElement.lang).toBe("pt-BR");
    const link = within(screen.getByRole("navigation", { name: "Pages" })).getByRole("link", {
      name: "Início",
    });
    expect(link.getAttribute("href")).toBe("/pt-BR");
    expect(screen.getByTestId("detail-link").getAttribute("href")).toBe("/pt-BR/detail/7");
  });

  it("keeps the locale prefix through nav.to and back", async () => {
    const { memory } = mount(prefixRegistry, "/pt-BR");
    await click("open detail");
    expect(memory.history.at(-1)).toBe("/pt-BR/detail/7");
    expect(heading()).toBe("Detalhe");
    expect(screen.getByText("Detail body 7")).toBeTruthy();
    await click("Back to Início");
    expect(memory.history.at(-1)).toBe("/pt-BR");
    expect(heading()).toBe("Início");
  });

  it("switches the locale prefix, keeps the route and writes the rex-locale cookie", async () => {
    const { memory } = mount(prefixRegistry, "/pt-BR/detail/9");
    expect(heading()).toBe("Detalhe");
    await click("detail to en");
    expect(memory.history.at(-1)).toBe("/en/detail/9");
    expect(heading()).toBe("Detail");
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=en`);
    expect(document.documentElement.lang).toBe("en");
  });

  it("redirects a path without a prefix to the cookie locale and 404s unknown paths", async () => {
    document.cookie = `${LOCALE_COOKIE}=pt-BR; Path=/`;
    const { memory } = mount(prefixRegistry, "/detail/3");
    expect(memory.history.at(-1)).toBe("/pt-BR/detail/3");
    expect(heading()).toBe("Detalhe");
    cleanup();
    const missing = mount(prefixRegistry, "/nowhere");
    expect(missing.memory.history.at(-1)).toBe("/nowhere");
    expect(heading()).toBe("Page not found");
  });

  it("speaks the user's language in the sidecar, the palette and the outcome", async () => {
    const { store } = mount(prefixRegistry, "/pt-BR");
    const sidecar = readSidecar() as {
      actions: { id: string; label: string }[];
      outcome: { message: string } | null;
    };
    expect(sidecar.actions.find((entry) => entry.id === "send")?.label).toBe("Enviar fundos");
    await act(async () => {
      store.set("home", {
        actionId: "send",
        ok: true,
        message: t("send.done", { amount: 5, name: "Ana" }),
        at: new Date().toISOString(),
      });
    });
    const outcome = screen.getByRole("status", { name: "Outcome" });
    expect(within(outcome).getByText("Enviado 5 para Ana")).toBeTruthy();
    expect(within(outcome).getByText("Enviar fundos")).toBeTruthy();
    const updated = readSidecar() as { outcome: { message: string } | null };
    expect(updated.outcome?.message).toBe("Enviado 5 para Ana");
    await act(async () => {
      fireEvent.keyDown(window, { key: "k", code: "KeyK", ctrlKey: true });
    });
    const palette = screen.getByRole("dialog", { name: "Command palette" });
    expect(within(palette).getByText("Enviar fundos")).toBeTruthy();
    expect(within(palette).getByText("Go to Início")).toBeTruthy();
  });
});

describe("routing none", () => {
  it("resolves the cookie locale without a prefix and switches in place", async () => {
    document.cookie = `${LOCALE_COOKIE}=pt-BR; Path=/`;
    const { memory } = mount(noneRegistry, "/");
    expect(heading()).toBe("Início");
    expect(screen.getByTestId("detail-link").getAttribute("href")).toBe("/detail/7");
    await click("to en");
    expect(heading()).toBe("Home");
    expect(screen.getByTestId("items").textContent).toBe("3 items");
    expect(document.documentElement.lang).toBe("en");
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=en`);
    expect(memory.history.at(-1)).toBe("/");
    await click("open detail");
    expect(memory.history.at(-1)).toBe("/detail/7");
  });
});

describe("server rendering", () => {
  async function renderDocument(path: string, headers: Record<string, string> = {}) {
    const renderer = createRexRenderer({
      bundle: { registry: prefixRegistry, manifest: buildManifest(prefixRegistry), pages },
    });
    const request = serverRequest(`http://rex.test${path}`, headers);
    const context = await createRexContext(request, () => viewer);
    const result = await renderer.render(request, context);
    return { kind: result.kind, html: await new Response(result.body).text() };
  }

  it("sets html lang and resolves the title and chrome in the request locale", async () => {
    const prefixed = await renderDocument("/pt-BR/detail/7", { "accept-language": "en" });
    expect(prefixed.kind).toBe("page");
    expect(prefixed.html).toContain('<html lang="pt-BR">');
    expect(prefixed.html).toContain("<title>Detalhe</title>");
    expect(prefixed.html).toContain("<h1");
    expect(prefixed.html).toContain("Detalhe</h1>");
    expect(prefixed.html).toContain("Detail body <!-- -->7");
    const english = await renderDocument("/en", { cookie: "rex-locale=pt-BR" });
    expect(english.html).toContain('<html lang="en">');
    expect(english.html).toContain("<title>Home</title>");
    expect(english.html).toContain("3 items");
  });
});

describe("rex new", () => {
  it("contributes app/locales/<default>.json with the app and home titles", () => {
    const plan = runGenerators({ name: "notes-app" });
    const entry = plan.find((item) => item.path === localeFilePath(DEFAULT_APP_LOCALE));
    expect(entry?.path).toBe("app/locales/en.json");
    expect(entry?.kind).toBe("file");
    const content = entry?.kind === "file" ? entry.content : "";
    expect(JSON.parse(content)).toEqual({
      "app.title": titleFromId("notes-app"),
      "home.title": titleFromId("home"),
    });
  });
});
