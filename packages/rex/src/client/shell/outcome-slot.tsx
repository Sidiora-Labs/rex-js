import { Page } from "../layout.tsx";
import { APP_OUTCOME_KEY, useOutcome } from "../outcome.ts";
import type { ShellSlotProps } from "./slots.ts";

export interface OutcomeSlotProps {
  readonly page: string;
}

export function ShellOutcome({ page }: OutcomeSlotProps) {
  const outcome = useOutcome(page);
  return <Page.Outcome>{outcome === null ? null : <p>{outcome.message}</p>}</Page.Outcome>;
}

export function OutcomeSlot({ active, Outcome }: ShellSlotProps) {
  return <Outcome page={active === null ? APP_OUTCOME_KEY : active.id} />;
}
