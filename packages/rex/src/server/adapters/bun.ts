import { RuntimeMissingError, assertPort, serverUrl, type FetchApp } from "./runtime.ts";

export {
  RUNTIME_MISSING_CODE,
  RuntimeMissingError,
  type AdapterRuntime,
  type FetchApp,
} from "./runtime.ts";

export interface BunServer {
  readonly port: number;
  readonly hostname: string;
  readonly url: URL;
  stop(closeActiveConnections?: boolean): void | Promise<void>;
}

export type BunFetchHandler = (request: Request, server: BunServer) => Response | Promise<Response>;

export interface BunServeOptions {
  readonly fetch: BunFetchHandler;
  readonly port: number;
  readonly hostname?: string;
}

export interface BunRuntime {
  serve(options: BunServeOptions): BunServer;
}

export interface BunServerOptions {
  readonly port: number;
  readonly hostname?: string;
}

export interface RunningBunServer {
  readonly server: BunServer;
  readonly port: number;
  readonly url: string;
  close(): Promise<void>;
}

export function bunRuntime(): BunRuntime | null {
  const candidate = (globalThis as { readonly Bun?: Partial<BunRuntime> }).Bun;
  return candidate !== undefined && candidate !== null && typeof candidate.serve === "function"
    ? (candidate as BunRuntime)
    : null;
}

export function startBunServer(app: FetchApp, options: BunServerOptions): Promise<RunningBunServer> {
  const runtime = bunRuntime();
  if (runtime === null) throw new RuntimeMissingError("Bun", "startBunServer");
  const { port, hostname } = options;
  assertPort("startBunServer", port);
  const fetch: BunFetchHandler = (request, server) => app.fetch(request, server);
  return new Promise((resolvePromise) => {
    const server = runtime.serve(
      hostname === undefined ? { fetch, port } : { fetch, port, hostname },
    );
    resolvePromise({
      server,
      port: server.port,
      url: serverUrl(hostname ?? "localhost", server.port),
      close: async () => {
        await server.stop(true);
      },
    });
  });
}
