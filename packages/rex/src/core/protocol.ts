export const CONFIRM_PROCEDURE = "_confirm";

export const REX_CONFIRM_HEADER = "x-rex-confirm";
export const REX_ACTOR_HEADER = "x-rex-actor";
export const REX_DENSITY_HEADER = "x-rex-density";

export const REX_RPC_PREFIX = "/rex/rpc";
export const REX_MANIFEST_PATH = "/rex/manifest";

export const RESERVED_QUERY_KEYS = ["act", "input", "draft", "density"] as const;

export type ReservedQueryKey = (typeof RESERVED_QUERY_KEYS)[number];

export function isReservedQueryKey(key: string): key is ReservedQueryKey {
  return (RESERVED_QUERY_KEYS as readonly string[]).includes(key);
}
