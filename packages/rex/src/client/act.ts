import { ORPCError } from "@orpc/client";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import * as zm from "zod/mini";
import type { ActionInput, ActionOutput, AnyAction } from "../core/action.ts";
import { actionAddress } from "../core/ids.ts";
import { evaluate, type ReasonCode } from "../core/policy.ts";
import { formatIssues, validateStandard } from "../core/standard.ts";
import { CONFIRM_PROCEDURE } from "../core/protocol.ts";
import {
  procedureOf,
  useActor,
  useRegistry,
  useRexClient,
  type ConfirmGrant,
  type ConfirmRequest,
} from "./context.ts";
import { invalidatesLoaderQuery } from "./loaders.ts";
import { APP_OUTCOME_KEY, useOutcomeStore } from "./outcome.ts";
import { useActivePage } from "./router.tsx";

export type ActResult<A extends AnyAction> =
  | { readonly ok: true; readonly output: ActionOutput<A> }
  | { readonly ok: false; readonly code: string; readonly message: string };

export interface RunOptions {
  readonly confirmToken?: string;
}

export interface ActControlProps {
  readonly "data-rex"?: string;
  readonly "data-rex-allowed": "true" | "false";
  readonly disabled: boolean;
  readonly "aria-disabled": boolean;
  readonly "aria-busy": boolean;
  readonly title?: string;
}

interface MutationVariables {
  readonly input: unknown;
  readonly confirmToken: string | undefined;
}

export interface ActHandle<A extends AnyAction> {
  readonly action: A;
  readonly allowed: boolean;
  readonly reason: ReasonCode | null;
  readonly pending: boolean;
  readonly controlProps: ActControlProps;
  readonly mutation: UseMutationResult<ActionOutput<A>, Error, MutationVariables>;
  run(input: ActionInput<A>, options?: RunOptions): Promise<ActResult<A>>;
  requestConfirm(input: ActionInput<A>): Promise<ConfirmGrant>;
}

export const confirmGrantSchema = zm.object({
  token: zm.string().check(zm.minLength(1)),
  expiresAt: zm.iso.datetime(),
});

export function describeError(error: unknown): { code: string; message: string } {
  if (error instanceof ORPCError) {
    return { code: String(error.code), message: error.message };
  }
  if (error instanceof Error) return { code: "ERROR", message: error.message };
  return { code: "ERROR", message: String(error) };
}

export function actionLabel(declared: AnyAction): string {
  return declared.label ?? declared.id;
}

export async function inputProblem(declared: AnyAction, input: unknown): Promise<string | null> {
  const checked = await validateStandard(declared.input, input);
  if (checked.issues === undefined) return null;
  return `${actionLabel(declared)}: invalid input: ${formatIssues(checked.issues)}`;
}

export function useAct<A extends AnyAction>(declared: A): ActHandle<A> {
  const registry = useRegistry();
  if (registry.find("action", declared.id) !== declared) {
    throw new Error(`rex: action "${declared.id}" is not registered in this app`);
  }
  const subject = useActor();
  const client = useRexClient();
  const queryClient = useQueryClient();
  const outcomes = useOutcomeStore();
  const active = useActivePage();
  const pageId = active === null ? null : active.page.id;
  const [confirming, setConfirming] = useState(false);

  const policy = useMemo(() => evaluate(declared.policy, subject), [declared, subject]);

  const mutation = useMutation<ActionOutput<A>, Error, MutationVariables>({
    mutationKey: ["rex", "act", declared.id],
    mutationFn: async ({ input, confirmToken }) => {
      const call = procedureOf(client, declared.id);
      const raw =
        confirmToken === undefined ? await call(input) : await call(input, { context: { confirmToken } });
      const parsed = await validateStandard(declared.output, raw);
      if (parsed.issues !== undefined) {
        throw new Error(`the server returned an invalid output: ${formatIssues(parsed.issues)}`);
      }
      return parsed.value as ActionOutput<A>;
    },
    onSuccess: async () => {
      await Promise.all([
        ...declared.invalidates.map((name) => queryClient.invalidateQueries({ queryKey: [name] })),
        queryClient.invalidateQueries({
          predicate: (query) => invalidatesLoaderQuery(registry, query.queryKey, declared),
        }),
      ]);
    },
  });

  const record = useCallback(
    (ok: boolean, message: string) => {
      outcomes.set(pageId ?? APP_OUTCOME_KEY, {
        actionId: declared.id,
        ok,
        message,
        at: new Date().toISOString(),
      });
    },
    [declared, outcomes, pageId],
  );

  const requestConfirm = useCallback(
    async (input: ActionInput<A>): Promise<ConfirmGrant> => {
      const request: ConfirmRequest = { action: declared.id, input };
      const raw = await procedureOf(client, CONFIRM_PROCEDURE)(request);
      const parsed = await validateStandard(confirmGrantSchema, raw);
      if (parsed.issues !== undefined) {
        throw new Error(
          `the confirm procedure returned an invalid grant: ${formatIssues(parsed.issues)}`,
        );
      }
      return parsed.value;
    },
    [client, declared],
  );

  const { mutateAsync } = mutation;
  const run = useCallback(
    async (input: ActionInput<A>, options: RunOptions = {}): Promise<ActResult<A>> => {
      const label = actionLabel(declared);
      const problem = await inputProblem(declared, input);
      if (problem !== null) {
        const message = problem;
        record(false, message);
        return { ok: false, code: "BAD_REQUEST", message };
      }
      if (!policy.allowed) {
        const message = `${label}: not allowed (${policy.reason})`;
        record(false, message);
        return { ok: false, code: "FORBIDDEN", message };
      }
      try {
        let confirmToken = options.confirmToken;
        if (declared.effect === "irreversible" && confirmToken === undefined) {
          setConfirming(true);
          try {
            confirmToken = (await requestConfirm(input)).token;
          } finally {
            setConfirming(false);
          }
        }
        const output = await mutateAsync({ input, confirmToken });
        record(true, `${label} succeeded`);
        return { ok: true, output };
      } catch (error) {
        const { code, message } = describeError(error);
        record(false, `${label} failed: ${message}`);
        return { ok: false, code, message };
      }
    },
    [declared, mutateAsync, policy, record, requestConfirm],
  );

  const pending = confirming || mutation.isPending;
  const controlProps = useMemo<ActControlProps>(() => {
    const base = {
      "data-rex-allowed": policy.allowed ? ("true" as const) : ("false" as const),
      disabled: !policy.allowed || pending,
      "aria-disabled": !policy.allowed || pending,
      "aria-busy": pending,
    };
    const address = pageId === null ? {} : { "data-rex": actionAddress(pageId, declared.id) };
    const title = policy.allowed ? {} : { title: `Not allowed: ${policy.reason}` };
    return { ...base, ...address, ...title };
  }, [declared, pageId, pending, policy]);

  return {
    action: declared,
    allowed: policy.allowed,
    reason: policy.reason,
    pending,
    controlProps,
    mutation,
    run,
    requestConfirm,
  };
}
