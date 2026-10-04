import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { ActionInput, AnyAction } from "../../core/action.ts";
import { RexError } from "../../core/errors.ts";
import { actionAddress } from "../../core/ids.ts";
import { validateStandard } from "../../core/standard.ts";
import { actionLabel, describeError, useAct, type ActHandle, type ActResult } from "../act.ts";
import { APP_OUTCOME_KEY, useOutcomeStore } from "../outcome.ts";
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

interface Pending {
  readonly request: ConfirmRequest;
  readonly resolve: (accepted: boolean) => void;
  readonly opener: Element | null;
}

function describeInput(input: unknown): string {
  try {
    return JSON.stringify(input) ?? "";
  } catch {
    return String(input);
  }
}

function ConfirmDialog({
  pending,
  settle,
}: {
  readonly pending: Pending;
  readonly settle: (accepted: boolean) => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const accept = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const { request } = pending;
  const label = request.action.label ?? request.action.id;
  const address =
    request.page === null ? request.action.id : actionAddress(request.page, request.action.id);

  useLayoutEffect(() => {
    accept.current?.focus();
  }, [pending]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      settle(false);
      return;
    }
    if (event.key !== "Tab" || dialog.current === null) return;
    const buttons = [...dialog.current.querySelectorAll("button")];
    const first = buttons[0];
    const last = buttons.at(-1);
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={dialog}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      data-rex-confirm={address}
      onKeyDown={onKeyDown}
    >
      <h2 id={titleId}>Confirm {label}</h2>
      <p id={bodyId}>
        {label} cannot be undone. Input: <code>{describeInput(request.input)}</code>
      </p>
      <button
        type="button"
        ref={accept}
        data-rex-confirm-accept={address}
        onClick={() => settle(true)}
      >
        Confirm {label}
      </button>
      <button type="button" data-rex-confirm-cancel={address} onClick={() => settle(false)}>
        Cancel
      </button>
    </div>
  );
}

export interface ConfirmProviderProps {
  readonly children?: ReactNode;
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [pending, setPending] = useState<Pending | null>(null);
  const current = useRef<Pending | null>(null);

  const confirm = useCallback<ConfirmFn>((request) => {
    if (request.action.effect !== "irreversible") return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      current.current?.resolve(false);
      const next: Pending = {
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
      {pending === null ? null : <ConfirmDialog pending={pending} settle={settle} />}
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
