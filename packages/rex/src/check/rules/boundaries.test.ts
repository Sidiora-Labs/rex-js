import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FILE_ROLES, discoverApp, runRules } from "../engine.ts";
import {
  IMPORT_TABLE,
  REX_CLIENT_CAPABILITIES,
  REX_CLIENT_I18N,
  REX_CLIENT_INTEROP,
  REX_CLIENT_MEDIA,
  REX_SCHEMA,
  boundariesRule,
} from "./boundaries.ts";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/boundaries");

describe("boundaries rule", () => {
  it("covers every file role in the import table", () => {
    expect(Object.keys(IMPORT_TABLE).sort()).toEqual([...FILE_ROLES].sort());
    for (const role of FILE_ROLES) {
      expect(IMPORT_TABLE[role].allowed.length).toBeGreaterThan(0);
    }
  });

  it("reports zero findings on the pass fixture", async () => {
    const app = discoverApp(path.join(fixtures, "pass"));
    expect(app.files.length).toBeGreaterThanOrEqual(13);
    const result = await runRules(app, [boundariesRule]);
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("reports one named finding per violation on the fail fixture", async () => {
    const result = await runRules(discoverApp(path.join(fixtures, "fail")), [boundariesRule]);
    const summary = result.findings.map((entry) => [entry.file, entry.line, entry.rule]);
    expect(summary).toEqual([
      ["app/actions/send.ts", 1, "boundaries/import-table"],
      ["app/actions/wallet/receive.ts", 1, "boundaries/import-table"],
      ["app/components/Api.tsx", 1, "boundaries/no-fetch"],
      ["app/pages/portfolio/regions/holdings/region.tsx", 2, "boundaries/import-table"],
      ["app/pages/send/hooks/useTokens.ts", 2, "boundaries/import-table"],
      ["app/pages/send/overlays/TokenSheet.tsx", 1, "boundaries/no-fetch"],
      ["app/pages/send/page.ts", 2, "boundaries/import-table"],
      ["app/pages/send/regions/form/parts/AmountField.tsx", 1, "boundaries/import-table"],
      ["app/pages/send/regions/form/parts/AmountField.tsx", 2, "boundaries/import-table"],
      ["app/pages/send/regions/form/parts/AmountField.tsx", 3, "boundaries/import-table"],
      ["app/pages/send/regions/form/parts/AmountField.tsx", 4, "boundaries/no-fetch"],
      ["app/pages/send/regions/form/region.tsx", 3, "boundaries/import-table"],
      ["app/pages/send/regions/form/region.tsx", 4, "boundaries/cross-page"],
      ["app/pages/send/regions/form/region.tsx", 5, "boundaries/import-table"],
      ["app/pages/send/regions/form/region.tsx", 6, "boundaries/unresolved"],
      ["app/pages/send/regions/form/region.tsx", 11, "boundaries/no-fetch"],
      ["app/pages/send/states.tsx", 2, "boundaries/import-table"],
      ["app/pages/send/view.tsx", 1, "boundaries/import-table"],
      ["app/pages/send/view.tsx", 2, "boundaries/import-table"],
      ["app/pages/send/view.tsx", 3, "boundaries/import-table"],
      ["app/server/ledger.ts", 1, "boundaries/import-table"],
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.findings.every((entry) => entry.severity === "error")).toBe(true);
  });

  it("names the offending import and the allowed alternatives", async () => {
    const result = await runRules(discoverApp(path.join(fixtures, "fail")), [boundariesRule]);
    const at = (file: string, line: number) => {
      const found = result.findings.find(
        (entry) => entry.file === `app/${file}` && entry.line === line,
      );
      if (!found) throw new Error(`no finding at ${file}:${line}`);
      return found;
    };

    const actionReact = at("actions/send.ts", 1);
    expect(actionReact.message).toContain('"react"');
    expect(actionReact.hint).toBe(IMPORT_TABLE.action.allowed);

    const pageReact = at("pages/send/page.ts", 2);
    expect(pageReact.message).toBe(
      'page.ts imports the package "react", which the import table does not allow',
    );
    expect(pageReact.hint).toContain("app/entities, app/actions, app/policies");

    expect(at("pages/send/view.tsx", 1).message).toBe(
      'view.tsx imports the hook "useState" from "react"',
    );
    expect(at("pages/send/view.tsx", 2).message).toBe(
      'view.tsx imports "./hooks/useTokens.ts" (a hook of page send)',
    );
    expect(at("pages/send/view.tsx", 3).message).toBe(
      'view.tsx imports "./regions/form/parts/AmountField.tsx" (a part of region form of page send)',
    );
    expect(at("pages/send/view.tsx", 3).hint).toBe(IMPORT_TABLE.view.allowed);

    expect(at("pages/send/regions/form/region.tsx", 3).message).toBe(
      'region.tsx imports "../../../../data/tokens.ts" (data module app/data/tokens.ts)',
    );
    expect(at("pages/send/regions/form/region.tsx", 4).message).toBe(
      'region.tsx of page send imports "../../../portfolio/regions/holdings/parts/HoldingRow.tsx" from page portfolio',
    );
    expect(at("pages/send/regions/form/region.tsx", 4).hint).toContain("rex promote");
    expect(at("pages/send/regions/form/region.tsx", 5).message).toBe(
      'region.tsx imports "../confirm/region.tsx" (region confirm of page send)',
    );
    expect(at("pages/send/regions/form/region.tsx", 6).message).toContain('"./missing.ts"');
    const fetchCall = at("pages/send/regions/form/region.tsx", 11);
    expect(fetchCall.column).toBe(8);
    expect(fetchCall.message).toBe("region.tsx calls fetch(); components never fetch directly");
    expect(fetchCall.hint).toContain("hooks/");

    expect(at("pages/send/regions/form/parts/AmountField.tsx", 1).message).toBe(
      'part AmountField.tsx imports the hook "useAct" from "@sidioralabs/rex/client"',
    );
    expect(at("pages/send/regions/form/parts/AmountField.tsx", 2).message).toBe(
      'part AmountField.tsx imports the package "wouter", which the import table does not allow',
    );
    expect(at("pages/send/regions/form/parts/AmountField.tsx", 3).message).toBe(
      'part AmountField.tsx imports "../../../../../actions/send.ts" (action module app/actions/send.ts)',
    );
    expect(at("pages/send/regions/form/parts/AmountField.tsx", 4).message).toBe(
      'part AmountField.tsx imports "memoryStore" from "@sidioralabs/rex"; components never fetch or touch stores directly',
    );
    expect(at("pages/send/hooks/useTokens.ts", 2).message).toBe(
      'hook useTokens.ts imports "../../../components/Button.tsx" (component module app/components/Button.tsx)',
    );
    expect(at("pages/send/overlays/TokenSheet.tsx", 1).message).toContain(
      '"@tanstack/react-query"',
    );
    expect(at("components/Api.tsx", 1).message).toContain('"@orpc/client"');
    expect(at("pages/send/states.tsx", 2).hint).toBe(IMPORT_TABLE.states.allowed);

    for (const entry of result.findings) {
      expect(entry.hint.length).toBeGreaterThan(10);
      expect(entry.column).toBeGreaterThanOrEqual(1);
    }
  });

  it("lets actions at any depth import app/server and reports it from a client-side role", async () => {
    const pass = discoverApp(path.join(fixtures, "pass"));
    expect(pass.fileAt("app/actions/wallet/receive.ts")?.role).toBe("action");
    expect(pass.fileAt("app/server/ledger.ts")?.role).toBe("server");
    expect(pass.unclassified).toEqual([]);

    const result = await runRules(discoverApp(path.join(fixtures, "fail")), [boundariesRule]);
    const messages = (file: string) =>
      result.findings
        .filter((entry) => entry.file === `app/${file}`)
        .map((entry) => [entry.line, entry.message, entry.hint]);
    expect(messages("pages/portfolio/regions/holdings/region.tsx")).toEqual([
      [
        2,
        'region.tsx imports "../../../../server/ledger.ts" (server module app/server/ledger.ts)',
        IMPORT_TABLE.region.allowed,
      ],
    ]);
    expect(messages("actions/wallet/receive.ts")).toEqual([
      [
        1,
        'action wallet/receive.ts imports "react"; declarations never import React or the client runtime',
        IMPORT_TABLE.action.allowed,
      ],
    ]);
    expect(messages("server/ledger.ts")).toEqual([
      [
        1,
        'server module server/ledger.ts imports "react"; server modules never import React or the client runtime',
        IMPORT_TABLE.server.allowed,
      ],
    ]);
    expect(IMPORT_TABLE.action.targets).toContainEqual({ role: "server" });
    for (const role of FILE_ROLES) {
      const targets = IMPORT_TABLE[role].targets;
      if (targets === "any" || role === "action" || role === "server") continue;
      expect(
        targets.map((target) => target.role),
        role,
      ).not.toContain("server");
    }
  });

  it("admits @sidioralabs/rex/schema for declarations and a page's own page.ts and app/flows for its hooks and regions", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "rex-boundaries-schema-"));
    try {
      cpSync(path.join(fixtures, "pass"), root, { recursive: true });
      const pageFile = path.join(root, "app/pages/send/page.ts");
      writeFileSync(
        pageFile,
        readFileSync(pageFile, "utf8")
          .replace(
            'import { page } from "@sidioralabs/rex";',
            `import { page } from "@sidioralabs/rex";\nimport { id } from "${REX_SCHEMA}";\nimport { z } from "zod/mini";`,
          )
          .replace(
            'route: "/send",',
            'route: "/send/:account",\n  params: z.object({ account: id() }),',
          ),
      );
      const hookFile = path.join(root, "app/pages/send/hooks/useTokens.ts");
      writeFileSync(
        hookFile,
        `import { money } from "${REX_SCHEMA}";\n${readFileSync(hookFile, "utf8")}\nexport const amount = money();\n`,
      );
      mkdirSync(path.join(root, "app/flows"), { recursive: true });
      writeFileSync(
        path.join(root, "app/flows/approve.ts"),
        'import { always, flow, memoryJournal } from "@sidioralabs/rex";\n\nexport const approve = flow("approve", {\n  steps: [{ approval: "review", label: "Review", approvers: always() }],\n  journal: memoryJournal(),\n});\n',
      );
      writeFileSync(
        path.join(root, "app/pages/send/hooks/useSendLoader.ts"),
        'import { approve } from "../../../flows/approve.ts";\nimport sendPage from "../page.ts";\n\nexport function useSendLoader(): string {\n  return `${sendPage.id}:${approve.id}`;\n}\n',
      );
      const regionFile = path.join(root, "app/pages/send/regions/form/region.tsx");
      writeFileSync(
        regionFile,
        `${readFileSync(regionFile, "utf8")}\nimport { approve as gate } from "../../../../flows/approve.ts";\nimport ownPage from "../../page.ts";\n\nexport const declared = [gate.id, ownPage.id];\n`,
      );
      const viewFile = path.join(root, "app/pages/send/view.tsx");
      writeFileSync(
        viewFile,
        `import { text } from "${REX_SCHEMA}";\n${readFileSync(viewFile, "utf8")}`,
      );
      const result = await runRules(discoverApp(root), [boundariesRule]);
      expect(result.findings.map((entry) => [entry.file, entry.line, entry.message])).toEqual([
        [
          "app/pages/send/view.tsx",
          1,
          `view.tsx imports the package "${REX_SCHEMA}", which the import table does not allow`,
        ],
      ]);
      expect(IMPORT_TABLE.page.allowed).toContain(REX_SCHEMA);
      expect(IMPORT_TABLE.hook.allowed).toContain(REX_SCHEMA);
      for (const role of ["hook", "region"] as const) {
        expect(IMPORT_TABLE[role].targets).toEqual(
          expect.arrayContaining([{ role: "page", samePage: true }, { role: "flow" }]),
        );
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("admits the optional client entries where @sidioralabs/rex/client is admitted, with the same hook rule", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "rex-boundaries-capabilities-"));
    try {
      cpSync(path.join(fixtures, "pass"), root, { recursive: true });
      const regionFile = path.join(root, "app/pages/send/regions/form/region.tsx");
      writeFileSync(
        regionFile,
        `import { useT } from "${REX_CLIENT_I18N}";\nimport { Img } from "${REX_CLIENT_MEDIA}";\nimport { Native } from "${REX_CLIENT_INTEROP}";\n${readFileSync(regionFile, "utf8")}\nexport const capabilities = [useT, Img, Native];\n`,
      );
      const partFile = path.join(root, "app/pages/send/regions/form/parts/TokenChip.tsx");
      writeFileSync(
        partFile,
        `import { Img } from "${REX_CLIENT_MEDIA}";\nimport { t, useLocale } from "${REX_CLIENT_I18N}";\n${readFileSync(partFile, "utf8")}\nexport const media = [Img, t, useLocale];\n`,
      );
      const hookFile = path.join(root, "app/pages/send/hooks/useTokens.ts");
      writeFileSync(
        hookFile,
        `import { useLocale as useActiveLocale } from "${REX_CLIENT_I18N}";\n${readFileSync(hookFile, "utf8")}\nexport const localeHook = useActiveLocale;\n`,
      );
      const pageFile = path.join(root, "app/pages/send/page.ts");
      writeFileSync(
        pageFile,
        `import { t as message } from "${REX_CLIENT_I18N}";\n${readFileSync(pageFile, "utf8")}\nexport const title = message("send.title");\n`,
      );
      const result = await runRules(discoverApp(root), [boundariesRule]);
      expect(result.findings.map((entry) => [entry.file, entry.line, entry.message])).toEqual([
        [
          "app/pages/send/page.ts",
          1,
          `page.ts imports the package "${REX_CLIENT_I18N}", which the import table does not allow`,
        ],
        [
          "app/pages/send/regions/form/parts/TokenChip.tsx",
          2,
          `part TokenChip.tsx imports the hook "useLocale" from "${REX_CLIENT_I18N}"`,
        ],
      ]);
      expect(REX_CLIENT_CAPABILITIES).toEqual([
        "@sidioralabs/rex/client/interop",
        "@sidioralabs/rex/client/media",
        "@sidioralabs/rex/client/i18n",
      ]);
      for (const role of ["region", "part", "hook", "overlay", "states"] as const) {
        for (const specifier of REX_CLIENT_CAPABILITIES) {
          expect(IMPORT_TABLE[role].allowed).toContain(specifier);
        }
      }
      expect(IMPORT_TABLE.view.allowed).not.toContain(REX_CLIENT_MEDIA);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
