import { createORPCClient } from "@orpc/client";
import { QueryClient } from "@tanstack/react-query";
import { render, waitFor, type RenderResult } from "@testing-library/react";
import type { Hono } from "hono";
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { actor as createActor, type Actor, type ActorInput } from "../core/actor.ts";
import { isPlainObject } from "../core/entity.ts";
import type { AnyPage, PageStatesModule } from "../core/page.ts";
import { REX_DENSITY_HEADER } from "../core/protocol.ts";
import type { RegistrySnapshot } from "../core/registry.ts";
import { validateSidecar, type SidecarPayload } from "../manifest/sidecar.schema.ts";
import type { Manifest } from "../manifest/types.ts";
import { DensityProvider } from "../client/agent/density.ts";
import {
  AffordanceRegistryProvider,
  OverlayRegistryProvider,
  RegionFailureRegistryContext,
  createAffordanceRegistry,
  createOverlayRegistry,
  createRegionFailureRegistry,
  readSidecar as readSidecarElement,
} from "../client/agent/sidecar.tsx";
import { createRexApp, createRexLink, type RexFetch } from "../client/app.tsx";
import type { RexClient } from "../client/context.ts";
import { createRexEntry } from "../client/entry.tsx";
import { OutcomeProvider, createOutcomeStore, type OutcomeStore } from "../client/outcome.ts";
import {
  PageHost,
  definePageModules,
  isLazyPageModules,
  view,
  type EagerPageModuleSet,
  type PageModuleSet,
} from "../client/page.tsx";
import { RexProviders } from "../client/providers.ts";
import { resetAll } from "../client/reset.ts";
import { NotFound, RexRoutes, manifestParamsSchema, pageHref } from "../client/router.tsx";
import { buildManifest } from "../manifest/build.ts";
import { AgentOutcome } from "../client/shell.tsx";
import { memoryLedger, type Ledger } from "../server/audit.ts";
import { createRexServer } from "../server/app.ts";
import { isRexDensity, type RexDensity } from "../server/context.ts";
import { ORIGIN_HEADER } from "../server/middleware/security.ts";

export const TEST_BASE_URL = "http://rex.test";
export const ACCEPT_LANGUAGE_HEADER = "accept-language";

export interface TestAppSource {
  readonly name?: string;
  readonly registry: RegistrySnapshot;
  readonly manifest?: Manifest;
  readonly pages: readonly PageModuleSet[];
}

export interface TestServerOptions {
  readonly ledger?: Ledger;
  readonly app?: string;
  readonly confirmTtlMs?: number;
}

export interface TestAppOptions {
  readonly actor: Actor | ActorInput;
  readonly server?: TestServerOptions;
}

export interface TestApp {
  readonly source: TestAppSource;
  readonly registry: RegistrySnapshot;
  readonly pages: readonly PageModuleSet[];
  readonly actor: Actor;
  readonly ledger: Ledger;
  readonly server: Hono;
  readonly baseUrl: string;
  page(id: string): AnyPage;
}

export type TestFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface TestServer {
  readonly server: Hono;
  readonly ledger: Ledger;
  readonly client: RexClient;
  readonly fetch: TestFetch;
}

export interface RenderPageOptions {
  readonly params?: Readonly<Record<string, unknown>>;
  readonly locale?: string;
  readonly density?: RexDensity;
  readonly pageTimeout?: number;
}

export const DEFAULT_PAGE_TIMEOUT = 15_000;

export interface RexRenderResult extends RenderResult {
  readonly app: TestApp;
  readonly page: AnyPage;
  readonly href: string;
  readonly history: readonly string[];
  readonly queryClient: QueryClient;
  readonly outcomes: OutcomeStore;
  navigate(to: string, options?: { readonly replace?: boolean }): void;
  sidecar(): SidecarPayload;
}

export interface RexTestHooks {
  afterEach(cleanup: () => void): unknown;
}

export class RexTestingError extends Error {
  constructor(message: string) {
    super(`rex/testing: ${message}`);
    this.name = "RexTestingError";
  }
}

