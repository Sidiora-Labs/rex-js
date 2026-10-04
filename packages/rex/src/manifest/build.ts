import type { AnyAction } from "../core/action.ts";
import type {
  ResolvedDeploy,
  ResolvedI18n,
  ResolvedRedirect,
  ResolvedSite,
} from "../core/config.ts";
import type { AnyEntity } from "../core/entity.ts";
import { RexError } from "../core/errors.ts";
import { isValidName } from "../core/ids.ts";
import { parseRoute, type AnyPage, type PageRender } from "../core/page.ts";
import { predicateToJson, type AnyPolicy } from "../core/policy.ts";
import { compareIds } from "../core/registry.ts";
import { STANDARD_VENDOR_KEY, acceptsSync, refTarget, type JsonSchema } from "../core/schema.ts";
import type { StandardSchemaV1 } from "../core/standard.ts";
import { objectJsonSchema, standardJsonSchema, standardVendorOf } from "./json-schema.ts";
import {
  MANIFEST_VERSION,
  type FlowSource,
  type Manifest,
  type ManifestAction,
  type ManifestEntity,
  type ManifestFlow,
  type ManifestI18n,
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
  readonly site?: ResolvedSite | null;
  readonly redirects?: readonly ResolvedRedirect[];
  readonly deploy?: ResolvedDeploy | null;
  readonly i18n?: ResolvedI18n | null;
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
  schema: StandardSchemaV1,
  override: JsonSchema | null,
  io: "input" | "output",
  subject: string,
): JsonSchema {
  if (override !== null) return override;
  const vendor = standardVendorOf(schema);
  if (vendor !== null) {
    throw unrepresentable(
      subject,
      `is a ${vendor} Standard Schema; declare jsonSchema.${io} on the declaration`,
    );
  }
  try {
    return standardJsonSchema(schema, io);
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
      ref: refTarget(schema) ?? null,
      required: !acceptsSync(schema, undefined),
    })),
    schema: entityJsonSchema(declared),
  };
}

