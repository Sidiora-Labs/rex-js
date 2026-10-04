import { defineConfig, devices } from "@playwright/test";

const PHONE = { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } };
const TABLET = {
  ...devices["Galaxy Tab S4"],
  isMobile: false,
  viewport: { width: 820, height: 1180 },
};
const DESKTOP = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } };
const EXTERNAL_DEMO_URL = process.env.REX_DEMO_URL;
const SCREEN_SPECS = [
  "**/operability.spec.ts",
  "**/axe.spec.ts",
  "**/vitals.spec.ts",
  "**/screen-fit.spec.ts",
];

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/*.spec.ts", "**/lighthouse.ts"],
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  forbidOnly: true,
  reporter: [["list"]],
  use: {
    ...DESKTOP,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    ...(EXTERNAL_DEMO_URL === undefined ? {} : { baseURL: EXTERNAL_DEMO_URL }),
  },
  projects: [
    { name: "phone", use: PHONE, testMatch: SCREEN_SPECS },
    { name: "tablet", use: TABLET, testMatch: SCREEN_SPECS },
    { name: "desktop", use: DESKTOP },
  ],
});
