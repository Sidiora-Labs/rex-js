import type { ActionEffect, ActionForm } from "../core/action.ts";
import type { OverlayBinding, OverlayDismiss } from "../core/overlay.ts";
import type { PageCacheConfig, PageDraft, PageRender, PageTransition } from "../core/page.ts";
import type { Predicate, PredicateJson } from "../core/policy.ts";
import type { FieldKind, JsonSchema } from "../core/schema.ts";
import type { RexDataState } from "../core/states.ts";

export const MANIFEST_VERSION = 1;

export const REX_SCREENS = ["phone", "tablet", "desktop", "wide"] as const;
export type RexScreen = (typeof REX_SCREENS)[number];

export const REX_POINTERS = ["coarse", "fine"] as const;
export type RexPointer = (typeof REX_POINTERS)[number];

export const REX_SCREEN_DENSITIES = ["comfortable", "compact", "agent"] as const;
export type RexScreenDensity = (typeof REX_SCREEN_DENSITIES)[number];

export interface ManifestApp {
  readonly name: string;
}

export interface ManifestField {
  readonly name: string;
  readonly kind: FieldKind | null;
  readonly ref: string | null;
  readonly required: boolean;
}

export interface ManifestEntity {
  readonly id: string;
  readonly key: string;
  readonly fields: readonly ManifestField[];
  readonly schema: JsonSchema;
}

export interface ManifestAction {
  readonly id: string;
  readonly label: string | null;
  readonly shortcut: string | null;
  readonly effect: ActionEffect;
  readonly invalidates: readonly string[];
  readonly policy: PredicateJson;
  readonly form: ActionForm | null;
  readonly input: JsonSchema;
  readonly output: JsonSchema;
}

export interface ManifestOverlay {
  readonly id: string;
  readonly dismiss: OverlayDismiss;
  readonly binding: OverlayBinding;
}

export interface ManifestChrome {
  readonly header: boolean;
  readonly nav: boolean;
  readonly back: string | null;
  readonly title: string;
}

export interface ManifestLoader {
  readonly name: string;
  readonly action: string;
  readonly input: "params" | "mapped";
  readonly invalidatedBy: readonly string[];
}

export interface ManifestPage {
  readonly id: string;
  readonly route: string;
  readonly routeParams: readonly string[];
  readonly params: JsonSchema;
  readonly policy: PredicateJson;
  readonly recovery: string | null;
  readonly draft: PageDraft;
  readonly render: PageRender;
  readonly revalidate: number | null;
  readonly paths: boolean;
  readonly loaders: readonly ManifestLoader[];
  readonly cache: PageCacheConfig | null;
  readonly transition: PageTransition;
  readonly chrome: ManifestChrome;
  readonly regions: readonly string[];
  readonly overlays: readonly ManifestOverlay[];
  readonly states: readonly RexDataState[];
  readonly actions: readonly string[];
}

export interface ManifestPolicy {
  readonly id: string;
  readonly permissions: readonly string[];
}

export type ManifestFlowStep =
  | { readonly kind: "action"; readonly action: string }
  | {
      readonly kind: "approval";
      readonly id: string;
      readonly label: string;
      readonly approvers: PredicateJson;
    };

export interface ManifestFlow {
  readonly id: string;
  readonly steps: readonly ManifestFlowStep[];
}

export interface Manifest {
  readonly version: typeof MANIFEST_VERSION;
  readonly app: ManifestApp;
  readonly entities: readonly ManifestEntity[];
  readonly actions: readonly ManifestAction[];
  readonly pages: readonly ManifestPage[];
  readonly policies: readonly ManifestPolicy[];
  readonly flows: readonly ManifestFlow[];
}

export type FlowStepSource =
  | { readonly kind: "action"; readonly action: { readonly id: string } }
  | {
      readonly kind: "approval";
      readonly id: string;
      readonly label: string;
      readonly approvers: Predicate;
    };

export interface FlowSource {
  readonly id: string;
  readonly steps: readonly FlowStepSource[];
}
