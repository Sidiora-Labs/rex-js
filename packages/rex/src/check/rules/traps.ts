import ts from "typescript";
import { OVERLAY_DISMISS } from "../../core/overlay.ts";
import type { AppFile, RexApp } from "../engine.ts";
import { defineRule, finding, type Finding, type SourceLoader } from "../rule.ts";
import { classTokens, jsxAttributes, jsxElements } from "./tokens.ts";

export const ALTERNATIVE_ATTRIBUTE = "data-rex-alternative";

const MOTION_CLASS = /^(?:[^:\s]+:)*animate-(?!none$)[a-z0-9-]+$/;
const TEXT_ATTRIBUTES = ["aria-label", "aria-labelledby", "title"];
const CUSTOM_ELEMENT_TAG = /^[a-z][a-z0-9._]*-[a-z0-9._-]*$/;
const TABINDEX_ATTRIBUTES = ["tabIndex", "tabindex"];

function tagName(element: ts.JsxOpeningLikeElement): string {
  return element.tagName.getText();
}

function isFalse(attribute: ts.JsxAttribute): boolean {
  const initializer = attribute.initializer;
  if (initializer === undefined) return false;
  if (ts.isStringLiteral(initializer)) return initializer.text === "false";
  return (
    ts.isJsxExpression(initializer) &&
    initializer.expression !== undefined &&
    initializer.expression.kind === ts.SyntaxKind.FalseKeyword
  );
}

function hasValue(attribute: ts.JsxAttribute | undefined): boolean {
  if (attribute === undefined || attribute.initializer === undefined) return false;
  const initializer = attribute.initializer;
  if (ts.isStringLiteral(initializer)) return initializer.text.trim().length > 0;
  if (ts.isJsxExpression(initializer)) {
    const expression = initializer.expression;
    if (expression === undefined) return false;
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      return expression.text.trim().length > 0;
    }
    return true;
  }
  return false;
}

function isCustomElement(element: ts.JsxOpeningLikeElement): boolean {
  return ts.isIdentifier(element.tagName) && CUSTOM_ELEMENT_TAG.test(element.tagName.text);
}

function isNegative(expression: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(expression)) return isNegative(expression.expression);
  return (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expression.operand) &&
    Number(expression.operand.text) > 0
  );
}

function isFocusable(attribute: ts.JsxAttribute | undefined): boolean {
  if (attribute === undefined || !hasValue(attribute)) return false;
  const initializer = attribute.initializer;
  if (initializer !== undefined && ts.isStringLiteral(initializer)) {
    return !initializer.text.trim().startsWith("-");
  }
  if (initializer !== undefined && ts.isJsxExpression(initializer)) {
    const expression = initializer.expression;
    if (expression === undefined) return false;
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      return !expression.text.trim().startsWith("-");
    }
    return !isNegative(expression);
  }
  return false;
}

function hasTextContent(element: ts.JsxOpeningLikeElement): boolean {
  if (ts.isJsxSelfClosingElement(element)) return false;
  const parent = element.parent;
  if (!ts.isJsxElement(parent)) return false;
  return parent.children.some((child) => !ts.isJsxText(child) || child.text.trim().length > 0);
}

function checkFile(sources: SourceLoader, file: AppFile): Finding[] {
  const source = sources.load(file.path);
  const findings: Finding[] = [];
  for (const element of jsxElements(source)) {
    const attributes = jsxAttributes(element);
    const tag = tagName(element);
    const where = sources.location(file.path, element);
    const report = (code: string, message: string, hint: string) =>
      findings.push(finding({ rule: `traps/${code}`, file: file.file, ...where, message, hint }));

    const hover = ["onMouseEnter", "onMouseOver"].find((name) => attributes.has(name));
    if (hover !== undefined && !attributes.has("onFocus")) {
      report(
        "hover-only",
        `<${tag}> handles ${hover} without onFocus`,
        `Add an onFocus handler with the same effect so keyboard and agent users reach it, or remove ${hover}.`,
      );
    }

    const draggable = attributes.get("draggable");
    const dragging =
      (draggable !== undefined && !isFalse(draggable)) || attributes.has("onDragStart");
    if (dragging && !hasValue(attributes.get(ALTERNATIVE_ATTRIBUTE))) {
      report(
        "drag-only",
        `draggable <${tag}> has no ${ALTERNATIVE_ATTRIBUTE}`,
        `Declare the keyboard or typed equivalent with ${ALTERNATIVE_ATTRIBUTE}="<page>/<action>" and render that control.`,
      );
    }

    if (tag === "canvas" && !hasValue(attributes.get(ALTERNATIVE_ATTRIBUTE))) {
      report(
        "canvas",
        `<canvas> has no ${ALTERNATIVE_ATTRIBUTE}`,
        `Declare the equivalent action with ${ALTERNATIVE_ATTRIBUTE}="<page>/<action>" and render it as a control.`,
      );
    }

    if (
      isCustomElement(element) &&
      !TABINDEX_ATTRIBUTES.some((name) => isFocusable(attributes.get(name))) &&
      !hasValue(attributes.get(ALTERNATIVE_ATTRIBUTE))
    ) {
      report(
        "custom-element",
        `custom element <${tag}> has no tabIndex or ${ALTERNATIVE_ATTRIBUTE}`,
        `Give <${tag}> tabIndex={0} so keyboard and agent users reach it, or declare its keyboard equivalent with ${ALTERNATIVE_ATTRIBUTE}="<page>/<action>" and render that control.`,
      );
    }

    const classAttribute = attributes.get("className") ?? attributes.get("class");
    const motion = classAttribute
      ? classTokens(source, classAttribute).find(({ token }) => MOTION_CLASS.test(token))
      : undefined;
    if (
      motion !== undefined &&
      !hasTextContent(element) &&
      !TEXT_ATTRIBUTES.some((name) => hasValue(attributes.get(name)))
    ) {
      report(
        "motion-only",
        `<${tag}> conveys state only through "${motion.token}"`,
        "Render the state as visible text (for example Loading) next to or inside the animated element.",
      );
    }
  }
  return findings;
}

function checkOverlayDismiss(app: RexApp, sources: SourceLoader): Finding[] {
  const findings: Finding[] = [];
  for (const entry of app.pages) {
    if (entry.page === null) continue;
    const declared = sources.pageDeclaration(entry.page.path);
    for (const overlay of declared?.overlays ?? []) {
      if (
        overlay.dismiss !== null &&
        (OVERLAY_DISMISS as readonly string[]).includes(overlay.dismiss)
      ) {
        continue;
      }
      findings.push(
        finding({
          rule: "traps/overlay-dismiss",
          file: entry.page.file,
          line: overlay.line,
          column: overlay.column,
          message:
            overlay.dismiss === null
              ? `overlay "${overlay.id}" of page ${entry.id} declares no dismiss`
              : `overlay "${overlay.id}" of page ${entry.id} declares the unknown dismiss "${overlay.dismiss}"`,
          hint: `Declare dismiss: ${OVERLAY_DISMISS.map((value) => `"${value}"`).join(", ")} so Escape or a visible control closes it.`,
        }),
      );
    }
  }
  return findings;
}

export const trapsRule = defineRule({
  id: "traps",
  description:
    "Reports hover-only, drag-only, canvas-only and motion-only controls, custom elements without tabIndex or a declared keyboard equivalent, and overlays without a declared dismiss.",
  check({ app, sources }) {
    return [
      ...app.files
        .filter((file) => file.path.endsWith(".tsx") && file.role !== "test")
        .flatMap((file) => checkFile(sources, file)),
      ...checkOverlayDismiss(app, sources),
    ];
  },
});
