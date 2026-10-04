import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  DEV_AUDIT_PATH,
  FORM_PREFIX,
  STEP_TIMEOUT,
  buildDemo,
  pageUrl,
  startDemo,
  type RunningDemo,
} from "./walk.ts";

interface AuditRecord {
  readonly id: string;
  readonly actor: string;
  readonly actionId: string;
  readonly outcome: string;
  readonly effect: string;
}

const DEV_SERVER_ENV = { NODE_ENV: "development" } as const;

let demo: RunningDemo | null = null;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  buildDemo();
  demo = await startDemo(DEV_SERVER_ENV);
});

test.afterAll(async () => {
  await demo?.stop();
  demo = null;
});

function base(): string {
  if (demo === null) throw new Error("the demo server is not running");
  return demo.url;
}

async function withoutJavaScript<T>(browser: Browser, run: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    return await run(await context.newPage());
  } finally {
    await context.close();
  }
}

async function auditRecords(page: Page, actionId: string): Promise<AuditRecord[]> {
  const response = await page.request.get(
    new URL(`${DEV_AUDIT_PATH}?limit=500`, base()).toString(),
  );
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { readonly records: readonly AuditRecord[] };
  return body.records.filter((record) => record.actionId === actionId);
}

async function expectForm(page: Page, address: string, actionId: string): Promise<void> {
  const form = page.locator(`main form[data-rex-form="${address}"]`);
  await form.waitFor({ state: "attached", timeout: STEP_TIMEOUT });
  expect(await form.getAttribute("method")).toBe("post");
  expect(await form.getAttribute("action")).toBe(`${FORM_PREFIX}${actionId}`);
  expect(await form.locator('input[type="hidden"][name="_action"]').getAttribute("value")).toBe(
    actionId,
  );
  expect(await page.locator("script[type=module]").count()).toBe(0);
}

test("the send flow runs without JavaScript and writes its audit record", async ({ browser }) => {
  test.setTimeout(120_000);
  await withoutJavaScript(browser, async (page) => {
    const before = await auditRecords(page, "send");
    await page.goto(pageUrl(base(), "/send", {}));
    await expect(page.locator("[data-demo-summary]")).toHaveText(
      "Send 0.001 (default) ETH to Alice",
    );
    await expectForm(page, "send/send", "send");

    await page.locator('main [data-rex="send/send"]').click({ timeout: STEP_TIMEOUT });
    const confirmation = page.locator('[role="alertdialog"][data-rex-confirm]');
    await confirmation.waitFor({ state: "visible", timeout: STEP_TIMEOUT });
    await expect(confirmation.locator("h1")).toHaveText("Confirm Send");
    expect(await auditRecords(page, "send")).toEqual(before);

    await page.locator("[data-rex-confirm-accept]").click({ timeout: STEP_TIMEOUT });
    await page.waitForURL((url) => url.pathname === "/send", { timeout: STEP_TIMEOUT });
    const outcome = page.locator('[data-rex-outcome="send"]');
    await expect(outcome).toHaveAttribute("data-rex-outcome-ok", "true");
    await expect(page.locator("[data-demo-transfer]")).toContainText("Sent 0.001 ETH to Alice");

    const written = (await auditRecords(page, "send")).filter(
      (record) => !before.some((earlier) => earlier.id === record.id),
    );
    expect(written.map((record) => [record.actor, record.outcome, record.effect])).toEqual([
      ["owner", "ok", "irreversible"],
    ]);
  });
});

test("the static about page posts its form without JavaScript", async ({ browser }) => {
  test.setTimeout(120_000);
  await withoutJavaScript(browser, async (page) => {
    const before = await auditRecords(page, "send-feedback");
    await page.goto(pageUrl(base(), "/about", {}));
    await expectForm(page, "about/send-feedback", "send-feedback");
    expect(
      await page.locator('main form input[type="hidden"][name="_csrf"]').getAttribute("value"),
    ).toMatch(/^[0-9a-f]{64}$/);

    await page.getByLabel("Message").fill("Works without JavaScript");
    await page.locator('main [data-rex="about/send-feedback"]').click({ timeout: STEP_TIMEOUT });
    await page.waitForURL((url) => url.pathname === "/about", { timeout: STEP_TIMEOUT });

    const written = (await auditRecords(page, "send-feedback")).filter(
      (record) => !before.some((earlier) => earlier.id === record.id),
    );
    expect(written.map((record) => [record.actor, record.outcome, record.effect])).toEqual([
      ["owner", "ok", "reversible"],
    ]);
  });
});
