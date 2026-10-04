import { REX_ERRORS_DOCS_BASE } from "../../core/errors.ts";

export const RUNTIME_MISSING_CODE = "REX450";

export type AdapterRuntime = "Bun" | "Deno";

export interface FetchApp {
  fetch(request: Request, env?: unknown): Response | Promise<Response>;
}

export class RuntimeMissingError extends Error {
  readonly code: typeof RUNTIME_MISSING_CODE = RUNTIME_MISSING_CODE;
  readonly runtime: AdapterRuntime;
  readonly hint: string;
  readonly docs: string = `${REX_ERRORS_DOCS_BASE}/${RUNTIME_MISSING_CODE}`;

  constructor(runtime: AdapterRuntime, entry: string) {
    super(
      `${RUNTIME_MISSING_CODE} ${entry}: the ${runtime} runtime global is absent, so there is no ${runtime}.serve to hand the fetch handler to`,
    );
    this.name = "RuntimeMissingError";
    this.runtime = runtime;
    this.hint = `Run this server entry with ${runtime.toLowerCase()}, or use startNodeServer from rex/server/node or createEdgeHandler from rex/server/edge on other runtimes.`;
  }
}

export function assertPort(entry: string, port: number): void {
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new RangeError(`${entry}: port must be an integer from 0 to 65535`);
  }
}

export function serverUrl(hostname: string, port: number): string {
  const urlHost = hostname.includes(":") ? `[${hostname}]` : hostname;
  return `http://${urlHost}:${port}`;
}
