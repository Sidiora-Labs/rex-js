import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";
import * as media from "../media.tsx";
import * as entry from "./index.ts";

type Namespace = Readonly<Record<string, unknown>>;

const source = media as Namespace;
const exported = entry as Namespace;

describe("client/media entry", () => {
  it("re-exports every media binding by identity", () => {
    expect(entry.Img).toBe(media.Img);
    expect(entry.Script).toBe(media.Script);
    expect(entry.MediaProvider).toBe(media.MediaProvider);
    expect(entry.createMediaCollector).toBe(media.createMediaCollector);
    expect(entry.loadScript).toBe(media.loadScript);
    expect(entry.SCRIPT_ATTRIBUTE).toBe(media.SCRIPT_ATTRIBUTE);
    expect(entry.SCRIPT_STRATEGIES).toBe(media.SCRIPT_STRATEGIES);
    expect(entry.DEFAULT_SCRIPT_STRATEGY).toBe(media.DEFAULT_SCRIPT_STRATEGY);
    expect(entry.IDLE_FALLBACK_MS).toBe(media.IDLE_FALLBACK_MS);
    for (const name of Object.keys(source)) {
      expect(exported[name], name).toBe(source[name]);
    }
    expectTypeOf<entry.ImgProps>().toEqualTypeOf<media.ImgProps>();
    expectTypeOf<entry.ScriptProps>().toEqualTypeOf<media.ScriptProps>();
    expectTypeOf<entry.ScriptStrategy>().toEqualTypeOf<media.ScriptStrategy>();
    expectTypeOf<entry.PriorityImage>().toEqualTypeOf<media.PriorityImage>();
    expectTypeOf<entry.RexMediaCollector>().toEqualTypeOf<media.RexMediaCollector>();
    expectTypeOf<entry.RexMediaRequest>().toEqualTypeOf<media.RexMediaRequest>();
    expectTypeOf<entry.MediaProviderProps>().toEqualTypeOf<media.MediaProviderProps>();
    expectTypeOf<entry.LoadScriptOptions>().toEqualTypeOf<media.LoadScriptOptions>();
  });

  it("exports exactly the media module's bindings", () => {
    expect(Object.keys(exported).sort()).toEqual(Object.keys(source).sort());
    expect(Object.keys(exported).sort()).toEqual([
      "DEFAULT_SCRIPT_STRATEGY",
      "IDLE_FALLBACK_MS",
      "Img",
      "MediaProvider",
      "SCRIPT_ATTRIBUTE",
      "SCRIPT_STRATEGIES",
      "Script",
      "createMediaCollector",
      "loadScript",
    ]);
  });

  it("is the module behind the @sidioralabs/rex/client/media export", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const manifest = JSON.parse(readFileSync(join(here, "../../../package.json"), "utf8")) as {
      readonly exports: Readonly<Record<string, string>>;
    };
    expect(manifest.exports["./client/media"]).toBe("./src/client/media/index.ts");
  });
});
