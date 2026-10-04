import { expect, test, type Page } from "@playwright/test";
import {
  DENSITIES,
  Recorder,
  STEP_TIMEOUT,
  checkForms,
  checkHitTargets,
  checkParity,
  checkRootDensity,
  checkStylesheetOrder,
  checkTextRenderer,
  checkZeroJs,
  committedManifest,
  fetchDocument,
  invokeBy,
  isStaticPage,
  outcomeMark,
  pageUrl,
  readSidecar,
  rootDensity,
  startDemo,
  waitForOutcome,
  waitForSidecar,
  walkOverlay,
  walkPopups,
  watchCsp,
  watchLoaderRequests,
  writeReport,
  type Density,
  type ManifestPage,
  type PageReport,
  type Route,
  type RunningDemo,
  type WalkManifest,
} from "./walk.ts";

const committed = committedManifest();
const ROUTES: readonly Route[] = ["click", "key", "url", "palette"];

let demo: RunningDemo | null = null;
let served: WalkManifest | null = null;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
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

test("the served manifest lists the committed pages and actions", () => {
  const { manifest } = running();
  expect(manifest.pages.map((entry) => entry.id)).toEqual(committed.pages.map((entry) => entry.id));
  expect(manifest.actions.map((entry) => entry.id)).toEqual(
    committed.actions.map((entry) => entry.id),
  );
});

async function walkDensity(
  page: Page,
  base: string,
  manifest: WalkManifest,
  pageInfo: ManifestPage,
  density: Density,
): Promise<Recorder> {
  const recorder = new Recorder();
  const csp = watchCsp(page);
  const loaderRequests = watchLoaderRequests(page, pageInfo);
  const loaded = await recorder.check("page renders one ready sidecar", async () => {
    await page.goto(pageUrl(base, pageInfo.route, { density }));
    const payload = await waitForSidecar(page, pageInfo.id);
    const listed = payload.actions.map((entry) => entry.id).sort();
    if (JSON.stringify(listed) !== JSON.stringify([...pageInfo.actions].sort())) {
      throw new Error(`sidecar actions [${listed.join(", ")}] differ from the manifest`);
    }
    return `${payload.actions.length} actions, ${payload.overlays.length} overlays`;
  });
  const requested = loaderRequests.stop();
  if (!loaded) {
    csp.stop();
    return recorder;
  }

  if (pageInfo.loaders.length > 0 && pageInfo.render !== "csr") {
    await recorder.check("loaders hydrate from the server render without a request", async () => {
      if (requested.length > 0)
        throw new Error(`the first render requested ${requested.join(", ")}`);
      const seeded = await page.evaluate(
        () => document.querySelectorAll('script[type="application/rex+data"]').length,
      );
      if (seeded !== 1) throw new Error(`found ${seeded} dehydrated loader data scripts`);
      return pageInfo.loaders.map((loader) => `${loader.name} (${loader.action})`).join(", ");
    });
  }
  await recorder.check("stylesheet links precede the first body content", async () =>
    checkStylesheetOrder(
      await fetchDocument(page, base, pageUrl(base, pageInfo.route, { density })),
    ),
  );
  await recorder.check("actions rendered as forms post to the form route", () =>
    checkForms(page, pageInfo.id, pageInfo.actions, false),
  );
  await recorder.check("the text renderer lists every sidecar action", async () =>
    checkTextRenderer(page, base, pageInfo.id, await readSidecar(page)),
  );

  await recorder.check(`root density is ${rootDensity(density)} for ${density}`, () =>
    checkRootDensity(page, density),
  );
  await recorder.check("page, region and outcome landmarks are addressed", async () => {
    const found = await page.evaluate((id) => {
      return {
        page: document.querySelectorAll(`main[data-rex-page="${id}"]`).length,
        regions: [...document.querySelectorAll(`[data-rex-region^="${id}/"]`)].map(
          (element) => element.getAttribute("data-rex-region") ?? "",
        ),
        outcome: document.querySelectorAll(
          '[role="status"][aria-live="polite"][aria-label="Outcome"]',
        ).length,
      };
    }, pageInfo.id);
    if (found.page !== 1) throw new Error(`found ${found.page} page roots`);
    if (found.outcome !== 1) throw new Error(`found ${found.outcome} outcome regions`);
    return found.regions.join(", ");
  });
  await recorder.check("sidecar lists exactly the present controls", () =>
    checkParity(page, pageInfo.id),
  );
  if (density === "agent") {
    await recorder.check("agent density enlarges hit targets", () =>
      checkHitTargets(page, pageInfo.id),
    );
  }
  await walkPopups(recorder, page);

  for (const actionId of pageInfo.actions) {
    const declared = manifest.actions.find((entry) => entry.id === actionId);
    if (declared === undefined) {
      recorder.checks.push({
        name: `action ${actionId}`,
        ok: false,
        detail: "not in the manifest",
      });
      continue;
    }
    for (const route of ROUTES) {
      if (route === "key" && declared.shortcut === null) continue;
      await recorder.check(`${actionId} by ${route}`, () =>
        invokeBy({ page, base, pageInfo, density }, declared, route),
      );
    }
  }

  for (const overlay of pageInfo.overlays) {
    await walkOverlay(recorder, page, pageInfo.id, overlay);
  }

  await recorder.check("sidecar parity holds after the walk", () => checkParity(page, pageInfo.id));
  const violations = csp.stop();
  await recorder.check("the console reports no Content Security Policy violation", async () => {
    if (violations.length > 0) throw new Error(violations.join(" | "));
  });
  return recorder;
}

