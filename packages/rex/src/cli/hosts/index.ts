import type { BuildResult, BuildTarget } from "../commands/build.ts";
import { RexError } from "../../core/errors.ts";
import type { Manifest } from "../../manifest/types.ts";

export interface RexHostWriter {
  readonly host: string;
  readonly target: BuildTarget;
  write(result: BuildResult, manifest: Manifest): readonly string[] | Promise<readonly string[]>;
}

export interface HostConfig {
  readonly deploy?: { readonly host?: string | null } | null;
}

export const HOST_TARGETS = Object.freeze({
  node: "node",
  bun: "bun",
  deno: "deno",
  static: "static",
} as const satisfies Readonly<Record<string, BuildTarget>>);

export type RexHost = keyof typeof HOST_TARGETS;

function writesNothing(host: RexHost): RexHostWriter {
  return Object.freeze({ host, target: HOST_TARGETS[host], write: () => [] });
}

export const HOST_WRITERS: readonly RexHostWriter[] = Object.freeze([
  writesNothing("node"),
  writesNothing("bun"),
  writesNothing("deno"),
  writesNothing("static"),
]);

export function hostWriter(host: string): RexHostWriter | null {
  return HOST_WRITERS.find((writer) => writer.host === host) ?? null;
}

export function deployHost(config: object): string | null {
  const host = (config as HostConfig).deploy?.host;
  return typeof host === "string" ? host : null;
}

export function hostFor(config: object): RexHostWriter | null {
  const host = deployHost(config);
  if (host === null) return null;
  const writer = hostWriter(host);
  if (writer === null) {
    throw new RexError(
      "REX605",
      `rex build: deploy.host ${JSON.stringify(host)} has no host writer; the hosts are ${HOST_WRITERS.map((entry) => entry.host).join(", ")}`,
    );
  }
  return writer;
}

export function buildWriter(config: object, target: BuildTarget): RexHostWriter | null {
  const declared = hostFor(config);
  if (declared !== null && declared.target === target) return declared;
  return HOST_WRITERS.find((writer) => writer.host === target && writer.target === target) ?? null;
}

export async function writeHostFiles(
  writer: RexHostWriter | null,
  result: BuildResult,
  manifest: Manifest,
): Promise<readonly string[]> {
  return writer === null ? [] : Object.freeze([...(await writer.write(result, manifest))]);
}
