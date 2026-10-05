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
    await page.locator("main").click({ position: { x: 8, y: 8 } });
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
