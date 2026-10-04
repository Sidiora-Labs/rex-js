import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { normalizePath, parseSync, type Plugin } from "vite";
import { REX_ERRORS_DOCS_BASE } from "../core/errors.ts";
import type { RexHookContext } from "./hooks.ts";
import { DECLARATION_FOLDERS } from "./scan.ts";
import { CORE_SPECIFIER } from "./virtual.ts";

declare module "./plugin.ts" {
  interface RexPluginOptions {
    readonly secretNames?: readonly string[];
  }
}

export const SERVER_SPECIFIER = `${CORE_SPECIFIER}/server`;
export const SERVER_ONLY_SPECIFIER = `${CORE_SPECIFIER}/server-only`;
export const APP_SERVER_DIR = "server";
export const PUBLIC_ENV_PREFIX = "VITE_";
export const ALLOWED_ENV_NAMES = ["NODE_ENV"] as const;
export const BOUNDARY_IMPORT_CODE = "REX440";
export const SECRET_LEAK_CODE = "REX441";
export const SERVER_ONLY_HANDLER_MESSAGE =
  "rex: action handlers run on the server; invoke this action through useAct, ActionForm or the RPC client";

const SERVER_ONLY_HANDLER = `() => { throw new Error(${JSON.stringify(SERVER_ONLY_HANDLER_MESSAGE)}); }`;
const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;
const NODE_MODULES = /[\\/]node_modules[\\/]/;

export type BoundaryErrorCode = typeof BOUNDARY_IMPORT_CODE | typeof SECRET_LEAK_CODE;

const BOUNDARY_HINTS: Readonly<Record<BoundaryErrorCode, string>> = {
  REX440:
    "Keep server code in action handlers, app/server or modules marked with import \"@sidioralabs/rex/server-only\", and reach it from the client through an action.",
  REX441:
    "Read secrets only in action handlers or app/server; expose public values to the client through import.meta.env with the VITE_ prefix.",
};

export type BoundaryViolation = "rex/server" | "app/server" | "server-only";

interface AstNode {
  readonly type: string;
  readonly start: number;
  readonly end: number;
  readonly [key: string]: unknown;
}

interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

function isNode(value: unknown): value is AstNode {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { type?: unknown }).type === "string" &&
    typeof (value as { start?: unknown }).start === "number"
  );
}

function children(node: AstNode): AstNode[] {
  const found: AstNode[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === "type" || key === "start" || key === "end") continue;
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) found.push(item);
    } else if (isNode(value)) {
      found.push(value);
    }
  }
  return found;
}

function walk(node: AstNode, visit: (node: AstNode, parent: AstNode | null) => boolean | void) {
  const stack: [AstNode, AstNode | null][] = [[node, null]];
  while (stack.length > 0) {
    const [current, parent] = stack.pop() as [AstNode, AstNode | null];
    if (visit(current, parent) === false) continue;
    const next = children(current);
    for (let index = next.length - 1; index >= 0; index -= 1) {
      stack.push([next[index] as AstNode, current]);
    }
  }
}

function parseProgram(file: string, code: string): AstNode | null {
  const parsed = parseSync(file, code);
  if (parsed.errors.length > 0) return null;
  return parsed.program as unknown as AstNode;
}

function nodeAt(node: AstNode, key: string): AstNode | null {
  const value = node[key];
  return isNode(value) ? value : null;
}

function nodesAt(node: AstNode, key: string): AstNode[] {
  const value = node[key];
  return Array.isArray(value) ? value.filter(isNode) : [];
}

function identifierName(node: AstNode | null): string | null {
  return node !== null && node.type === "Identifier" && typeof node.name === "string"
    ? node.name
    : null;
}

function staticKey(node: AstNode, keyField: string): string | null {
  const key = nodeAt(node, keyField);
  if (key === null) return null;
  if (node.computed !== true && key.type === "Identifier") return identifierName(key);
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
}

function applyEdits(code: string, edits: readonly Edit[]): string {
  let output = code;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }
  return output;
}

