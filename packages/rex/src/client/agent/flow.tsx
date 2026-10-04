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
import { actionAddress } from "../../core/ids.ts";
import type { AnyFlow, ApprovalStep } from "../../core/flow.ts";
import type { FlowDecision } from "../../core/journal.ts";
import { evaluate, type PolicyResult } from "../../core/policy.ts";
import { FLOW_RPC_PREFIX, type FlowState } from "../../core/protocol.ts";
import type { FlowRouter } from "../../server/flow.ts";
import { describeError } from "../act.ts";
import type { RexFetch } from "../app.tsx";
import { RexRuntimeContext, useActor } from "../context.ts";
import { LAZY_FAILURE_CODE, lazyFailureOutcome, lazyModule, useLazyModule } from "../lazy.ts";
import { APP_OUTCOME_KEY, useOutcomeStore } from "../outcome.ts";
import { useActivePage } from "../router.tsx";
import { useConfirm } from "./confirm.tsx";
import type { FlowGateContext, FlowGateNames } from "./flow-gate.ts";
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
  const runtime = useContext(RexRuntimeContext);
  const baseUrl = runtime?.baseUrl;
  const fetchImpl = runtime?.fetch;
  return useMemo(
    () =>
      provided ??
      createFlowClient({
        ...(baseUrl === undefined ? {} : { baseUrl }),
        ...(fetchImpl === undefined ? {} : { fetch: fetchImpl }),
      }),
    [provided, baseUrl, fetchImpl],
  );
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

type FlowGateModule = typeof import("./flow-gate.ts");

const flowGateModule = lazyModule<FlowGateModule>("rex.flow-gate", "the flow gate", () =>
  import("./flow-gate.ts"),
);

const NO_GATE_AFFORDANCES: readonly Affordance[] = Object.freeze([]);

const GATE_NAMES: FlowGateNames = Object.freeze({
  affordanceId: gateAffordanceId,
  label: gateLabel,
  address: actionAddress,
  describe: describeError,
});

async function withFlowGate(
  run: (gates: FlowGateModule) => Promise<FlowDecisionResult>,
): Promise<FlowDecisionResult> {
  const loaded = await flowGateModule.load();
  if (loaded.ok) return run(loaded.value);
  const failure = lazyFailureOutcome(flowGateModule, loaded.error);
  return { ok: false, code: LAZY_FAILURE_CODE, message: failure.message };
}

export function useFlow(declared: AnyFlow, instanceId: string): FlowHandle {
  const client = useFlowClient();
  const subject = useActor();
  const outcomes = useOutcomeStore();
  const confirm = useConfirm();
  const active = useActivePage();
  const pageId = active === null ? null : active.page.id;
  const loaded = useLazyModule(flowGateModule);
  const gates = loaded !== null && loaded.ok ? loaded.value : null;
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

  const context = useMemo<FlowGateContext>(
    () => ({
      declared,
      instanceId,
      client,
      outcomes,
      pageId,
      outcomeKey: pageId ?? APP_OUTCOME_KEY,
      names: GATE_NAMES,
      gate,
      decision,
      setState,
      setPending,
      setError,
    }),
    [client, decision, declared, gate, instanceId, outcomes, pageId],
  );

  const decideDirect = useCallback(
    (choice: FlowDecision): Promise<FlowDecisionResult> =>
      withFlowGate((loadedGates) => loadedGates.decideFlow(context, choice)),
    [context],
  );

  const decideRef = useRef(decideDirect);
  decideRef.current = decideDirect;

  const confirmed = useCallback(
    (choice: FlowDecision): Promise<FlowDecisionResult> =>
      withFlowGate((loadedGates) =>
        loadedGates.confirmFlowDecision(context, confirm, choice, (next) => decideRef.current(next)),
      ),
    [confirm, context],
  );

  const affordances = useMemo<readonly Affordance[]>(
    () =>
      gates === null
        ? NO_GATE_AFFORDANCES
        : gates.flowAffordances({ declared, gate, decision, names: GATE_NAMES }, (choice) =>
            decideRef.current(choice),
          ),
    [decision, declared, gate, gates],
  );

  useRegisterAffordances(pageId, affordances);

  const controlProps = (choice: FlowDecision): GateControlProps | null =>
    gates === null
      ? null
      : gates.gateControlProps({ declared, gate, decision, pageId, names: GATE_NAMES }, choice, pending, (picked) => {
          void confirmed(picked);
        });

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
