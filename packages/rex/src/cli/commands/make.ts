import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { errorDetail, RexError } from "../../core/errors.ts";
import { ARGS_ERROR, RexArgsError, type RexCommand as Command } from "../args.ts";
import type { RexCliIO } from "../index.ts";
import {
  actionTemplate,
  appPaths,
  entityTemplate,
  flowTemplate,
  hookTemplate,
  overlayTemplate,
  pageTemplate,
  partTemplate,
  policyTemplate,
  regionTemplate,
  statesTemplate,
  viewTemplate,
} from "../templates.ts";

export const DECLARATION_KINDS = ["action", "entity", "policy", "flow"] as const;

export type DeclarationKind = (typeof DECLARATION_KINDS)[number];

export const MAKE_REFUSED = "rex.make.refused";
export const INVALID_ARGUMENT = ARGS_ERROR.invalidArgument;
export const MAKE_INVALID_CODE = "REX601";
export const MAKE_REFUSED_CODE = "REX602";

export interface PlannedFile {
  readonly kind: "file";
  readonly path: string;
  readonly content: string;
}

export interface PlannedDir {
  readonly kind: "dir";
  readonly path: string;
}

export type PlannedEntry = PlannedFile | PlannedDir;

export class MakeError extends RexError {
  override readonly code: typeof MAKE_INVALID_CODE | typeof MAKE_REFUSED_CODE;
  readonly cliCode: typeof MAKE_REFUSED | typeof INVALID_ARGUMENT;
  readonly exitCode: number;

  constructor(cliCode: typeof MAKE_REFUSED | typeof INVALID_ARGUMENT, message: string) {
    const code = cliCode === MAKE_REFUSED ? MAKE_REFUSED_CODE : MAKE_INVALID_CODE;
    super(code, message);
    this.code = code;
    this.name = "MakeError";
    this.cliCode = cliCode;
    this.exitCode = cliCode === MAKE_REFUSED ? 1 : 2;
  }
}

function file(path: string, content: string): PlannedFile {
  return { kind: "file", path, content };
}

function dir(path: string): PlannedDir {
  return { kind: "dir", path };
}

function plan(build: () => readonly PlannedEntry[]): readonly PlannedEntry[] {
  try {
    return build();
  } catch (error) {
    throw new MakeError(INVALID_ARGUMENT, errorDetail(error));
  }
}

export function writePlan(root: string, entries: readonly PlannedEntry[]): string[] {
  const existing = entries
    .filter((entry) => entry.kind === "file" && existsSync(join(root, entry.path)))
    .map((entry) => entry.path);
  if (existing.length > 0) {
    throw new MakeError(
      MAKE_REFUSED,
      `refusing to overwrite existing files:\n${existing.map((path) => `  ${path}`).join("\n")}`,
    );
  }
  const written: string[] = [];
  for (const entry of entries) {
    const target = join(root, entry.path);
    if (entry.kind === "dir") {
      if (!existsSync(target)) {
        mkdirSync(target, { recursive: true });
        written.push(`${entry.path}/`);
      }
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.content, { flag: "wx" });
    written.push(entry.path);
  }
  return written;
}

function requirePage(root: string, page: string): void {
  const path = appPaths.page(page);
  if (!existsSync(join(root, path))) {
    throw new MakeError(MAKE_REFUSED, `page "${page}" does not exist: ${path} is missing`);
  }
}

function requireRegion(root: string, page: string, region: string): void {
  const path = appPaths.region(page, region);
  if (!existsSync(join(root, path))) {
    throw new MakeError(
      MAKE_REFUSED,
      `region "${page}/${region}" does not exist: ${path} is missing`,
    );
  }
}

export interface MakePageOptions {
  readonly id: string;
  readonly regions?: readonly string[];
  readonly overlays?: readonly string[];
}

export function makePage(root: string, options: MakePageOptions): string[] {
  const regions = options.regions ?? [];
  const overlays = options.overlays ?? [];
  const entries = plan(() => [
    file(appPaths.page(options.id), pageTemplate({ id: options.id, regions, overlays })),
    file(appPaths.view(options.id), viewTemplate({ page: options.id, regions })),
    file(appPaths.states(options.id), statesTemplate({ page: options.id })),
    dir(appPaths.hooksDir(options.id)),
    ...regions.map((name) =>
      file(appPaths.region(options.id, name), regionTemplate({ page: options.id, name })),
    ),
    ...overlays.map((name) =>
      file(appPaths.overlay(options.id, name), overlayTemplate({ page: options.id, name })),
    ),
    dir(appPaths.testDir(options.id)),
  ]);
  return writePlan(root, entries);
}

