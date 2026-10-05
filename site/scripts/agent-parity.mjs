import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../", import.meta.url));
const artifacts = process.env.REX_AGENT_REPORT_DIR ?? "/tmp/rex-agent-parity";
await mkdir(artifacts, { recursive: true });
const child = spawn(process.execPath, ["dist/server.js"], {
  cwd: root,
  env: { ...process.env, NODE_ENV: "production", HOST: "127.0.0.1", PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stderr.on("data", (chunk) => {
  output += chunk;
});
const closed = new Promise((resolve) => child.once("close", resolve));
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Startup timed out: ${output}`)), 30000);
  child.once("error", (error) => {
    clearTimeout(timer);
    reject(error);
  });
  child.once("exit", (code) => {
    clearTimeout(timer);
    reject(new Error(`Server exited ${code}: ${output}`));
  });
  child.stdout.on("data", (chunk) => {
    output += chunk;
    const match = /^rex: serving (http:\/\/[^\s]+)$/m.exec(output);
    if (match !== null) {
      clearTimeout(timer);
      resolve(match[1]);
    }
  });
});
let browser;
const report = { checks: [], errors: [] };
const selector = 'script[type="application/rex+json"]#rex-page';
async function sidecar(page, id) {
  await page.waitForFunction(
    ({ selector, id }) => {
      const element = document.querySelector(selector);
      if (element === null) return false;
      const payload = JSON.parse(element.textContent);
      return (
        payload.page === id &&
        payload.state === "ready" &&
        JSON.stringify(payload) === JSON.stringify(window.__rex)
      );
    },
    { selector, id },
  );
  return page.locator(selector).evaluate((element) => JSON.parse(element.textContent));
}
function observe(page) {
  page.on("pageerror", (error) => report.errors.push({ url: page.url(), message: error.message }));
  page.on("console", (message) => {
    if (message.type() === "error")
      report.errors.push({ url: page.url(), message: message.text() });
  });
}

try {
  const origin = await ready;
  browser = await chromium.launch({ headless: true });
  for (let attempt = 0; attempt < 3; attempt++) {
    const context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    observe(page);
    await page.addInitScript(() => {
      window.agentViolations = [];
      const inspect = () => {
        const elements = document.querySelectorAll('script[type="application/rex+json"]#rex-page');
        if (elements.length === 0) return;
        const payload = JSON.parse(elements[0].textContent);
        if (payload.state !== "ready" || payload.page !== "home") return;
        if (!window.__rex || elements.length !== 1)
          window.agentViolations.push("Ready before browser commit");
        for (const id of ["copy-addresses", "toggle-theme"]) {
          if (!payload.actions.some((entry) => entry.id === id && entry.allowed))
            window.agentViolations.push(`Missing ready action: ${id}`);
          if (!document.querySelector(`[data-rex="home/${id}"]`))
            window.agentViolations.push(`Missing ready control: ${id}`);
        }
      };
      new MutationObserver(inspect).observe(document, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    });
    await page.goto(origin);
    const home = await sidecar(page, "home");
    assert.deepEqual(await page.evaluate(() => window.agentViolations), []);
    assert.deepEqual(
      home.actions.map((entry) => entry.id),
      ["copy-addresses", "toggle-theme"],
    );
    if (attempt === 0) {
      const markdown = await page.request.get(`${origin}/rex/pages/home.md`);
      assert.equal(markdown.status(), 200);
      const body = await markdown.text();
      const textSidecar = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(body)[1]);
      assert.deepEqual(
        textSidecar.actions.map((entry) => entry.id),
        home.actions.map((entry) => entry.id),
      );
      assert.equal(textSidecar.state, "loading");
      for (const id of ["copy-addresses", "toggle-theme"]) {
        assert.ok(body.includes(`home/${id}`));
        assert.ok(!body.includes(`/rex/form/${id}`));
        assert.ok(!body.includes(`act=${id}`));
      }
      await page.locator('[data-rex="home/copy-addresses"]').click();
      await page.waitForFunction(
        () => window.__rex?.outcome?.action === "copy-addresses" && window.__rex.outcome.ok,
      );
      assert.ok(
        (await page.evaluate(() => navigator.clipboard.readText())).includes("home/toggle-theme"),
      );
      const theme = page.locator('[data-rex="home/toggle-theme"]');
      const before = await theme.getAttribute("data-site-theme-toggle");
      await theme.click();
      await expect(theme).toHaveAttribute(
        "data-site-theme-toggle",
        before === "dark" ? "light" : "dark",
      );
      await page.waitForFunction(
        () => window.__rex?.outcome?.action === "toggle-theme" && window.__rex.outcome.ok,
      );
      await page.locator("[data-rex-palette-trigger]").click();
      await page.locator('[data-rex-palette-item="home/toggle-theme"]').click();
      await expect(theme).toHaveAttribute("data-site-theme-toggle", before);
      await page.locator('[data-rex-nav="docs"]:visible').click();
      const docs = await sidecar(page, "docs");
      assert.deepEqual(
        docs.actions.map((entry) => entry.id),
        ["search-docs", "toggle-theme"],
      );
      assert.equal(await page.locator('[data-rex="home/copy-addresses"]').count(), 0);
      const search = page.locator('[data-rex="docs/search-docs"]');
      await search.fill("zzzz-no-page-782364");
      await expect(page.locator("[data-site-search-result]:visible")).toHaveCount(0);
      await search.fill("loader");
      await expect(page.locator('[data-site-search-result="/docs/recipes/loader"]')).toBeVisible();
      await page.waitForFunction(
        () => window.__rex?.outcome?.message === "Searching docs for loader",
      );
      await page.locator("[data-rex-palette-trigger]").click();
      await page.locator('[data-rex-palette-item="docs/search-docs"]').click();
      await expect(search).toBeFocused();
      await page.screenshot({ path: `${artifacts}/docs.png`, fullPage: true });
      await page.locator('[data-site-search-result="/docs/recipes/loader"]').click();
      await page.waitForURL(`${origin}/docs/recipes/loader`);
      const staticPayload = await page
        .locator(selector)
        .evaluate((element) => JSON.parse(element.textContent));
      assert.equal(staticPayload.state, "ready");
      assert.equal(await page.locator("[data-site-theme-toggle]").count(), 0);
      await page.goBack();
      await sidecar(page, "docs");
      report.checks.push(
        "Desktop copy, theme click/palette, addressed search/palette, navigation, static page and text discovery",
      );
    }
    await context.close();
  }
  report.checks.push("Three fresh loads with no premature ready sidecar");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  observe(page);
  await page.goto(`${origin}/?density=agent`);
  const mobile = await sidecar(page, "home");
  assert.equal(mobile.density, "agent");
  for (const id of ["copy-addresses", "toggle-theme"]) {
    const control = page.locator(`[data-rex="home/${id}"]`);
    const box = await control.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44);
    await control.click();
    await page.waitForFunction(
      (id) => window.__rex?.outcome?.action === id && window.__rex.outcome.ok,
      id,
    );
  }
  await page.screenshot({ path: `${artifacts}/mobile.png`, fullPage: true });
  await context.close();
  report.checks.push("Mobile agent-density controls, touch targets and outcomes");
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
  await closed;
  clearTimeout(timer);
  await writeFile(`${artifacts}/report.json`, JSON.stringify(report, null, 2));
}
