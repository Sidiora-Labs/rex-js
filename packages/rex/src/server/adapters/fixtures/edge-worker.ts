import { action } from "../../../core/action.ts";
import { actor } from "../../../core/actor.ts";
import { page } from "../../../core/page.ts";
import { always } from "../../../core/policy.ts";
import { boolean } from "../../../core/schema.ts";
import { z } from "zod/mini";
import { createRexServer, memoryLedger } from "../../index.ts";
import { createEdgeHandler } from "../edge.ts";

export const EDGE_APP = "edge-test";

const toggleDust = action("toggle-dust", {
  input: z.object({ hide: boolean() }),
  output: z.object({ hide: boolean() }),
  policy: always(),
  effect: "reversible",
  handler: (input) => ({ hide: input.hide }),
});

const portfolio = page("portfolio", {
  route: "/portfolio/:account",
  params: z.object({ account: z.string() }),
  actions: [toggleDust],
});

export const source = { entities: [], actions: [toggleDust], pages: [portfolio], policies: [] };

export default createEdgeHandler(
  createRexServer({
    registry: source,
    ledger: memoryLedger(),
    actor: () => actor({ id: "alice" }),
    app: EDGE_APP,
  }),
);
