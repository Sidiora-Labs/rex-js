import type { AnyAction } from "./action.ts";
import type { Actor } from "./actor.ts";
import { RexDeclarationError, declarationName, isPlainObject } from "./entity.ts";
import { RexError } from "./errors.ts";
import { validateName } from "./ids.ts";
import {
  completedSteps,
  isJournal,
  type FlowDecision,
  type FlowInstance,
  type FlowStatus,
  type Journal,
} from "./journal.ts";
import { evaluate, isPredicate, type Predicate, type ReasonCode } from "./policy.ts";
import { StandardValidationError, validateStandard, type StandardSchemaV1 } from "./standard.ts";

declare module "./registry.ts" {
  interface RegistryKinds {
    flow: AnyFlow;
  }
}

async function validated(schema: StandardSchemaV1, value: unknown): Promise<unknown> {
  const result = await validateStandard(schema, value);
  if (result.issues !== undefined) throw new StandardValidationError(result.issues);
  return result.value;
}

export interface FlowStepContext {
  readonly actor: Actor;
  readonly input: unknown;
  readonly outputs: readonly unknown[];
}

export interface ActionStepConfig<A extends AnyAction = AnyAction> {
  readonly action: A;
  readonly input: (ctx: FlowStepContext) => unknown;
}

export interface ApprovalStepConfig {
  readonly approval: string;
  readonly label: string;
  readonly approvers: Predicate;
}

export type FlowStepConfig = ActionStepConfig | ApprovalStepConfig;

export interface ActionStep {
  readonly kind: "action";
  readonly action: AnyAction;
  input(ctx: FlowStepContext): unknown;
}

export interface ApprovalStep {
  readonly kind: "approval";
  readonly id: string;
  readonly label: string;
  readonly approvers: Predicate;
}

export type FlowStep = ActionStep | ApprovalStep;

export interface FlowConfig {
  readonly steps: readonly FlowStepConfig[];
  readonly journal: Journal;
}

export interface FlowDeclaration<N extends string = string> {
  readonly kind: "flow";
  readonly id: N;
  readonly name: N;
  readonly steps: readonly FlowStep[];
  readonly journal: Journal;
}

export type AnyFlow = FlowDeclaration<string>;

export interface FlowRunContext {
  readonly actor: Actor;
  readonly input?: unknown;
}

export interface FlowRunResult {
  readonly status: FlowStatus;
  readonly instance: FlowInstance;
  readonly gate: ApprovalStep | null;
}

export const FLOW_NO_PENDING_APPROVAL = "REX333";
export const FLOW_DECISION_FORBIDDEN = "REX334";

export type FlowDecisionErrorCode =
  typeof FLOW_NO_PENDING_APPROVAL | typeof FLOW_DECISION_FORBIDDEN;

export class FlowDecisionError extends RexError {
  override readonly code: FlowDecisionErrorCode;
  readonly reason: ReasonCode | null;

  constructor(code: FlowDecisionErrorCode, message: string, reason: ReasonCode | null) {
    super(code, message);
    this.name = "FlowDecisionError";
    this.code = code;
    this.reason = reason;
  }
}

function normalizeStep(
  flowId: string,
  step: FlowStepConfig,
  index: number,
  gates: Set<string>,
): FlowStep {
  const fail = (field: string, problem: string): never => {
    throw new RexDeclarationError("flow", flowId, `steps.${index}${field}`, problem);
  };
  const candidate: unknown = step;
  if (!isPlainObject(candidate)) return fail("", "must be an action step or an approval gate");
  if ("action" in step) {
    for (const property of Object.keys(step)) {
      if (property !== "action" && property !== "input")
        fail(`.${property}`, "is not part of an action step");
    }
    const declared = step.action as unknown;
    if (
      typeof declared !== "object" ||
      declared === null ||
      (declared as { kind?: unknown }).kind !== "action"
    ) {
      fail(".action", "must be an action declaration");
    }
    if (typeof step.input !== "function")
      fail(".input", "must be a function from flow context to input");
    const input = step.input;
    return Object.freeze({
      kind: "action",
      action: step.action,
      input(ctx: FlowStepContext) {
        return input(ctx);
      },
    });
  }
  if ("approval" in step) {
    for (const property of Object.keys(step)) {
      if (property !== "approval" && property !== "label" && property !== "approvers") {
        fail(`.${property}`, "is not part of an approval gate");
      }
    }
    try {
      validateName(step.approval, "approval gate");
    } catch (error) {
      fail(".approval", (error as Error).message);
    }
    if (gates.has(step.approval)) fail(".approval", `repeats gate "${step.approval}"`);
    gates.add(step.approval);
    if (typeof step.label !== "string" || step.label.trim() === "")
      fail(".label", "must be a non-empty string");
    if (!isPredicate(step.approvers)) fail(".approvers", "must be a policy predicate");
    return Object.freeze({
      kind: "approval",
      id: step.approval,
      label: step.label,
      approvers: step.approvers,
    });
  }
  return fail("", "must declare action or approval");
}

