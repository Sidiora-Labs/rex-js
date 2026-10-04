import { actionLabel } from "../act.ts";
import { useRegistry } from "../context.ts";
import { Page } from "../layout.tsx";
import { useOutcome, useOutcomeStore, type Outcome } from "../outcome.ts";

export interface OutcomeRegionProps {
  readonly page: string;
}

export const OUTCOME_EMPTY_TEXT = "No action has run on this page yet.";

export function outcomeStatusText(outcome: Pick<Outcome, "ok">): "Succeeded" | "Failed" {
  return outcome.ok ? "Succeeded" : "Failed";
}

function useOutcomeLabel(outcome: Outcome | null): string | null {
  const registry = useRegistry();
  if (outcome === null) return null;
  const declared = registry.find("action", outcome.actionId);
  return declared === undefined ? outcome.actionId : actionLabel(declared);
}

export function OutcomeRegion({ page }: OutcomeRegionProps) {
  const store = useOutcomeStore();
  const outcome = useOutcome(page);
  const label = useOutcomeLabel(outcome);
  return (
    <Page.Outcome>
      {outcome === null ? (
        <p data-rex-outcome="none">{OUTCOME_EMPTY_TEXT}</p>
      ) : (
        <div
          data-rex-outcome={outcome.actionId}
          data-rex-outcome-ok={outcome.ok ? "true" : "false"}
          data-rex-outcome-at={outcome.at}
        >
          <p>
            <strong>{label}</strong>: {outcomeStatusText(outcome)}
          </p>
          <p>{outcome.message}</p>
          <button
            type="button"
            data-rex-outcome-dismiss={page}
            aria-label={`Dismiss the ${label} outcome`}
            onClick={() => store.clear(page)}
          >
            Dismiss
          </button>
        </div>
      )}
    </Page.Outcome>
  );
}
