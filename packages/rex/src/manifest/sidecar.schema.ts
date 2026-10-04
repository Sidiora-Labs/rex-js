import { ACTION_EFFECTS, type ActionEffect } from "../core/action.ts";
import { OVERLAY_DISMISS, type OverlayDismiss } from "../core/overlay.ts";
import * as zm from "zod/mini";
import { toJsonSchema, type JsonSchema } from "../core/schema.ts";
import { REX_DATA_STATES } from "../core/states.ts";

export const SIDECAR_MIME_TYPE = "application/rex+json";
export const SIDECAR_ELEMENT_ID = "rex-page";
export const SIDECAR_VERSION = 1;

export const INVOCATION_ROUTES = ["click", "key", "palette", "url"] as const;

export type InvocationRoute = (typeof INVOCATION_ROUTES)[number];

const nonEmpty = () => zm.string().check(zm.minLength(1));

const uniqueList = <T extends zm.ZodMiniType>(item: T) =>
  zm
    .array(item)
    .check(
      zm.refine((items) => new Set(items).size === items.length, {
        message: "items must be unique",
      }),
    )
    .register(zm.globalRegistry, { uniqueItems: true });

export const sidecarActionSchema = zm.strictObject({
  id: nonEmpty(),
  label: nonEmpty(),
  allowed: zm.boolean(),
  reason: zm.nullable(nonEmpty()),
  effect: zm.enum(ACTION_EFFECTS as readonly [ActionEffect, ...ActionEffect[]]),
  input: zm.record(zm.string(), zm.unknown()),
  via: uniqueList(zm.enum(INVOCATION_ROUTES)),
});

export const sidecarOverlaySchema = zm.strictObject({
  id: nonEmpty(),
  open: zm.boolean(),
  dismiss: zm.enum(OVERLAY_DISMISS as readonly [OverlayDismiss, ...OverlayDismiss[]]),
});

export const sidecarOutcomeSchema = zm.strictObject({
  action: nonEmpty(),
  ok: zm.boolean(),
  message: zm.string(),
  at: zm.iso.datetime(),
});

export const SIDECAR_ERROR_CODE_PATTERN = /^REX[0-9]{3}$/;

export const sidecarRegionSchema = zm.strictObject({
  id: nonEmpty(),
  address: nonEmpty(),
  state: zm.enum(REX_DATA_STATES),
  code: zm.string().check(zm.regex(SIDECAR_ERROR_CODE_PATTERN)),
});

export const sidecarStoresSchema = zm.record(nonEmpty(), zm.unknown());

export const sidecarSchema = zm
  .strictObject({
    version: zm.literal(SIDECAR_VERSION),
    page: nonEmpty(),
    params: zm.record(zm.string(), zm.unknown()),
    state: zm.enum(REX_DATA_STATES),
    actions: zm.array(sidecarActionSchema),
    overlays: zm.array(sidecarOverlaySchema),
    outcome: zm.nullable(sidecarOutcomeSchema),
    regions: zm.optional(zm.array(sidecarRegionSchema).check(zm.minLength(1))),
    stores: zm.optional(sidecarStoresSchema),
  })
  .check(
    zm.superRefine((payload, ctx) => {
      payload.actions.forEach((entry, index) => {
        if (entry.allowed && entry.reason !== null) {
          ctx.addIssue({
            code: "custom",
            path: ["actions", index, "reason"],
            message: "an allowed action has no reason",
          });
        }
        if (!entry.allowed && entry.reason === null) {
          ctx.addIssue({
            code: "custom",
            path: ["actions", index, "reason"],
            message: "a disallowed action states its policy reason",
          });
        }
      });
      for (const [field, items] of [
        ["actions", payload.actions],
        ["overlays", payload.overlays],
        ["regions", payload.regions ?? []],
      ] as const) {
        const seen = new Set<string>();
        items.forEach((item, index) => {
          if (seen.has(item.id)) {
            ctx.addIssue({
              code: "custom",
              path: [field, index, "id"],
              message: `duplicate id "${item.id}"`,
            });
          }
          seen.add(item.id);
        });
      }
      if (payload.stores !== undefined && Object.keys(payload.stores).length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["stores"],
          message: "stores is omitted when no store is exposed",
        });
      }
    }),
  );

export type SidecarAction = zm.output<typeof sidecarActionSchema>;
export type SidecarOverlay = zm.output<typeof sidecarOverlaySchema>;
export type SidecarOutcome = zm.output<typeof sidecarOutcomeSchema>;
export type SidecarRegion = zm.output<typeof sidecarRegionSchema>;
export type SidecarStores = zm.output<typeof sidecarStoresSchema>;
export type SidecarPayload = zm.output<typeof sidecarSchema>;

let builtSidecarJsonSchema: JsonSchema | null = null;

function buildSidecarJsonSchema(): JsonSchema {
  builtSidecarJsonSchema ??= Object.freeze({
    ...toJsonSchema(sidecarSchema),
    $id: "https://sidioralabs.com/rex/sidecar.schema.json",
    title: "Rex page sidecar",
  });
  return builtSidecarJsonSchema;
}

export const sidecarJsonSchema: JsonSchema = /* @__PURE__ */ new Proxy<JsonSchema>(
  {},
  {
    get: (_target, key) => Reflect.get(buildSidecarJsonSchema(), key),
    has: (_target, key) => Reflect.has(buildSidecarJsonSchema(), key),
    ownKeys: () => Reflect.ownKeys(buildSidecarJsonSchema()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(buildSidecarJsonSchema(), key);
      return descriptor === undefined ? undefined : { ...descriptor, configurable: true };
    },
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
  },
);

export interface SidecarIssue {
  readonly path: string;
  readonly message: string;
}

export type SidecarValidation =
  | { readonly valid: true; readonly payload: SidecarPayload }
  | { readonly valid: false; readonly issues: readonly SidecarIssue[] };

export function validateSidecar(payload: unknown): SidecarValidation {
  const result = sidecarSchema.safeParse(payload);
  if (result.success) return { valid: true, payload: result.data };
  return {
    valid: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
    })),
  };
}
