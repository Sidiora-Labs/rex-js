import { readdirSync, statSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeDeclaration, makePage, MakeError, parseList } from "./commands/make.ts";
import { run, type RexCliIO } from "./index.ts";
import {
  actionTemplate,
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
} from "./templates.ts";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "rex-make-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function tree(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    const relative = prefix === "" ? name : `${prefix}/${name}`;
    if (statSync(path).isDirectory()) {
      const inner = tree(path, relative);
      found.push(...(inner.length === 0 ? [`${relative}/`] : inner));
    } else {
      found.push(relative);
    }
  }
  return found;
}

function io(): RexCliIO & { readonly output: string[]; readonly errors: string[] } {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    cwd: root,
    output,
    errors,
    out: (text) => {
      output.push(text);
    },
    err: (text) => {
      errors.push(text);
    },
  };
}

const read = (path: string) => readFile(join(root, path), "utf8");

const PAGE_FILES = [
  "app/pages/portfolio/hooks/",
  "app/pages/portfolio/overlays/HoldingsFilterSheet.tsx",
  "app/pages/portfolio/overlays/TokenSheet.tsx",
  "app/pages/portfolio/page.ts",
  "app/pages/portfolio/regions/hero/region.tsx",
  "app/pages/portfolio/regions/holdings/region.tsx",
  "app/pages/portfolio/states.tsx",
  "app/pages/portfolio/test/",
  "app/pages/portfolio/view.tsx",
];

describe("rex make page", () => {
  it("writes the full page folder and reports each written path", async () => {
    const cli = io();
    const code = await run(
      [
        "make",
        "page",
        "portfolio",
        "--regions",
        "hero,holdings",
        "--overlays",
        "HoldingsFilterSheet, TokenSheet",
      ],
      cli,
    );
    expect(cli.errors).toEqual([]);
    expect(code).toBe(0);
    expect(tree(root)).toEqual(PAGE_FILES);
    expect(cli.output).toEqual([
      "wrote app/pages/portfolio/page.ts\n",
      "wrote app/pages/portfolio/view.tsx\n",
      "wrote app/pages/portfolio/states.tsx\n",
      "wrote app/pages/portfolio/hooks/\n",
      "wrote app/pages/portfolio/regions/hero/region.tsx\n",
      "wrote app/pages/portfolio/regions/holdings/region.tsx\n",
      "wrote app/pages/portfolio/overlays/HoldingsFilterSheet.tsx\n",
      "wrote app/pages/portfolio/overlays/TokenSheet.tsx\n",
      "wrote app/pages/portfolio/test/\n",
    ]);
  });

  it("writes the page.ts declaration naming every region and overlay", async () => {
    await run(
      ["make", "page", "portfolio", "--regions", "hero,holdings", "--overlays", "TokenSheet"],
      io(),
    );
    expect(await read("app/pages/portfolio/page.ts")).toBe(
      [
        'import { page } from "@sidioralabs/rex";',
        "",
        'export default page("portfolio", {',
        '  route: "/portfolio",',
        '  regions: ["hero", "holdings"],',
        "  overlays: [",
        '    { id: "TokenSheet", dismiss: "both", binding: "region" },',
        "  ],",
        "});",
        "",
      ].join("\n"),
    );
    expect(await read("app/pages/portfolio/view.tsx")).toBe(
      viewTemplate({ page: "portfolio", regions: ["hero", "holdings"] }),
    );
    expect(await read("app/pages/portfolio/states.tsx")).toBe(
      statesTemplate({ page: "portfolio" }),
    );
    expect(await read("app/pages/portfolio/regions/hero/region.tsx")).toBe(
      regionTemplate({ page: "portfolio", name: "hero" }),
    );
    expect(await read("app/pages/portfolio/overlays/TokenSheet.tsx")).toBe(
      overlayTemplate({ page: "portfolio", name: "TokenSheet" }),
    );
  });

  it("writes a page without regions or overlays", async () => {
    expect(makePage(root, { id: "settings" })).toEqual([
      "app/pages/settings/page.ts",
      "app/pages/settings/view.tsx",
      "app/pages/settings/states.tsx",
      "app/pages/settings/hooks/",
      "app/pages/settings/test/",
    ]);
    expect(await read("app/pages/settings/page.ts")).toBe(pageTemplate({ id: "settings" }));
  });

  it("refuses to overwrite and writes nothing when any target exists", async () => {
    await run(["make", "page", "portfolio", "--regions", "hero"], io());
    await writeFile(join(root, "app/pages/portfolio/page.ts"), "// edited\n");
    const before = tree(root);

    const cli = io();
    const code = await run(
      ["make", "page", "portfolio", "--regions", "hero,holdings", "--overlays", "TokenSheet"],
      cli,
    );
    expect(code).toBe(1);
    expect(cli.output).toEqual([]);
    expect(cli.errors.join("")).toBe(
      [
        "rex make: refusing to overwrite existing files:",
        "  app/pages/portfolio/page.ts",
        "  app/pages/portfolio/view.tsx",
        "  app/pages/portfolio/states.tsx",
        "  app/pages/portfolio/regions/hero/region.tsx",
        "",
      ].join("\n"),
    );
    expect(tree(root)).toEqual(before);
    expect(await read("app/pages/portfolio/page.ts")).toBe("// edited\n");
  });

  it("rejects invalid names with a usage exit", async () => {
    const cli = io();
    expect(await run(["make", "page", "Portfolio"], cli)).toBe(2);
    expect(cli.errors.join("")).toContain('invalid page id "Portfolio"');
    expect(await run(["make", "page", "portfolio", "--overlays", "sheet"], io())).toBe(2);
    expect(tree(root)).toEqual([]);
  });
});

