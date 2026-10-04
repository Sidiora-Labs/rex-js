import ts from "typescript";
import { errorDocs, type RexErrorCode } from "../../core/errors.ts";
import { isCssModule } from "../../vite/styles.ts";
import type { AppFile, FileRole } from "../engine.ts";
import { defineRule, finding, type Finding, type Location, type SourceLoader } from "../rule.ts";
import { classTokens, jsxAttributes, jsxElements, splitVariants } from "./tokens.ts";

export const FIXED_SIZE_CODE = "layout/fixed-size";
export const TOUCH_TARGET_CODE = "layout/touch-target";
export const FIXED_SIZE_ERROR: RexErrorCode = "REX510";
export const TOUCH_TARGET_ERROR: RexErrorCode = "REX511";

export const FIXED_SIZE_ROLES: readonly FileRole[] = Object.freeze(["part"]);
export const TOUCH_TARGET_ROLES: readonly FileRole[] = Object.freeze(["region", "part", "overlay"]);

export const TOUCH_TARGET_PX = 44;
export const ROOT_FONT_PX = 16;
export const TAILWIND_SPACING_PX = 4;
export const HIT_TARGET_TOKEN = "--rex-hit-target";

export const SIZE_PROPERTIES = [
  "width",
  "height",
  "min-width",
  "min-height",
  "inline-size",
  "block-size",
  "min-inline-size",
  "min-block-size",
] as const;

export type SizeProperty = (typeof SIZE_PROPERTIES)[number];

const STYLE_KEYS: Readonly<Record<string, SizeProperty>> = Object.freeze({
  width: "width",
  height: "height",
  minWidth: "min-width",
  minHeight: "min-height",
  inlineSize: "inline-size",
  blockSize: "block-size",
  minInlineSize: "min-inline-size",
  minBlockSize: "min-block-size",
});

const TAILWIND_UTILITIES: Readonly<Record<string, readonly SizeProperty[]>> = Object.freeze({
  w: ["width"],
  h: ["height"],
  "min-w": ["min-width"],
  "min-h": ["min-height"],
  size: ["width", "height"],
});

const BLOCK_PROPERTIES: ReadonlySet<SizeProperty> = new Set([
  "height",
  "min-height",
  "block-size",
  "min-block-size",
]);
const MINIMUM_PROPERTIES: ReadonlySet<SizeProperty> = new Set(["min-height", "min-block-size"]);

const COARSE_VARIANTS: ReadonlySet<string> = new Set(["pointer-coarse", "any-pointer-coarse"]);
const FINE_VARIANTS: ReadonlySet<string> = new Set(["pointer-fine", "any-pointer-fine"]);

export const TOUCH_TARGET_TAGS: ReadonlySet<string> = new Set([
  "button",
  "input",
  "select",
  "textarea",
  "summary",
]);

export const TOUCH_TARGET_ROLES_ATTRIBUTE: ReadonlySet<string> = new Set([
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
  "combobox",
  "slider",
  "spinbutton",
  "textbox",
  "searchbox",
  "treeitem",
]);

export const TOUCH_TARGET_COMPONENTS: ReadonlySet<string> = new Set([
  "Button",
  "Input",
  "Textarea",
  "SelectTrigger",
  "SelectItem",
  "Checkbox",
  "Switch",
  "RadioGroupItem",
  "NumberFieldInput",
  "NumberFieldIncrement",
  "NumberFieldDecrement",
  "TabsTrigger",
  "PaginationLink",
  "PaginationPrevious",
  "PaginationNext",
  "CommandItem",
  "ComboboxInput",
  "DropdownMenuTrigger",
  "DropdownMenuItem",
  "BreadcrumbLink",
  "SidebarMenuButton",
]);

