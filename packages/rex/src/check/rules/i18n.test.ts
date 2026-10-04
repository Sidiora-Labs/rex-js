import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { discoverApp, runRules } from "../engine.ts";
import { defaultRules } from "./index.ts";
import { i18nRule, i18nTextProblem } from "./i18n.ts";

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const I18N_CONFIG = [
  'import { defineConfig } from "@sidioralabs/rex/config";',
  'import app from "rex:app";',
  "",
  "export default defineConfig({",
  "  app,",
  '  i18n: { locales: ["en", "pt-BR"], default: "en", routing: "prefix" },',
  '  check: { i18n: { allow: ["Rex"] } },',
  "});",
  "",
].join("\n");

const PLAIN_CONFIG = [
  'import { defineConfig } from "@sidioralabs/rex/config";',
  'import app from "rex:app";',
  "",
  "export default defineConfig({ app });",
  "",
].join("\n");

const ACTION = [
  'import { action, always } from "@sidioralabs/rex";',
  'import { z } from "zod/mini";',
  "",
  'export const send = action("send", {',
  "  input: z.object({}),",
  "  output: z.object({}),",
  "  policy: always(),",
  '  effect: "reversible",',
  '  label: "Send funds",',
  "  handler: () => ({}),",
  "});",
  "",
  'export const archive = action("archive", {',
  "  input: z.object({}),",
  "  output: z.object({}),",
  "  policy: always(),",
  '  effect: "reversible",',
  '  label: "msg:archive.label",',
  "  handler: () => ({}),",
  "});",
  "",
].join("\n");

const PAGE = [
  'import { page } from "@sidioralabs/rex";',
  'import { archive, send } from "../../actions/send.ts";',
  "",
  'export default page("home", {',
  '  route: "/",',
  "  actions: [send, archive],",
  '  chrome: { title: "Home" },',
  '  regions: ["main"],',
  "});",
  "",
].join("\n");

const TRANSLATED_PAGE = [
  'import { page } from "@sidioralabs/rex";',
  'import { archive } from "../../actions/archive.ts";',
  "",
  'export default page("home", {',
  '  route: "/",',
  "  actions: [archive],",
  '  chrome: { title: "msg:home.title" },',
  '  regions: ["main"],',
  "});",
  "",
].join("\n");

const REGION = [
  'import { region } from "@sidioralabs/rex/client";',
  "",
  'export default region("main", () => (',
  "  <section>",
  '    <button type="button" aria-label="Close">x</button>',
  '    <input title={"Amount"} />',
  '    <span title="Rex">brand</span>',
  '    <span title="msg:bad key">broken</span>',
  '    <span aria-label="msg:home.close">ok</span>',
  "  </section>",
  "));",
  "",
].join("\n");

const TRANSLATED_REGION = [
  'import { region } from "@sidioralabs/rex/client";',
  "",
  'export default region("main", () => (',
  "  <section>",
  '    <button type="button" aria-label="msg:home.close">x</button>',
  '    <span title="Rex">brand</span>',
  "  </section>",
  "));",
  "",
].join("\n");

const TRANSLATED_ACTION = [
  'import { action, always } from "@sidioralabs/rex";',
  'import { z } from "zod/mini";',
  "",
  'export const archive = action("archive", {',
  "  input: z.object({}),",
  "  output: z.object({}),",
  "  policy: always(),",
  '  effect: "reversible",',
  '  label: "msg:archive.label",',
  "  handler: () => ({}),",
  "});",
  "",
].join("\n");

function fixture(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), "rex-i18n-"));
  roots.push(root);
  for (const [file, content] of Object.entries(files)) {
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return root;
}

const failing = () =>
  fixture({
    "rex.config.ts": I18N_CONFIG,
    "app/actions/send.ts": ACTION,
    "app/pages/home/page.ts": PAGE,
    "app/pages/home/regions/main/region.tsx": REGION,
    "app/locales/en.json": '{ "archive.label": "Archive" }\n',
  });

