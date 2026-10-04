import ts from "typescript";
import type { AppFile } from "../engine.ts";
import { defineRule, finding, type Finding, type SourceLoader } from "../rule.ts";
import { jsxAttributes, jsxElements } from "./tokens.ts";

export const A11Y_RULES = [
  "img-alt",
  "control-name",
  "label-for",
  "heading-order",
  "no-positive-tabindex",
  "no-autofocus-outside-overlay",
] as const;

export type A11yRuleCode = (typeof A11Y_RULES)[number];

const NAME_ATTRIBUTES = ["aria-label", "aria-labelledby", "title"];
const NAMED_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "radio",
  "switch",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "treeitem",
]);
const FIELD_TAGS = new Set(["input", "select", "textarea"]);
const UNLABELLED_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "image"]);
const HEADING_TAG = /^h([1-6])$/;

type Attributes = Map<string, ts.JsxAttribute>;

function tagName(element: ts.JsxOpeningLikeElement): string {
  return element.tagName.getText();
}

function isIntrinsic(tag: string): boolean {
  return /^[a-z][a-z0-9]*$/.test(tag);
}

function hasSpread(element: ts.JsxOpeningLikeElement): boolean {
  return element.attributes.properties.some((property) => ts.isJsxSpreadAttribute(property));
}

function staticText(attribute: ts.JsxAttribute | undefined): string | null {
  const initializer = attribute?.initializer;
  if (initializer === undefined) return null;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (ts.isJsxExpression(initializer) && initializer.expression !== undefined) {
    const expression = initializer.expression;
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      return expression.text;
    }
  }
  return null;
}

function hasValue(attribute: ts.JsxAttribute | undefined): boolean {
  if (attribute === undefined || attribute.initializer === undefined) return false;
  const text = staticText(attribute);
  if (text !== null) return text.trim().length > 0;
  const initializer = attribute.initializer;
  return ts.isJsxExpression(initializer) && initializer.expression !== undefined;
}

function isLiteralFalse(attribute: ts.JsxAttribute): boolean {
  const initializer = attribute.initializer;
  if (initializer === undefined) return false;
  if (ts.isStringLiteral(initializer)) return initializer.text === "false";
  return (
    ts.isJsxExpression(initializer) &&
    initializer.expression !== undefined &&
    initializer.expression.kind === ts.SyntaxKind.FalseKeyword
  );
}

function isLiteralTrue(attribute: ts.JsxAttribute | undefined): boolean {
  if (attribute === undefined) return false;
  if (attribute.initializer === undefined) return true;
  if (staticText(attribute) === "true") return true;
  const initializer = attribute.initializer;
  return (
    ts.isJsxExpression(initializer) &&
    initializer.expression !== undefined &&
    initializer.expression.kind === ts.SyntaxKind.TrueKeyword
  );
}

function hasNameAttribute(attributes: Attributes): boolean {
  return NAME_ATTRIBUTES.some((name) => hasValue(attributes.get(name)));
}

function attributeKey(
  attribute: ts.JsxAttribute | undefined,
  source: ts.SourceFile,
): string | null {
  const initializer = attribute?.initializer;
  if (initializer === undefined) return null;
  const text = staticText(attribute);
  if (text !== null) return `"${text}"`;
  if (ts.isJsxExpression(initializer) && initializer.expression !== undefined) {
    return initializer.expression.getText(source);
  }
  return null;
}

function numericValue(attribute: ts.JsxAttribute): number | null {
  const text = staticText(attribute);
  if (text !== null) {
    const value = Number(text.trim());
    return text.trim() === "" || Number.isNaN(value) ? null : value;
  }
  const initializer = attribute.initializer;
  if (initializer === undefined || !ts.isJsxExpression(initializer)) return null;
  let expression = initializer.expression;
  if (expression === undefined) return null;
  let sign = 1;
  while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
  if (
    ts.isPrefixUnaryExpression(expression) &&
    (expression.operator === ts.SyntaxKind.MinusToken ||
      expression.operator === ts.SyntaxKind.PlusToken)
  ) {
    if (expression.operator === ts.SyntaxKind.MinusToken) sign = -1;
    expression = expression.operand;
  }
  if (ts.isNumericLiteral(expression)) return sign * Number(expression.text);
  return null;
}

