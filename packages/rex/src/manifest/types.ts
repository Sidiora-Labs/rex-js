import type { ActionCache, ActionEffect, ActionForm, ActionHttp } from "../core/action.ts";
import type { DeployHost, DeployTarget, I18nRouting, RedirectStatus } from "../core/config.ts";
import type { OverlayBinding, OverlayDismiss } from "../core/overlay.ts";
import type {
  IslandMode,
  PageCacheConfig,
  PageDraft,
  PageFallback,
  PagePrefetch,
  PageRender,
  PageTransition,
} from "../core/page.ts";
import type { Predicate, PredicateJson } from "../core/policy.ts";
import type { TextDirection } from "../core/protocol.ts";
import type { FieldKind, JsonSchema } from "../core/schema.ts";
import type { RexDataState } from "../core/states.ts";

export const MANIFEST_VERSION = 1;

export const REX_SCREENS = ["phone", "tablet", "desktop", "wide"] as const;
export type RexScreen = (typeof REX_SCREENS)[number];

export const REX_POINTERS = ["coarse", "fine"] as const;
export type RexPointer = (typeof REX_POINTERS)[number];

export const REX_SCREEN_DENSITIES = ["comfortable", "compact", "agent"] as const;
export type RexScreenDensity = (typeof REX_SCREEN_DENSITIES)[number];

export interface ManifestSite {
  readonly origin: string | null;
  readonly name: string | null;
  readonly description: string | null;
  readonly image: string | null;
  readonly titleTemplate: string | null;
}

export interface ManifestApp {
  readonly name: string;
  readonly site?: ManifestSite;
}

export interface ManifestRedirect {
  readonly source: string;
  readonly destination: string;
  readonly status: RedirectStatus;
}

export interface ManifestDeploy {
  readonly host: DeployHost;
  readonly target: DeployTarget;
}

export interface ManifestI18n {
  readonly locales: readonly string[];
  readonly default: string;
  readonly routing: I18nRouting;
  readonly direction: Readonly<Record<string, TextDirection>>;
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
  readonly http: ActionHttp | null;
  readonly cache: ActionCache | null;
  readonly optimistic: readonly string[];
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
  readonly description: string | null;
  readonly image: string | null;
  readonly frame: string | null;
  readonly order: number | null;
  readonly icon: string | null;
}

export interface ManifestRestParam {
  readonly name: string;
  readonly optional: boolean;
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
  readonly restParam: ManifestRestParam | null;
  readonly params: JsonSchema;
  readonly policy: PredicateJson;
  readonly recovery: string | null;
  readonly draft: PageDraft;
  readonly render: PageRender;
  readonly revalidate: number | null;
  readonly paths: boolean;
  readonly pathsAction: string | null;
  readonly fallback: PageFallback | null;
  readonly loaders: readonly ManifestLoader[];
  readonly cache: PageCacheConfig | null;
  readonly transition: PageTransition;
  readonly prefetch: PagePrefetch | null;
  readonly islands: Readonly<Record<string, IslandMode>>;
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
  readonly redirects: readonly ManifestRedirect[];
  readonly deploy: ManifestDeploy | null;
  readonly i18n: ManifestI18n | null;
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
