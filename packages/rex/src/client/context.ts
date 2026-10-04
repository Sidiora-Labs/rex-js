import type { Client } from "@orpc/client";
import { createContext, useContext } from "react";
import type { Actor } from "../core/actor.ts";
import {
  CONFIRM_PROCEDURE,
  REX_ACTOR_HEADER,
  REX_CONFIRM_HEADER,
  REX_DENSITY_HEADER,
  REX_MANIFEST_PATH,
  REX_RPC_PREFIX,
} from "../core/protocol.ts";
import type { RegistrySnapshot } from "../core/registry.ts";
import type { Manifest } from "../manifest/types.ts";

export { CONFIRM_PROCEDURE, REX_MANIFEST_PATH };

export const REX_RPC_PATH = REX_RPC_PREFIX;
export const ACTOR_HEADER = REX_ACTOR_HEADER;
export const DENSITY_HEADER = REX_DENSITY_HEADER;
export const CONFIRM_HEADER = REX_CONFIRM_HEADER;

export interface RexClientContext {
  readonly confirmToken?: string;
}

export type RexProcedureClient = Client<RexClientContext, unknown, unknown, Error>;

export type RexClient = { readonly [procedure: string]: RexProcedureClient };

export function procedureOf(client: RexClient, id: string): RexProcedureClient {
  const procedure = client[id];
  if (typeof procedure !== "function") {
    throw new Error(`rex: the oRPC client has no procedure "${id}"`);
  }
  return procedure;
}

export interface ConfirmRequest {
  readonly action: string;
  readonly input: unknown;
}

export interface ConfirmGrant {
  readonly token: string;
  readonly expiresAt: string;
}

export interface RexRuntime {
  readonly registry: RegistrySnapshot;
  readonly manifest: Manifest;
  readonly actor: Actor;
  readonly client: RexClient;
  readonly density: string | null;
}

export const RexRuntimeContext = createContext<RexRuntime | null>(null);
RexRuntimeContext.displayName = "RexRuntime";

export function useRexRuntime(): RexRuntime {
  const runtime = useContext(RexRuntimeContext);
  if (runtime === null) {
    throw new Error("rex: this hook must be called inside the RexApp returned by createRexApp()");
  }
  return runtime;
}

export function useManifest(): Manifest {
  return useRexRuntime().manifest;
}

export function useActor(): Actor {
  return useRexRuntime().actor;
}

export function useRexClient(): RexClient {
  return useRexRuntime().client;
}

export function useRegistry(): RegistrySnapshot {
  return useRexRuntime().registry;
}
