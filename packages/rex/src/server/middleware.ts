import { installClientHints } from "./adapters/client-hints.ts";
import type { RexServerInstaller } from "./app.ts";
import { installLoaderRunner } from "./loaders.ts";
import { installCorsMiddleware } from "./middleware/cors.ts";
import { installSecurityMiddleware } from "./middleware/security.ts";
import { installTelemetry } from "./middleware/telemetry.ts";

export const REX_MIDDLEWARE: readonly RexServerInstaller[] = [
  installSecurityMiddleware,
  installTelemetry,
  installLoaderRunner,
  installCorsMiddleware,
  installClientHints,
];
