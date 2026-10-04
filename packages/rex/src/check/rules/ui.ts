import { existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { DESIGNX_UI_DIR } from "../../cli/designx.ts";
import { CONFIG_FILE, UI_KITS, type UiKit } from "../../core/config.ts";
import { errorDocs, type RexErrorCode } from "../../core/errors.ts";
import {
  DESIGNX_MAP,
  DESIGNX_REGISTRY_URL,
  type DesignxItemName,
  type DesignxSurface,
} from "../../designx/index.ts";
import type { AppFile, FileRole } from "../engine.ts";
import { defineRule, finding, type Finding, type SourceLoader } from "../rule.ts";
import { jsxAttributes } from "./tokens.ts";

export const DESIGNX_PRIMITIVE_CODE = "ui/designx-primitive";
export const DESIGNX_PRIMITIVE_ERROR: RexErrorCode = "REX509";
export const UI_CONFIG_CODE = "ui/config";

export const DESIGNX_PRIMITIVE_ROLES: readonly FileRole[] = Object.freeze([
  "region",
  "part",
  "overlay",
]);

export const RAW_PRIMITIVE_TAGS = [
  "button",
  "input",
  "select",
  "textarea",
  "table",
  "dialog",
] as const;

export type RawPrimitiveTag = (typeof RAW_PRIMITIVE_TAGS)[number];

const TAG_SURFACES: Readonly<Record<RawPrimitiveTag, DesignxSurface>> = Object.freeze({
  button: "button",
  input: "input",
  select: "select",
  textarea: "textarea",
  table: "list",
  dialog: "sheet",
});

const INPUT_TYPE_SURFACES: Readonly<Record<string, DesignxSurface>> = Object.freeze({
  checkbox: "checkbox",
  radio: "radioGroup",
  number: "numberField",
});

const UNRENDERED_INPUT_TYPES: ReadonlySet<string> = new Set(["hidden"]);

const UI_CONFIG_HINT =
  'Write ui in rex.config.ts as a literal: ui: "designx", ui: "none" or ui: { kit: "designx", components: "app/components/Shell.tsx" }.';

export interface UiConfigRead {
  readonly kit: UiKit;
  readonly findings: readonly Finding[];
}

export interface RawPrimitiveSite {
  readonly node: ts.Node;
  readonly tag: RawPrimitiveTag;
  readonly surface: DesignxSurface;
  readonly form: "jsx" | "createElement";
}

export interface DesignxPrimitive {
  readonly surface: DesignxSurface;
  readonly items: readonly DesignxItemName[];
  readonly forms: Readonly<Record<string, readonly string[]>>;
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

function keyOf(name: ts.PropertyName): string | null {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name)
  ) {
    return name.text;
  }
  return null;
}

