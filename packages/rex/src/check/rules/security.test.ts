import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  unsafeHtml,
  UNSAFE_HTML_ATTRIBUTE,
  type UnsafeHtmlTag,
} from "../../client/unsafe-html.tsx";
import { discoverApp, runRules } from "../engine.ts";
import { createSourceLoader } from "../rule.ts";
import { defaultRules } from "./index.ts";
import { RAW_HTML_PROP, securityRule, unsafeHtmlSites } from "./security.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, "../fixtures/security");
const passRoot = path.join(fixtures, "pass");
const failRoot = path.join(fixtures, "fail");
const sourceRoot = path.resolve(here, "../..");
const SANCTIONED_MODULE = "client/unsafe-html.tsx";
const ESCAPE_IMPORT =
  /import\s*\{[^}]*\bescapeInlineJson\b[^}]*\}\s*from\s*"[./]*core\/serialize\.ts"/;

function packageSources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "fixtures" && entry.name !== "node_modules") packageSources(full, found);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

describe("security/unsafe-html", () => {
  it("is part of the default rule set", () => {
    expect(defaultRules).toContain(securityRule);
    expect(securityRule.id).toBe("security");
  });

  it("reports zero findings when raw HTML goes through unsafeHtml()", async () => {
    const result = await runRules(discoverApp(passRoot), [securityRule]);
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("reports every dangerouslySetInnerHTML outside unsafeHtml() with its position", async () => {
    const result = await runRules(discoverApp(failRoot), [securityRule]);
    expect(
      result.findings.map((entry) => [entry.file, entry.line, entry.column, entry.rule]),
    ).toEqual([
      ["app/components/Raw.tsx", 3, 22, "security/unsafe-html"],
      ["app/pages/article/hooks/useMarkup.ts", 3, 3, "security/unsafe-html"],
      ["app/pages/article/regions/body/parts/Excerpt.tsx", 4, 31, "security/unsafe-html"],
      ["app/pages/article/regions/body/region.tsx", 6, 30, "security/unsafe-html"],
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.errors).toBe(4);
  });

  it("names the element and the sanctioned fix", async () => {
    const result = await runRules(discoverApp(failRoot), [securityRule]);
    const messages = result.findings.map((entry) => entry.message);
    expect(messages).toEqual([
      "dangerouslySetInnerHTML is set outside unsafeHtml()",
      "dangerouslySetInnerHTML is set outside unsafeHtml()",
      "dangerouslySetInnerHTML is set outside unsafeHtml()",
      "<div> sets dangerouslySetInnerHTML outside unsafeHtml()",
    ]);
    for (const entry of result.findings) {
      expect(entry.severity).toBe("error");
      expect(entry.hint).toContain("unsafeHtml(html)");
      expect(entry.hint).toContain("@sidioralabs/rex/client");
    }
  });

  it("leaves app tests alone", async () => {
    const app = discoverApp(failRoot);
    expect(app.byRole("test").map((file) => file.file)).toEqual([
      "app/pages/article/test/render.test.tsx",
    ]);
    const result = await runRules(app, [securityRule]);
    expect(result.findings.some((entry) => entry.file.includes("/test/"))).toBe(false);
  });
});

describe("unsafeHtml", () => {
  it("renders the given markup unescaped inside a marked container", () => {
    expect(UNSAFE_HTML_ATTRIBUTE).toBe("data-rex-unsafe-html");
    expect(renderToStaticMarkup(unsafeHtml("<b>bold</b> &amp; plain"))).toBe(
      '<div data-rex-unsafe-html=""><b>bold</b> &amp; plain</div>',
    );
    expect(renderToStaticMarkup(unsafeHtml("<em>x</em>", { as: "span", className: "prose" }))).toBe(
      '<span class="prose" data-rex-unsafe-html=""><em>x</em></span>',
    );
  });

  it("refuses anything but a string of markup and an allowed container", () => {
    expect(() => unsafeHtml({ __html: "<b>x</b>" } as unknown as string)).toThrow(
      expect.objectContaining({ name: "RexError", code: "REX314" }),
    );
    expect(() => unsafeHtml("<b>x</b>", { as: "script" as UnsafeHtmlTag })).toThrow(
      "unsafeHtml: as must be one of div, span, section, article",
    );
  });

  it("is the opt-in: ordinary children stay escaped", () => {
    const hostile = "</p><script>alert(1)</script>&";
    expect(renderToStaticMarkup(createElement("p", null, hostile))).toBe(
      "<p>&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;&amp;</p>",
    );
  });
});

describe("escaping audit of the Rex package", () => {
  const loader = createSourceLoader();
  const sites = packageSources(sourceRoot)
    .map((file) => ({
      file: path.relative(sourceRoot, file).split(path.sep).join("/"),
      full: file,
      count: unsafeHtmlSites(loader.load(file)).length,
    }))
    .filter((entry) => entry.count > 0);

  it("finds the sanctioned helper and the sidecar script", () => {
    const files = sites.map((entry) => entry.file);
    expect(files).toContain(SANCTIONED_MODULE);
    expect(files).toContain("client/agent/sidecar.tsx");
  });

  it("routes every other raw HTML site through escapeInlineJson", () => {
    for (const entry of sites) {
      if (entry.file === SANCTIONED_MODULE) continue;
      const text = loader.read(entry.full);
      expect(text, `${entry.file} sets ${RAW_HTML_PROP} without escapeInlineJson`).toMatch(
        ESCAPE_IMPORT,
      );
    }
  });
});
