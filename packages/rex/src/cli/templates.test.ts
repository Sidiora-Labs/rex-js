import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { REX_DATA_STATES, STATE_EXPORT_NAMES, type RexDataState } from "../core/states.ts";
import { baseAppPlan } from "./commands/new.ts";
import {
  CLIENT_IMPORT,
  CONFIG_IMPORT,
  CORE_IMPORT,
  FIELDS_IMPORT,
  I18N_IMPORT,
  INTEROP_IMPORT,
  MEDIA_IMPORT,
  SCHEMA_IMPORT,
  SERVER_IMPORT,
  TEMPLATE_KINDS,
  actionTemplate,
  appPaths,
  camelCase,
  configTemplate,
  entityTemplate,
  flowTemplate,
  hookTemplate,
  overlayTemplate,
  pageTemplate,
  partTemplate,
  pascalCase,
  policyTemplate,
  regionComponentName,
  regionTemplate,
  sentenceFromComponent,
  statesTemplate,
  validateHookName,
  viewTemplate,
} from "./templates.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");

function diagnostics(code: string, fileName: string): string[] {
  const output = ts.transpileModule(code, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
  });
  return (output.diagnostics ?? []).map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  );
}

function valid(code: string, fileName: string): string {
  expect(diagnostics(code, fileName)).toEqual([]);
  expect(code.endsWith("\n")).toBe(true);
  return code;
}

describe("template import specifiers and kinds", () => {
  it("name the entry points of the rex package and the make kinds", () => {
    expect(CORE_IMPORT).toBe("@sidioralabs/rex");
    expect(CONFIG_IMPORT).toBe(`${CORE_IMPORT}/config`);
    expect(CLIENT_IMPORT).toBe(`${CORE_IMPORT}/client`);
    expect(INTEROP_IMPORT).toBe(`${CLIENT_IMPORT}/interop`);
    expect(MEDIA_IMPORT).toBe(`${CLIENT_IMPORT}/media`);
    expect(I18N_IMPORT).toBe(`${CLIENT_IMPORT}/i18n`);
    expect(SERVER_IMPORT).toBe(`${CORE_IMPORT}/server`);
    expect(FIELDS_IMPORT).toBe(`${CORE_IMPORT}/schema`);
    expect(SCHEMA_IMPORT).toBe("zod/mini");
    expect(TEMPLATE_KINDS).toEqual([
      "page",
      "view",
      "states",
      "region",
      "part",
      "overlay",
      "hook",
      "action",
      "entity",
      "policy",
      "flow",
    ]);
  });

  it("point at subpaths the package exports", () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      readonly name: string;
      readonly exports: Readonly<Record<string, unknown>>;
    };
    expect(manifest.name).toBe(CORE_IMPORT);
    for (const specifier of [
      CONFIG_IMPORT,
      CLIENT_IMPORT,
      INTEROP_IMPORT,
      MEDIA_IMPORT,
      I18N_IMPORT,
      SERVER_IMPORT,
      FIELDS_IMPORT,
    ]) {
      expect(Object.keys(manifest.exports), specifier).toContain(
        `.${specifier.slice(CORE_IMPORT.length)}`,
      );
    }
  });
});

describe("name helpers", () => {
  it("validateHookName accepts camelCase names starting with use", () => {
    expect(validateHookName("useFilter")).toBe("useFilter");
    expect(validateHookName("useA1")).toBe("useA1");
    for (const name of [
      "filter",
      "use",
      "usefilter",
      "UseFilter",
      "use-filter",
      "useFilter.ts",
      "",
    ]) {
      expect(() => validateHookName(name), name).toThrow(
        /must be camelCase starting with use, such as useFilter/,
      );
    }
  });

  it("camelCase and pascalCase join dot and dash segments and skip empty ones", () => {
    expect(camelCase("toggle-hide-dust")).toBe("toggleHideDust");
    expect(camelCase("send.review")).toBe("sendReview");
    expect(camelCase("a..b--c")).toBe("aBC");
    expect(camelCase("single")).toBe("single");
    expect(pascalCase("toggle-hide-dust")).toBe("ToggleHideDust");
    expect(pascalCase("single")).toBe("Single");
    expect(pascalCase("-leading")).toBe("Leading");
  });

  it("sentenceFromComponent spaces PascalCase into a sentence and regions get a component name", () => {
    expect(sentenceFromComponent("TokenSelectorSheet")).toBe("Token selector sheet");
    expect(sentenceFromComponent("Button")).toBe("Button");
    expect(sentenceFromComponent("Html5Player")).toBe("Html5 player");
    expect(regionComponentName("holdings-list")).toBe("HoldingsListRegion");
    expect(() => regionComponentName("Holdings")).toThrow(/region name/);
  });

  it("appPaths derive every folder from validated ids", () => {
    expect(appPaths.pageDir("send")).toBe("app/pages/send");
    expect(appPaths.hooksDir("send")).toBe("app/pages/send/hooks");
    expect(appPaths.testDir("send")).toBe("app/pages/send/test");
    expect(appPaths.regionDir("send", "form")).toBe("app/pages/send/regions/form");
    expect(appPaths.partsDir("send", "form")).toBe("app/pages/send/regions/form/parts");
    expect(() => appPaths.regionDir("send", "Form")).toThrow(/region name/);
    expect(() => appPaths.overlay("send", "sheet")).toThrow(/overlay name/);
    expect(() => appPaths.entity("1token")).toThrow(/digit/);
    expect(() => appPaths.flow("")).toThrow(/flow id/);
  });
});

