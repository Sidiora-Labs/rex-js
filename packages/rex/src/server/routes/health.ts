import type { Hono } from "hono";

export const HEALTH_PATH = "/rex/health";

export function installHealthRoute(app: Hono): void {
  app.get(HEALTH_PATH, (c) => c.json({ status: "ok" }));
}
