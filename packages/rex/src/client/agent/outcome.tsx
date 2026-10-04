import { useEffect, useState } from "react";
import { isPlainObject } from "../../core/entity.ts";
import { actionLabel } from "../act.ts";
import { useRegistry } from "../context.ts";
import { useText } from "../i18n/context.ts";
import { PageOutcome } from "../outcome-frame.tsx";
import { useOutcome, useOutcomeStore, type Outcome, type OutcomeStore } from "../outcome.ts";
import { isDefaultShellComponent, useShellComponents } from "../shell/components.ts";

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

const OUTCOME_STATE_ATTRIBUTE = "data-rex-outcome-state";

const adoptedServerOutcomes = new WeakSet<Element>();

function isFormOutcome(outcome: Outcome): outcome is FormOutcome {
  const posted = outcome as Partial<FormOutcome>;
  return posted.code !== undefined && posted.fields !== undefined;
}

function sameOutcome(left: Outcome | null, right: Outcome): boolean {
  return left !== null && left.actionId === right.actionId && left.at === right.at;
}

function adoptServerOutcome(page: string, store: OutcomeStore): void {
  if (typeof document === "undefined") return;
  const element = document.querySelector(`[${OUTCOME_STATE_ATTRIBUTE}]`);
  if (element === null || adoptedServerOutcomes.has(element)) return;
  adoptedServerOutcomes.add(element);
  const value = element.getAttribute(OUTCOME_STATE_ATTRIBUTE);
  const rendered = value === null ? null : parseOutcomeCookie(value);
  if (rendered !== null && !sameOutcome(store.get(page), rendered)) store.set(page, rendered);
}

function useServerOutcome(page: string, store: OutcomeStore): void {
  useState(() => {
    adoptServerOutcome(page, store);
    return null;
  });
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
  const text = useText();
  if (outcome === null) return null;
  const declared = registry.find("action", outcome.actionId);
  return declared === undefined ? outcome.actionId : text(actionLabel(declared));
}

export function OutcomeRegion({ page }: OutcomeRegionProps) {
  const store = useOutcomeStore();
  useServerOutcome(page, store);
  const outcome = useOutcome(page);
  const label = useOutcomeLabel(outcome);
  const text = useText();
  const { Outcome: ShellOutcome, Button } = useShellComponents();
  useEffect(() => {
    const posted = takeOutcomeCookie();
    if (posted !== null && !sameOutcome(store.get(page), posted)) store.set(page, posted);
  }, [page, store]);
  return (
    <PageOutcome>
      {outcome === null ? (
        <p data-rex-outcome="none">{OUTCOME_EMPTY_TEXT}</p>
      ) : (
        <div
          data-rex-outcome={outcome.actionId}
          data-rex-outcome-ok={outcome.ok ? "true" : "false"}
          data-rex-outcome-at={outcome.at}
          {...(isFormOutcome(outcome)
            ? { [OUTCOME_STATE_ATTRIBUTE]: encodeOutcomeCookie(outcome) }
            : {})}
        >
          {isDefaultShellComponent("Outcome", ShellOutcome) ? (
            <>
              <p>
                <strong>{label}</strong>: {outcomeStatusText(outcome)}
              </p>
              <p>{text(outcome.message)}</p>
            </>
          ) : (
            <ShellOutcome page={page} />
          )}
          <Button
            type="button"
            data-rex-outcome-dismiss={page}
            aria-label={`Dismiss the ${label} outcome`}
            onClick={() => store.clear(page)}
          >
            Dismiss
          </Button>
        </div>
      )}
    </PageOutcome>
  );
}
