import { discoverApp, runRules, type CheckResult } from "../engine.ts";
import { DEFAULT_RULE_IDS } from "../catalog.ts";
import { formatFindings } from "../report.ts";
import type { Rule } from "../rule.ts";
import { a11yRule } from "./a11y.ts";
import { boundariesRule } from "./boundaries.ts";
import { formatRule } from "./format.ts";
import { i18nRule } from "./i18n.ts";
import { layoutRule } from "./layout.ts";
import { manifestRule } from "./manifest.ts";
import { mediaRule } from "./media.ts";
import { namingRule } from "./naming.ts";
import { parityRule } from "./parity.ts";
import { renderRule } from "./render.ts";
import { securityRule } from "./security.ts";
import { statesRule } from "./states.ts";
import { tokensRule } from "./tokens.ts";
import { trapsRule } from "./traps.ts";
import { typecheckRule } from "./typecheck.ts";
import { uiRule } from "./ui.ts";

const rulesById = {
  typecheck: typecheckRule,
  boundaries: boundariesRule,
  states: statesRule,
  parity: parityRule,
  naming: namingRule,
  traps: trapsRule,
  tokens: tokensRule,
  manifest: manifestRule,
  security: securityRule,
  a11y: a11yRule,
  render: renderRule,
  i18n: i18nRule,
  media: mediaRule,
  format: formatRule,
  ui: uiRule,
  layout: layoutRule,
} satisfies Record<(typeof DEFAULT_RULE_IDS)[number], Rule>;

export const defaultRules: readonly Rule[] = Object.freeze(
  DEFAULT_RULE_IDS.map((id) => rulesById[id]),
);

export interface RunCheckOptions {
  readonly json?: boolean;
  readonly rules?: readonly Rule[];
}

export interface RunCheckResult extends CheckResult {
  readonly output: string;
}

export async function runCheck(
  root: string,
  options: RunCheckOptions = {},
): Promise<RunCheckResult> {
  const app = discoverApp(root);
  const result = await runRules(app, options.rules ?? defaultRules);
  return Object.freeze({
    ...result,
    output: formatFindings(result.findings, options.json ? "json" : "human"),
  });
}