function referencedNames(program: AstNode): Set<string> {
  const names = new Set<string>();
  walk(program, (node, parent) => {
    if (node.type === "ImportDeclaration") return false;
    if (node.type === "Identifier" || node.type === "JSXIdentifier") {
      if (typeof node.name !== "string" || parent === null) return;
      const isKey =
        (parent.type === "Property" ||
          parent.type === "MethodDefinition" ||
          parent.type === "PropertyDefinition") &&
        parent.key === node &&
        parent.computed !== true &&
        parent.shorthand !== true;
      const isMember = parent.type === "MemberExpression" && parent.property === node && parent.computed !== true;
      const isBinding =
        (parent.type === "VariableDeclarator" ||
          parent.type === "FunctionDeclaration" ||
          parent.type === "ClassDeclaration") &&
        parent.id === node;
      if (!isKey && !isMember && !isBinding) names.add(node.name);
    }
  });
  return names;
}

function actionCallees(program: AstNode): { names: Set<string>; namespaces: Set<string> } {
  const names = new Set<string>();
  const namespaces = new Set<string>();
  for (const statement of nodesAt(program, "body")) {
    if (statement.type !== "ImportDeclaration") continue;
    const source = nodeAt(statement, "source");
    if (source === null || source.value !== CORE_SPECIFIER) continue;
    for (const specifier of nodesAt(statement, "specifiers")) {
      const local = identifierName(nodeAt(specifier, "local"));
      if (local === null) continue;
      if (specifier.type === "ImportNamespaceSpecifier") namespaces.add(local);
      if (specifier.type === "ImportSpecifier" && staticKey(specifier, "imported") === "action") {
        names.add(local);
      }
    }
  }
  return { names, namespaces };
}

function isActionCall(node: AstNode, callees: ReturnType<typeof actionCallees>): boolean {
  if (node.type !== "CallExpression") return false;
  const callee = nodeAt(node, "callee");
  if (callee === null) return false;
  const name = identifierName(callee);
  if (name !== null) return callees.names.has(name);
  if (callee.type !== "MemberExpression") return false;
  const object = identifierName(nodeAt(callee, "object"));
  return object !== null && callees.namespaces.has(object) && staticKey(callee, "property") === "action";
}

function handlerEdits(program: AstNode): Edit[] {
  const callees = actionCallees(program);
  if (callees.names.size === 0 && callees.namespaces.size === 0) return [];
  const edits: Edit[] = [];
  walk(program, (node) => {
    if (!isActionCall(node, callees)) return;
    const options = nodesAt(node, "arguments")[1];
    if (options === undefined || options.type !== "ObjectExpression") return;
    for (const property of nodesAt(options, "properties")) {
      if (property.type !== "Property" || staticKey(property, "key") !== "handler") continue;
      edits.push({ start: property.start, end: property.end, text: `handler: ${SERVER_ONLY_HANDLER}` });
    }
  });
  return edits;
}

function importText(code: string, statement: AstNode, kept: readonly AstNode[]): string {
  const source = nodeAt(statement, "source") as AstNode;
  const defaults = kept.filter((item) => item.type !== "ImportSpecifier");
  const named = kept.filter((item) => item.type === "ImportSpecifier");
  const parts = defaults.map((item) => code.slice(item.start, item.end));
  if (named.length > 0) parts.push(`{ ${named.map((item) => code.slice(item.start, item.end)).join(", ")} }`);
  const kind = statement.importKind === "type" ? "type " : "";
  return `import ${kind}${parts.join(", ")} from ${code.slice(source.start, source.end)};`;
}

function pruneEdits(code: string, program: AstNode, before: ReadonlySet<string>): Edit[] {
  const refs = referencedNames(program);
  const dropped = (name: string | null) => name !== null && before.has(name) && !refs.has(name);
  const edits: Edit[] = [];
  for (const statement of nodesAt(program, "body")) {
    const remove = () => edits.push({ start: statement.start, end: statement.end, text: "" });
    if (statement.type === "ImportDeclaration") {
      const specifiers = nodesAt(statement, "specifiers");
      if (specifiers.length === 0) continue;
      const kept = specifiers.filter((item) => !dropped(identifierName(nodeAt(item, "local"))));
      if (kept.length === specifiers.length) continue;
      if (kept.length === 0) remove();
      else if (nodesAt(statement, "attributes").length === 0) {
        edits.push({ start: statement.start, end: statement.end, text: importText(code, statement, kept) });
      }
    } else if (statement.type === "FunctionDeclaration" || statement.type === "ClassDeclaration") {
      if (dropped(identifierName(nodeAt(statement, "id")))) remove();
    } else if (statement.type === "VariableDeclaration") {
      const declarators = nodesAt(statement, "declarations");
      if (
        declarators.length > 0 &&
        declarators.every((item) => dropped(identifierName(nodeAt(item, "id"))))
      ) {
        remove();
      }
    }
  }
  return edits;
}

