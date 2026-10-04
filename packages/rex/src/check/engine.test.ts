import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  FILE_ROLES,
  classify,
  discoverApp,
  exitCodeFor,
  runRules,
  type FileRole,
} from "./engine.ts";
import { formatFindings, formatHuman, formatJson } from "./report.ts";
import {
  createSourceLoader,
  defineRule,
  finding,
  packageName,
  type Finding,
  type Rule,
} from "./rule.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const passRoot = path.join(here, "fixtures/engine/pass");
const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function writeApp(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "rex-engine-"));
  temporary.push(root);
  for (const [file, content] of Object.entries(files)) {
    const full = path.join(root, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

const viewHasDefault: Rule = defineRule({
  id: "view-default",
  description: "view.tsx has a default export",
  check({ app, sources }) {
    return app.byRole("view").flatMap((file) =>
      sources.exports(file.path).some((entry) => entry.name === "default")
        ? []
        : [
            finding({
              rule: "view-default/missing",
              file: file.file,
              message: "view.tsx has no default export",
              hint: "Export the page layout as the default export.",
            }),
          ],
    );
  },
});

const unclassifiedWarning: Rule = defineRule({
  id: "unclassified",
  description: "files outside the convention",
  check({ app }) {
    return app.unclassified.map((file) =>
      finding({
        rule: "unclassified",
        severity: "warning",
        file,
        message: "file does not match any Rex file role",
        hint: "Move the file to its conventional folder.",
      }),
    );
  },
});

describe("discoverApp", () => {
  it("maps the engine pass fixture into page, view and states roles", () => {
    const app = discoverApp(passRoot);
    expect(app.root).toBe(path.resolve(passRoot));
    expect(app.appDir).toBe(path.join(path.resolve(passRoot), "app"));
    expect(app.files.map((file) => [file.file, file.role, file.page])).toEqual([
      ["app/pages/home/page.ts", "page", "home"],
      ["app/pages/home/states.tsx", "states", "home"],
      ["app/pages/home/view.tsx", "view", "home"],
    ]);
    expect(app.unclassified).toEqual([]);
    expect(app.pages).toHaveLength(1);
    const home = app.pageOf("home");
    expect(home?.page?.file).toBe("app/pages/home/page.ts");
    expect(home?.view?.name).toBe("view");
    expect(home?.states?.role).toBe("states");
    expect(home?.regions).toEqual([]);
    expect(app.byRole("page").map((file) => file.name)).toEqual(["page"]);
    expect(app.fileAt("app/pages/home/view.tsx")?.role).toBe("view");
    expect(app.relative(path.join(passRoot, "app/pages/home/page.ts"))).toBe(
      "app/pages/home/page.ts",
    );
  });

  it("classifies every file role by its conventional path", () => {
    const table: [string, FileRole][] = [
      ["pages/send/page.ts", "page"],
      ["pages/send/view.tsx", "view"],
      ["pages/send/states.tsx", "states"],
      ["pages/send/regions/form/region.tsx", "region"],
      ["pages/send/regions/form/parts/AmountField.tsx", "part"],
      ["pages/send/hooks/useSendDraft.ts", "hook"],
      ["pages/send/overlays/TokenSelectorSheet.tsx", "overlay"],
      ["pages/send/test/send.test.tsx", "test"],
      ["actions/send.ts", "action"],
      ["entities/token.ts", "entity"],
      ["policies/wallet.ts", "policy"],
      ["flows/payout.ts", "flow"],
      ["components/Button.tsx", "component"],
      ["components/forms/Field.tsx", "component"],
      ["data/tokens.ts", "data"],
    ];
    for (const [file, role] of table) expect(classify(file)?.role, file).toBe(role);
    expect(new Set(table.map(([, role]) => role))).toEqual(new Set(FILE_ROLES));
    expect(classify("pages/send/regions/form/parts/AmountField.tsx")).toEqual({
      role: "part",
      page: "send",
      region: "form",
    });
    for (const file of [
      "pages/send/page.tsx",
      "pages/send/view.ts",
      "pages/send/index.ts",
      "pages/send/regions/form/Form.tsx",
      "pages/send/regions/form/parts/nested/Deep.tsx",
      "pages/send/overlays/nested/Sheet.tsx",
      "pages/index.ts",
      "actions/nested/send.ts",
      "actions/send.tsx",
      "main.tsx",
    ]) {
      expect(classify(file), file).toBeNull();
    }
  });

  it("discovers pages, regions, parts, hooks, overlays and unclassified files", () => {
    const root = writeApp({
      "app/pages/send/page.ts": 'export default page("send", { route: "/send" });\n',
      "app/pages/send/view.tsx": "export default function View() { return null; }\n",
      "app/pages/send/states.tsx": "export {};\n",
      "app/pages/send/regions/form/region.tsx": "export default function Form() { return null; }\n",
      "app/pages/send/regions/form/parts/AmountField.tsx":
        "export default function A() { return null; }\n",
      "app/pages/send/regions/empty/.gitkeep": "",
      "app/pages/send/hooks/useDraft.ts": "export function useDraft() {}\n",
      "app/pages/send/overlays/TokenSheet.tsx": "export default function T() { return null; }\n",
      "app/pages/send/test/send.test.tsx": "export {};\n",
      "app/pages/send/helpers.ts": "export const x = 1;\n",
      "app/pages/portfolio/page.ts": 'export default page("portfolio", { route: "/" });\n',
      "app/actions/send.ts": "export {};\n",
      "app/entities/token.ts": "export {};\n",
      "app/policies/wallet.ts": "export {};\n",
      "app/flows/payout.ts": "export {};\n",
      "app/components/Button.tsx": "export default function Button() { return null; }\n",
      "app/data/tokens.ts": "export {};\n",
      "app/data/types.d.ts": "export {};\n",
      "app/node_modules/pkg/index.ts": "export {};\n",
      "app/styles.css": "body {}\n",
    });
    const app = discoverApp(root);
    expect(app.pages.map((entry) => entry.id)).toEqual(["portfolio", "send"]);
    const send = app.pageOf("send");
    expect(send?.regions.map((region) => [region.name, region.file?.file ?? null])).toEqual([
      ["empty", null],
      ["form", "app/pages/send/regions/form/region.tsx"],
    ]);
    expect(send?.regions[1]?.parts.map((part) => part.name)).toEqual(["AmountField"]);
    expect(send?.hooks.map((hook) => hook.name)).toEqual(["useDraft"]);
    expect(send?.overlays.map((overlay) => overlay.name)).toEqual(["TokenSheet"]);
    expect(send?.tests.map((test) => test.file)).toEqual(["app/pages/send/test/send.test.tsx"]);
    expect(app.pageOf("portfolio")?.view).toBeNull();
    expect(app.unclassified).toEqual(["app/pages/send/helpers.ts"]);
    const roles = new Set(app.files.map((file) => file.role));
    expect(roles).toEqual(new Set(FILE_ROLES));
    const sorted = [...app.files.map((file) => file.file)].sort();
    expect(app.files.map((file) => file.file)).toEqual(sorted);
    expect(app.files.some((file) => file.file.includes("node_modules"))).toBe(false);
    expect(app.files.some((file) => file.file.endsWith(".d.ts"))).toBe(false);
  });

  it("refuses a root without an app directory", () => {
    const root = writeApp({ "README.md": "no app\n" });
    expect(() => discoverApp(root)).toThrow(/no app directory/);
  });
});

describe("source loader", () => {
  it("reads imports, exports and the page declaration of the pass fixture", () => {
    const sources = createSourceLoader();
    const pageFile = path.join(passRoot, "app/pages/home/page.ts");
    expect(sources.imports(pageFile)).toEqual([
      {
        specifier: "@sidioralabs/rex",
        kind: "import",
        typeOnly: false,
        names: ["page"],
        locals: ["page"],
        line: 1,
        column: 1,
      },
    ]);
    expect(sources.exports(pageFile).map((entry) => entry.name)).toEqual(["default"]);
    const declared = sources.pageDeclaration(pageFile);
    expect(declared).toMatchObject({
      id: "home",
      route: "/",
      regions: [],
      overlays: [],
      actions: [],
      states: null,
      unreadable: [],
      line: 3,
    });
    const statesFile = path.join(passRoot, "app/pages/home/states.tsx");
    expect(sources.imports(statesFile)[0]?.typeOnly).toBe(true);
    expect(sources.exports(statesFile).map((entry) => entry.name)).toEqual([
      "Loading",
      "Empty",
      "Stale",
      "Partial",
      "Offline",
      "PermissionDenied",
      "RecoverableError",
      "TerminalError",
    ]);
    expect(sources.load(statesFile)).toBe(sources.load(statesFile));
  });

  it("parses every import form, export form and static declaration", () => {
    const root = writeApp({
      "app/actions/send.ts": [
        'import { action, always } from "@sidioralabs/rex";',
        'import { z } from "zod/mini";',
        'export const send = action("send", {',
        '  input: z.object({}), output: z.object({}), policy: always(), effect: "irreversible",',
        "  handler: () => ({}),",
        "});",
        "",
      ].join("\n"),
      "app/pages/send/page.ts": [
        'import { page } from "@sidioralabs/rex";',
        'import { send as sendAction } from "../../actions/send.ts";',
        'export const sendPage = page("send", {',
        '  route: "/send/:account",',
        '  regions: ["form", "confirm"],',
        '  overlays: [{ id: "TokenSheet", dismiss: "both", binding: "url" }, { id: "ContactSheet", binding: "region" }],',
        "  actions: [sendAction],",
        '  states: ["loading", "ready"],',
        "});",
        "",
      ].join("\n"),
      "app/pages/send/regions/form/region.tsx": [
        'import Button, { type ButtonProps } from "../../../../components/Button.tsx";',
        'import * as tokens from "../../../../data/tokens";',
        'import type { Token } from "../../../../entities/token.ts";',
        'import "./styles.css";',
        'export { helper } from "./helper.ts";',
        'export type { Shape } from "./shape.ts";',
        'export * from "./all.ts";',
        "export interface Props { a: string }",
        "export type Alias = string;",
        "export function useThing() {}",
        "export class Thing {}",
        "export const [first, second] = [1, 2];",
        "const local = 1;",
        "export { local as renamed };",
        "export default function Form() {",
        '  void import("./lazy.ts");',
        "  return null;",
        "}",
        "",
      ].join("\n"),
      "app/components/Button.tsx": "export default function Button() { return null; }\n",
      "app/data/tokens.ts": "export const tokens = [];\n",
    });
    const sources = createSourceLoader();
    const region = path.join(root, "app/pages/send/regions/form/region.tsx");
    const imports = sources.imports(region);
    expect(
      imports.map((ref) => [ref.specifier, ref.kind, ref.typeOnly, ref.names, ref.line]),
    ).toEqual([
      ["../../../../components/Button.tsx", "import", false, ["default", "ButtonProps"], 1],
      ["../../../../data/tokens", "import", false, ["*"], 2],
      ["../../../../entities/token.ts", "import", true, ["Token"], 3],
      ["./styles.css", "import", false, [], 4],
      ["./helper.ts", "export", false, ["helper"], 5],
      ["./shape.ts", "export", true, ["Shape"], 6],
      ["./all.ts", "export", false, ["*"], 7],
      ["./lazy.ts", "dynamic", false, ["*"], 16],
    ]);
    expect(sources.resolve(region, "../../../../components/Button.tsx")).toBe(
      path.join(root, "app/components/Button.tsx"),
    );
    expect(sources.resolve(region, "../../../../data/tokens")).toBe(
      path.join(root, "app/data/tokens.ts"),
    );
    expect(sources.resolve(region, "./missing.ts")).toBeNull();
    expect(sources.resolve(region, "react")).toBeNull();
    expect(
      sources.exports(region).map((entry) => [entry.name, entry.typeOnly, entry.from]),
    ).toEqual([
      ["helper", false, "./helper.ts"],
      ["Shape", true, "./shape.ts"],
      ["*", false, "./all.ts"],
      ["Props", true, null],
      ["Alias", true, null],
      ["useThing", false, null],
      ["Thing", false, null],
      ["first", false, null],
      ["second", false, null],
      ["renamed", false, null],
      ["default", false, null],
    ]);

    const actionFile = path.join(root, "app/actions/send.ts");
    expect(
      sources.declarations(actionFile).map((entry) => [entry.kind, entry.id, entry.exportName]),
    ).toEqual([["action", "send", "send"]]);

    const pageFile = path.join(root, "app/pages/send/page.ts");
    const declared = sources.pageDeclaration(pageFile);
    expect(declared?.id).toBe("send");
    expect(declared?.route).toBe("/send/:account");
    expect(declared?.regions.map((entry) => [entry.name, entry.line])).toEqual([
      ["form", 5],
      ["confirm", 5],
    ]);
    expect(declared?.overlays.map((entry) => [entry.id, entry.dismiss, entry.binding])).toEqual([
      ["TokenSheet", "both", "url"],
      ["ContactSheet", null, "region"],
    ]);
    expect(declared?.actions).toEqual([
      {
        local: "sendAction",
        specifier: "../../actions/send.ts",
        imported: "send",
        source: actionFile,
        line: 7,
        column: 13,
      },
    ]);
    expect(declared?.states?.map((entry) => entry.name)).toEqual(["loading", "ready"]);
    expect(declared?.unreadable).toEqual([]);
    expect(sources.pageDeclaration(actionFile)).toBeNull();
  });

  it("reports page fields it cannot read statically", () => {
    const root = writeApp({
      "app/pages/home/page.ts": [
        'import { page } from "@sidioralabs/rex";',
        'const regions = ["main"];',
        'export default page("home", { route: "/", regions, states: [...["ready"]] });',
        "",
      ].join("\n"),
    });
    const declared = createSourceLoader().pageDeclaration(
      path.join(root, "app/pages/home/page.ts"),
    );
    expect(declared?.unreadable).toEqual(["regions", "states"]);
    expect(declared?.regions).toEqual([]);
  });

  it("derives package names from bare specifiers", () => {
    expect(packageName("react")).toBe("react");
    expect(packageName("react/jsx-runtime")).toBe("react");
    expect(packageName("@sidioralabs/rex/client")).toBe("@sidioralabs/rex");
    expect(packageName("./local.ts")).toBeNull();
    expect(packageName("../up")).toBeNull();
  });
});

describe("findings and rules", () => {
  it("validates findings and rules", () => {
    const entry = finding({
      rule: "boundaries/cross-page",
      file: "app/pages/a/view.tsx",
      line: 3,
      column: 8,
      message: "imports another page",
      hint: "Promote the part to app/components.",
    });
    expect(entry).toEqual({
      rule: "boundaries/cross-page",
      severity: "error",
      file: "app/pages/a/view.tsx",
      line: 3,
      column: 8,
      message: "imports another page",
      hint: "Promote the part to app/components.",
    });
    expect(Object.isFrozen(entry)).toBe(true);
    const base = { rule: "x", file: "a.ts", message: "m", hint: "h" };
    expect(() => finding({ ...base, rule: "Bad Rule" })).toThrow(/kebab-case/);
    expect(() => finding({ ...base, line: 0 })).toThrow(/positive integers/);
    expect(() => finding({ ...base, message: " " })).toThrow(/message/);
    expect(() => finding({ ...base, hint: "" })).toThrow(/hint/);
    expect(() => defineRule({ id: "Nope", description: "d", check: () => [] })).toThrow(
      /kebab-case/,
    );
  });

  it("returns exit code 0 with no findings on the pass fixture", async () => {
    const result = await runRules(discoverApp(passRoot), [viewHasDefault, unclassifiedWarning]);
    expect(result.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
    expect(result.errors).toBe(0);
  });

  it("returns exit code 1 on any error and 0 on warnings only", async () => {
    const failing = writeApp({
      "app/pages/home/page.ts": 'export default page("home", { route: "/" });\n',
      "app/pages/home/view.tsx": "export function View() { return null; }\n",
      "app/pages/home/notes.ts": "export {};\n",
    });
    const app = discoverApp(failing);
    const result = await runRules(app, [unclassifiedWarning, viewHasDefault]);
    expect(result.findings.map((entry) => [entry.file, entry.rule, entry.severity])).toEqual([
      ["app/pages/home/notes.ts", "unclassified", "warning"],
      ["app/pages/home/view.tsx", "view-default/missing", "error"],
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.warnings).toBe(1);

    const warningsOnly = await runRules(app, [unclassifiedWarning]);
    expect(warningsOnly.findings).toHaveLength(1);
    expect(warningsOnly.exitCode).toBe(0);
    expect(exitCodeFor([])).toBe(0);
  });

  it("refuses duplicate rules, misattributed findings and failing rules", async () => {
    const app = discoverApp(passRoot);
    await expect(runRules(app, [viewHasDefault, viewHasDefault])).rejects.toThrow(/listed twice/);
    const misattributed = defineRule({
      id: "liar",
      description: "reports under another id",
      check: () => [finding({ rule: "other", file: "a.ts", message: "m", hint: "h" })],
    });
    await expect(runRules(app, [misattributed])).rejects.toThrow(/attributed to "other"/);
    const crashing = defineRule({
      id: "crash",
      description: "throws",
      check: async () => {
        throw new Error("boom");
      },
    });
    await expect(runRules(app, [crashing])).rejects.toThrow(/rule "crash" failed: boom/);
  });
});

describe("report formats", () => {
  const findings: Finding[] = [
    finding({
      rule: "traps/hover",
      severity: "warning",
      file: "app/pages/b/view.tsx",
      line: 12,
      column: 4,
      message: "onMouseEnter without onFocus",
      hint: "Add an onFocus handler.",
    }),
    finding({
      rule: "boundaries/cross-page",
      file: "app/pages/a/view.tsx",
      line: 3,
      column: 1,
      message: "imports app/pages/b",
      hint: "Move the shared part to app/components.",
    }),
    finding({
      rule: "states/missing",
      file: "app/pages/a/states.tsx",
      message: "missing export Loading",
      hint: "Export Loading from states.tsx.",
    }),
    finding({
      rule: "boundaries/import-table",
      file: "app/pages/a/view.tsx",
      line: 10,
      column: 2,
      message: "view.tsx imports a hook",
      hint: "Call hooks from region.tsx.",
    }),
  ];

  it("emits a sorted JSON array with the declared finding keys", () => {
    const parsed = JSON.parse(formatJson(findings)) as Finding[];
    expect(parsed).toHaveLength(4);
    expect(parsed.map((entry) => `${entry.file}:${entry.line}`)).toEqual([
      "app/pages/a/states.tsx:1",
      "app/pages/a/view.tsx:3",
      "app/pages/a/view.tsx:10",
      "app/pages/b/view.tsx:12",
    ]);
    for (const entry of parsed) {
      expect(Object.keys(entry)).toEqual([
        "rule",
        "severity",
        "file",
        "line",
        "column",
        "message",
        "hint",
      ]);
    }
    expect(formatJson([])).toBe("[]\n");
    expect(formatFindings(findings, "json")).toBe(formatJson(findings));
  });

  it("prints the same findings grouped by file in the human format", () => {
    const text = formatHuman(findings);
    expect(text).toBe(
      [
        "app/pages/a/states.tsx",
        "  1:1  error    states/missing  missing export Loading",
        "       hint: Export Loading from states.tsx.",
        "",
        "app/pages/a/view.tsx",
        "  3:1   error    boundaries/cross-page  imports app/pages/b",
        "        hint: Move the shared part to app/components.",
        "  10:2  error    boundaries/import-table  view.tsx imports a hook",
        "        hint: Call hooks from region.tsx.",
        "",
        "app/pages/b/view.tsx",
        "  12:4  warning  traps/hover  onMouseEnter without onFocus",
        "        hint: Add an onFocus handler.",
        "",
        "4 problems (3 errors, 1 warning) in 3 files",
        "",
      ].join("\n"),
    );
    expect(formatHuman([])).toBe("No findings.\n");
    expect(formatFindings(findings, "human")).toBe(text);
  });
});
