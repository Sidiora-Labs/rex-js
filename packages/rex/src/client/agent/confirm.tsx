import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ActionInput, AnyAction } from "../../core/action.ts";
import { RexError } from "../../core/errors.ts";
import { actionAddress } from "../../core/ids.ts";
import { validateStandard } from "../../core/standard.ts";
import { actionLabel, describeError, useAct, type ActHandle, type ActResult } from "../act.ts";
import { APP_OUTCOME_KEY, useOutcomeStore } from "../outcome.ts";
import { lazyModule, useLazyModule } from "../lazy.ts";
import { useActivePage } from "../router.tsx";

export const CANCELLED = "CANCELLED";
export const UNKNOWN_ACTION = "NOT_FOUND";

export type ConfirmSubject = Pick<AnyAction, "id" | "label" | "effect">;

export interface ConfirmRequest {
  readonly page: string | null;
  readonly action: ConfirmSubject;
  readonly input: unknown;
}

export type ConfirmFn = (request: ConfirmRequest) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);
ConfirmContext.displayName = "RexConfirm";

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (confirm === null) {
    throw new RexError(
      "REX306",
      "rex: irreversible actions need a ConfirmProvider above the shell",
    );
  }
  return confirm;
}

export interface ConfirmPending {
  readonly request: ConfirmRequest;
  readonly resolve: (accepted: boolean) => void;
  readonly opener: Element | null;
}

const confirmDialog = lazyModule("rex.confirm-dialog", "the confirmation dialog", () =>
  import("./confirm-dialog.tsx").then((loaded) => loaded.ConfirmDialog),
);

function LazyConfirmDialog({
  pending,
  settle,
}: {
  readonly pending: ConfirmPending;
  readonly settle: (accepted: boolean) => void;
}) {
  const cancel = useCallback(() => settle(false), [settle]);
  const loaded = useLazyModule(confirmDialog, {
    outcome: pending.request.page ?? APP_OUTCOME_KEY,
    onFailure: cancel,
  });
  if (loaded === null || !loaded.ok) return null;
  const Dialog = loaded.value;
  const { request } = pending;
  const address =
    request.page === null ? request.action.id : actionAddress(request.page, request.action.id);
  return <Dialog pending={pending} address={address} settle={settle} />;
}

export interface ConfirmProviderProps {
  readonly children?: ReactNode;
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [pending, setPending] = useState<ConfirmPending | null>(null);
  const current = useRef<ConfirmPending | null>(null);

  const confirm = useCallback<ConfirmFn>((request) => {
    if (request.action.effect !== "irreversible") return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      current.current?.resolve(false);
      const next: ConfirmPending = {
        request,
        resolve,
        opener: globalThis.document?.activeElement ?? null,
      };
      current.current = next;
      setPending(next);
    });
  }, []);

  const settle = useCallback((accepted: boolean) => {
    const settled = current.current;
    if (settled === null) return;
    current.current = null;
    setPending(null);
    settled.resolve(accepted);
    const opener = settled.opener;
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  }, []);

  useEffect(
    () => () => {
      current.current?.resolve(false);
      current.current = null;
    },
    [],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending === null ? null : <LazyConfirmDialog pending={pending} settle={settle} />}
    </ConfirmContext.Provider>
  );
}

export interface InvokeHandle<A extends AnyAction> extends ActHandle<A> {
  invoke(input: ActionInput<A>): Promise<ActResult<A>>;
}

export function useInvoke<A extends AnyAction>(declared: A): InvokeHandle<A> {
  const handle = useAct(declared);
  const confirm = useConfirm();
  const outcomes = useOutcomeStore();
  const active = useActivePage();
  const pageId = active === null ? null : active.page.id;
  const { run, requestConfirm, allowed } = handle;

  const invoke = useCallback(
    async (input: ActionInput<A>): Promise<ActResult<A>> => {
      if (
        declared.effect !== "irreversible" ||
        !allowed ||
        (await validateStandard(declared.input, input)).issues !== undefined
      ) {
        return run(input);
      }
      const label = actionLabel(declared);
      const record = (message: string) =>
        outcomes.set(pageId ?? APP_OUTCOME_KEY, {
          actionId: declared.id,
          ok: false,
          message,
          at: new Date().toISOString(),
        });
      const accepted = await confirm({ page: pageId, action: declared, input });
      if (!accepted) {
        const message = `${label} cancelled`;
        record(message);
        return { ok: false, code: CANCELLED, message };
      }
      let token: string;
      try {
        token = (await requestConfirm(input)).token;
      } catch (error) {
        const { code, message } = describeError(error);
        record(`${label} failed: ${message}`);
        return { ok: false, code, message };
      }
      return run(input, { confirmToken: token });
    },
    [allowed, confirm, declared, outcomes, pageId, requestConfirm, run],
  );

  return { ...handle, invoke };
}

type Invoke = (input: unknown) => Promise<ActResult<AnyAction>>;

export interface PageInvokerSet {
  readonly page: string | null;
  has(actionId: string): boolean;
  invoke(actionId: string, input: unknown): Promise<ActResult<AnyAction>>;
}

export const PageInvokersContext = createContext<PageInvokerSet | null>(null);
PageInvokersContext.displayName = "RexPageInvokers";

export function usePageInvokers(): PageInvokerSet {
  const invokers = useContext(PageInvokersContext);
  if (invokers === null) {
    throw new RexError(
      "REX306",
      "rex: palette, shortcuts and URL invocation must render inside PageInvokers",
    );
  }
  return invokers;
}

function InvokerSlot({
  declared,
  slots,
}: {
  readonly declared: AnyAction;
  readonly slots: Map<string, Invoke>;
}) {
  const { invoke } = useInvoke(declared);
  useLayoutEffect(() => {
    const entry = invoke as Invoke;
    slots.set(declared.id, entry);
    return () => {
      if (slots.get(declared.id) === entry) slots.delete(declared.id);
    };
  }, [declared, invoke, slots]);
  return null;
}

export interface PageInvokersProps {
  readonly children?: ReactNode;
}

export function PageInvokers({ children }: PageInvokersProps) {
  const active = useActivePage();
  const outcomes = useOutcomeStore();
  const slots = useRef(new Map<string, Invoke>()).current;
  const pageId = active === null ? null : active.page.id;

  const value = useMemo<PageInvokerSet>(
    () => ({
      page: pageId,
      has: (actionId) => slots.has(actionId),
      invoke: async (actionId, input) => {
        const entry = slots.get(actionId);
        if (entry !== undefined) return entry(input);
        const message =
          pageId === null
            ? `no page is active to run "${actionId}"`
            : `page "${pageId}" declares no action "${actionId}"`;
        outcomes.set(pageId ?? APP_OUTCOME_KEY, {
          actionId: actionId === "" ? "unknown" : actionId,
          ok: false,
          message,
          at: new Date().toISOString(),
        });
        return { ok: false, code: UNKNOWN_ACTION, message };
      },
    }),
    [outcomes, pageId, slots],
  );

  return (
    <PageInvokersContext.Provider value={value}>
      {active === null
        ? null
        : active.page.actions.map((declared) => (
            <InvokerSlot key={declared.id} declared={declared} slots={slots} />
          ))}
      {children}
    </PageInvokersContext.Provider>
  );
}
