import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { errorDocs } from "../../core/errors.ts";
import { rexPrettierConfig } from "../../prettier.ts";
import { MEDIA_IMPORT } from "../templates.ts";
import { CODEMOD_ID, formatFlag } from "./codemod.ts";
import {
  IMG_COMPONENT,
  PLACEHOLDER_MARKER,
  PLACEHOLDER_SIZE,
  PRINT_WIDTH,
  codemod,
  convertRawImg,
  placeholderFlags,
} from "./0.1-raw-img.ts";

const here = dirname(fileURLToPath(import.meta.url));
const mediaFail = join(here, "..", "..", "check", "fixtures", "media", "fail");
const IMG_LINE = `import { Img } from ${JSON.stringify(MEDIA_IMPORT)};`;
const GRID = "app/pages/gallery/regions/grid/region.tsx";
const HERO = "app/pages/gallery/regions/hero/region.tsx";
const TILE = "app/pages/gallery/regions/grid/parts/Tile.tsx";

const MIGRATED_GRID = [
  'import Tile from "./parts/Tile.tsx";',
  IMG_LINE,
  "",
  "export default function GridRegion() {",
  "  return (",
  "    <section>",
  "      <Img",
  '        src="/images/cover.avif"',
  '        alt="Gallery cover"',
  "        width={1 /* REX610 placeholder */}",
  "        height={1 /* REX610 placeholder */}",
  "      />",
  '      <Tile src="/images/one.avif" label="One" />',
  "    </section>",
  "  );",
  "}",
  "",
].join("\n");

const MIGRATED_HERO = [
  IMG_LINE,
  "",
  "export default function HeroRegion() {",
  "  return (",
  "    <figure>",
  "      <Img",
  '        src="/images/hero.avif"',
  '        alt="Hero"',
  "        width={1 /* REX610 placeholder */}",
  "        height={1 /* REX610 placeholder */}",
  "      >",
  "      </Img>",
  "    </figure>",
  "  );",
  "}",
  "",
].join("\n");

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function copyMediaFail(): string {
  const root = mkdtempSync(join(tmpdir(), "rex-raw-img-"));
  temporary.push(root);
  cpSync(mediaFail, root, { recursive: true });
  return root;
}

function fixtureText(file: string): string {
  return readFileSync(join(mediaFail, file), "utf8");
}

describe("0.1-raw-img codemod", () => {
  it("declares its id, version and description and exposes the placeholder constants", () => {
    expect(codemod.id).toBe("0.1-raw-img");
    expect(codemod.from).toBe("0.1");
    expect(CODEMOD_ID.test(codemod.id)).toBe(true);
    expect(codemod.description).toContain("REX610");
    expect(Object.isFrozen(codemod)).toBe(true);
    expect(IMG_COMPONENT).toBe("Img");
    expect(PLACEHOLDER_MARKER).toBe("REX610 placeholder");
    expect(PLACEHOLDER_SIZE).toBe(1);
    expect(PRINT_WIDTH).toBe(rexPrettierConfig.printWidth);
  });

  it("returns no changes and no flags for a root without an app directory", () => {
    const root = mkdtempSync(join(tmpdir(), "rex-raw-img-empty-"));
    temporary.push(root);
    expect(codemod.run(root)).toEqual({ changes: [], flags: [] });
  });

  it("converts regions and parts only, flagging placeholders and createElement sites", () => {
    const root = copyMediaFail();
    const result = codemod.run(root);
    expect(result.changes).toEqual([
      { file: GRID, text: MIGRATED_GRID },
      { file: HERO, text: MIGRATED_HERO },
    ]);
    expect(result.flags).toEqual([
      {
        code: "REX610",
        file: TILE,
        line: 4,
        column: 10,
        message: `createElement("img") was not converted; render Img from ${MEDIA_IMPORT} with width and height`,
      },
      {
        code: "REX610",
        file: GRID,
        line: 7,
        column: 7,
        message: "Img width, height are placeholders; set the real values",
      },
      {
        code: "REX610",
        file: HERO,
        line: 6,
        column: 7,
        message: "Img width, height are placeholders; set the real values",
      },
    ]);
    expect(formatFlag(result.flags[0] as (typeof result.flags)[number])).toBe(
      `REX610 ${TILE}:4:10 createElement("img") was not converted; render Img from ${MEDIA_IMPORT} with width and height (${errorDocs("REX610")})`,
    );
    for (const file of [GRID, HERO, TILE, "app/components/Logo.tsx"]) {
      expect(readFileSync(join(root, file), "utf8"), file).toBe(fixtureText(file));
    }
  });
});