function openingOf(node: ts.JsxChild): ts.JsxOpeningLikeElement | null {
  if (ts.isJsxElement(node)) return node.openingElement;
  if (ts.isJsxSelfClosingElement(node)) return node;
  return null;
}

function childrenOf(element: ts.JsxOpeningLikeElement): readonly ts.JsxChild[] {
  if (ts.isJsxSelfClosingElement(element)) return [];
  const parent = element.parent;
  return ts.isJsxElement(parent) ? parent.children : [];
}

function childHasName(child: ts.JsxChild): boolean {
  if (ts.isJsxText(child)) return child.text.trim().length > 0;
  if (ts.isJsxExpression(child)) return child.expression !== undefined;
  if (ts.isJsxFragment(child)) return child.children.some(childHasName);
  const opening = openingOf(child);
  if (opening === null) return false;
  const tag = tagName(opening);
  if (!isIntrinsic(tag) || hasSpread(opening)) return true;
  const attributes = jsxAttributes(opening);
  if (isLiteralTrue(attributes.get("aria-hidden"))) return false;
  if (hasNameAttribute(attributes)) return true;
  if (tag === "img") return hasValue(attributes.get("alt"));
  if (tag === "svg") return false;
  return childrenOf(opening).some(childHasName);
}

function hasAccessibleContent(element: ts.JsxOpeningLikeElement): boolean {
  return childrenOf(element).some(childHasName);
}

function insideLabel(element: ts.JsxOpeningLikeElement): boolean {
  let current: ts.Node = element.parent;
  while (!ts.isSourceFile(current)) {
    if (ts.isJsxElement(current) && tagName(current.openingElement) === "label") return true;
    current = current.parent;
  }
  return false;
}

function containsControl(element: ts.JsxOpeningLikeElement): boolean {
  const visit = (child: ts.JsxChild): boolean => {
    if (ts.isJsxFragment(child)) return child.children.some(visit);
    if (ts.isJsxExpression(child)) return child.expression !== undefined;
    const opening = openingOf(child);
    if (opening === null) return false;
    const tag = tagName(opening);
    if (!isIntrinsic(tag) || FIELD_TAGS.has(tag)) return true;
    return childrenOf(opening).some(visit);
  };
  return childrenOf(element).some(visit);
}

function topLevelStatement(node: ts.Node): ts.Node {
  let current = node;
  while (!ts.isSourceFile(current.parent)) current = current.parent;
  return current;
}

function controlKind(tag: string, attributes: Attributes): string | null {
  if (tag === "button") return "<button>";
  if (tag === "a" && attributes.has("href")) return "<a href>";
  const role = staticText(attributes.get("role"));
  if (role !== null && NAMED_ROLES.has(role)) return `<${tag} role="${role}">`;
  return null;
}

