import type { BuildTarget } from "../cli/commands/build.ts";
import type { Manifest } from "../manifest/types.ts";
import type { PrerenderList } from "../server/adapters/static-cache.ts";
import { prerenderListOutput } from "./outputs/prerender-list.ts";
import { shellDocumentsOutput } from "./outputs/shell-documents.ts";
import { staticManifestOutput } from "./outputs/static-manifest.ts";
import { textFilesOutput } from "./outputs/text-files.ts";

export interface StaticOutputContext {
  readonly target: BuildTarget;
  readonly outDir: string;
  readonly clientDir: string;
  readonly manifest: Manifest;
  readonly prerendered: PrerenderList;
  readonly shell: string | null;
}

export interface StaticOutputFile {
  readonly file: string;
  readonly path: string | null;
  readonly page: string | null;
  readonly note: string | null;
}

export interface StaticOutput {
  readonly id: string;
  applies(target: BuildTarget): boolean;
  write(
    context: StaticOutputContext,
  ): readonly StaticOutputFile[] | Promise<readonly StaticOutputFile[]>;
}

export interface StaticOutputRun {
  readonly id: string;
  readonly files: readonly StaticOutputFile[];
}

export const STATIC_OUTPUTS: readonly StaticOutput[] = [
  shellDocumentsOutput,
  staticManifestOutput,
  textFilesOutput,
  prerenderListOutput,
];

export async function runStaticOutputs(
  context: StaticOutputContext,
  outputs: readonly StaticOutput[] = STATIC_OUTPUTS,
): Promise<readonly StaticOutputRun[]> {
  const runs: StaticOutputRun[] = [];
  for (const output of outputs) {
    if (!output.applies(context.target)) continue;
    const files = await output.write(context);
    runs.push(Object.freeze({ id: output.id, files: Object.freeze([...files]) }));
  }
  return Object.freeze(runs);
}

export function outputFiles(
  runs: readonly StaticOutputRun[],
  id: string,
): readonly StaticOutputFile[] {
  return runs.find((run) => run.id === id)?.files ?? [];
}
