import type { Actor } from "../core/actor.ts";
import type { I18nConfig } from "../core/config.ts";
import { REX_ACTOR_HEADER, REX_CONFIRM_HEADER, REX_DENSITY_HEADER } from "../core/protocol.ts";
import { resolveRequestLocale } from "./locale.ts";

export const REX_DENSITIES = ["default", "agent"] as const;

export type RexDensity = (typeof REX_DENSITIES)[number];

export const DEFAULT_DENSITY: RexDensity = "default";

export const DENSITY_HEADER = REX_DENSITY_HEADER;
export const CONFIRM_HEADER = REX_CONFIRM_HEADER;
export const ACTOR_HEADER = REX_ACTOR_HEADER;

export interface RexContext {
  readonly actor: Actor;
  readonly density: RexDensity;
  readonly confirm?: string | undefined;
  readonly nonce?: string | undefined;
  readonly locale?: string | undefined;
}

export interface RexRequestContext extends RexContext {
  readonly nonce: string;
}

export function createNonce(): string {
  return globalThis.crypto.randomUUID().replaceAll("-", "");
}

class RequestContext implements RexRequestContext {
  readonly actor: Actor;
  readonly density: RexDensity;
  readonly confirm: string | undefined;
  readonly locale: string | undefined;
  #nonce: string | null = null;

  constructor(
    actor: Actor,
    density: RexDensity,
    confirm: string | undefined,
    locale: string | undefined,
  ) {
    this.actor = actor;
    this.density = density;
    this.confirm = confirm;
    this.locale = locale;
  }

  get nonce(): string {
    if (this.#nonce === null) this.#nonce = createNonce();
    return this.#nonce;
  }
}

export type ActorResolver = (request: Request) => Actor | Promise<Actor>;

export function isRexDensity(value: unknown): value is RexDensity {
  return typeof value === "string" && (REX_DENSITIES as readonly string[]).includes(value);
}

export class RexDensityError extends Error {
  readonly value: string;

  constructor(value: string) {
    super(`${DENSITY_HEADER} must be one of ${REX_DENSITIES.join(", ")}, received "${value}"`);
    this.name = "RexDensityError";
    this.value = value;
  }
}

export function encodeActorHeaderValue(subject: Actor): string {
  return encodeURIComponent(
    JSON.stringify({
      id: subject.id,
      roles: subject.roles,
      permissions: subject.permissions,
      attributes: subject.attributes,
    }),
  );
}

export async function createRexContext(
  request: Request,
  resolveActor: ActorResolver,
  i18n: I18nConfig | null = null,
): Promise<RexRequestContext> {
  const header = request.headers.get(DENSITY_HEADER);
  let density: RexDensity = DEFAULT_DENSITY;
  if (header !== null) {
    if (!isRexDensity(header)) throw new RexDensityError(header);
    density = header;
  }
  const confirm = request.headers.get(CONFIRM_HEADER);
  const actor = await resolveActor(request);
  const locale = i18n === null ? undefined : resolveRequestLocale(request, i18n).locale;
  return new RequestContext(
    actor,
    density,
    confirm === null || confirm === "" ? undefined : confirm,
    locale,
  );
}
