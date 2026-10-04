import { titleFromId } from "../../core/page.ts";
import { HOME_PAGE } from "../commands/new.ts";
import type { PlannedEntry } from "../commands/make.ts";
import type { RexNewContext, RexNewGenerator } from "../generators.ts";

export const DEFAULT_APP_LOCALE = "en";
export const LOCALES_DIR = "app/locales";

export function localeFilePath(locale: string): string {
  return `${LOCALES_DIR}/${locale}.json`;
}

export function defaultMessages(context: RexNewContext): Readonly<Record<string, string>> {
  return {
    "app.title": titleFromId(context.name),
    [`${HOME_PAGE}.title`]: titleFromId(HOME_PAGE),
  };
}

export function localeMessagesTemplate(context: RexNewContext): string {
  return `${JSON.stringify(defaultMessages(context), null, 2)}\n`;
}

export const i18nGenerator: RexNewGenerator = {
  id: "i18n",
  contribute: (plan, context): readonly PlannedEntry[] => [
    ...plan,
    { kind: "file", path: localeFilePath(DEFAULT_APP_LOCALE), content: localeMessagesTemplate(context) },
  ],
};
