import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rexRequire = createRequire(resolve(root, "packages/rex/package.json"));
const siteRequire = createRequire(resolve(root, "site/package.json"));
const { createServer } = await import(pathToFileURL(rexRequire.resolve("vite")).href);
const { default: react } = await import(
  pathToFileURL(rexRequire.resolve("@vitejs/plugin-react")).href
);
const { chromium } = siteRequire("@playwright/test");
const server = await createServer({
  configFile: false,
  root: resolve(root, "packages/rex/src/client/fixtures/navigation-races"),
  plugins: [react()],
  server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const address = server.httpServer.address();
  assert(address && typeof address !== "string");
  for (const command of ["ordinary", "replace", "second", "external", "unmount"]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${address.port}/`);
      await page.locator("#first").waitFor();
      const before = await page.evaluate(() => history.length);
      const result = await page.evaluate(async (command) => {
        if (typeof document.startViewTransition !== "function")
          throw new Error("Native View Transitions unavailable");
        const click = (id) => {
          const button = document.getElementById(id);
          if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing ${id}`);
          button.click();
        };
        click("first");
        click(command);
        const focusAfterCommand = document.activeElement;
        await document.startViewTransition(() => {}).finished;
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        return {
          path: location.pathname,
          history: history.length,
          heading: document.querySelector("h1")?.textContent ?? null,
          focusedHeading: document.activeElement === document.querySelector("h1"),
          announcer: document.querySelector("[data-rex-announcer]")?.textContent ?? null,
          sameFocus: document.activeElement === focusAfterCommand,
        };
      }, command);
      if (command === "unmount") {
        assert.equal(result.path, "/");
        assert.equal(result.history, before);
        assert.equal(result.heading, null);
        assert.equal(result.announcer, null);
        assert.equal(result.sameFocus, true);
      } else {
        const second = command === "second";
        assert.equal(result.path, second ? "/second" : "/ordinary");
        assert.equal(result.history, before + (command === "replace" ? 0 : 1));
        assert.equal(result.heading, second ? "Second" : "Ordinary");
        assert.equal(result.focusedHeading, true);
        assert.equal(result.announcer, second ? "Second" : "Ordinary");
      }
      assert.deepEqual(errors, []);
      console.log(`PASS native transition -> ${command}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