const PX_LENGTH = /^(-?(?:\d+\.?\d*|\.\d+))px$/i;
const REM_LENGTH = /^(-?(?:\d+\.?\d*|\.\d+))rem$/i;
const IMPORTANT = /\s*!important\s*$/i;
const UTILITY_ARBITRARY = /^(min-w|min-h|w|h|size)-\[(.+)\]$/;
const UTILITY_VARIABLE = /^(min-w|min-h|w|h|size)-\((--[A-Za-z0-9_-]+)\)$/;
const UTILITY_SCALE = /^(min-w|min-h|w|h|size)-(\d+(?:\.\d+)?|px)$/;
const ARBITRARY_PROPERTY = /^\[([a-z-]+):(.+)\]$/;
const TYPE_HINT = /^(?:length|size):/;
const CSS_DECLARATION =
  /(?<![\w-])(min-width|min-height|width|height|min-inline-size|min-block-size|inline-size|block-size)\s*:\s*([^;{}]+)/g;

export type SizeSource = "style" | "class" | "css";

export interface SizeDeclaration {
  readonly property: SizeProperty;
  readonly value: string;
  readonly text: string;
  readonly px: number | null;
  readonly pixels: boolean;
  readonly hitTarget: boolean;
  readonly variants: readonly string[];
  readonly source: SizeSource;
  readonly position: number;
}

export interface ParsedLength {
  readonly px: number;
  readonly pixels: boolean;
}

export function parseLength(value: string): ParsedLength | null {
  const trimmed = value.replace(IMPORTANT, "").trim();
  const px = PX_LENGTH.exec(trimmed);
  if (px !== null) return { px: Number(px[1]), pixels: true };
  const rem = REM_LENGTH.exec(trimmed);
  if (rem !== null) return { px: Number(rem[1]) * ROOT_FONT_PX, pixels: false };
  return null;
}

function referencesHitTarget(value: string): boolean {
  return new RegExp(`^var\\(\\s*${HIT_TARGET_TOKEN}\\s*(?:,[^()]*)?\\)$`).test(
    value.replace(IMPORTANT, "").trim(),
  );
}

function declaration(
  property: SizeProperty,
  value: string,
  text: string,
  source: SizeSource,
  position: number,
  variants: readonly string[] = [],
  length: ParsedLength | null = parseLength(value),
): SizeDeclaration {
  return Object.freeze({
    property,
    value,
    text,
    px: length?.px ?? null,
    pixels: length?.pixels ?? false,
    hitTarget: referencesHitTarget(value),
    variants: Object.freeze([...variants]),
    source,
    position,
  });
}

function arbitraryContent(raw: string): string {
  const spaced = raw.replace(/(?<!\\)_/g, " ").replace(/\\_/g, "_");
  return spaced.replace(TYPE_HINT, "");
}

function isSizeProperty(name: string): name is SizeProperty {
  return (SIZE_PROPERTIES as readonly string[]).includes(name);
}

