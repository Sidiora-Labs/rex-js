import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { discoverApp, runRules } from "../engine.ts";
import { createSourceLoader } from "../rule.ts";
import { defaultRules } from "./index.ts";
import {
  STATIC_BUILD_SCRIPT,
  STATIC_POST_CODE,
  buildsStaticWithoutApi,
  readStaticDeployment,
  renderRule,
} from "./render.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, "../fixtures/render");
const passRoot = path.join(fixtures, "pass");
const failRoot = path.join(fixtures, "fail");

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function tempApp(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), "rex-render-rule-"));
  temporary.push(root);
  for (const [file, text] of Object.entries(files)) {
    const full = path.join(root, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  return root;
}

describe("render/static-needs-js", () => {
  it("is part of the default rule set", () => {
    expect(defaultRules).toContain(renderRule);
    expect(renderRule.id).toBe("render");
  });

  it("reports zero findings for a static page whose actions and overlays work without JavaScript", async () => {
    const result = await runRules(discoverApp(passRoot), [renderRule]);
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("reports a shortcut action and a region-bound overlay on a static page with their positions", async () => {
    const result = await runRules(discoverApp(failRoot), [renderRule]);
    expect(
      result.findings.map((entry) => [entry.rule, entry.file, entry.line, entry.column]),
    ).toEqual([
      ["render/static-needs-js", "app/pages/about/page.ts", 8, 24],
      ["render/static-needs-js", "app/pages/about/page.ts", 12, 5],
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.errors).toBe(2);
  });

  it("names the page, the action or overlay and the fix", async () => {
    const result = await runRules(discoverApp(failRoot), [renderRule]);
    expect(result.findings.map((entry) => entry.message)).toEqual([
      'static page "about" declares action "add-note" with shortcut "mod+n", which needs JavaScript (declared in app/actions/add-note.ts)',
      'static page "about" declares overlay "NoteSheet" bound to region state, which needs JavaScript',
    ]);
    const [shortcut, overlay] = result.findings;
    expect(shortcut?.hint).toContain('Remove the shortcut from action "add-note"');
    expect(overlay?.hint).toContain('binding: "url"');
    for (const entry of result.findings) {
      expect(entry.severity).toBe("error");
      expect(entry.hint).toContain('"ssg" or "ssr"');
    }
  });

  it("leaves pages that hydrate alone even when they use shortcuts and region overlays", async () => {
    const result = await runRules(discoverApp(failRoot), [renderRule]);
    expect(result.findings.some((entry) => entry.file === "app/pages/home/page.ts")).toBe(false);
  });

  it("reads the render mode through as const and quoted keys", async () => {
    const root = tempApp({
      "app/actions/ping.ts": [
        'import { action, always } from "@sidioralabs/rex";',
        'import { z } from "zod/mini";',
        "",
        'export const ping = action("ping", {',
        "  input: z.object({}),",
        "  output: z.object({}),",
        "  policy: always(),",
        '  effect: "read",',
        '  "shortcut": "p",',
        "  handler: () => ({}),",
        "});",
        "",
      ].join("\n"),
      "app/pages/status/page.ts": [
        'import { page } from "@sidioralabs/rex";',
        'import { ping } from "../../actions/ping.ts";',
        "",
        'export default page("status", {',
        '  route: "/status",',
        '  "render": "static" as const,',
        "  actions: [ping],",
        "});",
        "",
      ].join("\n"),
    });
    const result = await runRules(discoverApp(root), [renderRule]);
    expect(result.findings.map((entry) => [entry.file, entry.line, entry.column])).toEqual([
      ["app/pages/status/page.ts", 7, 13],
    ]);
    expect(result.findings[0]?.message).toContain('shortcut "p"');
  });
});

function actionSource(name: string, effect: string): string {
  return [
    'import { action, always } from "@sidioralabs/rex";',
    'import { z } from "zod/mini";',
    "",
    `export const ${name} = action("${name}", {`,
    "  input: z.object({}),",
    "  output: z.object({}),",
    "  policy: always(),",
    `  effect: "${effect}",`,
    "  handler: () => ({}),",
    "});",
    "",
  ].join("\n");
}

const STATUS_PAGE = [
  'import { page } from "@sidioralabs/rex";',
  'import { lookup } from "../../actions/lookup.ts";',
  'import { tweak } from "../../actions/tweak.ts";',
  'import { wipe } from "../../actions/wipe.ts";',
  "",
  'export default page("status", {',
  '  route: "/status",',
  "  actions: [lookup, tweak, wipe],",
  "});",
  "",
].join("\n");

function packageJson(scripts: Readonly<Record<string, string>>): string {
  return `${JSON.stringify({ name: "static-app", private: true, scripts }, null, 2)}\n`;
}

function staticApp(extra: Readonly<Record<string, string>>): string {
  return tempApp({
    "app/actions/lookup.ts": actionSource("lookup", "read"),
    "app/actions/tweak.ts": actionSource("tweak", "reversible"),
    "app/actions/wipe.ts": actionSource("wipe", "irreversible"),
    "app/pages/status/page.ts": STATUS_PAGE,
    ...extra,
  });
}

const STATIC_SCRIPTS = { build: "rex build", "build:static": "rex build --target static" };

describe("render/static-post", () => {
  it("recognises a script that runs rex build with the static target", () => {
    expect(STATIC_BUILD_SCRIPT.test("rex build --target static")).toBe(true);
    expect(STATIC_BUILD_SCRIPT.test("rex build --no-check --target=static && node sitemap.mjs")).toBe(
      true,
    );
    expect(STATIC_BUILD_SCRIPT.test("rex build")).toBe(false);
    expect(STATIC_BUILD_SCRIPT.test("rex build --target node")).toBe(false);
    expect(STATIC_BUILD_SCRIPT.test("rex build && echo --target static")).toBe(false);
  });

  it("reports every mutating action on a page of an app built static with no server and no client.apiOrigin", async () => {
    const root = staticApp({ "package.json": packageJson(STATIC_SCRIPTS) });
    const result = await runRules(discoverApp(root), [renderRule]);
    expect(
      result.findings.map((entry) => [entry.rule, entry.file, entry.line, entry.column]),
    ).toEqual([
      [STATIC_POST_CODE, "app/pages/status/page.ts", 8, 21],
      [STATIC_POST_CODE, "app/pages/status/page.ts", 8, 28],
    ]);
    expect(STATIC_POST_CODE).toBe("render/static-post");
    expect(result.findings.map((entry) => entry.message)).toEqual([
      'page "status" declares mutating action "tweak" (effect "reversible"), but the app builds for a static host (script "build:static" runs rex build --target static) and rex.config.ts sets no client.apiOrigin, so the action posts to a host that answers no POST (declared in app/actions/tweak.ts)',
      'page "status" declares mutating action "wipe" (effect "irreversible"), but the app builds for a static host (script "build:static" runs rex build --target static) and rex.config.ts sets no client.apiOrigin, so the action posts to a host that answers no POST (declared in app/actions/wipe.ts)',
    ]);
    for (const entry of result.findings) {
      expect(entry.severity).toBe("error");
      expect(entry.hint).toContain("client: { apiOrigin:");
    }
    expect(result.exitCode).toBe(1);
    expect(result.errors).toBe(2);
  });

  it("accepts the same page once rex.config.ts sets client.apiOrigin", async () => {
    const root = staticApp({
      "package.json": packageJson(STATIC_SCRIPTS),
      "rex.config.ts": [
        'import { defineConfig } from "@sidioralabs/rex/config";',
        'import app from "rex:app";',
        "",
        "export default defineConfig({",
        "  app,",
        '  client: { apiOrigin: "https://api.example.com" },',
        "});",
        "",
      ].join("\n"),
    });
    const deployment = readStaticDeployment(root, createSourceLoader());
    expect(deployment).toEqual({ script: "build:static", server: false, apiOrigin: true });
    expect(buildsStaticWithoutApi(deployment)).toBe(false);
    const result = await runRules(discoverApp(root), [renderRule]);
    expect(result.findings).toEqual([]);
  });

  it("leaves an app that declares its own server alone, since its static build is not its deployment", async () => {
    const root = staticApp({
      "package.json": packageJson(STATIC_SCRIPTS),
      "rex.config.ts": [
        'import { defineConfig } from "@sidioralabs/rex/config";',
        'import app from "rex:app";',
        'import { createAppServer } from "./server.ts";',
        "",
        "const config = defineConfig({",
        "  app,",
        "  server: (bundle) => createAppServer(bundle),",
        "});",
        "",
        "export default config;",
        "",
      ].join("\n"),
    });
    expect(readStaticDeployment(root, createSourceLoader())).toEqual({
      script: "build:static",
      server: true,
      apiOrigin: false,
    });
    const result = await runRules(discoverApp(root), [renderRule]);
    expect(result.findings).toEqual([]);
  });

  it("reports nothing for an app that never builds the static target", async () => {
    const root = staticApp({ "package.json": packageJson({ build: "rex build" }) });
    expect(readStaticDeployment(root, createSourceLoader())).toEqual({
      script: null,
      server: false,
      apiOrigin: false,
    });
    const result = await runRules(discoverApp(root), [renderRule]);
    expect(result.findings).toEqual([]);
  });

  it("still reports a client block without apiOrigin", async () => {
    const root = staticApp({
      "package.json": packageJson({ deploy: "rex build --target=static" }),
      "rex.config.ts": [
        'import { defineConfig } from "@sidioralabs/rex/config";',
        'import app from "rex:app";',
        "",
        "export default defineConfig({ app, client: {} });",
        "",
      ].join("\n"),
    });
    const result = await runRules(discoverApp(root), [renderRule]);
    expect(result.findings.map((entry) => [entry.rule, entry.line, entry.column])).toEqual([
      [STATIC_POST_CODE, 8, 21],
      [STATIC_POST_CODE, 8, 28],
    ]);
    expect(result.findings[0]?.message).toContain('(script "deploy" runs rex build --target static)');
  });
});
