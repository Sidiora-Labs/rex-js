import { defineConfig, devices } from "@playwright/test";

export const SITE_PORT = 4173;
export const SITE_URL = `http://127.0.0.1:${SITE_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/*.spec.ts", "**/lighthouse.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  forbidOnly: true,
  reporter: [["list"], ["json", { outputFile: "e2e/report/results.json" }]],
  use: {
    baseURL: SITE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "phone",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 820, height: 1180 },
      },
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: `node ../tools/serve-static.mjs dist/client --port ${SITE_PORT}`,
    url: SITE_URL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