export function flow<const N extends string>(name: N, config: FlowConfig): FlowDeclaration<N> {
  const id = declarationName("flow", name);
  const fail = (field: string, problem: string): never => {
    throw new RexDeclarationError("flow", id, field, problem);
  };
  if (!isPlainObject(config)) fail("config", "must be a declaration object");
  for (const property of Object.keys(config)) {
    if (property !== "steps" && property !== "journal")
      fail(property, "is not part of the flow declaration");
  }
  if (!Array.isArray(config.steps) || config.steps.length === 0) {
    fail("steps", "must be a non-empty list of steps");
  }
  if (!isJournal(config.journal)) fail("journal", "must implement open, record, load and list");
  const gates = new Set<string>();
  const steps = config.steps.map((step, index) => normalizeStep(id, step, index, gates));
  return Object.freeze({
    kind: "flow",
    id,
    name: id,
    steps: Object.freeze(steps),
    journal: config.journal,
  });
}

function now(): string {
  return new Date().toISOString();
}

function outputsOf(instance: FlowInstance, length: number): unknown[] {
  const outputs: unknown[] = Array.from({ length }, () => undefined);
  for (const entry of instance.entries) {
    if (entry.type === "step") outputs[entry.index] = entry.output;
  }
  return outputs;
}

function pendingGate(
  declared: AnyFlow,
  instance: FlowInstance,
): { index: number; gate: ApprovalStep } | null {
  if (instance.status !== "paused") return null;
  const last = instance.entries.at(-1);
  if (last?.type !== "paused") return null;
  const step = declared.steps[last.index];
  return step?.kind === "approval" ? { index: last.index, gate: step } : null;
}

export async function runFlow(
  declared: AnyFlow,
  instanceId: string,
  ctx: FlowRunContext,
): Promise<FlowRunResult> {
  const journal = declared.journal;
  let instance = await journal.open(declared.id, instanceId, ctx.input);
  if (instance.status === "completed" || instance.status === "rejected") {
    return { status: instance.status, instance, gate: null };
  }
  const pending = pendingGate(declared, instance);
  if (pending) return { status: "paused", instance, gate: pending.gate };

  const done = completedSteps(instance.entries);
  const outputs = outputsOf(instance, declared.steps.length);
  for (const [index, step] of declared.steps.entries()) {
    if (done.has(index)) continue;
    if (step.kind === "approval") {
      instance = await journal.record(instanceId, {
        type: "paused",
        index,
        gate: step.id,
        at: now(),
      });
      return { status: "paused", instance, gate: step };
    }
    let failure: string | null = null;
    try {
      const decision = evaluate(step.action.policy, ctx.actor);
      if (!decision.allowed) {
        failure = `action "${step.action.id}" is forbidden: ${decision.reason}`;
      } else {
        const input = await validated(
          step.action.input,
          step.input({ actor: ctx.actor, input: instance.input, outputs: [...outputs] }),
        );
        const output = await validated(
          step.action.output,
          await step.action.handler(input as Parameters<AnyAction["handler"]>[0], {
            actor: ctx.actor,
          }),
        );
        outputs[index] = output;
        instance = await journal.record(instanceId, {
          type: "step",
          index,
          action: step.action.id,
          output,
          at: now(),
        });
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    if (failure !== null) {
      instance = await journal.record(instanceId, {
        type: "failed",
        index,
        error: failure,
        at: now(),
      });
      return { status: "failed", instance, gate: null };
    }
  }
  instance = await journal.record(instanceId, { type: "completed", at: now() });
  return { status: "completed", instance, gate: null };
}

export async function decide(
  declared: AnyFlow,
  instanceId: string,
  decision: FlowDecision,
  actor: Actor,
): Promise<FlowRunResult> {
  if (decision !== "approve" && decision !== "reject") {
    throw new RexError(
      "REX329",
      `decide: decision must be approve or reject, received ${String(decision)}`,
    );
  }
  const instance = await declared.journal.load(instanceId);
  if (instance === undefined || instance.flowId !== declared.id) {
    throw new FlowDecisionError(
      FLOW_NO_PENDING_APPROVAL,
      `flow "${declared.id}" has no instance "${instanceId}"`,
      null,
    );
  }
  const pending = pendingGate(declared, instance);
  if (pending === null) {
    throw new FlowDecisionError(
      FLOW_NO_PENDING_APPROVAL,
      `flow "${declared.id}" instance "${instanceId}" is ${instance.status} with no pending approval`,
      null,
    );
  }
  const allowed = evaluate(pending.gate.approvers, actor);
  if (!allowed.allowed) {
    throw new FlowDecisionError(
      FLOW_DECISION_FORBIDDEN,
      `actor "${actor.id}" may not decide gate "${pending.gate.id}": ${allowed.reason}`,
      allowed.reason,
    );
  }
  const recorded = await declared.journal.record(instanceId, {
    type: "decision",
    index: pending.index,
    gate: pending.gate.id,
    decision,
    actor: actor.id,
    at: now(),
  });
  if (decision === "reject") return { status: "rejected", instance: recorded, gate: null };
  return runFlow(declared, instanceId, { actor });
}
