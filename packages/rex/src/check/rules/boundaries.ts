import path from "node:path";
import ts from "typescript";
import { COMPONENT_ROLES, type AppFile, type FileRole, type RexApp } from "../engine.ts";
import {
  defineRule,
  finding,
  isRelativeSpecifier,
  packageName,
  type Finding,
  type ImportRef,
  type SourceLoader,
} from "../rule.ts";

export const REX_CORE = "@sidioralabs/rex";
export const REX_SCHEMA = "@sidioralabs/rex/schema";
export const REX_CLIENT = "@sidioralabs/rex/client";
export const REX_SERVER = "@sidioralabs/rex/server";
export const REX_CLIENT_INTEROP = "@sidioralabs/rex/client/interop";
export const REX_CLIENT_MEDIA = "@sidioralabs/rex/client/media";
export const REX_CLIENT_I18N = "@sidioralabs/rex/client/i18n";
export const REX_CLIENT_CAPABILITIES = [
  REX_CLIENT_INTEROP,
  REX_CLIENT_MEDIA,
  REX_CLIENT_I18N,
] as const;

const HOOK_NAME = /^use[A-Z0-9]/;
const SOURCE_EXTENSION = /\.(tsx?|jsx?|mjs|cjs)$/;

interface TargetRule {
  readonly role: FileRole;
  readonly samePage?: boolean;
  readonly sameRegion?: boolean;
  readonly typeOnly?: boolean;
}

interface PackageRule {
  readonly specifier: string;
  readonly exact?: boolean;
  readonly noHooks?: boolean;
}

interface RoleBoundary {
  readonly label: (file: AppFile) => string;
  readonly targets: readonly TargetRule[] | "any";
  readonly packages: readonly PackageRule[] | "any";
  readonly forbiddenPackages?: readonly string[];
  readonly noHooks?: boolean;
  readonly allowed: string;
}

const react: PackageRule = { specifier: "react" };
const core: PackageRule = { specifier: REX_CORE, exact: true };
const schema: PackageRule = { specifier: REX_SCHEMA, exact: true };
const client: PackageRule = { specifier: REX_CLIENT, exact: true };
const clientNoHooks: PackageRule = { specifier: REX_CLIENT, exact: true, noHooks: true };
const capabilities: readonly PackageRule[] = REX_CLIENT_CAPABILITIES.map((specifier) => ({
  specifier,
  exact: true,
}));
const capabilitiesNoHooks: readonly PackageRule[] = capabilities.map((rule) => ({
  ...rule,
  noHooks: true,
}));
const CLIENT_ENTRIES: readonly string[] = [REX_CLIENT, ...REX_CLIENT_CAPABILITIES];
const DECLARATION_FORBIDDEN = ["react", "react-dom", ...CLIENT_ENTRIES];
const CAPABILITIES_ALLOWED = ` and the optional client entries ${REX_CLIENT_CAPABILITIES.join(", ")}`;

const fileLabel = (file: AppFile) => path.posix.basename(file.file);