describe("rex make page files", () => {
  beforeEach(async () => {
    await run(["make", "page", "send", "--regions", "form"], io());
  });

  it("writes a region, part, overlay and hook at the conventional paths", async () => {
    const cli = io();
    expect(await run(["make", "region", "send", "confirm"], cli)).toBe(0);
    expect(await run(["make", "part", "send", "AmountField", "--region", "form"], cli)).toBe(0);
    expect(await run(["make", "overlay", "send", "TokenSelectorSheet"], cli)).toBe(0);
    expect(await run(["make", "hook", "send", "useSendDraft"], cli)).toBe(0);
    expect(cli.errors).toEqual([]);
    expect(cli.output).toEqual([
      "wrote app/pages/send/regions/confirm/region.tsx\n",
      "wrote app/pages/send/regions/form/parts/AmountField.tsx\n",
      "wrote app/pages/send/overlays/TokenSelectorSheet.tsx\n",
      "wrote app/pages/send/hooks/useSendDraft.ts\n",
    ]);
    expect(await read("app/pages/send/regions/confirm/region.tsx")).toBe(
      regionTemplate({ page: "send", name: "confirm" }),
    );
    expect(await read("app/pages/send/regions/form/parts/AmountField.tsx")).toBe(
      partTemplate({ name: "AmountField" }),
    );
    expect(await read("app/pages/send/overlays/TokenSelectorSheet.tsx")).toBe(
      overlayTemplate({ page: "send", name: "TokenSelectorSheet" }),
    );
    expect(await read("app/pages/send/hooks/useSendDraft.ts")).toBe(
      hookTemplate({ name: "useSendDraft" }),
    );
    expect(tree(root)).toEqual([
      "app/pages/send/hooks/useSendDraft.ts",
      "app/pages/send/overlays/TokenSelectorSheet.tsx",
      "app/pages/send/page.ts",
      "app/pages/send/regions/confirm/region.tsx",
      "app/pages/send/regions/form/parts/AmountField.tsx",
      "app/pages/send/regions/form/region.tsx",
      "app/pages/send/states.tsx",
      "app/pages/send/test/",
      "app/pages/send/view.tsx",
    ]);
  });

  it("refuses to overwrite an existing region, part, overlay or hook", async () => {
    await run(["make", "part", "send", "AmountField", "--region", "form"], io());
    await run(["make", "overlay", "send", "TokenSelectorSheet"], io());
    await run(["make", "hook", "send", "useSendDraft"], io());
    for (const args of [
      ["make", "region", "send", "form"],
      ["make", "part", "send", "AmountField", "--region", "form"],
      ["make", "overlay", "send", "TokenSelectorSheet"],
      ["make", "hook", "send", "useSendDraft"],
    ]) {
      const cli = io();
      expect(await run(args, cli), args.join(" ")).toBe(1);
      expect(cli.errors.join(""), args.join(" ")).toContain("refusing to overwrite");
    }
  });

  it("requires the owning page and region to exist", async () => {
    const missingPage = io();
    expect(await run(["make", "region", "portfolio", "hero"], missingPage)).toBe(1);
    expect(missingPage.errors.join("")).toContain(
      'page "portfolio" does not exist: app/pages/portfolio/page.ts is missing',
    );
    const missingRegion = io();
    expect(await run(["make", "part", "send", "Row", "--region", "list"], missingRegion)).toBe(1);
    expect(missingRegion.errors.join("")).toContain(
      'region "send/list" does not exist: app/pages/send/regions/list/region.tsx is missing',
    );
    expect(await run(["make", "part", "send", "Row"], io())).toBe(2);
    expect(await run(["make", "hook", "send", "draft"], io())).toBe(2);
  });
});

describe("rex make declarations", () => {
  it("writes action, entity, policy and flow skeletons", async () => {
    const cli = io();
    expect(await run(["make", "action", "pick-token"], cli)).toBe(0);
    expect(await run(["make", "entity", "token"], cli)).toBe(0);
    expect(await run(["make", "policy", "wallet"], cli)).toBe(0);
    expect(await run(["make", "flow", "large-send"], cli)).toBe(0);
    expect(cli.output).toEqual([
      "wrote app/actions/pick-token.ts\n",
      "wrote app/entities/token.ts\n",
      "wrote app/policies/wallet.ts\n",
      "wrote app/flows/large-send.ts\n",
    ]);
    expect(await read("app/actions/pick-token.ts")).toBe(actionTemplate({ name: "pick-token" }));
    expect(await read("app/entities/token.ts")).toBe(entityTemplate({ name: "token" }));
    expect(await read("app/policies/wallet.ts")).toBe(policyTemplate({ name: "wallet" }));
    expect(await read("app/flows/large-send.ts")).toBe(flowTemplate({ name: "large-send" }));
  });

  it("refuses to overwrite an existing declaration", async () => {
    makeDeclaration(root, "action", "send");
    await writeFile(join(root, "app/actions/send.ts"), "// handler filled in\n");
    expect(() => makeDeclaration(root, "action", "send")).toThrow(MakeError);
    const cli = io();
    expect(await run(["make", "action", "send"], cli)).toBe(1);
    expect(cli.errors.join("")).toBe(
      "rex make: refusing to overwrite existing files:\n  app/actions/send.ts\n",
    );
    expect(await read("app/actions/send.ts")).toBe("// handler filled in\n");
  });

  it("rejects an invalid declaration name", async () => {
    const cli = io();
    expect(await run(["make", "entity", "Token"], cli)).toBe(2);
    expect(cli.errors.join("")).toContain('invalid entity id "Token"');
    expect(tree(root)).toEqual([]);
  });

  it("parses comma-separated lists", () => {
    expect(parseList("a, b,,c ")).toEqual(["a", "b", "c"]);
    expect(parseList("")).toEqual([]);
  });
});
