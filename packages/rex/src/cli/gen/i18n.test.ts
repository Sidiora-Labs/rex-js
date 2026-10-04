import { describe, expect, it } from "vitest";
import { titleFromId } from "../../core/page.ts";
import type { PlannedEntry } from "../commands/make.ts";
import { HOME_PAGE } from "../commands/new.ts";
import { runGenerators } from "../generators.ts";
import {
  DEFAULT_APP_LOCALE,
  LOCALES_DIR,
  defaultMessages,
  i18nGenerator,
  localeFilePath,
  localeMessagesTemplate,
} from "./i18n.ts";

describe("locale paths and messages", () => {
  it("places locale files under app/locales by locale", () => {
    expect(DEFAULT_APP_LOCALE).toBe("en");
    expect(LOCALES_DIR).toBe("app/locales");
    expect(localeFilePath("en")).toBe("app/locales/en.json");
    expect(localeFilePath("pt-BR")).toBe("app/locales/pt-BR.json");
  });

  it("seeds the app title and the home page title from their ids", () => {
    expect(defaultMessages({ name: "notes-app" })).toEqual({
      "app.title": "Notes app",
      "home.title": "Home",
    });
    expect(defaultMessages({ name: "my.ledger" })).toEqual({
      "app.title": "My ledger",
      [`${HOME_PAGE}.title`]: titleFromId(HOME_PAGE),
    });
  });

  it("writes the messages as two-space JSON ending in a newline", () => {
    const text = localeMessagesTemplate({ name: "notes-app" });
    expect(text).toBe('{\n  "app.title": "Notes app",\n  "home.title": "Home"\n}\n');
    expect(JSON.parse(text)).toEqual(defaultMessages({ name: "notes-app" }));
  });
});

describe("i18nGenerator", () => {
  it("appends the default locale file after the existing plan", () => {
    const existing: PlannedEntry = { kind: "file", path: "package.json", content: "{}\n" };
    const plan = i18nGenerator.contribute([existing], { name: "notes-app" });
    expect(i18nGenerator.id).toBe("i18n");
    expect(plan).toEqual([
      existing,
      {
        kind: "file",
        path: "app/locales/en.json",
        content: localeMessagesTemplate({ name: "notes-app" }),
      },
    ]);
    expect(plan[0]).toBe(existing);
  });

  it("is the only generator that writes a locale file in rex new", () => {
    const entries = runGenerators({ name: "notes-app" }).filter((entry) =>
      entry.path.startsWith(`${LOCALES_DIR}/`),
    );
    expect(entries).toEqual([
      {
        kind: "file",
        path: localeFilePath(DEFAULT_APP_LOCALE),
        content: localeMessagesTemplate({ name: "notes-app" }),
      },
    ]);
  });
});
