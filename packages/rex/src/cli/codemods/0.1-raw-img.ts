import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { discoverApp } from "../../check/engine.ts";
import { RAW_IMG_ROLES, rawImgSites } from "../../check/rules/media.ts";
import { jsxAttributes, jsxElements } from "../../check/rules/tokens.ts";
import { CLIENT_IMPORT } from "../templates.ts";
import {
  applyEdits,
  defineCodemod,
  flagAt,
  namedImportEdit,
  parseSource,
  relativeFile,
  type CodemodChange,
  type CodemodFlag,
  type CodemodResult,
  type TextEdit,
} from "./codemod.ts";

export const IMG_COMPONENT = "Img";
export const PLACEHOLDER_MARKER = "REX610 placeholder";
export const PLACEHOLDER_SIZE = 1;

const NUMERIC = /^\d+(\.\d+)?$/;

const PLACEHOLDERS: Readonly<Record<"alt" | "width" | "height", string>> = Object.freeze({
  alt: `alt={"" /* ${PLACEHOLDER_MARKER} */}`,
  width: `width={${PLACEHOLDER_SIZE} /* ${PLACEHOLDER_MARKER} */}`,
  height: `height={${PLACEHOLDER_SIZE} /* ${PLACEHOLDER_MARKER} */}`,
});

const REQUIRED = ["alt", "width", "height"] as const;

function sizeEdit(source: ts.SourceFile, attribute: ts.JsxAttribute | undefined): TextEdit | null {
  const initializer = attribute?.initializer;
  if (initializer === undefined || !ts.isStringLiteral(initializer)) return null;
  if (!NUMERIC.test(initializer.text)) return null;
  return {
    start: initializer.getStart(source),
    end: initializer.getEnd(),
    text: `{${initializer.text}}`,
  };
}

function elementEdits(source: ts.SourceFile, element: ts.JsxOpeningLikeElement): TextEdit[] {
  const edits: TextEdit[] = [
    { start: element.tagName.getStart(source), end: element.tagName.getEnd(), text: IMG_COMPONENT },
  ];
  if (ts.isJsxOpeningElement(element) && ts.isJsxElement(element.parent)) {
    const closing = element.parent.closingElement.tagName;
    edits.push({ start: closing.getStart(source), end: closing.getEnd(), text: IMG_COMPONENT });
  }
  const attributes = jsxAttributes(element);
  for (const name of ["width", "height"] as const) {
    const edit = sizeEdit(source, attributes.get(name));
    if (edit !== null) edits.push(edit);
  }
  const missing = REQUIRED.filter((name) => !attributes.has(name));
  if (missing.length > 0) {
    const end = element.attributes.getEnd();
    edits.push({
      start: end,
      end,
      text: missing.map((name) => ` ${PLACEHOLDERS[name]}`).join(""),
    });
  }
  return edits;
}

export function convertRawImg(file: string, text: string): string | null {
  const source = parseSource(file, text);
  const sites = rawImgSites(source).filter((site) => site.form === "jsx");
  if (sites.length === 0) return null;
  const edits = sites.flatMap((site) =>
    elementEdits(source, site.node as ts.JsxOpeningLikeElement),
  );
  const importEdit = namedImportEdit(source, CLIENT_IMPORT, IMG_COMPONENT);
  if (importEdit !== null) edits.push(importEdit);
  return applyEdits(text, edits);
}

function placeholderNames(source: ts.SourceFile, element: ts.JsxOpeningLikeElement): string[] {
  const names: string[] = [];
  for (const [name, attribute] of jsxAttributes(element)) {
    const initializer = attribute.initializer;
    if (initializer === undefined) continue;
    if (initializer.getText(source).includes(PLACEHOLDER_MARKER)) names.push(name);
  }
  return names;
}

export function placeholderFlags(file: string, relative: string, text: string): CodemodFlag[] {
  const source = parseSource(file, text);
  const flags: CodemodFlag[] = [];
  for (const element of jsxElements(source)) {
    if (!ts.isIdentifier(element.tagName) || element.tagName.text !== IMG_COMPONENT) continue;
    const names = placeholderNames(source, element);
    if (names.length === 0) continue;
    flags.push(
      flagAt(
        source,
        relative,
        element,
        "REX610",
        names.length === 1
          ? `Img ${names[0]} is a placeholder; set the real value`
          : `Img ${names.join(", ")} are placeholders; set the real values`,
      ),
    );
  }
  for (const site of rawImgSites(source)) {
    if (site.form !== "createElement") continue;
    flags.push(
      flagAt(
        source,
        relative,
        site.node,
        "REX610",
        `createElement("img") was not converted; render Img from ${CLIENT_IMPORT} with width and height`,
      ),
    );
  }
  return flags;
}

export const codemod = defineCodemod({
  id: "0.1-raw-img",
  from: "0.1",
  description:
    "convert img elements in regions and parts to Img, flagging width, height and alt placeholders as REX610",
  run(root: string): CodemodResult {
    if (!existsSync(path.join(root, "app"))) return { changes: [], flags: [] };
    const app = discoverApp(root);
    const changes: CodemodChange[] = [];
    const flags: CodemodFlag[] = [];
    for (const file of app.files) {
      if (!RAW_IMG_ROLES.includes(file.role)) continue;
      const text = readFileSync(file.path, "utf8");
      const migrated = convertRawImg(file.path, text);
      const relative = relativeFile(root, file.path);
      if (migrated !== null && migrated !== text) changes.push({ file: relative, text: migrated });
      flags.push(...placeholderFlags(file.path, relative, migrated ?? text));
    }
    return { changes, flags };
  },
});
