import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import type {
  CLSMetricWithAttribution,
  INPMetricWithAttribution,
  LCPMetricWithAttribution,
} from "web-vitals/attribution";
import {
  REPORT_DIR,
  STEP_TIMEOUT,
  blurActive,
  buildDemo,
  committedManifest,
  invokeBy,
  isStaticPage,
  pageUrl,
  readSidecar,
  startDemo,
  waitForSidecar,
  type ManifestPage,
  type RunningDemo,
  type WalkManifest,
} from "./walk.ts";

const committed = committedManifest();
const THRESHOLDS = { LCP: 2500, CLS: 0.1, INP: 200 } as const;
const INP_DURATION_THRESHOLD = 16;
const DENSITY = "default";

type VitalName = keyof typeof THRESHOLDS;

interface VitalReading {
  readonly value: number;
  readonly rating: string;
  readonly entries: number;
  readonly attribution: Record<string, string | number | null>;
}

type VitalStore = Partial<Record<VitalName, VitalReading>>;

interface VitalsPageReport {
  readonly page: string;
  readonly url: string;
  readonly interactions: readonly string[];
  readonly metrics: VitalStore;
  readonly failures: readonly string[];
}

interface WebVitalsGlobal {
  onLCP(
    report: (metric: LCPMetricWithAttribution) => void,
    opts: { reportAllChanges: boolean },
  ): void;
  onCLS(
    report: (metric: CLSMetricWithAttribution) => void,
    opts: { reportAllChanges: boolean },
  ): void;
  onINP(
    report: (metric: INPMetricWithAttribution) => void,
    opts: { reportAllChanges: boolean; durationThreshold: number },
  ): void;
}

const require = createRequire(import.meta.url);
const ATTRIBUTION_BUILD = readFileSync(
  join(dirname(require.resolve("web-vitals/attribution")), "web-vitals.attribution.iife.js"),
  "utf8",
);

interface FirstInputReading {
  readonly duration: number;
  readonly name: string;
  readonly inputDelay: number;
}

function registerVitals(durationThreshold: number): void {
  const scope = window as unknown as {
    webVitals: WebVitalsGlobal;
    __rexVitals: VitalStore;
    __rexFirstInput: FirstInputReading | null;
  };
  const store: VitalStore = {};
  scope.__rexVitals = store;
  scope.__rexFirstInput = null;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & { processingStart: number })[]) {
      scope.__rexFirstInput ??= {
        duration: entry.duration,
        name: entry.name,
        inputDelay: entry.processingStart - entry.startTime,
      };
    }
  }).observe({ type: "first-input", buffered: true });
  const opts = { reportAllChanges: true };
  scope.webVitals.onLCP((metric) => {
    store.LCP = {
      value: metric.value,
      rating: metric.rating,
      entries: metric.entries.length,
      attribution: {
        target: metric.attribution.target ?? null,
        url: metric.attribution.url ?? null,
        timeToFirstByte: metric.attribution.timeToFirstByte,
        resourceLoadDelay: metric.attribution.resourceLoadDelay,
        resourceLoadDuration: metric.attribution.resourceLoadDuration,
        elementRenderDelay: metric.attribution.elementRenderDelay,
      },
    };
  }, opts);
  scope.webVitals.onCLS((metric) => {
    store.CLS = {
      value: metric.value,
      rating: metric.rating,
      entries: metric.entries.length,
      attribution: {
        largestShiftTarget: metric.attribution.largestShiftTarget ?? null,
        largestShiftValue: metric.attribution.largestShiftValue ?? null,
        loadState: metric.attribution.loadState ?? null,
      },
    };
  }, opts);
  scope.webVitals.onINP(
    (metric) => {
      store.INP = {
        value: metric.value,
        rating: metric.rating,
        entries: metric.entries.length,
        attribution: {
          interactionTarget: metric.attribution.interactionTarget,
          interactionType: metric.attribution.interactionType,
          inputDelay: metric.attribution.inputDelay,
          processingDuration: metric.attribution.processingDuration,
          presentationDelay: metric.attribution.presentationDelay,
          loadState: metric.attribution.loadState,
        },
      };
    },
    { ...opts, durationThreshold },
  );
}

const CLS_SESSION_GAP_MS = 1000;
const CLS_SESSION_LIMIT_MS = 5000;

interface StaticVitalsStore {
  readonly lcp: { value: number; target: string | null; url: string | null }[];
  readonly shifts: { value: number; startTime: number }[];
  readonly events: { duration: number; name: string; interactionId: number }[];
  firstInput: { duration: number; name: string; inputDelay: number } | null;
}

interface NavigationReading {
  readonly timeToFirstByte: number;
  readonly domContentLoaded: number;
  readonly load: number;
}

