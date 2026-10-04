import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ConsoleMessage, Page } from "@playwright/test";

export const DEMO_ROOT = fileURLToPath(new URL("..", import.meta.url));
export const REPORT_DIR = join(DEMO_ROOT, "e2e", "report");
export const SIDECAR_SELECTOR = 'script[type="application/rex+json"]#rex-page';
export const DENSITIES = ["default", "agent"] as const;
export const STEP_TIMEOUT = 15_000;
export const MIN_AGENT_HIT_TARGET = 44;
export const RPC_PREFIX = "/rex/rpc/";
export const FORM_PREFIX = "/rex/form/";
export const TEXT_PREFIX = "/rex/pages/";
export const DEV_AUDIT_PATH = "/rex/dev/audit";

export type Density = (typeof DENSITIES)[number];
export type Route = "click" | "key" | "url" | "palette";

export interface ManifestAction {
  readonly id: string;
  readonly label: string | null;
  readonly effect: "reversible" | "irreversible" | "read";
  readonly shortcut: string | null;
}

export interface ManifestOverlay {
  readonly id: string;
  readonly dismiss: "escape" | "button" | "both";
  readonly binding: "region" | "url";
}

export type RenderMode = "ssr" | "csr" | "ssg" | "static";

export interface ManifestLoader {
  readonly name: string;
  readonly action: string;
}

export interface ManifestPage {
  readonly id: string;
  readonly route: string;
  readonly render: RenderMode;
  readonly loaders: readonly ManifestLoader[];
  readonly actions: readonly string[];
  readonly overlays: readonly ManifestOverlay[];
}

export interface WalkManifest {
  readonly actions: readonly ManifestAction[];
  readonly pages: readonly ManifestPage[];
}

export interface SidecarAction {
  readonly id: string;
  readonly label: string;
  readonly allowed: boolean;
  readonly reason: string | null;
  readonly effect: string;
  readonly via: readonly string[];
}

export interface SidecarPayload {
  readonly version: number;
  readonly page: string;
  readonly state: string;
  readonly actions: readonly SidecarAction[];
  readonly overlays: readonly {
    readonly id: string;
    readonly open: boolean;
    readonly dismiss: string;
  }[];
  readonly outcome: {
    readonly action: string;
    readonly ok: boolean;
    readonly message: string;
    readonly at: string;
  } | null;
}

export interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface PageReport {
  readonly page: string;
  readonly actor: string;
  readonly densities: { readonly density: Density; readonly checks: readonly Check[] }[];
  readonly failures: readonly string[];
}

export function committedManifest(): WalkManifest {
  return JSON.parse(readFileSync(join(DEMO_ROOT, ".rex", "manifest.json"), "utf8")) as WalkManifest;
}

export interface RunningDemo {
  readonly url: string;
  stop(): Promise<void>;
}

export function buildDemo(): void {
  const rex = join(DEMO_ROOT, "node_modules", ".bin", "rex");
  const result = spawnSync(rex, ["build"], { cwd: DEMO_ROOT, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `rex build exited with ${String(result.status)}: ${result.stderr}${result.stdout}`,
    );
  }
}

export function startDemo(env: Readonly<Record<string, string>> = {}): Promise<RunningDemo> {
  const child: ChildProcess = spawn(process.execPath, ["dist/server.js"], {
    cwd: DEMO_ROOT,
    env: { ...process.env, ...env, PORT: "0", HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stop = () =>
    new Promise<void>((done) => {
      if (child.exitCode !== null) {
        done();
        return;
      }
      child.once("exit", () => done());
      child.kill("SIGTERM");
    });
  return new Promise<RunningDemo>((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      void stop();
      reject(new Error(`the demo server did not report its URL: ${output}`));
    }, STEP_TIMEOUT);
    const onData = (chunk: Buffer) => {
      output += chunk.toString("utf8");
      const match = /rex: serving (http:\/\/\S+)/.exec(output);
      if (match?.[1] !== undefined) {
        clearTimeout(timer);
        resolve({ url: match[1], stop });
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`the demo server exited with ${String(code)}: ${output}`));
    });
  });
}

