import { existsSync, readdirSync, readFileSync, type Dirent } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { CONFIG_FILE, resolveOptions, type ResolvedRexOptions } from "../../core/config.ts";
import { RexError } from "../../core/errors.ts";
import { isCssModule } from "../../vite/styles.ts";
import type { AppFile } from "../engine.ts";
import { defineRule, finding, type Finding, type SourceLoader } from "../rule.ts";

const COLOR_NAMES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOR_UTILITIES =
  "bg|text|border|border-[xytrblse]|ring|ring-offset|outline|fill|stroke|from|via|to|divide|placeholder|accent|caret|decoration|shadow|inset-shadow|inset-ring|drop-shadow|text-shadow";
const SPACING_UTILITIES =
  "p|p[xytrblse]|m|m[xytrblse]|gap|gap-[xy]|space-[xy]|inset|inset-[xy]|top|right|bottom|left|start|end|scroll-m|scroll-m[xytrblse]|scroll-p|scroll-p[xytrblse]|indent";
const PALETTE_COLOR = `(?:${COLOR_NAMES})-(?:50|[1-9]00|950)|black|white`;
const OPACITY = "(?:\\/(?:[0-9]+|\\[[^\\]]*\\]|\\([^)]*\\)))?";

export const RAW_COLOR_CLASS = new RegExp(
  `^(?:[^:\\s]+:)*!?-?(?:${COLOR_UTILITIES})-(?:(?:${COLOR_NAMES})-(?:50|[1-9]00|950)|black|white)(?:\\/[0-9]+)?!?$`,
);
export const ARBITRARY_VALUE_CLASS = /\[[^\]]*\]/;

const NAMED_COLOR_UTILITY = new RegExp(`^(?:${COLOR_UTILITIES})-(${PALETTE_COLOR})${OPACITY}$`);
const ARBITRARY_COLOR_UTILITY = new RegExp(`^(?:${COLOR_UTILITIES})-\\[(.+)\\]${OPACITY}$`);
const ARBITRARY_SPACING_UTILITY = new RegExp(`^(?:${SPACING_UTILITIES})-\\[(.+)\\]$`);
const ARBITRARY_PROPERTY = /^\[([a-z-]+):(.+)\]$/;
const TYPE_HINT = /^[a-z-]+:(?!\/\/)/;

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
const SPACING_STYLE_KEY =
  /^(?:(?:padding|margin|inset)(?:Top|Right|Bottom|Left|Block|Inline|BlockStart|BlockEnd|InlineStart|InlineEnd)?|gap|rowGap|columnGap|top|right|bottom|left)$/;
const COLOR_PROPERTY =
  /(?:^|-)color$|^(?:background|fill|stroke|border(?:-[a-z]+)?|outline|box-shadow|text-shadow|text-decoration)$/;
const SPACING_PROPERTY =
  /^(?:(?:padding|margin|scroll-padding|scroll-margin|inset)(?:-(?:top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))?|gap|row-gap|column-gap|top|right|bottom|left)$/;
const RAW_COLORS =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\([^)]*\)|\b(?:red|blue|green|black|white|gray|grey|orange|yellow|purple|pink|brown|cyan|magenta)\b/gi;
const RAW_LENGTHS =
  /(?<![\w.#-])-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|ch|ex|vh|vw|vmin|vmax|svh|lvh|dvh|svw|lvw|dvw|pt|pc|cm|mm|in|%)(?![\w-])/gi;
const BARE_NUMBER = /^-?(?:\d+\.?\d*|\.\d+)$/;
const VAR_REFERENCE = /var\(\s*--[A-Za-z0-9_-]+(?:\s*,[^()]*)?\)/g;
const THEME_VARIABLE = /(--[A-Za-z0-9_-]+)\s*:/g;
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "build", "coverage"]);

export type TokenAllowLists = ResolvedRexOptions["check"]["tokens"];

export interface TokenTheme {
  readonly files: readonly string[];
  readonly variables: ReadonlySet<string>;
}

export interface TokenSettings {
  readonly theme: TokenTheme;
  readonly allow: TokenAllowLists;
}

export interface TokenConfigRead {
  readonly allow: TokenAllowLists;
  readonly findings: readonly Finding[];
}

export type ClassTokenProblem =
  | { readonly kind: "raw-color"; readonly value: string }
  | { readonly kind: "arbitrary-value"; readonly value: string };

export interface ClassToken {
  readonly token: string;
  readonly position: number;
}

export type StringPartFilter = (node: ts.Node) => boolean;

export const EMPTY_THEME: TokenTheme = Object.freeze({
  files: Object.freeze([]),
  variables: new Set<string>(),
});

