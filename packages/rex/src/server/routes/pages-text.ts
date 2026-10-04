import { QueryClient } from "@tanstack/react-query";
import type { Hono } from "hono";
import { buildSidecarPayload, type SidecarLocale } from "../../client/agent/sidecar.tsx";
import { i18nFor, type TextResolver } from "../../client/i18n/context.ts";
import { localizeHref } from "../../client/i18n/locale.ts";
import { translate } from "../../client/i18n/messages.ts";
import {
  manifestParamsSchema,
  pageHref,
  parsePageParams,
  type ParamIssue,
} from "../../client/router.tsx";
import { hasContent, resolveDataState, type DataStateQuery } from "../../client/states.ts";
import type { Actor } from "../../core/actor.ts";
import type { RegistrySnapshot } from "../../core/registry.ts";
import { RexError } from "../../core/errors.ts";
import { actionAddress, overlayAddress, regionAddress } from "../../core/ids.ts";
import { parseRoute, type AnyPage } from "../../core/page.ts";
import { evaluate, type PolicyResult } from "../../core/policy.ts";
import { REX_RPC_PREFIX } from "../../core/protocol.ts";
import type { JsonSchema } from "../../core/schema.ts";
import type { RexDataState } from "../../core/states.ts";
import type { SidecarPayload } from "../../manifest/sidecar.schema.ts";
import type { Manifest, ManifestPage } from "../../manifest/types.ts";
import type { RexServerSetup } from "../app.ts";
import { RexDensityError, createRexContext, type RexRequestContext } from "../context.ts";
import { CONFIRM_FIELD, CSRF_COOKIE, CSRF_FIELD, formPath } from "../form.ts";
import { prerenderContext } from "../adapters/static-cache.ts";
import type { Ledger } from "../audit.ts";
import {
  createActionLoaderRunner,
  loaderRunnerFor,
  runPageLoaders,
  type LoaderRunner,
} from "../loaders.ts";
import { resolveRequestLocale } from "../locale.ts";
import { RENDER_PAGE_HEADER } from "./render.ts";

export const PAGES_TEXT_PREFIX = "/rex/pages";
export const PAGES_TEXT_EXTENSION = ".md";
export const PAGES_TEXT_ROUTE = `${PAGES_TEXT_PREFIX}/:file`;
export const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";

export const PAGES_TEXT_STATUS = Object.freeze({
  page: 200,
  denied: 403,
  "not-found": 404,
} as const);

export interface PageTextSource {
  readonly manifest: Manifest;
  readonly page: AnyPage;
  readonly params: Readonly<Record<string, unknown>>;
  readonly issues: readonly ParamIssue[];
  readonly href: string | null;
  readonly actor: Actor;
  readonly policy: PolicyResult;
  readonly state: RexDataState;
  readonly text?: TextResolver;
  readonly locale?: SidecarLocale | null;
}

export interface PageText {
  readonly markdown: string;
  readonly sidecar: SidecarPayload;
}

export function pageTextPath(pageId: string): string {
  return `${PAGES_TEXT_PREFIX}/${encodeURIComponent(pageId)}${PAGES_TEXT_EXTENSION}`;
}

function literal(text: string): string {
  return text;
}

