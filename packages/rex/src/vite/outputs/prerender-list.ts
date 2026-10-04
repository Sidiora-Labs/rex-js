import { writePrerenderList } from "../prerender.ts";
import type { StaticOutput } from "../outputs.ts";

export const prerenderListOutput: StaticOutput = {
  id: "prerender-list",
  applies: () => true,
  write: (context) => [
    {
      file: writePrerenderList(context.outDir, context.prerendered),
      path: null,
      page: null,
      note: null,
    },
  ],
};
