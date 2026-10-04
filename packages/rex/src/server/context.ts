import type { Actor } from "../core/actor.ts";

export const REX_DENSITIES = ["default", "agent"] as const;

export type RexDensity = (typeof REX_DENSITIES)[number];

export const DEFAULT_DENSITY: RexDensity = "default";

export const DENSITY_HEADER = "x-rex-density";
export const CONFIRM_HEADER = "x-rex-confirm";

export interface RexContext {
  readonly actor: Actor;
  readonly density: RexDensity;
  readonly confirm?: string | undefined;
}

export function isRexDensity(value: unknown): value is RexDensity {
  return typeof value === "string" && (REX_DENSITIES as readonly string[]).includes(value);
}