export const DEFAULT_TOKEN_SETTINGS: TokenSettings = Object.freeze({
  theme: EMPTY_THEME,
  allow: resolveOptions().check.tokens,
});

function stringParts(
  node: ts.Node,
  source: ts.SourceFile,
  parts: ClassToken[],
  skip: StringPartFilter | undefined,
): void {
  if (skip?.(node) === true) return;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    parts.push({ token: node.text, position: node.getStart(source) + 1 });
    return;
  }
  if (ts.isTemplateExpression(node)) {
    parts.push({ token: node.head.text, position: node.head.getStart(source) + 1 });
    for (const span of node.templateSpans) {
      stringParts(span.expression, source, parts, skip);
      parts.push({ token: span.literal.text, position: span.literal.getStart(source) + 1 });
    }
    return;
  }
  ts.forEachChild(node, (child) => stringParts(child, source, parts, skip));
}

export function classTokens(
  source: ts.SourceFile,
  attribute: ts.JsxAttribute,
  skip?: StringPartFilter,
): ClassToken[] {
  const initializer = attribute.initializer;
  if (initializer === undefined) return [];
  const parts: ClassToken[] = [];
  stringParts(initializer, source, parts, skip);
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

function staticNumber(node: ts.Expression): number | null {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text);
  }
  return null;
}

function isTokenReference(value: string): boolean {
  const trimmed = value.trim();
  return (
    /^var\(--[A-Za-z0-9_-]+(?:\s*,[^)]*)?\)$/.test(trimmed) ||
    TOKEN_KEYWORDS.has(trimmed.toLowerCase())
  );
}

function withoutVariables(value: string): string {
  let current = value;
  for (;;) {
    const next = current.replace(VAR_REFERENCE, " ");
    if (next === current) return current;
    current = next;
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function allowed(list: readonly string[], value: string): boolean {
  const wanted = normalize(value);
  return list.some((entry) => normalize(entry) === wanted);
}

export function rawColors(value: string, allow: readonly string[] = []): string[] {
  return [...withoutVariables(value).matchAll(RAW_COLORS)]
    .map((match) => match[0])
    .filter((color) => !allowed(allow, color));
}

export function rawLengths(value: string, allow: readonly string[] = []): string[] {
  const stripped = withoutVariables(value).trim();
  const found = [...stripped.matchAll(RAW_LENGTHS)]
    .map((match) => match[0])
    .filter((length) => Number.parseFloat(length) !== 0);
  if (BARE_NUMBER.test(stripped) && Number(stripped) !== 0) found.push(stripped);
  return found.filter((length) => !allowed(allow, length));
}

export function splitVariants(token: string): { readonly variants: string; readonly base: string } {
  let depth = 0;
  let split = -1;
  for (let index = 0; index < token.length; index += 1) {
    const char = token[index];
    if (char === "[" || char === "(") depth += 1;
    else if ((char === "]" || char === ")") && depth > 0) depth -= 1;
    else if (char === ":" && depth === 0) split = index;
  }
  return split === -1
    ? { variants: "", base: token }
    : { variants: token.slice(0, split + 1), base: token.slice(split + 1) };
}

function utilityOf(base: string): string {
  return base
    .replace(/^!/, "")
    .replace(/!$/, "")
    .replace(/^-(?=[a-z])/, "");
}

function arbitraryContent(raw: string): string {
  const spaced = raw.replace(/(?<!\\)_/g, " ").replace(/\\_/g, "_");
  return TYPE_HINT.test(spaced) && !spaced.startsWith("var(")
    ? spaced.replace(TYPE_HINT, "")
    : spaced;
}

export function classifyClassToken(
  token: string,
  settings: TokenSettings = DEFAULT_TOKEN_SETTINGS,
): ClassTokenProblem | null {
  const { allow, theme } = settings;
  const { base } = splitVariants(token);
  const utility = utilityOf(base);
  if (allowed(allow.classes, token) || allowed(allow.classes, utility)) return null;

  const named = NAMED_COLOR_UTILITY.exec(utility);
  if (named !== null) {
    const color = named[1] ?? "";
    if (theme.variables.has(`--color-${color}`) || allowed(allow.colors, color)) return null;
    return { kind: "raw-color", value: color };
  }

  const property = ARBITRARY_PROPERTY.exec(utility);
  if (property !== null) {
    const name = property[1] ?? "";
    const content = arbitraryContent(property[2] ?? "");
    if (COLOR_PROPERTY.test(name) && rawColors(content, allow.colors).length > 0) {
      return { kind: "arbitrary-value", value: content };
    }
    if (SPACING_PROPERTY.test(name) && rawLengths(content, allow.spacing).length > 0) {
      return { kind: "arbitrary-value", value: content };
    }
    return null;
  }

  const color = ARBITRARY_COLOR_UTILITY.exec(utility);
  if (color !== null) {
    const content = arbitraryContent(color[1] ?? "");
    if (rawColors(content, allow.colors).length > 0)
      return { kind: "arbitrary-value", value: content };
  }
  const spacing = ARBITRARY_SPACING_UTILITY.exec(utility);
  if (spacing !== null) {
    const content = arbitraryContent(spacing[1] ?? "");
    if (rawLengths(content, allow.spacing).length > 0) {
      return { kind: "arbitrary-value", value: content };
    }
  }
  return null;
}

function cssFiles(dir: string, found: string[], depth: number): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (depth > 0) cssFiles(full, found, depth - 1);
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      found.push(full);
    }
  }
}

