import { discoverApp, runRules, type CheckResult } from "../engine.ts";
import { formatFindings } from "../report.ts";
import type { Rule } from "../rule.ts";
import { boundariesRule } from "./boundaries.ts";
import { manifestRule } from "./manifest.ts";
import { namingRule } from "./naming.ts";
import { parityRule } from "./parity.ts";
import { renderRule } from "./render.ts";
import { securityRule } from "./security.ts";
import { statesRule } from "./states.ts";
import { tokensRule } from "./tokens.ts";
import { trapsRule } from "./traps.ts";
import { typecheckRule } from "./typecheck.ts";

export const defaultRules: readonly Rule[] = Object.freeze([
  typecheckRule,
  boundariesRule,
  statesRule,
  parityRule,
  namingRule,
  trapsRule,
  tokensRule,
  manifestRule,
  securityRule,
  renderRule,
]);

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
