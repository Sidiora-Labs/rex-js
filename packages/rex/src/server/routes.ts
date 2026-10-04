import type { RexServerInstaller } from "./app.ts";
import { installFlowRoutes } from "./flow.ts";
import { installDevRoute } from "./routes/dev.ts";
import { installHealthRoute } from "./routes/health.ts";
import { installManifestRoute } from "./routes/manifest.ts";
import { installRpcRoute } from "./routes/rpc.ts";

export const REX_ROUTES: readonly RexServerInstaller[] = [
  installManifestRoute,
  installHealthRoute,
  installRpcRoute,
  installFlowRoutes,
  installDevRoute,
];