function themeBlocks(css: string): string[] {
  const blocks: string[] = [];
  const pattern = /@theme\b[^{;]*\{/g;
  for (let match = pattern.exec(css); match !== null; match = pattern.exec(css)) {
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;
    while (index < css.length && depth > 0) {
      if (css[index] === "{") depth += 1;
      else if (css[index] === "}") depth -= 1;
      index += 1;
    }
    blocks.push(css.slice(start, index - 1));
    pattern.lastIndex = index;
  }
  return blocks;
}

export function readTokenTheme(root: string): TokenTheme {
  const files: string[] = [];
  cssFiles(path.resolve(root), files, 8);
  const variables = new Set<string>();
  const themed: string[] = [];
  for (const file of files) {
    const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const blocks = themeBlocks(css);
    if (blocks.length === 0) continue;
    themed.push(path.relative(path.resolve(root), file).split(path.sep).join("/"));
    for (const block of blocks) {
      for (const match of block.matchAll(THEME_VARIABLE)) variables.add(match[1] ?? "");
    }
  }
  return Object.freeze({ files: Object.freeze(themed), variables });
}

class DynamicConfigValue extends RexError {
  readonly node: ts.Node;

  constructor(node: ts.Node) {
    super("REX508", "not a static literal");
    this.node = node;
  }
}

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

function literalValue(node: ts.Expression): unknown {
  const value = unwrap(node);
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
  if (value.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (value.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(value)) return value.elements.map(literalValue);
  if (ts.isObjectLiteralExpression(value)) {
    const record: Record<string, unknown> = {};
    for (const property of value.properties) {
      const key = ts.isPropertyAssignment(property) ? propertyKey(property.name) : null;
      if (key === null || !ts.isPropertyAssignment(property))
        throw new DynamicConfigValue(property);
      record[key] = literalValue(property.initializer);
    }
    return record;
  }
  throw new DynamicConfigValue(value);
}

function configObject(source: ts.SourceFile): ts.ObjectLiteralExpression | null {
  const exported = source.statements.find(
    (statement): statement is ts.ExportAssignment =>
      ts.isExportAssignment(statement) && !statement.isExportEquals,
  );
  if (exported === undefined) return null;
  let value = unwrap(exported.expression);
  if (ts.isIdentifier(value)) {
    const name = value.text;
    let initializer: ts.Expression | undefined;
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
          initializer = declaration.initializer;
        }
      }
    }
    if (initializer === undefined) return null;
    value = unwrap(initializer);
  }
  if (ts.isCallExpression(value)) {
    const first = value.arguments[0];
    if (first === undefined) return null;
    value = unwrap(first);
  }
  return ts.isObjectLiteralExpression(value) ? value : null;
}

