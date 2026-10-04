import { createORPCClient, type ClientLink } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { actor as createActor, anonymousActor, type Actor, type ActorInput } from "../core/actor.ts";
import { isPlainObject } from "../core/entity.ts";
import type { RegistrySnapshot } from "../core/registry.ts";
import { MANIFEST_VERSION, type Manifest } from "../manifest/types.ts";
import {
  ACTOR_HEADER,
  CONFIRM_HEADER,
  DENSITY_HEADER,
  REX_MANIFEST_PATH,
  REX_RPC_PATH,
  RexRuntimeContext,
  type RexClient,
  type RexClientContext,
  type RexRuntime,
} from "./context.ts";

export type RexFetch = (input: Request | string | URL, init?: RequestInit) => Promise<Response>;

export interface DensitySlotProps {
  readonly children: ReactNode;
}

export interface CreateRexAppOptions {
  readonly registry: RegistrySnapshot;
  readonly manifest?: Manifest;
  readonly link?: ClientLink<RexClientContext>;
  readonly actor?: Actor;
  readonly baseUrl?: string;
  readonly fetch?: RexFetch;
  readonly queryClient?: QueryClient;
  readonly density?: ComponentType<DensitySlotProps>;
}

export interface RexAppProps {
  readonly children?: ReactNode;
}

export type RexAppComponent = ComponentType<RexAppProps>;

interface StartupValue {
  readonly manifest: Manifest;
  readonly actor: Actor;
  readonly density: string | null;
}

type Startup =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly value: StartupValue }
  | { readonly status: "error"; readonly message: string };

export class RexStartupError extends Error {
  constructor(message: string) {
    super(`rex startup: ${message}`);
    this.name = "RexStartupError";
  }
}

export function encodeActorHeader(subject: ActorInput): string {
  return encodeURIComponent(JSON.stringify(subject));
}

export function decodeActorHeader(value: string): Actor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(value));
  } catch {
    throw new RexStartupError(`the ${ACTOR_HEADER} header is not URI-encoded JSON`);
  }
  if (!isPlainObject(parsed)) {
    throw new RexStartupError(`the ${ACTOR_HEADER} header must encode an actor object`);
  }
  try {
    return createActor(parsed as unknown as ActorInput);
  } catch (error) {
    throw new RexStartupError(`the ${ACTOR_HEADER} header: ${(error as Error).message}`);
  }
}

export function parseManifest(value: unknown): Manifest {
  if (!isPlainObject(value)) throw new RexStartupError("the manifest must be a JSON object");
  if (value.version !== MANIFEST_VERSION) {
    throw new RexStartupError(
      `manifest version ${JSON.stringify(value.version)} is not ${MANIFEST_VERSION}`,
    );
  }
  if (!isPlainObject(value.app) || typeof value.app.name !== "string") {
    throw new RexStartupError("the manifest has no app name");
  }
  for (const list of ["entities", "actions", "pages", "policies", "flows"] as const) {
    if (!Array.isArray(value[list])) {
      throw new RexStartupError(`the manifest field "${list}" must be an array`);
    }
  }
  return value as unknown as Manifest;
}

function sameIds(
  kind: string,
  declared: readonly { readonly id: string }[],
  listed: readonly { readonly id: string }[],
): void {
  const declaredIds = declared.map((item) => item.id).sort();
  const listedIds = listed.map((item) => item.id).sort();
  const missing = declaredIds.filter((id) => !listedIds.includes(id));
  const extra = listedIds.filter((id) => !declaredIds.includes(id));
  if (missing.length > 0 || extra.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`missing from the manifest: ${missing.join(", ")}`);
    if (extra.length > 0) parts.push(`not in the registry: ${extra.join(", ")}`);
    throw new RexStartupError(`manifest and registry disagree on ${kind} (${parts.join("; ")})`);
  }
}

export function checkManifest(manifest: Manifest, registry: RegistrySnapshot): Manifest {
  sameIds("pages", registry.pages, manifest.pages);
  sameIds("actions", registry.actions, manifest.actions);
  return manifest;
}

