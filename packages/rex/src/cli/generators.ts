import { baseAppPlan } from "./commands/new.ts";
import type { PlannedEntry } from "./commands/make.ts";
import { designxGenerator } from "./gen/designx.ts";
import { i18nGenerator } from "./gen/i18n.ts";

export interface RexNewContext {
  readonly name: string;
}

export interface RexNewGenerator {
  readonly id: string;
  contribute(plan: readonly PlannedEntry[], context: RexNewContext): readonly PlannedEntry[];
}

export const appGenerator: RexNewGenerator = {
  id: "app",
  contribute: (plan, context) => [...plan, ...baseAppPlan(context.name)],
};

export const REX_NEW_GENERATORS: readonly RexNewGenerator[] = [
  appGenerator,
  designxGenerator,
  i18nGenerator,
];

export function runGenerators(
  context: RexNewContext,
  generators: readonly RexNewGenerator[] = REX_NEW_GENERATORS,
): readonly PlannedEntry[] {
  const plan = generators.reduce<readonly PlannedEntry[]>(
    (current, generator) => generator.contribute(current, context),
    [],
  );
  const seen = new Set<string>();
  for (const entry of plan) {
    if (seen.has(entry.path)) {
      throw new Error(`rex new: two generators write ${entry.path}`);
    }
    seen.add(entry.path);
  }
  return plan;
}
