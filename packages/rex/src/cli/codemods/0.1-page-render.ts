import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { discoverApp, type AppFile, type FileRole, type RexApp } from "../../check/engine.ts";
import { configProperty } from "../../check/rules/render.ts";
import { createSourceLoader, isRelativeSpecifier, type SourceLoader } from "../../check/rule.ts";
import type { PageRender } from "../../core/page.ts";
import {
  applyEdits,
  defineCodemod,
  parseSource,
  relativeFile,
  unwrapExpression,
  type CodemodChange,
  type CodemodResult,
  type TextEdit,
} from "./codemod.ts";

export const CSR_RENDER: PageRender = "csr";

export const BROWSER_GLOBALS: readonly string[] = Object.freeze([
  "window",
  "document",
  "localStorage",
  "sessionStorage",
  "navigator",
  "location",
  "history",
  "matchMedia",
]);

export const EFFECT_HOOKS: readonly string[] = Object.freeze([
  "useEffect",
  "useLayoutEffect",
  "useInsertionEffect",
]);

const RENDERED_ROLES: readonly FileRole[] = Object.freeze([
  "view",
  "states",
  "region",
  "part",
  "hook",
  "overlay",
  "component",
  "data",
]);

const EVENT_ATTRIBUTE = /^on[A-Z]/;

function declaredNames(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      (ts.isVariableDeclaration(node) ||
        ts.isParameter(node) ||
        ts.isBindingElement(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isImportClause(node) ||
        ts.isImportSpecifier(node) ||
        ts.isNamespaceImport(node)) &&
      node.name !== undefined &&
      ts.isIdentifier(node.name)
    ) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

function isEffectCallback(node: ts.Node): boolean {
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) return false;
  const parent = node.parent;
  if (!ts.isCallExpression(parent) || !parent.arguments.includes(node as ts.Expression)) {
    return false;
  }
  const callee = parent.expression;
  const name = ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : null;
  return name !== null && EFFECT_HOOKS.includes(name);
}

function isDeferred(node: ts.Node): boolean {
  for (let current: ts.Node = node.parent; !ts.isSourceFile(current); current = current.parent) {
    if (isEffectCallback(current)) return true;
    if (
      ts.isJsxAttribute(current) &&
      ts.isIdentifier(current.name) &&
      EVENT_ATTRIBUTE.test(current.name.text)
    ) {
      return true;
    }
  }
  return false;
}

function isInsideType(node: ts.Node): boolean {
  for (let current: ts.Node = node.parent; !ts.isSourceFile(current); current = current.parent) {
    if (ts.isTypeNode(current)) return true;
  }
  return false;
}

function isReference(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isShorthandPropertyAssignment(parent)) return true;
  if ((parent as { readonly name?: ts.Node }).name === node) return false;
  if (ts.isTypeOfExpression(parent)) return false;
  return !isInsideType(node);
}

export function renderTimeBrowserReads(source: ts.SourceFile): ts.Identifier[] {
  const declared = declaredNames(source);
  const found: ts.Identifier[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isIdentifier(node) &&
      BROWSER_GLOBALS.includes(node.text) &&
      !declared.has(node.text) &&
      isReference(node) &&
      !isDeferred(node)
    ) {
      found.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function pageModules(app: RexApp, sources: SourceLoader, pageId: string): string[] {
  const queue = app.files
    .filter((file) => file.page === pageId && RENDERED_ROLES.includes(file.role))
    .map((file) => file.path);
  const seen = new Set<string>();
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const ref of sources.imports(file)) {
      if (ref.typeOnly || !isRelativeSpecifier(ref.specifier)) continue;
      const resolved = sources.resolve(file, ref.specifier);
      if (resolved === null) continue;
      const target: AppFile | undefined = app.fileAt(resolved);
      if (target === undefined || !RENDERED_ROLES.includes(target.role)) continue;
      queue.push(target.path);
    }
  }
  return [...seen].sort();
}

export function reliesOnClientRendering(
  app: RexApp,
  sources: SourceLoader,
  pageId: string,
): boolean {
  return pageModules(app, sources, pageId).some(
    (file) => renderTimeBrowserReads(sources.load(file)).length > 0,
  );
}

function propertyName(property: ts.ObjectLiteralElementLike): string | null {
  const name = property.name;
  if (name === undefined) return null;
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null;
}

function lineIndent(text: string, position: number): string {
  const lineStart = text.lastIndexOf("\n", position - 1) + 1;
  return /^[ \t]*/.exec(text.slice(lineStart, position))?.[0] ?? "";
}

export function renderPropertyEdit(
  source: ts.SourceFile,
  literal: ts.ObjectLiteralExpression,
  value: PageRender,
): TextEdit {
  const text = source.text;
  const field = `render: ${JSON.stringify(value)}`;
  const properties = literal.properties;
  const open = literal.getStart(source) + 1;
  const first = properties[0];
  if (first === undefined) {
    return { start: literal.getStart(source), end: literal.getEnd(), text: `{ ${field} }` };
  }
  const multiline = text.slice(open, first.getStart(source)).includes("\n");
  const anchor = properties.find((property) => propertyName(property) === "route") ?? null;
  if (anchor === null) {
    return multiline
      ? { start: open, end: open, text: `\n${lineIndent(text, first.getStart(source))}${field},` }
      : { start: open, end: open, text: ` ${field},` };
  }
  const after = anchor.getEnd();
  const comma = /^\s*,/.exec(text.slice(after));
  const indent = lineIndent(text, anchor.getStart(source));
  if (comma !== null) {
    const position = after + comma[0].length;
    return {
      start: position,
      end: position,
      text: multiline ? `\n${indent}${field},` : ` ${field},`,
    };
  }
  return { start: after, end: after, text: multiline ? `,\n${indent}${field}` : `, ${field}` };
}

export function addPageRender(file: string, text: string, value: PageRender): string | null {
  const source = parseSource(file, text);
  for (const statement of source.statements) {
    if (!ts.isExportAssignment(statement) || statement.isExportEquals) continue;
    const call = unwrapExpression(statement.expression);
    if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) continue;
    if (call.expression.text !== "page") continue;
    if (configProperty(call, "render") !== null) return null;
    const config = call.arguments[1];
    if (config === undefined) return null;
    const literal = unwrapExpression(config);
    if (!ts.isObjectLiteralExpression(literal)) return null;
    return applyEdits(text, [renderPropertyEdit(source, literal, value)]);
  }
  return null;
}

export const codemod = defineCodemod({
  id: "0.1-page-render",
  from: "0.1",
  description:
    'keep client rendering with render: "csr" on pages that read browser globals while rendering; every other page takes the 0.2 default',
  run(root: string): CodemodResult {
    if (!existsSync(path.join(root, "app"))) return { changes: [], flags: [] };
    const app = discoverApp(root);
    const sources = createSourceLoader();
    const changes: CodemodChange[] = [];
    for (const entry of app.pages) {
      if (entry.page === null) continue;
      if (!reliesOnClientRendering(app, sources, entry.id)) continue;
      const text = readFileSync(entry.page.path, "utf8");
      const migrated = addPageRender(entry.page.path, text, CSR_RENDER);
      if (migrated === null || migrated === text) continue;
      changes.push({ file: relativeFile(root, entry.page.path), text: migrated });
    }
    return { changes, flags: [] };
  },
});
