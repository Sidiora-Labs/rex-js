import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { chromium, expect, test, type Browser } from "@playwright/test";
import lighthouse, { desktopConfig, type Flags, type Result } from "lighthouse";
import {
  REPORT_DIR,
  buildDemo,
  committedManifest,
  pageUrl,
  startDemo,
  type ManifestPage,
  type RunningDemo,
  type WalkManifest,
} from "./walk.ts";

const committed = committedManifest();
const THRESHOLDS = { performance: 90, accessibility: 95 } as const;
const METRIC_AUDITS = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "total-blocking-time",
  "cumulative-layout-shift",
  "speed-index",
] as const;
const DENSITY = "default";

type CategoryName = keyof typeof THRESHOLDS;

interface LighthousePageReport {
  readonly page: string;
  readonly url: string;
  readonly lighthouseVersion: string;
  readonly scores: Record<CategoryName, number | null>;
  readonly metrics: Record<string, number | null>;
  readonly accessibilityFindings: readonly string[];
  readonly runWarnings: readonly string[];
  readonly failures: readonly string[];
}

let demo: RunningDemo | null = null;
let served: WalkManifest | null = null;
let chrome: Browser | null = null;
let debuggingPort = 0;
const reports: LighthousePageReport[] = [];

function freePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  buildDemo();
  demo = await startDemo();
  const response = await request.get(new URL("/rex/manifest", demo.url).toString());
  expect(response.ok()).toBe(true);
  served = (await response.json()) as WalkManifest;
  debuggingPort = await freePort();
  chrome = await chromium.launch({ args: [`--remote-debugging-port=${String(debuggingPort)}`] });
});

test.afterAll(async () => {
  await chrome?.close();
  chrome = null;
  await demo?.stop();
  demo = null;
});

function running(): { readonly base: string; readonly manifest: WalkManifest } {
  if (demo === null || served === null || chrome === null) {
    throw new Error("the demo server or the audited browser is not running");
  }
  return { base: demo.url, manifest: served };
}

function writeLighthouse(): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  const report = { thresholds: THRESHOLDS, formFactor: "desktop", density: DENSITY, pages: reports };
  writeFileSync(join(REPORT_DIR, "lighthouse.json"), `${JSON.stringify(report, null, 2)}\n`);
}

function categoryScore(lhr: Result, name: CategoryName): number | null {
  const score = lhr.categories[name]?.score ?? null;
  return score === null ? null : Math.round(score * 100);
}

function accessibilityFindings(lhr: Result): string[] {
  const category = lhr.categories.accessibility;
  if (category === undefined) return [];
  return category.auditRefs
    .filter((ref) => ref.weight > 0)
    .map((ref) => lhr.audits[ref.id])
    .filter((audit) => audit !== undefined && audit.score !== null && audit.score < 1)
    .map((audit) => `${audit?.id ?? ""}: ${audit?.title ?? ""}`);
}

function judge(lhr: Result, scores: Record<CategoryName, number | null>): string[] {
  const failures: string[] = [];
  if (lhr.runtimeError !== undefined) {
    failures.push(`lighthouse runtime error ${lhr.runtimeError.code}: ${lhr.runtimeError.message}`);
  }
  for (const name of Object.keys(THRESHOLDS) as CategoryName[]) {
    const score = scores[name];
    if (score === null) {
      failures.push(`${name} has no score`);
    } else if (score < THRESHOLDS[name]) {
      failures.push(`${name} ${String(score)} is under ${String(THRESHOLDS[name])}`);
    }
  }
  return failures;
}

async function auditPage(base: string, pageInfo: ManifestPage): Promise<LighthousePageReport> {
  const url = pageUrl(base, pageInfo.route, { density: DENSITY });
  const flags: Flags = {
    port: debuggingPort,
    hostname: "127.0.0.1",
    output: "json",
    logLevel: "error",
    onlyCategories: Object.keys(THRESHOLDS),
  };
  const result = await lighthouse(url, flags, desktopConfig);
  if (result === undefined) throw new Error(`lighthouse returned no result for ${url}`);
  const lhr = result.lhr;
  const scores: Record<CategoryName, number | null> = {
    performance: categoryScore(lhr, "performance"),
    accessibility: categoryScore(lhr, "accessibility"),
  };
  const metrics: Record<string, number | null> = {};
  for (const id of METRIC_AUDITS) metrics[id] = lhr.audits[id]?.numericValue ?? null;
  return {
    page: pageInfo.id,
    url,
    lighthouseVersion: lhr.lighthouseVersion,
    scores,
    metrics,
    accessibilityFindings: accessibilityFindings(lhr),
    runWarnings: lhr.runWarnings,
    failures: judge(lhr, scores),
  };
}

test("the served manifest lists the committed pages", () => {
  const { manifest } = running();
  expect(manifest.pages.map((entry) => entry.id)).toEqual(committed.pages.map((entry) => entry.id));
});

for (const listed of committed.pages) {
  test(`lighthouse scores of page ${listed.id}`, async () => {
    test.setTimeout(240_000);
    const { base, manifest } = running();
    const pageInfo = manifest.pages.find((entry) => entry.id === listed.id);
    expect(pageInfo).toBeDefined();
    if (pageInfo === undefined) return;
    const report = await auditPage(base, pageInfo);
    reports.push(report);
    writeLighthouse();
    expect(report.failures).toEqual([]);
  });
}