export function classSizeDeclarations(token: string, position = 0): SizeDeclaration[] {
  const split = splitVariants(token);
  const variants = split.variants === "" ? [] : split.variants.slice(0, -1).split(":");
  const base = split.base.replace(/^!/, "").replace(/!$/, "");
  const arbitrary = UTILITY_ARBITRARY.exec(base);
  if (arbitrary !== null) {
    const value = arbitraryContent(arbitrary[2] ?? "");
    return (TAILWIND_UTILITIES[arbitrary[1] ?? ""] ?? []).map((property) =>
      declaration(property, value, token, "class", position, variants),
    );
  }
  const variable = UTILITY_VARIABLE.exec(base);
  if (variable !== null) {
    const value = `var(${variable[2] ?? ""})`;
    return (TAILWIND_UTILITIES[variable[1] ?? ""] ?? []).map((property) =>
      declaration(property, value, token, "class", position, variants),
    );
  }
  const scale = UTILITY_SCALE.exec(base);
  if (scale !== null) {
    const step = scale[2] ?? "";
    const px = step === "px" ? 1 : Number(step) * TAILWIND_SPACING_PX;
    return (TAILWIND_UTILITIES[scale[1] ?? ""] ?? []).map((property) =>
      declaration(property, base, token, "class", position, variants, { px, pixels: false }),
    );
  }
  const custom = ARBITRARY_PROPERTY.exec(base);
  if (custom !== null && isSizeProperty(custom[1] ?? "")) {
    const value = arbitraryContent(custom[2] ?? "");
    return [declaration(custom[1] as SizeProperty, value, token, "class", position, variants)];
  }
  return [];
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

function propertyKey(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

export function styleSizeDeclarations(
  source: ts.SourceFile,
  element: ts.JsxOpeningLikeElement,
): SizeDeclaration[] {
  const style = jsxAttributes(element).get("style");
  const expression =
    style?.initializer && ts.isJsxExpression(style.initializer)
      ? style.initializer.expression
      : undefined;
  if (expression === undefined || !ts.isObjectLiteralExpression(expression)) return [];
  const found: SizeDeclaration[] = [];
  for (const entry of expression.properties) {
    if (!ts.isPropertyAssignment(entry)) continue;
    const key = propertyKey(entry.name);
    const property = key === null ? undefined : STYLE_KEYS[key];
    if (property === undefined) continue;
    const position = entry.getStart(source);
    const text = `${key}: ${entry.initializer.getText(source)}`;
    const number = staticNumber(entry.initializer);
    if (number !== null) {
      found.push(
        declaration(property, `${number}`, text, "style", position, [], {
          px: number,
          pixels: true,
        }),
      );
      continue;
    }
    const initializer = entry.initializer;
    if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
      found.push(declaration(property, initializer.text, text, "style", position));
    }
  }
  return found;
}

export function elementSizeDeclarations(
  source: ts.SourceFile,
  element: ts.JsxOpeningLikeElement,
): SizeDeclaration[] {
  const attributes = jsxAttributes(element);
  const found = styleSizeDeclarations(source, element);
  for (const name of ["className", "class"]) {
    const attribute = attributes.get(name);
    if (attribute === undefined) continue;
    for (const { token, position } of classTokens(source, attribute)) {
      found.push(...classSizeDeclarations(token, position));
    }
  }
  return found;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

export function cssSizeDeclarations(css: string): SizeDeclaration[] {
  const text = stripComments(css);
  const found: SizeDeclaration[] = [];
  for (const match of text.matchAll(CSS_DECLARATION)) {
    const property = match[1] as SizeProperty;
    const value = (match[2] ?? "").trim();
    found.push(declaration(property, value, `${property}: ${value}`, "css", match.index ?? 0));
  }
  return found;
}

export function isFixedPixelSize(entry: SizeDeclaration): boolean {
  return entry.pixels && entry.px !== null && entry.px !== 0;
}

function appliesOnCoarse(entry: SizeDeclaration): boolean {
  return !entry.variants.some((variant) => FINE_VARIANTS.has(variant));
}

function alwaysOnCoarse(entry: SizeDeclaration): boolean {
  return entry.variants.every((variant) => COARSE_VARIANTS.has(variant));
}

export function touchTargetShortfall(
  declarations: readonly SizeDeclaration[],
): SizeDeclaration | null {
  const block = declarations.filter((entry) => BLOCK_PROPERTIES.has(entry.property));
  const met = block.some(
    (entry) =>
      MINIMUM_PROPERTIES.has(entry.property) &&
      alwaysOnCoarse(entry) &&
      (entry.hitTarget || (entry.px !== null && entry.px >= TOUCH_TARGET_PX)),
  );
  if (met) return null;
  return (
    block.find(
      (entry) =>
        appliesOnCoarse(entry) && entry.px !== null && entry.px > 0 && entry.px < TOUCH_TARGET_PX,
    ) ?? null
  );
}

function staticAttribute(attribute: ts.JsxAttribute | undefined): string | null {
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

export function controlName(element: ts.JsxOpeningLikeElement): string | null {
  const tag = element.tagName.getText();
  const attributes = jsxAttributes(element);
  const role = staticAttribute(attributes.get("role"));
  if (role !== null && TOUCH_TARGET_ROLES_ATTRIBUTE.has(role)) return `<${tag} role="${role}">`;
  if (TOUCH_TARGET_COMPONENTS.has(tag)) return `<${tag}>`;
  if (tag === "a") return attributes.has("href") ? "<a href>" : null;
  if (tag === "input" && staticAttribute(attributes.get("type"))?.toLowerCase() === "hidden") {
    return null;
  }
  return TOUCH_TARGET_TAGS.has(tag) ? `<${tag}>` : null;
}

function describe(entry: SizeDeclaration): string {
  return entry.source === "class" ? `"${entry.text}"` : entry.text;
}

function withArticle(role: FileRole): string {
  return /^[aeiou]/.test(role) ? `an ${role}` : `a ${role}`;
}

function fixedSizeHint(entry: SizeDeclaration): string {
  return `Let the part size to its container: drop the pixel ${entry.property} and lay it out with Page.Stack or Page.Grid, or use a fluid value such as a percentage, a rem or ch range in clamp(), var(--rex-measure) or var(--rex-control-height). Docs: ${errorDocs(FIXED_SIZE_ERROR)}`;
}

function touchTargetHint(): string {
  return `Give the control min-height: var(${HIT_TARGET_TOKEN}) (min-h-(${HIT_TARGET_TOKEN}) or pointer-coarse:min-h-11 in Tailwind), or use the DesignX primitive's own size, so it reaches ${TOUCH_TARGET_PX} px on coarse pointers. Docs: ${errorDocs(TOUCH_TARGET_ERROR)}`;
}

function cssModules(sources: SourceLoader, file: AppFile): string[] {
  const found: string[] = [];
  for (const ref of sources.imports(file.path)) {
    if (ref.kind !== "import" || ref.typeOnly || !isCssModule(ref.specifier)) continue;
    const resolved = sources.resolve(file.path, ref.specifier);
    if (resolved !== null) found.push(resolved);
  }
  return found;
}

function fixedSizeFindings(
  sources: SourceLoader,
  file: AppFile,
  relative: (file: string) => string,
  seenCss: Set<string>,
): Finding[] {
  const source = sources.load(file.path);
  const findings: Finding[] = [];
  const reported = new Set<string>();
  const report = (entry: SizeDeclaration, where: string, at: Location, origin: string) => {
    const key = `${where}:${at.line}:${at.column}`;
    if (reported.has(key)) return;
    reported.add(key);
    findings.push(
      finding({
        rule: FIXED_SIZE_CODE,
        file: where,
        ...at,
        message: `${origin} sets ${describe(entry)} in pixels on part ${file.name}`,
        hint: fixedSizeHint(entry),
      }),
    );
  };
  for (const element of jsxElements(source)) {
    for (const entry of elementSizeDeclarations(source, element)) {
      if (!isFixedPixelSize(entry)) continue;
      const origin = entry.source === "style" ? "inline style" : "class";
      report(entry, file.file, sources.location(file.path, entry.position), origin);
    }
  }
  for (const css of cssModules(sources, file)) {
    if (seenCss.has(css)) continue;
    seenCss.add(css);
    const text = sources.read(css);
    for (const entry of cssSizeDeclarations(text)) {
      if (!isFixedPixelSize(entry)) continue;
      const before = text.slice(0, entry.position).split("\n");
      report(
        entry,
        relative(css),
        { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 },
        "CSS module",
      );
    }
  }
  return findings;
}

function touchTargetFindings(sources: SourceLoader, file: AppFile): Finding[] {
  const source = sources.load(file.path);
  const findings: Finding[] = [];
  for (const element of jsxElements(source)) {
    const control = controlName(element);
    if (control === null) continue;
    const short = touchTargetShortfall(elementSizeDeclarations(source, element));
    if (short === null) continue;
    findings.push(
      finding({
        rule: TOUCH_TARGET_CODE,
        file: file.file,
        ...sources.location(file.path, short.position),
        message: `${control} in ${withArticle(file.role)} declares ${describe(short)} (${short.px} px), under the ${TOUCH_TARGET_PX} px touch target`,
        hint: touchTargetHint(),
      }),
    );
  }
  return findings;
}

export const layoutRule = defineRule({
  id: "layout",
  description:
    "Reports pixel widths and heights on parts (inline styles, Tailwind arbitrary values and imported CSS modules) and controls in regions, parts and overlays whose declared height or min-height is under the 44 px touch target on coarse pointers.",
  check({ app, sources }) {
    const seenCss = new Set<string>();
    const findings: Finding[] = [];
    for (const file of app.files) {
      if (FIXED_SIZE_ROLES.includes(file.role)) {
        findings.push(...fixedSizeFindings(sources, file, app.relative, seenCss));
      }
      if (TOUCH_TARGET_ROLES.includes(file.role)) {
        findings.push(...touchTargetFindings(sources, file));
      }
    }
    return findings;
  },
});
