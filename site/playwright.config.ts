import { defineConfig, devices } from "@playwright/test";

const DEFAULT_SITE_PORT = 4173;

function sitePort(value: string | undefined): number {
  if (value === undefined) return DEFAULT_SITE_PORT;
  const port = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`REX_SITE_PORT must be an integer from 1 to 65535, received "${value}"`);
  }
  return port;
}

export type SitePhase = "all" | "functional" | "timing";

const SITE_PHASES: readonly SitePhase[] = ["all", "functional", "timing"];
const TIMING_TESTS = /[\\/](?:lighthouse\.ts|vitals\.spec\.ts)$/;
const FUNCTIONAL_TESTS = /^(?!.*[\\/](?:lighthouse\.ts|vitals\.spec\.ts)$)/;

function sitePhase(value: string | undefined): SitePhase {
  if (value === undefined) return "all";
  const phase = SITE_PHASES.find((candidate) => candidate === value);
  if (phase === undefined) {
    throw new Error(`REX_SITE_PHASE must be one of ${SITE_PHASES.join(", ")}, received "${value}"`);
  }
  return phase;
}

export const SITE_PORT = sitePort(process.env.REX_SITE_PORT);
export const SITE_URL = `http://127.0.0.1:${SITE_PORT}`;
export const SITE_PHASE = sitePhase(process.env.REX_SITE_PHASE);

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/*.spec.ts", "**/lighthouse.ts"],
  testIgnore:
    SITE_PHASE === "functional" ? TIMING_TESTS : SITE_PHASE === "timing" ? FUNCTIONAL_TESTS : [],
  fullyParallel: true,
  workers: SITE_PHASE === "timing" ? 1 : "25%",
  retries: 0,
  timeout: 240_000,
  forbidOnly: true,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile:
          SITE_PHASE === "timing" ? "e2e/report/results-timing.json" : "e2e/report/results.json",
      },
    ],
  ],
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
    {
      name: "firefox",
      testMatch: ["**/site.spec.ts"],
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "webkit",
      testMatch: ["**/site.spec.ts"],
      use: {
        ...devices["Desktop Safari"],
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