export const IMPORT_TABLE: Readonly<Record<FileRole, RoleBoundary>> = {
  page: {
    label: () => "page.ts",
    targets: [{ role: "entity" }, { role: "action" }, { role: "policy" }],
    packages: [core, schema, { specifier: "zod" }],
    allowed:
      "page.ts may import app/entities, app/actions, app/policies, @sidioralabs/rex, @sidioralabs/rex/schema and zod, never React.",
  },
  view: {
    label: () => "view.tsx",
    targets: [{ role: "region", samePage: true }],
    packages: [react, core, client],
    noHooks: true,
    allowed:
      "view.tsx may import its page's regions, react types and the layout primitives from @sidioralabs/rex/client; hooks, data and parts belong in region.tsx.",
  },
  region: {
    label: () => "region.tsx",
    targets: [
      { role: "hook", samePage: true },
      { role: "part", samePage: true, sameRegion: true },
      { role: "overlay", samePage: true },
      { role: "page", samePage: true },
      { role: "action" },
      { role: "flow" },
      { role: "component" },
      { role: "entity", typeOnly: true },
    ],
    packages: [react, core, client, ...capabilities],
    allowed: `region.tsx may import its page's hooks, its own parts, its page's overlays, its own page.ts, app/actions, app/flows, app/components, react, @sidioralabs/rex and @sidioralabs/rex/client${CAPABILITIES_ALLOWED}, never other regions or pages.`,
  },
  part: {
    label: (file) => `part ${fileLabel(file)}`,
    targets: [
      { role: "component" },
      { role: "part", samePage: true, sameRegion: true },
      { role: "entity", typeOnly: true },
      { role: "action", typeOnly: true },
    ],
    packages: [react, core, clientNoHooks, ...capabilitiesNoHooks],
    allowed: `parts may import app/components, sibling parts of their region, entity and action types, react, @sidioralabs/rex types and non-hook exports of @sidioralabs/rex/client${CAPABILITIES_ALLOWED}; fetching, actions and navigation belong in region.tsx.`,
  },
  hook: {
    label: (file) => `hook ${fileLabel(file)}`,
    targets: [
      { role: "data" },
      { role: "action" },
      { role: "entity" },
      { role: "policy" },
      { role: "flow" },
      { role: "hook", samePage: true },
      { role: "page", samePage: true },
    ],
    packages: [
      react,
      core,
      schema,
      client,
      ...capabilities,
      { specifier: "@tanstack/react-query" },
      { specifier: "zod" },
    ],
    allowed: `hooks may import app/data, app/actions, app/entities, app/policies, app/flows, sibling hooks, their own page.ts, react, @tanstack/react-query, zod, @sidioralabs/rex, @sidioralabs/rex/schema and @sidioralabs/rex/client${CAPABILITIES_ALLOWED}, never components.`,
  },
  overlay: {
    label: (file) => `overlay ${fileLabel(file)}`,
    targets: [
      { role: "part", samePage: true },
      { role: "component" },
      { role: "entity", typeOnly: true },
      { role: "action", typeOnly: true },
    ],
    packages: [react, core, clientNoHooks, ...capabilitiesNoHooks],
    allowed: `overlays may import their page's parts, app/components, entity and action types, react, @sidioralabs/rex types and non-hook exports of @sidioralabs/rex/client${CAPABILITIES_ALLOWED}, never data fetching.`,
  },
  states: {
    label: () => "states.tsx",
    targets: [
      { role: "part", samePage: true },
      { role: "component" },
      { role: "entity", typeOnly: true },
      { role: "action", typeOnly: true },
    ],
    packages: [react, core, clientNoHooks, ...capabilitiesNoHooks],
    noHooks: true,
    allowed: `states.tsx may import its page's parts, app/components, entity and action types, react, @sidioralabs/rex types and non-hook exports of @sidioralabs/rex/client${CAPABILITIES_ALLOWED}, never hooks.`,
  },
  component: {
    label: (file) => `component ${file.file.replace(/^app\//, "")}`,
    targets: [{ role: "component" }, { role: "entity", typeOnly: true }],
    packages: "any",
    allowed:
      "app/components may import other app/components, entity types and UI packages, never app data, actions or pages.",
  },
  data: {
    label: (file) => `data module ${file.file.replace(/^app\//, "")}`,
    targets: [{ role: "data" }, { role: "entity" }, { role: "action" }, { role: "policy" }],
    packages: "any",
    allowed: "app/data may import app/data, app/entities, app/actions, app/policies and packages.",
  },
  action: {
    label: (file) => `action ${fileLabel(file)}`,
    targets: [{ role: "entity" }, { role: "policy" }, { role: "action" }, { role: "data" }],
    packages: "any",
    forbiddenPackages: DECLARATION_FORBIDDEN,
    allowed:
      "actions may import app/entities, app/policies, app/actions, app/data and non-React packages; declarations never import React.",
  },
  entity: {
    label: (file) => `entity ${fileLabel(file)}`,
    targets: [{ role: "entity" }],
    packages: "any",
    forbiddenPackages: DECLARATION_FORBIDDEN,
    allowed: "entities may import other app/entities and non-React packages.",
  },
  policy: {
    label: (file) => `policy ${fileLabel(file)}`,
    targets: [{ role: "policy" }, { role: "entity" }],
    packages: "any",
    forbiddenPackages: DECLARATION_FORBIDDEN,
    allowed: "policies may import app/policies, app/entities and non-React packages.",
  },
  flow: {
    label: (file) => `flow ${fileLabel(file)}`,
    targets: [
      { role: "action" },
      { role: "policy" },
      { role: "flow" },
      { role: "entity" },
      { role: "data" },
    ],
    packages: "any",
    forbiddenPackages: DECLARATION_FORBIDDEN,
    allowed:
      "flows may import app/actions, app/policies, app/flows, app/entities, app/data and non-React packages.",
  },
  test: {
    label: (file) => `test ${fileLabel(file)}`,
    targets: "any",
    packages: "any",
    allowed: "tests may import anything within their own page and the shared app folders.",
  },
};

