import { createServer } from "node:net";
import { chromium, expect, test } from "@playwright/test";
import lighthouse, { desktopConfig } from "lighthouse";
import { siteStops } from "./walk.ts";

const thresholds = { performance: 95, accessibility: 100, "best-practices": 95, seo: 95 };
const pages = [...new Map(siteStops().map((stop) => [stop.page.id, stop])).values()];

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("No Lighthouse debugging port"));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

for (const stop of pages) {
  test(`Lighthouse: ${stop.page.id}`, async ({ baseURL }, info) => {
    const port = await freePort();
    const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
    try {
      const result = await lighthouse(
        new URL(stop.path, baseURL).href,
        {
          port,
          hostname: "127.0.0.1",
          output: "json",
          logLevel: "error",
          onlyCategories: Object.keys(thresholds),
        },
        info.project.name === "phone" ? undefined : desktopConfig,
      );
      if (result === undefined) throw new Error("Lighthouse returned no result");
      await info.attach("lighthouse", {
        body: JSON.stringify(result.lhr),
        contentType: "application/json",
      });
      expect(result.lhr.runtimeError).toBeUndefined();
      for (const [name, threshold] of Object.entries(thresholds)) {
        const score = result.lhr.categories[name]?.score;
        expect(typeof score, name).toBe("number");
        expect((score ?? 0) * 100, name).toBeGreaterThanOrEqual(threshold);
      }
    } finally {
      await browser.close();
    }
  });
}
