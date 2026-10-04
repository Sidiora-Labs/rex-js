import { existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { MSG_PREFIX, parseMessageRef } from "../../client/i18n/messages.ts";
import { CONFIG_FILE } from "../../core/config.ts";
import { COMPONENT_ROLES, type AppFile } from "../engine.ts";
import { defineRule, finding, type Finding, type SourceLoader } from "../rule.ts";
import { jsxAttributes, jsxElements } from "./tokens.ts";

export const I18N_TEXT_PROPERTIES: readonly string[] = Object.freeze(["label", "title"]);
export const I18N_TEXT_ATTRIBUTES: readonly string[] = Object.freeze([
  "label",
  "title",
  "aria-label",
]);

export interface I18nCheckSettings {
  readonly configured: boolean;
  readonly allow: readonly string[];
}

export interface I18nConfigRead extends I18nCheckSettings {
  readonly findings: readonly Finding[];
}

const UNCONFIGURED: I18nConfigRead = Object.freeze({
  configured: false,
  allow: Object.freeze([]),
  findings: Object.freeze([]),
});

const CONFIG_HINT =
  'Write check.i18n in rex.config.ts as a literal object: { allow: ["Rex", ...] } listing texts that stay untranslated.';

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

function stringLiteral(
  node: ts.Node | undefined,
): ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | null {
  if (node === undefined) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node;
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

export function readI18nConfig(root: string, sources: SourceLoader): I18nConfigRead {
  const file = path.join(path.resolve(root), CONFIG_FILE);
  if (!existsSync(file)) return UNCONFIGURED;
  const config = configObject(sources.load(file));
  if (config === null) return UNCONFIGURED;
  const configured = property(config, "i18n") !== undefined;
  const report = (at: ts.Node, message: string): I18nConfigRead => ({
    configured,
    allow: Object.freeze([]),
    findings: [
      finding({
        rule: "i18n/config",
        file: CONFIG_FILE,
        ...sources.location(file, at),
        message,
        hint: CONFIG_HINT,
      }),
    ],
  });
  const check = property(config, "check");
  if (check === undefined) return { configured, allow: Object.freeze([]), findings: [] };
  if (!ts.isPropertyAssignment(check) || !ts.isObjectLiteralExpression(unwrap(check.initializer))) {
    return report(
      check,
      "check in rex.config.ts is not a static object, so rex check cannot read check.i18n",
    );
  }
  const i18n = property(unwrap(check.initializer) as ts.ObjectLiteralExpression, "i18n");
  if (i18n === undefined) return { configured, allow: Object.freeze([]), findings: [] };
  if (!ts.isPropertyAssignment(i18n) || !ts.isObjectLiteralExpression(unwrap(i18n.initializer))) {
    return report(i18n, "check.i18n in rex.config.ts is not a static object");
  }
  const options = unwrap(i18n.initializer) as ts.ObjectLiteralExpression;
  for (const entry of options.properties) {
    const name = entry.name === undefined ? null : keyOf(entry.name);
    if (name !== "allow") {
      return report(entry, `check.i18n.${name ?? "?"} is not a check.i18n option; use allow`);
    }
  }
  const allowProperty = property(options, "allow");
  if (allowProperty === undefined) return { configured, allow: Object.freeze([]), findings: [] };
  const list = ts.isPropertyAssignment(allowProperty) ? unwrap(allowProperty.initializer) : null;
  if (list === null || !ts.isArrayLiteralExpression(list)) {
    return report(
      allowProperty,
      "check.i18n.allow in rex.config.ts must be a literal list of strings",
    );
  }
  const allow: string[] = [];
  for (const element of list.elements) {
    const literal = stringLiteral(element);
    if (literal === null) {
      return report(element, "check.i18n.allow in rex.config.ts must be a literal list of strings");
    }
    allow.push(literal.text);
  }
  return { configured, allow: Object.freeze(allow), findings: [] };
}

export type I18nTextProblem = "literal" | "invalid-key";

export function i18nTextProblem(text: string, allow: readonly string[]): I18nTextProblem | null {
  if (text.trim() === "" || allow.includes(text)) return null;
  if (text.startsWith(MSG_PREFIX)) return parseMessageRef(text) === null ? "invalid-key" : null;
  return "literal";
}

interface TextSite {
  readonly name: string;
  readonly node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral;
}

function declarationSites(sources: SourceLoader, file: AppFile): TextSite[] {
  const sites: TextSite[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node)) {
      const name = keyOf(node.name);
      const literal = stringLiteral(unwrap(node.initializer));
      if (name !== null && literal !== null && I18N_TEXT_PROPERTIES.includes(name)) {
        sites.push({ name, node: literal });
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  for (const declared of sources.declarations(file.path)) {
    for (const argument of declared.call.arguments.slice(1)) visit(argument);
  }
  return sites;
}

function jsxSites(sources: SourceLoader, file: AppFile): TextSite[] {
  const sites: TextSite[] = [];
  for (const element of jsxElements(sources.load(file.path))) {
    for (const [name, attribute] of jsxAttributes(element)) {
      if (!I18N_TEXT_ATTRIBUTES.includes(name)) continue;
      const initializer = attribute.initializer;
      const literal =
        initializer === undefined
          ? null
          : ts.isJsxExpression(initializer)
            ? initializer.expression === undefined
              ? null
              : stringLiteral(unwrap(initializer.expression))
            : stringLiteral(initializer);
      if (literal !== null) sites.push({ name, node: literal });
    }
  }
  return sites;
}

function checkFile(sources: SourceLoader, file: AppFile, settings: I18nCheckSettings): Finding[] {
  const sites = [
    ...declarationSites(sources, file),
    ...(COMPONENT_ROLES.includes(file.role) ? jsxSites(sources, file) : []),
  ];
  const findings: Finding[] = [];
  for (const site of sites) {
    const text = site.node.text;
    const problem = i18nTextProblem(text, settings.allow);
    if (problem === null) continue;
    findings.push(
      finding({
        rule: "i18n/literal",
        file: file.file,
        ...sources.location(file.path, site.node),
        message:
          problem === "literal"
            ? `${site.name} ${JSON.stringify(text)} is a literal; with i18n configured, labels and titles are msg: keys`
            : `${site.name} ${JSON.stringify(text)} is not a valid msg: key`,
        hint: `Add the text to app/locales/<default>.json and write "msg:<key>", or list ${JSON.stringify(text)} under check.i18n.allow in rex.config.ts.`,
      }),
    );
  }
  return findings;
}

export const i18nRule = defineRule({
  id: "i18n",
  description:
    "When rex.config.ts configures i18n, reports label and title literals in declarations and label, title and aria-label literals in components that are not msg: keys, honouring check.i18n.allow.",
  check({ app, sources }) {
    const config = readI18nConfig(app.root, sources);
    if (!config.configured) return config.findings;
    return [
      ...config.findings,
      ...app.files
        .filter((file) => file.role !== "test")
        .flatMap((file) => checkFile(sources, file, config)),
    ];
  },
});
