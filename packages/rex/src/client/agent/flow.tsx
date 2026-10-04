import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { RexError } from "../../core/errors.ts";
import type { AnyFlow, ApprovalStep } from "../../core/flow.ts";
import { actionAddress } from "../../core/ids.ts";
import type { FlowDecision } from "../../core/journal.ts";
import { evaluate, type PolicyResult } from "../../core/policy.ts";
import { FLOW_RPC_PREFIX, type FlowRouter, type FlowState } from "../../server/flow.ts";
import { describeError } from "../act.ts";
import type { RexFetch } from "../app.tsx";
import { useActor } from "../context.ts";
import { APP_OUTCOME_KEY, useOutcomeStore } from "../outcome.ts";
import { useActivePage } from "../router.tsx";
import { useConfirm } from "./confirm.tsx";
import { useRegisterAffordances, type Affordance } from "./sidecar.tsx";

export type FlowClient = RouterClient<FlowRouter>;

export interface FlowClientOptions {
  readonly baseUrl?: string;
  readonly fetch?: RexFetch;
}

export function createFlowClient(options: FlowClientOptions = {}): FlowClient {
  const base = options.baseUrl ?? globalThis.location?.origin;
  if (typeof base !== "string" || !/^https?:\/\//.test(base)) {
    throw new RexError(
      "REX323",
      "rex: createFlowClient needs an http(s) baseUrl when the page has no location",
    );
  }
  const url = new URL(FLOW_RPC_PREFIX, base).toString();
  const fetchImpl = options.fetch;
  const link =
    fetchImpl === undefined
      ? new RPCLink({ url })
      : new RPCLink({ url, fetch: (request, init) => fetchImpl(request, init) });
  return createORPCClient<FlowClient>(link);
}

export const FlowClientContext = createContext<FlowClient | null>(null);
FlowClientContext.displayName = "RexFlowClient";

export interface FlowClientProviderProps {
  readonly client: FlowClient;
  readonly children?: ReactNode;
}

export function FlowClientProvider({ client, children }: FlowClientProviderProps) {
  return createElement(FlowClientContext.Provider, { value: client }, children);
}

export function useFlowClient(): FlowClient {
  const provided = useContext(FlowClientContext);
  return useMemo(() => provided ?? createFlowClient(), [provided]);
}

export function gateAffordanceId(declared: AnyFlow, gate: string, decision: FlowDecision): string {
  return `${declared.id}.${gate}.${decision}`;
}

export function gateLabel(gate: ApprovalStep, decision: FlowDecision): string {
  return `${decision === "approve" ? "Approve" : "Reject"} ${gate.label}`;
}

export type FlowDecisionResult =
  | { readonly ok: true; readonly state: FlowState }
  | { readonly ok: false; readonly code: string; readonly message: string };

export interface GateControlProps {
  readonly "data-rex": string;
  readonly "data-rex-allowed": "true" | "false";
  readonly disabled: boolean;
  readonly "aria-disabled": boolean;
  readonly title?: string;
  readonly onClick: () => void;
}

export interface FlowHandle {
  readonly state: FlowState | null;
  readonly gate: ApprovalStep | null;
  readonly allowed: boolean;
  readonly reason: string | null;
  readonly pending: boolean;
  readonly error: string | null;
  refresh(): Promise<void>;
  start(input?: unknown): Promise<void>;
  approve(): Promise<FlowDecisionResult>;
  reject(): Promise<FlowDecisionResult>;
  readonly approveProps: GateControlProps | null;
  readonly rejectProps: GateControlProps | null;
}

