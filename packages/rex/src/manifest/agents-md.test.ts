import { describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { action } from "../core/action.ts";
import { entity } from "../core/entity.ts";
import { page } from "../core/page.ts";
import {
  allOf,
  always,
  anyOf,
  can,
  never,
  policy,
  predicateToJson,
  requires,
} from "../core/policy.ts";
import { boolean, id, integer, money, ref, text } from "../schema/index.ts";
import {
  AGENTS_MD_BANNER,
  FOLDER_CONVENTION,
  describePredicate,
  renderAgentsMd,
} from "./agents-md.ts";
import { buildManifest, type ManifestSource } from "./build.ts";

const wallet = policy("wallet", {
  permissions: ["view", "send"],
  resolve: (actor) => (actor.roles.includes("owner") ? ["view", "send"] : ["view"]),
});

const account = entity("account", {
  fields: { id: id(), name: text({ min: 1 }), balance: money() },
  label: (record) => record.name,
});
const token = entity("token", {
  fields: {
    symbol: text({ min: 1 }),
    decimals: integer({ min: 0 }),
    account: ref(account),
    dust: boolean().optional(),
  },
  key: "symbol",
  label: (record) => record.symbol,
});

const send = action("send", {
  input: z.object({ to: ref(account), amount: money() }),
  output: z.object({ txId: text() }),
  policy: wallet.requires({ unlocked: true, permissions: ["send"] }),
  effect: "irreversible",
  label: "Send | now",
  shortcut: "mod+enter",
  invalidates: ["token", "account"],
  handler: () => ({ txId: "tx-1" }),
});
const pickToken = action("pick-token", {
  input: z.object({ symbol: text({ min: 1 }) }),
  output: z.object({ symbol: text() }),
  policy: always(),
  effect: "reversible",
  handler: (input) => input,
});

const portfolio = page("portfolio", { route: "/", regions: ["hero"] });
const sendPage = page("send", {
  route: "/send/:account",
  params: z.object({ account: text({ min: 1 }) }),
  policy: wallet.can("send"),
  actions: [send, pickToken],
  chrome: { back: "portfolio", nav: false, title: "Send\nfunds" },
  regions: ["form", "confirm"],
  overlays: [
    { id: "TokenSelectorSheet", dismiss: "both", binding: "url" },
    { id: "ContactPickerSheet", dismiss: "escape", binding: "region" },
  ],
  states: ["ready", "loading", "empty"],
});

const source: ManifestSource = {
  entities: [token, account],
  actions: [send, pickToken],
  pages: [sendPage, portfolio],
  policies: [wallet],
  flows: [
    {
      id: "payout",
      steps: [
        { kind: "action", action: pickToken },
        { kind: "approval", id: "review", label: "Review payout", approvers: wallet.can("send") },
      ],
    },
  ],
};

const EMPTY: ManifestSource = { entities: [], actions: [], pages: [], policies: [] };

describe("describePredicate", () => {
  it("spells the constant and permission predicates", () => {
    expect(describePredicate(predicateToJson(always()))).toBe("always");
    expect(describePredicate(predicateToJson(never()))).toBe("never");
    expect(describePredicate(predicateToJson(can("view")))).toBe("can(view)");
    expect(describePredicate(predicateToJson(wallet.can("send")))).toBe("wallet.can(send)");
  });

  it("lists every requires clause in declaration order", () => {
    expect(
      describePredicate(
        predicateToJson(
          requires({
            unlocked: true,
            account: true,
            custody: ["self", "shared"],
            permissions: ["view", "send"],
          }),
        ),
      ),
    ).toBe("requires(unlocked, account, custody self/shared, view + send)");
    expect(describePredicate(predicateToJson(wallet.requires({ permissions: ["send"] })))).toBe(
      "wallet.requires(send)",
    );
    expect(describePredicate(predicateToJson(requires({ custody: "self" })))).toBe(
      "requires(custody self)",
    );
  });

  it("nests combinations", () => {
    const combined = allOf(can("view"), anyOf(never(), wallet.requires({ unlocked: true })));
    expect(describePredicate(predicateToJson(combined))).toBe(
      "allOf(can(view), anyOf(never, wallet.requires(unlocked)))",
    );
  });
});

describe("renderAgentsMd", () => {
  const manifest = buildManifest(source, { app: "demo" });
  const text = renderAgentsMd(manifest);
  const lines = text.split("\n");

  it("opens with the generated banner and the app heading", () => {
    expect(lines[0]).toBe(AGENTS_MD_BANNER);
    expect(AGENTS_MD_BANNER.startsWith("<!-- GENERATED")).toBe(true);
    expect(lines[2]).toBe("# demo: agent guide");
    expect(lines).toContain("## Pages");
    expect(lines).toContain("## Actions");
    expect(lines).toContain("## Entities");
    expect(lines).toContain("## Policies");
    expect(lines).toContain("## Flows");
    expect(lines).toContain("## Folder convention");
    expect(text.endsWith("\n")).toBe(true);
  });

  it("tabulates pages with their chrome, regions, overlays, actions and state count", () => {
    expect(lines).toContain("| `portfolio` | `/` | Portfolio | always | hero | - | - | 9 |");
    expect(lines).toContain(
      "| `send` | `/send/:account` | Send funds | wallet.can(send) | form, confirm | ContactPickerSheet (escape), TokenSelectorSheet (both) | pick-token, send | 3 |",
    );
    const pagesAt = lines.indexOf("## Pages");
    expect(lines[pagesAt + 2]).toBe(
      "| Page | Route | Title | Policy | Regions | Overlays | Actions | States |",
    );
    expect(lines[pagesAt + 3]).toBe("| --- | --- | --- | --- | --- | --- | --- | --- |");
  });

  it("tabulates actions sorted by id and escapes pipes in labels", () => {
    expect(lines).toContain("| `pick-token` | - | reversible | - | always | - |");
    expect(lines).toContain(
      "| `send` | Send \\| now | irreversible | `mod+enter` | wallet.requires(unlocked, send) | account, token |",
    );
    expect(lines.indexOf("| `pick-token` | - | reversible | - | always | - |")).toBeLessThan(
      lines.findIndex((line) => line.startsWith("| `send` | Send")),
    );
    expect(lines).toContain(
      'Invoke an action by its control (`data-rex="<page>/<action>"`), its shortcut, the URL `<route>?act=<action>&input=<json>` or the command palette (mod+k). Irreversible actions ask for confirmation on every route.',
    );
  });

  it("tabulates entities, policies and flows", () => {
    expect(lines).toContain("| `account` | `id` | id: id, name: text, balance: money |");
    expect(lines).toContain(
      "| `token` | `symbol` | symbol: text, decimals: integer, account: ref, dust?: boolean |",
    );
    expect(lines).toContain("| `wallet` | view, send |");
    expect(lines).toContain(
      "| `payout` | action pick-token, approval review (Review payout; wallet.can(send)) |",
    );
  });

  it("closes with the folder convention and the DOM contract", () => {
    const conventionAt = lines.indexOf("## Folder convention");
    expect(FOLDER_CONVENTION.length).toBeGreaterThan(0);
    for (const [index, line] of FOLDER_CONVENTION.entries()) {
      expect(lines[conventionAt + 2 + index]).toBe(`- ${line}`);
    }
    expect(lines[conventionAt + 2 + FOLDER_CONVENTION.length + 1]).toBe(
      "Every page renders `data-rex-page`, every region `data-rex-region`, every overlay `data-rex-overlay`, and one `application/rex+json` sidecar script with id `rex-page`.",
    );
  });

  it("marks every empty section and escapes the app name", () => {
    const empty = renderAgentsMd(buildManifest(EMPTY, { app: "demo|v2" }));
    expect(empty.split("\n")[2]).toBe("# demo\\|v2: agent guide");
    expect(empty.split("\n").filter((line) => line === "_None._")).toHaveLength(10);
    expect(empty).not.toContain("| --- |");
    expect(renderAgentsMd(buildManifest(source, { app: "demo" }))).toBe(text);
  });
});

describe("renderAgentsMd 0.3 sections", () => {
  const listTokens = action("list-tokens", {
    input: z.object({}),
    output: z.object({ symbols: z.array(text()) }),
    policy: always(),
    effect: "read",
    http: { method: "GET", path: "/tokens.json" },
    handler: () => ({ symbols: [] }),
  });
  const feed = action("feed", {
    input: z.object({}),
    output: text(),
    policy: wallet.can("view"),
    effect: "read",
    http: { method: "GET", path: "/feed.xml", contentType: "application/rss+xml" },
    handler: () => "<rss/>",
  });
  const about = page("about", {
    route: "/about",
    render: "static",
    regions: ["copy", "filter"],
    islands: { copy: "visible", filter: "idle" },
  });
  const manifest = buildManifest(
    { entities: [], actions: [listTokens, feed], pages: [about], policies: [wallet] },
    {
      app: "docs",
      redirects: [
        { source: "/wallet", destination: "/about", status: 308 },
        { source: "/repo", destination: "https://github.com/Sidiora-Labs/rex-js", status: 302 },
      ],
      deploy: { host: "cloudflare", target: "edge", runtime: null },
      i18n: {
        locales: ["en", "ar"],
        default: "en",
        routing: "prefix",
        direction: { en: "ltr", ar: "rtl" },
      },
    },
  );
  const lines = renderAgentsMd(manifest).split("\n");

  it("lists the HTTP endpoints of read actions with their method, path and content type", () => {
    const at = lines.indexOf("## Endpoints");
    expect(lines[at + 2]).toBe("| Method | Path | Action | Content type | Policy |");
    expect(lines).toContain(
      "| GET | `/feed.xml` | `feed` | application/rss+xml | wallet.can(view) |",
    );
    expect(lines).toContain("| GET | `/tokens.json` | `list-tokens` | application/json | always |");
  });

  it("lists the islands of each page", () => {
    expect(lines).toContain("| `about` | `copy` | visible |");
    expect(lines).toContain("| `about` | `filter` | idle |");
  });

  it("lists the redirects, the locales and the deploy host", () => {
    expect(lines).toContain("| `/wallet` | `/about` | 308 |");
    expect(lines).toContain("| `/repo` | `https://github.com/Sidiora-Labs/rex-js` | 302 |");
    expect(lines).toContain("Routing: prefix. Switch with `?locale=<locale>`.");
    expect(lines).toContain("| `en` | yes | ltr |");
    expect(lines).toContain("| `ar` | no | rtl |");
    expect(lines).toContain("Host `cloudflare`, build target `edge`.");
    expect(lines.indexOf("## Deploy")).toBeLessThan(lines.indexOf("## Folder convention"));
  });
});