const FETCH_PACKAGES = ["@tanstack/react-query", "drizzle-orm", "@libsql/client"];
const FETCH_PACKAGE_PREFIXES = ["@orpc/"];
const FETCH_NAMES: Readonly<Record<string, readonly string[]>> = {
  [REX_CORE]: ["memoryStore", "bind"],
  [REX_CLIENT]: ["useRexClient"],
};
const FETCH_GLOBALS = new Set(["window", "globalThis", "self"]);
const FETCH_CONSTRUCTORS = new Set(["XMLHttpRequest", "EventSource", "WebSocket"]);
const NO_FETCH_HINT =
  "Move data access into a hook in hooks/ or a module in app/data and bind it in region.tsx.";

function pageDirOf(app: RexApp, absolute: string): string | null {
  const relative = path.relative(path.join(app.appDir, "pages"), absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const [first, ...rest] = relative.split(path.sep);
  return first !== undefined && rest.length > 0 ? first : null;
}

function describeTarget(target: AppFile): string {
  const place = target.page ? ` of page ${target.page}` : "";
  switch (target.role) {
    case "part":
      return `a part of region ${target.region}${place}`;
    case "region":
      return `region ${target.region}${place}`;
    case "hook":
    case "overlay":
    case "test":
      return `a ${target.role}${place}`;
    case "page":
      return `the page declaration${place}`;
    case "view":
    case "states":
      return `${target.role === "view" ? "view.tsx" : "states.tsx"}${place}`;
    default:
      return `${target.role} module ${target.file}`;
  }
}

function packageAllowed(rule: PackageRule, specifier: string): boolean {
  return rule.exact ? specifier === rule.specifier : packageName(specifier) === rule.specifier;
}

function fetchViolation(ref: ImportRef): string | null {
  if (ref.typeOnly) return null;
  const name = packageName(ref.specifier);
  if (name === null) return null;
  if (
    FETCH_PACKAGES.includes(name) ||
    FETCH_PACKAGE_PREFIXES.some((prefix) => name.startsWith(prefix)) ||
    ref.specifier === REX_SERVER
  ) {
    return `the data access package "${ref.specifier}"`;
  }
  const names = FETCH_NAMES[ref.specifier];
  const hit = names ? ref.names.find((imported) => names.includes(imported)) : undefined;
  return hit ? `"${hit}" from "${ref.specifier}"` : null;
}

function fetchCalls(sources: SourceLoader, file: AppFile): { what: string; node: ts.Node }[] {
  const found: { what: string; node: ts.Node }[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && callee.text === "fetch") {
        found.push({ what: "fetch()", node });
      } else if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === "fetch" &&
        ts.isIdentifier(callee.expression) &&
        FETCH_GLOBALS.has(callee.expression.text)
      ) {
        found.push({ what: `${callee.expression.text}.fetch()`, node });
      }
    } else if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      FETCH_CONSTRUCTORS.has(node.expression.text)
    ) {
      found.push({ what: `new ${node.expression.text}()`, node });
    }
    ts.forEachChild(node, visit);
  };
  visit(sources.load(file.path));
  return found;
}

