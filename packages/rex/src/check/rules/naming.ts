import path from "node:path";
import { isValidName } from "../../core/ids.ts";
import type { AppFile, RexApp } from "../engine.ts";
import { defineRule, finding, type Finding, type SourceLoader } from "../rule.ts";

export const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
export const HOOK_NAME = /^use[A-Z][A-Za-z0-9]*$/;

function valueExports(sources: SourceLoader, file: AppFile) {
  return sources.exports(file.path).filter((entry) => !entry.typeOnly);
}

function checkPart(sources: SourceLoader, file: AppFile): Finding[] {
  const findings: Finding[] = [];
  if (!PASCAL_CASE.test(file.name)) {
    findings.push(
      finding({
        rule: "naming/part-name",
        file: file.file,
        message: `part file ${file.name}.tsx is not PascalCase`,
        hint: `Rename the part to ${toPascal(file.name)}.tsx; parts are PascalCase components.`,
      }),
    );
  }
  const exports = valueExports(sources, file);
  const defaults = exports.filter((entry) => entry.name === "default");
  const others = exports.filter((entry) => entry.name !== "default");
  if (defaults.length !== 1) {
    findings.push(
      finding({
        rule: "naming/part-exports",
        file: file.file,
        message: `part ${file.name}.tsx has no default export`,
        hint: `Export the component as the single default export: export default function ${toPascal(file.name)}(props).`,
      }),
    );
  }
  for (const entry of others) {
    findings.push(
      finding({
        rule: "naming/part-exports",
        file: file.file,
        line: entry.line,
        column: entry.column,
        message: `part ${file.name}.tsx exports ${entry.name === "*" ? `everything from "${entry.from}"` : entry.name} besides its default export`,
        hint: "A part has a single default export; move shared values to app/components or make them local.",
      }),
    );
  }
  return findings;
}

function checkHook(sources: SourceLoader, file: AppFile): Finding[] {
  const findings: Finding[] = [];
  if (!HOOK_NAME.test(file.name)) {
    findings.push(
      finding({
        rule: "naming/hook-name",
        file: file.file,
        message: `hook file ${file.name} is not camelCase starting with use`,
        hint: `Rename the file to ${toHookName(file.name)}${path.extname(file.path)} and export a function of the same name.`,
      }),
    );
  }
  const exports = valueExports(sources, file);
  const named = exports.filter((entry) => entry.name !== "default" && entry.name !== "*");
  const problems = exports.filter((entry) => entry.name === "default" || entry.name === "*");
  if (named.length === 0 && problems.length === 0) {
    findings.push(
      finding({
        rule: "naming/hook-exports",
        file: file.file,
        message: `hook ${file.name} exports no function`,
        hint: `Export exactly one function: export function ${toHookName(file.name)}().`,
      }),
    );
  }
  for (const entry of problems) {
    findings.push(
      finding({
        rule: "naming/hook-exports",
        file: file.file,
        line: entry.line,
        column: entry.column,
        message:
          entry.name === "default"
            ? `hook ${file.name} has a default export`
            : `hook ${file.name} re-exports everything from "${entry.from}"`,
        hint: `Export exactly one named function: export function ${toHookName(file.name)}().`,
      }),
    );
  }
  named.forEach((entry, index) => {
    if (index === 0 && problems.length === 0) {
      if (HOOK_NAME.test(file.name) && entry.name !== file.name) {
        findings.push(
          finding({
            rule: "naming/hook-exports",
            file: file.file,
            line: entry.line,
            column: entry.column,
            message: `hook ${file.name} exports ${entry.name} instead of ${file.name}`,
            hint: `Name the exported function after its file: export function ${file.name}().`,
          }),
        );
      }
      return;
    }
    findings.push(
      finding({
        rule: "naming/hook-exports",
        file: file.file,
        line: entry.line,
        column: entry.column,
        message: `hook ${file.name} exports ${entry.name} in addition to its hook`,
        hint: "A hook file exports a single function; move the extra export into its own hook file or make it local.",
      }),
    );
  });
  return findings;
}

function checkOverlay(file: AppFile): Finding[] {
  if (PASCAL_CASE.test(file.name)) return [];
  return [
    finding({
      rule: "naming/overlay-name",
      file: file.file,
      message: `overlay file ${file.name}.tsx is not PascalCase`,
      hint: `Rename the overlay to ${toPascal(file.name)}.tsx and use the same id in page.ts overlays.`,
    }),
  ];
}

function toPascal(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter((word) => word.length > 0);
  const joined = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
  return joined.length > 0 ? joined : "Component";
}

function toHookName(name: string): string {
  const pascal = toPascal(name.replace(/^use(?=[^a-z]|$)/i, ""));
  return `use${pascal}`;
}

function checkUnclassified(file: string): Finding {
  const segments = file.split("/");
  const base = segments.at(-1) ?? file;
  const inPages = segments[1] === "pages";
  if (inPages && /^index\.tsx?$/.test(base)) {
    return finding({
      rule: "naming/barrel",
      file,
      message: `${file} is a barrel; app/pages has no index files`,
      hint: "Delete the index file and import each file by its conventional path.",
    });
  }
  if (inPages && segments[3] === "regions" && segments.length === 6) {
    return finding({
      rule: "naming/region-file",
      file,
      message: `${base} is not a region file; regions/${segments[4]} holds region.tsx and parts/`,
      hint: `Name the region component regions/${segments[4]}/region.tsx and move other components into regions/${segments[4]}/parts/.`,
    });
  }
  const pageDir = inPages && segments.length > 3 ? `app/pages/${segments[2]}/` : null;
  return finding({
    rule: "naming/unclassified",
    file,
    message: `${file} does not match any Rex file role`,
    hint: pageDir
      ? `A page folder holds page.ts, view.tsx, states.tsx, hooks/, regions/<region>/region.tsx, regions/<region>/parts/, overlays/ and test/; move ${base} into one of them under ${pageDir}.`
      : `Move ${base} to app/pages, app/actions, app/entities, app/policies, app/flows, app/components or app/data.`,
  });
}

function checkFolders(app: RexApp): Finding[] {
  const findings: Finding[] = [];
  for (const entry of app.pages) {
    const pageDir = app.relative(entry.dir);
    if (!isValidName(entry.id)) {
      findings.push(
        finding({
          rule: "naming/page-folder",
          file: pageDir,
          message: `page folder ${entry.id} is not a valid page id`,
          hint: "Name page folders with lowercase letters, digits, dot and dash, starting with a letter.",
        }),
      );
    }
    for (const region of entry.regions) {
      if (isValidName(region.name)) continue;
      findings.push(
        finding({
          rule: "naming/region-folder",
          file: app.relative(region.dir),
          message: `region folder ${region.name} of page ${entry.id} is not a valid region name`,
          hint: "Name region folders with lowercase letters, digits, dot and dash, starting with a letter.",
        }),
      );
    }
  }
  return findings;
}

export const namingRule = defineRule({
  id: "naming",
  description:
    "Checks part, hook, region and overlay file names, single exports and files outside the Rex file roles.",
  check({ app, sources }) {
    const findings: Finding[] = checkFolders(app);
    for (const file of app.files) {
      if (file.role === "part") findings.push(...checkPart(sources, file));
      else if (file.role === "hook") findings.push(...checkHook(sources, file));
      else if (file.role === "overlay") findings.push(...checkOverlay(file));
    }
    for (const file of app.unclassified) findings.push(checkUnclassified(file));
    return findings;
  },
});