function registerStaticVitals(durationThreshold: number): void {
  const store: StaticVitalsStore = { lcp: [], shifts: [], events: [], firstInput: null };
  (window as unknown as { __rexStaticVitals: StaticVitalsStore }).__rexStaticVitals = store;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & {
      element?: Element | null;
      url?: string;
    })[]) {
      store.lcp.push({
        value: entry.startTime,
        target: entry.element?.tagName.toLowerCase() ?? null,
        url: entry.url === undefined || entry.url === "" ? null : entry.url,
      });
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & {
      value: number;
      hadRecentInput: boolean;
    })[]) {
      if (!entry.hadRecentInput)
        store.shifts.push({ value: entry.value, startTime: entry.startTime });
    }
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & { interactionId?: number })[]) {
      const interactionId = entry.interactionId ?? 0;
      if (interactionId > 0) {
        store.events.push({ duration: entry.duration, name: entry.name, interactionId });
      }
    }
  }).observe({ type: "event", buffered: true, durationThreshold } as PerformanceObserverInit);
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & { processingStart: number })[]) {
      store.firstInput ??= {
        duration: entry.duration,
        name: entry.name,
        inputDelay: entry.processingStart - entry.startTime,
      };
    }
  }).observe({ type: "first-input", buffered: true });
}

function largestShiftSession(shifts: StaticVitalsStore["shifts"]): number {
  let largest = 0;
  let session = 0;
  let first = 0;
  let previous = 0;
  for (const shift of [...shifts].sort((a, b) => a.startTime - b.startTime)) {
    const continues =
      session > 0 &&
      shift.startTime - previous < CLS_SESSION_GAP_MS &&
      shift.startTime - first < CLS_SESSION_LIMIT_MS;
    if (continues) {
      session += shift.value;
    } else {
      session = shift.value;
      first = shift.startTime;
    }
    previous = shift.startTime;
    largest = Math.max(largest, session);
  }
  return largest;
}

function rated(value: number, good: number, poor: number): string {
  if (value <= good) return "good";
  return value <= poor ? "needs-improvement" : "poor";
}

async function staticVitals(page: Page): Promise<VitalStore> {
  const read = await page.evaluate(() => {
    const store = (window as unknown as { __rexStaticVitals?: StaticVitalsStore })
      .__rexStaticVitals;
    const navigation = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    return {
      store: store === undefined ? null : JSON.parse(JSON.stringify(store)),
      navigation:
        navigation === undefined
          ? null
          : {
              timeToFirstByte: navigation.responseStart,
              domContentLoaded: navigation.domContentLoadedEventEnd,
              load: navigation.loadEventEnd,
            },
    } as { store: StaticVitalsStore | null; navigation: NavigationReading | null };
  });
  const metrics: VitalStore = {};
  if (read.store === null || read.navigation === null) return metrics;
  const { store, navigation } = read;
  const largest = store.lcp.at(-1);
  if (largest !== undefined) {
    metrics.LCP = {
      value: largest.value,
      rating: rated(largest.value, 2500, 4000),
      entries: store.lcp.length,
      attribution: {
        target: largest.target,
        url: largest.url,
        timeToFirstByte: navigation.timeToFirstByte,
        domContentLoaded: navigation.domContentLoaded,
        load: navigation.load,
      },
    };
  }
  const cls = largestShiftSession(store.shifts);
  metrics.CLS = {
    value: cls,
    rating: rated(cls, 0.1, 0.25),
    entries: store.shifts.length,
    attribution: { loadState: navigation.load > 0 ? "complete" : "loading" },
  };
  const durations = store.events.map((entry) => entry.duration);
  if (store.firstInput !== null) durations.push(store.firstInput.duration);
  const inp = durations.length === 0 ? 0 : Math.max(...durations);
  metrics.INP = {
    value: inp,
    rating: rated(inp, 200, 500),
    entries: store.events.length + (store.firstInput === null ? 0 : 1),
    attribution: {
      interactionType: store.firstInput?.name ?? null,
      inputDelay: store.firstInput?.inputDelay ?? null,
      eventsOverThreshold: store.events.length,
    },
  };
  return metrics;
}

let demo: RunningDemo | null = null;
let served: WalkManifest | null = null;
const reports: VitalsPageReport[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  buildDemo();
  demo = await startDemo();
  const response = await request.get(new URL("/rex/manifest", demo.url).toString());
  expect(response.ok()).toBe(true);
  served = (await response.json()) as WalkManifest;
});

test.afterAll(async () => {
  await demo?.stop();
  demo = null;
});

function running(): { readonly base: string; readonly manifest: WalkManifest } {
  if (demo === null || served === null) throw new Error("the demo server is not running");
  return { base: demo.url, manifest: served };
}

function writeVitals(): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  const report = { thresholds: THRESHOLDS, density: DENSITY, pages: reports };
  writeFileSync(join(REPORT_DIR, "vitals.json"), `${JSON.stringify(report, null, 2)}\n`);
}

async function openAndClosePalette(page: Page): Promise<string> {
  await blurActive(page);
  await page.keyboard.press("Control+k");
  const palette = page.locator("[data-rex-palette]");
  await palette.waitFor({ state: "visible", timeout: STEP_TIMEOUT });
  await page.keyboard.press("Escape");
  await palette.waitFor({ state: "detached", timeout: STEP_TIMEOUT });
  return "opened and dismissed the palette";
}