function pageParamsJsonSchema(declared: AnyPage): JsonSchema {
  const vendor = standardVendorOf(declared.params);
  if (vendor === null) {
    return declaredJsonSchema(declared.params, null, "input", `page "${declared.id}" params`);
  }
  const rest = parseRoute(declared.route).segments.find((segment) => segment.kind === "rest");
  const required = declared.routeParams.filter(
    (name) => rest === undefined || name !== rest.name || !rest.optional,
  );
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: Object.fromEntries(
      declared.routeParams.map((name) => [
        name,
        rest !== undefined && rest.name === name
          ? { type: "array", items: { type: "string" } }
          : { type: "string" },
      ]),
    ),
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: {},
    [STANDARD_VENDOR_KEY]: vendor,
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
    http: declared.http === null ? null : { ...declared.http },
    cache: declared.cache === null ? null : { ...declared.cache },
    optimistic: declared.optimistic === null ? [] : Object.keys(declared.optimistic).sort(),
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

function pageManifest(declared: AnyPage, render: PageRender): ManifestPage {
  const rest = parseRoute(declared.route).segments.find((segment) => segment.kind === "rest");
  return {
    id: declared.id,
    route: declared.route,
    routeParams: [...declared.routeParams],
    restParam: rest === undefined ? null : { name: rest.name, optional: rest.optional },
    params: pageParamsJsonSchema(declared),
    policy: predicateToJson(declared.policy),
    recovery: declared.recovery,
    draft: declared.draft,
    render: declared.render ?? render,
    revalidate: declared.revalidate,
    paths: declared.paths !== null || declared.pathsAction !== null,
    pathsAction: declared.pathsAction === null ? null : declared.pathsAction.action.id,
    fallback: declared.fallback,
    loaders: [...declared.loaders]
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map((loader) => ({
        name: loader.name,
        action: loader.action.id,
        input: loader.input === null ? ("params" as const) : ("mapped" as const),
        invalidatedBy: [...loader.invalidatedBy].sort(),
      })),
    cache: declared.cache === null ? null : { ...declared.cache },
    transition: declared.transition,
    prefetch: declared.prefetch,
    islands: Object.fromEntries(
      Object.entries(declared.islands)
        .filter(
          (entry): entry is [string, NonNullable<(typeof entry)[1]>] => entry[1] !== undefined,
        )
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
    chrome: {
      header: declared.chrome.header,
      nav: declared.chrome.nav,
      back: declared.chrome.back,
      title: declared.chrome.title,
      description: declared.chrome.description,
      image: declared.chrome.image,
      frame: declared.chrome.frame,
      order: declared.chrome.order,
      icon: declared.chrome.icon,
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
      for (const named of [loader.action.id, ...loader.invalidatedBy]) {
        if (!actionIds.has(named)) {
          throw new RexError(
            "REX209",
            `buildManifest: page "${declared.id}" loader "${loader.name}" names action "${named}" that is not registered`,
          );
        }
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
  validateInvalidates(source.actions, pages);
  validateEndpoints(source.actions, pages);
  validateBackChains(pages);
  const redirects = options.redirects ?? [];
  validateRedirects(redirects, pages);
  const site = options.site ?? null;
  const deploy = options.deploy ?? null;
  return {
    version: MANIFEST_VERSION,
    app: site === null ? { name: app } : { name: app, site: { ...site } },
    entities: sortById(source.entities).map(entityManifest),
    actions: sortById(source.actions).map(actionManifest),
    pages: pages.map((declared) => pageManifest(declared, render)),
    policies: sortById(source.policies).map(policyManifest),
    flows: sortById(source.flows ?? []).map(flowManifest),
    redirects: redirects.map((entry) => ({
      source: entry.source,
      destination: entry.destination,
      status: entry.status,
    })),
    deploy: deploy === null ? null : { host: deploy.host, target: deploy.target },
    i18n: i18nManifest(options.i18n ?? null),
  };
}

function i18nManifest(i18n: ResolvedI18n | null): ManifestI18n | null {
  if (i18n === null) return null;
  return {
    locales: [...i18n.locales],
    default: i18n.default,
    routing: i18n.routing,
    direction: Object.fromEntries(
      i18n.locales.map((locale) => [locale, i18n.direction[locale] ?? "ltr"]),
    ),
  };
}

function validateInvalidates(actions: readonly AnyAction[], pages: readonly AnyPage[]): void {
  const effects = new Map(actions.map((declared) => [declared.id, declared.effect]));
  const loaderNames = new Set(
    pages.flatMap((declared) => declared.loaders.map((loader) => loader.name)),
  );
  const pageIds = new Set(pages.map((declared) => declared.id));
  for (const declared of actions) {
    for (const name of declared.invalidates) {
      const effect = effects.get(name);
      if (
        effect !== undefined &&
        effect !== "read" &&
        !loaderNames.has(name) &&
        !pageIds.has(name)
      ) {
        throw new RexError(
          "REX212",
          `buildManifest: action "${declared.id}" invalidates "${name}", a ${effect} action; invalidates names page loaders, read actions or pages`,
        );
      }
    }
    for (const name of Object.keys(declared.optimistic ?? {})) {
      const effect = effects.get(name);
      if (effect !== undefined && effect !== "read") {
        throw new RexError(
          "REX229",
          `buildManifest: action "${declared.id}" optimistic "${name}" names action "${name}" whose effect is ${effect}, not read`,
        );
      }
      if (!loaderNames.has(name) && effect === undefined) {
        throw new RexError(
          "REX229",
          `buildManifest: action "${declared.id}" optimistic "${name}" names no page loader or read action`,
        );
      }
    }
  }
}

function routeKey(route: string): string {
  return parseRoute(route)
    .segments.map((segment) =>
      segment.kind === "static" ? segment.value : segment.kind === "rest" ? ":*" : ":",
    )
    .join("/");
}

function validateEndpoints(actions: readonly AnyAction[], pages: readonly AnyPage[]): void {
  const pageRoutes = new Map(pages.map((declared) => [declared.route, declared.id]));
  const taken = new Map<string, string>();
  for (const declared of sortById(actions)) {
    if (declared.http === null) continue;
    const path = declared.http.path;
    const page = pageRoutes.get(path);
    if (page !== undefined) {
      throw new RexError(
        "REX227",
        `buildManifest: action "${declared.id}" http.path ${path} collides with the route of page "${page}"`,
      );
    }
    const other = taken.get(path);
    if (other !== undefined) {
      throw new RexError(
        "REX227",
        `buildManifest: action "${declared.id}" http.path ${path} collides with action "${other}"`,
      );
    }
    taken.set(path, declared.id);
  }
}

function validateRedirects(
  redirects: readonly ResolvedRedirect[],
  pages: readonly AnyPage[],
): void {
  const pageRoutes = new Map(pages.map((declared) => [routeKey(declared.route), declared.id]));
  for (const redirect of redirects) {
    const page = pageRoutes.get(routeKey(redirect.source));
    if (page !== undefined) {
      throw new RexError(
        "REX126",
        `buildManifest: redirect source ${redirect.source} matches the route of page "${page}"; a page route is never redirected`,
      );
    }
  }
}

function validateBackChains(pages: readonly AnyPage[]): void {
  const backOf = new Map(pages.map((declared) => [declared.id, declared.chrome.back]));
  for (const declared of pages) {
    const seen = [declared.id];
    let next = declared.chrome.back;
    while (next !== null && next !== undefined) {
      if (seen.includes(next)) {
        throw new RexError(
          "REX225",
          `buildManifest: page "${declared.id}" chrome.back forms a cycle: ${[...seen, next].join(" -> ")}`,
        );
      }
      seen.push(next);
      next = backOf.get(next) ?? null;
    }
  }
}

function canonical(value: unknown, path: string): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new RexError("REX502", `stableStringify: ${path} is not finite`);
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
