import type { RexServerInstaller } from "./app.ts";
import { installTelemetry } from "./middleware/telemetry.ts";

export const REX_MIDDLEWARE: readonly RexServerInstaller[] = [installTelemetry];
