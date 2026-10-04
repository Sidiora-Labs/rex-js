import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ComponentType, ReactNode } from "react";
import { createModuleLoader, loadAppBundle, type ModuleLoader } from "../cli/load.ts";
import { actor, anonymousActor, type Actor } from "../core/actor.ts";
import { RexError } from "../core/errors.ts";
import type { AnyPage } from "../core/page.ts";
import type { AnyPolicy } from "../core/policy.ts";
import { REX_DATA_STATES, STATE_EXPORT_NAMES, type RexDataState } from "../core/states.ts";
import { appName } from "../manifest/scan.ts";
import { validateSidecar, type SidecarPayload } from "../manifest/index.ts";
import type { RexAppBundle, RexLoadedPageModules, RexPageModule } from "../vite/app-module.ts";
import { CLIENT_SPECIFIER } from "../vite/virtual.ts";
import { discoverApp, summarize, type AppPage, type CheckResult, type RexApp } from "./engine.ts";
import {
  createSourceLoader,
  finding,
  type Finding,
  type Location,
  type SourceLoader,
} from "./rule.ts";

export const RUNTIME_RULE = "parity/runtime";
export const RUNTIME_ORIGIN = "http://rex.check";
export const GRANTED_ACTOR_ID = "granted";
export const SERVER_SPECIFIER = "@sidioralabs/rex/server";
export const DEFAULT_SETTLE_TIMEOUT_MS = 10_000;

const SETTLE_TICK_MS = 10;
const SETTLE_QUIET_TICKS = 5;

type ClientModule = typeof import("../client/index.ts");
type ServerModule = typeof import("../server/index.ts");
type ReactModule = typeof import("react");
type ReactDomClientModule = typeof import("react-dom/client");
type HappyWindow = import("happy-dom").Window;

export interface RuntimeCheckOptions {
  readonly actors?: readonly Actor[];
  readonly settleTimeoutMs?: number;
}

export interface RuntimeMount {
  readonly page: string;
  readonly actor: string;
  readonly state: RexDataState;
  readonly path: string;
  readonly actions: readonly string[];
  readonly controls: readonly string[];
  readonly nav: readonly string[];
}

export interface RuntimeCheckResult extends CheckResult {
  readonly mounts: readonly RuntimeMount[];
}

export function defaultRuntimeActors(policies: readonly AnyPolicy[]): readonly Actor[] {
  const permissions = [...new Set(policies.flatMap((declared) => declared.permissions))].sort();
  return Object.freeze([
    anonymousActor,
    actor({
      id: GRANTED_ACTOR_ID,
      permissions,
      attributes: { unlocked: true, account: GRANTED_ACTOR_ID },
    }),
  ]);
}

export function runtimeStates(declared: AnyPage, allowed: boolean): readonly RexDataState[] {
  if (!allowed) return Object.freeze(["permission-denied"]);
  return Object.freeze(
    REX_DATA_STATES.filter(
      (state) => state !== "permission-denied" && declared.states.includes(state),
    ),
  );
}

export function isVisibleControl(element: Element): boolean {
  if (!element.isConnected) return false;
  const view = element.ownerDocument.defaultView;
  const own = view?.getComputedStyle(element);
  if (own !== undefined && (own.visibility === "hidden" || own.visibility === "collapse")) {
    return false;
  }
  for (let node: Element | null = element; node !== null; node = node.parentElement) {
    if (node.hasAttribute("hidden") || node.hasAttribute("inert")) return false;
    if (node.getAttribute("aria-hidden") === "true") return false;
    if (node.tagName === "TEMPLATE") return false;
    if (node.tagName === "INPUT" && node.getAttribute("type")?.toLowerCase() === "hidden") {
      return false;
    }
    if (view?.getComputedStyle(node).display === "none") return false;
  }
  return true;
}

