import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { RexApp } from "./engine.ts";

export const SEVERITIES = ["error", "warning"] as const;

export type Severity = (typeof SEVERITIES)[number];

export interface Location {
  readonly line: number;
  readonly column: number;
}

export interface Finding {
  readonly rule: string;
  readonly severity: Severity;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
  readonly hint: string;
}

export interface FindingInput {
  readonly rule: string;
  readonly severity?: Severity;
  readonly file: string;
  readonly line?: number;
  readonly column?: number;
  readonly message: string;
  readonly hint: string;
}

const RULE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const FINDING_RULE_PATTERN = /^[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)?$/;

export function isRuleId(value: unknown): value is string {
  return typeof value === "string" && RULE_ID_PATTERN.test(value);
}

export function finding(input: FindingInput): Finding {
  if (typeof input.rule !== "string" || !FINDING_RULE_PATTERN.test(input.rule)) {
    throw new TypeError(
      `finding: rule ${JSON.stringify(input.rule)} must be "<rule>" or "<rule>/<code>" in kebab-case`,
    );
  }
  const severity = input.severity ?? "error";
  if (!(SEVERITIES as readonly string[]).includes(severity)) {
    throw new TypeError(`finding: severity must be one of ${SEVERITIES.join(", ")}`);
  }
  if (typeof input.file !== "string" || input.file.length === 0) {
    throw new TypeError("finding: file must be a non-empty path");
  }
  const line = input.line ?? 1;
  const column = input.column ?? 1;
  if (!Number.isInteger(line) || line < 1 || !Number.isInteger(column) || column < 1) {
    throw new TypeError("finding: line and column must be positive integers");
  }
  if (typeof input.message !== "string" || input.message.trim() === "") {
    throw new TypeError("finding: message must be a non-empty string");
  }
  if (typeof input.hint !== "string" || input.hint.trim() === "") {
    throw new TypeError("finding: hint must be a non-empty string");
  }
  return Object.freeze({
    rule: input.rule,
    severity,
    file: input.file.split(path.sep).join("/"),
    line,
    column,
    message: input.message,
    hint: input.hint,
  });
}

export interface RuleContext {
  readonly app: RexApp;
  readonly sources: SourceLoader;
}

export interface Rule {
  readonly id: string;
  readonly description: string;
  check(context: RuleContext): readonly Finding[] | Promise<readonly Finding[]>;
}

export function defineRule(rule: Rule): Rule {
  if (!isRuleId(rule.id)) {
    throw new TypeError(`defineRule: id ${JSON.stringify(rule.id)} must be kebab-case`);
  }
  if (typeof rule.description !== "string" || rule.description.trim() === "") {
    throw new TypeError(`defineRule: rule "${rule.id}" needs a description`);
  }
  if (typeof rule.check !== "function") {
    throw new TypeError(`defineRule: rule "${rule.id}" needs a check function`);
  }
  return Object.freeze({ id: rule.id, description: rule.description, check: rule.check });
}

export type ImportKind = "import" | "export" | "dynamic" | "require";

export interface ImportRef extends Location {
  readonly specifier: string;
  readonly kind: ImportKind;
  readonly typeOnly: boolean;
  readonly names: readonly string[];
  readonly locals: readonly string[];
}

export interface ExportRef extends Location {
  readonly name: string;
  readonly typeOnly: boolean;
  readonly from: string | null;
}

export const DECLARATION_FUNCTIONS = ["entity", "action", "page", "policy", "flow"] as const;

export type DeclarationFunction = (typeof DECLARATION_FUNCTIONS)[number];

export interface StaticDeclaration extends Location {
  readonly kind: DeclarationFunction;
  readonly id: string;
  readonly exportName: string;
  readonly call: ts.CallExpression;
}

export interface StaticName extends Location {
  readonly name: string;
}

export interface StaticOverlay extends Location {
  readonly id: string;
  readonly dismiss: string | null;
  readonly binding: string | null;
}

export interface StaticActionRef extends Location {
  readonly local: string;
  readonly specifier: string | null;
  readonly imported: string | null;
  readonly source: string | null;
}

export interface StaticPageDeclaration extends Location {
  readonly id: string;
  readonly route: string | null;
  readonly regions: readonly StaticName[];
  readonly overlays: readonly StaticOverlay[];
  readonly actions: readonly StaticActionRef[];
  readonly states: readonly StaticName[] | null;
  readonly unreadable: readonly string[];
}

