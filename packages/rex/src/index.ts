export const REX_VERSION = "0.1.0";

export * from "./core/errors.ts";
export * from "./core/serialize.ts";
export * from "./core/deprecated.ts";
export * from "./core/ids.ts";
export * from "./core/entity.ts";
export * from "./core/store.ts";
export * from "./core/store.memory.ts";
export * from "./core/actor.ts";
export * from "./core/policy.ts";
export * from "./core/action.ts";
export * from "./core/states.ts";
export * from "./core/overlay.ts";
export * from "./core/page.ts";
export * from "./core/registry.ts";
export * from "./core/journal.ts";
export * from "./core/flow.ts";
export * from "./core/protocol.ts";
export * from "./manifest/types.ts";
export {
  isStandardSchema,
  validateStandard,
  validateStandardSync,
  type StandardInferInput,
  type StandardInferOutput,
  type StandardSchemaV1,
} from "./core/standard.ts";
