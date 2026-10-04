import type { RexServerInstaller } from "./app.ts";
import { installFlowRoutes } from "./flow.ts";
import { installDevRoute } from "./routes/dev.ts";
import { installFormRoute } from "./routes/form.ts";
import { installHealthRoute } from "./routes/health.ts";
import { installManifestRoute } from "./routes/manifest.ts";
import { installPagesTextRoute } from "./routes/pages-text.ts";
import { installRenderRoute } from "./routes/render.ts";
import { installRpcRoute } from "./routes/rpc.ts";

export const REX_ROUTES: readonly RexServerInstaller[] = [
  installManifestRoute,
  installHealthRoute,
  installRpcRoute,
  installFlowRoutes,
  installFormRoute,
  installDevRoute,
  installRenderRoute,
  installPagesTextRoute,
];
