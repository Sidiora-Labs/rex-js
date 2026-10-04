import ts from "typescript";
import type { AppPage, RexApp } from "../engine.ts";
import { defineRule, finding, type Finding, type SourceLoader } from "../rule.ts";

export const STATIC_RENDER = "static";
export const REGION_BINDING = "region";

function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

export function configProperty(call: ts.CallExpression, name: string): ts.Expression | null {
  const config = call.arguments[1];
  if (config === undefined) return null;
  const literal = unwrap(config);
  if (!ts.isObjectLiteralExpression(literal)) return null;
  for (const property of literal.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const key = property.name;
    const text =
      ts.isIdentifier(key) || ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key)
        ? key.text
        : null;
    if (text === name) return unwrap(property.initializer);
  }
  return null;
}

export function stringProperty(call: ts.CallExpression, name: string): string | null {
  const value = configProperty(call, name);
  if (value === null) return null;
  return ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value) ? value.text : null;
}

const HINT_SUFFIX = 'or render the page with "ssg" or "ssr" so it ships JavaScript.';

function checkPage(app: RexApp, sources: SourceLoader, entry: AppPage): Finding[] {
  if (entry.page === null) return [];
  const pageFile = entry.page;
  const call = sources.declarations(pageFile.path).find((declared) => declared.kind === "page");
  if (call === undefined || stringProperty(call.call, "render") !== STATIC_RENDER) return [];
  const declared = sources.pageDeclaration(pageFile.path);
  if (declared === null) return [];
  const findings: Finding[] = [];

  for (const ref of declared.actions) {
    if (ref.source === null || ref.imported === null) continue;
    const action = sources
      .declarations(ref.source)
      .find((candidate) => candidate.kind === "action" && candidate.exportName === ref.imported);
    if (action === undefined) continue;
    const shortcut = stringProperty(action.call, "shortcut");
    if (shortcut === null) continue;
    findings.push(
      finding({
        rule: "render/static-needs-js",
        file: pageFile.file,
        line: ref.line,
        column: ref.column,
        message: `static page "${declared.id}" declares action "${action.id}" with shortcut "${shortcut}", which needs JavaScript (declared in ${app.relative(ref.source)})`,
        hint: `Remove the shortcut from action "${action.id}", ${HINT_SUFFIX}`,
      }),
    );
  }

  for (const overlay of declared.overlays) {
    if (overlay.binding !== REGION_BINDING) continue;
    findings.push(
      finding({
        rule: "render/static-needs-js",
        file: pageFile.file,
        line: overlay.line,
        column: overlay.column,
        message: `static page "${declared.id}" declares overlay "${overlay.id}" bound to region state, which needs JavaScript`,
        hint: `Bind overlay "${overlay.id}" to the URL with binding: "url", ${HINT_SUFFIX}`,
      }),
    );
  }

  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}

export const renderRule = defineRule({
  id: "render",
  description:
    'Reports static pages (render: "static", zero JavaScript) that declare an action with a keyboard shortcut or an overlay bound to region state, both of which need JavaScript.',
  check({ app, sources }) {
    return app.pages.flatMap((entry) => checkPage(app, sources, entry));
  },
});