interface ControlRead {
  readonly address: string;
  readonly visible: boolean;
  readonly overlay: string | null;
  readonly region: string | null;
  readonly inMain: boolean;
}

function readControls(root: ParentNode): ControlRead[] {
  const found: ControlRead[] = [];
  for (const element of root.querySelectorAll("[data-rex]")) {
    const address = element.getAttribute("data-rex");
    if (address === null || address === "") continue;
    found.push({
      address,
      visible: isVisibleControl(element),
      overlay: element.closest("[data-rex-overlay]")?.getAttribute("data-rex-overlay") ?? null,
      region: element.closest("[data-rex-region]")?.getAttribute("data-rex-region") ?? null,
      inMain: element.closest("main") !== null,
    });
  }
  return found;
}

const NAV_LINK_SELECTOR = "nav [data-rex-nav]";

function readNavLinks(root: ParentNode): string[] {
  const found = new Set<string>();
  for (const element of root.querySelectorAll(NAV_LINK_SELECTOR)) {
    const address = element.getAttribute("data-rex-nav");
    if (address === null || address === "" || !isVisibleControl(element)) continue;
    found.add(address);
  }
  return [...found].sort();
}

export interface ParityGap {
  readonly kind: "missing-control" | "unlisted-control";
  readonly subject: string;
}

export function compareRuntimeParity(
  pageId: string,
  sidecar: SidecarPayload,
  controls: readonly { readonly address: string; readonly visible: boolean; readonly overlay: string | null }[],
  requireControls: boolean,
): readonly ParityGap[] {
  const gaps: ParityGap[] = [];
  const listed = new Set(sidecar.actions.map((entry) => `${pageId}/${entry.id}`));
  const shown = new Set(
    controls
      .filter((control) => control.visible && control.overlay === null)
      .map((control) => control.address),
  );
  if (requireControls) {
    for (const entry of sidecar.actions) {
      if (!entry.via.includes("click")) continue;
      if (!shown.has(`${pageId}/${entry.id}`)) gaps.push({ kind: "missing-control", subject: entry.id });
    }
  }
  const unlisted = new Set<string>();
  for (const control of controls) {
    if (!control.visible || listed.has(control.address)) continue;
    unlisted.add(control.address);
  }
  for (const address of [...unlisted].sort()) gaps.push({ kind: "unlisted-control", subject: address });
  return gaps;
}

const OVERRIDDEN_GLOBALS = new Set([
  "window",
  "self",
  "top",
  "parent",
  "document",
  "navigator",
  "location",
  "history",
  "Event",
  "EventTarget",
  "CustomEvent",
  "UIEvent",
  "FocusEvent",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "InputEvent",
  "PopStateEvent",
  "ErrorEvent",
]);

interface InstalledDom {
  readonly window: HappyWindow;
  uninstall(): Promise<void>;
}

async function loadHappyDom(): Promise<typeof import("happy-dom")> {
  try {
    return await import("happy-dom");
  } catch (error) {
    throw new RexError(
      "REX507",
      `rex check --runtime mounts pages in happy-dom, which could not be loaded (${(error as Error).message}); add it with pnpm add -D happy-dom`,
      { cause: error },
    );
  }
}

