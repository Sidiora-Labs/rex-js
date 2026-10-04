import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS } from "../../core/config.ts";
import { page } from "../../core/page.ts";
import { createRegistry } from "../../core/registry.ts";
import { buildManifest } from "../../manifest/build.ts";
import { BUILD_TARGETS, type BuildResult, type BuildTarget } from "../commands/build.ts";
import {
  HOST_TARGETS,
  HOST_WRITERS,
  buildWriter,
  deployHost,
  hostFor,
  hostWriter,
  writeHostFiles,
} from "./index.ts";

const home = page("home", { route: "/", chrome: { title: "Home" }, states: ["ready"] });
const manifest = buildManifest(createRegistry().register(home).freeze(), { app: "hosts" });

function result(target: BuildTarget): BuildResult {
  return {
    target,
    outDir: "/opt/app/dist",
    clientDir: "/opt/app/dist/client",
    serverFile: target === "static" ? null : "/opt/app/dist/server.js",
    manifestFile: target === "static" ? null : "/opt/app/dist/manifest.json",
    apiOrigin: null,
    chunks: [],
    prerendered: [],
    prerenderFile: null,
    staticManifestFile: null,
    textFiles: [],
    shells: [],
    outputs: [],
    host: target,
    hostFiles: [],
  };
}

describe("the host writer list", () => {
  it("maps every host to exactly one build target", () => {
    expect(HOST_TARGETS).toEqual({ node: "node", bun: "bun", deno: "deno", static: "static" });
    expect(Object.isFrozen(HOST_TARGETS)).toBe(true);
    expect(HOST_WRITERS.map((writer) => [writer.host, writer.target])).toEqual(
      Object.entries(HOST_TARGETS),
    );
    for (const target of Object.values(HOST_TARGETS)) {
      expect(BUILD_TARGETS, target).toContain(target);
    }
  });

  it("writes no host files for node, bun, deno and static", async () => {
    for (const writer of HOST_WRITERS) {
      expect(await writer.write(result(writer.target), manifest), writer.host).toEqual([]);
      expect(await writeHostFiles(writer, result(writer.target), manifest), writer.host).toEqual(
        [],
      );
    }
    expect(await writeHostFiles(null, result("edge"), manifest)).toEqual([]);
  });

  it("reads deploy.host from the config and refuses a host without a writer", () => {
    expect(deployHost({})).toBeNull();
    expect(deployHost(DEFAULT_OPTIONS)).toBeNull();
    expect(deployHost({ deploy: null })).toBeNull();
    expect(deployHost({ deploy: {} })).toBeNull();
    expect(deployHost({ deploy: { host: "static" } })).toBe("static");
    expect(hostFor(DEFAULT_OPTIONS)).toBeNull();
    expect(hostFor({ deploy: { host: "static" } })).toBe(hostWriter("static"));
    expect(hostFor({ deploy: { host: "bun" } })?.target).toBe("bun");
    expect(hostWriter("cloudflare")).toBeNull();
    expect(() => hostFor({ deploy: { host: "cloudflare" } })).toThrow(
      expect.objectContaining({
        name: "RexError",
        code: "REX605",
        message:
          'REX605 rex build: deploy.host "cloudflare" has no host writer; the hosts are node, bun, deno, static',
      }),
    );
  });

  it("picks the declared host's writer for its own target and the target's writer otherwise", () => {
    const declared = { deploy: { host: "static" } };
    expect(buildWriter(declared, "static")).toBe(hostWriter("static"));
    expect(buildWriter(declared, "node")).toBe(hostWriter("node"));
    expect(buildWriter({}, "deno")).toBe(hostWriter("deno"));
    expect(buildWriter({}, "edge")).toBeNull();
    expect(() => buildWriter({ deploy: { host: "vercel" } }, "node")).toThrow(
      expect.objectContaining({ code: "REX605" }),
    );
  });
});
