import { action, boolean, can, never, page, text, z } from "../../../index.ts";

export const greet = action("greet", {
  input: z.object({ name: text({ min: 1 }) }),
  output: z.object({ greeting: text() }),
  policy: never(),
  effect: "reversible",
  label: "Greet",
  handler: (input) => ({ greeting: `Hello ${input.name}` }),
});

export default page("basic", {
  route: "/basic/:name",
  params: z.object({ name: text({ min: 1 }), badges: boolean().default(true) }),
  policy: can("view"),
  actions: [greet],
  chrome: { title: "Basic" },
  regions: ["main"],
});