export function writeReport(name: string, report: PageReport): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(join(REPORT_DIR, `${name}.json`), `${JSON.stringify(report, null, 2)}\n`);
}

export function shortcutKeys(shortcut: string): string {
  return shortcut
    .split("+")
    .map((part) => {
      if (part === "mod") return "Control";
      if (part === "shift") return "Shift";
      if (part === "alt") return "Alt";
      if (/^[a-z]$/.test(part)) return `Key${part.toUpperCase()}`;
      if (/^[0-9]$/.test(part)) return `Digit${part}`;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("+");
}

export function pageUrl(base: string, route: string, query: Record<string, string>): string {
  const url = new URL(route, base);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

export class Recorder {
  readonly checks: Check[] = [];

  async check(name: string, run: () => Promise<string | void>): Promise<boolean> {
    try {
      const detail = await run();
      this.checks.push({ name, ok: true, detail: detail ?? "" });
      return true;
    } catch (error) {
      const message = error instanceof Error ? (error.message.split("\n")[0] ?? "") : String(error);
      this.checks.push({ name, ok: false, detail: message });
      return false;
    }
  }

  failures(prefix: string): string[] {
    return this.checks
      .filter((entry) => !entry.ok)
      .map((entry) => `${prefix} ${entry.name}: ${entry.detail}`);
  }
}

function fail(message: string): never {
  throw new Error(message);
}

export interface SidecarReadOptions {
  readonly mirror?: boolean;
}

export function isStaticPage(pageInfo: ManifestPage): boolean {
  return pageInfo.render === "static";
}

export async function waitForSidecar(
  page: Page,
  pageId: string,
  options: SidecarReadOptions = {},
): Promise<SidecarPayload> {
  await page.waitForFunction(
    ([selector, id]) => {
      const found = document.querySelectorAll(selector);
      if (found.length !== 1) return false;
      try {
        const payload = JSON.parse(found[0]?.textContent ?? "") as {
          page?: string;
          state?: string;
        };
        return payload.page === id && payload.state === "ready";
      } catch {
        return false;
      }
    },
    [SIDECAR_SELECTOR, pageId] as const,
    { timeout: STEP_TIMEOUT },
  );
  return readSidecar(page, options);
}

export async function readSidecar(
  page: Page,
  options: SidecarReadOptions = {},
): Promise<SidecarPayload> {
  const read = await page.evaluate((selector) => {
    const found = document.querySelectorAll(selector);
    return {
      count: found.length,
      text: found[0]?.textContent ?? "",
      mirror: JSON.stringify((window as unknown as { __rex?: unknown }).__rex ?? null),
    };
  }, SIDECAR_SELECTOR);
  if (read.count !== 1) fail(`expected exactly one sidecar, found ${read.count}`);
  const payload = JSON.parse(read.text) as SidecarPayload;
  if (options.mirror === false) {
    if (read.mirror !== "null") fail("a zero-JavaScript page set window.__rex");
    return payload;
  }
  if (JSON.stringify(payload) !== read.mirror) fail("window.__rex differs from the sidecar script");
  return payload;
}

export async function presentControls(page: Page, pageId: string): Promise<string[]> {
  return page.evaluate((prefix) => {
    const addresses = new Set<string>();
    for (const element of document.querySelectorAll(`main [data-rex^="${prefix}"]`)) {
      if (element.closest("[data-rex-overlay]") !== null) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      addresses.add(element.getAttribute("data-rex") ?? "");
    }
    return [...addresses].sort();
  }, `${pageId}/`);
}

export async function checkParity(
  page: Page,
  pageId: string,
  options: SidecarReadOptions = {},
): Promise<string> {
  const payload = await readSidecar(page, options);
  const listed = payload.actions.map((entry) => `${pageId}/${entry.id}`).sort();
  const present = await presentControls(page, pageId);
  if (JSON.stringify(listed) !== JSON.stringify(present)) {
    fail(`sidecar lists [${listed.join(", ")}] but the page shows [${present.join(", ")}]`);
  }
  return listed.join(", ");
}

interface OutcomeMark {
  readonly action: string | null;
  readonly at: string | null;
}

export async function outcomeMark(page: Page): Promise<OutcomeMark> {
  return page.evaluate(() => {
    const element = document.querySelector("[data-rex-outcome]");
    return {
      action: element?.getAttribute("data-rex-outcome") ?? null,
      at: element?.getAttribute("data-rex-outcome-at") ?? null,
    };
  });
}

export async function waitForOutcome(
  page: Page,
  actionId: string,
  before: OutcomeMark,
  ok: boolean,
): Promise<string> {
  await page.waitForFunction(
    ([id, previous]) => {
      const element = document.querySelector("[data-rex-outcome]");
      if (element === null || element.getAttribute("data-rex-outcome") !== id) return false;
      return element.getAttribute("data-rex-outcome-at") !== previous;
    },
    [actionId, before.at] as const,
    { timeout: STEP_TIMEOUT },
  );
  const result = await page.evaluate(() => {
    const element = document.querySelector("[data-rex-outcome]");
    return {
      ok: element?.getAttribute("data-rex-outcome-ok") ?? null,
      at: element?.getAttribute("data-rex-outcome-at") ?? null,
      text: element?.textContent ?? "",
    };
  });
  if (result.ok !== String(ok)) fail(`outcome ok is ${String(result.ok)}: ${result.text}`);
  await page.waitForFunction(
    ([id, at]) => {
      const mirror = (
        window as unknown as { __rex?: { outcome?: { action?: string; at?: string } | null } }
      ).__rex;
      return mirror?.outcome?.action === id && mirror.outcome.at === at;
    },
    [actionId, result.at] as const,
    { timeout: STEP_TIMEOUT },
  );
  return result.text;
}

export async function acceptConfirmation(page: Page, address: string): Promise<void> {
  const dialog = page.locator(`[role="alertdialog"][data-rex-confirm="${address}"]`);
  await dialog.waitFor({ state: "visible", timeout: STEP_TIMEOUT });
  await page.locator(`[data-rex-confirm-accept="${address}"]`).click({ timeout: STEP_TIMEOUT });
  await dialog.waitFor({ state: "detached", timeout: STEP_TIMEOUT });
}

export async function blurActive(page: Page): Promise<void> {
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
}

export interface InvokeContext {
  readonly page: Page;
  readonly base: string;
  readonly pageInfo: ManifestPage;
  readonly density: Density;
}

export async function invokeBy(
  context: InvokeContext,
  declared: ManifestAction,
  route: Route,
): Promise<string> {
  const { page, pageInfo, density } = context;
  const address = `${pageInfo.id}/${declared.id}`;
  if (route === "url") {
    await page.goto(pageUrl(context.base, pageInfo.route, { density, act: declared.id }));
    if (declared.effect === "irreversible") await acceptConfirmation(page, address);
    const text = await waitForOutcome(page, declared.id, { action: null, at: null }, true);
    await waitForSidecar(page, pageInfo.id);
    const search = new URL(page.url()).searchParams;
    if (search.has("act")) fail("the act parameter stayed in the URL after invocation");
    return text;
  }
  const before = await outcomeMark(page);
  if (route === "click") {
    await page.locator(`main [data-rex="${address}"]`).click({ timeout: STEP_TIMEOUT });
  } else if (route === "key") {
    if (declared.shortcut === null) fail(`${declared.id} declares no shortcut`);
    await blurActive(page);
    await page.keyboard.press(shortcutKeys(declared.shortcut));
  } else {
    await blurActive(page);
    await page.keyboard.press("Control+k");
    const palette = page.locator("[data-rex-palette]");
    await palette.waitFor({ state: "visible", timeout: STEP_TIMEOUT });
    await palette.locator("input").fill(declared.label ?? declared.id);
    const item = page.locator(`[data-rex-palette-item="${address}"]`);
    if ((await item.getAttribute("data-rex-allowed")) !== "true")
      fail("the palette entry is not allowed");
    await item.click({ timeout: STEP_TIMEOUT });
    await palette.waitFor({ state: "detached", timeout: STEP_TIMEOUT });
  }
  if (declared.effect === "irreversible") await acceptConfirmation(page, address);
  return waitForOutcome(page, declared.id, before, true);
}

export async function overlayOpen(page: Page, overlayId: string): Promise<boolean> {
  const payload = await readSidecar(page);
  const entry = payload.overlays.find((item) => item.id === overlayId);
  if (entry === undefined) fail(`the sidecar does not list overlay ${overlayId}`);
  return entry.open;
}

async function waitOverlayState(page: Page, overlayId: string, open: boolean): Promise<void> {
  await page.waitForFunction(
    ([id, wanted]) => {
      const mirror = (
        window as unknown as { __rex?: { overlays?: { id: string; open: boolean }[] } }
      ).__rex;
      return mirror?.overlays?.some((entry) => entry.id === id && entry.open === wanted) === true;
    },
    [overlayId, open] as const,
    { timeout: STEP_TIMEOUT },
  );
}

export async function openOverlay(page: Page, pageId: string, overlayId: string): Promise<void> {
  const address = `${pageId}/${overlayId}`;
  await page.locator(`[data-rex-overlay-trigger="${address}"]`).click({ timeout: STEP_TIMEOUT });
  await page
    .locator(`[data-rex-overlay="${address}"]`)
    .waitFor({ state: "visible", timeout: STEP_TIMEOUT });
  await waitOverlayState(page, overlayId, true);
}

export async function closedWithFocusBack(
  page: Page,
  pageId: string,
  overlayId: string,
): Promise<void> {
  const address = `${pageId}/${overlayId}`;
  await page
    .locator(`[data-rex-overlay="${address}"]`)
    .waitFor({ state: "detached", timeout: STEP_TIMEOUT });
  await waitOverlayState(page, overlayId, false);
  const focused = await page.evaluate(
    () => document.activeElement?.getAttribute("data-rex-overlay-trigger") ?? null,
  );
  if (focused !== address) fail(`focus returned to ${String(focused)} instead of the opener`);
}

export async function walkOverlay(
  recorder: Recorder,
  page: Page,
  pageId: string,
  overlay: ManifestOverlay,
): Promise<void> {
  const address = `${pageId}/${overlay.id}`;
  if (overlay.dismiss === "escape" || overlay.dismiss === "both") {
    await recorder.check(`overlay ${overlay.id} dismisses by Escape`, async () => {
      await openOverlay(page, pageId, overlay.id);
      await page.keyboard.press("Escape");
      await closedWithFocusBack(page, pageId, overlay.id);
    });
  }
  if (overlay.dismiss === "button" || overlay.dismiss === "both") {
    await recorder.check(`overlay ${overlay.id} dismisses by its control`, async () => {
      await openOverlay(page, pageId, overlay.id);
      await page.locator(`[data-rex-overlay-close="${address}"]`).click({ timeout: STEP_TIMEOUT });
      await closedWithFocusBack(page, pageId, overlay.id);
    });
  }
  await recorder.check(`overlay ${overlay.id} accepts typed input for its choices`, async () => {
    await openOverlay(page, pageId, overlay.id);
    const surface = page.locator(`[data-rex-overlay="${address}"]`);
    const choices = await surface.locator("[data-rex-choice]").evaluateAll((elements) =>
      elements.map((element) => ({
        choice: element.getAttribute("data-rex-choice") ?? "",
        action: element.getAttribute("data-rex") ?? "",
      })),
    );
    const inputs = await surface.locator("input").count();
    if (choices.length === 0) {
      if (inputs === 0) fail("the overlay has neither choices nor a typed input");
      await page.keyboard.press("Escape");
      if (overlay.dismiss === "button") {
        await page
          .locator(`[data-rex-overlay-close="${address}"]`)
          .click({ timeout: STEP_TIMEOUT });
      }
      await closedWithFocusBack(page, pageId, overlay.id);
      return "no choices; typed input present";
    }
    if (inputs === 0) fail("the overlay lists choices without a typed input");
    const target = choices[choices.length - 1];
    if (target === undefined || target.action === "") fail("the choices carry no data-rex address");
    const actionId = target.action.slice(pageId.length + 1);
    const before = await outcomeMark(page);
    await surface.locator("input").first().fill(target.choice);
    await surface.locator("input").first().press("Enter");
    await waitForOutcome(page, actionId, before, true);
    await page
      .locator(`[data-rex-overlay="${address}"]`)
      .waitFor({ state: "detached", timeout: STEP_TIMEOUT });
    await waitOverlayState(page, overlay.id, false);
    return `typed ${target.choice} ran ${actionId}`;
  });
}

export async function checkHitTargets(page: Page, pageId: string): Promise<string> {
  const sizes = await page.evaluate((prefix) => {
    return [...document.querySelectorAll(`main [data-rex^="${prefix}"]`)].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        address: element.getAttribute("data-rex") ?? "",
        width: rect.width,
        height: rect.height,
      };
    });
  }, `${pageId}/`);
  const small = sizes.filter(
    (entry) => entry.width < MIN_AGENT_HIT_TARGET || entry.height < MIN_AGENT_HIT_TARGET,
  );
  if (small.length > 0) {
    fail(
      `controls under 44px: ${small.map((entry) => `${entry.address} ${entry.width}x${entry.height}`).join(", ")}`,
    );
  }
  return `${sizes.length} controls at least 44px`;
}

