import type { AnyAction } from "../core/action.ts";
import type { AnyEntity } from "../core/entity.ts";
import { RexError } from "../core/errors.ts";
import { isValidName } from "../core/ids.ts";
import {
  CHROME_COMPONENT_NAMES,
  type AnyPage,
  type ChromeComponentName,
  type PageRender,
} from "../core/page.ts";
import { predicateToJson, type AnyPolicy } from "../core/policy.ts";
import { compareIds } from "../core/registry.ts";
import {
  objectJsonSchema,
  refTarget,
  toJsonSchema,
  type JsonSchema,
} from "../core/schema.ts";
import { standardSource, type ZodSchemaLike } from "../core/standard.ts";
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
  readonly render?: PageRender;
}

export const DEFAULT_PAGE_RENDER: PageRender = "ssr";

export const DEFAULT_APP_NAME = "app";

function sortById<T extends { readonly id: string }>(items: readonly T[]): T[] {
  return [...items].sort(compareIds);
}

function sortedIds(items: readonly { readonly id: string }[]): string[] {
  return items.map((item) => item.id).sort();
}

function unrepresentable(subject: string, problem: string): RexError {
  return new RexError("REX210", `buildManifest: ${subject} ${problem}`);
}

export function declaredJsonSchema(
  schema: ZodSchemaLike,
  override: JsonSchema | null,
  io: "input" | "output",
  subject: string,
): JsonSchema {
  if (override !== null) return override;
  const source = standardSource(schema);
  if (source !== null) {
    throw unrepresentable(
      subject,
      `is a ${source["~standard"].vendor} Standard Schema; declare jsonSchema.${io} on the declaration`,
    );
  }
  try {
    return toJsonSchema(schema, io);
  } catch (error) {
    throw unrepresentable(
      subject,
      `cannot be represented as JSON Schema: ${(error as Error).message}`,
    );
  }
}

function entityJsonSchema(declared: AnyEntity): JsonSchema {
  try {
    return objectJsonSchema(declared.fields);
  } catch (error) {
    throw unrepresentable(
      `entity "${declared.id}" fields`,
      `cannot be represented as JSON Schema: ${(error as Error).message}`,
    );
  }
}

function entityManifest(declared: AnyEntity): ManifestEntity {
  return {
    id: declared.id,
    key: declared.key,
    fields: Object.entries(declared.fields).map(([name, schema]) => ({
      name,
      kind: declared.fieldKinds[name] ?? null,
      ref: refTarget(schema as ZodSchemaLike) ?? null,
      required: !(schema as ZodSchemaLike).safeParse(undefined).success,
    })),
    schema: entityJsonSchema(declared),
  };
}

function actionManifest(declared: AnyAction): ManifestAction {
  return {
    id: declared.id,
    label: declared.label,
    shortcut: declared.shortcut,
    effect: declared.effect,
    invalidates: [...declared.invalidates].sort(),
    form: declared.form === null ? null : { ...declared.form },
    policy: predicateToJson(declared.policy),
    input: declaredJsonSchema(
      declared.input,
      declared.jsonSchema?.input ?? null,
      "input",
      `action "${declared.id}" input`,
    ),
    output: declaredJsonSchema(
      declared.output,
      declared.jsonSchema?.output ?? null,
      "output",
      `action "${declared.id}" output`,
    ),
  };
}

function chromeComponents(declared: AnyPage): ChromeComponentName[] {
  const components = declared.chrome.components ?? {};
  return CHROME_COMPONENT_NAMES.filter((name) => components[name] !== undefined);
}

function pageManifest(declared: AnyPage, render: PageRender): ManifestPage {
  return {
    id: declared.id,
    route: declared.route,
    routeParams: [...declared.routeParams],
    params: declaredJsonSchema(declared.params, null, "input", `page "${declared.id}" params`),
    policy: predicateToJson(declared.policy),
    recovery: declared.recovery,
    draft: declared.draft,
    render: declared.render ?? render,
    revalidate: declared.revalidate,
    paths: declared.paths !== null,
    loaders: [...declared.loaders]
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map((loader) => ({
        name: loader.name,
        action: loader.action.id,
        input: loader.input === null ? ("params" as const) : ("mapped" as const),
      })),
    cache: declared.cache === null ? null : { ...declared.cache },
    transition: declared.transition,
    chrome: {
      header: declared.chrome.header,
      nav: declared.chrome.nav,
      back: declared.chrome.back,
      title: declared.chrome.title,
      components: chromeComponents(declared),
    },
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
    throw new RexError("REX501", "buildManifest: app must be a non-empty string");
  }
  const render = options.render ?? DEFAULT_PAGE_RENDER;
  const pages = sortById(source.pages);
  const actionIds = new Set(source.actions.map((declared) => declared.id));
  const pageIds = new Set(pages.map((declared) => declared.id));
  for (const declared of pages) {
    for (const pageAction of declared.actions) {
      if (!actionIds.has(pageAction.id)) {
        throw new RexError(
          "REX222",
          `buildManifest: page "${declared.id}" declares action "${pageAction.id}" that is not registered`,
        );
      }
    }
    for (const loader of declared.loaders) {
      if (!actionIds.has(loader.action.id)) {
        throw new RexError(
          "REX209",
          `buildManifest: page "${declared.id}" loader "${loader.name}" names action "${loader.action.id}" that is not registered`,
        );
      }
    }
    for (const [field, target] of [
      ["recovery", declared.recovery],
      ["chrome.back", declared.chrome.back],
    ] as const) {
      if (target !== null && (!isValidName(target) || !pageIds.has(target))) {
        throw new RexError(
          "REX223",
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
    pages: pages.map((declared) => pageManifest(declared, render)),
    policies: sortById(source.policies).map(policyManifest),
    flows: sortById(source.flows ?? []).map(flowManifest),
  };
}

function canonical(value: unknown, path: string): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RexError("REX502", `stableStringify: ${path} is not finite`);
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
  throw new RexError("REX502", `stableStringify: ${path} has unsupported type ${typeof value}`);
}

export function stableStringify(value: unknown, indent = 2): string {
  return JSON.stringify(canonical(value, "$"), null, indent);
}