function staticString(node: ts.Node | undefined): string | null {
  if (node === undefined) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function property(
  object: ts.ObjectLiteralExpression,
  name: string,
): ts.ObjectLiteralElementLike | undefined {
  return object.properties.find(
    (entry) =>
      (ts.isPropertyAssignment(entry) || ts.isShorthandPropertyAssignment(entry)) &&
      keyOf(entry.name) === name,
  );
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

function isUiKit(value: string): value is UiKit {
  return (UI_KITS as readonly string[]).includes(value);
}

export function readUiConfig(root: string, sources: SourceLoader): UiConfigRead {
  const file = path.join(path.resolve(root), CONFIG_FILE);
  const none: UiConfigRead = { kit: "none", findings: [] };
  if (!existsSync(file)) return none;
  const config = configObject(sources.load(file));
  if (config === null) return none;
  const report = (at: ts.Node, message: string): UiConfigRead => ({
    kit: "none",
    findings: [
      finding({
        rule: UI_CONFIG_CODE,
        file: CONFIG_FILE,
        ...sources.location(file, at),
        message,
        hint: UI_CONFIG_HINT,
      }),
    ],
  });
  const ui = property(config, "ui");
  if (ui === undefined) return none;
  if (!ts.isPropertyAssignment(ui)) {
    return report(
      ui,
      "ui in rex.config.ts is not a static literal, so rex check cannot read ui.kit",
    );
  }
  const value = unwrap(ui.initializer);
  let kitNode: ts.Expression = value;
  if (ts.isObjectLiteralExpression(value)) {
    const kit = property(value, "kit");
    if (kit === undefined) return none;
    if (!ts.isPropertyAssignment(kit)) {
      return report(
        kit,
        "ui.kit in rex.config.ts is not a static literal, so rex check cannot read it",
      );
    }
    kitNode = unwrap(kit.initializer);
  }
  const kit = staticString(kitNode);
  if (kit === null) {
    return report(
      kitNode,
      "ui.kit in rex.config.ts is not a static literal, so rex check cannot read it",
    );
  }
  if (!isUiKit(kit)) {
    return report(kitNode, `ui.kit "${kit}" in rex.config.ts is not one of ${UI_KITS.join(", ")}`);
  }
  return { kit, findings: [] };
}

function isRawPrimitiveTag(tag: string): tag is RawPrimitiveTag {
  return (RAW_PRIMITIVE_TAGS as readonly string[]).includes(tag);
}

function surfaceOf(tag: RawPrimitiveTag, inputType: string | null): DesignxSurface | null {
  if (tag !== "input" || inputType === null) return TAG_SURFACES[tag];
  const type = inputType.toLowerCase();
  if (UNRENDERED_INPUT_TYPES.has(type)) return null;
  return INPUT_TYPE_SURFACES[type] ?? TAG_SURFACES.input;
}

function isCreateElementCall(node: ts.CallExpression): boolean {
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text === "createElement";
  return ts.isPropertyAccessExpression(callee) && callee.name.text === "createElement";
}

function jsxInputType(element: ts.JsxOpeningLikeElement): string | null {
  const initializer = jsxAttributes(element).get("type")?.initializer;
  if (initializer === undefined) return null;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (ts.isJsxExpression(initializer) && initializer.expression !== undefined) {
    return staticString(unwrap(initializer.expression));
  }
  return null;
}

function createElementInputType(call: ts.CallExpression): string | null {
  const props = call.arguments[1];
  if (props === undefined) return null;
  const object = unwrap(props);
  if (!ts.isObjectLiteralExpression(object)) return null;
  const type = property(object, "type");
  return type !== undefined && ts.isPropertyAssignment(type)
    ? staticString(unwrap(type.initializer))
    : null;
}

export function rawPrimitiveSites(source: ts.SourceFile): RawPrimitiveSite[] {
  const found: RawPrimitiveSite[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      isRawPrimitiveTag(node.tagName.text)
    ) {
      const tag = node.tagName.text;
      const surface = surfaceOf(tag, jsxInputType(node));
      if (surface !== null) found.push({ node, tag, surface, form: "jsx" });
    } else if (ts.isCallExpression(node) && isCreateElementCall(node)) {
      const tag = staticString(node.arguments[0]);
      if (tag !== null && isRawPrimitiveTag(tag)) {
        const surface = surfaceOf(tag, createElementInputType(node));
        if (surface !== null) found.push({ node, tag, surface, form: "createElement" });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

export function designxPrimitive(surface: DesignxSurface): DesignxPrimitive {
  const entries = Object.entries(DESIGNX_MAP[surface] as Readonly<Record<string, DesignxItemName>>);
  const forms: Record<string, string[]> = {};
  for (const [form, item] of entries) (forms[item] ??= []).push(form);
  const items = Object.keys(forms) as DesignxItemName[];
  return Object.freeze({
    surface,
    items: Object.freeze(items),
    forms: Object.freeze(Object.fromEntries(entries.length > 1 ? Object.entries(forms) : [])),
  });
}

export function designxPrimitiveHint(tag: RawPrimitiveTag, surface: DesignxSurface): string {
  const primitive = designxPrimitive(surface);
  const named = primitive.items.map((item) => {
    const forms = primitive.forms[item];
    const module = `${DESIGNX_UI_DIR}/${item}.tsx`;
    return forms === undefined
      ? `${item} (${module})`
      : `${item} (${module}) for ${forms.join(", ")}`;
  });
  return `Replace the raw <${tag}> with the DesignX ${named.join(" or ")} primitive that rex/designx maps the ${surface} surface to; rex new installs it into ${DESIGNX_UI_DIR} from ${DESIGNX_REGISTRY_URL}/${primitive.items[0]}.json. Docs: ${errorDocs(DESIGNX_PRIMITIVE_ERROR)}`;
}

function checkFile(sources: SourceLoader, file: AppFile): Finding[] {
  const source = sources.load(file.path);
  return rawPrimitiveSites(source).map((site) => {
    const primitive = designxPrimitive(site.surface);
    const written = site.form === "jsx" ? `<${site.tag}>` : `createElement("${site.tag}")`;
    return finding({
      rule: DESIGNX_PRIMITIVE_CODE,
      file: file.file,
      ...sources.location(file.path, site.node),
      message: `${written} in ${/^[aeiou]/.test(file.role) ? "an" : "a"} ${file.role} bypasses the DesignX ${primitive.items.join(" or ")} primitive`,
      hint: designxPrimitiveHint(site.tag, site.surface),
    });
  });
}

export const uiRule = defineRule({
  id: "ui",
  description:
    "When rex.config.ts sets ui.kit to designx, reports raw button, input, select, textarea, table and dialog elements in regions, parts and overlays, naming the DesignX primitive rex/designx maps the surface to.",
  check({ app, sources }) {
    const config = readUiConfig(app.root, sources);
    if (config.kit !== "designx") return config.findings;
    return [
      ...config.findings,
      ...app.files
        .filter((file) => DESIGNX_PRIMITIVE_ROLES.includes(file.role))
        .flatMap((file) => checkFile(sources, file)),
    ];
  },
});
