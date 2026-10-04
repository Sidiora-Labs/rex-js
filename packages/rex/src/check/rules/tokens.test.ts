import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";
import { resolveOptions } from "../../core/config.ts";
import { discoverApp, runRules } from "../engine.ts";
import { createSourceLoader } from "../rule.ts";
import { defaultRules } from "./index.ts";
import {
  DEFAULT_TOKEN_SETTINGS,
  EMPTY_THEME,
  attributeName,
  classTokens,
  classifyClassToken,
  jsxAttributes,
  jsxElements,
  rawColors,
  rawLengths,
  readTokenConfig,
  readTokenTheme,
  splitVariants,
  tokensRule,
} from "./tokens.ts";

const CHECK_TIMEOUT_MS = 60_000;
const CONFIG_HEAD = [
  'import { defineConfig } from "@sidioralabs/rex/config";',
  'import app from "rex:app";',
  "",
  "",
].join("\n");
const PAGE = [
  'import { page } from "@sidioralabs/rex";',
  "",
  'export default page("home", { route: "/", regions: ["cards"] });',
  "",
].join("\n");
const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function writeRoot(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "rex-tokens-"));
  temporary.push(root);
  for (const [file, content] of Object.entries(files)) {
    const full = path.join(root, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

function parse(text: string): ts.SourceFile {
  return ts.createSourceFile("probe.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function attributeOf(source: ts.SourceFile, name: string): ts.JsxAttribute {
  const attribute = jsxAttributes(jsxElements(source)[0] as ts.JsxOpeningLikeElement).get(name);
  if (attribute === undefined) throw new Error(`no ${name} attribute`);
  return attribute;
}

describe("jsx helpers", () => {
  it("collect opening and self-closing elements with their attributes", () => {
    const source = parse(
      '<section id="a"><p data-rex="x" aria-label="y" {...rest}>t</p><use xlink:href="#i" /></section>',
    );
    const elements = jsxElements(source);
    expect(elements.map((element) => element.tagName.getText(source))).toEqual([
      "section",
      "p",
      "use",
    ]);
    expect([...jsxAttributes(elements[1] as ts.JsxOpeningLikeElement).keys()]).toEqual([
      "data-rex",
      "aria-label",
    ]);
    const use = jsxAttributes(elements[2] as ts.JsxOpeningLikeElement);
    expect([...use.keys()]).toEqual(["xlink:href"]);
    expect(attributeName(use.get("xlink:href") as ts.JsxAttribute)).toBe("xlink:href");
    expect(attributeName(attributeOf(source, "id"))).toBe("id");
  });

  it("split class strings and templates into positioned tokens", () => {
    const text = '<div className={cond ? "a b" : `c ${x} d`} />';
    const source = parse(text);
    const tokens = classTokens(source, attributeOf(source, "className"));
    expect(tokens).toEqual([
      { token: "a", position: 24 },
      { token: "b", position: 26 },
      { token: "c", position: 32 },
      { token: "d", position: 39 },
    ]);
    for (const { token, position } of tokens) {
      expect(text.slice(position, position + token.length)).toBe(token);
    }
  });

  it("skip the parts a filter rejects and attributes without a value", () => {
    const source = parse('<div className={styles["raw-1"] + " b"} hidden />');
    const className = attributeOf(source, "className");
    expect(classTokens(source, className).map((entry) => entry.token)).toEqual(["raw-1", "b"]);
    const skip = (node: ts.Node) => ts.isElementAccessExpression(node);
    expect(classTokens(source, className, skip).map((entry) => entry.token)).toEqual(["b"]);
    expect(classTokens(source, attributeOf(source, "hidden"))).toEqual([]);
  });
});

describe("class token classification", () => {
  it("resolves palette utilities through the theme and the allow lists", () => {
    expect(DEFAULT_TOKEN_SETTINGS.theme).toBe(EMPTY_THEME);
    expect(DEFAULT_TOKEN_SETTINGS.allow).toEqual(resolveOptions().check.tokens);
    expect(classifyClassToken("!bg-red-500")).toEqual({ kind: "raw-color", value: "red-500" });
    expect(classifyClassToken("bg-red-500/[0.5]")).toEqual({ kind: "raw-color", value: "red-500" });
    expect(classifyClassToken("ring-offset-white")).toEqual({ kind: "raw-color", value: "white" });
    expect(classifyClassToken("border-x-slate-50")).toEqual({
      kind: "raw-color",
      value: "slate-50",
    });
    const theme = { files: ["styles.css"], variables: new Set(["--color-red-500"]) };
    expect(classifyClassToken("bg-red-500", { ...DEFAULT_TOKEN_SETTINGS, theme })).toBeNull();
    expect(classifyClassToken("bg-red-600", { ...DEFAULT_TOKEN_SETTINGS, theme })).toEqual({
      kind: "raw-color",
      value: "red-600",
    });
    const allow = { colors: ["red-500"], spacing: [], classes: ["bg-black"] };
    const settings = { ...DEFAULT_TOKEN_SETTINGS, allow };
    expect(classifyClassToken("text-red-500", settings)).toBeNull();
    expect(classifyClassToken("hover:bg-black", settings)).toBeNull();
    expect(classifyClassToken("hover:bg-white", settings)).toEqual({
      kind: "raw-color",
      value: "white",
    });
  });

  it("classifies arbitrary properties and values by what they hold", () => {
    expect(classifyClassToken("[margin:4px]")).toEqual({ kind: "arbitrary-value", value: "4px" });
    expect(classifyClassToken("[color:red]")).toEqual({ kind: "arbitrary-value", value: "red" });
    const allowRed = {
      ...DEFAULT_TOKEN_SETTINGS,
      allow: { colors: ["red"], spacing: [], classes: [] },
    };
    expect(classifyClassToken("[color:red]", allowRed)).toBeNull();
    expect(classifyClassToken("text-[color:var(--fg)]")).toBeNull();
    expect(classifyClassToken("bg-[url(/img.png)]")).toBeNull();
    expect(classifyClassToken("gap-[2px_4px]")).toEqual({
      kind: "arbitrary-value",
      value: "2px 4px",
    });
    expect(classifyClassToken("inset-x-[10%]")).toEqual({ kind: "arbitrary-value", value: "10%" });
  });

  it("finds raw colors and lengths outside var() references", () => {
    expect(splitVariants("p-4")).toEqual({ variants: "", base: "p-4" });
    expect(splitVariants("[&>*]:dark:p-4")).toEqual({ variants: "[&>*]:dark:", base: "p-4" });
    expect(rawColors("rgb(0 0 0) var(--x, #fff)")).toEqual(["rgb(0 0 0)"]);
    expect(rawColors("RED", ["red"])).toEqual([]);
    expect(rawColors("1px solid transparent")).toEqual([]);
    expect(rawLengths("0px 0 0.5em")).toEqual(["0.5em"]);
    expect(rawLengths("-2rem", ["-2REM"])).toEqual([]);
    expect(rawLengths("0")).toEqual([]);
    expect(rawLengths("var(--gap) 3px")).toEqual(["3px"]);
  });
});

describe("readTokenTheme", () => {
  it("collects @theme variables below the root, skipping comments, hidden and dependency folders", () => {
    const root = writeRoot({
      "styles.css": "@theme {\n  --color-brand: #123456;\n  --color-red-500: #ef4444;\n}\n",
      "src/theme/tokens.css": [
        "/* @theme { --color-commented: red; } */",
        "@theme inline {",
        "  --spacing-gutter: 1rem;",
        "  --color-accent: oklch(0.7 0.1 200);",
        "}",
        "@theme {",
        "  --radius-card: 8px;",
        "}",
        "",
      ].join("\n"),
      "plain.css": ".card {\n  color: var(--color-brand);\n}\n",
      "node_modules/kit/theme.css": "@theme {\n  --color-ignored: red;\n}\n",
      ".cache/theme.css": "@theme {\n  --color-hidden: red;\n}\n",
    });
    const theme = readTokenTheme(root);
    expect(theme.files).toEqual(["src/theme/tokens.css", "styles.css"]);
    expect([...theme.variables].sort()).toEqual([
      "--color-accent",
      "--color-brand",
      "--color-red-500",
      "--radius-card",
      "--spacing-gutter",
    ]);
    expect(Object.isFrozen(theme)).toBe(true);
    expect(classifyClassToken("bg-red-500", { ...DEFAULT_TOKEN_SETTINGS, theme })).toBeNull();
    expect(classifyClassToken("bg-red-600", { ...DEFAULT_TOKEN_SETTINGS, theme })).toEqual({
      kind: "raw-color",
      value: "red-600",
    });
  });

  it("returns the empty theme for a root without css", () => {
    const theme = readTokenTheme(writeRoot({ "app/data/empty.ts": "export {};\n" }));
    expect(theme).toEqual(EMPTY_THEME);
    expect(theme.variables.size).toBe(0);
  });
});

describe("readTokenConfig", () => {
  it("falls back to the defaults without a config file or a check field", () => {
    const sources = createSourceLoader();
    const none = writeRoot({ "app/data/empty.ts": "export {};\n" });
    expect(readTokenConfig(none, sources)).toEqual({
      allow: DEFAULT_TOKEN_SETTINGS.allow,
      findings: [],
    });
    const plain = writeRoot({
      "rex.config.ts": `${CONFIG_HEAD}export default defineConfig({ app });\n`,
    });
    expect(readTokenConfig(plain, sources)).toEqual({
      allow: DEFAULT_TOKEN_SETTINGS.allow,
      findings: [],
    });
  });

  it("reads literal allow lists through a named config variable", () => {
    const root = writeRoot({
      "rex.config.ts": [
        CONFIG_HEAD.trimEnd(),
        "",
        "const config = defineConfig({",
        "  app,",
        '  check: { tokens: { classes: ["bg-black"], spacing: ["8px"] } },',
        "});",
        "",
        "export default config;",
        "",
      ].join("\n"),
    });
    expect(readTokenConfig(root, createSourceLoader())).toEqual({
      allow: { colors: [], spacing: ["8px"], classes: ["bg-black"] },
      findings: [],
    });
  });

  it("reports a check field it cannot read statically at its position", () => {
    const shorthand = writeRoot({
      "rex.config.ts": `${CONFIG_HEAD}const check = { tokens: { colors: ["#000"] } };\n\nexport default defineConfig({ app, check });\n`,
    });
    const dynamic = writeRoot({
      "rex.config.ts": `${CONFIG_HEAD}const dark = "#000";\n\nexport default defineConfig({ app, check: { tokens: { colors: [dark] } } });\n`,
    });
    const sources = createSourceLoader();
    for (const [root, line, column] of [
      [shorthand, 6, 36],
      [dynamic, 6, 64],
    ] as const) {
      const read = readTokenConfig(root, sources);
      expect(read.allow).toBe(DEFAULT_TOKEN_SETTINGS.allow);
      expect(
        read.findings.map((entry) => [
          entry.rule,
          entry.file,
          entry.line,
          entry.column,
          entry.message,
        ]),
      ).toEqual([
        [
          "tokens/config",
          "rex.config.ts",
          line,
          column,
          "check in rex.config.ts is not a static literal, so rex check cannot read its token allow lists",
        ],
      ]);
    }
  });

  it("reports allow lists the config schema rejects", () => {
    const root = writeRoot({
      "rex.config.ts": `${CONFIG_HEAD}export default defineConfig({ app, check: { tokens: { colors: "red" } } });\n`,
    });
    const read = readTokenConfig(root, createSourceLoader());
    expect(read.allow).toBe(DEFAULT_TOKEN_SETTINGS.allow);
    expect(read.findings.map((entry) => [entry.line, entry.column, entry.message])).toEqual([
      [4, 36, 'REX123 rex.config.ts: field "check.tokens.colors" must be a list of strings'],
    ]);
    expect(read.findings[0]?.hint).toContain("check.tokens");
  });
});

describe("tokens rule", { timeout: CHECK_TIMEOUT_MS }, () => {
  it("is in the default rule set", () => {
    expect(tokensRule.id).toBe("tokens");
    expect(defaultRules).toContain(tokensRule);
  });

  it("reports raw utilities and inline styles outside components and tests, honouring the allow lists", async () => {
    const region = "app/pages/home/regions/cards/region.tsx";
    const root = writeRoot({
      "rex.config.ts": [
        CONFIG_HEAD.trimEnd(),
        "",
        "export default defineConfig({",
        "  app,",
        '  check: { tokens: { spacing: ["8px"], colors: ["#111"], classes: ["bg-black"] } },',
        "});",
        "",
      ].join("\n"),
      "app/pages/home/page.ts": PAGE,
      "app/pages/home/regions/cards/region.module.css": ".card {\n  color: var(--color-fg);\n}\n",
      [region]: [
        'import styles from "./region.module.css";',
        "",
        'const tone = "red";',
        "",
        "export default function CardsRegion() {",
        "  return (",
        '    <section className={`${styles["bg-red-500"]} hover:bg-red-500 bg-black`}>',
        '      <p class="text-white" style={{ paddingTop: 8, margin: 0, top: "-4px", gap: "var(--space-2)" }}>',
        "        Raw",
        "      </p>",
        '      <p style={{ color: tone, boxShadow: "0 0 2px #000", border: "1px solid var(--line)", background: "inherit" }}>',
        "        Tone",
        "      </p>",
        "    </section>",
        "  );",
        "}",
        "",
      ].join("\n"),
      "app/components/Raw.tsx":
        'export default function Raw() {\n  return <div className="bg-red-500" />;\n}\n',
      "app/pages/home/test/region.test.tsx":
        'export const probe = <div className="bg-red-500" />;\n',
    });
    const app = discoverApp(root);
    expect(app.byRole("component").map((file) => file.file)).toEqual(["app/components/Raw.tsx"]);
    expect(app.byRole("test").map((file) => file.file)).toEqual([
      "app/pages/home/test/region.test.tsx",
    ]);
    const result = await runRules(app, [tokensRule]);
    expect(
      result.findings.map((entry) => [
        entry.file,
        entry.line,
        entry.column,
        entry.rule,
        entry.message,
      ]),
    ).toEqual([
      [
        region,
        7,
        50,
        "tokens/raw-color",
        'raw color utility "hover:bg-red-500" outside app/components',
      ],
      [region, 8, 17, "tokens/raw-color", 'raw color utility "text-white" outside app/components'],
      [region, 8, 64, "tokens/inline-spacing", 'inline style top uses the raw value "-4px"'],
      [region, 11, 19, "tokens/inline-color", "inline style color is not a token reference"],
      [
        region,
        11,
        32,
        "tokens/inline-color",
        'inline style boxShadow uses the raw value "0 0 2px #000"',
      ],
    ]);
    expect(result.findings[0]?.hint).toContain("check.tokens.colors");
    expect(result.findings[2]?.hint).toContain("check.tokens.spacing");
    expect(result.exitCode).toBe(1);
  });
});
