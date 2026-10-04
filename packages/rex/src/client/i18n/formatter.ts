import { lazyModule } from "../lazy.ts";

export const messageFormatter = lazyModule("rex.i18n-format", "the message formatter", () =>
  import("./format.ts").then((loaded) => loaded.formatMessage),
);
