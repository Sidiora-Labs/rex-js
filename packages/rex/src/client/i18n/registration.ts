import type { LazyModule } from "../lazy.ts";
import type { I18nSource } from "./context.ts";
import type { MessageFormatter } from "./lookup.ts";

export interface I18nRegistration {
  readonly source: I18nSource;
  readonly formatter: LazyModule<MessageFormatter>;
}

const registrations = new WeakMap<object, I18nRegistration>();

export function setI18nRegistration(registry: object, registration: I18nRegistration): () => void {
  registrations.set(registry, registration);
  return () => {
    if (registrations.get(registry) === registration) registrations.delete(registry);
  };
}

export function i18nRegistration(registry: object): I18nRegistration | null {
  return registrations.get(registry) ?? null;
}
