import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono/tiny";
import { describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { action } from "../../core/action.ts";
import { actor, anonymousActor } from "../../core/actor.ts";
import { RexError } from "../../core/errors.ts";
import { page } from "../../core/page.ts";
import { always, never } from "../../core/policy.ts";
import { REX_RPC_PREFIX } from "../../core/protocol.ts";
import { buildManifest, stableStringify } from "../../manifest/build.ts";
import { sidecarSchema } from "../../manifest/sidecar.schema.ts";
import { text } from "../../schema/index.ts";
import { createRexServer, type RexServerSetup } from "../app.ts";
import { memoryLedger } from "../audit.ts";
import { CONFIRM_FIELD, CSRF_COOKIE, CSRF_FIELD, formPath } from "../form.ts";
import {
  MARKDOWN_CONTENT_TYPE as EXPORTED_MARKDOWN_CONTENT_TYPE,
  PAGES_TEXT_STATUS as EXPORTED_PAGES_TEXT_STATUS,
  installPagesTextRoute as exportedInstallPagesTextRoute,
  pageTextPath as exportedPageTextPath,
  renderPageText as exportedRenderPageText,
} from "../index.ts";
import { buildActionRouter } from "../router.ts";
import { REX_ROUTES } from "../routes.ts";
import { RENDER_PAGE_HEADER } from "./render.ts";
import {
  MARKDOWN_CONTENT_TYPE,
  PAGES_TEXT_EXTENSION,
  PAGES_TEXT_PREFIX,
  PAGES_TEXT_ROUTE,
  PAGES_TEXT_STATUS,
  installPagesTextRoute,
  pageTextPath,
  renderPageText,
} from "./pages-text.ts";

const APP = "pages-text-route";

const listNotes = action("list-notes", {
  input: z.object({}),
  output: z.object({ items: z.array(z.object({ id: text(), title: text() })) }),
  policy: always(),
  effect: "read",
  label: "List notes",
  handler: () => ({ items: [{ id: "n1", title: "First" }] }),
});

const addNote = action("add-note", {
  input: z.object({ title: text({ min: 1 }), tags: z.optional(text()) }),
  output: z.object({ id: text() }),
  policy: always(),
  effect: "reversible",
  label: "Add | note",
  handler: (input) => ({ id: input.title }),
});

const purgeNotes = action("purge-notes", {
  input: z.object({}),
  output: z.object({}),
  policy: never(),
  effect: "irreversible",
  label: "Purge notes",
  handler: () => ({}),
});

const notes = page("notes", {
  route: "/notes",
  actions: [addNote, purgeNotes],
  regions: ["list", "composer"],
  overlays: [{ id: "FilterSheet", dismiss: "both", binding: "url" }],
  load: { notes: listNotes },
  chrome: { title: "Notes" },
});

const note = page("note", {
  route: "/notes/:id",
  params: z.object({ id: text({ min: 1 }) }),
  actions: [addNote],
  regions: ["body"],
  chrome: { title: "Note" },
});

const about = page("about", { route: "/about", regions: ["copy"], chrome: { title: "About" } });

const registry = {
  entities: [],
  actions: [listNotes, addNote, purgeNotes],
  pages: [notes, note, about],
  policies: [],
};
const manifest = buildManifest(registry, { app: APP });
const carol = actor({ id: "carol" });

function setupFor(): RexServerSetup {
  const ledger = memoryLedger();
  return {
    options: { registry, ledger, actor: () => carol, app: APP, manifest },
    handler: new RPCHandler(buildActionRouter(registry, { ledger })),
    manifestBody: stableStringify(manifest),
  };
}

function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(`## ${heading}\n`);
  if (start === -1) throw new Error(`the page text has no ${heading} section`);
  const next = markdown.indexOf("\n## ", start + 1);
  return markdown.slice(start, next === -1 ? undefined : next);
}