describe("convertRawImg", () => {
  it("renames a paired img and its closing tag and breaks long elements across lines", () => {
    expect(convertRawImg(HERO, fixtureText(HERO))).toBe(MIGRATED_HERO);
    expect(convertRawImg(GRID, fixtureText(GRID))).toBe(MIGRATED_GRID);
    expect(convertRawImg(HERO, MIGRATED_HERO)).toBeNull();
    expect(convertRawImg(GRID, MIGRATED_GRID)).toBeNull();
  });

  it("extends an existing media import and keeps an element that already fits in place", () => {
    const text = [
      `import { Script } from ${JSON.stringify(MEDIA_IMPORT)};`,
      "",
      "export default function Avatar() {",
      '  return <img src="/a.png" alt="A" width={4} height={4} />;',
      "}",
      "",
    ].join("\n");
    expect(convertRawImg("Avatar.tsx", text)).toBe(
      [
        `import { Script, Img } from ${JSON.stringify(MEDIA_IMPORT)};`,
        "",
        "export default function Avatar() {",
        '  return <Img src="/a.png" alt="A" width={4} height={4} />;',
        "}",
        "",
      ].join("\n"),
    );
  });

  it("leaves non-numeric width and height strings as they are", () => {
    const text = [
      "export default function Banner() {",
      '  return <img src="/b.png" alt="B" width="100%" height="auto" />;',
      "}",
      "",
    ].join("\n");
    expect(convertRawImg("Banner.tsx", text)).toBe(
      [
        IMG_LINE,
        "",
        "export default function Banner() {",
        '  return <Img src="/b.png" alt="B" width="100%" height="auto" />;',
        "}",
        "",
      ].join("\n"),
    );
  });

  it("returns null when the only raw img is a createElement call", () => {
    expect(convertRawImg(TILE, fixtureText(TILE))).toBeNull();
    expect(
      convertRawImg("Plain.tsx", "export default function Plain() {\n  return null;\n}\n"),
    ).toBeNull();
  });
});

describe("placeholderFlags", () => {
  it("names a single placeholder attribute in the singular", () => {
    const text = [
      IMG_LINE,
      "",
      "export default function Logo() {",
      '  return <Img src="/logo.svg" alt={"" /* REX610 placeholder */} width={32} height={32} />;',
      "}",
      "",
    ].join("\n");
    expect(placeholderFlags("/abs/Logo.tsx", "app/components/Logo.tsx", text)).toEqual([
      {
        code: "REX610",
        file: "app/components/Logo.tsx",
        line: 4,
        column: 10,
        message: "Img alt is a placeholder; set the real value",
      },
    ]);
  });

  it("flags createElement sites and nothing in a converted file", () => {
    expect(placeholderFlags(join(mediaFail, TILE), TILE, fixtureText(TILE))).toEqual([
      {
        code: "REX610",
        file: TILE,
        line: 4,
        column: 10,
        message: `createElement("img") was not converted; render Img from ${MEDIA_IMPORT} with width and height`,
      },
    ]);
    const clean = [
      IMG_LINE,
      "",
      "export default function Logo() {",
      '  return <Img src="/logo.svg" alt="Sidiora" width={32} height={32} />;',
      "}",
      "",
    ].join("\n");
    expect(placeholderFlags("/abs/Logo.tsx", "app/components/Logo.tsx", clean)).toEqual([]);
  });
});
