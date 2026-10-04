import { RuntimeMissingError, assertPort, serverUrl, type FetchApp } from "./runtime.ts";

export {
  RUNTIME_MISSING_CODE,
  RuntimeMissingError,
  type AdapterRuntime,
  type FetchApp,
} from "./runtime.ts";

export interface DenoNetAddr {
  readonly transport: "tcp" | "udp";
  readonly hostname: string;
  readonly port: number;
}

export interface DenoServeHandlerInfo {
  readonly remoteAddr: DenoNetAddr;
}

export type DenoServeHandler = (
  request: Request,
  info: DenoServeHandlerInfo,
) => Response | Promise<Response>;

export interface DenoServeOptions {
  readonly port: number;
  readonly hostname?: string;
  readonly onListen?: (localAddr: DenoNetAddr) => void;
}

export interface DenoHttpServer {
  readonly addr: DenoNetAddr;
  readonly finished: Promise<void>;
  shutdown(): Promise<void>;
}

export interface DenoRuntime {
  serve(options: DenoServeOptions, handler: DenoServeHandler): DenoHttpServer;
}

export interface DenoServerOptions {
  readonly port: number;
  readonly hostname?: string;
}

export interface RunningDenoServer {
  readonly server: DenoHttpServer;
  readonly port: number;
  readonly url: string;
  close(): Promise<void>;
}

export function denoRuntime(): DenoRuntime | null {
  const candidate = (globalThis as { readonly Deno?: Partial<DenoRuntime> }).Deno;
  return candidate !== undefined && candidate !== null && typeof candidate.serve === "function"
    ? (candidate as DenoRuntime)
    : null;
}

export function startDenoServer(
  app: FetchApp,
  options: DenoServerOptions,
): Promise<RunningDenoServer> {
  const runtime = denoRuntime();
  if (runtime === null) throw new RuntimeMissingError("Deno", "startDenoServer");
  const { port, hostname } = options;
  assertPort("startDenoServer", port);
  const handler: DenoServeHandler = (request, info) => app.fetch(request, info);
  return new Promise((resolvePromise) => {
    let listening: DenoNetAddr | undefined;
    let server: DenoHttpServer | undefined;
    const settle = (): void => {
      if (server === undefined || listening === undefined) return;
      const running = server;
      resolvePromise({
        server: running,
        port: listening.port,
        url: serverUrl(hostname ?? "localhost", listening.port),
        close: () => running.shutdown(),
      });
    };
    const onListen = (localAddr: DenoNetAddr): void => {
      listening = localAddr;
      settle();
    };
    server = runtime.serve(
      hostname === undefined ? { port, onListen } : { port, hostname, onListen },
      handler,
    );
    settle();
  });
}