const mounted = new Set<() => void>();

export function cleanupRex(): void {
  for (const unmount of [...mounted]) unmount();
  mounted.clear();
  resetAll();
}

export function setupRexTesting(hooks: RexTestHooks): void {
  if (typeof hooks !== "object" || hooks === null || typeof hooks.afterEach !== "function") {
    throw new RexTestingError("setupRexTesting needs the test runner's afterEach, e.g. { afterEach } from vitest");
  }
  hooks.afterEach(cleanupRex);
}

export function createTestApp(source: TestAppSource, options: TestAppOptions): TestApp {
  if (!isPlainObject(source) || source.registry === undefined || !Array.isArray(source.pages)) {
    throw new RexTestingError("createTestApp needs the app bundle with registry and pages");
  }
  if (!isPlainObject(options) || options.actor === undefined) {
    throw new RexTestingError("createTestApp needs an actor");
  }
  const subject = createActor(options.actor);
  const serverOptions = options.server ?? {};
  const ledger = serverOptions.ledger ?? memoryLedger();
  const appName = serverOptions.app ?? source.name;
  const server = createRexServer({
    registry: source.registry,
    ledger,
    actor: () => subject,
    ...(appName === undefined ? {} : { app: appName }),
    ...(serverOptions.confirmTtlMs === undefined ? {} : { confirmTtlMs: serverOptions.confirmTtlMs }),
  });
  const registry = source.registry;
  return Object.freeze({
    source,
    registry,
    pages: source.pages,
    actor: subject,
    ledger,
    server,
    baseUrl: TEST_BASE_URL,
    page(id: string): AnyPage {
      const found = registry.find("page", id);
      if (found === undefined) {
        const known = registry.pages.map((declared) => declared.id).join(", ");
        throw new RexTestingError(`page "${id}" is not registered (pages: ${known})`);
      }
      return found;
    },
  });
}

function toRequest(app: TestApp, input: string | URL | Request, init?: RequestInit): Request {
  if (input instanceof Request) return init === undefined ? input : new Request(input, init);
  return new Request(new URL(String(input), app.baseUrl), init);
}

const ORIGINLESS_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD"]);

export function testOrigin(app: TestApp): string {
  return new URL(app.baseUrl).origin;
}

function restoreGivenHeaders(request: Request, init: RequestInit | undefined): void {
  if (init?.headers === undefined) return;
  for (const [name, value] of new Headers(init.headers)) {
    if (request.headers.get(name) !== value) request.headers.set(name, value);
  }
}

function serverFetch(app: TestApp, headers: Readonly<Record<string, string>> = {}): TestFetch {
  return async (input, init) => {
    const request = toRequest(app, input, init);
    restoreGivenHeaders(request, init);
    for (const [name, value] of Object.entries(headers)) {
      if (!request.headers.has(name)) request.headers.set(name, value);
    }
    if (!ORIGINLESS_METHODS.has(request.method) && !request.headers.has(ORIGIN_HEADER)) {
      request.headers.set(ORIGIN_HEADER, testOrigin(app));
    }
    return app.server.fetch(request);
  };
}

export function testServer(app: TestApp): TestServer {
  const fetch = serverFetch(app);
  const link = createRexLink(app.baseUrl, fetch);
  return Object.freeze({
    server: app.server,
    ledger: app.ledger,
    client: createORPCClient<RexClient>(link),
    fetch,
  });
}

export function readSidecar(container: ParentNode = globalThis.document): SidecarPayload {
  const validation = validateSidecar(readSidecarElement(container));
  if (!validation.valid) {
    const issues = validation.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ");
    throw new RexTestingError(`the page sidecar is invalid: ${issues}`);
  }
  return validation.payload;
}

function recordedLocation(path: string) {
  return memoryLocation({ path, record: true });
}

type MemoryHistory = ReturnType<typeof recordedLocation>;

