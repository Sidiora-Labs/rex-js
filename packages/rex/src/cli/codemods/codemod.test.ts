import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { errorDocs } from "../../core/errors.ts";
import {
  CODEMOD_FILE,
  CODEMOD_ID,
  addImportEdit,
  applyEdits,
  defaultImportName,
  defineCodemod,
  flagAt,
  formatFlag,
  importsNamed,
  namedImportEdit,
  parseSource,
  relativeFile,
  toPosix,
  topLevelNames,
  unwrapExpression,
  type Codemod,
  type CodemodFlag,
  type TextEdit,
} from "./codemod.ts";

const MEDIA = "@sidioralabs/rex/client/media";
const CLIENT = "@sidioralabs/rex/client";
const IMG_LINE = `import { Img } from ${JSON.stringify(MEDIA)};`;

const run: Codemod["run"] = () => ({ changes: [], flags: [] });

function expressionOf(text: string): ts.Expression {
  const source = parseSource("probe.ts", text);
  const [statement] = source.statements;
  if (statement === undefined || !ts.isExpressionStatement(statement)) {
    throw new Error(`${JSON.stringify(text)} is not an expression statement`);
  }
  return statement.expression;
}

function findNode<T extends ts.Node>(
  source: ts.SourceFile,
  predicate: (node: ts.Node) => node is T,
): T {
  let found: T | null = null;
  const visit = (node: ts.Node): void => {
    if (found === null && predicate(node)) found = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (found === null) throw new Error(`${source.fileName} has no matching node`);
  return found;
}

function applied(source: ts.SourceFile, edit: TextEdit | null): string {
  if (edit === null) throw new Error(`${source.fileName} needs no edit`);
  return applyEdits(source.text, [edit]);
}

describe("defineCodemod", () => {
  it("freezes a codemod whose id is its from version followed by a name", () => {
    const codemod = defineCodemod({ id: "0.1-probe", from: "0.1", description: "probe", run });
    expect(Object.isFrozen(codemod)).toBe(true);
    expect(codemod).toEqual({ id: "0.1-probe", from: "0.1", description: "probe", run });
    expect(CODEMOD_ID.test(codemod.id)).toBe(true);
  });

  it("rejects an id that is not <from>-<name>", () => {
    for (const id of ["probe", "0.1-Probe", "0.1-", "1-probe", "0.1-probe.ts", "0.1_probe"]) {
      expect(() => defineCodemod({ id, from: "0.1", description: "probe", run }), id).toThrow(
        new TypeError(`codemod id ${JSON.stringify(id)} must be <from>-<name>, such as 0.1-config`),
      );
    }
  });

  it("rejects an id that does not start with the from version", () => {
    expect(() =>
      defineCodemod({ id: "0.2-probe", from: "0.1", description: "probe", run }),
    ).toThrow(new TypeError("codemod 0.2-probe must start with its from version 0.1"));
    expect(() =>
      defineCodemod({ id: "0.10-probe", from: "0.1", description: "probe", run }),
    ).toThrow(TypeError);
  });
});

describe("CODEMOD_FILE", () => {
  it("matches versioned codemod modules and captures the version", () => {
    for (const name of ["0.1-config.ts", "0.1-raw-img.js", "10.12-schema-entry.ts"]) {
      expect(CODEMOD_FILE.test(name), name).toBe(true);
    }
    expect(CODEMOD_FILE.exec("0.1-raw-img.ts")?.[1]).toBe("0.1");
    expect(CODEMOD_FILE.exec("10.12-schema-entry.js")?.[1]).toBe("10.12");
  });

  it("ignores helpers, tests, declarations and other extensions", () => {
    for (const name of [
      "codemod.ts",
      "0.1-config.test.ts",
      "0.1-Config.ts",
      "0.1-config.d.ts",
      "0.1-config.tsx",
      "v0.1-config.ts",
      "0.1-config",
    ]) {
      expect(CODEMOD_FILE.test(name), name).toBe(false);
    }
  });
});

describe("formatFlag", () => {
  it("prints the code, the location, the message and the docs link", () => {
    const flag: CodemodFlag = {
      code: "REX610",
      file: "app/pages/home/regions/hero/region.tsx",
      line: 3,
      column: 7,
      message: "Img alt is a placeholder; set the real value",
    };
    expect(formatFlag(flag)).toBe(
      `REX610 app/pages/home/regions/hero/region.tsx:3:7 Img alt is a placeholder; set the real value (${errorDocs("REX610")})`,
    );
    expect(formatFlag(flag)).toContain("https://rex.sidioralabs.com/errors/REX610");
  });
});

describe("paths", () => {
  it("relativeFile returns the posix path of a file relative to the root", () => {
    const root = path.join(tmpdir(), "rex-codemod-root");
    expect(relativeFile(root, path.join(root, "app", "pages", "home", "page.ts"))).toBe(
      "app/pages/home/page.ts",
    );
    expect(relativeFile(`${root}${path.sep}`, path.join(root, "rex.config.ts"))).toBe(
      "rex.config.ts",
    );
    expect(relativeFile(root, path.join(root, "..", "other.ts"))).toBe("../other.ts");
    expect(relativeFile(path.join(root, "app", ".."), path.join(root, "app", "x.ts"))).toBe(
      "app/x.ts",
    );
  });

  it("toPosix joins the platform separator with slashes", () => {
    expect(toPosix(["app", "pages", "home.ts"].join(path.sep))).toBe("app/pages/home.ts");
    expect(toPosix("already/posix.ts")).toBe("already/posix.ts");
  });
});

describe("parseSource", () => {
  it("parses tsx files with JSX and ts files without it, keeping parent links", () => {
    const tsx = parseSource("probe.tsx", "export const node = <div />;\n");
    expect(tsx.fileName).toBe("probe.tsx");
    expect(tsx.languageVariant).toBe(ts.LanguageVariant.JSX);
    const element = findNode(tsx, ts.isJsxSelfClosingElement);
    expect(element.tagName.getText(tsx)).toBe("div");
    expect(element.parent.parent.parent).toBe(tsx.statements[0]);

    const plain = parseSource("probe.ts", "export const value = <number>input;\n");
    expect(plain.languageVariant).toBe(ts.LanguageVariant.Standard);
    expect(findNode(plain, ts.isTypeAssertionExpression).expression.getText(plain)).toBe("input");
  });
});

describe("applyEdits", () => {
  it("applies edits at their original offsets whatever their order", () => {
    const text = "const a = 1;\nconst b = 2;\n";
    expect(
      applyEdits(text, [
        { start: 6, end: 7, text: "alpha" },
        { start: text.length, end: text.length, text: "export {};\n" },
        { start: 19, end: 20, text: "beta" },
      ]),
    ).toBe("const alpha = 1;\nconst beta = 2;\nexport {};\n");
    expect(applyEdits(text, [])).toBe(text);
    expect(applyEdits(text, [{ start: 0, end: text.length, text: "" }])).toBe("");
  });
});

describe("unwrapExpression", () => {
  it("unwraps as, satisfies, parentheses and angle-bracket assertions", () => {
    const nested = unwrapExpression(expressionOf("(((value as Kind) satisfies Kind));"));
    expect(ts.isIdentifier(nested)).toBe(true);
    expect(nested.getText()).toBe("value");

    const asserted = expressionOf("<Kind>value;");
    expect(ts.isTypeAssertionExpression(asserted)).toBe(true);
    expect(unwrapExpression(asserted).getText()).toBe("value");

    const call = expressionOf("call(value as Kind);");
    expect(unwrapExpression(call)).toBe(call);
  });
});

describe("flagAt", () => {
  it("reports the one-based line and column where the node starts", () => {
    const source = parseSource(
      "probe.tsx",
      [IMG_LINE, "", 'const node = <Img alt="" width={1} height={1} />;', ""].join("\n"),
    );
    const element = findNode(source, ts.isJsxSelfClosingElement);
    const flag = flagAt(source, "app/probe.tsx", element, "REX610", "placeholder");
    expect(flag).toEqual({
      code: "REX610",
      file: "app/probe.tsx",
      line: 3,
      column: 14,
      message: "placeholder",
    });
    expect(Object.isFrozen(flag)).toBe(true);
    const first = flagAt(source, "app/probe.tsx", source.statements[0] as ts.Node, "REX610", "i");
    expect([first.line, first.column]).toEqual([1, 1]);
  });
});

describe("import inspection", () => {
  const SOURCE = [
    'import React from "react";',
    'import type Types from "./types.ts";',
    `import { region, type ActControlProps } from ${JSON.stringify(CLIENT)};`,
    `import { Img as Picture, Script } from ${JSON.stringify(MEDIA)};`,
    'import type { Props } from "./props.ts";',
    "",
  ].join("\n");

  it("defaultImportName returns the value default import of a specifier", () => {
    const source = parseSource("probe.tsx", SOURCE);
    expect(defaultImportName(source, "react")).toBe("React");
    expect(defaultImportName(source, "./types.ts")).toBeNull();
    expect(defaultImportName(source, CLIENT)).toBeNull();
    expect(defaultImportName(source, "missing")).toBeNull();
  });

  it("importsNamed sees value bindings imported under their own name only", () => {
    const source = parseSource("probe.tsx", SOURCE);
    expect(importsNamed(source, CLIENT, "region")).toBe(true);
    expect(importsNamed(source, CLIENT, "ActControlProps")).toBe(false);
    expect(importsNamed(source, MEDIA, "Script")).toBe(true);
    expect(importsNamed(source, MEDIA, "Img")).toBe(false);
    expect(importsNamed(source, MEDIA, "Picture")).toBe(false);
    expect(importsNamed(source, "./props.ts", "Props")).toBe(false);
    expect(importsNamed(source, "react", "React")).toBe(false);
    expect(importsNamed(source, "missing", "region")).toBe(false);
  });
});

describe("import edits", () => {
  it("addImportEdit appends after the last import or opens the file with a blank line", () => {
    const withImports = parseSource(
      "probe.ts",
      'import a from "a";\nimport b from "b";\n\nexport const c = a + b;\n',
    );
    const edit = addImportEdit(withImports, IMG_LINE);
    expect(edit).toEqual({ start: 37, end: 37, text: `\n${IMG_LINE}` });
    expect(applied(withImports, edit)).toBe(
      `import a from "a";\nimport b from "b";\n${IMG_LINE}\n\nexport const c = a + b;\n`,
    );

    const bare = parseSource("probe.ts", "export const c = 1;\n");
    expect(addImportEdit(bare, IMG_LINE)).toEqual({ start: 0, end: 0, text: `${IMG_LINE}\n\n` });
    expect(applied(bare, addImportEdit(bare, IMG_LINE))).toBe(
      `${IMG_LINE}\n\nexport const c = 1;\n`,
    );
  });

  it("namedImportEdit extends the existing import of the specifier", () => {
    const existing = parseSource("probe.tsx", `import { Script } from ${JSON.stringify(MEDIA)};\n`);
    expect(applied(existing, namedImportEdit(existing, MEDIA, "Img"))).toBe(
      `import { Script, Img } from ${JSON.stringify(MEDIA)};\n`,
    );
    expect(namedImportEdit(existing, MEDIA, "Script")).toBeNull();

    const empty = parseSource("probe.tsx", `import {} from ${JSON.stringify(MEDIA)};\n`);
    expect(applied(empty, namedImportEdit(empty, MEDIA, "Img"))).toBe(`${IMG_LINE}\n`);
  });

  it("namedImportEdit adds an import line when only type imports or no imports exist", () => {
    const typeOnly = parseSource(
      "probe.tsx",
      `import type { ImgProps } from ${JSON.stringify(MEDIA)};\n`,
    );
    expect(applied(typeOnly, namedImportEdit(typeOnly, MEDIA, "Img"))).toBe(
      `import type { ImgProps } from ${JSON.stringify(MEDIA)};\n${IMG_LINE}\n`,
    );

    const other = parseSource("probe.tsx", `import { region } from ${JSON.stringify(CLIENT)};\n`);
    expect(applied(other, namedImportEdit(other, MEDIA, "Img"))).toBe(
      `import { region } from ${JSON.stringify(CLIENT)};\n${IMG_LINE}\n`,
    );

    const absent = parseSource("probe.tsx", "export const x = 1;\n");
    expect(applied(absent, namedImportEdit(absent, MEDIA, "Img"))).toBe(
      `${IMG_LINE}\n\nexport const x = 1;\n`,
    );
  });
});

describe("topLevelNames", () => {
  it("collects import bindings, destructured variables, functions and classes", () => {
    const source = parseSource(
      "probe.ts",
      [
        'import React, { useState, type FC } from "react";',
        'import * as path from "node:path";',
        "const { a, b: [c, d], ...rest } = source;",
        "let [e, , f] = pair;",
        "function g() {",
        "  const hidden = 1;",
        "  return hidden;",
        "}",
        "class H {}",
        "export default function () {}",
        "",
      ].join("\n"),
    );
    expect([...topLevelNames(source)].sort()).toEqual(
      ["FC", "H", "React", "a", "c", "d", "e", "f", "g", "path", "rest", "useState"].sort(),
    );
    expect(topLevelNames(parseSource("empty.ts", "")).size).toBe(0);
  });
});
