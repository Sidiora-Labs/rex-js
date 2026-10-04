import { toORPCError } from "@orpc/client";
import { ORPCError, os, type Procedure } from "@orpc/server";
import type { AnyAction } from "../core/action.ts";
import type { Actor } from "../core/actor.ts";
import { RexError } from "../core/errors.ts";
import { evaluate } from "../core/policy.ts";
import { CONFIRM_PROCEDURE } from "../core/protocol.ts";
import * as zm from "zod/mini";
import { validateStandard } from "../core/standard.ts";
import {
  AUDIT_OK,
  ERROR_CODE_PATTERN,
  createAuditEntry,
  digest,
  type AuditOutcome,
  type Ledger,
} from "./audit.ts";
import type { RexContext } from "./context.ts";
import {
  ATTR_ACTION_ID,
  ATTR_ACTOR_ID,
  SPAN_ACTION,
  telemetryFor,
  type RexTelemetry,
} from "./middleware/telemetry.ts";

export { CONFIRM_PROCEDURE };
export const DEFAULT_CONFIRM_TTL_MS = 60_000;
export const PRECONDITION_REQUIRED = "PRECONDITION_REQUIRED";
export const PRECONDITION_REQUIRED_STATUS = 428;

type NoErrors = Record<never, never>;
type NoMeta = Record<never, never>;

type LowerLetter =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

export type ActionKey<Id extends string> = string extends Id ? `${LowerLetter}${string}` : Id;

export type ActionProcedure<A extends AnyAction> = Procedure<
  RexContext,
  RexContext,
  A["input"],
  A["output"],
  NoErrors,
  NoMeta
>;

export const confirmInputSchema = zm.strictObject({
  action: zm.string().check(zm.minLength(1)),
  input: zm.unknown(),
});

export const confirmOutputSchema = zm.strictObject({
  token: zm.string().check(zm.minLength(1)),
  action: zm.string().check(zm.minLength(1)),
  inputDigest: zm.string().check(zm.minLength(1)),
  expiresAt: zm.iso.datetime(),
});

export type ConfirmInput = zm.input<typeof confirmInputSchema>;
export type ConfirmOutput = zm.output<typeof confirmOutputSchema>;

export type ConfirmProcedure = Procedure<
  RexContext,
  RexContext,
  typeof confirmInputSchema,
  typeof confirmOutputSchema,
  NoErrors,
  NoMeta
>;

export type ActionRouter<A extends AnyAction> = {
  readonly [K in A as ActionKey<K["id"]>]: ActionProcedure<K>;
} & { readonly [CONFIRM_PROCEDURE]: ConfirmProcedure };

export interface ActionRouterSource<A extends AnyAction> {
  readonly actions: readonly A[];
}

export interface ActionRouterOptions {
  readonly ledger: Ledger;
  readonly confirmTtlMs?: number;
  readonly telemetry?: RexTelemetry;
}

interface PendingConfirmation {
  readonly actionId: string;
  readonly inputDigest: string;
  readonly actorId: string;
  readonly expiresAt: number;
}

export function auditCode(error: unknown): string {
  const code = toORPCError(error).code;
  if (ERROR_CODE_PATTERN.test(code)) return code;
  const normalized = code
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return /^[A-Z]/.test(normalized) ? normalized : `E_${normalized}`;
}

