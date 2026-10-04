import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import * as configEntry from "../../config.ts";
import * as coreEntry from "../../index.ts";
import * as manifestEntry from "../../manifest/index.ts";
import * as schemaEntry from "../../schema/index.ts";
import {
  CLIENT_IMPORT,
  CONFIG_IMPORT,
  CORE_IMPORT,
  FIELDS_IMPORT,
  I18N_IMPORT,
  INTEROP_IMPORT,
  MEDIA_IMPORT,
  SCHEMA_IMPORT,
} from "../templates.ts";
import { CODEMOD_ID } from "./codemod.ts";
import {
  CLIENT_ENTRY_TARGETS,
  ENTRY_TARGETS,
  I18N_NAMES,
  INTEROP_NAMES,
  MANIFEST_IMPORT,
  MEDIA_NAMES,
  codemod,
  moveClientImports,
  moveEntryImports,
} from "./0.1-schema-entry.ts";

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "rex-schema-entry-"));
  temporary.push(root);
  return root;
}

function write(root: string, file: string, text: string): void {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
}

function target(targets: typeof ENTRY_TARGETS, name: string): string | null {
  for (const [specifier, names] of targets) if (names.has(name)) return specifier;
  return null;
}

const LEGACY_CORE = `import { page, z } from ${JSON.stringify(CORE_IMPORT)};\n`;
const MOVED_CORE = `import { page } from ${JSON.stringify(CORE_IMPORT)};\nimport { z } from ${JSON.stringify(SCHEMA_IMPORT)};\n`;
const LEGACY_CLIENT = `import { Img, region } from ${JSON.stringify(CLIENT_IMPORT)};\n`;
const MOVED_CLIENT = `import { region } from ${JSON.stringify(CLIENT_IMPORT)};\nimport { Img } from ${JSON.stringify(MEDIA_IMPORT)};\n`;

describe("0.1-schema-entry codemod", () => {
  it("declares its id, version and the entries it moves names between", () => {
    expect(codemod.id).toBe("0.1-schema-entry");
    expect(codemod.from).toBe("0.1");
    expect(CODEMOD_ID.test(codemod.id)).toBe(true);
    expect(Object.isFrozen(codemod)).toBe(true);
    for (const specifier of [
      SCHEMA_IMPORT,
      CORE_IMPORT,
      FIELDS_IMPORT,
      CONFIG_IMPORT,
      MANIFEST_IMPORT,
      CLIENT_IMPORT,
      INTEROP_IMPORT,
      MEDIA_IMPORT,
      I18N_IMPORT,
    ]) {
      expect(codemod.description, specifier).toContain(specifier);
    }
    expect(MANIFEST_IMPORT).toBe("@sidioralabs/rex/manifest");
  });

  it("maps z to the schema entry and the moved names to their own entries, never a core name", () => {
    expect(ENTRY_TARGETS.map(([specifier]) => specifier)).toEqual([
      SCHEMA_IMPORT,
      FIELDS_IMPORT,
      CONFIG_IMPORT,
      MANIFEST_IMPORT,
    ]);
    expect([...(ENTRY_TARGETS[0] as (typeof ENTRY_TARGETS)[number])[1]]).toEqual(["z"]);
    expect(target(ENTRY_TARGETS, "id")).toBe(FIELDS_IMPORT);
    expect(target(ENTRY_TARGETS, "text")).toBe(FIELDS_IMPORT);
    expect(target(ENTRY_TARGETS, "RexField")).toBe(FIELDS_IMPORT);
    expect(target(ENTRY_TARGETS, "defineConfig")).toBe(CONFIG_IMPORT);
    expect(target(ENTRY_TARGETS, "RexConfig")).toBe(CONFIG_IMPORT);
    expect(target(ENTRY_TARGETS, "buildManifest")).toBe(MANIFEST_IMPORT);
    expect(target(ENTRY_TARGETS, "SidecarPayload")).toBe(MANIFEST_IMPORT);
    for (const name of ["page", "action", "entity", "policy", "flow", "anonymousActor"]) {
      expect(Object.keys(coreEntry), name).toContain(name);
      expect(target(ENTRY_TARGETS, name), name).toBeNull();
    }
    const entries: readonly (readonly [string, object])[] = [
      [FIELDS_IMPORT, schemaEntry],
      [CONFIG_IMPORT, configEntry],
      [MANIFEST_IMPORT, manifestEntry],
    ];
    for (const [specifier, entry] of entries) {
      const names = ENTRY_TARGETS.find(([candidate]) => candidate === specifier)?.[1];
      expect(names, specifier).toBeDefined();
      for (const name of Object.keys(entry)) {
        expect(names?.has(name), `${specifier} ${name}`).toBe(!(name in coreEntry));
      }
    }
  });

  it("maps the interop, media and i18n names to disjoint client entries", () => {
    expect(CLIENT_ENTRY_TARGETS.map(([specifier]) => specifier)).toEqual([
      INTEROP_IMPORT,
      MEDIA_IMPORT,
      I18N_IMPORT,
    ]);
    const names = CLIENT_ENTRY_TARGETS.flatMap(([, set]) => [...set]);
    expect(new Set(names).size).toBe(names.length);
    for (const name of INTEROP_NAMES)
      expect(target(CLIENT_ENTRY_TARGETS, name)).toBe(INTEROP_IMPORT);
    for (const name of MEDIA_NAMES) expect(target(CLIENT_ENTRY_TARGETS, name)).toBe(MEDIA_IMPORT);
    for (const name of I18N_NAMES) expect(target(CLIENT_ENTRY_TARGETS, name)).toBe(I18N_IMPORT);
    expect(target(CLIENT_ENTRY_TARGETS, "ImgProps")).toBe(MEDIA_IMPORT);
    expect(target(CLIENT_ENTRY_TARGETS, "NativeProps")).toBe(INTEROP_IMPORT);
    expect(target(CLIENT_ENTRY_TARGETS, "Translate")).toBe(I18N_IMPORT);
    expect(target(CLIENT_ENTRY_TARGETS, "region")).toBeNull();
    expect(target(CLIENT_ENTRY_TARGETS, "useAct")).toBeNull();
  });
});