async function walkStaticDensity(
  page: Page,
  base: string,
  pageInfo: ManifestPage,
  density: Density,
): Promise<Recorder> {
  const recorder = new Recorder();
  const csp = watchCsp(page);
  const loaded = await recorder.check("page serves one ready static sidecar", async () => {
    await page.goto(pageUrl(base, pageInfo.route, { density }));
    const payload = await waitForSidecar(page, pageInfo.id, { mirror: false });
    const listed = payload.actions.map((entry) => entry.id).sort();
    if (JSON.stringify(listed) !== JSON.stringify([...pageInfo.actions].sort())) {
      throw new Error(`sidecar actions [${listed.join(", ")}] differ from the manifest`);
    }
    return `${payload.actions.length} actions as static JSON`;
  });
  if (!loaded) {
    csp.stop();
    return recorder;
  }
  await recorder.check("the page ships zero JavaScript", () => checkZeroJs(page));
  await recorder.check(`root density is ${rootDensity(density)} for ${density}`, () =>
    checkRootDensity(page, density),
  );
  await recorder.check("stylesheet links precede the first body content", async () =>
    checkStylesheetOrder(
      await fetchDocument(page, base, pageUrl(base, pageInfo.route, { density })),
    ),
  );
  await recorder.check("every action renders as a form posting to the form route", async () => {
    const addresses = await checkForms(page, pageInfo.id, pageInfo.actions, true);
    const posted = addresses === "" ? [] : addresses.split(", ").sort();
    const expected = pageInfo.actions.map((id) => `${pageInfo.id}/${id}`).sort();
    if (JSON.stringify(posted) !== JSON.stringify(expected)) {
      throw new Error(
        `forms [${posted.join(", ")}] differ from the actions [${expected.join(", ")}]`,
      );
    }
    return addresses;
  });
  await recorder.check("sidecar lists exactly the present controls", () =>
    checkParity(page, pageInfo.id, { mirror: false }),
  );
  await walkPopups(recorder, page);
  await recorder.check("the text renderer lists every sidecar action", async () =>
    checkTextRenderer(page, base, pageInfo.id, await readSidecar(page, { mirror: false })),
  );
  const violations = csp.stop();
  await recorder.check("the console reports no Content Security Policy violation", async () => {
    if (violations.length > 0) throw new Error(violations.join(" | "));
  });
  return recorder;
}

