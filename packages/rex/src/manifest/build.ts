import type { AnyAction } from "../core/action.ts";
import type { AnyEntity } from "../core/entity.ts";
import { isValidName } from "../core/ids.ts";
import type { AnyPage } from "../core/page.ts";
import { predicateToJson, type AnyPolicy } from "../core/policy.ts";
import { compareIds } from "../core/registry.ts";
import { refTarget, type z } from "../core/schema.ts";
import {
  MANIFEST_VERSION,
  type FlowSource,
  type Manifest,
  type ManifestAction,
  type ManifestEntity,
  type ManifestFlow,
  type ManifestPage,
  type ManifestPolicy,
} from "./types.ts";

export interface ManifestSource {
  readonly entities: readonly AnyEntity[];
  readonly actions: readonly AnyAction[];
  readonly pages: readonly AnyPage[];
  readonly policies: readonly AnyPolicy[];
  readonly flows?: readonly FlowSource[];
}

export interface BuildManifestOptions {
  readonly app?: string;
}

export const DEFAULT_APP_NAME = "app";

function sortById<T extends { readonly id: string }>(items: readonly T[]): T[] {
  return [...items].sort(compareIds);
}

function sortedIds(items: readonly { readonly id: string }[]): string[] {
  return items.map((item) => item.id).sort();
}

function entityManifest(declared: AnyEntity): ManifestEntity {
  return {
    id: declared.id,
    key: declared.key,
    fields: Object.entries(declared.fields).map(([name, schema]) => ({
      name,
      kind: declared.fieldKinds[name] ?? null,
      ref: refTarget(schema as z.ZodType) ?? null,
      required: !(schema as z.ZodType).safeParse(undefined).success,
    })),
    schema: declared.jsonSchema,
  };
}

function actionManifest(declared: AnyAction): ManifestAction {
  return {
    id: declared.id,
    label: declared.label,
    shortcut: declared.shortcut,
    effect: declared.effect,
    invalidates: [...declared.invalidates].sort(),
    policy: predicateToJson(declared.policy),
    input: declared.inputJsonSchema,
    output: declared.outputJsonSchema,
  };
}

function pageManifest(declared: AnyPage): ManifestPage {
  return {
    id: declared.id,
    route: declared.route,
    routeParams: [...declared.routeParams],
    params: declared.paramsJsonSchema,
    policy: predicateToJson(declared.policy),
    recovery: declared.recovery,
    draft: declared.draft,
    chrome: { ...declared.chrome },
    regions: [...declared.regions],
    overlays: sortById(declared.overlays).map((overlay) => ({
      id: overlay.id,
      dismiss: overlay.dismiss,
      binding: overlay.binding,
    })),
    states: [...declared.states],
    actions: sortedIds(declared.actions),
  };
}

function policyManifest(declared: AnyPolicy): ManifestPolicy {
  return { id: declared.id, permissions: [...declared.permissions] };
}

function flowManifest(declared: FlowSource): ManifestFlow {
  return {
    id: declared.id,
    steps: declared.steps.map((step) =>
      step.kind === "action"
        ? { kind: "action", action: step.action.id }
        : {
            kind: "approval",
            id: step.id,
            label: step.label,
            approvers: predicateToJson(step.approvers),
          },
    ),
  };
}

export function buildManifest(
  source: ManifestSource,
  options: BuildManifestOptions = {},
): Manifest {
  const app = options.app ?? DEFAULT_APP_NAME;
  if (typeof app !== "string" || app.trim() === "") {
    throw new TypeError("buildManifest: app must be a non-empty string");
  }
  const pages = sortById(source.pages);
  const actionIds = new Set(source.actions.map((declared) => declared.id));
  const pageIds = new Set(pages.map((declared) => declared.id));
  for (const declared of pages) {
    for (const pageAction of declared.actions) {
      if (!actionIds.has(pageAction.id)) {
        throw new Error(
          `buildManifest: page "${declared.id}" declares action "${pageAction.id}" that is not registered`,
        );
      }
    }
    for (const [field, target] of [
      ["recovery", declared.recovery],
      ["chrome.back", declared.chrome.back],
    ] as const) {
      if (target !== null && (!isValidName(target) || !pageIds.has(target))) {
        throw new Error(
          `buildManifest: page "${declared.id}" ${field} names unknown page "${target}"`,
        );
      }
    }
  }
  return {
    version: MANIFEST_VERSION,
    app: { name: app },
    entities: sortById(source.entities).map(entityManifest),
    actions: sortById(source.actions).map(actionManifest),
    pages: pages.map(pageManifest),
    policies: sortById(source.policies).map(policyManifest),
    flows: sortById(source.flows ?? []).map(flowManifest),
  };
}

function canonical(value: unknown, path: string): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`stableStringify: ${path} is not finite`);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      item === undefined ? null : canonical(item, `${path}[${index}]`),
    );
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item === undefined) continue;
      result[key] = canonical(item, `${path}.${key}`);
    }
    return result;
  }
  throw new TypeError(`stableStringify: ${path} has unsupported type ${typeof value}`);
}

export function stableStringify(value: unknown, indent = 2): string {
  return JSON.stringify(canonical(value, "$"), null, indent);
}
