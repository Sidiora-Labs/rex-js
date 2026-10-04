import type { RexServerInstaller } from "./app.ts";
import { installSecurityMiddleware } from "./middleware/security.ts";
import { installTelemetry } from "./middleware/telemetry.ts";

export const REX_MIDDLEWARE: readonly RexServerInstaller[] = [
  installSecurityMiddleware,
  installTelemetry,
];
