import type { ReactNode } from "react";
import { RexError } from "../core/errors.ts";

export const SPACES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type Space = (typeof SPACES)[number];

export const DEFAULT_SPACE: Space = 3;

export function checkSpace(component: string, space: unknown): Space {
  if (!(SPACES as readonly unknown[]).includes(space)) {
    throw new RexError(
      "REX314",
      `Page.${component}: space must be a token step 1..8, received ${String(space)}`,
    );
  }
  return space as Space;
}

export function spaceClass(space: Space): string {
  return `rex-space-${space}`;
}

export interface OutcomeProps {
  readonly space?: Space;
  readonly children?: ReactNode;
}

export function PageOutcome({ space = DEFAULT_SPACE, children }: OutcomeProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label="Outcome"
      className={`rex-outcome ${spaceClass(checkSpace("Outcome", space))}`}
    >
      {children}
    </section>
  );
}
