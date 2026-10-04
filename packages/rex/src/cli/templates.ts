import { validateComponentName, validateName } from "../core/ids.ts";
import { parseRoute, titleFromId } from "../core/page.ts";
import {
  REX_DATA_STATES,
  isRexDataState,
  stateExportName,
  type RexDataState,
} from "../core/states.ts";

export const CORE_IMPORT = "@sidioralabs/rex";
export const SCHEMA_IMPORT = "zod/mini";
export const FIELDS_IMPORT = "@sidioralabs/rex/schema";
export const CONFIG_IMPORT = "@sidioralabs/rex/config";
export const CLIENT_IMPORT = "@sidioralabs/rex/client";
export const SERVER_IMPORT = "@sidioralabs/rex/server";

export const TEMPLATE_KINDS = [
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
] as const;

export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

const HOOK_PATTERN = /^use[A-Z][A-Za-z0-9]*$/;

export function validateHookName<N extends string>(name: N): N {
  if (typeof name !== "string" || !HOOK_PATTERN.test(name)) {
    throw new Error(
      `invalid hook name ${JSON.stringify(name)}: must be camelCase starting with use, such as useFilter`,
    );
  }
  return name;
}

function words(name: string): string[] {
  return name.split(/[.-]/).filter((word) => word.length > 0);
}

export function camelCase(name: string): string {
  return words(name)
    .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join("");
}

