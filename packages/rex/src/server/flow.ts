import { ORPCError, os } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import type { Hono } from "hono";
import { FlowDecisionError, decide, runFlow, type AnyFlow } from "../core/flow.ts";
import { completedSteps, type FlowInstance, type FlowStatus } from "../core/journal.ts";
import { z } from "../core/schema.ts";
import type { RexServerSetup } from "./app.ts";
import {
  RexDensityError,
  createRexContext,
  type ActorResolver,
  type RexContext,
} from "./context.ts";

export const FLOW_RPC_PREFIX = "/rex/flow";

export type FlowStateStatus = FlowStatus | "idle";

export interface FlowGateState {
  readonly id: string;
  readonly label: string;
}

export interface FlowState {
  readonly flow: string;
  readonly instance: string;
  readonly status: FlowStateStatus;
  readonly gate: FlowGateState | null;
  readonly completed: number;
}

const instanceInput = z.strictObject({
  flow: z.string().min(1),
  instance: z.string().min(1),
});

const startInput = z.strictObject({
  flow: z.string().min(1),
  instance: z.string().min(1),
  input: z.unknown().optional(),
});

const decideInput = z.strictObject({
  flow: z.string().min(1),
  instance: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
});

export const flowStateSchema = z.strictObject({
  flow: z.string().min(1),
  instance: z.string().min(1),
  status: z.enum(["idle", "running", "paused", "completed", "rejected", "failed"]),
  gate: z.strictObject({ id: z.string().min(1), label: z.string().min(1) }).nullable(),
  completed: z.number().int().min(0),
});

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

function decisionError(error: unknown): never {
  if (error instanceof FlowDecisionError) {
    if (error.code === "FORBIDDEN") {
      throw new ORPCError("FORBIDDEN", { message: error.message, data: { reason: error.reason } });
    }
    throw new ORPCError("CONFLICT", { message: error.message });
  }
  throw error;
}

const base = os.$context<RexContext>();

export function buildFlowRouter(flows: readonly AnyFlow[]) {
  const byId = new Map<string, AnyFlow>();
  for (const declared of flows) {
    if (declared.kind !== "flow")
      throw new TypeError("buildFlowRouter: flows must be flow declarations");
    if (byId.has(declared.id)) throw new Error(`buildFlowRouter: duplicate flow "${declared.id}"`);
    byId.set(declared.id, declared);
  }
  return {
    status: base
      .input(instanceInput)
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
      .input(startInput)
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
      .input(decideInput)
      .output(flowStateSchema)
      .handler(async ({ input, context }) => {
        const declared = lookup(byId, input.flow);
        try {
          const result = await decide(declared, input.instance, input.decision, context.actor);
          return flowState(declared, input.instance, result.instance);
        } catch (error) {
          return decisionError(error);
        }
      }),
  };
}

export type FlowRouter = ReturnType<typeof buildFlowRouter>;

export interface MountFlowsOptions {
  readonly flows: readonly AnyFlow[];
  readonly actor: ActorResolver;
}

export function mountFlows(app: Hono, options: MountFlowsOptions): Hono {
  if (typeof options.actor !== "function") {
    throw new TypeError("mountFlows: actor must be a function from request to actor");
  }
  const handler = new RPCHandler(buildFlowRouter(options.flows));
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
  mountFlows(app, { flows: setup.options.registry.flows ?? [], actor: setup.options.actor });
}
