import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "@playwright/test";
import {
  REPORT_DIR,
  SITE_ROOT,
  builtManifest,
  checkParity,
  checkTextRenderer,
  checkZeroJs,
  siteStops,
  waitForSidecar,
  watchPage,
  type SiteStop,
} from "./walk.ts";

const stops = siteStops();
const MAX_SCREENSHOT_PIXELS = 32_767;

test("every internal built link and asset resolves", () => {
  execFileSync(process.execPath, ["../tools/site-verify.mjs", "dist/client"], {
    cwd: SITE_ROOT,
    stdio: "pipe",
  });
});

for (const stop of stops) {
  test(`operability, accessibility and screen fit: ${stop.path}`, async ({ page }, info) => {
    const watch = watchPage(page);
    const response = await page.goto(stop.path);
    expect(response?.status()).toBe(200);
    const staticPage = stop.page.render === "static";
    const options = { mirror: !staticPage };
    const sidecar = await waitForSidecar(page, stop.page.id, options);
    await expect(page.locator(`[data-rex-page="${stop.page.id}"]`)).toBeVisible();
    await expect(page.locator("[data-rex-error-code]")).toHaveCount(0);
    await checkParity(page, stop.page.id, options);
    await checkTextRenderer(
      page,
      String(info.project.use.baseURL),
      stop.path,
      stop.page.id,
      sidecar,
    );
    if (staticPage) await checkZeroJs(page);

    const popups = page.locator('[aria-haspopup]:not([aria-haspopup="false"])');
    for (let index = 0; index < (await popups.count()); index++) {
      const trigger = popups.nth(index);
      if (!(await trigger.isVisible()) || !(await trigger.isEnabled())) continue;
      await trigger.click();
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-rex-error-code]")).toHaveCount(0);
    }

    const geometry = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      small: [...document.querySelectorAll<HTMLElement>("[data-rex], [data-rex-nav]")]
        .map((element) => ({
          address: element.dataset.rex ?? element.dataset.rexNav,
          height: element.getBoundingClientRect().height,
        }))
        .filter((entry) => entry.height > 0 && entry.height < 44),
    }));
    expect(geometry.overflow).toBe(false);
    if (info.project.name === "phone") {
      expect(geometry.small).toEqual([]);
      await expect(page.locator('[data-rex-nav-form="dock"]')).toBeVisible();
    }
    if (info.project.name === "desktop") {
      await expect(page.locator('[data-rex-nav-form="sidebar"]')).toBeVisible();
    }
    const accessibility = await new AxeBuilder({ page }).analyze();
    const axeReport = info.outputPath("axe.json");
    writeFileSync(axeReport, JSON.stringify(accessibility));
    await info.attach("axe", { path: axeReport, contentType: "application/json" });
    expect(accessibility.violations).toEqual([]);
    expect(watch.stop()).toEqual([]);
    if (!stop.path.includes("/", 1) || stop.path === "/docs/tutorial") {
      mkdirSync(REPORT_DIR, { recursive: true });
      const size = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      }));
      await page.screenshot({
        path: join(
          REPORT_DIR,
          `${info.project.name}-${stop.path.replaceAll("/", "_") || "home"}.png`,
        ),
        fullPage: true,
        scale: "css",
        clip: {
          x: 0,
          y: 0,
          width: Math.min(size.width, MAX_SCREENSHOT_PIXELS),
          height: Math.min(size.height, MAX_SCREENSHOT_PIXELS),
        },
      });
    }
  });

  if (stop.page.render === "static") {
    test(`content and navigation without JavaScript: ${stop.path}`, async ({ browser }, info) => {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: info.project.use.viewport ?? null,
        isMobile: info.project.use.isMobile ?? false,
        hasTouch: info.project.use.hasTouch ?? false,
      });
      try {
        const page = await context.newPage();
        const watch = watchPage(page, { javaScriptEnabled: false });
        const response = await page.goto(new URL(stop.path, String(info.project.use.baseURL)).href);
        expect(response?.status()).toBe(200);
        await waitForSidecar(page, stop.page.id, { mirror: false });
        await expect(page.locator(`[data-rex-page="${stop.page.id}"]`)).toBeVisible();
        await expect(page.locator("[data-rex-error-code]")).toHaveCount(0);
        await expect(page.locator("main")).toBeVisible();
        expect((await page.locator("main").innerText()).trim().length).toBeGreaterThan(0);
        await checkZeroJs(page);
        const links = page.locator("a[data-rex-nav][href]:visible");
        const current = new URL(page.url()).pathname.replace(/\/$/, "");
        let link: Locator | null = null;
        let destination: URL | null = null;
        let expected: SiteStop | null = null;
        for (let index = 0; index < (await links.count()); index++) {
          const candidate = links.nth(index);
          const href = await candidate.getAttribute("href");
          expect(href).not.toBeNull();
          const target = new URL(href!, page.url());
          const path = target.pathname.replace(/\/$/, "");
          const listed = stops.find((entry) => entry.path.replace(/\/$/, "") === path);
          if (listed === undefined)
            throw new Error(`Unlisted navigation destination: ${target.href}`);
          if (path === current) continue;
          link = candidate;
          destination = target;
          expected = listed;
          break;
        }
        if (link === null || destination === null || expected === null) {
          throw new Error(`No visible navigation link from ${stop.path} to another listed page`);
        }
        const [navigated] = await Promise.all([
          page.waitForNavigation({ waitUntil: "load" }),
          link.click(),
        ]);
        expect(navigated?.status()).toBe(200);
        expect(new URL(page.url()).pathname.replace(/\/$/, "")).toBe(
          destination.pathname.replace(/\/$/, ""),
        );
        await waitForSidecar(page, expected.page.id, { mirror: false });
        await expect(page.locator(`[data-rex-page="${expected.page.id}"]`)).toBeVisible();
        await expect(page.locator("[data-rex-error-code]")).toHaveCount(0);
        await expect(page.locator("main")).toBeVisible();
        expect((await page.locator("main").innerText()).trim().length).toBeGreaterThan(0);
        if (expected.page.render === "static") await checkZeroJs(page);
        expect(watch.stop()).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
}

test("search and palette navigate using static documents", async ({ page }) => {
  const watch = watchPage(page);
  await page.goto("/docs");
  await waitForSidecar(page, "docs");
  const search = page.locator("main input").first();
  await search.fill("loader");
  await expect(page.locator('[data-site-search-result*="loader"]').first()).toBeVisible();
  await page.keyboard.press("Control+k");
  const palette = page.locator("[data-rex-palette]");
  await expect(palette).toBeVisible();
  for (const entry of builtManifest().pages.filter((entry) => !entry.route.includes(":"))) {
    await expect(palette.locator(`[data-rex-palette-page="${entry.id}"]`)).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  expect(watch.stop()).toEqual([]);
});