function resolveBase(baseUrl: string | undefined): string {
  const base = baseUrl ?? globalThis.location?.origin;
  if (typeof base !== "string" || !/^https?:\/\//.test(base)) {
    throw new RexStartupError("baseUrl must be an http(s) origin when the page has no location");
  }
  return base;
}

function headersFor(context: RexClientContext): Record<string, string> {
  return context.confirmToken === undefined ? {} : { [CONFIRM_HEADER]: context.confirmToken };
}

export function createRexLink(base: string, fetchImpl?: RexFetch): ClientLink<RexClientContext> {
  const url = new URL(REX_RPC_PATH, base).toString();
  if (fetchImpl === undefined) {
    return new RPCLink<RexClientContext>({ url, headers: ({ context }) => headersFor(context) });
  }
  return new RPCLink<RexClientContext>({
    url,
    headers: ({ context }) => headersFor(context),
    fetch: (request, init) => fetchImpl(request, init),
  });
}

async function loadStartup(
  options: CreateRexAppOptions,
  base: string,
  signal: AbortSignal,
): Promise<StartupValue> {
  const fetchImpl: RexFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const response = await fetchImpl(new URL(REX_MANIFEST_PATH, base).toString(), {
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new RexStartupError(`GET ${REX_MANIFEST_PATH} answered ${response.status}`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new RexStartupError(`GET ${REX_MANIFEST_PATH} did not return JSON`);
  }
  const manifest = checkManifest(options.manifest ?? parseManifest(body), options.registry);
  const actorHeader = response.headers.get(ACTOR_HEADER);
  const actor =
    options.actor ?? (actorHeader === null ? anonymousActor : decodeActorHeader(actorHeader));
  return { manifest, actor, density: response.headers.get(DENSITY_HEADER) };
}

function PassthroughDensity({ children }: DensitySlotProps) {
  return <Fragment>{children}</Fragment>;
}

export function createRexApp(options: CreateRexAppOptions): RexAppComponent {
  if (typeof options !== "object" || options === null || options.registry === undefined) {
    throw new TypeError("createRexApp: a frozen registry is required");
  }
  const registry = options.registry;
  const base = resolveBase(options.baseUrl);
  const link = options.link ?? createRexLink(base, options.fetch);
  const client = createORPCClient<RexClient>(link);
  const queryClient = options.queryClient ?? new QueryClient();
  const Density = options.density ?? PassthroughDensity;
  const provided: StartupValue | null =
    options.manifest !== undefined && options.actor !== undefined
      ? { manifest: checkManifest(options.manifest, registry), actor: options.actor, density: null }
      : null;

  function RexApp({ children }: RexAppProps) {
    const [startup, setStartup] = useState<Startup>(
      provided === null ? { status: "loading" } : { status: "ready", value: provided },
    );
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
      if (provided !== null) return;
      const controller = new AbortController();
      setStartup({ status: "loading" });
      loadStartup(options, base, controller.signal).then(
        (value) => {
          if (!controller.signal.aborted) setStartup({ status: "ready", value });
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          setStartup({
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        },
      );
      return () => controller.abort();
    }, [attempt]);

    const runtime = useMemo<RexRuntime | null>(
      () =>
        startup.status === "ready"
          ? {
              registry,
              manifest: startup.value.manifest,
              actor: startup.value.actor,
              client,
              density: startup.value.density,
            }
          : null,
      [startup],
    );

    let body: ReactNode;
    if (startup.status === "loading") {
      body = (
        <p role="status" data-rex-app-state="loading">
          Loading app
        </p>
      );
    } else if (startup.status === "error") {
      body = (
        <div role="alert" data-rex-app-state="error">
          <p>{startup.message}</p>
          <button type="button" onClick={() => setAttempt((count) => count + 1)}>
            Retry
          </button>
        </div>
      );
    } else {
      body = (
        <RexRuntimeContext.Provider value={runtime}>
          <Density>{children}</Density>
        </RexRuntimeContext.Provider>
      );
    }
    return <QueryClientProvider client={queryClient}>{body}</QueryClientProvider>;
  }
  RexApp.displayName = "RexApp";
  return RexApp;
}

export {
  createRexEntry,
  type RexEntryBundle,
  type RexEntryOptions,
} from "./entry.tsx";