interface RenderSetup {
  readonly page: AnyPage;
  readonly href: string;
  readonly fetch: RexFetch;
  readonly queryClient: QueryClient;
  readonly outcomes: OutcomeStore;
  readonly memory: MemoryHistory;
  readonly pageTimeout: number;
  readonly restoreLocale: () => void;
}

function resolveLocale(locale: string | undefined): string | undefined {
  if (locale === undefined) return undefined;
  if (typeof locale !== "string" || locale.length === 0) {
    throw new RexTestingError("locale must be a non-empty BCP 47 tag");
  }
  return Intl.getCanonicalLocales(locale)[0];
}

function applyLocale(locale: string | undefined): () => void {
  const root = globalThis.document?.documentElement;
  if (locale === undefined || root === undefined) return () => {};
  const previous = root.getAttribute("lang");
  root.setAttribute("lang", locale);
  return () => {
    if (previous === null) root.removeAttribute("lang");
    else root.setAttribute("lang", previous);
  };
}

function resolvePageTimeout(pageTimeout: number | undefined): number {
  if (pageTimeout === undefined) return DEFAULT_PAGE_TIMEOUT;
  if (typeof pageTimeout !== "number" || !Number.isFinite(pageTimeout) || pageTimeout <= 0) {
    throw new RexTestingError(
      `pageTimeout must be a positive number of milliseconds, received ${String(pageTimeout)}`,
    );
  }
  return pageTimeout;
}

function prepare(app: TestApp, pageId: string, options: RenderPageOptions): RenderSetup {
  cleanupRex();
  const declared = app.page(pageId);
  const pageTimeout = resolvePageTimeout(options.pageTimeout);
  const density = options.density ?? "default";
  if (!isRexDensity(density)) {
    throw new RexTestingError(`density must be "default" or "agent", received ${String(density)}`);
  }
  const locale = resolveLocale(options.locale);
  const manifest = app.source.manifest ?? buildManifest(app.registry);
  const target = pageHref(
    declared,
    options.params ?? {},
    {},
    manifestParamsSchema(manifest, declared),
  );
  if (!target.ok) {
    const issues = target.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ");
    throw new RexTestingError(`invalid params for page "${pageId}": ${issues}`);
  }
  const headers: Record<string, string> = { [REX_DENSITY_HEADER]: density };
  if (locale !== undefined) headers[ACCEPT_LANGUAGE_HEADER] = locale;
  const memory = recordedLocation(target.href);
  return {
    page: declared,
    href: target.href,
    fetch: serverFetch(app, headers),
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    outcomes: createOutcomeStore(),
    memory,
    pageTimeout,
    restoreLocale: applyLocale(locale),
  };
}

function Isolated({ outcomes, children }: { readonly outcomes: OutcomeStore; readonly children: ReactNode }) {
  return createElement(
    OutcomeProvider,
    { store: outcomes },
    createElement(
      OverlayRegistryProvider,
      { registry: createOverlayRegistry() },
      createElement(
        AffordanceRegistryProvider,
        { registry: createAffordanceRegistry() },
        createElement(
          RegionFailureRegistryContext.Provider,
          { value: createRegionFailureRegistry() },
          children,
        ),
      ),
    ),
  );
}

function pageSelector(pageId: string): string {
  return `[data-rex-page="${pageId}"]:not([data-rex-page-loading])`;
}

