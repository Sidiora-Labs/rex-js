import { useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { actionLabel, inputProblem } from "../act.ts";
import { useOutcomeStore } from "../outcome.ts";
import { useActivePage } from "../router.tsx";
import { usePageInvokers } from "./confirm.tsx";

export const ACT_QUERY_KEY = "act";
export const INPUT_QUERY_KEY = "input";

export type UrlInvocation =
  | { readonly ok: true; readonly action: string; readonly input: unknown }
  | { readonly ok: false; readonly action: string; readonly error: string };

export function parseUrlInvocation(search: string): UrlInvocation | null {
  const query = new URLSearchParams(search);
  const action = query.get(ACT_QUERY_KEY);
  if (action === null) return null;
  const raw = query.get(INPUT_QUERY_KEY);
  if (raw === null || raw === "") return { ok: true, action, input: {} };
  try {
    return { ok: true, action, input: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, action, error: "the input parameter is not valid JSON" };
  }
}

export function withoutInvocation(search: string): string {
  const query = new URLSearchParams(search);
  query.delete(ACT_QUERY_KEY);
  query.delete(INPUT_QUERY_KEY);
  return query.toString();
}

export function useUrlInvoke(): void {
  const active = useActivePage();
  const invokers = usePageInvokers();
  const outcomes = useOutcomeStore();
  const [location, navigate] = useLocation();
  const search = useSearch();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (active === null) return;
    const invocation = parseUrlInvocation(search);
    if (invocation === null) {
      handled.current = null;
      return;
    }
    const key = `${location}?${search}`;
    if (handled.current === key) return;
    handled.current = key;
    const rest = withoutInvocation(search);
    navigate(rest === "" ? location : `${location}?${rest}`, { replace: true });

    const pageId = active.page.id;
    const declared = active.page.actions.find((entry) => entry.id === invocation.action);
    if (declared !== undefined && !invocation.ok) {
      outcomes.set(pageId, {
        actionId: declared.id,
        ok: false,
        message: `${actionLabel(declared)}: invalid input: ${invocation.error}`,
        at: new Date().toISOString(),
      });
      return;
    }
    if (declared === undefined) {
      void invokers.invoke(invocation.action, invocation.ok ? invocation.input : {});
      return;
    }
    const input = invocation.ok ? invocation.input : {};
    void inputProblem(declared, input).then((problem) => {
      if (problem === null) {
        void invokers.invoke(declared.id, input);
        return;
      }
      outcomes.set(pageId, {
        actionId: declared.id,
        ok: false,
        message: problem,
        at: new Date().toISOString(),
      });
    });
  }, [active, invokers, location, navigate, outcomes, search]);
}

export function RexUrlInvoke(): null {
  useUrlInvoke();
  return null;
}