for (const listed of committed.pages) {
  test(`operability walk of page ${listed.id}`, async ({ page }, info) => {
    test.setTimeout(240_000);
    const { base, manifest } = running();
    const pageInfo = manifest.pages.find((entry) => entry.id === listed.id);
    expect(pageInfo).toBeDefined();
    if (pageInfo === undefined) return;
    const report: PageReport = { page: pageInfo.id, actor: "owner", densities: [], failures: [] };
    const failures: string[] = [];
    for (const density of DENSITIES) {
      const recorder = isStaticPage(pageInfo)
        ? await walkStaticDensity(page, base, pageInfo, density)
        : await walkDensity(page, base, manifest, pageInfo, density);
      report.densities.push({ density, checks: recorder.checks });
      failures.push(...recorder.failures(`[${density}]`));
    }
    writeReport(pageInfo.id, { ...report, failures }, info.project.name);
    expect(failures).toEqual([]);
  });
}

test("a disallowed action is listed with its reason and does not execute", async ({
  browser,
}, info) => {
  test.setTimeout(120_000);
  const { base, manifest } = running();
  const context = await browser.newContext();
  await context.addCookies([{ name: "demo-actor", value: "guest", url: base }]);
  const page = await context.newPage();
  const recorder = new Recorder();
  const guarded = manifest.pages.filter(
    (entry) => entry.actions.length > 0 && !isStaticPage(entry),
  );
  try {
    for (const pageInfo of guarded) {
      await page.goto(pageUrl(base, pageInfo.route, { density: "default" }));
      await waitForSidecar(page, pageInfo.id);
      const payload = await readSidecar(page);
      for (const entry of payload.actions.filter((item) => !item.allowed)) {
        const address = `${pageInfo.id}/${entry.id}`;
        await recorder.check(`${address} is listed as not allowed with a reason`, async () => {
          if (entry.reason === null || entry.reason === "") throw new Error("no reason");
          const control = page.locator(`main [data-rex="${address}"]`);
          if (!(await control.isDisabled())) throw new Error("the control is enabled");
          if ((await control.getAttribute("data-rex-allowed")) !== "false") {
            throw new Error("the control is not marked data-rex-allowed=false");
          }
          return entry.reason;
        });
        await recorder.check(`${address} is disabled in the palette`, async () => {
          const before = await outcomeMark(page);
          await page.keyboard.press("Control+k");
          const item = page.locator(`[data-rex-palette-item="${address}"]`);
          await item.waitFor({ state: "visible", timeout: STEP_TIMEOUT });
          if ((await item.getAttribute("aria-disabled")) !== "true") throw new Error("selectable");
          await item.click({ force: true, timeout: STEP_TIMEOUT });
          await page.keyboard.press("Escape");
          const after = await outcomeMark(page);
          if (after.at !== before.at) throw new Error("selecting it produced an outcome");
        });
        await recorder.check(`${address} by URL reports not allowed without running`, async () => {
          await page.goto(pageUrl(base, pageInfo.route, { density: "default", act: entry.id }));
          const text = await waitForOutcome(page, entry.id, { action: null, at: null }, false);
          if (!text.includes("not allowed")) throw new Error(`outcome reads ${text}`);
          await waitForSidecar(page, pageInfo.id);
          return text;
        });
      }
    }
  } finally {
    await context.close();
  }
  const failures = recorder.failures("[guest]");
  writeReport(
    "guest",
    {
      page: guarded.map((entry) => entry.id).join(","),
      actor: "guest",
      densities: [{ density: "default", checks: recorder.checks }],
      failures,
    },
    info.project.name,
  );
  expect(recorder.checks.length).toBeGreaterThan(0);
  expect(failures).toEqual([]);
});
