import { ORPCError, os } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import type { Hono } from "hono";
import type { ActionEffect } from "../core/action.ts";
import { RexError } from "../core/errors.ts";
import {
  FLOW_DECISION_FORBIDDEN,
  FlowDecisionError,
  decide,
  runFlow,
  type AnyFlow,
} from "../core/flow.ts";
import { completedSteps, type FlowDecision, type FlowInstance } from "../core/journal.ts";
import {
  FLOW_RPC_PREFIX,
  flowDecideInputSchema,
  flowInstanceInputSchema,
  flowStartInputSchema,
  flowStateSchema,
  type FlowGateState,
  type FlowState,
  type FlowStateStatus,
} from "../core/protocol.ts";
import type { RexServerSetup } from "./app.ts";
import { AUDIT_OK, createAuditEntry, type AuditOutcome, type Ledger } from "./audit.ts";
import {
  RexDensityError,
  createRexContext,
  type ActorResolver,
  type RexContext,
} from "./context.ts";
import { auditCode } from "./router.ts";

export { FLOW_RPC_PREFIX, flowStateSchema };
export type { FlowGateState, FlowState, FlowStateStatus };

export const FLOW_DECISION_EFFECT: ActionEffect = "irreversible";

export interface FlowDecisionAuditInput {
  readonly flow: string;
  readonly instance: string;
  readonly gate: string;
  readonly decision: FlowDecision;
}

export function flowState(
  declared: AnyFlow,
  instanceId: string,
  instance: FlowInstance | undefined,
): FlowState {
  if (instance === undefined) {
    return { flow: declared.id, instance: instanceId, status: "idle", gate: null, completed: 0 };
  }
  let gate: FlowGateState | null = null;
  const last = instance.entries.at(-1);
  if (instance.status === "paused" && last?.type === "paused") {
    const step = declared.steps[last.index];
    if (step?.kind === "approval") gate = { id: step.id, label: step.label };
  }
  return {
    flow: declared.id,
    instance: instanceId,
    status: instance.status,
    gate,
    completed: completedSteps(instance.entries).size,
  };
}

function lookup(byId: ReadonlyMap<string, AnyFlow>, id: string): AnyFlow {
  const declared = byId.get(id);
  if (declared === undefined) throw new ORPCError("NOT_FOUND", { message: `unknown flow "${id}"` });
  return declared;
}

function decisionError(error: unknown): unknown {
  if (error instanceof FlowDecisionError) {
    if (error.code === FLOW_DECISION_FORBIDDEN) {
      return new ORPCError("FORBIDDEN", { message: error.message, data: { reason: error.reason } });
    }
    return new ORPCError("CONFLICT", { message: error.message });
  }
  return error;
}

export function gateActionId(declared: AnyFlow, gate: string, decision: FlowDecision): string {
  return `${declared.id}.${gate}.${decision}`;
}

async function pendingGate(declared: AnyFlow, instanceId: string): Promise<FlowGateState | null> {
  const instance = await declared.journal.load(instanceId);
  if (instance === undefined || instance.flowId !== declared.id) return null;
  return flowState(declared, instanceId, instance).gate;
}

function assertLedger(caller: string, ledger: Ledger): void {
  if (
    typeof ledger !== "object" ||
    ledger === null ||
    typeof ledger.append !== "function" ||
    typeof ledger.list !== "function"
  ) {
    throw new RexError("REX400", `${caller}: ledger must implement append and list`);
  }
}

const base = os.$context<RexContext>();

export function buildFlowRouter(flows: readonly AnyFlow[], ledger: Ledger) {
  assertLedger("buildFlowRouter", ledger);
  const byId = new Map<string, AnyFlow>();
  for (const declared of flows) {
    if (declared.kind !== "flow")
      throw new RexError("REX400", "buildFlowRouter: flows must be flow declarations");
    if (byId.has(declared.id)) {
      throw new RexError("REX401", `buildFlowRouter: duplicate flow "${declared.id}"`);
    }
    byId.set(declared.id, declared);
  }
  return {
    status: base
      .input(flowInstanceInputSchema)
      .output(flowStateSchema)
      .handler(async ({ input }) => {
        const declared = lookup(byId, input.flow);
        const instance = await declared.journal.load(input.instance);
        if (instance !== undefined && instance.flowId !== declared.id) {
          throw new ORPCError("CONFLICT", {
            message: `instance "${input.instance}" belongs to flow "${instance.flowId}"`,
          });
        }
        return flowState(declared, input.instance, instance);
      }),
    start: base
      .input(flowStartInputSchema)
      .output(flowStateSchema)
      .handler(async ({ input, context }) => {
        const declared = lookup(byId, input.flow);
        const result = await runFlow(declared, input.instance, {
          actor: context.actor,
          input: input.input,
        });
        return flowState(declared, input.instance, result.instance);
      }),
    decide: base
      .input(flowDecideInputSchema)
      .output(flowStateSchema)
      .handler(async ({ input, context }) => {
        const declared = lookup(byId, input.flow);
        const gate = await pendingGate(declared, input.instance);
        const at = new Date().toISOString();
        const started = performance.now();
        let outcome: AuditOutcome = AUDIT_OK;
        try {
          const result = await decide(declared, input.instance, input.decision, context.actor);
          return flowState(declared, input.instance, result.instance);
        } catch (error) {
          const mapped = decisionError(error);
          outcome = auditCode(mapped);
          throw mapped;
        } finally {
          if (gate !== null) {
            const decided: FlowDecisionAuditInput = {
              flow: declared.id,
              instance: input.instance,
              gate: gate.id,
              decision: input.decision,
            };
            await ledger.append(
              await createAuditEntry({
                actor: context.actor.id,
                actionId: gateActionId(declared, gate.id, input.decision),
                input: decided,
                outcome,
                effect: FLOW_DECISION_EFFECT,
                durationMs: performance.now() - started,
                at,
              }),
            );
          }
        }
      }),
  };
}

export type FlowRouter = ReturnType<typeof buildFlowRouter>;

export interface MountFlowsOptions {
  readonly flows: readonly AnyFlow[];
  readonly actor: ActorResolver;
  readonly ledger: Ledger;
}

export function mountFlows(app: Hono, options: MountFlowsOptions): Hono {
  if (typeof options.actor !== "function") {
    throw new RexError("REX400", "mountFlows: actor must be a function from request to actor");
  }
  assertLedger("mountFlows", options.ledger);
  const handler = new RPCHandler(buildFlowRouter(options.flows, options.ledger));
  app.use(`${FLOW_RPC_PREFIX}/*`, async (c, next) => {
    let context: RexContext;
    try {
      context = await createRexContext(c.req.raw, options.actor);
    } catch (error) {
      if (error instanceof RexDensityError) {
        return c.json({ code: "BAD_REQUEST", message: error.message }, 400);
      }
      throw error;
    }
    const { matched, response } = await handler.handle(c.req.raw, {
      prefix: FLOW_RPC_PREFIX,
      context,
    });
    if (!matched) {
      await next();
      return;
    }
    return c.newResponse(response.body, response);
  });
  return app;
}

export function installFlowRoutes(app: Hono, setup: RexServerSetup): void {
  mountFlows(app, {
    flows: setup.options.registry.flows ?? [],
    actor: setup.options.actor,
    ledger: setup.options.ledger,
  });
}
