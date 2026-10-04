import ts from "typescript";
import type { AppFile, FileRole } from "../engine.ts";
import { defineRule, finding, type Finding, type SourceLoader } from "../rule.ts";

export const RAW_IMG_TAG = "img";

export const RAW_IMG_ROLES: readonly FileRole[] = Object.freeze(["region", "part"]);

export interface RawImgSite {
  readonly node: ts.Node;
  readonly form: "jsx" | "createElement";
}

function isCreateElementCall(node: ts.CallExpression): boolean {
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text === "createElement";
  return ts.isPropertyAccessExpression(callee) && callee.name.text === "createElement";
}

export function rawImgSites(source: ts.SourceFile): RawImgSite[] {
  const found: RawImgSite[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      node.tagName.text === RAW_IMG_TAG
    ) {
      found.push({ node, form: "jsx" });
    } else if (ts.isCallExpression(node) && isCreateElementCall(node)) {
      const first = node.arguments[0];
      if (
        first !== undefined &&
        (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) &&
        first.text === RAW_IMG_TAG
      ) {
        found.push({ node, form: "createElement" });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const HINT =
  "Render images with Img from @sidioralabs/rex/client: it requires width and height, lazy-loads by default and preloads priority images during SSR.";

function checkFile(sources: SourceLoader, file: AppFile): Finding[] {
  const source = sources.load(file.path);
  return rawImgSites(source).map((site) =>
    finding({
      rule: "media/no-raw-img",
      file: file.file,
      ...sources.location(file.path, site.node),
      message:
        site.form === "jsx"
          ? `<img> in a ${file.role} bypasses Img`
          : `createElement("img") in a ${file.role} bypasses Img`,
      hint: HINT,
    }),
  );
}

export const mediaRule = defineRule({
  id: "media",
  description:
    "Reports raw img elements in regions and parts, which must render images through Img so they carry a size, lazy loading and SSR preloads.",
  check({ app, sources }) {
    return app.files
      .filter((file) => RAW_IMG_ROLES.includes(file.role))
      .flatMap((file) => checkFile(sources, file));
  },
});
