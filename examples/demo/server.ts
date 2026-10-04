import { actor, type Actor, type RegistrySnapshot } from "@sidioralabs/rex";
import { createRexServer, memoryLedger, type Ledger } from "@sidioralabs/rex/server";

export const DEMO_ACTOR_COOKIE = "demo-actor";

export const owner: Actor = actor({
  id: "owner",
  roles: ["owner"],
  permissions: ["viewer.read", "wallet.manage", "wallet.send"],
  attributes: { unlocked: true, account: "main" },
});

export const guest: Actor = actor({
  id: "guest",
  roles: ["viewer"],
  permissions: ["viewer.read"],
  attributes: { unlocked: false, account: "main" },
});

export function cookieValue(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function resolveDemoActor(request: Request): Actor {
  return cookieValue(request, DEMO_ACTOR_COOKIE) === "guest" ? guest : owner;
}

export interface DemoApp {
  readonly name: string;
  readonly registry: RegistrySnapshot;
}

export function createDemoServer(app: DemoApp, ledger: Ledger = memoryLedger()) {
  return createRexServer({
    registry: app.registry,
    ledger,
    actor: resolveDemoActor,
    app: app.name,
  });
}