async function mount(
  app: TestApp,
  setup: RenderSetup,
  tree: ReactElement,
): Promise<RexRenderResult> {
  let result: RenderResult;
  try {
    result = render(
      createElement(Isolated, {
        outcomes: setup.outcomes,
        children: createElement(Router, { hook: setup.memory.hook, children: tree }),
      }),
    );
  } catch (error) {
    setup.restoreLocale();
    throw error;
  }
  const container = result.container;
  let unmounted = false;
  const unmount = () => {
    if (unmounted) return;
    unmounted = true;
    mounted.delete(unmount);
    result.unmount();
    container.remove();
    setup.queryClient.clear();
    setup.restoreLocale();
  };
  mounted.add(unmount);
  const startup = await waitFor(
    () => {
      const failed = container.querySelector('[data-rex-app-state="error"]');
      if (failed !== null) return failed.textContent ?? "startup failed";
      if (container.querySelector(pageSelector(setup.page.id)) === null) {
        throw new RexTestingError(
          `page "${setup.page.id}" did not mount at ${setup.href} within ${setup.pageTimeout} ms`,
        );
      }
      return null;
    },
    { timeout: setup.pageTimeout },
  );
  if (startup !== null) {
    unmount();
    throw new RexTestingError(`the app failed to start: ${startup}`);
  }
  return Object.freeze({
    ...result,
    unmount,
    app,
    page: setup.page,
    href: setup.href,
    history: setup.memory.history,
    queryClient: setup.queryClient,
    outcomes: setup.outcomes,
    navigate: (to: string, options: { readonly replace?: boolean } = {}) =>
      setup.memory.navigate(to, { replace: options.replace ?? false }),
    sidecar: () => readSidecar(container),
  });
}

export async function renderPage(
  app: TestApp,
  pageId: string,
  options: RenderPageOptions = {},
): Promise<RexRenderResult> {
  const setup = prepare(app, pageId, options);
  const RexEntry = createRexEntry(
    { registry: app.registry, pages: app.pages, ...(app.source.manifest === undefined ? {} : { manifest: app.source.manifest }) },
    { fetch: setup.fetch, baseUrl: app.baseUrl, queryClient: setup.queryClient },
  );
  return mount(app, setup, createElement(RexEntry));
}

async function eagerModules(modules: PageModuleSet): Promise<EagerPageModuleSet> {
  if (!isLazyPageModules(modules)) return modules;
  const loaded = await modules.load();
  return definePageModules({
    page: modules.page,
    view: loaded.view as ComponentType,
    states: loaded.states as PageStatesModule<AnyPage>,
    regions: (loaded.regions ?? {}) as Readonly<Record<string, ComponentType>>,
    overlays: (loaded.overlays ?? {}) as Readonly<Record<string, ComponentType>>,
  });
}

export async function renderRegion(
  app: TestApp,
  pageId: string,
  regionName: string,
  props: Readonly<Record<string, unknown>> = {},
  options: RenderPageOptions = {},
): Promise<RexRenderResult> {
  const declared = app.page(pageId);
  if (!declared.regions.includes(regionName)) {
    throw new RexTestingError(
      `region "${regionName}" is not declared by page "${pageId}" (regions: ${declared.regions.join(", ") || "none"})`,
    );
  }
  const modules = app.pages.find((set) => set.page === declared);
  if (modules === undefined) {
    throw new RexTestingError(`the app has no page modules for page "${pageId}"`);
  }
  const eager = await eagerModules(modules);
  const RegionComponent = eager.regions?.[regionName] as ComponentType<Record<string, unknown>>;
  const isolated = definePageModules({
    ...eager,
    view: view(() => createElement(RegionComponent, props)),
  });
  const setup = prepare(app, pageId, options);
  const RexApp = createRexApp({
    registry: app.registry,
    ...(app.source.manifest === undefined ? {} : { manifest: app.source.manifest }),
    fetch: setup.fetch,
    baseUrl: app.baseUrl,
    queryClient: setup.queryClient,
    density: DensityProvider,
  });
  const tree = createElement(
    RexApp,
    null,
    createElement(
      RexProviders,
      null,
      createElement(RexRoutes, {
        render: (resolution) =>
          resolution.kind === "page" && resolution.page === declared
            ? createElement(
                "div",
                { "data-rex-test-region": `${pageId}/${regionName}` },
                createElement(PageHost, { modules: isolated }),
                createElement(AgentOutcome, { page: pageId }),
              )
            : createElement(NotFound, {
                path: resolution.kind === "page" ? resolution.page.route : resolution.path,
              }),
      }),
    ),
  );
  return mount(app, setup, tree);
}