export interface CspWatch {
  stop(): readonly string[];
}

export function watchCsp(page: Page): CspWatch {
  const violations: string[] = [];
  const onConsole = (message: ConsoleMessage) => {
    const text = message.text();
    if (/Content[- ]Security[- ]Policy/i.test(text)) violations.push(text);
  };
  page.on("console", onConsole);
  return {
    stop() {
      page.off("console", onConsole);
      return violations;
    },
  };
}

export async function fetchDocument(page: Page, base: string, route: string): Promise<string> {
  const response = await page.request.get(new URL(route, base).toString());
  if (!response.ok()) fail(`GET ${route} answered ${response.status()}`);
  return response.text();
}

export function checkStylesheetOrder(html: string): string {
  const body = html.search(/<body[\s>]/);
  if (body < 0) fail("the document has no body");
  const links = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)];
  if (links.length === 0) fail("the document links no stylesheet");
  const late = links.filter((match) => (match.index ?? 0) > body);
  if (late.length > 0) {
    fail(
      `${late.length} stylesheet links follow the start of the body: ${late.map((match) => match[0]).join(" ")}`,
    );
  }
  return `${links.length} stylesheet links precede the body`;
}

export async function checkZeroJs(page: Page): Promise<string> {
  const found = await page.evaluate(() => ({
    modules: document.querySelectorAll('script[type="module"]').length,
    preloads: document.querySelectorAll('link[rel="modulepreload"]').length,
    data: document.querySelectorAll('script[type="application/rex+data"]').length,
    hydration: document.querySelectorAll("[data-rex-ssr]").length,
    scripts: [...document.querySelectorAll("script")]
      .map((element) => element.getAttribute("type") ?? "text/javascript")
      .filter((type) => type !== "application/rex+json"),
  }));
  if (found.modules > 0) fail(`found ${found.modules} module scripts`);
  if (found.preloads > 0) fail(`found ${found.preloads} module preloads`);
  if (found.data > 0) fail("found the dehydrated loader data script");
  if (found.hydration > 0) fail("found the data-rex-ssr hydration marker");
  if (found.scripts.length > 0) fail(`found scripts of type ${found.scripts.join(", ")}`);
  return "no page chunk, hydration or data script";
}

