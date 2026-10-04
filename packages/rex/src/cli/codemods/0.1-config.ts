import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { CONFIG_FILE } from "../../core/config.ts";
import { APP_MODULE_ID } from "../../vite/virtual.ts";
import { CONFIG_IMPORT } from "../templates.ts";
import {
  addImportEdit,
  applyEdits,
  defaultImportName,
  defineCodemod,
  namedImportEdit,
  parseSource,
  topLevelNames,
  unwrapExpression,
  type CodemodResult,
  type TextEdit,
} from "./codemod.ts";

export const DEFINE_CONFIG = "defineConfig";

const APP_NAMES = ["app", "rexApp", "rexAppBundle"] as const;

function defaultExport(source: ts.SourceFile): ts.ExportAssignment | null {
  return (
    source.statements.find(
      (statement): statement is ts.ExportAssignment =>
        ts.isExportAssignment(statement) && !statement.isExportEquals,
    ) ?? null
  );
}

export function isDefineConfigCall(expression: ts.Expression): boolean {
  const unwrapped = unwrapExpression(expression);
  if (!ts.isCallExpression(unwrapped)) return false;
  const callee = unwrapped.expression;
  if (ts.isIdentifier(callee)) return callee.text === DEFINE_CONFIG;
  return ts.isPropertyAccessExpression(callee) && callee.name.text === DEFINE_CONFIG;
}

function serverBody(source: ts.SourceFile, expression: ts.Expression): string {
  const text = expression.getText(source);
  const body =
    ts.isObjectLiteralExpression(expression) ||
    (ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.CommaToken)
      ? `(${text})`
      : text;
  let multilineTemplate = false;
  const visit = (node: ts.Node): void => {
    if (
      (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      node.getText(source).includes("\n")
    ) {
      multilineTemplate = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
  if (multilineTemplate) return ` ${body}`;
  return `\n${body
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : `    ${line}`))
    .join("\n")}`;
}

export function wrapConfig(file: string, text: string): string | null {
  const source = parseSource(file, text);
  const exported = defaultExport(source);
  if (exported === null || isDefineConfigCall(exported.expression)) return null;

  const edits: TextEdit[] = [];
  let appName = defaultImportName(source, APP_MODULE_ID);
  if (appName === null) {
    const taken = topLevelNames(source);
    appName = APP_NAMES.find((candidate) => !taken.has(candidate)) ?? "rexAppBundle";
    edits.push(addImportEdit(source, `import ${appName} from ${JSON.stringify(APP_MODULE_ID)};`));
  }
  const importDefine = namedImportEdit(source, CONFIG_IMPORT, DEFINE_CONFIG);
  if (importDefine !== null) {
    const existing = edits[0];
    if (existing !== undefined && existing.start === importDefine.start) {
      edits[0] = { ...existing, text: `${existing.text}${importDefine.text}` };
    } else {
      edits.push(importDefine);
    }
  }

  const expression = exported.expression;
  const appField = appName === "app" ? "  app," : `  app: ${appName},`;
  const wrapped = [
    `${DEFINE_CONFIG}({`,
    appField,
    `  server: (${appName}) =>${serverBody(source, expression)},`,
    "})",
  ].join("\n");
  edits.push({ start: expression.getStart(source), end: expression.getEnd(), text: wrapped });
  return applyEdits(text, edits);
}

export const codemod = defineCodemod({
  id: "0.1-config",
  from: "0.1",
  description: `wrap a bare Hono app default export of ${CONFIG_FILE} in defineConfig({ app, server })`,
  run(root: string): CodemodResult {
    const file = path.join(root, CONFIG_FILE);
    if (!existsSync(file)) return { changes: [], flags: [] };
    const text = readFileSync(file, "utf8");
    const migrated = wrapConfig(file, text);
    if (migrated === null || migrated === text) return { changes: [], flags: [] };
    return { changes: [{ file: CONFIG_FILE, text: migrated }], flags: [] };
  },
});
