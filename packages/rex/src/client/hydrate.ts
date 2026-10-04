import { hydrate, type DehydratedState, type QueryClient } from "@tanstack/react-query";
import type { ErrorInfo } from "react";
import type { ActorInput } from "../core/actor.ts";
import { isPlainObject } from "../core/entity.ts";
import { RexError } from "../core/errors.ts";
import { escapeInlineJson } from "../core/serialize.ts";
import { adoptServerLoaders } from "./loaders.ts";

export const REX_DATA_MIME_TYPE = "application/rex+data";
export const REX_DATA_ELEMENT_ID = "rex-data";
export const REX_DATA_VERSION = 1;
export const SSR_ATTRIBUTE = "data-rex-ssr";
export const HYDRATION_MISMATCH_CODE = "REX310";
export const CLIENT_RENDER_DIGEST = "rex:client-render";

export interface RexDataPayload {
  readonly version: typeof REX_DATA_VERSION;
  readonly page: string | null;
  readonly actor: ActorInput;
  readonly queries: DehydratedState;
}

export class RexDataError extends RexError {
  constructor(message: string) {
    super("REX312", `rex data: ${message}`);
    this.name = "RexDataError";
  }
}

export function serializeRexData(payload: RexDataPayload): string {
  return escapeInlineJson(payload);
}

function stringList(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}

export function parseRexData(value: unknown): RexDataPayload {
  if (!isPlainObject(value)) throw new RexDataError("the payload must be a JSON object");
  if (value.version !== REX_DATA_VERSION) {
    throw new RexDataError(`version ${JSON.stringify(value.version)} is not ${REX_DATA_VERSION}`);
  }
  if (value.page !== null && typeof value.page !== "string") {
    throw new RexDataError("page must be a page id or null");
  }
  const subject = value.actor;
  if (
    !isPlainObject(subject) ||
    typeof subject.id !== "string" ||
    !stringList(subject.roles) ||
    !stringList(subject.permissions) ||
    (subject.attributes !== undefined && !isPlainObject(subject.attributes))
  ) {
    throw new RexDataError("actor must be an actor object");
  }
  const queries = value.queries;
  if (!isPlainObject(queries) || !Array.isArray(queries.queries) || !Array.isArray(queries.mutations)) {
    throw new RexDataError("queries must be a dehydrated TanStack Query state");
  }
  return value as unknown as RexDataPayload;
}

export function readRexData(root: ParentNode = globalThis.document): RexDataPayload | null {
  const elements = root.querySelectorAll(
    `script[type="${REX_DATA_MIME_TYPE}"]#${REX_DATA_ELEMENT_ID}`,
  );
  if (elements.length === 0) return null;
  if (elements.length > 1) {
    throw new RexDataError(`expected one ${REX_DATA_MIME_TYPE} script, found ${elements.length}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse((elements[0] as Element).textContent ?? "");
  } catch {
    throw new RexDataError(`the ${REX_DATA_MIME_TYPE} script is not JSON`);
  }
  return parseRexData(parsed);
}

export function isServerRendered(container: Element): boolean {
  return container.hasAttribute(SSR_ATTRIBUTE);
}

export function hydrateQueries(queryClient: QueryClient, payload: RexDataPayload): void {
  hydrate(queryClient, payload.queries);
  adoptServerLoaders(queryClient, payload.queries);
}

export interface HydrationMismatch {
  readonly code: typeof HYDRATION_MISMATCH_CODE;
  readonly message: string;
  readonly componentStack: string | null;
  readonly error: unknown;
}

export type HydrationReporter = (mismatch: HydrationMismatch) => void;

export function reportToConsole(mismatch: HydrationMismatch): void {
  console.error(
    `rex ${mismatch.code}: hydration mismatch: ${mismatch.message}${
      mismatch.componentStack === null ? "" : `\n${mismatch.componentStack}`
    }`,
  );
}

function digestOf(error: unknown): unknown {
  return typeof error === "object" && error !== null ? (error as { digest?: unknown }).digest : undefined;
}

export function isClientRenderHandoff(error: unknown): boolean {
  if (digestOf(error) === CLIENT_RENDER_DIGEST) return true;
  const cause = typeof error === "object" && error !== null ? (error as { cause?: unknown }).cause : undefined;
  return cause !== undefined && digestOf(cause) === CLIENT_RENDER_DIGEST;
}

export interface RecoverableErrorOptions {
  readonly dev: boolean;
  readonly report?: HydrationReporter;
}

export function recoverableErrorHandler(
  options: RecoverableErrorOptions,
): (error: unknown, info: ErrorInfo) => void {
  const report = options.report ?? reportToConsole;
  return (error, info) => {
    if (isClientRenderHandoff(error)) return;
    if (options.dev) {
      report({
        code: HYDRATION_MISMATCH_CODE,
        message: error instanceof Error ? error.message : String(error),
        componentStack: info.componentStack ?? null,
        error,
      });
      return;
    }
    if (typeof globalThis.reportError === "function") globalThis.reportError(error);
  };
}