export async function checkForms(
  page: Page,
  pageId: string,
  actionIds: readonly string[],
  requireToken: boolean,
): Promise<string> {
  const forms = await page.evaluate((prefix) => {
    return [...document.querySelectorAll("main form[data-rex-form]")].map((form) => ({
      address: form.getAttribute("data-rex-form") ?? "",
      method: (form.getAttribute("method") ?? "").toLowerCase(),
      action: form.getAttribute("action") ?? "",
      csrf:
        (form.querySelector('input[type="hidden"][name="_csrf"]') as HTMLInputElement | null)
          ?.value ?? null,
      named:
        (form.querySelector('input[type="hidden"][name="_action"]') as HTMLInputElement | null)
          ?.value ?? null,
      submit:
        form
          .querySelector(`button[type="submit"][data-rex^="${prefix}"]`)
          ?.getAttribute("data-rex") ?? null,
    }));
  }, `${pageId}/`);
  for (const form of forms) {
    const actionId = form.address.slice(pageId.length + 1);
    if (!form.address.startsWith(`${pageId}/`))
      fail(`form ${form.address} is not addressed under ${pageId}`);
    if (!actionIds.includes(actionId))
      fail(`form ${form.address} posts an action the page does not declare`);
    if (form.method !== "post") fail(`form ${form.address} uses method ${form.method}`);
    if (form.action !== `${FORM_PREFIX}${actionId}`)
      fail(`form ${form.address} posts to ${form.action}`);
    if (form.named !== actionId) fail(`form ${form.address} names action ${String(form.named)}`);
    if (form.csrf === null) fail(`form ${form.address} has no CSRF field`);
    if (requireToken && form.csrf === "") fail(`form ${form.address} carries an empty CSRF token`);
    if (form.submit !== form.address) fail(`form ${form.address} has no addressed submit control`);
  }
  return forms.map((form) => form.address).join(", ");
}

