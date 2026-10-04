import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { runCheck } from "../check/rules/index.ts";
import { runRuntimeCheck } from "../check/runtime.ts";
import { LEGACY_CONFIG_MESSAGE } from "../core/config.ts";
import { deprecationMessage, resetDeprecations } from "../core/deprecated.ts";
import { errorDocs } from "../core/errors.ts";
import { addPageRender, renderTimeBrowserReads } from "./codemods/0.1-page-render.ts";
import { convertRawImg } from "./codemods/0.1-raw-img.ts";
import { wrapConfig } from "./codemods/0.1-config.ts";
import { codemod as schemaEntryCodemod, moveEntryImports } from "./codemods/0.1-schema-entry.ts";
import { parseSource } from "./codemods/codemod.ts";
import { loadCodemods } from "./commands/migrate.ts";
import { loadRexConfig } from "./config.ts";
import { EXIT_OK, EXIT_USAGE, run, type RexCliIO } from "./index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const fixture = join(here, "fixtures", "app-01");
const MIGRATE_TEST_TIMEOUT_MS = 240_000;

const DEPENDENCIES = [
  "@sidioralabs/rex",
  "@tanstack/react-query",
  "@types/node",
  "@types/react",
  "@types/react-dom",
  "@vitejs/plugin-react",
  "cmdk",
  "react",
  "react-dom",
  "typescript",
  "vite",
  "wouter",
  "zod",
];

const CODEMOD_IDS = ["0.1-config", "0.1-page-render", "0.1-raw-img", "0.1-schema-entry"];

const MIGRATED_CONFIG = [
  'import { anonymousActor } from "@sidioralabs/rex";',
  'import { createRexServer, memoryLedger } from "@sidioralabs/rex/server";',
  'import app from "rex:app";',
  'import { defineConfig } from "@sidioralabs/rex/config";',
  "",
  "export default defineConfig({",
  "  app,",
  "  server: (app) =>",
  "    createRexServer({",
  "      registry: app.registry,",
  "      ledger: memoryLedger(),",
  "      actor: () => anonymousActor,",
  "      app: app.name,",
  "    }),",
  "});",
  "",
].join("\n");

const MIGRATED_SETTINGS_PAGE = [
  'import { page } from "@sidioralabs/rex";',
  "",
  'export default page("settings", {',
  '  route: "/settings",',
  '  render: "csr",',
  '  regions: ["theme"],',
  '  states: ["loading", "ready"],',
  "});",
  "",
].join("\n");

const MIGRATED_COVER_REGION = [
  'import { region, Img } from "@sidioralabs/rex/client";',
  'import Thumb from "./parts/Thumb.tsx";',
  "",
  'export default region("cover", () => (',
  "  <section>",
  '    <Img src="/images/cover.png" alt="Gallery cover" width={1 /* REX610 placeholder */} height={1 /* REX610 placeholder */} />',
  '    <Thumb src="/images/first.png" label="First photo" />',
  '    <Img src="/images/divider.png" alt={"" /* REX610 placeholder */} width={1 /* REX610 placeholder */} height={1 /* REX610 placeholder */} />',
  "  </section>",
  "));",
  "",
].join("\n");

const MIGRATED_THUMB = [
  'import { Img } from "@sidioralabs/rex/client";',
  "",
  "export default function Thumb(props: { readonly src: string; readonly label: string }) {",
  "  return (",
  "    <figure>",
  "      <Img src={props.src} alt={props.label} width={96} height={96} />",
  "      <figcaption>{props.label}</figcaption>",
  "    </figure>",
  "  );",
  "}",
  "",
].join("\n");

const MIGRATED_PING = [
  'import { action, always } from "@sidioralabs/rex";',
  'import { z } from "zod/mini";',
  "",
  'export const ping = action("ping", {',
  "  input: z.object({}),",
  "  output: z.object({ ok: z.boolean() }),",
  "  policy: always(),",
  '  effect: "reversible",',
  '  label: "Ping",',
  "  handler: () => ({ ok: true }),",
  "});",
  "",
].join("\n");

const MIGRATED_NOTE = [
  'import { entity } from "@sidioralabs/rex";',
  'import { id, text } from "@sidioralabs/rex/schema";',
  "",
  'export const note = entity("note", {',
  "  fields: { id: id(), name: text({ min: 1 }) },",
  "  label: (record) => record.name,",
  "});",
  "",
].join("\n");

const PING = "app/actions/ping.ts";
const NOTE = "app/entities/note.ts";
const COVER = "app/pages/gallery/regions/cover/region.tsx";
const THUMB = "app/pages/gallery/regions/cover/parts/Thumb.tsx";
const SETTINGS_PAGE = "app/pages/settings/page.ts";

