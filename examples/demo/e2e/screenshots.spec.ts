import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  REPORT_DIR,
  STEP_TIMEOUT,
  committedManifest,
  pageUrl,
  startDemo,
  type RunningDemo,
} from "./walk.ts";

const committed = committedManifest();
const SCREENSHOT_DIR = join(REPORT_DIR, "screenshots");
const DESKTOP = { width: 1440, height: 900 } as const;

let demo: RunningDemo | null = null;

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test.beforeAll(async () => {
  demo = await startDemo();
});

test.afterAll(async () => {
  await demo?.stop();
  demo = null;
});

for (const listed of committed.pages) {
  test(`desktop screenshot of page ${listed.id}`, async ({ page }) => {
    if (demo === null) throw new Error("the demo server is not running");
    await page.setViewportSize(DESKTOP);
    await page.goto(pageUrl(demo.url, listed.route, {}));
    await page
      .locator(`main[data-rex-page="${listed.id}"]`)
      .waitFor({ state: "visible", timeout: STEP_TIMEOUT });
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    const path = join(SCREENSHOT_DIR, `${listed.id}.png`);
    const image = await page.screenshot({ path, fullPage: true });
    expect(image.byteLength).toBeGreaterThan(0);
  });
}
