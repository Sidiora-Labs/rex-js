import type { Hono } from "hono";
import type { AnyAction } from "../../core/action.ts";
import { RexError } from "../../core/errors.ts";
import type { RexServerOptions, RexServerSetup } from "../app.ts";

declare module "../app.ts" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- an augmentation must repeat the declared type parameter
  interface RexServerOptions<A extends AnyAction> {
    readonly dev?: boolean;
  }
}

export const DEV_AUDIT_PATH = "/rex/dev/audit";
export const DEV_AUDIT_DEFAULT_LIMIT = 50;
export const DEV_AUDIT_MAX_LIMIT = 500;

interface ProcessLike {
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export function isDevServer(options: Pick<RexServerOptions<AnyAction>, "dev">): boolean {
  if (options.dev !== undefined) {
    if (typeof options.dev !== "boolean") {
      throw new RexError("REX400", "createRexServer: dev must be true or false");
    }
    return options.dev;
  }
  const runtime = (globalThis as { readonly process?: ProcessLike }).process;
  return runtime?.env?.NODE_ENV === "development";
}

export function parseAuditLimit(value: string | undefined): number | null {
  if (value === undefined) return DEV_AUDIT_DEFAULT_LIMIT;
  if (!/^\d+$/.test(value)) return null;
  const limit = Number(value);
  return limit >= 1 && limit <= DEV_AUDIT_MAX_LIMIT ? limit : null;
}

export function installDevRoute(app: Hono, setup: RexServerSetup): void {
  if (!isDevServer(setup.options)) return;
  app.get(DEV_AUDIT_PATH, async (c) => {
    const limit = parseAuditLimit(c.req.query("limit"));
    if (limit === null) {
      return c.json(
        {
          code: "BAD_REQUEST",
          message: `limit must be a whole number from 1 to ${DEV_AUDIT_MAX_LIMIT}`,
        },
        400,
      );
    }
    const records = await setup.options.ledger.list();
    return c.json({ records: records.slice(-limit) }, 200, { "cache-control": "no-store" });
  });
}