export async function checkTextRenderer(
  page: Page,
  base: string,
  pageId: string,
  payload: SidecarPayload,
): Promise<string> {
  const response = await page.request.get(new URL(`${TEXT_PREFIX}${pageId}.md`, base).toString());
  if (!response.ok()) fail(`the text renderer answered ${response.status()}`);
  const markdown = await response.text();
  if (!markdown.includes("## Actions")) fail("the markdown has no Actions section");
  const missing = payload.actions.filter(
    (entry) =>
      !markdown.includes(`| \`${entry.id}\` |`) ||
      !markdown.includes(`[data-rex="${pageId}/${entry.id}"]`) ||
      !markdown.includes(`POST ${FORM_PREFIX}${entry.id}`),
  );
  if (missing.length > 0) {
    fail(`the markdown does not list ${missing.map((entry) => entry.id).join(", ")}`);
  }
  return `${payload.actions.length} actions listed`;
}

export interface LoaderRequests {
  stop(): readonly string[];
}

export function watchLoaderRequests(page: Page, pageInfo: ManifestPage): LoaderRequests {
  const actions = new Set(pageInfo.loaders.map((loader) => loader.action));
  const seen: string[] = [];
  const onRequest = (request: { url(): string }) => {
    const path = new URL(request.url()).pathname;
    if (!path.startsWith(RPC_PREFIX)) return;
    if (actions.has(path.slice(RPC_PREFIX.length))) seen.push(path);
  };
  page.on("request", onRequest);
  return {
    stop() {
      page.off("request", onRequest);
      return seen;
    },
  };
}