describe("pageTextPath", () => {
  it("builds the markdown path for a page id under the pages prefix", () => {
    expect(PAGES_TEXT_PREFIX).toBe("/rex/pages");
    expect(PAGES_TEXT_EXTENSION).toBe(".md");
    expect(PAGES_TEXT_ROUTE).toBe("/rex/pages/:file");
    expect(pageTextPath("notes")).toBe("/rex/pages/notes.md");
    expect(pageTextPath("note-v2")).toBe("/rex/pages/note-v2.md");
    expect(pageTextPath("a b/c")).toBe("/rex/pages/a%20b%2Fc.md");
    expect(PAGES_TEXT_STATUS).toEqual({ page: 200, denied: 403, "not-found": 404 });
    expect(Object.isFrozen(PAGES_TEXT_STATUS)).toBe(true);
    expect(MARKDOWN_CONTENT_TYPE).toBe("text/markdown; charset=utf-8");
    expect(exportedPageTextPath).toBe(pageTextPath);
    expect(exportedRenderPageText).toBe(renderPageText);
    expect(exportedInstallPagesTextRoute).toBe(installPagesTextRoute);
    expect(EXPORTED_PAGES_TEXT_STATUS).toBe(PAGES_TEXT_STATUS);
    expect(EXPORTED_MARKDOWN_CONTENT_TYPE).toBe(MARKDOWN_CONTENT_TYPE);
    expect(REX_ROUTES.at(-1)).toBe(installPagesTextRoute);
  });
});