describe("i18n/literal", () => {
  it("is part of the default rule set", () => {
    expect(defaultRules).toContain(i18nRule);
    expect(i18nRule.id).toBe("i18n");
  });

  it("classifies literals, msg: keys and allowed texts", () => {
    expect(i18nTextProblem("Send", [])).toBe("literal");
    expect(i18nTextProblem("msg:send.label", [])).toBeNull();
    expect(i18nTextProblem("msg:send.done?amount=5", [])).toBeNull();
    expect(i18nTextProblem("msg:bad key", [])).toBe("invalid-key");
    expect(i18nTextProblem("Rex", ["Rex"])).toBeNull();
    expect(i18nTextProblem("  ", [])).toBeNull();
  });

  it("reports label and title literals with file, line, column, message and hint", async () => {
    const result = await runRules(discoverApp(failing()), [i18nRule]);
    expect(
      result.findings.map((entry) => [entry.rule, entry.file, entry.line, entry.column]),
    ).toEqual([
      ["i18n/literal", "app/actions/send.ts", 9, 10],
      ["i18n/literal", "app/pages/home/page.ts", 7, 20],
      ["i18n/literal", "app/pages/home/regions/main/region.tsx", 5, 38],
      ["i18n/literal", "app/pages/home/regions/main/region.tsx", 6, 19],
      ["i18n/literal", "app/pages/home/regions/main/region.tsx", 8, 17],
    ]);
    expect(result.exitCode).toBe(1);
    const [label] = result.findings;
    expect(label?.message).toBe(
      'label "Send funds" is a literal; with i18n configured, labels and titles are msg: keys',
    );
    expect(label?.hint).toContain('"msg:<key>"');
    expect(label?.hint).toContain("check.i18n.allow");
    expect(result.findings.at(-1)?.message).toBe('title "msg:bad key" is not a valid msg: key');
  });

  it("passes an app whose labels and titles are msg: keys or allowed", async () => {
    const root = fixture({
      "rex.config.ts": I18N_CONFIG,
      "app/actions/archive.ts": TRANSLATED_ACTION,
      "app/pages/home/page.ts": TRANSLATED_PAGE,
      "app/pages/home/regions/main/region.tsx": TRANSLATED_REGION,
    });
    const result = await runRules(discoverApp(root), [i18nRule]);
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("reports nothing when i18n is not configured", async () => {
    const root = fixture({
      "rex.config.ts": PLAIN_CONFIG,
      "app/actions/send.ts": ACTION,
      "app/pages/home/page.ts": PAGE,
      "app/pages/home/regions/main/region.tsx": REGION,
    });
    const result = await runRules(discoverApp(root), [i18nRule]);
    expect(result.findings).toEqual([]);
  });

  it("honours the allow list and reports an unreadable one", async () => {
    const allowing = fixture({
      "rex.config.ts": I18N_CONFIG.replace(
        'allow: ["Rex"]',
        'allow: ["Rex", "Send funds", "Home", "Close", "Amount"]',
      ),
      "app/actions/send.ts": ACTION,
      "app/pages/home/page.ts": PAGE,
      "app/pages/home/regions/main/region.tsx": REGION,
    });
    const allowed = await runRules(discoverApp(allowing), [i18nRule]);
    expect(allowed.findings.map((entry) => [entry.file, entry.line])).toEqual([
      ["app/pages/home/regions/main/region.tsx", 8],
    ]);

    const dynamic = fixture({
      "rex.config.ts": I18N_CONFIG.replace('allow: ["Rex"]', "allow: BRANDS"),
      "app/actions/archive.ts": TRANSLATED_ACTION,
    });
    const unreadable = await runRules(discoverApp(dynamic), [i18nRule]);
    expect(unreadable.findings.map((entry) => [entry.rule, entry.file, entry.line])).toEqual([
      ["i18n/config", "rex.config.ts", 7],
    ]);
    expect(unreadable.findings[0]?.message).toBe(
      "check.i18n.allow in rex.config.ts must be a literal list of strings",
    );
  });
});
