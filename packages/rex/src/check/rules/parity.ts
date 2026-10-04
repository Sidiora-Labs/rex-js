import path from "node:path";
import type { AppPage, RexApp } from "../engine.ts";
import {
  defineRule,
  finding,
  type Finding,
  type Location,
  type SourceLoader,
  type StaticPageDeclaration,
} from "../rule.ts";

export interface ActionReference extends Location {
  readonly key: string;
  readonly label: string;
}

function toPosix(file: string): string {
  return file.split(path.sep).join("/");
}

export function actionKey(
  app: RexApp,
  sources: SourceLoader,
  source: string,
  exportName: string,
): { key: string; label: string } {
  const declared = sources
    .declarations(source)
    .find((entry) => entry.kind === "action" && entry.exportName === exportName);
  if (declared) return { key: `action:${declared.id}`, label: `"${declared.id}"` };
  const file = app.relative(source);
  return { key: `export:${file}#${exportName}`, label: `${exportName} from ${file}` };
}

export function regionActionReferences(
  app: RexApp,
  sources: SourceLoader,
  regionFile: string,
): ActionReference[] {
  const references: ActionReference[] = [];
  for (const ref of sources.imports(regionFile)) {
    if ((ref.kind !== "import" && ref.kind !== "export") || ref.typeOnly) continue;
    const resolved = sources.resolve(regionFile, ref.specifier);
    if (resolved === null || app.fileAt(resolved)?.role !== "action") continue;
    for (const name of ref.names) {
      if (name === "*") {
        for (const declared of sources.declarations(resolved)) {
          if (declared.kind !== "action") continue;
          references.push({
            key: `action:${declared.id}`,
            label: `"${declared.id}"`,
            line: ref.line,
            column: ref.column,
          });
        }
      } else {
        references.push({
          ...actionKey(app, sources, resolved, name),
          line: ref.line,
          column: ref.column,
        });
      }
    }
  }
  return references;
}

function checkPage(app: RexApp, sources: SourceLoader, entry: AppPage): Finding[] {
  const findings: Finding[] = [];
  const pageDir = toPosix(path.relative(app.root, entry.dir));
  const report = (code: string, file: string, at: Location | null, message: string, hint: string) =>
    findings.push(
      finding({
        rule: `parity/${code}`,
        file,
        line: at?.line ?? 1,
        column: at?.column ?? 1,
        message,
        hint,
      }),
    );

  for (const [role, file] of [
    ["page", "page.ts"],
    ["view", "view.tsx"],
    ["states", "states.tsx"],
  ] as const) {
    if (entry[role] === null) {
      report(
        "missing-file",
        `${pageDir}/${file}`,
        null,
        `page ${entry.id} has no ${file}`,
        `Every page folder contains page.ts, view.tsx and states.tsx; run rex make page ${entry.id} to write the missing skeleton.`,
      );
    }
  }
  if (entry.page === null) return findings;

  const pageFile = entry.page.file;
  const declared: StaticPageDeclaration | null = sources.pageDeclaration(entry.page.path);
  if (declared === null) {
    report(
      "unreadable",
      pageFile,
      null,
      `page.ts of page ${entry.id} does not export a page() declaration`,
      `Export the declaration: export default page("${entry.id}", { route, regions, overlays, actions }).`,
    );
    return findings;
  }
  for (const field of declared.unreadable) {
    report(
      "unreadable",
      pageFile,
      declared,
      `page.ts ${field} of page ${entry.id} is not a literal the checker can read`,
      `Write ${field} inline in the page() call as a literal list so regions, overlays, actions and states can be verified.`,
    );
  }

  const regionFolders = new Map(entry.regions.map((region) => [region.name, region]));
  const declaredRegions = new Set(declared.regions.map((region) => region.name));
  if (!declared.unreadable.includes("regions")) {
    for (const region of declared.regions) {
      const folder = regionFolders.get(region.name);
      if (folder?.file) continue;
      report(
        "region-missing",
        pageFile,
        region,
        folder
          ? `region "${region.name}" of page ${entry.id} has a folder but no region.tsx`
          : `region "${region.name}" is declared in page.ts but regions/${region.name}/region.tsx does not exist`,
        `Create regions/${region.name}/region.tsx with rex make region ${entry.id} ${region.name}, or remove "${region.name}" from page.ts regions.`,
      );
    }
    for (const folder of entry.regions) {
      if (declaredRegions.has(folder.name)) continue;
      report(
        "region-undeclared",
        folder.file?.file ?? toPosix(path.relative(app.root, folder.dir)),
        null,
        `regions/${folder.name} exists but page.ts of page ${entry.id} does not declare region "${folder.name}"`,
        `Add "${folder.name}" to page.ts regions, or delete the regions/${folder.name} folder.`,
      );
    }
  }

  if (!declared.unreadable.includes("overlays")) {
    const overlayFiles = new Map(entry.overlays.map((file) => [file.name, file]));
    const declaredOverlays = new Set(declared.overlays.map((overlay) => overlay.id));
    for (const overlay of declared.overlays) {
      if (overlayFiles.has(overlay.id)) continue;
      report(
        "overlay-missing",
        pageFile,
        overlay,
        `overlay "${overlay.id}" is declared in page.ts but overlays/${overlay.id}.tsx does not exist`,
        `Create overlays/${overlay.id}.tsx with rex make overlay ${entry.id} ${overlay.id}, or remove it from page.ts overlays.`,
      );
    }
    for (const file of entry.overlays) {
      if (declaredOverlays.has(file.name)) continue;
      report(
        "overlay-undeclared",
        file.file,
        null,
        `overlays/${file.name}.tsx exists but page.ts of page ${entry.id} does not declare overlay "${file.name}"`,
        `Add { id: "${file.name}", dismiss, binding } to page.ts overlays, or delete the file.`,
      );
    }
  }

  if (!declared.unreadable.includes("actions")) {
    const pageActions = new Map<string, { label: string; at: Location }>();
    for (const ref of declared.actions) {
      if (ref.source === null || ref.imported === null) {
        report(
          "unreadable",
          pageFile,
          ref,
          `page.ts action ${ref.local} of page ${entry.id} is not imported from app/actions`,
          `Import the action from app/actions/<action>.ts and list the imported binding in page.ts actions.`,
        );
        continue;
      }
      const identity = actionKey(app, sources, ref.source, ref.imported);
      pageActions.set(identity.key, { label: identity.label, at: ref });
    }
    const referenced = new Set<string>();
    for (const region of entry.regions) {
      if (!region.file) continue;
      for (const reference of regionActionReferences(app, sources, region.file.path)) {
        referenced.add(reference.key);
        if (pageActions.has(reference.key)) continue;
        report(
          "action-undeclared",
          region.file.file,
          reference,
          `region "${region.name}" references action ${reference.label}, which page ${entry.id} does not declare`,
          `Add the action to page.ts actions, or remove it from region "${region.name}".`,
        );
      }
    }
    for (const [key, action] of pageActions) {
      if (referenced.has(key)) continue;
      report(
        "action-unreferenced",
        pageFile,
        action.at,
        `action ${action.label} is declared on page ${entry.id} but no region references it`,
        "Bind the action in the region.tsx that renders its control, or remove it from page.ts actions.",
      );
    }
  }
  return findings;
}

export const parityRule = defineRule({
  id: "parity",
  description:
    "Checks that page.ts regions, overlays and actions match the region folders, overlay files and region action references.",
  check({ app, sources }) {
    return app.pages.flatMap((entry) => checkPage(app, sources, entry));
  },
});
