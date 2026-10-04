import { APP_OUTCOME_KEY } from "../outcome.ts";
import { useShellComponent } from "./components.ts";
import type { ShellSlotProps } from "./slots.ts";

export interface OutcomeSlotProps {
  readonly page: string;
}

export function ShellOutcome({ page }: OutcomeSlotProps) {
  const Outcome = useShellComponent("Outcome");
  return <Outcome page={page} />;
}

export function OutcomeSlot({ active, Outcome }: ShellSlotProps) {
  return <Outcome page={active === null ? APP_OUTCOME_KEY : active.id} />;
}
