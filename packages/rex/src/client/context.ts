import type { Client } from "@orpc/client";
import { createContext, useContext } from "react";
import type { Actor } from "../core/actor.ts";
import type { RegistrySnapshot } from "../core/registry.ts";
import type { Manifest } from "../manifest/types.ts";

export const REX_RPC_PATH = "/rex/rpc";
export const REX_MANIFEST_PATH = "/rex/manifest";
export const ACTOR_HEADER = "x-rex-actor";
export const DENSITY_HEADER = "x-rex-density";
export const CONFIRM_HEADER = "x-rex-confirm";
export const CONFIRM_PROCEDURE = "$confirm";

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
