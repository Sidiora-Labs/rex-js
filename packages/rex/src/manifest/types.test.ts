import { describe, expect, expectTypeOf, it } from "vitest";
import type { ActionEffect, ActionForm } from "../core/action.ts";
import type { OverlayBinding, OverlayDismiss } from "../core/overlay.ts";
import type { PageDraft, PageRender, PageTransition } from "../core/page.ts";
import type { Predicate, PredicateJson } from "../core/policy.ts";
import type { RexDataState } from "../core/states.ts";
import { buildManifest } from "./build.ts";
import { sidecarJsonSchema } from "./sidecar.schema.ts";
import {
  MANIFEST_VERSION,
  REX_POINTERS,
  REX_SCREENS,
  REX_SCREEN_DENSITIES,
  type FlowStepSource,
  type Manifest,
  type ManifestAction,
  type ManifestFlowStep,
  type ManifestOverlay,
  type ManifestPage,
  type RexPointer,
  type RexScreen,
  type RexScreenDensity,
} from "./types.ts";

describe("manifest types", () => {
  it("names the manifest version and the screen vocabularies", () => {
    expect(MANIFEST_VERSION).toBe(1);
    expect([...REX_SCREENS]).toEqual(["phone", "tablet", "desktop", "wide"]);
    expect([...REX_POINTERS]).toEqual(["coarse", "fine"]);
    expect([...REX_SCREEN_DENSITIES]).toEqual(["comfortable", "compact", "agent"]);
    for (const list of [REX_SCREENS, REX_POINTERS, REX_SCREEN_DENSITIES]) {
      expect(new Set(list).size).toBe(list.length);
    }
    expectTypeOf<RexScreen>().toEqualTypeOf<"phone" | "tablet" | "desktop" | "wide">();
    expectTypeOf<RexPointer>().toEqualTypeOf<"coarse" | "fine">();
    expectTypeOf<RexScreenDensity>().toEqualTypeOf<"comfortable" | "compact" | "agent">();
  });

  it("drives the screen fields of the sidecar schema", () => {
    const properties = sidecarJsonSchema.properties as Record<string, Record<string, unknown>>;
    expect(properties.screen?.enum).toEqual([...REX_SCREENS]);
    expect(properties.pointer?.enum).toEqual([...REX_POINTERS]);
    expect(properties.density?.enum).toEqual([...REX_SCREEN_DENSITIES]);
  });

  it("is the shape every built manifest satisfies", () => {
    const manifest: Manifest = buildManifest({
      entities: [],
      actions: [],
      pages: [],
      policies: [],
    });
    expect(manifest.version).toBe(MANIFEST_VERSION);
    expect(Object.keys(manifest).sort()).toEqual([
      "actions",
      "app",
      "entities",
      "flows",
      "pages",
      "policies",
      "version",
    ]);
    expectTypeOf(manifest.version).toEqualTypeOf<1>();
    expectTypeOf(buildManifest).returns.toEqualTypeOf<Manifest>();
  });

  it("ties its fields to the core declaration vocabularies", () => {
    expectTypeOf<ManifestAction["effect"]>().toEqualTypeOf<ActionEffect>();
    expectTypeOf<ManifestAction["form"]>().toEqualTypeOf<ActionForm | null>();
    expectTypeOf<ManifestAction["policy"]>().toEqualTypeOf<PredicateJson>();
    expectTypeOf<ManifestOverlay["dismiss"]>().toEqualTypeOf<OverlayDismiss>();
    expectTypeOf<ManifestOverlay["binding"]>().toEqualTypeOf<OverlayBinding>();
    expectTypeOf<ManifestPage["states"][number]>().toEqualTypeOf<RexDataState>();
    expectTypeOf<ManifestPage["draft"]>().toEqualTypeOf<PageDraft>();
    expectTypeOf<ManifestPage["render"]>().toEqualTypeOf<PageRender>();
    expectTypeOf<ManifestPage["transition"]>().toEqualTypeOf<PageTransition>();
    expectTypeOf<ManifestPage["loaders"][number]["input"]>().toEqualTypeOf<"params" | "mapped">();
    expectTypeOf<
      Extract<ManifestFlowStep, { kind: "approval" }>["approvers"]
    >().toEqualTypeOf<PredicateJson>();
    expectTypeOf<
      Extract<FlowStepSource, { kind: "approval" }>["approvers"]
    >().toEqualTypeOf<Predicate>();
    expectTypeOf<Extract<FlowStepSource, { kind: "action" }>["action"]>().toEqualTypeOf<{
      readonly id: string;
    }>();
  });
});
