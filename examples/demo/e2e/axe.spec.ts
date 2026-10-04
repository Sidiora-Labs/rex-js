import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  DENSITIES,
  buildDemo,
  committedManifest,
  openOverlay,
  pageUrl,
  startDemo,
  waitForSidecar,
  type Density,
  type ManifestPage,
  type RunningDemo,
  type WalkManifest,
} from "./walk.ts";

const committed = committedManifest();
const BLOCKING_IMPACTS: readonly string[] = ["serious", "critical"];

let demo: RunningDemo | null = null;
let served: WalkManifest | null = null;

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

async function blockingViolations(page: Page, scope: string): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((violation) => BLOCKING_IMPACTS.includes(violation.impact ?? ""))
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(" ")).join(" | ");
      return `${scope} ${violation.id} (${violation.impact ?? "unknown"}): ${violation.help} at ${targets}`;
    });
}

async function auditDensity(
  page: Page,
  base: string,
  pageInfo: ManifestPage,
  density: Density,
): Promise<string[]> {
  const found: string[] = [];
  await page.goto(pageUrl(base, pageInfo.route, { density }));
  await waitForSidecar(page, pageInfo.id);
  const attribute = await page.evaluate(() =>
    document.documentElement.getAttribute("data-rex-density"),
  );
  expect(attribute).toBe(density);
  found.push(...(await blockingViolations(page, `[${density}] ${pageInfo.id}`)));

  for (const overlay of pageInfo.overlays) {
    await page.goto(pageUrl(base, pageInfo.route, { density }));
    await waitForSidecar(page, pageInfo.id);
    await openOverlay(page, pageInfo.id, overlay.id);
    found.push(
      ...(await blockingViolations(page, `[${density}] ${pageInfo.id}/${overlay.id}`)),
    );
  }
  return found;
}

test("the served manifest lists the committed pages", () => {
  const { manifest } = running();
  expect(manifest.pages.map((entry) => entry.id)).toEqual(committed.pages.map((entry) => entry.id));
});

for (const listed of committed.pages) {
  test(`axe audit of page ${listed.id} in every density`, async ({ page }) => {
    test.setTimeout(240_000);
    const { base, manifest } = running();
    const pageInfo = manifest.pages.find((entry) => entry.id === listed.id);
    expect(pageInfo).toBeDefined();
    if (pageInfo === undefined) return;
    const violations: string[] = [];
    for (const density of DENSITIES) {
      violations.push(...(await auditDensity(page, base, pageInfo, density)));
    }
    expect(violations).toEqual([]);
  });
}