export interface SourceLoader {
  read(file: string): string;
  load(file: string): ts.SourceFile;
  location(file: string, at: ts.Node | number): Location;
  imports(file: string): readonly ImportRef[];
  exports(file: string): readonly ExportRef[];
  resolve(from: string, specifier: string): string | null;
  declarations(file: string): readonly StaticDeclaration[];
  pageDeclaration(file: string): StaticPageDeclaration | null;
}

export function isRelativeSpecifier(specifier: string): boolean {
  return specifier === "." || specifier === ".." || /^\.{1,2}\//.test(specifier);
}

export function packageName(specifier: string): string | null {
  if (isRelativeSpecifier(specifier) || specifier.startsWith("/")) return null;
  const parts = specifier.split("/");
  if (specifier.startsWith("@")) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  return parts[0] ?? null;
}

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js") || file.endsWith(".mjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function isFile(candidate: string): boolean {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".d.ts"];

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
      false)
  );
}

function hasDefaultModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ??
      false)
  );
}

function stringValue(node: ts.Node | undefined): string | null {
  if (node === undefined) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function propertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function unwrapExpression(node: ts.Expression): ts.Expression {
  let current = node;
  for (;;) {
    if (
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isTypeAssertionExpression(current)
    ) {
      current = current.expression;
    } else {
      return current;
    }
  }
}

export function createSourceLoader(): SourceLoader {
  const texts = new Map<string, string>();
  const files = new Map<string, ts.SourceFile>();
  const importCache = new Map<string, readonly ImportRef[]>();
  const exportCache = new Map<string, readonly ExportRef[]>();
  const declarationCache = new Map<string, readonly StaticDeclaration[]>();
  const pageCache = new Map<string, StaticPageDeclaration | null>();

  const read = (file: string): string => {
    const key = path.resolve(file);
    let text = texts.get(key);
    if (text === undefined) {
      text = readFileSync(key, "utf8");
      texts.set(key, text);
    }
    return text;
  };

  const load = (file: string): ts.SourceFile => {
    const key = path.resolve(file);
    let source = files.get(key);
    if (source === undefined) {
      source = ts.createSourceFile(key, read(key), ts.ScriptTarget.Latest, true, scriptKind(key));
      files.set(key, source);
    }
    return source;
  };

  const location = (file: string, at: ts.Node | number): Location => {
    const source = load(file);
    const position = typeof at === "number" ? at : at.getStart(source);
    const { line, character } = source.getLineAndCharacterOfPosition(position);
    return { line: line + 1, column: character + 1 };
  };

  const imports = (file: string): readonly ImportRef[] => {
    const key = path.resolve(file);
    const cached = importCache.get(key);
    if (cached) return cached;
    const source = load(key);
    const refs: ImportRef[] = [];
    const push = (
      node: ts.Node,
      specifier: string,
      kind: ImportKind,
      typeOnly: boolean,
      names: string[],
      locals: string[],
    ) => {
      refs.push(
        Object.freeze({
          specifier,
          kind,
          typeOnly,
          names: Object.freeze(names),
          locals: Object.freeze(locals),
          ...location(key, node),
        }),
      );
    };
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node)) {
        const specifier = stringValue(node.moduleSpecifier);
        if (specifier !== null) {
          const clause = node.importClause;
          const names: string[] = [];
          const locals: string[] = [];
          let typeOnly = clause?.isTypeOnly ?? false;
          if (clause) {
            if (clause.name) {
              names.push("default");
              locals.push(clause.name.text);
            }
            const bindings = clause.namedBindings;
            if (bindings && ts.isNamespaceImport(bindings)) {
              names.push("*");
              locals.push(bindings.name.text);
            } else if (bindings && ts.isNamedImports(bindings)) {
              for (const element of bindings.elements) {
                names.push((element.propertyName ?? element.name).text);
                locals.push(element.name.text);
              }
              if (
                !typeOnly &&
                !clause.name &&
                bindings.elements.length > 0 &&
                bindings.elements.every((element) => element.isTypeOnly)
              ) {
                typeOnly = true;
              }
            }
          }
          push(node, specifier, "import", typeOnly, names, locals);
        }
        return;
      }
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        const specifier = stringValue(node.moduleSpecifier);
        if (specifier !== null) {
          const names: string[] = [];
          const clause = node.exportClause;
          if (!clause) names.push("*");
          else if (ts.isNamespaceExport(clause)) names.push("*");
          else
            for (const element of clause.elements)
              names.push((element.propertyName ?? element.name).text);
          push(node, specifier, "export", node.isTypeOnly, names, []);
        }
        return;
      }
      if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference)
      ) {
        const specifier = stringValue(node.moduleReference.expression);
        if (specifier !== null) {
          push(node, specifier, "require", node.isTypeOnly, ["*"], [node.name.text]);
        }
        return;
      }
      if (ts.isCallExpression(node)) {
        const specifier = stringValue(node.arguments[0]);
        if (specifier !== null && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          push(node, specifier, "dynamic", false, ["*"], []);
        } else if (
          specifier !== null &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "require"
        ) {
          push(node, specifier, "require", false, ["*"], []);
        }
      }
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        const specifier = stringValue(node.argument.literal);
        if (specifier !== null) push(node, specifier, "import", true, ["*"], []);
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(source, visit);
    const frozen = Object.freeze(refs);
    importCache.set(key, frozen);
    return frozen;
  };

  const exports = (file: string): readonly ExportRef[] => {
    const key = path.resolve(file);
    const cached = exportCache.get(key);
    if (cached) return cached;
    const source = load(key);
    const refs: ExportRef[] = [];
    const push = (node: ts.Node, name: string, typeOnly: boolean, from: string | null) => {
      refs.push(Object.freeze({ name, typeOnly, from, ...location(key, node) }));
    };
    for (const statement of source.statements) {
      if (ts.isExportAssignment(statement)) {
        push(statement, "default", false, null);
        continue;
      }
      if (ts.isExportDeclaration(statement)) {
        const from = stringValue(statement.moduleSpecifier);
        const clause = statement.exportClause;
        if (!clause) push(statement, "*", statement.isTypeOnly, from);
        else if (ts.isNamespaceExport(clause))
          push(clause.name, clause.name.text, statement.isTypeOnly, from);
        else {
          for (const element of clause.elements) {
            push(element.name, element.name.text, statement.isTypeOnly || element.isTypeOnly, from);
          }
        }
        continue;
      }
      if (!hasExportModifier(statement)) continue;
      const isDefault = hasDefaultModifier(statement);
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          const names: ts.Identifier[] = [];
          const collect = (name: ts.BindingName) => {
            if (ts.isIdentifier(name)) names.push(name);
            else
              for (const element of name.elements)
                if (!ts.isOmittedExpression(element)) collect(element.name);
          };
          collect(declaration.name);
          for (const name of names) push(name, name.text, false, null);
        }
        continue;
      }
      const typeOnly = ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement);
      if (isDefault) {
        push(statement, "default", typeOnly, null);
        continue;
      }
      const named = statement as ts.Node & { name?: ts.Node };
      if (named.name && (ts.isIdentifier(named.name) || ts.isStringLiteral(named.name))) {
        push(named.name, named.name.text, typeOnly, null);
      } else {
        push(statement, "default", typeOnly, null);
      }
    }
    const frozen = Object.freeze(refs);
    exportCache.set(key, frozen);
    return frozen;
  };

  const resolve = (from: string, specifier: string): string | null => {
    if (!isRelativeSpecifier(specifier) && !specifier.startsWith("/")) return null;
    const base = path.resolve(path.dirname(path.resolve(from)), specifier);
    const candidates = [base];
    if (/\.(c|m)?jsx?$/.test(base)) {
      const stem = base.replace(/\.(c|m)?jsx?$/, "");
      candidates.push(`${stem}.ts`, `${stem}.tsx`);
    }
    for (const extension of RESOLVE_EXTENSIONS) candidates.push(`${base}${extension}`);
    for (const extension of RESOLVE_EXTENSIONS)
      candidates.push(path.join(base, `index${extension}`));
    return candidates.find(isFile) ?? null;
  };

  const declarations = (file: string): readonly StaticDeclaration[] => {
    const key = path.resolve(file);
    const cached = declarationCache.get(key);
    if (cached) return cached;
    const source = load(key);
    const found: StaticDeclaration[] = [];
    const consider = (expression: ts.Expression | undefined, exportName: string) => {
      if (expression === undefined) return;
      const call = unwrapExpression(expression);
      if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) return;
      const kind = call.expression.text;
      if (!(DECLARATION_FUNCTIONS as readonly string[]).includes(kind)) return;
      const id = stringValue(call.arguments[0]);
      if (id === null) return;
      found.push(
        Object.freeze({
          kind: kind as DeclarationFunction,
          id,
          exportName,
          call,
          ...location(key, call),
        }),
      );
    };
    for (const statement of source.statements) {
      if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
        consider(statement.expression, "default");
      } else if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            consider(declaration.initializer, declaration.name.text);
          }
        }
      }
    }
    const frozen = Object.freeze(found);
    declarationCache.set(key, frozen);
    return frozen;
  };

  const pageDeclaration = (file: string): StaticPageDeclaration | null => {
    const key = path.resolve(file);
    if (pageCache.has(key)) return pageCache.get(key) ?? null;
    const declared = declarations(key).find((candidate) => candidate.kind === "page");
    if (!declared) {
      pageCache.set(key, null);
      return null;
    }
    const unreadable: string[] = [];
    const config = declared.call.arguments[1];
    const properties = new Map<string, ts.Expression>();
    if (config && ts.isObjectLiteralExpression(unwrapExpression(config))) {
      for (const property of (unwrapExpression(config) as ts.ObjectLiteralExpression).properties) {
        if (ts.isPropertyAssignment(property)) {
          const name = propertyName(property.name);
          if (name !== null) properties.set(name, property.initializer);
        } else if (ts.isShorthandPropertyAssignment(property)) {
          properties.set(property.name.text, property.name);
        } else {
          unreadable.push("config");
        }
      }
    } else {
      unreadable.push("config");
    }

    const listOf = (field: string): readonly ts.Expression[] | null => {
      const value = properties.get(field);
      if (value === undefined) return null;
      const list = unwrapExpression(value);
      if (!ts.isArrayLiteralExpression(list)) {
        unreadable.push(field);
        return [];
      }
      return list.elements;
    };

    const names = (field: string): StaticName[] | null => {
      const elements = listOf(field);
      if (elements === null) return null;
      const result: StaticName[] = [];
      for (const element of elements) {
        const name = stringValue(element);
        if (name === null) unreadable.push(field);
        else result.push(Object.freeze({ name, ...location(key, element) }));
      }
      return result;
    };

    const overlays: StaticOverlay[] = [];
    for (const element of listOf("overlays") ?? []) {
      const literal = unwrapExpression(element);
      if (!ts.isObjectLiteralExpression(literal)) {
        unreadable.push("overlays");
        continue;
      }
      const fields = new Map<string, string | null>();
      for (const property of literal.properties) {
        if (ts.isPropertyAssignment(property)) {
          const name = propertyName(property.name);
          if (name !== null) fields.set(name, stringValue(property.initializer));
        }
      }
      const id = fields.get("id") ?? null;
      if (id === null) {
        unreadable.push("overlays");
        continue;
      }
      overlays.push(
        Object.freeze({
          id,
          dismiss: fields.get("dismiss") ?? null,
          binding: fields.get("binding") ?? null,
          ...location(key, literal),
        }),
      );
    }

    const importsByLocal = new Map<string, { ref: ImportRef; imported: string }>();
    for (const ref of imports(key)) {
      if (ref.kind !== "import") continue;
      ref.locals.forEach((local, index) => {
        importsByLocal.set(local, { ref, imported: ref.names[index] ?? local });
      });
    }
    const actions: StaticActionRef[] = [];
    for (const element of listOf("actions") ?? []) {
      const expression = unwrapExpression(element);
      if (!ts.isIdentifier(expression)) {
        unreadable.push("actions");
        continue;
      }
      const imported = importsByLocal.get(expression.text);
      actions.push(
        Object.freeze({
          local: expression.text,
          specifier: imported?.ref.specifier ?? null,
          imported: imported?.imported ?? null,
          source: imported ? resolve(key, imported.ref.specifier) : null,
          ...location(key, expression),
        }),
      );
    }

    const route = properties.has("route") ? stringValue(properties.get("route")) : null;
    if (properties.has("route") && route === null) unreadable.push("route");

    const result: StaticPageDeclaration = Object.freeze({
      id: declared.id,
      line: declared.line,
      column: declared.column,
      route,
      regions: Object.freeze(names("regions") ?? []),
      overlays: Object.freeze(overlays),
      actions: Object.freeze(actions),
      states: (() => {
        const states = names("states");
        return states === null ? null : Object.freeze(states);
      })(),
      unreadable: Object.freeze([...new Set(unreadable)].sort()),
    });
    pageCache.set(key, result);
    return result;
  };

  return Object.freeze({
    read,
    load,
    location,
    imports,
    exports,
    resolve,
    declarations,
    pageDeclaration,
  });
}