export function a11yFindings(sources: SourceLoader, file: AppFile): Finding[] {
  const source = sources.load(file.path);
  const elements = jsxElements(source);
  const findings: Finding[] = [];
  const report = (code: A11yRuleCode, at: ts.Node, message: string, hint: string) =>
    findings.push(
      finding({
        rule: `a11y/${code}`,
        file: file.file,
        ...sources.location(file.path, at),
        message,
        hint,
      }),
    );

  const labelTargets = new Set<string>();
  for (const element of elements) {
    if (tagName(element) !== "label") continue;
    const key = attributeKey(jsxAttributes(element).get("htmlFor"), source);
    if (key !== null) labelTargets.add(key);
  }

  const lastHeading = new Map<ts.Node, number>();

  for (const element of elements) {
    const tag = tagName(element);
    const attributes = jsxAttributes(element);
    const spread = hasSpread(element);

    const tabIndex = attributes.get("tabIndex") ?? attributes.get("tabindex");
    if (tabIndex !== undefined) {
      const value = numericValue(tabIndex);
      if (value !== null && value > 0) {
        report(
          "no-positive-tabindex",
          tabIndex,
          `<${tag}> sets tabIndex to ${value}`,
          "Use tabIndex={0} to add the element to the natural tab order, or tabIndex={-1} to focus it from code; order controls through the DOM instead.",
        );
      }
    }

    const autoFocus = attributes.get("autoFocus") ?? attributes.get("autofocus");
    if (autoFocus !== undefined && !isLiteralFalse(autoFocus) && file.role !== "overlay") {
      report(
        "no-autofocus-outside-overlay",
        autoFocus,
        `<${tag}> sets autoFocus in a ${file.role} file`,
        "Remove autoFocus; Rex moves focus to the page heading on navigation, and only overlays under overlays/ may focus their first control when they open.",
      );
    }

    if (!isIntrinsic(tag)) continue;

    const heading = HEADING_TAG.exec(tag);
    if (heading !== null) {
      const level = Number(heading[1]);
      const scope = topLevelStatement(element);
      const previous = lastHeading.get(scope);
      if (previous !== undefined && level > previous + 1) {
        report(
          "heading-order",
          element,
          `<${tag}> follows <h${previous}> and skips <h${previous + 1}>`,
          `Use <h${previous + 1}> here, or style the heading with tokens instead of picking a level for its size.`,
        );
      }
      lastHeading.set(scope, level);
    }

    if (spread) continue;

    const type = staticText(attributes.get("type"));
    const roleText = staticText(attributes.get("role"));
    const presentational = roleText === "presentation" || roleText === "none";

    if (
      (tag === "img" || (tag === "input" && type === "image") || tag === "area") &&
      !attributes.has("alt") &&
      !hasNameAttribute(attributes) &&
      !presentational &&
      (tag !== "area" || attributes.has("href"))
    ) {
      const kind = tag === "input" ? '<input type="image">' : `<${tag}>`;
      report(
        "img-alt",
        element,
        `${kind} has no alt text`,
        'Add alt="<what the image shows>", or alt="" when the image is decorative.',
      );
    }

    const control = controlKind(tag, attributes);
    if (control !== null && !hasNameAttribute(attributes) && !hasAccessibleContent(element)) {
      report(
        "control-name",
        element,
        `${control} has no accessible name`,
        "Give the control visible text, or aria-label when it shows only an icon.",
      );
    }

    if (
      tag === "input" &&
      type === "button" &&
      !hasValue(attributes.get("value")) &&
      !hasNameAttribute(attributes)
    ) {
      report(
        "control-name",
        element,
        '<input type="button"> has no accessible name',
        "Set value to the visible button text, or aria-label.",
      );
    }

    if (
      FIELD_TAGS.has(tag) &&
      !(tag === "input" && type !== null && UNLABELLED_INPUT_TYPES.has(type))
    ) {
      const id = attributeKey(attributes.get("id"), source);
      const labelled =
        hasNameAttribute(attributes) ||
        insideLabel(element) ||
        (id !== null && labelTargets.has(id));
      if (!labelled) {
        report(
          "label-for",
          element,
          `<${tag}> has no label`,
          "Give it an id and render <label htmlFor={id}> with the field name, wrap it in <label>, or set aria-label.",
        );
      }
    }

    if (tag === "label" && !attributes.has("htmlFor") && !containsControl(element)) {
      report(
        "label-for",
        element,
        "<label> is not associated with a field",
        "Set htmlFor to the id of the field it names, or wrap the field inside the label.",
      );
    }
  }
  return findings;
}

export const a11yRule = defineRule({
  id: "a11y",
  description:
    "Reports images without alt text, unnamed controls, unlabelled fields, skipped heading levels, positive tabIndex and autoFocus outside overlays.",
  check({ app, sources }) {
    return app.files
      .filter((file) => file.path.endsWith(".tsx") && file.role !== "test")
      .flatMap((file) => a11yFindings(sources, file));
  },
});
