import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type { RexCommand as Command } from "../args.ts";
import ts from "typescript";
import { createSourceLoader, isRelativeSpecifier } from "../../check/rule.ts";
import type { RexCliIO } from "../index.ts";
import { appPaths } from "../templates.ts";
import { INVALID_ARGUMENT, MAKE_REFUSED, MakeError } from "./make.ts";

export const COMPONENTS_DIR = "app/components";

const PART_PATH = /^([^/]+)\/regions\/([^/]+)\/parts\/([^/]+)$/;
const SOURCE_FILE = /\.tsx?$/;

export interface PartLocation {
  readonly page: string;
  readonly region: string;
  readonly part: string;
}

export interface PromoteResult {
  readonly from: string;
  readonly to: string;
  readonly rewritten: readonly string[];
}

interface SpecifierEdit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

function toPosix(file: string): string {
  return file.split(path.sep).join("/");
}

export function parsePartPath(spec: string): PartLocation {
  const match = PART_PATH.exec(spec);
  if (match === null) {
    throw new MakeError(
      INVALID_ARGUMENT,
      `${JSON.stringify(spec)} is not a part path; expected <page>/regions/<region>/parts/<Part>`,
    );
  }
  const [, page, region, part] = match as unknown as [string, string, string, string];
  try {
    appPaths.part(page, region, part);
  } catch (error) {
    throw new MakeError(INVALID_ARGUMENT, (error as Error).message);
  }
  return { page, region, part };
}

export function componentPath(part: string): string {
  return `${COMPONENTS_DIR}/${part}.tsx`;
}

function relativeSpecifier(fromDir: string, target: string): string {
  const relative = toPosix(path.relative(fromDir, target));
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function sourceFiles(dir: string, found: string[]): string[] {
  if (!existsSync(dir)) return found;
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (entry.isFile() && SOURCE_FILE.test(entry.name)) found.push(full);
  }
  return found;
}

function scriptKind(file: string): ts.ScriptKind {
  return file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function specifierLiterals(file: string, text: string): ts.StringLiteralLike[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
  const literals: ts.StringLiteralLike[] = [];
  const take = (node: ts.Node | undefined) => {
    if (node !== undefined && ts.isStringLiteralLike(node)) literals.push(node);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      take(node.moduleSpecifier);
      return;
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      take(node.moduleReference.expression);
      return;
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      take(node.arguments[0]);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      take(node.argument.literal);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return literals;
}

function applyEdits(text: string, edits: readonly SpecifierEdit[]): string {
  let result = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    result = `${result.slice(0, edit.start)}${edit.text}${result.slice(edit.end)}`;
  }
  return result;
}

function literalEdit(literal: ts.StringLiteralLike, text: string): SpecifierEdit {
  return { start: literal.getStart() + 1, end: literal.getEnd() - 1, text };
}

function targetSpecifier(fromDir: string, target: string, original: string): string {
  const stem = target.replace(/\.tsx$/, "");
  const extension = /\.(tsx|ts|jsx|js)$/.exec(original)?.[0] ?? "";
  return relativeSpecifier(fromDir, `${stem}${extension}`);
}

export function promotePart(root: string, spec: string): PromoteResult {
  const location = parsePartPath(spec);
  const from = appPaths.part(location.page, location.region, location.part);
  const to = componentPath(location.part);
  const source = path.resolve(root, from);
  const target = path.resolve(root, to);
  if (!existsSync(source)) {
    throw new MakeError(MAKE_REFUSED, `part ${spec} does not exist: ${from} is missing`);
  }
  if (existsSync(target)) {
    throw new MakeError(MAKE_REFUSED, `refusing to overwrite existing files:\n  ${to}`);
  }

  const loader = createSourceLoader();
  const updates = new Map<string, string>();
  for (const file of sourceFiles(path.resolve(root, "app"), [])) {
    if (file === source) continue;
    const text = readFileSync(file, "utf8");
    const edits: SpecifierEdit[] = [];
    for (const literal of specifierLiterals(file, text)) {
      if (!isRelativeSpecifier(literal.text)) continue;
      if (loader.resolve(file, literal.text) !== source) continue;
      edits.push(literalEdit(literal, targetSpecifier(path.dirname(file), target, literal.text)));
    }
    if (edits.length > 0) updates.set(file, applyEdits(text, edits));
  }

  const partText = readFileSync(source, "utf8");
  const moved = applyEdits(
    partText,
    specifierLiterals(source, partText)
      .filter((literal) => isRelativeSpecifier(literal.text))
      .map((literal) =>
        literalEdit(
          literal,
          relativeSpecifier(path.dirname(target), path.resolve(path.dirname(source), literal.text)),
        ),
      ),
  );

  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, moved, { flag: "wx" });
  unlinkSync(source);
  for (const [file, text] of updates) writeFileSync(file, text);

  return {
    from,
    to,
    rewritten: [...updates.keys()].map((file) => toPosix(path.relative(root, file))).sort(),
  };
}

export function register(program: Command, io: RexCliIO): void {
  const command: Command = program
    .command("promote")
    .description("move a page part to app/components and rewrite the imports that use it")
    .argument("<part>", "part path: <page>/regions/<region>/parts/<Part>")
    .action((spec: string) => {
      let result: PromoteResult;
      try {
        result = promotePart(io.cwd, spec);
      } catch (error) {
        if (error instanceof MakeError) {
          command.error(`rex promote: ${error.message}`, {
            code: error.code,
            exitCode: error.exitCode,
          });
        }
        throw error;
      }
      io.out(`moved ${result.from} -> ${result.to}\n`);
      for (const file of result.rewritten) io.out(`rewrote ${file}\n`);
    });
}
