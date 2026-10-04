import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { isRexError } from "../core/errors.ts";
import { rex } from "./plugin.ts";
import {
  CLIENT_MANIFEST_FILE,
  RexClientManifestError,
  readClientManifest,
  readSsrAssets,
  ssrAssetsFromManifest,
  type ViteManifest,
} from "./ssr-css.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "fixtures", "app");
const coreEntry = join(here, "..", "index.ts");
const alias = [{ find: /^@sidioralabs\/rex$/, replacement: coreEntry }];
const BUILD_TIMEOUT_MS = 120_000;
const ROOT = "/srv/site";

const MANIFEST: ViteManifest = {
  "index.html": {
    file: "assets/index-abc.js",
    src: "index.html",
    isEntry: true,
    imports: ["_shared-1.js", "_react-2.js"],
    css: ["assets/index-abc.css"],
    dynamicImports: ["app/pages/home/view.tsx", "app/pages/note/view.tsx"],
  },
  "_shared-1.js": {
    file: "assets/shared-1.js",
    imports: ["_react-2.js"],
    css: ["assets/shared-1.css"],
  },
  "_react-2.js": { file: "assets/react-2.js" },
  "app/pages/home/view.tsx": {
    file: "assets/page-home-3.js",
    src: "app/pages/home/view.tsx",
    name: "page-home",
    isDynamicEntry: true,
    imports: ["_shared-1.js", "_cards-4.js"],
    css: ["assets/page-home-3.css"],
  },
  "_cards-4.js": { file: "assets/cards-4.js", css: ["assets/cards-4.css"] },
  "app/pages/note/view.tsx": {
    file: "assets/page-note-5.js",
    src: "app/pages/note/view.tsx",
    name: "page-note",
    isDynamicEntry: true,
    imports: ["_react-2.js"],
  },
  "app/pages/note/regions/detail/region.tsx": {
    file: "assets/page-note-5.js",
    src: "app/pages/note/regions/detail/region.tsx",
    name: "page-note",
    css: ["assets/detail-7.css"],
  },
  "_page-admin-6.js": {
    file: "assets/page-admin-6.js",
    name: "page-admin",
    isDynamicEntry: true,
    css: ["assets/page-admin-6.css"],
  },
  "site/pages/extra/view.tsx": { file: "assets/extra-8.js", src: "site/pages/extra/view.tsx" },
};

const dirs: string[] = [];

afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

function clientDir(manifest: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), "rex-ssr-css-"));
  dirs.push(dir);
  if (manifest !== null) {
    const file = join(dir, CLIENT_MANIFEST_FILE);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, manifest);
  }
  return dir;
}

function caught(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw");
}

describe("ssrAssetsFromManifest", () => {
  it("collects the entry script, its stylesheets and preloads and every page's own files", () => {
    const assets = ssrAssetsFromManifest(MANIFEST, { root: ROOT });
    expect(assets.scripts).toEqual(["/assets/index-abc.js"]);
    expect(assets.stylesheets).toEqual(["/assets/index-abc.css", "/assets/shared-1.css"]);
    expect(assets.preloads).toEqual(["/assets/react-2.js", "/assets/shared-1.js"]);
    expect(assets.head).toBeUndefined();
    expect(Object.keys(assets.pages)).toEqual(["admin", "home", "note"]);
    expect(assets.pages.home).toEqual({
      stylesheets: ["/assets/cards-4.css", "/assets/page-home-3.css"],
      preloads: ["/assets/cards-4.js", "/assets/page-home-3.js"],
    });
    expect(assets.pages.note).toEqual({
      stylesheets: ["/assets/detail-7.css"],
      preloads: ["/assets/page-note-5.js"],
    });
    expect(assets.pages.admin).toEqual({
      stylesheets: ["/assets/page-admin-6.css"],
      preloads: ["/assets/page-admin-6.js"],
    });
    expect(Object.isFrozen(assets)).toBe(true);
    expect(Object.isFrozen(assets.pages)).toBe(true);
    expect(Object.isFrozen(assets.pages.home)).toBe(true);
    expect(Object.isFrozen(assets.pages.home?.preloads)).toBe(true);
  });

  it("prefixes every file with the base and reads page folders from the configured app dir", () => {
    const assets = ssrAssetsFromManifest(MANIFEST, {
      root: ROOT,
      base: "/static/",
      appDir: "site",
    });
    expect(assets.scripts).toEqual(["/static/assets/index-abc.js"]);
    expect(assets.stylesheets).toEqual([
      "/static/assets/index-abc.css",
      "/static/assets/shared-1.css",
    ]);
    expect(Object.keys(assets.pages)).toEqual(["admin", "extra", "home", "note"]);
    expect(assets.pages.extra).toEqual({
      stylesheets: [],
      preloads: ["/static/assets/extra-8.js"],
    });
    expect(assets.pages.home?.preloads).toEqual([
      "/static/assets/cards-4.js",
      "/static/assets/page-home-3.js",
    ]);
    const plain = ssrAssetsFromManifest(MANIFEST, { root: ROOT });
    expect(plain.pages.extra).toBeUndefined();
  });

  it("never treats the entry chunk as a page", () => {
    const assets = ssrAssetsFromManifest(
      {
        "app/pages/home/view.tsx": {
          file: "assets/page-home.js",
          src: "app/pages/home/view.tsx",
          name: "page-home",
          isEntry: true,
          css: ["assets/page-home.css"],
        },
      },
      { root: ROOT },
    );
    expect(assets.scripts).toEqual(["/assets/page-home.js"]);
    expect(assets.stylesheets).toEqual(["/assets/page-home.css"]);
    expect(assets.preloads).toEqual([]);
    expect(assets.pages).toEqual({});
  });

  it("fails with REX461 unless exactly one entry chunk exists", () => {
    const none = caught(() =>
      ssrAssetsFromManifest({ "_a.js": { file: "assets/a.js" } }, { root: ROOT }),
    );
    expect(none).toBeInstanceOf(RexClientManifestError);
    expect(isRexError(none)).toBe(true);
    expect((none as RexClientManifestError).code).toBe("REX461");
    expect((none as RexClientManifestError).name).toBe("RexClientManifestError");
    expect((none as RexClientManifestError).message).toBe(
      "REX461 rex client manifest: expected one entry chunk, found 0",
    );
    const two = caught(() =>
      ssrAssetsFromManifest(
        {
          "a.html": { file: "assets/a.js", isEntry: true },
          "b.html": { file: "assets/b.js", isEntry: true },
        },
        { root: ROOT },
      ),
    );
    expect((two as RexClientManifestError).message).toBe(
      "REX461 rex client manifest: expected one entry chunk, found 2",
    );
  });
});

