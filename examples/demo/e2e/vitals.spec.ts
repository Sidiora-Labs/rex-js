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
  onLCP(report: (metric: LCPMetricWithAttribution) => void, opts: { reportAllChanges: boolean }): void;
  onCLS(report: (metric: CLSMetricWithAttribution) => void, opts: { reportAllChanges: boolean }): void;
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

function registerVitals(durationThreshold: number): void {
  const scope = window as unknown as { webVitals: WebVitalsGlobal; __rexVitals: VitalStore };
  const store: VitalStore = {};
  scope.__rexVitals = store;
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

async function invokeReversible(
  page: Page,
  base: string,
  manifest: WalkManifest,
  pageInfo: ManifestPage,
): Promise<string | null> {
  const payload = await readSidecar(page);
  const allowed = new Set(payload.actions.filter((entry) => entry.allowed).map((entry) => entry.id));
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
      const store = (window as unknown as { __rexVitals?: VitalStore }).__rexVitals;
      return store?.LCP !== undefined && store.CLS !== undefined && store.INP !== undefined;
    },
    undefined,
    { timeout: STEP_TIMEOUT },
  );
  return page.evaluate(() => (window as unknown as { __rexVitals: VitalStore }).__rexVitals);
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