describe("pageTemplate", () => {
  it("defaults the route to the id and declares nothing else", () => {
    expect(valid(pageTemplate({ id: "home" }), "page.ts")).toBe(
      [
        `import { page } from "${CORE_IMPORT}";`,
        "",
        'export default page("home", {',
        '  route: "/home",',
        "});",
        "",
      ].join("\n"),
    );
  });

  it("declares params for route parameters and imports the actions it names", () => {
    const code = valid(
      pageTemplate({
        id: "note",
        route: "/notes/:noteId/:tab",
        actions: ["pick-token", "archive"],
      }),
      "page.ts",
    );
    expect(code).toContain(`import { id } from "${FIELDS_IMPORT}";`);
    expect(code).toContain(`import { z } from "${SCHEMA_IMPORT}";`);
    expect(code).toContain('import { pickToken } from "../../actions/pick-token.ts";');
    expect(code).toContain('import { archive } from "../../actions/archive.ts";');
    expect(code).toContain("  params: z.object({ noteId: id(), tab: id() }),");
    expect(code).toContain("  actions: [pickToken, archive],");
    expect(pageTemplate({ id: "home" })).not.toContain("params:");
  });

  it("orders declared states as the framework does and writes overlays with their defaults", () => {
    const code = valid(
      pageTemplate({
        id: "send",
        overlays: ["TokenSheet"],
        states: ["ready", "terminal-error", "loading"],
      }),
      "page.ts",
    );
    expect(code).toContain('  states: ["loading", "terminal-error", "ready"],');
    expect(code).toContain(
      '  overlays: [\n    { id: "TokenSheet", dismiss: "both", binding: "region" },\n  ],',
    );
    expect(pageTemplate({ id: "send" })).not.toContain("states:");
  });

  it("refuses repeated or invalid regions, overlays, actions and states", () => {
    expect(() => pageTemplate({ id: "send", overlays: ["Sheet", "Sheet"] })).toThrow(
      'overlays repeats "Sheet"',
    );
    expect(() => pageTemplate({ id: "send", actions: ["a", "a"] })).toThrow('actions repeats "a"');
    expect(() => pageTemplate({ id: "send", actions: ["Pick"] })).toThrow(/action id/);
    expect(() => pageTemplate({ id: "send", states: ["ready", "ready"] })).toThrow(
      'states repeats "ready"',
    );
    expect(() => pageTemplate({ id: "send", states: ["ready", "busy" as RexDataState] })).toThrow(
      `"busy" is not one of ${REX_DATA_STATES.join(", ")}`,
    );
    expect(() => pageTemplate({ id: "send", states: ["loading"] })).toThrow(
      'states must include "ready"',
    );
  });
});

describe("viewTemplate, regionTemplate, partTemplate, overlayTemplate and hookTemplate", () => {
  it("lays out an empty stack without regions and sorts region imports", () => {
    expect(valid(viewTemplate({ page: "send" }), "view.tsx")).toBe(
      [
        `import { Page, view } from "${CLIENT_IMPORT}";`,
        "",
        "export default view(() => <Page.Stack space={4} />);",
        "",
      ].join("\n"),
    );
    const code = valid(viewTemplate({ page: "send", regions: ["form", "confirm"] }), "view.tsx");
    expect(code.indexOf("./regions/confirm/region.tsx")).toBeLessThan(
      code.indexOf("./regions/form/region.tsx"),
    );
    expect(code).toContain("    <FormRegion />\n    <ConfirmRegion />");
    expect(() => viewTemplate({ page: "send", regions: ["form", "form"] })).toThrow(
      'regions repeats "form"',
    );
    expect(() => viewTemplate({ page: "Send" })).toThrow(/page id/);
  });

  it("writes the region, part, overlay and hook bodies in their canonical shapes", () => {
    expect(valid(regionTemplate({ page: "send", name: "token-list" }), "region.tsx")).toBe(
      [
        `import { region } from "${CLIENT_IMPORT}";`,
        "",
        'export default region("token-list", () => <p>Token list</p>);',
        "",
      ].join("\n"),
    );
    expect(valid(partTemplate({ name: "AmountField" }), "AmountField.tsx")).toBe(
      [
        "export default function AmountField(props: { readonly label: string }) {",
        "  return <span>{props.label}</span>;",
        "}",
        "",
      ].join("\n"),
    );
    expect(
      valid(
        overlayTemplate({ page: "send", name: "TokenSelectorSheet" }),
        "TokenSelectorSheet.tsx",
      ),
    ).toBe(
      [
        `import { overlay } from "${CLIENT_IMPORT}";`,
        "",
        'export default overlay("TokenSelectorSheet", { dismiss: "both", binding: "region" }, () => (',
        "  <p>Token selector sheet</p>",
        "));",
        "",
      ].join("\n"),
    );
    expect(valid(hookTemplate({ name: "useDraft" }), "useDraft.ts")).toBe(
      [
        'import { useState } from "react";',
        "",
        "export function useDraft() {",
        '  const [value, setValue] = useState("");',
        "  return { value, setValue };",
        "}",
        "",
      ].join("\n"),
    );
    expect(() => overlayTemplate({ page: "Send", name: "Sheet" })).toThrow(/page id/);
  });
});

