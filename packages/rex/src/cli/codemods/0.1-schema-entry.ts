import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import * as configEntry from "../../config.ts";
import * as coreEntry from "../../index.ts";
import * as manifestEntry from "../../manifest/index.ts";
import * as schemaEntry from "../../schema/index.ts";
import {
  CLIENT_IMPORT,
  CONFIG_IMPORT,
  CORE_IMPORT,
  FIELDS_IMPORT,
  I18N_IMPORT,
  INTEROP_IMPORT,
  MEDIA_IMPORT,
  SCHEMA_IMPORT,
} from "../templates.ts";
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

export const INTEROP_NAMES: readonly string[] = [
  "attributeName",
  "coerceAttribute",
  "defineElement",
  "mountRexPage",
  "Native",
];

const INTEROP_TYPES = [
  "ElementPropKind",
  "ElementPropMap",
  "DefineElementOptions",
  "RexElementConstructor",
  "MountRexPageOptions",
  "UnmountRexPage",
  "NativeTag",
  "NativeMount",
  "NativeProps",
];

export const MEDIA_NAMES: readonly string[] = [
  "SCRIPT_ATTRIBUTE",
  "SCRIPT_STRATEGIES",
  "DEFAULT_SCRIPT_STRATEGY",
  "IDLE_FALLBACK_MS",
  "createMediaCollector",
  "MediaProvider",
  "Img",
  "loadScript",
  "Script",
];

const MEDIA_TYPES = [
  "ScriptStrategy",
  "PriorityImage",
  "RexMediaCollector",
  "RexMediaRequest",
  "MediaProviderProps",
  "ImgProps",
  "LoadScriptOptions",
  "ScriptProps",
];

export const I18N_NAMES: readonly string[] = [
  "MessageFormatError",
  "parseMessage",
  "formatMessage",
  "MSG_PREFIX",
  "isMessageKey",
  "isMessageRef",
  "t",
  "parseMessageRef",
  "validateMessages",
  "localeChain",
  "message",
  "translate",
  "LOCALE_COOKIE",
  "LOCALE_COOKIE_MAX_AGE",
  "LOCALE_SOURCES",
  "localeSettings",
  "matchLocale",
  "negotiateLocale",
  "localePrefix",
  "stripLocalePrefix",
  "localizeHref",
  "resolveLocale",
  "localeCookie",
  "UNCONFIGURED_LOCALE",
  "defineI18n",
  "i18nFor",
  "UNCONFIGURED_I18N",
  "I18nContext",
  "LocaleSeedContext",
  "useI18n",
  "useLocale",
  "useT",
  "useText",
  "I18nProvider",
  "detectClientLocale",
];

const I18N_TYPES = [
  "MessageValue",
  "MessageValues",
  "MessageNode",
  "Messages",
  "LocaleMessages",
  "MessageRef",
  "MessageLookup",
  "LocaleSource",
  "LocaleSettings",
  "LocaleResolution",
  "LocaleInputs",
  "I18nInput",
  "I18nSource",
  "I18nState",
  "LocaleInfo",
  "Translate",
  "TextResolver",
];

export const CLIENT_ENTRY_TARGETS: readonly (readonly [string, ReadonlySet<string>])[] = [
  [INTEROP_IMPORT, new Set([...INTEROP_NAMES, ...INTEROP_TYPES])],
  [MEDIA_IMPORT, new Set([...MEDIA_NAMES, ...MEDIA_TYPES])],
  [I18N_IMPORT, new Set([...I18N_NAMES, ...I18N_TYPES])],
];

type EntryTargets = readonly (readonly [string, ReadonlySet<string>])[];

function targetOf(targets: EntryTargets, name: string): string | null {
  for (const [specifier, names] of targets) {
    if (names.has(name)) return specifier;
  }
  return null;
}

function importStatement(typeOnly: boolean, names: readonly string[], specifier: string): string {
  return `import ${typeOnly ? "type " : ""}{ ${names.join(", ")} } from ${JSON.stringify(specifier)};`;
}

function moveImports(
  file: string,
  text: string,
  from: string,
  targets: EntryTargets,
): string | null {
  const source = parseSource(file, text);
  const edits: TextEdit[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(specifier) || specifier.text !== from) continue;
    const clause = statement.importClause;
    const bindings = clause?.namedBindings;
    if (clause === undefined || clause.name !== undefined) continue;
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue;
    const kept: string[] = [];
    const moved = new Map<string, string[]>();
    for (const element of bindings.elements) {
      const imported = (element.propertyName ?? element.name).text;
      const target = targetOf(targets, imported);
      const written = element.getText(source);
      if (target === null) {
        kept.push(written);
      } else {
        moved.set(target, [...(moved.get(target) ?? []), written]);
      }
    }
    if (moved.size === 0) continue;
    const statements: string[] = [];
    if (kept.length > 0) statements.push(importStatement(clause.isTypeOnly, kept, from));
    for (const [target] of targets) {
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

export function moveEntryImports(file: string, text: string): string | null {
  return moveImports(file, text, CORE_IMPORT, ENTRY_TARGETS);
}

export function moveClientImports(file: string, text: string): string | null {
  return moveImports(file, text, CLIENT_IMPORT, CLIENT_ENTRY_TARGETS);
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
  description: `move z to ${SCHEMA_IMPORT} and the field helpers, config and manifest names from ${CORE_IMPORT} to ${FIELDS_IMPORT}, ${CONFIG_IMPORT} and ${MANIFEST_IMPORT}, and the interop, media and i18n names from ${CLIENT_IMPORT} to ${INTEROP_IMPORT}, ${MEDIA_IMPORT} and ${I18N_IMPORT}`,
  run(root: string): CodemodResult {
    const changes: CodemodChange[] = [];
    for (const file of sourceFiles(path.resolve(root))) {
      const text = readFileSync(file, "utf8");
      const entries = moveEntryImports(file, text) ?? text;
      const migrated = moveClientImports(file, entries) ?? entries;
      if (migrated !== text) {
        changes.push({ file: relativeFile(root, file), text: migrated });
      }
    }
    return { changes, flags: [] };
  },
});
