import { useEffect } from "react";
import { isPlainObject } from "../../core/entity.ts";
import { actionLabel } from "../act.ts";
import { useRegistry } from "../context.ts";
import { Page } from "../layout.tsx";
import { useOutcome, useOutcomeStore, type Outcome } from "../outcome.ts";

export interface OutcomeRegionProps {
  readonly page: string;
}

export const OUTCOME_EMPTY_TEXT = "No action has run on this page yet.";

export const OUTCOME_COOKIE = "rex-outcome";

export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export interface FormOutcome extends Outcome {
  readonly code: string | null;
  readonly fields: FieldErrors;
}

export function readCookie(name: string, source: string): string | null {
  for (const pair of source.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() === name) return pair.slice(separator + 1).trim();
  }
  return null;
}

export function expireCookie(name: string): void {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function encodeOutcomeCookie(outcome: FormOutcome): string {
  return encodeURIComponent(
    JSON.stringify({
      actionId: outcome.actionId,
      ok: outcome.ok,
      message: outcome.message,
      at: outcome.at,
      code: outcome.code,
      fields: outcome.fields,
    }),
  );
}

export function parseOutcomeCookie(value: string): FormOutcome | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(value));
  } catch {
    return null;
  }
  if (!isPlainObject(parsed)) return null;
  const { actionId, ok, message, at, code, fields } = parsed;
  if (typeof actionId !== "string" || actionId.length === 0) return null;
  if (typeof ok !== "boolean" || typeof message !== "string") return null;
  if (typeof at !== "string" || Number.isNaN(Date.parse(at))) return null;
  if (code !== null && typeof code !== "string") return null;
  if (!isPlainObject(fields)) return null;
  const errors: Record<string, readonly string[]> = {};
  for (const [path, messages] of Object.entries(fields)) {
    if (!Array.isArray(messages) || !messages.every((entry) => typeof entry === "string")) {
      return null;
    }
    errors[path] = Object.freeze([...messages]);
  }
  return Object.freeze({ actionId, ok, message, at, code, fields: Object.freeze(errors) });
}

export function takeOutcomeCookie(): FormOutcome | null {
  const raw = readCookie(OUTCOME_COOKIE, document.cookie);
  if (raw === null) return null;
  expireCookie(OUTCOME_COOKIE);
  return raw === "" ? null : parseOutcomeCookie(raw);
}

export function outcomeErrors(outcome: Outcome | null, actionId: string): FieldErrors | null {
  if (outcome === null || outcome.actionId !== actionId) return null;
  const fields = (outcome as Partial<FormOutcome>).fields;
  return fields === undefined || Object.keys(fields).length === 0 ? null : fields;
}

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
  useEffect(() => {
    const posted = takeOutcomeCookie();
    if (posted !== null) store.set(page, posted);
  }, [page, store]);
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
