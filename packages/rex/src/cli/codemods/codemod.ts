import path from "node:path";
import ts from "typescript";
import { errorDocs, type RexErrorCode } from "../../core/errors.ts";

export const CODEMOD_FILE = /^(\d+\.\d+)-[a-z][a-z0-9-]*\.(ts|js)$/;
export const CODEMOD_ID = /^\d+\.\d+-[a-z][a-z0-9-]*$/;

export interface CodemodChange {
  readonly file: string;
  readonly text: string;
}

export interface CodemodFlag {
  readonly code: RexErrorCode;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

export interface CodemodResult {
  readonly changes: readonly CodemodChange[];
  readonly flags: readonly CodemodFlag[];
}

export interface Codemod {
  readonly id: string;
  readonly from: string;
  readonly description: string;
  run(root: string): CodemodResult;
}

export interface TextEdit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export function defineCodemod(codemod: Codemod): Codemod {
  if (!CODEMOD_ID.test(codemod.id)) {
    throw new TypeError(
      `codemod id ${JSON.stringify(codemod.id)} must be <from>-<name>, such as 0.1-config`,
    );
  }
  if (!codemod.id.startsWith(`${codemod.from}-`)) {
    throw new TypeError(`codemod ${codemod.id} must start with its from version ${codemod.from}`);
  }
  return Object.freeze({ ...codemod });
}

export function formatFlag(flag: CodemodFlag): string {
  return `${flag.code} ${flag.file}:${flag.line}:${flag.column} ${flag.message} (${errorDocs(flag.code)})`;
}

export function toPosix(file: string): string {
  return file.split(path.sep).join("/");
}

export function relativeFile(root: string, file: string): string {
  return toPosix(path.relative(path.resolve(root), path.resolve(file)));
}

export function parseSource(file: string, text: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

export function applyEdits(text: string, edits: readonly TextEdit[]): string {
  let result = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    result = `${result.slice(0, edit.start)}${edit.text}${result.slice(edit.end)}`;
  }
  return result;
}

export function unwrapExpression(node: ts.Expression): ts.Expression {
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

export function flagAt(
  source: ts.SourceFile,
  file: string,
  node: ts.Node,
  code: RexErrorCode,
  message: string,
): CodemodFlag {
  const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
  return Object.freeze({ code, file, line: line + 1, column: character + 1, message });
}

function importsOf(source: ts.SourceFile): ts.ImportDeclaration[] {
  return source.statements.filter(ts.isImportDeclaration);
}

function specifierOf(declaration: ts.ImportDeclaration): string | null {
  return ts.isStringLiteral(declaration.moduleSpecifier) ? declaration.moduleSpecifier.text : null;
}

export function defaultImportName(source: ts.SourceFile, specifier: string): string | null {
  for (const declaration of importsOf(source)) {
    if (specifierOf(declaration) !== specifier) continue;
    const name = declaration.importClause?.name;
    if (name !== undefined && declaration.importClause?.isTypeOnly !== true) return name.text;
  }
  return null;
}

export function importsNamed(source: ts.SourceFile, specifier: string, name: string): boolean {
  return importsOf(source).some((declaration) => {
    if (specifierOf(declaration) !== specifier) return false;
    const clause = declaration.importClause;
    if (clause === undefined || clause.isTypeOnly) return false;
    const bindings = clause.namedBindings;
    return (
      bindings !== undefined &&
      ts.isNamedImports(bindings) &&
      bindings.elements.some(
        (element) =>
          !element.isTypeOnly &&
          element.name.text === name &&
          (element.propertyName === undefined || element.propertyName.text === name),
      )
    );
  });
}

export function addImportEdit(source: ts.SourceFile, line: string): TextEdit {
  const imports = importsOf(source);
  const last = imports.at(-1);
  if (last !== undefined) return { start: last.getEnd(), end: last.getEnd(), text: `\n${line}` };
  return { start: 0, end: 0, text: `${line}\n\n` };
}

export function namedImportEdit(
  source: ts.SourceFile,
  specifier: string,
  name: string,
): TextEdit | null {
  if (importsNamed(source, specifier, name)) return null;
  for (const declaration of importsOf(source)) {
    if (specifierOf(declaration) !== specifier) continue;
    const clause = declaration.importClause;
    if (clause === undefined || clause.isTypeOnly) continue;
    const bindings = clause.namedBindings;
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue;
    const last = bindings.elements.at(-1);
    if (last === undefined) {
      return { start: bindings.getStart(source), end: bindings.getEnd(), text: `{ ${name} }` };
    }
    return { start: last.getEnd(), end: last.getEnd(), text: `, ${name}` };
  }
  return addImportEdit(source, `import { ${name} } from ${JSON.stringify(specifier)};`);
}

export function topLevelNames(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const bind = (name: ts.BindingName): void => {
    if (ts.isIdentifier(name)) {
      names.add(name.text);
      return;
    }
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) bind(element.name);
    }
  };
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.name !== undefined) names.add(clause.name.text);
      const bindings = clause?.namedBindings;
      if (bindings !== undefined && ts.isNamespaceImport(bindings)) names.add(bindings.name.text);
      if (bindings !== undefined && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) names.add(element.name.text);
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) bind(declaration.name);
    } else if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name !== undefined
    ) {
      names.add(statement.name.text);
    }
  }
  return names;
}
