import {
  REX_DATA_STATES,
  isRexDataState,
  requiredStateExports,
  type RexDataState,
} from "../../core/states.ts";
import type { AppPage, RexApp } from "../engine.ts";
import { defineRule, finding, type Finding, type SourceLoader } from "../rule.ts";

function declaredStates(sources: SourceLoader, entry: AppPage): readonly RexDataState[] | null {
  if (entry.page === null) return null;
  const declared = sources.pageDeclaration(entry.page.path);
  if (declared === null || declared.unreadable.includes("states")) return null;
  if (declared.states === null) return REX_DATA_STATES;
  return declared.states.map((state) => state.name).filter(isRexDataState);
}

function checkPage(app: RexApp, sources: SourceLoader, entry: AppPage): Finding[] {
  const findings: Finding[] = [];

  if (entry.view !== null) {
    const exports = sources.exports(entry.view.path);
    if (!exports.some((item) => item.name === "default" && !item.typeOnly)) {
      findings.push(
        finding({
          rule: "states/view-default",
          file: entry.view.file,
          message: `view.tsx of page ${entry.id} has no default export`,
          hint: "Export the page layout component as the default export of view.tsx; it is the ready state.",
        }),
      );
    }
  }

  if (entry.page !== null) {
    for (const state of sources.pageDeclaration(entry.page.path)?.states ?? []) {
      if (isRexDataState(state.name)) continue;
      findings.push(
        finding({
          rule: "states/unknown-state",
          file: entry.page.file,
          line: state.line,
          column: state.column,
          message: `page.ts of page ${entry.id} declares the unknown state "${state.name}"`,
          hint: `Declare states from the closed set ${REX_DATA_STATES.join(", ")}.`,
        }),
      );
    }
  }

  const states = declaredStates(sources, entry);
  if (entry.states === null || states === null) return findings;
  const statesFile = entry.states;
  const required = requiredStateExports(states);
  const exports = sources.exports(statesFile.path);
  const components = new Set(exports.filter((item) => !item.typeOnly).map((item) => item.name));
  const declaredList = states.join(", ");

  for (const name of required) {
    if (components.has(name)) continue;
    findings.push(
      finding({
        rule: "states/missing-export",
        file: statesFile.file,
        message: `states.tsx of page ${entry.id} does not export the ${name} component`,
        hint: `Add export function ${name}(props: StateProps) to states.tsx; page.ts declares the states ${declaredList}.`,
      }),
    );
  }
  for (const item of exports) {
    if (required.includes(item.name) && !item.typeOnly) continue;
    const what =
      item.name === "*" ? `a re-export of "${item.from}"` : `the extra export ${item.name}`;
    findings.push(
      finding({
        rule: "states/extra-export",
        file: statesFile.file,
        line: item.line,
        column: item.column,
        message: `states.tsx of page ${entry.id} has ${what}`,
        hint: `states.tsx exports exactly one component per declared non-ready state (${required.join(", ") || "none"}); move anything else into a part.`,
      }),
    );
  }
  return findings;
}

export const statesRule = defineRule({
  id: "states",
  description:
    "Checks that states.tsx exports one component per declared state with no extra exports and that view.tsx has a default export.",
  check({ app, sources }) {
    return app.pages.flatMap((entry) => checkPage(app, sources, entry));
  },
});