function randomToken(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function forbidden(declared: AnyAction, subject: Actor): void {
  const decision = evaluate(declared.policy, subject);
  if (!decision.allowed) {
    throw new ORPCError("FORBIDDEN", {
      message: `action "${declared.id}" is forbidden: ${decision.reason}`,
      data: { action: declared.id, reason: decision.reason },
    });
  }
}

function preconditionRequired(declared: AnyAction, inputDigest: string, problem: string): never {
  throw new ORPCError(PRECONDITION_REQUIRED, {
    status: PRECONDITION_REQUIRED_STATUS,
    message: `action "${declared.id}" is irreversible: ${problem}`,
    data: { action: declared.id, inputDigest },
  });
}

function createConfirmations(ttlMs: number) {
  const pending = new Map<string, PendingConfirmation>();

  const sweep = (now: number): void => {
    for (const [token, entry] of pending) {
      if (entry.expiresAt <= now) pending.delete(token);
    }
  };

  return {
    async issue(declared: AnyAction, input: unknown, subject: Actor): Promise<ConfirmOutput> {
      const now = Date.now();
      sweep(now);
      const inputDigest = await digest(input);
      const token = randomToken();
      const expiresAt = now + ttlMs;
      pending.set(token, { actionId: declared.id, inputDigest, actorId: subject.id, expiresAt });
      return {
        token,
        action: declared.id,
        inputDigest,
        expiresAt: new Date(expiresAt).toISOString(),
      };
    },
    async consume(declared: AnyAction, input: unknown, context: RexContext): Promise<void> {
      const inputDigest = await digest(input);
      const token = context.confirm;
      if (token === undefined || token === "") {
        preconditionRequired(
          declared,
          inputDigest,
          `a confirm token from ${CONFIRM_PROCEDURE} is required`,
        );
      }
      const entry = pending.get(token);
      pending.delete(token);
      if (entry === undefined) {
        preconditionRequired(declared, inputDigest, "the confirm token is unknown or already used");
      }
      if (entry.expiresAt <= Date.now()) {
        preconditionRequired(declared, inputDigest, "the confirm token has expired");
      }
      if (
        entry.actionId !== declared.id ||
        entry.inputDigest !== inputDigest ||
        entry.actorId !== context.actor.id
      ) {
        preconditionRequired(
          declared,
          inputDigest,
          "the confirm token was issued for a different action, input or actor",
        );
      }
    },
  };
}

type Confirmations = ReturnType<typeof createConfirmations>;

const base = os.$context<RexContext>();

function actionProcedure(
  declared: AnyAction,
  ledger: Ledger,
  confirmations: Confirmations,
  telemetry: () => RexTelemetry,
): ActionProcedure<AnyAction> {
  return base
    .use(async ({ context, next }, input: unknown) =>
      telemetry().span(
        SPAN_ACTION,
        { [ATTR_ACTION_ID]: declared.id, [ATTR_ACTOR_ID]: context.actor.id },
        async (span) => {
          const at = new Date().toISOString();
          const started = performance.now();
          let outcome: AuditOutcome = AUDIT_OK;
          try {
            return await next();
          } catch (error) {
            outcome = auditCode(error);
            throw error;
          } finally {
            span.outcome(outcome);
            await ledger.append(
              await createAuditEntry({
                actor: context.actor.id,
                actionId: declared.id,
                input,
                outcome,
                effect: declared.effect,
                durationMs: performance.now() - started,
                at,
                traceId: span.traceId,
                spanId: span.spanId,
              }),
            );
          }
        },
      ),
    )
    .use(async ({ context, next }) => {
      forbidden(declared, context.actor);
      return next();
    })
    .input(declared.input)
    .output(declared.output)
    .handler(async ({ input, context }) => {
      if (declared.effect === "irreversible") {
        await confirmations.consume(declared, input, context);
      }
      return declared.handler(input, { actor: context.actor });
    });
}

function confirmProcedure(
  byId: ReadonlyMap<string, AnyAction>,
  confirmations: Confirmations,
): ConfirmProcedure {
  return base
    .input(confirmInputSchema)
    .output(confirmOutputSchema)
    .handler(async ({ input, context }) => {
      const declared = byId.get(input.action);
      if (declared === undefined) {
        throw new ORPCError("NOT_FOUND", { message: `unknown action "${input.action}"` });
      }
      if (declared.effect !== "irreversible") {
        throw new ORPCError("BAD_REQUEST", {
          message: `action "${declared.id}" is ${declared.effect} and needs no confirmation`,
          data: { action: declared.id },
        });
      }
      forbidden(declared, context.actor);
      const parsed = await validateStandard(declared.input, input.input);
      if (parsed.issues !== undefined) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Input validation failed",
          data: { action: declared.id, issues: parsed.issues },
        });
      }
      return confirmations.issue(declared, parsed.value, context.actor);
    });
}

export function buildActionRouter<A extends AnyAction>(
  source: ActionRouterSource<A>,
  options: ActionRouterOptions,
): ActionRouter<A> {
  const ledger = options.ledger;
  if (
    typeof ledger !== "object" ||
    ledger === null ||
    typeof ledger.append !== "function" ||
    typeof ledger.list !== "function"
  ) {
    throw new RexError("REX400", "buildActionRouter: ledger must implement append and list");
  }
  const ttlMs = options.confirmTtlMs ?? DEFAULT_CONFIRM_TTL_MS;
  if (!Number.isInteger(ttlMs) || ttlMs < 1) {
    throw new RexError("REX400", "buildActionRouter: confirmTtlMs must be a positive integer");
  }
  const confirmations = createConfirmations(ttlMs);
  const configured = options.telemetry;
  const telemetry = (): RexTelemetry => configured ?? telemetryFor(ledger);
  const byId = new Map<string, AnyAction>();
  for (const declared of source.actions) {
    if (declared.kind !== "action") {
      throw new RexError("REX400", "buildActionRouter: actions must be action declarations");
    }
    if (declared.id === CONFIRM_PROCEDURE) {
      throw new RexError("REX401", `buildActionRouter: "${CONFIRM_PROCEDURE}" is reserved`);
    }
    if (byId.has(declared.id)) {
      throw new RexError("REX401", `buildActionRouter: duplicate action "${declared.id}"`);
    }
    byId.set(declared.id, declared);
  }
  const router: Record<string, ActionProcedure<AnyAction> | ConfirmProcedure> = {};
  for (const id of [...byId.keys()].sort()) {
    router[id] = actionProcedure(
      byId.get(id) as AnyAction,
      ledger,
      confirmations,
      telemetry,
    );
  }
  router[CONFIRM_PROCEDURE] = confirmProcedure(byId, confirmations);
  return Object.freeze(router) as unknown as ActionRouter<A>;
}
