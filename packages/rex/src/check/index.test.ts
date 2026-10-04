import { describe, expect, it } from "vitest";
import * as engine from "./engine.ts";
import * as check from "./index.ts";
import * as report from "./report.ts";
import * as rule from "./rule.ts";
import * as rules from "./rules/index.ts";

const modules = { rule, engine, report, rules } as const;

describe("check index", () => {
  it("re-exports every value of rule, engine, report and rules", () => {
    const expected = Object.values(modules).flatMap((module) => Object.keys(module));
    expect(new Set(expected).size).toBe(expected.length);
    expect(Object.keys(check).sort()).toEqual([...expected].sort());
  });

  it("keeps each export identical to its source module", () => {
    for (const module of Object.values(modules)) {
      for (const [name, value] of Object.entries(module)) {
        expect(check[name as keyof typeof check], name).toBe(value);
      }
    }
  });

  it("exposes the rule, engine, report and rule-set entry points", () => {
    expect(check.defineRule).toBe(rule.defineRule);
    expect(check.finding).toBe(rule.finding);
    expect(check.createSourceLoader).toBe(rule.createSourceLoader);
    expect(check.discoverApp).toBe(engine.discoverApp);
    expect(check.runRules).toBe(engine.runRules);
    expect(check.formatFindings).toBe(report.formatFindings);
    expect(check.defaultRules).toBe(rules.defaultRules);
    expect(check.runCheck).toBe(rules.runCheck);
    expect(check.formatFindings([], "json")).toBe("[]\n");
  });
});
