import { toORPCError } from "@orpc/client";
import { ORPCError, call } from "@orpc/server";
import type { QueryClient } from "@tanstack/react-query";
import type { Hono } from "hono";
import {
  loaderError,
  loaderInput,
  loaderQueryKey,
  type LoaderParams,
  type LoaderQueryKey,
  type RexLoaderError,
} from "../client/loaders.ts";
import type { AnyAction } from "../core/action.ts";
import { RexError } from "../core/errors.ts";
import type { AnyPage } from "../core/page.ts";
import type { RexServerSetup } from "./app.ts";
import type { RexContext } from "./context.ts";
import { telemetryFor, traceLoader, type RexTelemetry } from "./middleware/telemetry.ts";
import { buildActionRouter, type ActionProcedure } from "./router.ts";

export interface LoaderRunner {
  readonly telemetry: RexTelemetry;
  run(declared: AnyAction, input: unknown, context: RexContext): Promise<unknown>;
}

export interface PageLoaderOutcome {
  readonly name: string;
  readonly key: LoaderQueryKey;
  readonly ok: boolean;
  readonly error: RexLoaderError | null;
}

export interface RunPageLoadersOptions {
  readonly page: AnyPage;
  readonly params: LoaderParams;
  readonly context: RexContext;
  readonly queryClient: QueryClient;
  readonly runner: LoaderRunner;
}

export function createLoaderRunner(setup: RexServerSetup): LoaderRunner {
  const options = setup.options;
  const router = buildActionRouter(
    options.registry,
    options.confirmTtlMs === undefined
      ? { ledger: options.ledger }
      : { ledger: options.ledger, confirmTtlMs: options.confirmTtlMs },
  ) as unknown as Readonly<Record<string, ActionProcedure<AnyAction> | undefined>>;
  return Object.freeze({
    get telemetry(): RexTelemetry {
      return telemetryFor(options.ledger);
    },
    async run(declared: AnyAction, input: unknown, context: RexContext): Promise<unknown> {
      const procedure = router[declared.id];
      if (procedure === undefined) {
        throw new ORPCError("NOT_FOUND", { message: `unknown action "${declared.id}"` });
      }
      return call(procedure, input, { context });
    },
  });
}

const boundRunners = new WeakMap<Request, LoaderRunner>();

export function bindLoaderRunner(request: Request, runner: LoaderRunner): void {
  boundRunners.set(request, runner);
}

export function loaderRunnerFor(request: Request): LoaderRunner | undefined {
  return boundRunners.get(request);
}

export function installLoaderRunner(app: Hono, setup: RexServerSetup): void {
  const runner = createLoaderRunner(setup);
  app.get("*", async (c, next) => {
    bindLoaderRunner(c.req.raw, runner);
    await next();
  });
}

export async function runPageLoaders(
  options: RunPageLoadersOptions,
): Promise<readonly PageLoaderOutcome[]> {
  const { page: declared, params, context, queryClient, runner } = options;
  return Promise.all(
    declared.loaders.map(async (loader): Promise<PageLoaderOutcome> => {
      const input = loaderInput(loader, params);
      const key = loaderQueryKey(declared.id, loader.name, input);
      await queryClient.prefetchQuery({
        queryKey: key,
        queryFn: () =>
          traceLoader(
            runner.telemetry,
            { pageId: declared.id, actionId: loader.action.id, actorId: context.actor.id },
            async (span) => {
              try {
                return await runner.run(loader.action, input, context);
              } catch (error) {
                const failure = toORPCError(error);
                span.outcome(failure.code);
                throw loaderError(declared.id, loader.name, failure);
              }
            },
          ),
        retry: false,
      });
      const state = queryClient.getQueryState<unknown, RexLoaderError>(key);
      if (state?.status === "success") return { name: loader.name, key, ok: true, error: null };
      const error =
        state?.error ??
        loaderError(
          declared.id,
          loader.name,
          new RexError("REX324", "the loader produced no result"),
        );
      return { name: loader.name, key, ok: false, error };
    }),
  );
}