function cell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function code(value: string): string {
  const longest = Math.max(0, ...(value.match(/`+/g) ?? []).map((run) => run.length));
  const ticks = "`".repeat(longest + 1);
  const padded = value.startsWith("`") || value.endsWith("`") ? ` ${value} ` : value;
  return cell(`${ticks}${padded}${ticks}`);
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string[] {
  if (rows.length === 0) return ["_None._"];
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ];
}

function fence(body: string, language: string): string[] {
  const longest = Math.max(0, ...(body.match(/`{3,}/g) ?? []).map((run) => run.length));
  const marker = "`".repeat(Math.max(3, longest + 1));
  return [`${marker}${language}`, body, marker];
}

function inputFields(schema: JsonSchema): readonly string[] {
  const properties = schema.properties;
  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) {
    return [];
  }
  return Object.keys(properties);
}

function invocationUrl(href: string | null, actionId: string): string | null {
  if (href === null) return null;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}act=${encodeURIComponent(actionId)}&input=<json>`;
}

function listedPage(manifest: Manifest, declared: AnyPage): ManifestPage {
  const listed = manifest.pages.find((entry) => entry.id === declared.id);
  if (listed === undefined) {
    throw new RexError("REX308", `rex: the manifest does not list page "${declared.id}"`);
  }
  return listed;
}

export function renderPageText(source: PageTextSource): PageText {
  const { manifest, page: declared, actor } = source;
  const text = source.text ?? literal;
  const listed = listedPage(manifest, declared);
  const sidecar = buildSidecarPayload({
    manifest,
    page: declared,
    params: source.params,
    state: source.state,
    actor,
    openOverlays: [],
    outcome: null,
    text,
    locale: source.locale ?? null,
  });
  const document = sidecar.document ?? null;
  const access = source.policy.allowed ? "allowed" : `denied: ${source.policy.reason}`;
  const lines: string[] = [
    `# ${cell(document === null ? text(declared.chrome.title) : document.title)}`,
    "",
    ...table(
      ["Field", "Value"],
      [
        ["Page", code(declared.id)],
        ["Route", code(declared.route)],
        ["URL", source.href === null ? "-" : code(source.href)],
        ["Render", listed.render],
        ["Actor", code(actor.id)],
        ["State", code(source.state)],
        ["Access", cell(access)],
        ["Title", document === null ? "-" : cell(document.title)],
        [
          "Description",
          document === null || document.description === null ? "-" : cell(document.description),
        ],
        [
          "Canonical",
          document === null || document.canonical === null ? "-" : code(document.canonical),
        ],
      ],
    ),
    "",
  ];
  if (source.issues.length > 0) {
    lines.push(
      "## Param issues",
      "",
      ...table(
        ["Param", "Problem"],
        source.issues.map((issue) => [code(issue.path), cell(issue.message)]),
      ),
      "",
    );
  }
  lines.push(
    "## Loaders",
    "",
    ...table(
      ["Loader", "Action", "Input", "Invalidated by"],
      [...declared.loaders]
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .map((loader) => [
          code(loader.name),
          code(loader.action.id),
          loader.input === null ? "params" : "mapped",
          loader.invalidatedBy.length === 0
            ? "-"
            : [...loader.invalidatedBy].sort().map(code).join(", "),
        ]),
    ),
    "",
    "## Regions",
    "",
    ...table(
      ["Region", "Address"],
      declared.regions.map((region) => [
        code(region),
        code(`[data-rex-region="${regionAddress(declared.id, region)}"]`),
      ]),
    ),
    "",
    "## Actions",
    "",
    ...table(
      ["Action", "Label", "Effect", "Allowed", "Control", "Fields", "URL", "Form"],
      sidecar.actions.map((entry) => {
        const url = invocationUrl(source.href, entry.id);
        const fields = inputFields(entry.input);
        return [
          code(entry.id),
          cell(entry.label),
          entry.effect,
          entry.allowed ? "yes" : cell(`no: ${entry.reason}`),
          code(`[data-rex="${actionAddress(declared.id, entry.id)}"]`),
          fields.length === 0 ? "-" : fields.map(code).join(", "),
          url === null ? "-" : code(`GET ${url}`),
          code(`POST ${formPath(entry.id)}`),
        ];
      }),
    ),
    "",
    `Invoke an action by its control, by opening its URL with \`input\` set to the URL-encoded JSON input, by posting its form, or through \`POST ${REX_RPC_PREFIX}/<action>\`. A form post sends the fields by name plus \`${CSRF_FIELD}\` matching the \`${CSRF_COOKIE}\` cookie; an irreversible action answers with a confirmation page until the post carries \`${CONFIRM_FIELD}\`. A disallowed action is refused on every route with its reason.`,
    "",
    "## Overlays",
    "",
    ...table(
      ["Overlay", "Address", "Trigger", "Dismiss", "Binding", "Open"],
      sidecar.overlays.map((entry) => {
        const address = overlayAddress(declared.id, entry.id);
        const binding = listed.overlays.find((overlay) => overlay.id === entry.id)?.binding;
        return [
          code(entry.id),
          code(`[data-rex-overlay="${address}"]`),
          code(`[data-rex-overlay-trigger="${address}"]`),
          entry.dismiss,
          binding ?? "-",
          entry.open ? "yes" : "no",
        ];
      }),
    ),
    "",
    "## Sidecar",
    "",
    ...fence(JSON.stringify(sidecar, null, 2), "json"),
    "",
  );
  return { markdown: lines.join("\n"), sidecar };
}

function notFoundText(pageId: string, pages: readonly AnyPage[]): string {
  const known = pages.map((entry) => entry.id).sort();
  return [
    "# Page not found",
    "",
    `No page has id ${code(pageId)}.`,
    "",
    ...table(
      ["Page", "Text"],
      known.map((id) => [code(id), code(pageTextPath(id))]),
    ),
    "",
  ].join("\n");
}

function splitParams(
  declared: AnyPage,
  url: URL,
): { readonly routeParams: Record<string, string | undefined>; readonly search: string } {
  const query = new URLSearchParams(url.search);
  const routeParams: Record<string, string | undefined> = {};
  for (const name of declared.routeParams) {
    routeParams[name] = query.get(name) ?? undefined;
    query.delete(name);
  }
  return { routeParams, search: query.toString() };
}

function queriesOf(client: QueryClient, keys: readonly (readonly unknown[])[]): DataStateQuery[] {
  return keys.map((key) => {
    const state = client.getQueryState(key);
    return {
      status: state?.status ?? "pending",
      fetchStatus: "idle",
      hasData: state?.data !== undefined,
      error: state?.error ?? null,
    };
  });
}

async function pageState(
  runner: LoaderRunner | undefined,
  declared: AnyPage,
  params: Readonly<Record<string, unknown>>,
  context: RexRequestContext,
  policy: PolicyResult,
  issues: readonly ParamIssue[],
): Promise<RexDataState> {
  if (!policy.allowed) return "permission-denied";
  if (issues.length > 0) return "terminal-error";
  if (declared.loaders.length === 0) {
    return resolveDataState({ queries: [], policy, online: true, hasData: true });
  }
  if (runner === undefined) {
    throw new RexError(
      "REX408",
      `rex: page "${declared.id}" declares loaders but the request was not served by createRexServer`,
    );
  }
  const client = new QueryClient();
  const outcomes = await runPageLoaders({
    page: declared,
    params,
    context,
    queryClient: client,
    runner,
  });
  const keys = outcomes.map((outcome) => outcome.key);
  const hasData = keys.some((key) => hasContent(client.getQueryData(key)));
  const queries = queriesOf(client, keys);
  client.clear();
  return resolveDataState({ queries, policy, online: true, hasData });
}

interface PageTextRequest {
  readonly request: Request;
  readonly manifest: Manifest;
  readonly registry: Parameters<typeof i18nFor>[0];
  readonly page: AnyPage;
  readonly routeParams: Readonly<Record<string, string | undefined>>;
  readonly search: string;
  readonly context: RexRequestContext;
  readonly runner: LoaderRunner | undefined;
}

interface PageTextAnswer {
  readonly markdown: string;
  readonly allowed: boolean;
}

async function pageTextFor(input: PageTextRequest): Promise<PageTextAnswer> {
  const { request, manifest, page: declared, context } = input;
  const schema = manifestParamsSchema(manifest, declared);
  const parsed = parsePageParams(declared, input.routeParams, input.search, schema);
  const params = parsed.ok ? parsed.params : Object.freeze({});
  const issues = parsed.ok ? [] : parsed.issues;
  const policy = evaluate(declared.policy, context.actor);
  const source = i18nFor(input.registry);
  const locale = source === null ? null : resolveRequestLocale(request, source.settings).locale;
  const resolved = parsed.ok ? pageHref(declared, params, {}, schema) : null;
  let href = resolved !== null && resolved.ok ? resolved.href : null;
  if (href !== null && source !== null && locale !== null && source.settings.routing === "prefix") {
    href = localizeHref(href, locale);
  }
  const state = await pageState(input.runner, declared, params, context, policy, issues);
  const { markdown } = renderPageText({
    manifest,
    page: declared,
    params,
    issues,
    href,
    actor: context.actor,
    policy,
    state,
    text:
      source === null || locale === null ? literal : (value) => translate(source, locale, value),
    locale:
      source === null || locale === null ? null : { locale, locales: source.settings.locales },
  });
  return { markdown, allowed: policy.allowed };
}

export interface StaticPageTextOptions {
  readonly manifest: Manifest;
  readonly registry: RegistrySnapshot;
  readonly page: AnyPage;
  readonly url: URL;
  readonly actor: Actor;
  readonly ledger: Ledger;
}

function pathRouteParams(declared: AnyPage, pathname: string): Record<string, string | undefined> {
  const segments = pathname.split("/").filter((segment) => segment !== "");
  const routeParams: Record<string, string | undefined> = {};
  parseRoute(declared.route).segments.forEach((segment, index) => {
    if (segment.kind === "param") routeParams[segment.name] = segments[index];
  });
  return routeParams;
}

export async function renderStaticPageText(options: StaticPageTextOptions): Promise<string> {
  const { page: declared, url } = options;
  const answer = await pageTextFor({
    request: new Request(url, { headers: { accept: MARKDOWN_CONTENT_TYPE } }),
    manifest: options.manifest,
    registry: options.registry,
    page: declared,
    routeParams: pathRouteParams(declared, url.pathname),
    search: url.search,
    context: prerenderContext(options.actor),
    runner: createActionLoaderRunner(options.registry, { ledger: options.ledger }),
  });
  return answer.markdown;
}

function markdownResponse(body: string, status: number, page: string | null): Response {
  const headers = new Headers({
    "content-type": MARKDOWN_CONTENT_TYPE,
    "cache-control": "no-store",
  });
  if (page !== null) headers.set(RENDER_PAGE_HEADER, page);
  return new Response(body, { status, headers });
}

export function installPagesTextRoute(app: Hono, setup: RexServerSetup): void {
  const manifest = JSON.parse(setup.manifestBody) as Manifest;
  const pages = setup.options.registry.pages;
  app.get(PAGES_TEXT_ROUTE, async (c, next) => {
    const file = c.req.param("file");
    if (!file.endsWith(PAGES_TEXT_EXTENSION)) {
      await next();
      return;
    }
    const pageId = file.slice(0, -PAGES_TEXT_EXTENSION.length);
    const declared = pages.find((entry) => entry.id === pageId);
    if (declared === undefined) {
      return markdownResponse(notFoundText(pageId, pages), PAGES_TEXT_STATUS["not-found"], null);
    }
    const request = c.req.raw;
    let context: RexRequestContext;
    try {
      context = await createRexContext(request, setup.options.actor);
    } catch (error) {
      if (error instanceof RexDensityError) {
        return c.json({ code: "BAD_REQUEST", message: error.message }, 400);
      }
      throw error;
    }
    const url = new URL(request.url);
    const { routeParams, search } = splitParams(declared, url);
    const { markdown, allowed } = await pageTextFor({
      request,
      manifest,
      registry: setup.options.registry,
      page: declared,
      routeParams,
      search,
      context,
      runner: loaderRunnerFor(request),
    });
    const status = allowed ? PAGES_TEXT_STATUS.page : PAGES_TEXT_STATUS.denied;
    return markdownResponse(markdown, status, declared.id);
  });
}