async function typeIntoForm(page: Page): Promise<string> {
  const field = page.locator("main form input:not([type=hidden]), main form textarea").first();
  await field.click({ timeout: STEP_TIMEOUT });
  await page.keyboard.type("ok");
  return "typed into the first form field";
}

async function invokeReversible(
  page: Page,
  base: string,
  manifest: WalkManifest,
  pageInfo: ManifestPage,
): Promise<string | null> {
  const payload = await readSidecar(page);
  const allowed = new Set(
    payload.actions.filter((entry) => entry.allowed).map((entry) => entry.id),
  );
  const declared = pageInfo.actions
    .map((id) => manifest.actions.find((entry) => entry.id === id))
    .find((entry) => entry !== undefined && entry.effect === "reversible" && allowed.has(entry.id));
  if (declared === undefined) return null;
  await invokeBy({ page, base, pageInfo, density: DENSITY }, declared, "click");
  return `invoked ${declared.id} by click`;
}

async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        requestAnimationFrame(() => requestAnimationFrame(() => done()));
      }),
  );
}

async function finalizeVitals(page: Page): Promise<VitalStore> {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  });
  await page.waitForFunction(
    () => {
      const scope = window as unknown as {
        __rexVitals?: VitalStore;
        __rexFirstInput?: FirstInputReading | null;
      };
      const store = scope.__rexVitals;
      const interacted = store?.INP !== undefined || (scope.__rexFirstInput ?? null) !== null;
      return store?.LCP !== undefined && store.CLS !== undefined && interacted;
    },
    undefined,
    { timeout: STEP_TIMEOUT },
  );
  const read = await page.evaluate(() => {
    const scope = window as unknown as {
      __rexVitals: VitalStore;
      __rexFirstInput: FirstInputReading | null;
    };
    return { metrics: scope.__rexVitals, firstInput: scope.__rexFirstInput };
  });
  const metrics: VitalStore = { ...read.metrics };
  if (metrics.INP === undefined && read.firstInput !== null) {
    const value = read.firstInput.duration;
    metrics.INP = {
      value,
      rating: rated(value, 200, 500),
      entries: 1,
      attribution: {
        interactionType: read.firstInput.name,
        inputDelay: read.firstInput.inputDelay,
        source: "first-input",
      },
    };
  }
  return metrics;
}

function judge(metrics: VitalStore): string[] {
  const failures: string[] = [];
  for (const name of Object.keys(THRESHOLDS) as VitalName[]) {
    const reading = metrics[name];
    if (reading === undefined) {
      failures.push(`${name} was not reported`);
      continue;
    }
    if (reading.value > THRESHOLDS[name]) {
      failures.push(`${name} ${String(reading.value)} is above ${String(THRESHOLDS[name])}`);
    }
  }
  if (metrics.INP !== undefined && metrics.INP.entries === 0) {
    failures.push("INP measured no interaction");
  }
  return failures;
}

async function measurePage(
  browser: Browser,
  base: string,
  manifest: WalkManifest,
  pageInfo: ManifestPage,
): Promise<VitalsPageReport> {
  const context = await browser.newContext();
  const url = pageUrl(base, pageInfo.route, { density: DENSITY });
  try {
    const page = await context.newPage();
    if (isStaticPage(pageInfo)) {
      await page.addInitScript({
        content: `;(${registerStaticVitals.toString()})(${String(INP_DURATION_THRESHOLD)});`,
      });
      await page.goto(url);
      await waitForSidecar(page, pageInfo.id, { mirror: false });
      await page.waitForLoadState("load");
      await settleFrames(page);
      const interactions = [await typeIntoForm(page)];
      await settleFrames(page);
      const metrics = await staticVitals(page);
      return { page: pageInfo.id, url, interactions, metrics, failures: judge(metrics) };
    }
    await page.addInitScript({
      content: `${ATTRIBUTION_BUILD}\n;(${registerVitals.toString()})(${String(INP_DURATION_THRESHOLD)});`,
    });
    await page.goto(url);
    await waitForSidecar(page, pageInfo.id);
    const interactions = [await openAndClosePalette(page)];
    const invoked = await invokeReversible(page, base, manifest, pageInfo);
    if (invoked !== null) interactions.push(invoked);
    await settleFrames(page);
    const metrics = await finalizeVitals(page);
    return { page: pageInfo.id, url, interactions, metrics, failures: judge(metrics) };
  } finally {
    await context.close();
  }
}

test("the served manifest lists the committed pages", () => {
  const { manifest } = running();
  expect(manifest.pages.map((entry) => entry.id)).toEqual(committed.pages.map((entry) => entry.id));
});

for (const listed of committed.pages) {
  test(`core web vitals of page ${listed.id}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const { base, manifest } = running();
    const pageInfo = manifest.pages.find((entry) => entry.id === listed.id);
    expect(pageInfo).toBeDefined();
    if (pageInfo === undefined) return;
    const report = await measurePage(browser, base, manifest, pageInfo);
    reports.push(report);
    writeVitals();
    expect(report.failures).toEqual([]);
  });
}