export function makeRegion(root: string, page: string, name: string): string[] {
  const entries = plan(() => [file(appPaths.region(page, name), regionTemplate({ page, name }))]);
  requirePage(root, page);
  return writePlan(root, entries);
}

export function makePart(root: string, page: string, region: string, name: string): string[] {
  const entries = plan(() => [file(appPaths.part(page, region, name), partTemplate({ name }))]);
  requirePage(root, page);
  requireRegion(root, page, region);
  return writePlan(root, entries);
}

export function makeOverlay(root: string, page: string, name: string): string[] {
  const entries = plan(() => [file(appPaths.overlay(page, name), overlayTemplate({ page, name }))]);
  requirePage(root, page);
  return writePlan(root, entries);
}

export function makeHook(root: string, page: string, name: string): string[] {
  const entries = plan(() => [file(appPaths.hook(page, name), hookTemplate({ name }))]);
  requirePage(root, page);
  return writePlan(root, entries);
}

const DECLARATION_TEMPLATES: {
  readonly [K in DeclarationKind]: {
    readonly path: (name: string) => string;
    readonly template: (options: { readonly name: string }) => string;
  };
} = {
  action: { path: appPaths.action, template: actionTemplate },
  entity: { path: appPaths.entity, template: entityTemplate },
  policy: { path: appPaths.policy, template: policyTemplate },
  flow: { path: appPaths.flow, template: flowTemplate },
};

export function makeDeclaration(root: string, kind: DeclarationKind, name: string): string[] {
  const { path, template } = DECLARATION_TEMPLATES[kind];
  return writePlan(
    root,
    plan(() => [file(path(name), template({ name }))]),
  );
}

export function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function reportedMakeError(command: string, error: unknown): unknown {
  if (!(error instanceof MakeError)) return error;
  return new RexArgsError(`${command}: ${error.detail}`, error.cliCode, error.exitCode, error.code);
}

function report(io: RexCliIO, make: () => string[]): void {
  let written: string[];
  try {
    written = make();
  } catch (error) {
    throw reportedMakeError("rex make", error);
  }
  for (const path of written) io.out(`wrote ${path}\n`);
}

export function register(program: Command, io: RexCliIO): void {
  const make = program
    .command("make")
    .description("write the canonical skeleton for a page, page file or declaration");

  make
    .command("page")
    .description(
      "write a page folder: page.ts, view.tsx, states.tsx, hooks/, regions, overlays and test/",
    )
    .argument("<id>", "page id")
    .option("--regions <names>", "comma-separated region names", parseList, [] as string[])
    .option("--overlays <names>", "comma-separated overlay names", parseList, [] as string[])
    .action((id: string, options: { regions: string[]; overlays: string[] }) => {
      report(io, () =>
        makePage(io.cwd, {
          id,
          regions: options.regions,
          overlays: options.overlays,
        }),
      );
    });

  make
    .command("region")
    .description("write regions/<name>/region.tsx in a page")
    .argument("<page>", "page id")
    .argument("<name>", "region name")
    .action((pageId: string, name: string) => {
      report(io, () => makeRegion(io.cwd, pageId, name));
    });

  make
    .command("part")
    .description("write regions/<region>/parts/<Name>.tsx in a page")
    .argument("<page>", "page id")
    .argument("<name>", "PascalCase part name")
    .requiredOption("--region <region>", "region that owns the part")
    .action((pageId: string, name: string, options: { region: string }) => {
      report(io, () => makePart(io.cwd, pageId, options.region, name));
    });

  make
    .command("overlay")
    .description("write overlays/<Name>.tsx in a page")
    .argument("<page>", "page id")
    .argument("<name>", "PascalCase overlay name")
    .action((pageId: string, name: string) => {
      report(io, () => makeOverlay(io.cwd, pageId, name));
    });

  make
    .command("hook")
    .description("write hooks/<useName>.ts in a page")
    .argument("<page>", "page id")
    .argument("<name>", "hook name starting with use")
    .action((pageId: string, name: string) => {
      report(io, () => makeHook(io.cwd, pageId, name));
    });

  for (const kind of DECLARATION_KINDS) {
    make
      .command(kind)
      .description(`write ${DECLARATION_TEMPLATES[kind].path("name")}`)
      .argument("<name>", `${kind} id`)
      .action((name: string) => {
        report(io, () => makeDeclaration(io.cwd, kind, name));
      });
  }
}