function checkFile(app: RexApp, sources: SourceLoader, file: AppFile): Finding[] {
  const boundary = IMPORT_TABLE[file.role];
  const label = boundary.label(file);
  const isComponent = COMPONENT_ROLES.includes(file.role);
  const findings: Finding[] = [];
  const report = (
    code: string,
    ref: { line: number; column: number },
    message: string,
    hint: string,
  ) =>
    findings.push(
      finding({
        rule: `boundaries/${code}`,
        file: file.file,
        line: ref.line,
        column: ref.column,
        message,
        hint,
      }),
    );

  for (const ref of sources.imports(file.path)) {
    const relative = isRelativeSpecifier(ref.specifier) || ref.specifier.startsWith("/");
    if (relative) {
      const resolved = sources.resolve(file.path, ref.specifier);
      if (resolved === null) {
        report(
          "unresolved",
          ref,
          `${label} imports "${ref.specifier}", which does not resolve to a file`,
          "Fix the import path so the boundary of the imported file can be checked.",
        );
        continue;
      }
      if (!SOURCE_EXTENSION.test(resolved) || resolved.endsWith(".d.ts")) continue;
      const fromPage = file.page;
      const toPage = pageDirOf(app, resolved);
      if (fromPage !== null && toPage !== null && toPage !== fromPage) {
        report(
          "cross-page",
          ref,
          `${label} of page ${fromPage} imports "${ref.specifier}" from page ${toPage}`,
          "No page imports another page; move the shared code to app/components with rex promote, or to app/data.",
        );
        continue;
      }
      if (boundary.targets === "any") continue;
      const target = app.fileAt(resolved);
      if (target === undefined) {
        const where = path.relative(app.appDir, resolved).startsWith("..")
          ? "a file outside app/"
          : `${app.relative(resolved)}, which has no Rex file role`;
        report(
          "import-table",
          ref,
          `${label} imports "${ref.specifier}" (${where})`,
          boundary.allowed,
        );
        continue;
      }
      const permitted = boundary.targets.some(
        (rule) =>
          rule.role === target.role &&
          (!rule.samePage || target.page === file.page) &&
          (!rule.sameRegion || target.region === file.region) &&
          (!rule.typeOnly || ref.typeOnly),
      );
      if (!permitted) {
        report(
          "import-table",
          ref,
          `${label} imports "${ref.specifier}" (${describeTarget(target)})`,
          boundary.allowed,
        );
      }
      continue;
    }

    if (isComponent) {
      const violation = fetchViolation(ref);
      if (violation !== null) {
        report(
          "no-fetch",
          ref,
          `${label} imports ${violation}; components never fetch or touch stores directly`,
          NO_FETCH_HINT,
        );
        continue;
      }
    }
    const name = packageName(ref.specifier);
    const forbidden = boundary.forbiddenPackages?.find((candidate) =>
      CLIENT_ENTRIES.includes(candidate) ? ref.specifier === candidate : name === candidate,
    );
    if (forbidden !== undefined) {
      report(
        "import-table",
        ref,
        `${label} imports "${ref.specifier}"; declarations never import React or the client runtime`,
        boundary.allowed,
      );
      continue;
    }
    if (boundary.packages !== "any") {
      const rule = boundary.packages.find((candidate) => packageAllowed(candidate, ref.specifier));
      if (rule === undefined) {
        report(
          "import-table",
          ref,
          `${label} imports the package "${ref.specifier}", which the import table does not allow`,
          boundary.allowed,
        );
        continue;
      }
      if (boundary.noHooks || rule.noHooks) {
        const hook = ref.names.find((imported) => HOOK_NAME.test(imported));
        if (hook !== undefined && !ref.typeOnly) {
          report(
            "import-table",
            ref,
            `${label} imports the hook "${hook}" from "${ref.specifier}"`,
            boundary.allowed,
          );
        }
      }
    }
  }

  if (isComponent) {
    for (const call of fetchCalls(sources, file)) {
      report(
        "no-fetch",
        sources.location(file.path, call.node),
        `${label} calls ${call.what}; components never fetch directly`,
        NO_FETCH_HINT,
      );
    }
  }
  return findings;
}

export const boundariesRule = defineRule({
  id: "boundaries",
  description:
    "Enforces the import table by file role, bans cross-page imports and direct data access from components.",
  check({ app, sources }) {
    return app.files.flatMap((file) => checkFile(app, sources, file));
  },
});
