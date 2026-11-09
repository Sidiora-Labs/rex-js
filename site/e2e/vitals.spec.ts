import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";
import { siteStops, waitForSidecar } from "./walk.ts";

const require = createRequire(import.meta.url);
const source = readFileSync(
  join(dirname(require.resolve("web-vitals/attribution")), "web-vitals.attribution.iife.js"),
  "utf8",
);

const NON_INTERACTIVE_EXCLUDED =
  'a[href], button, input, select, textarea, summary, label, [role="button"], [role="link"], [tabindex]';

for (const stop of siteStops()) {
  test(`Core Web Vitals: ${stop.path}`, async ({ page, context }, info) => {
    await page.addInitScript({
      content: `${source}\n
      globalThis.webVitals = webVitals;
      globalThis.__siteVitals = {};
      const report = (metric) => { globalThis.__siteVitals[metric.name] = metric.value; };
      webVitals.onLCP(report, { reportAllChanges: true });
      webVitals.onCLS(report, { reportAllChanges: true });
      webVitals.onINP(report, { reportAllChanges: true, durationThreshold: 16 });
    `,
    });
    await page.goto(stop.path);
    await waitForSidecar(page, stop.page.id, { mirror: stop.page.render !== "static" });
    const target = await page.evaluate((selector) => {
      const main = document.querySelector("main");
      if (main === null) return null;
      const box = main.getBoundingClientRect();
      for (let y = box.top + 8; y < Math.min(box.bottom, window.innerHeight) - 8; y += 8) {
        for (let x = box.left + 8; x < box.right - 8; x += 8) {
          const hit = document.elementFromPoint(x, y);
          if (hit !== null && main.contains(hit) && hit.closest(selector) === null) {
            return { x: x - box.left, y: y - box.top };
          }
        }
      }
      return null;
    }, NON_INTERACTIVE_EXCLUDED);
    if (target === null) throw new Error(`No non-interactive point in main on ${stop.path}`);
    await page.locator("main").click({ position: target });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const background = await context.newPage();
    await background.bringToFront();
    await page.waitForFunction(() => {
      const values = (globalThis as unknown as { __siteVitals: Record<string, number> })
        .__siteVitals;
      return ["LCP", "CLS", "INP"].every((name) => Number.isFinite(values[name]));
    });
    const metrics = await page.evaluate(
      () => (globalThis as unknown as { __siteVitals: Record<string, number> }).__siteVitals,
    );
    await info.attach("vitals", {
      body: JSON.stringify({ path: stop.path, metrics }),
      contentType: "application/json",
    });
    expect(metrics.LCP).toBeLessThanOrEqual(2500);
    expect(metrics.CLS).toBeLessThanOrEqual(0.1);
    expect(metrics.INP).toBeLessThanOrEqual(200);
    await background.close();
  });
}