describe("moveEntryImports", () => {
  it("moves a whole statement when every name leaves the core entry", () => {
    expect(moveEntryImports("ping.ts", `import { z } from ${JSON.stringify(CORE_IMPORT)};\n`)).toBe(
      `import { z } from ${JSON.stringify(SCHEMA_IMPORT)};\n`,
    );
    expect(moveEntryImports("ping.ts", LEGACY_CORE)).toBe(MOVED_CORE);
    expect(moveEntryImports("ping.ts", MOVED_CORE)).toBeNull();
  });

  it("keeps aliases and edits only the statements that import from the core entry", () => {
    const text = [
      `import { z as zod, page } from ${JSON.stringify(CORE_IMPORT)};`,
      'import { useState } from "react";',
      `import { region } from ${JSON.stringify(CLIENT_IMPORT)};`,
      "",
      "export const count = () => useState(0);",
      "",
    ].join("\n");
    expect(moveEntryImports("tool.ts", text)).toBe(
      [
        `import { page } from ${JSON.stringify(CORE_IMPORT)};`,
        `import { z as zod } from ${JSON.stringify(SCHEMA_IMPORT)};`,
        'import { useState } from "react";',
        `import { region } from ${JSON.stringify(CLIENT_IMPORT)};`,
        "",
        "export const count = () => useState(0);",
        "",
      ].join("\n"),
    );
  });

  it("leaves default, namespace and foreign imports alone", () => {
    expect(
      moveEntryImports("tool.ts", `import rex, { z } from ${JSON.stringify(CORE_IMPORT)};\n`),
    ).toBeNull();
    expect(
      moveEntryImports("tool.ts", `import * as rex from ${JSON.stringify(CORE_IMPORT)};\n`),
    ).toBeNull();
    expect(moveEntryImports("tool.ts", 'import { z } from "zod";\n')).toBeNull();
    expect(moveEntryImports("tool.ts", "export const z = 1;\n")).toBeNull();
  });
});

describe("moveClientImports", () => {
  it("moves media, interop and i18n names out of the client entry once", () => {
    expect(moveClientImports("region.tsx", LEGACY_CLIENT)).toBe(MOVED_CLIENT);
    expect(moveClientImports("region.tsx", MOVED_CLIENT)).toBeNull();
    expect(
      moveClientImports(
        "region.tsx",
        `import { defineElement, useT, type ImgProps } from ${JSON.stringify(CLIENT_IMPORT)};\n`,
      ),
    ).toBe(
      [
        `import { defineElement } from ${JSON.stringify(INTEROP_IMPORT)};`,
        `import { type ImgProps } from ${JSON.stringify(MEDIA_IMPORT)};`,
        `import { useT } from ${JSON.stringify(I18N_IMPORT)};`,
        "",
      ].join("\n"),
    );
    expect(
      moveClientImports(
        "region.tsx",
        `import client, { Img } from ${JSON.stringify(CLIENT_IMPORT)};\n`,
      ),
    ).toBeNull();
    expect(moveClientImports("region.tsx", LEGACY_CORE)).toBeNull();
  });
});

describe("codemod.run", () => {
  it("rewrites every source file under the root in one pass and reports them sorted", () => {
    const root = tempRoot();
    const chained = `${LEGACY_CORE}${LEGACY_CLIENT}`;
    write(root, "app/pages/home/regions/welcome/region.tsx", chained);
    write(root, "app/actions/ping.ts", LEGACY_CORE);
    write(root, "lib/helper.mts", LEGACY_CORE);
    write(root, "app/pages/home/page.ts", `import { page } from ${JSON.stringify(CORE_IMPORT)};\n`);
    write(root, "node_modules/pkg/index.ts", LEGACY_CORE);
    write(root, "dist/out.ts", LEGACY_CORE);
    write(root, ".rex/cache.ts", LEGACY_CORE);
    write(root, ".git/hook.ts", LEGACY_CORE);
    write(root, "app/types.d.ts", LEGACY_CORE);
    write(root, "notes.md", LEGACY_CORE);
    const result = codemod.run(root);
    expect(result.flags).toEqual([]);
    expect(result.changes).toEqual([
      { file: "app/actions/ping.ts", text: MOVED_CORE },
      { file: "app/pages/home/regions/welcome/region.tsx", text: `${MOVED_CORE}${MOVED_CLIENT}` },
      { file: "lib/helper.mts", text: MOVED_CORE },
    ]);
    for (const file of ["node_modules/pkg/index.ts", "dist/out.ts", "app/types.d.ts"]) {
      expect(readFileSync(join(root, file), "utf8"), file).toBe(LEGACY_CORE);
    }
  });

  it("reports nothing for a migrated tree or a missing root", () => {
    const root = tempRoot();
    write(root, "app/actions/ping.ts", MOVED_CORE);
    expect(codemod.run(root)).toEqual({ changes: [], flags: [] });
    expect(codemod.run(join(root, "absent"))).toEqual({ changes: [], flags: [] });
  });
});
