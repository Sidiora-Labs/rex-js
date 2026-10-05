import {
  DECLARATION_KINDS,
  INVOCATION_ROUTES,
  REX_DATA_STATES,
  REX_ERROR_CATALOG,
  type InvocationRoute,
} from "@sidioralabs/rex";
import { DEFAULT_RULE_IDS } from "@sidioralabs/rex/check/catalog";
import { DEFAULT_BUDGETS } from "@sidioralabs/rex/config";
import rexPackage from "@sidioralabs/rex/package.json" with { type: "json" };

export type DeclarationKind = (typeof DECLARATION_KINDS)[number];

export interface RexMeta {
  readonly version: string;
  readonly errorCodes: number;
  readonly checkerRules: number;
  readonly clientBudgetKb: number;
  readonly dataStates: number;
  readonly declarationKinds: DeclarationKind[];
  readonly invocationRoutes: InvocationRoute[];
}

export function readRexMeta(): RexMeta {
  return {
    version: rexPackage.version,
    errorCodes: Object.keys(REX_ERROR_CATALOG).length,
    checkerRules: DEFAULT_RULE_IDS.length,
    clientBudgetKb: DEFAULT_BUDGETS.client,
    dataStates: REX_DATA_STATES.length,
    declarationKinds: [...DECLARATION_KINDS],
    invocationRoutes: [...INVOCATION_ROUTES],
  };
}