export function pascalCase(name: string): string {
  return words(name)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

export function sentenceFromComponent(name: string): string {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const appPaths = {
  pageDir: (page: string) => `app/pages/${validateName(page, "page id")}`,
  page: (page: string) => `${appPaths.pageDir(page)}/page.ts`,
  view: (page: string) => `${appPaths.pageDir(page)}/view.tsx`,
  states: (page: string) => `${appPaths.pageDir(page)}/states.tsx`,
  hooksDir: (page: string) => `${appPaths.pageDir(page)}/hooks`,
  hook: (page: string, hook: string) => `${appPaths.hooksDir(page)}/${validateHookName(hook)}.ts`,
  testDir: (page: string) => `${appPaths.pageDir(page)}/test`,
  regionDir: (page: string, region: string) =>
    `${appPaths.pageDir(page)}/regions/${validateName(region, "region name")}`,
  region: (page: string, region: string) => `${appPaths.regionDir(page, region)}/region.tsx`,
  partsDir: (page: string, region: string) => `${appPaths.regionDir(page, region)}/parts`,
  part: (page: string, region: string, part: string) =>
    `${appPaths.partsDir(page, region)}/${validateComponentName(part, "part name")}.tsx`,
  overlay: (page: string, overlay: string) =>
    `${appPaths.pageDir(page)}/overlays/${validateComponentName(overlay, "overlay name")}.tsx`,
  action: (name: string) => `app/actions/${validateName(name, "action id")}.ts`,
  entity: (name: string) => `app/entities/${validateName(name, "entity id")}.ts`,
  policy: (name: string) => `app/policies/${validateName(name, "policy id")}.ts`,
  flow: (name: string) => `app/flows/${validateName(name, "flow id")}.ts`,
} as const;

function unique<T extends string>(field: string, values: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${field} repeats ${JSON.stringify(value)}`);
    seen.add(value);
  }
  return values;
}

function lines(...parts: readonly (string | readonly string[])[]): string {
  return `${parts.flat().join("\n")}\n`;
}

export interface PageTemplateOptions {
  readonly id: string;
  readonly route?: string;
  readonly regions?: readonly string[];
  readonly overlays?: readonly string[];
  readonly actions?: readonly string[];
  readonly states?: readonly RexDataState[];
}

export function pageTemplate(options: PageTemplateOptions): string {
  const id = validateName(options.id, "page id");
  const route = options.route ?? `/${id}`;
  const routeParams = parseRoute(route).params;
  const regions = unique(
    "regions",
    (options.regions ?? []).map((region) => validateName(region, "region name")),
  );
  const overlays = unique(
    "overlays",
    (options.overlays ?? []).map((overlay) => validateComponentName(overlay, "overlay name")),
  );
  const actions = unique(
    "actions",
    (options.actions ?? []).map((name) => validateName(name, "action id")),
  );
  const states = options.states === undefined ? undefined : statesList(options.states);
  const imports = [
    `import { page } from "${CORE_IMPORT}";`,
    ...(routeParams.length > 0
      ? [`import { id } from "${FIELDS_IMPORT}";`, `import { z } from "${SCHEMA_IMPORT}";`]
      : []),
    ...actions.map((name) => `import { ${camelCase(name)} } from "../../actions/${name}.ts";`),
  ];
  const fields = [`  route: ${JSON.stringify(route)},`];
  if (routeParams.length > 0) {
    fields.push(
      `  params: z.object({ ${routeParams.map((param) => `${param}: id()`).join(", ")} }),`,
    );
  }
  if (actions.length > 0) fields.push(`  actions: [${actions.map(camelCase).join(", ")}],`);
  if (regions.length > 0) {
    fields.push(`  regions: [${regions.map((region) => JSON.stringify(region)).join(", ")}],`);
  }
  if (overlays.length > 0) {
    fields.push("  overlays: [");
    for (const overlay of overlays) {
      fields.push(`    { id: ${JSON.stringify(overlay)}, dismiss: "both", binding: "region" },`);
    }
    fields.push("  ],");
  }
  if (states !== undefined) {
    fields.push(`  states: [${states.map((state) => JSON.stringify(state)).join(", ")}],`);
  }
  return lines(imports, "", `export default page(${JSON.stringify(id)}, {`, fields, "});");
}

export interface ViewTemplateOptions {
  readonly page: string;
  readonly regions?: readonly string[];
}

export function regionComponentName(region: string): string {
  return `${pascalCase(validateName(region, "region name"))}Region`;
}

export function viewTemplate(options: ViewTemplateOptions): string {
  validateName(options.page, "page id");
  const regions = unique(
    "regions",
    (options.regions ?? []).map((region) => validateName(region, "region name")),
  );
  const imports = [
    `import { Page, view } from "${CLIENT_IMPORT}";`,
    ...[...regions]
      .sort()
      .map(
        (region) => `import ${regionComponentName(region)} from "./regions/${region}/region.tsx";`,
      ),
  ];
  const body =
    regions.length === 0
      ? ["export default view(() => <Page.Stack space={4} />);"]
      : [
          "export default view(() => (",
          "  <Page.Stack space={4}>",
          ...regions.map((region) => `    <${regionComponentName(region)} />`),
          "  </Page.Stack>",
          "));",
        ];
  return lines(imports, "", body);
}

function statesList(states: readonly RexDataState[]): readonly RexDataState[] {
  unique("states", states);
  for (const state of states) {
    if (!isRexDataState(state)) {
      throw new Error(`${JSON.stringify(state)} is not one of ${REX_DATA_STATES.join(", ")}`);
    }
  }
  if (!states.includes("ready")) throw new Error('states must include "ready"');
  return REX_DATA_STATES.filter((state) => states.includes(state));
}

export interface StatesTemplateOptions {
  readonly page: string;
  readonly states?: readonly RexDataState[];
}

function stateComponent(state: Exclude<RexDataState, "ready">, title: string): string[] {
  const name = stateExportName(state);
  const subject = title.toLowerCase();
  switch (state) {
    case "loading":
      return [
        `export function ${name}() {`,
        `  return <p role="status">Loading ${subject}</p>;`,
        "}",
      ];
    case "empty":
      return [`export function ${name}() {`, `  return <p>Nothing in ${subject} yet</p>;`, "}"];
    case "permission-denied":
      return [
        `export function ${name}() {`,
        `  return <p role="alert">You do not have access to ${subject}</p>;`,
        "}",
      ];
    case "terminal-error":
      return [
        `export function ${name}({ error }: StateProps) {`,
        "  return (",
        '    <section role="alert">',
        `      <p>${title} is unavailable</p>`,
        "      {error === null ? null : <p>{error.message}</p>}",
        "    </section>",
        "  );",
        "}",
      ];
    case "recoverable-error":
      return [
        `export function ${name}({ error, retry }: StateProps) {`,
        "  return (",
        '    <section role="alert">',
        `      <p>${title} failed to load</p>`,
        "      {error === null ? null : <p>{error.message}</p>}",
        '      <button type="button" onClick={retry}>',
        "        Try again",
        "      </button>",
        "    </section>",
        "  );",
        "}",
      ];
    case "stale":
    case "partial":
    case "offline": {
      const message =
        state === "stale"
          ? `${title} may be out of date`
          : state === "partial"
            ? `Part of ${subject} could not be loaded`
            : `You are offline; ${subject} will refresh when the connection returns`;
      return [
        `export function ${name}({ retry }: StateProps) {`,
        "  return (",
        '    <section role="status">',
        `      <p>${message}</p>`,
        '      <button type="button" onClick={retry}>',
        "        Refresh",
        "      </button>",
        "    </section>",
        "  );",
        "}",
      ];
    }
  }
}

export function statesTemplate(options: StatesTemplateOptions): string {
  const id = validateName(options.page, "page id");
  const states = statesList(options.states ?? REX_DATA_STATES).filter(
    (state): state is Exclude<RexDataState, "ready"> => state !== "ready",
  );
  const title = titleFromId(id);
  const usesProps = states.some(
    (state) => state !== "loading" && state !== "empty" && state !== "permission-denied",
  );
  const header = usesProps ? [`import type { StateProps } from "${CORE_IMPORT}";`, ""] : [];
  const blocks = states.map((state) => stateComponent(state, title));
  return lines(
    header,
    blocks.flatMap((block, index) => (index === 0 ? block : ["", ...block])),
  );
}

export interface RegionTemplateOptions {
  readonly page: string;
  readonly name: string;
}

export function regionTemplate(options: RegionTemplateOptions): string {
  validateName(options.page, "page id");
  const name = validateName(options.name, "region name");
  return lines(
    `import { region } from "${CLIENT_IMPORT}";`,
    "",
    `export default region(${JSON.stringify(name)}, () => <p>${titleFromId(name)}</p>);`,
  );
}

export interface PartTemplateOptions {
  readonly name: string;
}

export function partTemplate(options: PartTemplateOptions): string {
  const name = validateComponentName(options.name, "part name");
  return lines(
    `export default function ${name}(props: { readonly label: string }) {`,
    "  return <span>{props.label}</span>;",
    "}",
  );
}

export interface OverlayTemplateOptions {
  readonly page: string;
  readonly name: string;
}

export function overlayTemplate(options: OverlayTemplateOptions): string {
  validateName(options.page, "page id");
  const name = validateComponentName(options.name, "overlay name");
  return lines(
    `import { overlay } from "${CLIENT_IMPORT}";`,
    "",
    `export default overlay(${JSON.stringify(name)}, { dismiss: "both", binding: "region" }, () => (`,
    `  <p>${sentenceFromComponent(name)}</p>`,
    "));",
  );
}

export interface HookTemplateOptions {
  readonly name: string;
}

export function hookTemplate(options: HookTemplateOptions): string {
  const name = validateHookName(options.name);
  return lines(
    'import { useState } from "react";',
    "",
    `export function ${name}() {`,
    '  const [value, setValue] = useState("");',
    "  return { value, setValue };",
    "}",
  );
}

export interface DeclarationTemplateOptions {
  readonly name: string;
}

export function actionTemplate(options: DeclarationTemplateOptions): string {
  const id = validateName(options.name, "action id");
  return lines(
    `import { action, always } from "${CORE_IMPORT}";`,
    `import { boolean } from "${FIELDS_IMPORT}";`,
    `import { z } from "${SCHEMA_IMPORT}";`,
    "",
    `export const ${camelCase(id)} = action(${JSON.stringify(id)}, {`,
    "  input: z.object({}),",
    "  output: z.object({ ok: boolean() }),",
    "  policy: always(),",
    '  effect: "reversible",',
    `  label: ${JSON.stringify(titleFromId(id))},`,
    "  handler: () => ({ ok: true }),",
    "});",
  );
}

export function entityTemplate(options: DeclarationTemplateOptions): string {
  const id = validateName(options.name, "entity id");
  return lines(
    `import { entity } from "${CORE_IMPORT}";`,
    `import { id, text } from "${FIELDS_IMPORT}";`,
    "",
    `export const ${camelCase(id)} = entity(${JSON.stringify(id)}, {`,
    "  fields: { id: id(), name: text({ min: 1 }) },",
    "  label: (record) => record.name,",
    "});",
  );
}

export function policyTemplate(options: DeclarationTemplateOptions): string {
  const id = validateName(options.name, "policy id");
  const permission = JSON.stringify(`${id}.read`);
  return lines(
    `import { policy } from "${CORE_IMPORT}";`,
    "",
    `export const ${camelCase(id)} = policy(${JSON.stringify(id)}, {`,
    `  permissions: [${permission}],`,
    `  resolve: (actor) => (actor.permissions.includes(${permission}) ? [${permission}] : []),`,
    "});",
  );
}

export function flowTemplate(options: DeclarationTemplateOptions): string {
  const id = validateName(options.name, "flow id");
  return lines(
    `import { always, flow, memoryJournal } from "${CORE_IMPORT}";`,
    "",
    `export const ${camelCase(id)} = flow(${JSON.stringify(id)}, {`,
    `  steps: [{ approval: "review", label: "Review", approvers: always() }],`,
    "  journal: memoryJournal(),",
    "});",
  );
}

export function configTemplate(): string {
  return lines(
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
  );
}