describe("statesTemplate", () => {
  it("writes one component per non-ready state with the page title in its copy", () => {
    const code = valid(statesTemplate({ page: "my-wallet" }), "states.tsx");
    for (const state of REX_DATA_STATES) {
      if (state === "ready") continue;
      expect(code).toContain(`export function ${STATE_EXPORT_NAMES[state]}(`);
    }
    expect(code).not.toContain("export function Ready");
    expect(code).toContain('<p role="status">Loading my wallet</p>');
    expect(code).toContain("<p>Nothing in my wallet yet</p>");
    expect(code).toContain("<p>My wallet may be out of date</p>");
    expect(code).toContain("<p>Part of my wallet could not be loaded</p>");
    expect(code).toContain(
      "<p>You are offline; my wallet will refresh when the connection returns</p>",
    );
    expect(code).toContain('<p role="alert">You do not have access to my wallet</p>');
    expect(code).toContain("<p>My wallet failed to load</p>");
    expect(code).toContain("<p>My wallet is unavailable</p>");
    expect(code.split("\n\n")).toHaveLength(9);
  });

  it("keeps the StateProps import only for states that use it and follows the framework order", () => {
    const stale = valid(statesTemplate({ page: "send", states: ["stale", "ready"] }), "states.tsx");
    expect(stale.startsWith(`import type { StateProps } from "${CORE_IMPORT}";\n\n`)).toBe(true);
    expect(stale).toContain("export function Stale({ retry }: StateProps)");
    const denied = valid(
      statesTemplate({ page: "send", states: ["permission-denied", "ready", "empty"] }),
      "states.tsx",
    );
    expect(denied).not.toContain("StateProps");
    expect(denied.indexOf("export function Empty")).toBeLessThan(
      denied.indexOf("export function PermissionDenied"),
    );
    expect(() => statesTemplate({ page: "send", states: ["ready", "empty", "empty"] })).toThrow(
      'states repeats "empty"',
    );
  });
});

describe("declaration templates", () => {
  it("export the camelCase name of a dashed or dotted id with the matching label", () => {
    const action = valid(actionTemplate({ name: "pick-token" }), "pick-token.ts");
    expect(action).toContain('export const pickToken = action("pick-token", {');
    expect(action).toContain('  label: "Pick token",');
    expect(action).toContain('  effect: "reversible",');
    const entity = valid(entityTemplate({ name: "note-tag" }), "note-tag.ts");
    expect(entity).toContain('export const noteTag = entity("note-tag", {');
    expect(entity).toContain("  fields: { id: id(), name: text({ min: 1 }) },");
    const policy = valid(policyTemplate({ name: "wallet.admin" }), "wallet.admin.ts");
    expect(policy).toContain('export const walletAdmin = policy("wallet.admin", {');
    expect(policy).toContain('  permissions: ["wallet.admin.read"],');
    const flow = valid(flowTemplate({ name: "pay-out" }), "pay-out.ts");
    expect(flow).toContain('export const payOut = flow("pay-out", {');
    expect(flow).toContain(
      '  steps: [{ approval: "review", label: "Review", approvers: always() }],',
    );
  });

  it("writes the rex.config.ts that rex new plans, wiring the app bundle into createRexServer", () => {
    const code = valid(configTemplate(), "rex.config.ts");
    expect(code).toBe(
      [
        `import { anonymousActor } from "${CORE_IMPORT}";`,
        `import { defineConfig } from "${CONFIG_IMPORT}";`,
        `import { createRexServer, memoryLedger } from "${SERVER_IMPORT}";`,
        'import app from "rex:app";',
        "",
        "export default defineConfig({",
        "  app,",
        "  server: (bundle) =>",
        "    createRexServer({",
        "      registry: bundle.registry,",
        "      ledger: memoryLedger(),",
        "      actor: () => anonymousActor,",
        "      app: bundle.name,",
        "    }),",
        "});",
        "",
      ].join("\n"),
    );
    expect(baseAppPlan("notes-app").find((entry) => entry.path === "rex.config.ts")).toEqual({
      kind: "file",
      path: "rex.config.ts",
      content: code,
    });
  });
});