export function useFlow(declared: AnyFlow, instanceId: string): FlowHandle {
  const client = useFlowClient();
  const subject = useActor();
  const outcomes = useOutcomeStore();
  const confirm = useConfirm();
  const active = useActivePage();
  const pageId = active === null ? null : active.page.id;
  const [state, setState] = useState<FlowState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(async (request: () => Promise<FlowState>): Promise<FlowState | null> => {
    setPending(true);
    try {
      const next = await request();
      setState(next);
      setError(null);
      return next;
    } catch (failure) {
      setError(describeError(failure).message);
      return null;
    } finally {
      setPending(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await call(() => client.status({ flow: declared.id, instance: instanceId }));
  }, [call, client, declared, instanceId]);

  useEffect(() => {
    setState(null);
    void refresh();
  }, [refresh]);

  const start = useCallback(
    async (input?: unknown) => {
      await call(() =>
        client.start(
          input === undefined
            ? { flow: declared.id, instance: instanceId }
            : { flow: declared.id, instance: instanceId, input },
        ),
      );
    },
    [call, client, declared, instanceId],
  );

  const gate = useMemo<ApprovalStep | null>(() => {
    const pendingGate = state?.gate;
    if (pendingGate === null || pendingGate === undefined) return null;
    const step = declared.steps.find(
      (entry): entry is ApprovalStep => entry.kind === "approval" && entry.id === pendingGate.id,
    );
    return step ?? null;
  }, [declared, state]);

  const decision = useMemo<PolicyResult | null>(
    () => (gate === null ? null : evaluate(gate.approvers, subject)),
    [gate, subject],
  );

  const decideDirect = useCallback(
    async (choice: FlowDecision): Promise<FlowDecisionResult> => {
      if (gate === null) {
        return {
          ok: false,
          code: "CONFLICT",
          message: `flow "${declared.id}" is not paused at a gate`,
        };
      }
      const id = gateAffordanceId(declared, gate.id, choice);
      const label = gateLabel(gate, choice);
      const record = (ok: boolean, message: string) =>
        outcomes.set(pageId ?? APP_OUTCOME_KEY, {
          actionId: id,
          ok,
          message,
          at: new Date().toISOString(),
        });
      if (decision !== null && !decision.allowed) {
        const message = `${label}: not allowed (${decision.reason})`;
        record(false, message);
        return { ok: false, code: "FORBIDDEN", message };
      }
      setPending(true);
      try {
        const next = await client.decide({
          flow: declared.id,
          instance: instanceId,
          decision: choice,
        });
        setState(next);
        setError(null);
        record(true, `${label} succeeded; flow ${next.status}`);
        return { ok: true, state: next };
      } catch (failure) {
        const { code, message } = describeError(failure);
        setError(message);
        record(false, `${label} failed: ${message}`);
        return { ok: false, code, message };
      } finally {
        setPending(false);
      }
    },
    [client, decision, declared, gate, instanceId, outcomes, pageId],
  );

  const decideRef = useRef(decideDirect);
  decideRef.current = decideDirect;

  const confirmed = useCallback(
    async (choice: FlowDecision): Promise<FlowDecisionResult> => {
      if (gate === null) return decideRef.current(choice);
      const id = gateAffordanceId(declared, gate.id, choice);
      const label = gateLabel(gate, choice);
      const accepted = await confirm({
        page: pageId,
        action: { id, label, effect: "irreversible" },
        input: {},
      });
      if (!accepted) {
        const message = `${label} cancelled`;
        outcomes.set(pageId ?? APP_OUTCOME_KEY, {
          actionId: id,
          ok: false,
          message,
          at: new Date().toISOString(),
        });
        return { ok: false, code: "CANCELLED", message };
      }
      return decideRef.current(choice);
    },
    [confirm, declared, gate, outcomes, pageId],
  );

  const affordances = useMemo<readonly Affordance[]>(() => {
    if (gate === null || decision === null) return [];
    return (["approve", "reject"] as const).map((choice): Affordance => ({
      id: gateAffordanceId(declared, gate.id, choice),
      label: gateLabel(gate, choice),
      allowed: decision.allowed,
      reason: decision.reason,
      effect: "irreversible",
      input: { type: "object", properties: {}, additionalProperties: false },
      via: ["click", "palette"],
      invoke: () => decideRef.current(choice),
    }));
  }, [decision, declared, gate]);

  useRegisterAffordances(pageId, affordances);

  const controlProps = (choice: FlowDecision): GateControlProps | null => {
    if (gate === null || decision === null || pageId === null) return null;
    const blocked = !decision.allowed || pending;
    return {
      "data-rex": actionAddress(pageId, gateAffordanceId(declared, gate.id, choice)),
      "data-rex-allowed": decision.allowed ? "true" : "false",
      disabled: blocked,
      "aria-disabled": blocked,
      ...(decision.allowed ? {} : { title: `Not allowed: ${decision.reason}` }),
      onClick: () => {
        void confirmed(choice);
      },
    };
  };

  return {
    state,
    gate,
    allowed: decision?.allowed ?? false,
    reason: decision?.reason ?? null,
    pending,
    error,
    refresh,
    start,
    approve: () => confirmed("approve"),
    reject: () => confirmed("reject"),
    approveProps: controlProps("approve"),
    rejectProps: controlProps("reject"),
  };
}