export function readTokenConfig(root: string, sources: SourceLoader): TokenConfigRead {
  const file = path.join(path.resolve(root), CONFIG_FILE);
  const defaults = DEFAULT_TOKEN_SETTINGS.allow;
  if (!existsSync(file)) return { allow: defaults, findings: [] };
  const config = configObject(sources.load(file));
  const check = config?.properties.find(
    (property) =>
      (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
      propertyKey(property.name) === "check",
  );
  if (check === undefined) return { allow: defaults, findings: [] };
  const report = (at: ts.Node, message: string): TokenConfigRead => ({
    allow: defaults,
    findings: [
      finding({
        rule: "tokens/config",
        file: CONFIG_FILE,
        ...sources.location(file, at),
        message,
        hint: "Write check.tokens in rex.config.ts as literal lists of strings: { colors?: [...], spacing?: [...], classes?: [...] }.",
      }),
    ],
  });
  if (!ts.isPropertyAssignment(check)) {
    return report(
      check,
      "check in rex.config.ts is not a static literal, so rex check cannot read its token allow lists",
    );
  }
  let value: unknown;
  try {
    value = literalValue(check.initializer);
  } catch (error) {
    if (!(error instanceof DynamicConfigValue)) throw error;
    return report(
      error.node,
      "check in rex.config.ts is not a static literal, so rex check cannot read its token allow lists",
    );
  }
  try {
    return { allow: resolveOptions({ check: value as never }).check.tokens, findings: [] };
  } catch (error) {
    return report(check, (error as Error).message);
  }
}

function cssModuleLocals(sources: SourceLoader, file: AppFile): ReadonlySet<string> {
  const locals = new Set<string>();
  for (const ref of sources.imports(file.path)) {
    if (ref.kind === "import" && !ref.typeOnly && isCssModule(ref.specifier)) {
      for (const local of ref.locals) locals.add(local);
    }
  }
  return locals;
}

function checkFile(sources: SourceLoader, file: AppFile, settings: TokenSettings): Finding[] {
  const source = sources.load(file.path);
  const findings: Finding[] = [];
  const at = (position: number) => sources.location(file.path, position);
  const modules = cssModuleLocals(sources, file);
  const skip: StringPartFilter = (node) =>
    ts.isElementAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    modules.has(node.expression.text);
  const { allow } = settings;
  for (const element of jsxElements(source)) {
    const attributes = jsxAttributes(element);
    for (const name of ["className", "class"]) {
      const attribute = attributes.get(name);
      if (attribute === undefined) continue;
      for (const { token, position } of classTokens(source, attribute, skip)) {
        const problem = classifyClassToken(token, settings);
        if (problem === null) continue;
        findings.push(
          problem.kind === "raw-color"
            ? finding({
                rule: "tokens/raw-color",
                file: file.file,
                ...at(position),
                message: `raw color utility "${token}" outside app/components`,
                hint: "Use a theme token utility (for example bg-surface or text-fg), declare the color in the Tailwind @theme, or list it under check.tokens.colors in rex.config.ts.",
              })
            : finding({
                rule: "tokens/arbitrary-value",
                file: file.file,
                ...at(position),
                message: `arbitrary value utility "${token}" outside app/components`,
                hint: `Replace the raw value "${problem.value}" with a theme token utility, var(--token) or a Rex layout primitive prop, or list it under check.tokens in rex.config.ts.`,
              }),
        );
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
      if (SPACING_STYLE_KEY.test(key)) {
        const number = staticNumber(property.initializer);
        const raw =
          number !== null
            ? number !== 0 &&
              !allowed(allow.spacing, `${number}px`) &&
              !allowed(allow.spacing, `${number}`)
              ? `${number}`
              : null
            : value !== null
              ? (rawLengths(value, allow.spacing)[0] ?? null)
              : null;
        if (raw === null) continue;
        findings.push(
          finding({
            rule: "tokens/inline-spacing",
            file: file.file,
            ...sources.location(file.path, property),
            message: `inline style ${key} uses the raw value "${value ?? raw}"`,
            hint: "Reference a spacing token with var(--token-name), use a token utility class, or list the value under check.tokens.spacing in rex.config.ts.",
          }),
        );
        continue;
      }
      const isColorKey = COLOR_STYLE_KEY.test(key) || COLOR_STYLE_KEYS.has(key);
      const violates = isColorKey
        ? value === null || (!isTokenReference(value) && !allowed(allow.colors, value))
        : SHORTHAND_STYLE_KEYS.has(key) &&
          (value === null || rawColors(value, allow.colors).length > 0);
      if (!violates) continue;
      findings.push(
        finding({
          rule: "tokens/inline-color",
          file: file.file,
          ...sources.location(file.path, property),
          message: `inline style ${key} ${value === null ? "is not a token reference" : `uses the raw value "${value}"`}`,
          hint: "Reference a color token with var(--token-name), use a token utility class, or list the value under check.tokens.colors in rex.config.ts.",
        }),
      );
    }
  }
  return findings;
}

export const tokensRule = defineRule({
  id: "tokens",
  description:
    "Reports raw color and spacing literals outside app/components: palette color utilities missing from the Tailwind @theme, arbitrary color or spacing values and raw inline style colors or spacing, honouring check.tokens in rex.config.ts.",
  check({ app, sources }) {
    const config = readTokenConfig(app.root, sources);
    const settings: TokenSettings = { theme: readTokenTheme(app.root), allow: config.allow };
    return [
      ...config.findings,
      ...app.files
        .filter((file) => file.role !== "component" && file.role !== "test")
        .flatMap((file) => checkFile(sources, file, settings)),
    ];
  },
});
