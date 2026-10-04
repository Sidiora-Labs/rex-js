import { ACTION_EFFECTS, type ActionEffect } from "../core/action.ts";
import { OVERLAY_DISMISS, type OverlayDismiss } from "../core/overlay.ts";
import { FRAME_NAME, ISLAND_MODES } from "../core/page.ts";
import {
  INVOCATION_ROUTES,
  SIDECAR_ELEMENT_ID,
  SIDECAR_MIME_TYPE,
  SIDECAR_VERSION,
  TEXT_DIRECTIONS,
  type InvocationRoute,
} from "../core/protocol.ts";
import * as zm from "zod/mini";
import type { JsonSchema } from "../core/schema.ts";
import { REX_DATA_STATES } from "../core/states.ts";
import { toJsonSchema } from "./json-schema.ts";
import { REX_POINTERS, REX_SCREENS, REX_SCREEN_DENSITIES } from "./types.ts";

export { INVOCATION_ROUTES, SIDECAR_ELEMENT_ID, SIDECAR_MIME_TYPE, SIDECAR_VERSION };
export type { InvocationRoute };

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

export const sidecarRegionSchema = zm
  .strictObject({
    id: nonEmpty(),
    address: nonEmpty(),
    state: zm.enum(REX_DATA_STATES),
    code: zm.optional(zm.string().check(zm.regex(SIDECAR_ERROR_CODE_PATTERN))),
    island: zm.optional(zm.enum(ISLAND_MODES)),
    optimistic: zm.optional(zm.literal(true)),
  })
  .check(
    zm.superRefine((region, ctx) => {
      if (region.state === "recoverable-error" && region.code === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["code"],
          message: "a failed region states its error code",
        });
      }
    }),
  );

export const sidecarStoresSchema = zm.record(nonEmpty(), zm.unknown());

export const sidecarLoaderSchema = zm.strictObject({
  name: nonEmpty(),
  action: nonEmpty(),
  invalidatedBy: uniqueList(nonEmpty()),
  defer: zm.optional(zm.boolean()),
});

export const sidecarDocumentSchema = zm.strictObject({
  title: nonEmpty(),
  description: zm.nullable(nonEmpty()),
  canonical: zm.nullable(zm.url()),
});

export const SIDECAR_SCREEN_FIELDS = ["screen", "pointer", "density"] as const;

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
    loaders: zm.optional(zm.array(sidecarLoaderSchema)),
    document: zm.optional(sidecarDocumentSchema),
    locale: zm.optional(nonEmpty()),
    locales: zm.optional(uniqueList(nonEmpty()).check(zm.minLength(1))),
    direction: zm.optional(zm.enum(TEXT_DIRECTIONS)),
    frame: zm.optional(zm.string().check(zm.regex(FRAME_NAME))),
    screen: zm.optional(zm.enum(REX_SCREENS)),
    pointer: zm.optional(zm.enum(REX_POINTERS)),
    density: zm.optional(zm.enum(REX_SCREEN_DENSITIES)),
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
      const loaderNames = new Set<string>();
      (payload.loaders ?? []).forEach((loader, index) => {
        if (loaderNames.has(loader.name)) {
          ctx.addIssue({
            code: "custom",
            path: ["loaders", index, "name"],
            message: `duplicate loader "${loader.name}"`,
          });
        }
        loaderNames.add(loader.name);
      });
      if (payload.locales !== undefined && payload.locale === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["locale"],
          message: "locales comes with the active locale",
        });
      }
      if (
        payload.locale !== undefined &&
        payload.locales !== undefined &&
        !payload.locales.includes(payload.locale)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["locale"],
          message: `locale "${payload.locale}" is not one of locales`,
        });
      }
      const fit = SIDECAR_SCREEN_FIELDS.filter((field) => payload[field] !== undefined);
      if (fit.length > 0) {
        for (const field of SIDECAR_SCREEN_FIELDS) {
          if (payload[field] !== undefined) continue;
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: "screen, pointer and density appear together",
          });
        }
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
export type SidecarLoader = zm.output<typeof sidecarLoaderSchema>;
export type SidecarDocument = zm.output<typeof sidecarDocumentSchema>;
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