export function stripActionHandlers(code: string, file: string): string | null {
  const program = parseProgram(file, code);
  if (program === null) return null;
  const edits = handlerEdits(program);
  if (edits.length === 0) return null;
  const before = referencedNames(program);
  let output = applyEdits(code, edits);
  for (;;) {
    const current = parseProgram(file, output);
    if (current === null) return output;
    const pruned = pruneEdits(output, current, before);
    if (pruned.length === 0) return output;
    output = applyEdits(output, pruned);
  }
}

function isProcessEnv(node: AstNode | null): boolean {
  if (node === null || node.type !== "MemberExpression" || staticKey(node, "property") !== "env") {
    return false;
  }
  const object = nodeAt(node, "object");
  if (identifierName(object) === "process") return true;
  return (
    object !== null &&
    object.type === "MemberExpression" &&
    staticKey(object, "property") === "process" &&
    ["globalThis", "global", "window", "self"].includes(identifierName(nodeAt(object, "object")) ?? "")
  );
}

export function isPublicEnvName(name: string): boolean {
  return name.startsWith(PUBLIC_ENV_PREFIX) || (ALLOWED_ENV_NAMES as readonly string[]).includes(name);
}

export function collectEnvReferences(code: string, file: string): string[] {
  if (!code.includes("process")) return [];
  const program = parseProgram(file, code);
  if (program === null) return [];
  const found = new Set<string>();
  walk(program, (node, parent) => {
    if (!isProcessEnv(node)) return;
    const named = parent !== null && parent.type === "MemberExpression" && parent.object === node;
    const name = named ? staticKey(parent, "property") : null;
    if (name === null) found.add("process.env");
    else if (!isPublicEnvName(name)) found.add(`process.env.${name}`);
    return false;
  });
  return [...found].sort();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findSecretNames(text: string, secretNames: readonly string[]): string[] {
  return secretNames.filter((name) =>
    new RegExp(`(?<![\\w$])${escapeRegExp(name)}(?![\\w$])`).test(text),
  );
}

function fileOf(id: string): string {
  return normalizePath(id.split("?")[0] ?? id);
}

export function isActionModule(id: string, appPath: string): boolean {
  const file = fileOf(id);
  return (
    !id.startsWith("\0") &&
    SCRIPT_FILE.test(file) &&
    file.startsWith(`${normalizePath(appPath)}/${DECLARATION_FOLDERS.action}/`)
  );
}

export function serverOnlyModulePaths(core: string): string[] {
  const dir = dirname(core);
  return [".ts", ".js"].map((extension) => normalizePath(join(dir, `server-only${extension}`)));
}

export function boundaryViolation(
  source: string,
  importer: string,
  appPath: string,
  serverOnlyPaths: readonly string[] = [],
): BoundaryViolation | null {
  const specifier = source.split("?")[0] ?? source;
  if (specifier === SERVER_ONLY_SPECIFIER) return "server-only";
  if (specifier === SERVER_SPECIFIER || specifier.startsWith(`${SERVER_SPECIFIER}/`)) {
    return "rex/server";
  }
  let target: string | null = null;
  if (isAbsolute(specifier)) target = normalizePath(specifier);
  else if (specifier.startsWith(".") && !importer.startsWith("\0")) {
    target = normalizePath(resolve(dirname(fileOf(importer)), specifier));
  }
  if (target === null) return null;
  if (serverOnlyPaths.includes(target)) return "server-only";
  const serverDir = `${normalizePath(appPath)}/${APP_SERVER_DIR}`;
  return target === serverDir || target.startsWith(`${serverDir}/`) ? "app/server" : null;
}

export interface BoundaryLog {
  readonly message: string;
  readonly code: BoundaryErrorCode;
  readonly url: string;
  readonly id?: string;
}

export function boundaryError(code: BoundaryErrorCode, message: string, id?: string): BoundaryLog {
  const docs = `${REX_ERRORS_DOCS_BASE}/${code}`;
  const log = {
    message: `${code} ${message}\n  hint: ${BOUNDARY_HINTS[code]}\n  docs: ${docs}`,
    code,
    url: docs,
  };
  return id === undefined ? log : { ...log, id };
}

function importMessage(
  violation: BoundaryViolation,
  source: string,
  importer: string,
  display: (file: string) => string,
  importedBy: string | null,
): string {
  if (violation === "server-only") {
    const via = importedBy === null ? "" : ` (imported by ${display(importedBy)})`;
    return `${display(importer)}${via} imports ${JSON.stringify(source)}, so it is server-only, but it is part of the client bundle`;
  }
  if (violation === "rex/server") {
    return `${display(importer)} imports ${JSON.stringify(source)} into the client bundle; the Rex server runtime is server-only`;
  }
  const target = isAbsolute(source) ? source : resolve(dirname(fileOf(importer)), source);
  return `${display(importer)} imports ${display(target)} from app/server into the client bundle`;
}

interface BundleChunk {
  readonly type: "chunk";
  readonly fileName: string;
  readonly code: string;
  readonly modules: Readonly<Record<string, { readonly renderedLength: number }>>;
}

interface BundleAsset {
  readonly type: "asset";
  readonly fileName: string;
  readonly source: string | Uint8Array;
}

export function boundaryHook(context: RexHookContext): Plugin {
  const envReferences = new Map<string, readonly string[]>();
  let leaks: string[] = [];
  const serverOnlyPaths = serverOnlyModulePaths(context.paths.core);
  const display = (file: string) => normalizePath(relative(context.state.root, fileOf(file)));
  return {
    name: "rex:boundary",
    enforce: "pre",
    applyToEnvironment: (environment) => environment.config.consumer === "client",
    buildStart() {
      envReferences.clear();
      leaks = [];
    },
    resolveId(source, importer) {
      if (importer === undefined) return null;
      const violation = boundaryViolation(source, importer, context.appPath(), serverOnlyPaths);
      if (violation === null) return null;
      const importedBy =
        violation === "server-only" ? (this.getModuleInfo(importer)?.importers[0] ?? null) : null;
      return this.error(
        boundaryError(
          BOUNDARY_IMPORT_CODE,
          importMessage(violation, source, importer, display, importedBy),
          fileOf(importer),
        ),
      );
    },
    transform(code, id) {
      if (id.startsWith("\0")) return null;
      const file = fileOf(id);
      if (!SCRIPT_FILE.test(file)) return null;
      const stripped = isActionModule(id, context.appPath()) ? stripActionHandlers(code, file) : null;
      const output = stripped ?? code;
      if (!NODE_MODULES.test(file)) {
        const references = collectEnvReferences(output, file);
        if (references.length > 0) envReferences.set(file, references);
        else envReferences.delete(file);
      }
      return stripped === null ? null : { code: stripped, map: null };
    },
    generateBundle(_options, bundle) {
      const secretNames = context.options.secretNames ?? [];
      for (const item of Object.values(bundle) as (BundleChunk | BundleAsset)[]) {
        if (item.type === "chunk") {
          for (const [id, rendered] of Object.entries(item.modules)) {
            if (rendered.renderedLength === 0) continue;
            for (const reference of envReferences.get(fileOf(id)) ?? []) {
              leaks.push(`${item.fileName}: ${display(id)} references ${reference}`);
            }
          }
          for (const reference of collectEnvReferences(item.code, item.fileName)) {
            leaks.push(`${item.fileName} references ${reference}`);
          }
        }
        const text =
          item.type === "chunk" ? item.code : typeof item.source === "string" ? item.source : null;
        if (text === null) continue;
        for (const name of findSecretNames(text, secretNames)) {
          leaks.push(`${item.fileName} contains the secret name ${name}`);
        }
      }
    },
    closeBundle() {
      if (leaks.length === 0) return;
      const found = [...new Set(leaks)];
      leaks = [];
      this.error(
        boundaryError(
          SECRET_LEAK_CODE,
          `the client output exposes server-only environment values:\n${found.map((leak) => `    - ${leak}`).join("\n")}`,
        ),
      );
    },
  };
}
