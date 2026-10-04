import type { Actor } from "../core/actor.ts";
import { REX_ACTOR_HEADER, REX_CONFIRM_HEADER, REX_DENSITY_HEADER } from "../core/protocol.ts";

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
): Promise<RexContext> {
  const header = request.headers.get(DENSITY_HEADER);
  let density: RexDensity = DEFAULT_DENSITY;
  if (header !== null) {
    if (!isRexDensity(header)) throw new RexDensityError(header);
    density = header;
  }
  const confirm = request.headers.get(CONFIRM_HEADER);
  const actor = await resolveActor(request);
  return confirm === null || confirm === "" ? { actor, density } : { actor, density, confirm };
}