describe("renderPageText", () => {
  it("discovers browser controls without inventing RPC, URL or form execution", () => {
    const browser = page("browser", {
      route: "/browser",
      affordances: [
        { id: "copy", label: "Copy", effect: "read", input: {}, via: ["click", "palette"] },
      ],
    });
    const result = renderPageText({
      manifest: buildManifest({ ...registry, pages: [browser] }),
      page: browser,
      params: {},
      issues: [],
      href: "/browser",
      actor: carol,
      policy: { allowed: true, reason: null },
      state: "ready",
    });
    expect(result.sidecar).toMatchObject({
      state: "loading",
      actions: [
        {
          id: "copy",
          allowed: false,
          reason: "Requires an active browser control",
          via: ["click", "palette"],
        },
      ],
    });
    expect(result.markdown).toContain('[data-rex="browser/copy"]');
    expect(result.markdown).toContain("| State | `loading` |");
    expect(result.markdown).not.toContain("act=copy");
    expect(result.markdown).not.toContain("/rex/form/copy");
    expect(result.markdown).not.toContain("/rex/rpc/copy");
    expect(result.markdown).toContain("no server form or RPC handler");
  });
  it("writes the summary, regions, actions and overlays as tables with a sidecar that parses back", () => {
    const rendered = renderPageText({
      manifest,
      page: notes,
      params: {},
      issues: [],
      href: "/notes?view=all",
      actor: carol,
      policy: { allowed: true, reason: null },
      state: "ready",
    });
    const { markdown } = rendered;
    expect(markdown.startsWith("# Notes\n\n| Field | Value |\n| --- | --- |\n")).toBe(true);
    expect(markdown).toContain("| Page | `notes` |");
    expect(markdown).toContain("| Route | `/notes` |");
    expect(markdown).toContain("| URL | `/notes?view=all` |");
    expect(markdown).toContain("| Render | ssr |");
    expect(markdown).toContain("| Actor | `carol` |");
    expect(markdown).toContain("| State | `ready` |");
    expect(markdown).toContain("| Access | allowed |");
    expect(markdown).not.toContain("## Param issues");
    expect(section(markdown, "Regions")).toContain(
      '| `list` | `[data-rex-region="notes/list"]` |\n| `composer` | `[data-rex-region="notes/composer"]` |',
    );
    expect(section(markdown, "Actions")).toContain(
      `| \`add-note\` | Add \\| note | reversible | yes | \`[data-rex="notes/add-note"]\` | \`title\`, \`tags\` | \`GET /notes?view=all&act=add-note&input=<json>\` | \`POST ${formPath("add-note")}\` |`,
    );
    expect(section(markdown, "Actions")).toContain(
      '| `purge-notes` | Purge notes | irreversible | no: never | `[data-rex="notes/purge-notes"]` | - | `GET /notes?view=all&act=purge-notes&input=<json>` | `POST /rex/form/purge-notes` |',
    );
    expect(section(markdown, "Actions")).toContain(`\`POST ${REX_RPC_PREFIX}/<action>\``);
    expect(section(markdown, "Actions")).toContain(
      `\`${CSRF_FIELD}\` matching the \`${CSRF_COOKIE}\` cookie`,
    );
    expect(section(markdown, "Actions")).toContain(`carries \`${CONFIRM_FIELD}\``);
    expect(section(markdown, "Overlays")).toContain(
      '| `FilterSheet` | `[data-rex-overlay="notes/FilterSheet"]` | `[data-rex-overlay-trigger="notes/FilterSheet"]` | both | url | no |',
    );
    const fenced = /## Sidecar\n\n```json\n([\s\S]*?)\n```\n$/.exec(markdown);
    expect(fenced).not.toBeNull();
    const parsed = sidecarSchema.safeParse(JSON.parse(fenced?.[1] as string));
    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data : null).toEqual(rendered.sidecar);
    expect(rendered.sidecar).toMatchObject({ page: "notes", state: "ready", params: {} });
    expect(rendered.sidecar.actions.map((entry) => [entry.id, entry.allowed])).toEqual([
      ["add-note", true],
      ["purge-notes", false],
    ]);
    expect(rendered.sidecar.overlays.map((entry) => entry.id)).toEqual(["FilterSheet"]);
  });

  it("lists param issues, a denied access and resolves the title and labels through the text resolver", () => {
    const rendered = renderPageText({
      manifest,
      page: note,
      params: {},
      issues: [{ path: "id", message: "is required" }],
      href: null,
      actor: anonymousActor,
      policy: { allowed: false, reason: "never" },
      state: "terminal-error",
      text: (value) => value.toUpperCase(),
    });
    const { markdown } = rendered;
    expect(markdown.startsWith("# NOTE\n")).toBe(true);
    expect(markdown).toContain("| Route | `/notes/:id` |");
    expect(markdown).toContain("| URL | - |");
    expect(markdown).toContain("| Actor | `anonymous` |");
    expect(markdown).toContain("| State | `terminal-error` |");
    expect(markdown).toContain("| Access | denied: never |");
    expect(section(markdown, "Param issues")).toBe(
      "## Param issues\n\n| Param | Problem |\n| --- | --- |\n| `id` | is required |\n",
    );
    expect(section(markdown, "Regions")).toContain('| `body` | `[data-rex-region="note/body"]` |');
    expect(section(markdown, "Actions")).toContain(
      '| `add-note` | ADD \\| NOTE | reversible | yes | `[data-rex="note/add-note"]` | `title`, `tags` | - | `POST /rex/form/add-note` |',
    );
    expect(section(markdown, "Overlays")).toBe("## Overlays\n\n_None._\n");
    expect(rendered.sidecar.state).toBe("terminal-error");
    expect(rendered.sidecar.actions.map((entry) => entry.label)).toEqual(["ADD | NOTE"]);
  });

  it("refuses a page the manifest does not list", () => {
    const partial = buildManifest({ ...registry, pages: [about] }, { app: APP });
    expect(() =>
      renderPageText({
        manifest: partial,
        page: notes,
        params: {},
        issues: [],
        href: "/notes",
        actor: carol,
        policy: { allowed: true, reason: null },
        state: "ready",
      }),
    ).toThrow(expect.objectContaining({ name: "RexError", code: "REX308" }));
  });
});