describe("readClientManifest", () => {
  it("parses .vite/manifest.json from the client output directory", () => {
    const dir = clientDir(JSON.stringify(MANIFEST));
    expect(CLIENT_MANIFEST_FILE).toBe(".vite/manifest.json");
    expect(readClientManifest(dir)).toEqual(MANIFEST);
    expect(readSsrAssets(dir, { root: ROOT, base: "/cdn/" })).toEqual(
      ssrAssetsFromManifest(MANIFEST, { root: ROOT, base: "/cdn/" }),
    );
  });

  it("fails with REX461 when the manifest is missing, unparsable or not an object", () => {
    const missing = caught(() => readClientManifest(clientDir(null))) as RexClientManifestError;
    expect(isRexError(missing)).toBe(true);
    expect(missing.code).toBe("REX461");
    expect(missing.message).toContain("rex client manifest: cannot read ");
    expect(missing.message).toContain(CLIENT_MANIFEST_FILE);

    const broken = caught(() => readClientManifest(clientDir("{"))) as RexClientManifestError;
    expect(broken.code).toBe("REX461");
    expect(broken.message).toContain("cannot read ");

    const list = caught(() => readClientManifest(clientDir("[]"))) as RexClientManifestError;
    expect(list.code).toBe("REX461");
    expect(list.message).toContain("is not a Vite manifest object");
    expect(
      (caught(() => readClientManifest(clientDir("null"))) as RexClientManifestError).code,
    ).toBe("REX461");
  });
});

describe("the fixture client build", { timeout: BUILD_TIMEOUT_MS }, () => {
  it("yields a manifest whose assets name the entry script, its stylesheet and each page chunk", async () => {
    const result = await build({
      root: fixtureRoot,
      configFile: false,
      logLevel: "silent",
      resolve: { alias },
      plugins: rex({ name: "fixture", compiler: false }),
      build: {
        write: false,
        manifest: true,
        rolldownOptions: { external: [/^react(\/.*)?$/, /^react-dom(\/.*)?$/] },
      },
    });
    const outputs = Array.isArray(result) ? result : [result];
    const items = outputs.flatMap((output) => ("output" in output ? output.output : []));
    const manifestAsset = items.find(
      (item) => item.type === "asset" && item.fileName === CLIENT_MANIFEST_FILE,
    );
    expect(manifestAsset).toBeDefined();
    const manifest = JSON.parse(
      manifestAsset?.type === "asset" ? String(manifestAsset.source) : "",
    ) as ViteManifest;
    const assets = ssrAssetsFromManifest(manifest, { root: fixtureRoot });
    const entry = items.find((item) => item.type === "chunk" && item.isEntry);
    expect(assets.scripts).toEqual([`/${entry?.fileName ?? ""}`]);
    expect(assets.stylesheets.length).toBeGreaterThan(0);
    for (const sheet of assets.stylesheets) expect(sheet).toMatch(/^\/assets\/.*\.css$/);
    expect(Object.keys(assets.pages)).toEqual(["home", "note"]);
    for (const id of ["home", "note"]) {
      const page = assets.pages[id];
      expect(
        page?.preloads.some((file) => file.includes(`page-${id}`)),
        id,
      ).toBe(true);
      for (const file of [...(page?.preloads ?? []), ...(page?.stylesheets ?? [])]) {
        expect(assets.scripts).not.toContain(file);
        expect(assets.preloads).not.toContain(file);
        expect(assets.stylesheets).not.toContain(file);
      }
    }
  });
});
