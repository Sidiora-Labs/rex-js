import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { CONFIG_FILE } from "../../core/config.ts";
import type { AppPage, RexApp } from "../engine.ts";
import { defineRule, finding, type Finding, type SourceLoader } from "../rule.ts";

export const STATIC_RENDER = "static";
export const REGION_BINDING = "region";
export const STATIC_POST_CODE = "render/static-post";
export const READ_EFFECT = "read";
export const STATIC_BUILD_SCRIPT = /\brex\s+build\b[^&|;]*?--target(?:=|\s+)static\b/;

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

export interface StaticDeployment {
  readonly script: string | null;
  readonly server: boolean;
  readonly apiOrigin: boolean;
}

function propertyName(element: ts.ObjectLiteralElementLike): string | null {
  const name = element.name;
  if (name === undefined) return null;
  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)
    ? name.text
    : null;
}

function findProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
): ts.ObjectLiteralElementLike | undefined {
  return object.properties.find((element) => propertyName(element) === name);
}

function configLiteral(source: ts.SourceFile): ts.ObjectLiteralExpression | null {
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

function staticBuildScript(root: string): string | null {
  const file = path.join(root, "package.json");
  if (!existsSync(file)) return null;
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { readonly scripts?: unknown };
  const scripts = parsed.scripts;
  if (typeof scripts !== "object" || scripts === null) return null;
  for (const [name, command] of Object.entries(scripts as Record<string, unknown>)) {
    if (typeof command === "string" && STATIC_BUILD_SCRIPT.test(command)) return name;
  }
  return null;
}

export function readStaticDeployment(root: string, sources: SourceLoader): StaticDeployment {
  const script = staticBuildScript(root);
  const file = path.join(root, CONFIG_FILE);
  const config = existsSync(file) ? configLiteral(sources.load(file)) : null;
  if (config === null) return { script, server: false, apiOrigin: false };
  const client = findProperty(config, "client");
  const clientValue =
    client !== undefined && ts.isPropertyAssignment(client) ? unwrap(client.initializer) : null;
  const apiOrigin =
    clientValue !== null &&
    ts.isObjectLiteralExpression(clientValue) &&
    findProperty(clientValue, "apiOrigin") !== undefined;
  return { script, server: findProperty(config, "server") !== undefined, apiOrigin };
}

export function buildsStaticWithoutApi(deployment: StaticDeployment): boolean {
  return deployment.script !== null && !deployment.server && !deployment.apiOrigin;
}

function checkStaticPosts(
  app: RexApp,
  sources: SourceLoader,
  entry: AppPage,
  script: string,
): Finding[] {
  if (entry.page === null) return [];
  const pageFile = entry.page;
  const declared = sources.pageDeclaration(pageFile.path);
  if (declared === null) return [];
  const findings: Finding[] = [];
  for (const ref of declared.actions) {
    if (ref.source === null || ref.imported === null) continue;
    const action = sources
      .declarations(ref.source)
      .find((candidate) => candidate.kind === "action" && candidate.exportName === ref.imported);
    if (action === undefined) continue;
    const effect = stringProperty(action.call, "effect");
    if (effect === READ_EFFECT) continue;
    findings.push(
      finding({
        rule: STATIC_POST_CODE,
        file: pageFile.file,
        line: ref.line,
        column: ref.column,
        message: `page "${declared.id}" declares mutating action "${action.id}" (effect ${effect === null ? "not a static literal" : JSON.stringify(effect)}), but the app builds for a static host (script "${script}" runs rex build --target static) and rex.config.ts sets no client.apiOrigin, so the action posts to a host that answers no POST (declared in ${app.relative(ref.source)})`,
        hint: `Set client: { apiOrigin: "https://api.example.com" } in rex.config.ts to the Rex server that runs action "${action.id}", or remove the action from page "${declared.id}".`,
      }),
    );
  }
  return findings;
}

export const renderRule = defineRule({
  id: "render",
  description:
    'Reports static pages (render: "static", zero JavaScript) that declare an action with a keyboard shortcut or an overlay bound to region state, both of which need JavaScript, and mutating actions on the pages of an app built by rex build --target static with no server and no client.apiOrigin, whose posts a static host cannot answer.',
  check({ app, sources }) {
    const deployment = readStaticDeployment(app.root, sources);
    const script = buildsStaticWithoutApi(deployment) ? deployment.script : null;
    return app.pages.flatMap((entry) => [
      ...checkPage(app, sources, entry),
      ...(script === null ? [] : checkStaticPosts(app, sources, entry, script)),
    ]);
  },
});
