import { ACTION_EFFECTS, type ActionEffect } from "../core/action.ts";
import { OVERLAY_DISMISS, type OverlayDismiss } from "../core/overlay.ts";
import { toJsonSchema, z, type JsonSchema } from "../core/schema.ts";
import { REX_DATA_STATES } from "../core/states.ts";

export const SIDECAR_MIME_TYPE = "application/rex+json";
export const SIDECAR_ELEMENT_ID = "rex-page";
export const SIDECAR_VERSION = 1;

export const INVOCATION_ROUTES = ["click", "key", "palette", "url"] as const;

export type InvocationRoute = (typeof INVOCATION_ROUTES)[number];

const uniqueList = <T extends z.ZodType>(item: T) =>
  z
    .array(item)
    .refine((items) => new Set(items).size === items.length, { message: "items must be unique" })
    .meta({ uniqueItems: true });

export const sidecarActionSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  allowed: z.boolean(),
  reason: z.string().min(1).nullable(),
  effect: z.enum(ACTION_EFFECTS as readonly [ActionEffect, ...ActionEffect[]]),
  input: z.record(z.string(), z.unknown()),
  via: uniqueList(z.enum(INVOCATION_ROUTES)),
});

export const sidecarOverlaySchema = z.strictObject({
  id: z.string().min(1),
  open: z.boolean(),
  dismiss: z.enum(OVERLAY_DISMISS as readonly [OverlayDismiss, ...OverlayDismiss[]]),
});

export const sidecarOutcomeSchema = z.strictObject({
  action: z.string().min(1),
  ok: z.boolean(),
  message: z.string(),
  at: z.iso.datetime(),
});

export const sidecarSchema = z
  .strictObject({
    version: z.literal(SIDECAR_VERSION),
    page: z.string().min(1),
    params: z.record(z.string(), z.unknown()),
    state: z.enum(REX_DATA_STATES),
    actions: z.array(sidecarActionSchema),
    overlays: z.array(sidecarOverlaySchema),
    outcome: sidecarOutcomeSchema.nullable(),
  })
  .superRefine((payload, ctx) => {
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
  });

export type SidecarAction = z.output<typeof sidecarActionSchema>;
export type SidecarOverlay = z.output<typeof sidecarOverlaySchema>;
export type SidecarOutcome = z.output<typeof sidecarOutcomeSchema>;
export type SidecarPayload = z.output<typeof sidecarSchema>;

export const sidecarJsonSchema: JsonSchema = Object.freeze({
  ...toJsonSchema(sidecarSchema),
  $id: "https://sidioralabs.com/rex/sidecar.schema.json",
  title: "Rex page sidecar",
});

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
