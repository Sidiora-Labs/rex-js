import ts from "typescript";
import type { AppFile } from "../engine.ts";
import { defineRule, finding, type Finding, type SourceLoader } from "../rule.ts";
import { attributeName } from "./tokens.ts";

export const RAW_HTML_PROP = "dangerouslySetInnerHTML";

export interface UnsafeHtmlSite {
  readonly node: ts.Node;
  readonly element: string | null;
}

function keyText(name: ts.PropertyName | ts.Expression): string | null {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name)
  ) {
    return name.text;
  }
  return null;
}

export function unsafeHtmlSites(source: ts.SourceFile): UnsafeHtmlSite[] {
  const found: UnsafeHtmlSite[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && attributeName(node) === RAW_HTML_PROP) {
      const element = node.parent.parent;
      found.push({ node, element: element.tagName.getText(source) });
    } else if (
      (ts.isPropertyAssignment(node) ||
        ts.isShorthandPropertyAssignment(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isGetAccessorDeclaration(node)) &&
      ts.isObjectLiteralExpression(node.parent) &&
      keyText(node.name) === RAW_HTML_PROP
    ) {
      found.push({ node, element: null });
    } else if (ts.isPropertyAccessExpression(node) && node.name.text === RAW_HTML_PROP) {
      found.push({ node, element: null });
    } else if (
      ts.isElementAccessExpression(node) &&
      keyText(node.argumentExpression) === RAW_HTML_PROP
    ) {
      found.push({ node, element: null });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const HINT =
  "Sanitise the markup and render it with unsafeHtml(html) from @sidioralabs/rex/client, or render the content as React children so it is escaped.";

function checkFile(sources: SourceLoader, file: AppFile): Finding[] {
  const source = sources.load(file.path);
  return unsafeHtmlSites(source).map((site) =>
    finding({
      rule: "security/unsafe-html",
      file: file.file,
      ...sources.location(file.path, site.node),
      message:
        site.element === null
          ? `${RAW_HTML_PROP} is set outside unsafeHtml()`
          : `<${site.element}> sets ${RAW_HTML_PROP} outside unsafeHtml()`,
      hint: HINT,
    }),
  );
}

export const securityRule = defineRule({
  id: "security",
  description:
    "Reports raw HTML rendered through dangerouslySetInnerHTML anywhere but unsafeHtml(), the only sanctioned raw HTML path.",
  check({ app, sources }) {
    return app.files
      .filter((file) => file.role !== "test")
      .flatMap((file) => checkFile(sources, file));
  },
});
