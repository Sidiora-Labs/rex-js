import type { AnyFlow, ApprovalStep } from "../../core/flow.ts";
import type { FlowDecision } from "../../core/journal.ts";
import type { PolicyResult } from "../../core/policy.ts";
import type { FlowState } from "../../core/protocol.ts";
import type { describeError } from "../act.ts";
import type { OutcomeStore } from "../outcome.ts";
import type { ConfirmFn } from "./confirm.tsx";
import type { FlowClient, FlowDecisionResult, GateControlProps } from "./flow.tsx";
import type { Affordance } from "./sidecar.tsx";

export interface FlowGateNames {
  affordanceId(declared: AnyFlow, gate: string, decision: FlowDecision): string;
  label(gate: ApprovalStep, decision: FlowDecision): string;
  address(page: string, id: string): string;
  describe: typeof describeError;
}

export interface FlowGateContext {
  readonly declared: AnyFlow;
  readonly instanceId: string;
  readonly client: FlowClient;
  readonly outcomes: OutcomeStore;
  readonly pageId: string | null;
  readonly outcomeKey: string;
  readonly names: FlowGateNames;
  readonly gate: ApprovalStep | null;
  readonly decision: PolicyResult | null;
  setState(next: FlowState): void;
  setPending(pending: boolean): void;
  setError(error: string | null): void;
}

function record(context: FlowGateContext, id: string, ok: boolean, message: string): void {
  context.outcomes.set(context.outcomeKey, {
    actionId: id,
    ok,
    message,
    at: new Date().toISOString(),
  });
}

export async function decideFlow(
  context: FlowGateContext,
  choice: FlowDecision,
): Promise<FlowDecisionResult> {
  const { declared, gate, decision, names } = context;
  if (gate === null) {
    return {
      ok: false,
      code: "CONFLICT",
      message: `flow "${declared.id}" is not paused at a gate`,
    };
  }
  const id = names.affordanceId(declared, gate.id, choice);
  const label = names.label(gate, choice);
  if (decision !== null && !decision.allowed) {
    const message = `${label}: not allowed (${decision.reason})`;
    record(context, id, false, message);
    return { ok: false, code: "FORBIDDEN", message };
  }
  context.setPending(true);
  try {
    const next = await context.client.decide({
      flow: declared.id,
      instance: context.instanceId,
      decision: choice,
    });
    context.setState(next);
    context.setError(null);
    record(context, id, true, `${label} succeeded; flow ${next.status}`);
    return { ok: true, state: next };
  } catch (failure) {
    const { code, message } = names.describe(failure);
    context.setError(message);
    record(context, id, false, `${label} failed: ${message}`);
    return { ok: false, code, message };
  } finally {
    context.setPending(false);
  }
}

export async function confirmFlowDecision(
  context: FlowGateContext,
  confirm: ConfirmFn,
  choice: FlowDecision,
  decide: (choice: FlowDecision) => Promise<FlowDecisionResult>,
): Promise<FlowDecisionResult> {
  const { declared, gate, names } = context;
  if (gate === null) return decide(choice);
  const id = names.affordanceId(declared, gate.id, choice);
  const label = names.label(gate, choice);
  const accepted = await confirm({
    page: context.pageId,
    action: { id, label, effect: "irreversible" },
    input: {},
  });
  if (!accepted) {
    const message = `${label} cancelled`;
    record(context, id, false, message);
    return { ok: false, code: "CANCELLED", message };
  }
  return decide(choice);
}

export function flowAffordances(
  context: Pick<FlowGateContext, "declared" | "gate" | "decision" | "names">,
  decide: (choice: FlowDecision) => Promise<FlowDecisionResult>,
): readonly Affordance[] {
  const { declared, gate, decision, names } = context;
  if (gate === null || decision === null) return [];
  return (["approve", "reject"] as const).map((choice): Affordance => ({
    id: names.affordanceId(declared, gate.id, choice),
    label: names.label(gate, choice),
    allowed: decision.allowed,
    reason: decision.reason,
    effect: "irreversible",
    input: { type: "object", properties: {}, additionalProperties: false },
    via: ["click", "palette"],
    invoke: () => decide(choice),
  }));
}

export function gateControlProps(
  context: Pick<FlowGateContext, "declared" | "gate" | "decision" | "pageId" | "names">,
  choice: FlowDecision,
  pending: boolean,
  onDecide: (choice: FlowDecision) => void,
): GateControlProps | null {
  const { declared, gate, decision, pageId, names } = context;
  if (gate === null || decision === null || pageId === null) return null;
  const blocked = !decision.allowed || pending;
  return {
    "data-rex": names.address(pageId, names.affordanceId(declared, gate.id, choice)),
    "data-rex-allowed": decision.allowed ? "true" : "false",
    disabled: blocked,
    "aria-disabled": blocked,
    ...(decision.allowed ? {} : { title: `Not allowed: ${decision.reason}` }),
    onClick: () => onDecide(choice),
  };
}