async function installDom(): Promise<InstalledDom> {
  const { Window } = await loadHappyDom();
  const window = new Window({ url: `${RUNTIME_ORIGIN}/`, width: 1280, height: 800 });
  const target = globalThis as unknown as Record<string, unknown>;
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const keys = new Set<string>();
  for (
    let owner: object | null = window;
    owner !== null && owner !== Object.prototype;
    owner = Object.getPrototypeOf(owner) as object | null
  ) {
    for (const key of Object.getOwnPropertyNames(owner)) keys.add(key);
  }
  for (const key of [...keys].sort()) {
    if (key === "constructor") continue;
    if (key in target && !OVERRIDDEN_GLOBALS.has(key)) continue;
    let value: unknown;
    try {
      value = Reflect.get(window, key, window);
    } catch {
      continue;
    }
    if (typeof value === "function" && !/^[A-Z]/.test(key)) {
      value = (value as (...args: unknown[]) => unknown).bind(window);
    }
    saved.set(key, Object.getOwnPropertyDescriptor(target, key));
    Object.defineProperty(target, key, { configurable: true, writable: true, value });
  }
  return {
    window,
    async uninstall() {
      for (const [key, descriptor] of saved) {
        if (descriptor === undefined) Reflect.deleteProperty(target, key);
        else Object.defineProperty(target, key, descriptor);
      }
      await window.happyDOM.close();
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Traffic {
  pending: number;
  mutations: number;
  readonly failed: string[];
}

async function settle(traffic: Traffic, timeoutMs: number, label: string): Promise<void> {
  const started = Date.now();
  let quiet = 0;
  let seen = -1;
  while (quiet < SETTLE_QUIET_TICKS) {
    if (Date.now() - started > timeoutMs) {
      throw new RexError("REX507", `${label} did not settle within ${timeoutMs} ms`);
    }
    await sleep(SETTLE_TICK_MS);
    if (traffic.pending === 0 && traffic.mutations === seen) {
      quiet += 1;
    } else {
      quiet = 0;
      seen = traffic.mutations;
    }
  }
}

interface Runtime {
  readonly app: RexApp;
  readonly sources: SourceLoader;
  readonly bundle: RexAppBundle;
  readonly client: ClientModule;
  readonly server: ServerModule;
  readonly react: ReactModule;
  readonly reactDom: ReactDomClientModule;
  readonly settleTimeoutMs: number;
}

interface PageTarget {
  readonly entry: RexPageModule;
  readonly loaded: RexLoadedPageModules;
  readonly routeParams: Readonly<Record<string, string>>;
  readonly search: string;
  readonly href: string;
}

interface MountRead {
  readonly mount: RuntimeMount;
  readonly sidecar: SidecarPayload | null;
  readonly controls: readonly ControlRead[];
  readonly errors: readonly string[];
  readonly failedRequests: readonly string[];
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function mountPage(
  runtime: Runtime,
  dom: InstalledDom,
  target: PageTarget,
  subject: Actor,
  state: RexDataState,
): Promise<MountRead> {
  const { client, server, react, reactDom, bundle } = runtime;
  const declared = target.entry.page;
  const document = dom.window.document as unknown as Document;
  const errors: string[] = [];
  const traffic: Traffic = { pending: 0, mutations: 0, failed: [] };

  client.resetAll();
  dom.window.localStorage.clear();
  dom.window.sessionStorage.clear();
  document.body.innerHTML = "";
  dom.window.history.replaceState(null, "", target.href);

  const handler = server.createRexServer({
    registry: bundle.registry,
    ledger: server.memoryLedger(),
    actor: () => subject,
    app: bundle.name,
  });
  const fetch = async (input: Request | string | URL, init?: RequestInit): Promise<Response> => {
    traffic.pending += 1;
    try {
      const request = input instanceof Request ? input : new Request(input, init);
      const response = await handler.fetch(request);
      if (!response.ok) {
        traffic.failed.push(`${request.method} ${new URL(request.url).pathname} answered ${response.status}`);
      }
      return response;
    } finally {
      traffic.pending -= 1;
    }
  };
  const RexApp = client.createRexApp({
    registry: bundle.registry,
    manifest: bundle.manifest,
    actor: subject,
    baseUrl: RUNTIME_ORIGIN,
    fetch,
    density: client.DensityProvider,
  });
  const modules = client.definePageModules({
    page: declared,
    view: target.loaded.view as ComponentType,
    states: target.loaded.states as never,
    regions: target.loaded.regions as Readonly<Record<string, ComponentType>>,
    overlays: target.loaded.overlays as Readonly<Record<string, ComponentType>>,
  });
  const resolution = client.resolvePage(
    declared,
    target.routeParams,
    target.search,
    subject,
    bundle.registry,
    client.manifestParamsSchema(bundle.manifest, declared),
  );
  const pageModules = new Map(bundle.pages.map((page) => [page.id, page]));
  const navPages = bundle.registry.pages.filter(client.isNavigable);
  const h = react.createElement;

  function ForcedBody(): ReactNode {
    let body: ReactNode;
    if (state === "ready") {
      body = h(modules.view);
    } else {
      const exported = declared.states.includes(state)
        ? ((modules.states as Readonly<Record<string, unknown>>)[STATE_EXPORT_NAMES[state]] as
            | ComponentType<{ params: unknown; retry: () => void; error: Error | null }>
            | undefined)
        : undefined;
      const props = { params: resolution.params, retry: () => {}, error: null };
      body = exported === undefined ? h(client.DefaultState, { ...props, state }) : h(exported, props);
    }
    return h(
      client.PageStatesContext.Provider,
      { value: modules.states as Readonly<Record<string, unknown>> },
      h("main", { "data-rex-page": declared.id }, body),
    );
  }

  function ForcedFrame(): ReactNode {
    const runtimeValue = react.useMemo(
      () => ({ page: declared, params: resolution.params, state, resolution }),
      [],
    );
    return h(
      client.ActiveRouteContext.Provider,
      { value: resolution },
      h(
        client.PageRuntimeContext.Provider,
        { value: runtimeValue },
        h(ForcedShell),
      ),
    );
  }

  function ForcedShell(): ReactNode {
    const manifest = client.useManifest();
    const links = client.useNavLinks(declared, navPages);
    const { screen } = client.useScreen();
    const Frame = client.useShellComponent("Frame");
    const palette = react.useMemo(() => client.paletteTrigger(), []);
    return h(
      "div",
      { "data-rex-shell": "" },
      h(
        Frame,
        { appName: manifest.app.name, links, navForm: client.navFormFor(screen), palette },
        client.SHELL_SLOTS.map(({ id, Component }) =>
          id === "body"
            ? h(ForcedBody, { key: id })
            : h(Component, {
                key: id,
                resolution,
                active: declared,
                modules: pageModules,
                navPages,
                Outcome: client.AgentOutcome,
              }),
        ),
      ),
    );
  }

  const container = document.createElement("div");
  container.id = "root";
  document.body.append(container);
  const observer = new dom.window.MutationObserver(() => {
    traffic.mutations += 1;
  });
  observer.observe(dom.window.document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  const root = reactDom.createRoot(container, {
    onUncaughtError: (error) => errors.push(errorText(error)),
    onCaughtError: (error) => errors.push(errorText(error)),
    onRecoverableError: (error) => errors.push(errorText(error)),
  });
  const label = `page "${declared.id}" as ${subject.id} in ${state}`;
  let sidecar: SidecarPayload | null = null;
  let controls: ControlRead[] = [];
  let nav: string[] = [];
  try {
    root.render(h(RexApp, null, h(client.RexProviders, null, h(ForcedFrame))));
    await settle(traffic, runtime.settleTimeoutMs, label);
    if (errors.length === 0) {
      const validated = validateSidecar(client.readSidecar(document));
      if (validated.valid) {
        sidecar = validated.payload;
      } else {
        errors.push(
          `the sidecar is invalid: ${validated.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`,
        );
      }
      controls = readControls(document);
      nav = readNavLinks(document);
    }
  } catch (error) {
    errors.push(errorText(error));
  } finally {
    root.unmount();
    observer.disconnect();
    await sleep(0);
  }
  return {
    mount: Object.freeze({
      page: declared.id,
      actor: subject.id,
      state,
      path: target.href,
      actions: Object.freeze(sidecar === null ? [] : sidecar.actions.map((entry) => entry.id)),
      nav: Object.freeze(nav),
      controls: Object.freeze(
        [...new Set(controls.filter((control) => control.visible).map((control) => control.address))].sort(),
      ),
    }),
    sidecar,
    controls,
    errors,
    failedRequests: Object.freeze([...new Set(traffic.failed)].sort()),
  };
}

interface Gathered {
  readonly severity: "error" | "warning";
  readonly file: string;
  readonly location: Location;
  readonly message: (contexts: string) => string;
  readonly hint: string;
  readonly contexts: { readonly actor: number; readonly actorId: string; readonly state: RexDataState }[];
}

function describeContexts(contexts: Gathered["contexts"]): string {
  const byActor = new Map<string, { order: number; states: Set<RexDataState> }>();
  for (const context of contexts) {
    const entry = byActor.get(context.actorId) ?? { order: context.actor, states: new Set() };
    entry.states.add(context.state);
    byActor.set(context.actorId, entry);
  }
  return [...byActor.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(
      ([id, entry]) =>
        `as ${id} in ${REX_DATA_STATES.filter((state) => entry.states.has(state)).join(", ")}`,
    )
    .join("; ");
}

function actionLocations(
  app: RexApp,
  sources: SourceLoader,
  entry: AppPage | undefined,
): Map<string, Location> {
  const found = new Map<string, Location>();
  if (entry?.page === null || entry === undefined) return found;
  const declaration = sources.pageDeclaration(entry.page.path);
  if (declaration === null) return found;
  for (const ref of declaration.actions) {
    if (ref.source === null || ref.imported === null) continue;
    if (app.fileAt(ref.source) === undefined) continue;
    const declared = sources
      .declarations(ref.source)
      .find((candidate) => candidate.kind === "action" && candidate.exportName === ref.imported);
    if (declared) found.set(declared.id, { line: ref.line, column: ref.column });
  }
  return found;
}

function pageLocation(sources: SourceLoader, entry: AppPage | undefined): Location {
  if (entry?.page == null) return { line: 1, column: 1 };
  const declaration = sources.pageDeclaration(entry.page.path);
  return declaration === null
    ? { line: 1, column: 1 }
    : { line: declaration.line, column: declaration.column };
}

function pageFile(app: RexApp, pageId: string, entry: AppPage | undefined): string {
  if (entry?.page != null) return entry.page.file;
  return app.relative(path.join(app.appDir, "pages", pageId, "page.ts"));
}

function controlFile(
  app: RexApp,
  pageId: string,
  entry: AppPage | undefined,
  control: ControlRead,
  state: RexDataState,
): string {
  const prefix = `${pageId}/`;
  if (entry !== undefined && control.overlay?.startsWith(prefix)) {
    const name = control.overlay.slice(prefix.length);
    const file = entry.overlays.find((candidate) => candidate.name === name);
    if (file) return file.file;
  }
  if (entry !== undefined && control.region?.startsWith(prefix)) {
    const name = control.region.slice(prefix.length);
    const file = entry.regions.find((candidate) => candidate.name === name)?.file;
    if (file) return file.file;
  }
  if (entry !== undefined && control.inMain) {
    const file = state === "ready" ? entry.view : entry.states;
    if (file) return file.file;
  }
  return pageFile(app, pageId, entry);
}

async function pageTarget(
  runtime: Runtime,
  entry: RexPageModule,
): Promise<{ readonly target: PageTarget } | { readonly problem: string }> {
  const declared = entry.page;
  let params: unknown = {};
  if (declared.paths !== null) {
    const listed = await declared.paths();
    if (listed.length === 0) return { problem: "its paths() returned no params" };
    params = listed[0];
  }
  const href = runtime.client.pageHref(
    declared,
    params,
    {},
    runtime.client.manifestParamsSchema(runtime.bundle.manifest, declared),
  );
  if (!href.ok) {
    return {
      problem: `it needs params (${href.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}) and paths() does not supply them`,
    };
  }
  const values = (params ?? {}) as Readonly<Record<string, unknown>>;
  const routeParams: Record<string, string> = {};
  for (const name of declared.routeParams) {
    const value = values[name];
    routeParams[name] = typeof value === "string" ? value : JSON.stringify(value);
  }
  const query = href.href.indexOf("?");
  return {
    target: {
      entry,
      loaded: await entry.load(),
      routeParams,
      search: query === -1 ? "" : href.href.slice(query + 1),
      href: href.href,
    },
  };
}

async function inspect(
  runtime: Runtime,
  dom: InstalledDom,
  actors: readonly Actor[],
): Promise<RuntimeCheckResult> {
  const { app, sources, bundle, client } = runtime;
  const gathered = new Map<string, Gathered>();
  const extra: Finding[] = [];
  const mounts: RuntimeMount[] = [];
  const gather = (
    key: string,
    seed: Omit<Gathered, "contexts">,
    context: Gathered["contexts"][number],
  ) => {
    const existing = gathered.get(key) ?? { ...seed, contexts: [] };
    existing.contexts.push(context);
    gathered.set(key, existing);
  };

  for (const entry of bundle.pages) {
    const declared = entry.page;
    const appPage = app.pageOf(declared.id);
    const file = pageFile(app, declared.id, appPage);
    const resolved = await pageTarget(runtime, entry);
    if ("problem" in resolved) {
      extra.push(
        finding({
          rule: RUNTIME_RULE,
          severity: "warning",
          file,
          ...pageLocation(sources, appPage),
          message: `page "${declared.id}" was not mounted: ${resolved.problem}`,
          hint: "Give the page a paths() function returning sample params so rex check --runtime can mount it.",
        }),
      );
      continue;
    }
    const locations = actionLocations(app, sources, appPage);
    for (const [actorIndex, subject] of actors.entries()) {
      const allowed = client.resolvePage(
        declared,
        resolved.target.routeParams,
        "",
        subject,
        bundle.registry,
        client.manifestParamsSchema(bundle.manifest, declared),
      ).policy.allowed;
      for (const state of runtimeStates(declared, allowed)) {
        const read = await mountPage(runtime, dom, resolved.target, subject, state);
        mounts.push(read.mount);
        const context = { actor: actorIndex, actorId: subject.id, state };
        for (const message of read.errors) {
          gather(
            `error|${declared.id}|${message}`,
            {
              severity: "error",
              file,
              location: pageLocation(sources, appPage),
              message: (contexts) => `page "${declared.id}" failed to mount (${contexts}): ${message}`,
              hint: "Fix the error so the page renders in every declared state; rex check --runtime mounts it in happy-dom.",
            },
            context,
          );
        }
        if (read.sidecar === null) continue;
        const dataFailed = read.failedRequests.length > 0;
        if (dataFailed && state === "ready") {
          gather(
            `requests|${declared.id}|${read.failedRequests.join(",")}`,
            {
              severity: "warning",
              file,
              location: pageLocation(sources, appPage),
              message: (contexts) =>
                `page "${declared.id}" could not load its data (${contexts}): ${read.failedRequests.join(", ")}; sidecar actions were not compared with visible controls`,
              hint: "Pass actors the app's read actions serve (runRuntimeCheck actors option), or make the read actions answer for every actor that may open the page.",
            },
            context,
          );
        }
        const gaps = compareRuntimeParity(
          declared.id,
          read.sidecar,
          read.controls,
          state === "ready" && !dataFailed,
        );
        for (const gap of gaps) {
          if (gap.kind === "missing-control") {
            const address = `${declared.id}/${gap.subject}`;
            gather(
              `missing|${declared.id}|${gap.subject}`,
              {
                severity: "error",
                file,
                location: locations.get(gap.subject) ?? pageLocation(sources, appPage),
                message: (contexts) =>
                  `the sidecar of page "${declared.id}" lists action "${gap.subject}" but no visible control carries data-rex="${address}" (${contexts})`,
                hint: "Render the action's control in a region with act(action).controlProps so humans see what agents are offered, or remove the action from page.ts actions.",
              },
              context,
            );
          } else {
            const control = read.controls.find(
              (candidate) => candidate.visible && candidate.address === gap.subject,
            ) as ControlRead;
            const owner = controlFile(app, declared.id, appPage, control, state);
            gather(
              `unlisted|${declared.id}|${owner}|${gap.subject}`,
              {
                severity: "error",
                file: owner,
                location: { line: 1, column: 1 },
                message: (contexts) =>
                  `the control data-rex="${gap.subject}" on page "${declared.id}" has no entry in the sidecar (${contexts})`,
                hint: "Address controls only through act(action).controlProps for an action page.ts declares, or register the affordance so the sidecar lists it.",
              },
              context,
            );
          }
        }
      }
    }
  }

  const findings: Finding[] = [...extra];
  for (const entry of gathered.values()) {
    findings.push(
      finding({
        rule: RUNTIME_RULE,
        severity: entry.severity,
        file: entry.file,
        line: entry.location.line,
        column: entry.location.column,
        message: entry.message(describeContexts(entry.contexts)),
        hint: entry.hint,
      }),
    );
  }
  return Object.freeze({ ...summarize(findings), mounts: Object.freeze(mounts) });
}

async function loadExternal<T>(
  loader: ModuleLoader,
  specifier: string,
  from: string,
): Promise<T> {
  const container = loader.vite.environments.ssr.pluginContainer;
  const importer = await container.resolveId(from, path.join(loader.root, "index.html"));
  if (importer === null) throw new RexError("REX507", `runRuntimeCheck: cannot resolve ${from}`);
  const resolved = await container.resolveId(specifier, importer.id);
  if (resolved === null || !path.isAbsolute(resolved.id)) {
    throw new RexError("REX507", `runRuntimeCheck: cannot resolve ${specifier} from ${importer.id}`);
  }
  const loaded = (await import(pathToFileURL(resolved.id).href)) as T & { readonly default?: T };
  return loaded.default ?? loaded;
}

export async function runRuntimeCheck(
  root: string,
  options: RuntimeCheckOptions = {},
): Promise<RuntimeCheckResult> {
  const appRoot = path.resolve(root);
  const app = discoverApp(appRoot);
  const sources = createSourceLoader();
  const loader: ModuleLoader = await createModuleLoader(appRoot, {
    rex: { name: appName(appRoot) },
  });
  let dom: InstalledDom | null = null;
  try {
    dom = await installDom();
    const bundle = await loadAppBundle(loader);
    const runtime: Runtime = {
      app,
      sources,
      bundle,
      client: await loader.load<ClientModule>(CLIENT_SPECIFIER),
      server: await loader.load<ServerModule>(SERVER_SPECIFIER),
      react: await loadExternal<ReactModule>(loader, "react", CLIENT_SPECIFIER),
      reactDom: await loadExternal<ReactDomClientModule>(
        loader,
        "react-dom/client",
        CLIENT_SPECIFIER,
      ),
      settleTimeoutMs: options.settleTimeoutMs ?? DEFAULT_SETTLE_TIMEOUT_MS,
    };
    const actors = options.actors ?? defaultRuntimeActors(bundle.policies);
    const ids = actors.map((subject) => subject.id);
    if (actors.length === 0) {
      throw new RexError("REX507", "runRuntimeCheck: at least one actor is required");
    }
    if (new Set(ids).size !== ids.length) {
      throw new RexError("REX507", `runRuntimeCheck: actor ids must be unique, got ${ids.join(", ")}`);
    }
    return await inspect(runtime, dom, actors);
  } finally {
    if (dom !== null) await dom.uninstall();
    await loader.close();
  }
}
