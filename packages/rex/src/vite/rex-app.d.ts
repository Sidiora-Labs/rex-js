declare module "rex:app" {
  import type { RexAppBundle } from "@sidioralabs/rex/vite";

  export const entities: RexAppBundle["entities"];
  export const actions: RexAppBundle["actions"];
  export const policies: RexAppBundle["policies"];
  export const flows: RexAppBundle["flows"];
  export const pages: RexAppBundle["pages"];
  export const registry: RexAppBundle["registry"];
  export const manifest: RexAppBundle["manifest"];
  export const app: RexAppBundle;
  const bundle: RexAppBundle;
  export default bundle;
}
