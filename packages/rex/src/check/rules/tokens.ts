import ts from "typescript";
import type { AppFile } from "../engine.ts";
import { defineRule, finding, type Finding, type SourceLoader } from "../rule.ts";

const COLOR_NAMES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOR_UTILITIES =
  "bg|text|border|border-[xytrblse]|ring|ring-offset|outline|fill|stroke|from|via|to|divide|placeholder|accent|caret|decoration|shadow|inset-shadow|inset-ring|drop-shadow|text-shadow";

export const RAW_COLOR_CLASS = new RegExp(
  `^(?:[^:\\s]+:)*!?-?(?:${COLOR_UTILITIES})-(?:(?:${COLOR_NAMES})-(?:50|[1-9]00|950)|black|white)(?:\\/[0-9]+)?!?$`,
);
export const ARBITRARY_VALUE_CLASS = /\[[^\]]*\]/;

const TOKEN_KEYWORDS = new Set([
  "inherit",
  "initial",
  "unset",
  "revert",
  "currentcolor",
  "transparent",
  "none",
]);
const COLOR_STYLE_KEY = /color$/i;
const COLOR_STYLE_KEYS = new Set(["background", "fill", "stroke"]);
const SHORTHAND_STYLE_KEYS = new Set([
  "border",
  "borderTop",
  "borderRight",
  "borderBottom",
  "borderLeft",
  "borderBlock",
  "borderInline",
  "outline",
  "boxShadow",
  "textShadow",
  "textDecoration",
]);
const RAW_COLOR_VALUE =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\(|\b(?:red|blue|green|black|white|gray|grey|orange|yellow|purple|pink|brown|cyan|magenta)\b/i;

export interface ClassToken {
  readonly token: string;
  readonly position: number;
}

function stringParts(node: ts.Node, source: ts.SourceFile, parts: ClassToken[]): void {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    parts.push({ token: node.text, position: node.getStart(source) + 1 });
    return;
  }
  if (ts.isTemplateExpression(node)) {
    parts.push({ token: node.head.text, position: node.head.getStart(source) + 1 });
    for (const span of node.templateSpans) {
      stringParts(span.expression, source, parts);
      parts.push({ token: span.literal.text, position: span.literal.getStart(source) + 1 });
    }
    return;
  }
  ts.forEachChild(node, (child) => stringParts(child, source, parts));
}

export function classTokens(source: ts.SourceFile, attribute: ts.JsxAttribute): ClassToken[] {
  const initializer = attribute.initializer;
  if (initializer === undefined) return [];
  const parts: ClassToken[] = [];
  stringParts(initializer, source, parts);
  const tokens: ClassToken[] = [];
  for (const part of parts) {
    const pattern = /\S+/g;
    for (let match = pattern.exec(part.token); match !== null; match = pattern.exec(part.token)) {
      tokens.push({ token: match[0], position: part.position + match.index });
    }
  }
  return tokens;
}

export function attributeName(attribute: ts.JsxAttribute): string {
  return ts.isIdentifier(attribute.name)
    ? attribute.name.text
    : `${attribute.name.namespace.text}:${attribute.name.name.text}`;
}

export function jsxElements(source: ts.SourceFile): ts.JsxOpeningLikeElement[] {
  const found: ts.JsxOpeningLikeElement[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

export function jsxAttributes(element: ts.JsxOpeningLikeElement): Map<string, ts.JsxAttribute> {
  const attributes = new Map<string, ts.JsxAttribute>();
  for (const property of element.attributes.properties) {
    if (ts.isJsxAttribute(property)) attributes.set(attributeName(property), property);
  }
  return attributes;
}

function propertyKey(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

function staticString(node: ts.Expression): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function isTokenReference(value: string): boolean {
  const trimmed = value.trim();
  return (
    /^var\(--[A-Za-z0-9_-]+(?:\s*,[^)]*)?\)$/.test(trimmed) ||
    TOKEN_KEYWORDS.has(trimmed.toLowerCase())
  );
}

function checkFile(sources: SourceLoader, file: AppFile): Finding[] {
  const source = sources.load(file.path);
  const findings: Finding[] = [];
  const at = (position: number) => sources.location(file.path, position);
  for (const element of jsxElements(source)) {
    const attributes = jsxAttributes(element);
    for (const name of ["className", "class"]) {
      const attribute = attributes.get(name);
      if (attribute === undefined) continue;
      for (const { token, position } of classTokens(source, attribute)) {
        if (RAW_COLOR_CLASS.test(token)) {
          findings.push(
            finding({
              rule: "tokens/raw-color",
              file: file.file,
              ...at(position),
              message: `raw color utility "${token}" outside app/components`,
              hint: "Use a design token utility (for example bg-surface or text-fg) or a component from app/components.",
            }),
          );
        } else if (ARBITRARY_VALUE_CLASS.test(token)) {
          findings.push(
            finding({
              rule: "tokens/arbitrary-value",
              file: file.file,
              ...at(position),
              message: `arbitrary value utility "${token}" outside app/components`,
              hint: "Replace the bracketed value with a token-based utility or a Rex layout primitive prop.",
            }),
          );
        }
      }
    }
    const style = attributes.get("style");
    const expression =
      style?.initializer && ts.isJsxExpression(style.initializer)
        ? style.initializer.expression
        : undefined;
    if (expression === undefined || !ts.isObjectLiteralExpression(expression)) continue;
    for (const property of expression.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const key = propertyKey(property.name);
      if (key === null) continue;
      const value = staticString(property.initializer);
      const isColorKey = COLOR_STYLE_KEY.test(key) || COLOR_STYLE_KEYS.has(key);
      const violates = isColorKey
        ? value === null || !isTokenReference(value)
        : SHORTHAND_STYLE_KEYS.has(key) && (value === null || RAW_COLOR_VALUE.test(value));
      if (!violates) continue;
      findings.push(
        finding({
          rule: "tokens/inline-color",
          file: file.file,
          ...sources.location(file.path, property),
          message: `inline style ${key} ${value === null ? "is not a token reference" : `uses the raw value "${value}"`}`,
          hint: "Reference a color token with var(--token-name) or use a token utility class.",
        }),
      );
    }
  }
  return findings;
}

export const tokensRule = defineRule({
  id: "tokens",
  description:
    "Reports raw Tailwind color utilities, arbitrary value brackets and inline style colors outside app/components.",
  check({ app, sources }) {
    return app.files
      .filter((file) => file.role !== "component" && file.role !== "test")
      .flatMap((file) => checkFile(sources, file));
  },
});
