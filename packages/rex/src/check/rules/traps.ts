import ts from "typescript";
import { OVERLAY_DISMISS } from "../../core/overlay.ts";
import type { AppFile, RexApp } from "../engine.ts";
import { defineRule, finding, type Finding, type SourceLoader } from "../rule.ts";
import { classTokens, jsxAttributes, jsxElements } from "./tokens.ts";

export const ALTERNATIVE_ATTRIBUTE = "data-rex-alternative";

const MOTION_CLASS = /^(?:[^:\s]+:)*animate-(?!none$)[a-z0-9-]+$/;
const TEXT_ATTRIBUTES = ["aria-label", "aria-labelledby", "title"];
const PAGED_LIST_TAG = "Page.List";
const LIST_TAGS = ["ul", "ol"];
const LIST_ROLES = ["list", "feed"];
const SCROLL_ATTRIBUTES = ["onScroll", "onScrollCapture", "onScrollEnd"];
const SCROLL_EVENTS = ["scroll", "scrollend"];

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

function stringValue(attribute: ts.JsxAttribute | undefined): string | null {
  const initializer = attribute?.initializer;
  if (initializer === undefined) return null;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (
    ts.isJsxExpression(initializer) &&
    initializer.expression !== undefined &&
    (ts.isStringLiteral(initializer.expression) ||
      ts.isNoSubstitutionTemplateLiteral(initializer.expression))
  ) {
    return initializer.expression.text;
  }
  return null;
}

function isMapCall(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "map"
  );
}

function isIntersectionObserver(node: ts.NewExpression): boolean {
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text === "IntersectionObserver";
  return ts.isPropertyAccessExpression(callee) && callee.name.text === "IntersectionObserver";
}

function isScrollListener(node: ts.CallExpression): boolean {
  const callee = node.expression;
  const event = node.arguments[0];
  return (
    ts.isPropertyAccessExpression(callee) &&
    callee.name.text === "addEventListener" &&
    event !== undefined &&
    (ts.isStringLiteral(event) || ts.isNoSubstitutionTemplateLiteral(event)) &&
    SCROLL_EVENTS.includes(event.text)
  );
}

interface ScrollTrigger {
  readonly node: ts.Node;
  readonly description: string;
}

function checkInfiniteList(sources: SourceLoader, file: AppFile): Finding[] {
  const source = sources.load(file.path);
  const triggers: ScrollTrigger[] = [];
  let rendersList = false;
  let rendersPagedList = false;
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = tagName(node);
      const attributes = jsxAttributes(node);
      if (tag === PAGED_LIST_TAG) rendersPagedList = true;
      const role = stringValue(attributes.get("role")) ?? "";
      if (LIST_TAGS.includes(tag) || LIST_ROLES.includes(role)) rendersList = true;
      const scroll = SCROLL_ATTRIBUTES.find((name) => attributes.has(name));
      if (scroll !== undefined) triggers.push({ node, description: `<${tag}> ${scroll}` });
    } else if (
      ts.isJsxExpression(node) &&
      node.expression !== undefined &&
      isMapCall(node.expression)
    ) {
      rendersList = true;
    } else if (ts.isNewExpression(node) && isIntersectionObserver(node)) {
      triggers.push({ node, description: "an IntersectionObserver" });
    } else if (ts.isCallExpression(node) && isScrollListener(node)) {
      triggers.push({ node, description: "a scroll listener" });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!rendersList || rendersPagedList) return [];
  return triggers.map((trigger) =>
    finding({
      rule: "traps/infinite-list",
      file: file.file,
      ...sources.location(file.path, trigger.node),
      message: `${trigger.description} loads list items on scroll without Page.List`,
      hint: "Render the list with Page.List so page and size live in the URL and a visible Load more control appends the next page; keep scroll loading only as an enhancement next to it.",
    }),
  );
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
    "Reports hover-only, drag-only, canvas-only and motion-only controls, scroll-loading lists without Page.List and overlays without a declared dismiss.",
  check({ app, sources }) {
    return [
      ...app.files
        .filter((file) => file.path.endsWith(".tsx") && file.role !== "test")
        .flatMap((file) => [...checkFile(sources, file), ...checkInfiniteList(sources, file)]),
      ...checkOverlayDismiss(app, sources),
    ];
  },
});