describe("installPagesTextRoute", () => {
  it("renders a page without loaders on a bare Hono app and leaves other files to the next handler", async () => {
    const app = new Hono();
    installPagesTextRoute(app, setupFor());
    app.get(PAGES_TEXT_ROUTE, (c) => c.text(`next: ${c.req.param("file")}`));
    const response = await app.request(pageTextPath("about"));
    expect(response.status).toBe(PAGES_TEXT_STATUS.page);
    expect(response.headers.get("content-type")).toBe(MARKDOWN_CONTENT_TYPE);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get(RENDER_PAGE_HEADER)).toBe("about");
    const body = await response.text();
    expect(body.startsWith("# About\n")).toBe(true);
    expect(body).toContain("| URL | `/about` |");
    expect(body).toContain("| Actor | `carol` |");
    expect(body).toContain("| State | `ready` |");
    expect(section(body, "Regions")).toContain('| `copy` | `[data-rex-region="about/copy"]` |');
    expect(section(body, "Actions")).toContain("_None._");
    const other = await app.request("/rex/pages/about.json");
    expect(other.status).toBe(200);
    expect(await other.text()).toBe("next: about.json");
    const missing = await app.request(pageTextPath("nope"));
    expect(missing.status).toBe(PAGES_TEXT_STATUS["not-found"]);
    expect(missing.headers.get("content-type")).toBe(MARKDOWN_CONTENT_TYPE);
    expect(missing.headers.has(RENDER_PAGE_HEADER)).toBe(false);
    const text = await missing.text();
    expect(text.startsWith("# Page not found\n")).toBe(true);
    expect(text).toContain("No page has id `nope`.");
    expect(text).toContain(
      "| `about` | `/rex/pages/about.md` |\n| `note` | `/rex/pages/note.md` |\n| `notes` | `/rex/pages/notes.md` |",
    );
  });

  it("needs the loader runner createRexServer binds for a page with loaders", async () => {
    const bare = new Hono();
    installPagesTextRoute(bare, setupFor());
    const errors: unknown[] = [];
    bare.onError((error, c) => {
      errors.push(error);
      return c.text("failed", 500);
    });
    const response = await bare.request(pageTextPath("notes"));
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("failed");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(RexError);
    expect((errors[0] as RexError).code).toBe("REX408");
    expect((errors[0] as RexError).message).toContain('page "notes" declares loaders');
    const server = createRexServer({
      registry,
      ledger: memoryLedger(),
      actor: () => carol,
      app: APP,
    });
    const served = await server.request(pageTextPath("notes"));
    expect(served.status).toBe(PAGES_TEXT_STATUS.page);
    expect(served.headers.get(RENDER_PAGE_HEADER)).toBe("notes");
    expect(await served.text()).toContain("| State | `ready` |");
  });

  it("answers a page whose policy refuses the actor with 403 markdown and keeps route params from the query", async () => {
    const admin = page("admin", { route: "/admin", policy: never(), chrome: { title: "Admin" } });
    const source = { ...registry, pages: [...registry.pages, admin] };
    const server = createRexServer({
      registry: source,
      ledger: memoryLedger(),
      actor: () => carol,
      app: APP,
    });
    const denied = await server.request(pageTextPath("admin"));
    expect(denied.status).toBe(PAGES_TEXT_STATUS.denied);
    expect(denied.headers.get("content-type")).toBe(MARKDOWN_CONTENT_TYPE);
    expect(denied.headers.get(RENDER_PAGE_HEADER)).toBe("admin");
    const deniedText = await denied.text();
    expect(deniedText).toContain("| Access | denied: never |");
    expect(deniedText).toContain("| State | `permission-denied` |");
    const routed = await server.request(`${pageTextPath("note")}?id=n2`);
    expect(routed.status).toBe(PAGES_TEXT_STATUS.page);
    const routedText = await routed.text();
    expect(routedText).toContain("| URL | `/notes/n2` |");
    expect(routedText).toContain("`GET /notes/n2?act=add-note&input=<json>`");
    const unrouted = await server.request(pageTextPath("note"));
    expect(unrouted.status).toBe(PAGES_TEXT_STATUS.page);
    const unroutedText = await unrouted.text();
    expect(unroutedText).toContain("| URL | - |");
    expect(unroutedText).toContain("| State | `terminal-error` |");
    expect(section(unroutedText, "Param issues")).toContain("| `id` |");
  });
});
