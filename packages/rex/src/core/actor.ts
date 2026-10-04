export interface ActorAttributes {
  readonly unlocked?: boolean;
  readonly account?: string;
  readonly custody?: string;
  readonly [attribute: string]: unknown;
}

export interface Actor {
  readonly id: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly attributes: ActorAttributes;
}

export interface ActorInput {
  readonly id: string;
  readonly roles?: readonly string[];
  readonly permissions?: readonly string[];
  readonly attributes?: ActorAttributes;
}

export const ANONYMOUS_ACTOR_ID = "anonymous";

function stringList(field: string, value: readonly string[] | undefined): readonly string[] {
  if (value === undefined) return Object.freeze([]);
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    throw new TypeError(`actor: ${field} must be an array of non-empty strings`);
  }
  return Object.freeze([...new Set(value)]);
}

export function actor(input: ActorInput): Actor {
  if (typeof input !== "object" || input === null) {
    throw new TypeError("actor: expected an actor object");
  }
  if (typeof input.id !== "string" || input.id.length === 0) {
    throw new TypeError("actor: id must be a non-empty string");
  }
  const attributes = input.attributes ?? {};
  if (typeof attributes !== "object" || attributes === null || Array.isArray(attributes)) {
    throw new TypeError("actor: attributes must be an object");
  }
  return Object.freeze({
    id: input.id,
    roles: stringList("roles", input.roles),
    permissions: stringList("permissions", input.permissions),
    attributes: Object.freeze({ ...attributes }),
  });
}

export const anonymousActor: Actor = actor({ id: ANONYMOUS_ACTOR_ID });

export function isAnonymous(subject: Actor): boolean {
  return subject.id === ANONYMOUS_ACTOR_ID;
}
