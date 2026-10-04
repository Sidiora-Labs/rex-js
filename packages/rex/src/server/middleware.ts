import type { RexServerInstaller } from "./app.ts";
import { installSecurityMiddleware } from "./middleware/security.ts";

export const REX_MIDDLEWARE: readonly RexServerInstaller[] = [installSecurityMiddleware];
