import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import * as configEntry from "../../config.ts";
import * as coreEntry from "../../index.ts";
import * as manifestEntry from "../../manifest/index.ts";
import * as schemaEntry from "../../schema/index.ts";
import { CONFIG_IMPORT, CORE_IMPORT, FIELDS_IMPORT, SCHEMA_IMPORT } from "../templates.ts";
import {
  applyEdits,
  defineCodemod,
  parseSource,
  relativeFile,
  type CodemodChange,
  type CodemodResult,
  type TextEdit,
} from "./codemod.ts";

export const MANIFEST_IMPORT = "@sidioralabs/rex/manifest";

const SOURCE_FILE = /\.(ts|tsx|mts)$/;
const SKIPPED_DIRS = new Set(["node_modules", "dist", ".rex", ".git"]);

const SCHEMA_TYPES = [
  "FieldKind",
  "JsonSchema",
  "RexField",
  "RexFieldMethods",
  "TextOptions",
  "IntegerOptions",
  "RealOptions",
  "RefTarget",
];

const CONFIG_TYPES = [
  "RexFetchHandler",
  "RexConfigApp",
  "CspMode",
  "I18nRouting",
  "ImageFormat",
  "UiKit",
  "FontStyle",
  "RenderConfig",
  "BudgetsConfig",
  "SecurityConfig",
  "I18nConfig",
  "ImagesConfig",
  "FontSpec",
  "RexLogger",
  "RexTracer",
  "TelemetryConfig",
  "ClientConfig",
  "TokenAllowLists",
  "UiConfig",
  "I18nCheckConfig",
  "CheckConfig",
  "RexOptionsConfig",
  "RexConfig",
  "ResolvedBudgets",
  "ResolvedSecurity",
  "ResolvedI18n",
  "ResolvedFont",
  "ResolvedRexOptions",
  "ResolvedRexConfig",
  "RexConfigExport",
  "DefaultServerFactory",
];

const MANIFEST_TYPES = [
  "ManifestSource",
  "BuildManifestOptions",
  "InvocationRoute",
  "SidecarAction",
  "SidecarOverlay",
  "SidecarOutcome",
  "SidecarRegion",
  "SidecarStores",
  "SidecarLoader",
  "SidecarPayload",
  "SidecarIssue",
  "SidecarValidation",
];

const CORE_NAMES = new Set(Object.keys(coreEntry));

function movedNames(entry: object, types: readonly string[]): ReadonlySet<string> {
  return new Set([...Object.keys(entry).filter((name) => !CORE_NAMES.has(name)), ...types]);
}

export const ENTRY_TARGETS: readonly (readonly [string, ReadonlySet<string>])[] = [
  [SCHEMA_IMPORT, new Set(["z"])],
  [FIELDS_IMPORT, movedNames(schemaEntry, SCHEMA_TYPES)],
  [CONFIG_IMPORT, movedNames(configEntry, CONFIG_TYPES)],
  [MANIFEST_IMPORT, movedNames(manifestEntry, MANIFEST_TYPES)],
];

function targetOf(name: string): string | null {
  for (const [specifier, names] of ENTRY_TARGETS) {
    if (names.has(name)) return specifier;
  }
  return null;
}

function importStatement(typeOnly: boolean, names: readonly string[], specifier: string): string {
  return `import ${typeOnly ? "type " : ""}{ ${names.join(", ")} } from ${JSON.stringify(specifier)};`;
}

export function moveEntryImports(file: string, text: string): string | null {
  const source = parseSource(file, text);
  const edits: TextEdit[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(specifier) || specifier.text !== CORE_IMPORT) continue;
    const clause = statement.importClause;
    const bindings = clause?.namedBindings;
    if (clause === undefined || clause.name !== undefined) continue;
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue;
    const kept: string[] = [];
    const moved = new Map<string, string[]>();
    for (const element of bindings.elements) {
      const imported = (element.propertyName ?? element.name).text;
      const target = targetOf(imported);
      const written = element.getText(source);
      if (target === null) {
        kept.push(written);
      } else {
        moved.set(target, [...(moved.get(target) ?? []), written]);
      }
    }
    if (moved.size === 0) continue;
    const statements: string[] = [];
    if (kept.length > 0) statements.push(importStatement(clause.isTypeOnly, kept, CORE_IMPORT));
    for (const [target] of ENTRY_TARGETS) {
      const names = moved.get(target);
      if (names !== undefined) statements.push(importStatement(clause.isTypeOnly, names, target));
    }
    edits.push({
      start: statement.getStart(source),
      end: statement.getEnd(),
      text: statements.join("\n"),
    });
  }
  return edits.length === 0 ? null : applyEdits(text, edits);
}

function sourceFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
      } else if (entry.isFile() && SOURCE_FILE.test(entry.name) && !entry.name.endsWith(".d.ts")) {
        found.push(path.join(dir, entry.name));
      }
    }
  };
  if (existsSync(root)) walk(root);
  return found.sort();
}

export const codemod = defineCodemod({
  id: "0.1-schema-entry",
  from: "0.1",
  description: `move z to ${SCHEMA_IMPORT} and the field helpers, config and manifest names from ${CORE_IMPORT} to ${FIELDS_IMPORT}, ${CONFIG_IMPORT} and ${MANIFEST_IMPORT}`,
  run(root: string): CodemodResult {
    const changes: CodemodChange[] = [];
    for (const file of sourceFiles(path.resolve(root))) {
      const text = readFileSync(file, "utf8");
      const migrated = moveEntryImports(file, text);
      if (migrated !== null && migrated !== text) {
        changes.push({ file: relativeFile(root, file), text: migrated });
      }
    }
    return { changes, flags: [] };
  },
});