const FLAG_LINES = [
  `REX610 ${COVER}:6:5 Img width, height are placeholders; set the real values (${errorDocs("REX610")})`,
  `REX610 ${COVER}:8:5 Img alt, width, height are placeholders; set the real values (${errorDocs("REX610")})`,
];

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  resetDeprecations();
});

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "rex-migrate-"));
  temporary.push(root);
  cpSync(fixture, root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify({ name: "app-01", private: true, type: "module" }, null, 2)}\n`,
  );
  for (const dependency of DEPENDENCIES) {
    const source =
      dependency === "@sidioralabs/rex"
        ? packageRoot
        : join(packageRoot, "node_modules", dependency);
    expect(existsSync(source), `${dependency} is resolvable from the rex package`).toBe(true);
    const destination = join(root, "node_modules", dependency);
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(realpathSync(source), destination, "dir");
  }
  return root;
}

function captureIO(cwd: string) {
  const out: string[] = [];
  const err: string[] = [];
  const io: RexCliIO = {
    cwd,
    out: (text) => {
      out.push(text);
    },
    err: (text) => {
      err.push(text);
    },
  };
  return { io, out: () => out.join(""), err: () => err.join("") };
}

async function migrate(root: string, ...args: string[]) {
  const captured = captureIO(root);
  const code = await run(["migrate", ...args], captured.io);
  return { code, out: captured.out(), err: captured.err() };
}

function snapshot(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files[relative(root, full).split("\\").join("/")] = readFileSync(full, "utf8");
    }
  };
  walk(root);
  return files;
}

function fixtureText(file: string): string {
  return readFileSync(join(fixture, file), "utf8");
}

describe("rex migrate codemods", () => {
  it("discovers the 0.1 codemods from cli/codemods in order", async () => {
    const codemods = await loadCodemods();
    expect(codemods.map((codemod) => codemod.id)).toEqual(CODEMOD_IDS);
    expect(codemods.every((codemod) => codemod.from === "0.1")).toBe(true);
  });

  it("wraps a bare server default export and leaves a defineConfig export alone", () => {
    const legacy = fixtureText("rex.config.ts");
    const wrapped = wrapConfig("rex.config.ts", legacy);
    expect(wrapped).toBe(MIGRATED_CONFIG);
    expect(wrapConfig("rex.config.ts", MIGRATED_CONFIG)).toBeNull();

    const withoutImports = wrapConfig(
      "rex.config.ts",
      'import { createServer } from "./server.ts";\n\nexport default createServer();\n',
    );
    expect(withoutImports).toBe(
      [
        'import { createServer } from "./server.ts";',
        'import app from "rex:app";',
        'import { defineConfig } from "@sidioralabs/rex/config";',
        "",
        "export default defineConfig({",
        "  app,",
        "  server: (app) =>",
        "    createServer(),",
        "});",
        "",
      ].join("\n"),
    );
  });

  it("moves z, the field helpers, config and manifest names out of the core import, once", () => {
    expect(moveEntryImports(PING, fixtureText(PING))).toBe(MIGRATED_PING);
    expect(moveEntryImports(NOTE, fixtureText(NOTE))).toBe(MIGRATED_NOTE);
    expect(moveEntryImports(PING, MIGRATED_PING)).toBeNull();
    expect(moveEntryImports(NOTE, MIGRATED_NOTE)).toBeNull();
    expect(
      moveEntryImports(
        "tool.ts",
        [
          'import { buildManifest, defineConfig, money, page, type RexConfig } from "@sidioralabs/rex";',
          'import type { SidecarPayload, StateProps } from "@sidioralabs/rex";',
          'import { anonymousActor } from "@sidioralabs/rex";',
          "",
        ].join("\n"),
      ),
    ).toBe(
      [
        'import { page } from "@sidioralabs/rex";',
        'import { money } from "@sidioralabs/rex/schema";',
        'import { defineConfig, type RexConfig } from "@sidioralabs/rex/config";',
        'import { buildManifest } from "@sidioralabs/rex/manifest";',
        'import type { StateProps } from "@sidioralabs/rex";',
        'import type { SidecarPayload } from "@sidioralabs/rex/manifest";',
        'import { anonymousActor } from "@sidioralabs/rex";',
        "",
      ].join("\n"),
    );
  });

  it("finds render-time browser reads but not effect, handler, guard or local reads", () => {
    const reads = (text: string) =>
      renderTimeBrowserReads(parseSource("hook.tsx", text)).map((node) => node.text);
    expect(reads("export const theme = () => window.localStorage.getItem('t');\n")).toEqual([
      "window",
    ]);
    expect(
      reads(
        [
          'import { useEffect } from "react";',
          "export function Probe({ location }: { location: string }) {",
          "  useEffect(() => { document.title = location; });",
          "  const ready = typeof window !== 'undefined';",
          '  return <button type="button" onClick={() => navigator.share()}>{String(ready)}</button>;',
          "}",
          "",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("adds render csr after the route, once", () => {
    const text = fixtureText(SETTINGS_PAGE);
    const migrated = addPageRender(SETTINGS_PAGE, text, "csr");
    expect(migrated).toBe(MIGRATED_SETTINGS_PAGE);
    expect(addPageRender(SETTINGS_PAGE, MIGRATED_SETTINGS_PAGE, "csr")).toBeNull();
  });

  it("converts img to Img with placeholders and leaves converted files alone", () => {
    expect(convertRawImg(COVER, fixtureText(COVER))).toBe(MIGRATED_COVER_REGION);
    expect(convertRawImg(THUMB, fixtureText(THUMB))).toBe(MIGRATED_THUMB);
    expect(convertRawImg(COVER, MIGRATED_COVER_REGION)).toBeNull();
  });
});

describe("rex migrate on a 0.1 app", { timeout: MIGRATE_TEST_TIMEOUT_MS }, () => {
  it("lists the codemods and refuses an unknown version", async () => {
    const root = copyFixture();
    const listed = await migrate(root, "--list");
    expect(listed.code).toBe(EXIT_OK);
    const ids = listed.out
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => line.split(" ")[0]);
    expect(ids).toEqual(CODEMOD_IDS);
    const unknown = await migrate(root, "--from", "0.0");
    expect(unknown.code).toBe(EXIT_USAGE);
    expect(unknown.err).toContain('no codemods migrate from "0.0"; known versions: 0.1');
    expect(snapshot(root)).toEqual(snapshot(copyFixture()));
  });

  it("migrates the fixture idempotently so it passes rex check and the runtime check", async () => {
    const root = copyFixture();
    const warnings: string[] = [];
    const warn = (message: string) => {
      warnings.push(message);
    };

    const before = await runCheck(root);
    expect(before.exitCode).toBe(1);
    expect(before.findings.map((entry) => `${entry.rule} ${entry.file}`)).toEqual(
      expect.arrayContaining([
        `media/no-raw-img ${COVER}`,
        `media/no-raw-img ${THUMB}`,
        `a11y/img-alt ${COVER}`,
      ]),
    );
    await expect(loadRexConfig(root, { warn })).rejects.toThrow();
    expect(warnings).toEqual([]);
    const staged = copyFixture();
    for (const change of schemaEntryCodemod.run(staged).changes) {
      writeFileSync(join(staged, change.file), change.text);
    }
    expect((await loadRexConfig(staged, { warn })).read.kind).toBe("legacy");
    expect((await loadRexConfig(staged, { warn })).read.kind).toBe("legacy");
    expect(warnings).toEqual([deprecationMessage("REX101", LEGACY_CONFIG_MESSAGE)]);
    expect(warnings[0]).toContain(errorDocs("REX101"));

    const first = await migrate(root);
    expect(first.err).toBe("");
    expect(first.code).toBe(EXIT_OK);
    expect(first.out).toBe(
      [
        "0.1-config: 1 changed",
        "  changed rex.config.ts",
        "0.1-page-render: 1 changed",
        `  changed ${SETTINGS_PAGE}`,
        "0.1-raw-img: 2 changed",
        `  changed ${THUMB}`,
        `  changed ${COVER}`,
        "0.1-schema-entry: 2 changed",
        `  changed ${PING}`,
        `  changed ${NOTE}`,
        ...FLAG_LINES,
        "migrated from 0.1: 6 files changed, 2 flagged for the author",
        "",
      ].join("\n"),
    );
    expect(readFileSync(join(root, "rex.config.ts"), "utf8")).toBe(MIGRATED_CONFIG);
    expect(readFileSync(join(root, SETTINGS_PAGE), "utf8")).toBe(MIGRATED_SETTINGS_PAGE);
    expect(readFileSync(join(root, COVER), "utf8")).toBe(MIGRATED_COVER_REGION);
    expect(readFileSync(join(root, THUMB), "utf8")).toBe(MIGRATED_THUMB);
    expect(readFileSync(join(root, PING), "utf8")).toBe(MIGRATED_PING);
    expect(readFileSync(join(root, NOTE), "utf8")).toBe(MIGRATED_NOTE);
    for (const unchanged of ["app/pages/home/page.ts", "app/pages/gallery/page.ts"]) {
      expect(readFileSync(join(root, unchanged), "utf8")).toBe(fixtureText(unchanged));
    }

    const migrated = snapshot(root);
    const second = await migrate(root);
    expect(second.code).toBe(EXIT_OK);
    expect(second.out).toBe(
      [
        "0.1-config: no changes",
        "0.1-page-render: no changes",
        "0.1-raw-img: no changes",
        "0.1-schema-entry: no changes",
        ...FLAG_LINES,
        "migrated from 0.1: 0 files changed, 2 flagged for the author",
        "",
      ].join("\n"),
    );
    expect(snapshot(root)).toEqual(migrated);

    const loaded = await loadRexConfig(root, { warn });
    expect(loaded.read.kind).toBe("config");
    expect(warnings).toHaveLength(1);

    const check = await runCheck(root);
    expect(check.findings).toEqual([]);
    expect(check.exitCode).toBe(0);

    const runtime = await runRuntimeCheck(root);
    expect(runtime.findings).toEqual([]);
    expect(runtime.exitCode).toBe(0);
    expect([...new Set(runtime.mounts.map((mount) => mount.page))].sort()).toEqual([
      "gallery",
      "home",
      "settings",
    ]);
  });
});
