import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it } from "vitest";
import * as z from "zod/mini";
import { registerI18n } from "../client/i18n/context.ts";
import { action } from "../core/action.ts";
import { actor, anonymousActor, type Actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { always, never, policy } from "../core/policy.ts";
import { text } from "../core/schema.ts";
import { sidecarSchema, type SidecarPayload } from "../manifest/sidecar.schema.ts";
import {
  MARKDOWN_CONTENT_TYPE,
  PAGES_TEXT_STATUS,
  createRexServer,
  memoryLedger,
  pageTextPath,
  renderPageText,
  type RexServerRegistry,
} from "./index.ts";
import type { AnyAction } from "../core/action.ts";
import { buildManifest } from "../manifest/build.ts";

const noteSchema = z.object({ id: text({ min: 1 }), title: text({ min: 1 }) });
const notesOutput = z.object({ items: z.array(noteSchema) });

let notes: { id: string; title: string }[] = [];

const editor = policy("editor", {
  permissions: ["notes.edit"],
  resolve: (subject) => subject.permissions.filter((permission) => permission === "notes.edit"),
});

const listNotes = action("list-notes", {
  input: z.object({}),
  output: notesOutput,
  policy: always(),
  effect: "read",
  label: "List notes",
  handler: () => ({ items: notes.map((note) => ({ ...note })) }),
});

const readNote = action("read-note", {
  input: z.object({ id: text({ min: 1 }) }),
  output: noteSchema,
  policy: always(),
  effect: "read",
  label: "Read note",
  handler: (input) => {
    const found = notes.find((note) => note.id === input.id);
    if (found === undefined) throw new ORPCError("NOT_FOUND", { message: `no note ${input.id}` });
    return { ...found };
  },
});

const brokenFeed = action("broken-feed", {
  input: z.object({}),
  output: notesOutput,
  policy: always(),
  effect: "read",
  label: "Broken feed",
  handler: () => {
    throw new Error("the feed store is down");
  },
});

const addNote = action("add-note", {
  input: z.object({ title: text({ min: 1, max: 120 }) }),
  output: noteSchema,
  policy: editor.can("notes.edit"),
  effect: "reversible",
  label: "msg:notes.add",
  invalidates: ["list-notes"],
  handler: (input) => ({ id: `n${notes.length + 1}`, title: input.title }),
});

const purgeNotes = action("purge-notes", {
  input: z.object({ confirmText: text({ min: 1 }) }),
  output: z.object({ removed: z.number() }),
  policy: never(),
  effect: "irreversible",
  label: "Purge | all notes",
  handler: () => ({ removed: notes.length }),
});

const notesPage = page("notes", {
  route: "/notes",
  actions: [addNote, purgeNotes],
  regions: ["list", "composer"],
  overlays: [
    { id: "FilterSheet", dismiss: "both", binding: "url" },
    { id: "ConfirmSheet", dismiss: "escape", binding: "region" },
  ],
  load: { notes: listNotes },
  chrome: { title: "msg:notes.title" },
});

const notePage = page("note", {
  route: "/notes/:id",
  params: z.object({ id: text({ min: 1 }) }),
  actions: [addNote],
  regions: ["body"],
  load: {
    note: {
      action: readNote,
      input: (params: Readonly<Record<string, unknown>>) => ({ id: String(params.id) }),
    },
  },
  chrome: { title: "Note" },
});

const feedPage = page("feed", {
  route: "/feed",
  regions: ["items"],
  load: { feed: brokenFeed },
  chrome: { title: "Feed" },
});

const adminPage = page("admin", {
  route: "/admin",
  policy: never(),
  regions: ["panel"],
  chrome: { title: "Admin" },
});

const aboutPage = page("about", {
  route: "/about",
  regions: ["copy"],
  chrome: { title: "About" },
});

const actions: readonly AnyAction[] = [listNotes, readNote, brokenFeed, addNote, purgeNotes];

const MESSAGES = {
  en: { "notes.title": "Notes", "notes.add": "Add note" },
  fr: { "notes.title": "Carnet", "notes.add": "Ajouter une note" },
};

const actors: Record<string, Actor> = {
  alice: actor({ id: "alice", permissions: ["notes.edit"] }),
  bob: actor({ id: "bob" }),
};

function resolveActor(request: Request): Actor {
  const name = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return actors[name] ?? anonymousActor;
}

function makeRegistry(): RexServerRegistry<AnyAction> {
  return {
    entities: [],
    actions,
    pages: [notesPage, notePage, feedPage, adminPage, aboutPage],
    policies: [editor],
  };
}

function sidecarOf(markdown: string): SidecarPayload {
  const match = /## Sidecar\n\n(`{3,})json\n([\s\S]*?)\n\1\n/.exec(markdown);
  if (match === null) throw new Error("the page text has no sidecar block");
  const parsed = sidecarSchema.safeParse(JSON.parse(match[2] as string));
  if (!parsed.success) throw new Error(`the sidecar block is invalid: ${parsed.error.message}`);
  return parsed.data;
}

function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(`## ${heading}\n`);
  if (start === -1) throw new Error(`the page text has no ${heading} section`);
  const next = markdown.indexOf("\n## ", start + 1);
  return markdown.slice(start, next === -1 ? undefined : next);
}

function rowOf(markdown: string, heading: string, id: string): string {
  const row = section(markdown, heading)
    .split("\n")
    .find((line) => line.startsWith(`| \`${id}\` |`));
  if (row === undefined) throw new Error(`the ${heading} section has no row for ${id}`);
  return row;
}

describe("GET /rex/pages/<id>.md", () => {
  let registry: RexServerRegistry<AnyAction>;
  let app: ReturnType<typeof createRexServer>;

  async function get(path: string, as = "alice", headers: Record<string, string> = {}) {
    const response = await app.request(path, {
      headers: { authorization: `Bearer ${as}`, ...headers },
    });
    return { response, body: await response.text() };
  }

  beforeEach(() => {
    notes = [
      { id: "n1", title: "First" },
      { id: "n2", title: "Second" },
    ];
    registry = makeRegistry();
    app = createRexServer({ registry, ledger: memoryLedger(), actor: resolveActor, app: "notes" });
  });

  it("renders the title, route, actor state, regions, actions, overlays and sidecar", async () => {
    const { response, body } = await get(pageTextPath("notes"));
    expect(response.status).toBe(PAGES_TEXT_STATUS.page);
    expect(response.headers.get("content-type")).toBe(MARKDOWN_CONTENT_TYPE);
    expect(response.headers.get("x-rex-page")).toBe("notes");
    expect(body.startsWith("# msg:notes.title\n")).toBe(true);
    expect(body).toContain("| Page | `notes` |");
    expect(body).toContain("| Route | `/notes` |");
    expect(body).toContain("| URL | `/notes` |");
    expect(body).toContain("| Render | ssr |");
    expect(body).toContain("| Actor | `alice` |");
    expect(body).toContain("| State | `ready` |");
    expect(body).toContain("| Access | allowed |");

    expect(rowOf(body, "Regions", "list")).toBe('| `list` | `[data-rex-region="notes/list"]` |');
    expect(rowOf(body, "Regions", "composer")).toBe(
      '| `composer` | `[data-rex-region="notes/composer"]` |',
    );

    expect(rowOf(body, "Actions", "add-note")).toBe(
      '| `add-note` | msg:notes.add | reversible | yes | `[data-rex="notes/add-note"]` | `title` | `GET /notes?act=add-note&input=<json>` | `POST /rex/form/add-note` |',
    );
    expect(rowOf(body, "Actions", "purge-notes")).toBe(
      '| `purge-notes` | Purge \\| all notes | irreversible | no: never | `[data-rex="notes/purge-notes"]` | `confirmText` | `GET /notes?act=purge-notes&input=<json>` | `POST /rex/form/purge-notes` |',
    );
    expect(section(body, "Actions")).toContain("`_csrf` matching the `rex-csrf` cookie");
    expect(section(body, "Actions")).toContain("`_confirm`");

    expect(rowOf(body, "Overlays", "FilterSheet")).toBe(
      '| `FilterSheet` | `[data-rex-overlay="notes/FilterSheet"]` | `[data-rex-overlay-trigger="notes/FilterSheet"]` | both | url | no |',
    );
    expect(rowOf(body, "Overlays", "ConfirmSheet")).toContain("| escape | region | no |");

    const sidecar = sidecarOf(body);
    expect(sidecar.page).toBe("notes");
    expect(sidecar.state).toBe("ready");
    expect(sidecar.actions.map((entry) => entry.id)).toEqual(["add-note", "purge-notes"]);
    expect(sidecar.actions.find((entry) => entry.id === "purge-notes")).toMatchObject({
      allowed: false,
      reason: "never",
      effect: "irreversible",
    });
    expect(sidecar.overlays.map((entry) => entry.id)).toEqual(["FilterSheet", "ConfirmSheet"]);
    const manifest = buildManifest(registry, { app: "notes" });
    expect(sidecar.actions.find((entry) => entry.id === "add-note")?.input).toEqual(
      manifest.actions.find((entry) => entry.id === "add-note")?.input,
    );
  });

  it("lists every sidecar action in the actions table", async () => {
    for (const declared of registry.pages) {
      const { body } = await get(pageTextPath(declared.id));
      const sidecar = sidecarOf(body);
      expect(sidecar.page).toBe(declared.id);
      for (const entry of sidecar.actions) {
        expect(rowOf(body, "Actions", entry.id)).toContain(
          `\`[data-rex="${declared.id}/${entry.id}"]\``,
        );
      }
      const rows = section(body, "Actions")
        .split("\n")
        .filter((line) => line.startsWith("| `"));
      expect(rows).toHaveLength(sidecar.actions.length);
    }
  });

  it("evaluates action policy for the requesting actor", async () => {
    const { body } = await get(pageTextPath("notes"), "bob");
    expect(body).toContain("| Actor | `bob` |");
    expect(rowOf(body, "Actions", "add-note")).toContain("| no: missing-permission:notes.edit |");
    const sidecar = sidecarOf(body);
    expect(sidecar.actions.find((entry) => entry.id === "add-note")).toMatchObject({
      allowed: false,
      reason: "missing-permission:notes.edit",
    });
  });

  it("derives the data state from the page loaders run in process", async () => {
    notes = [];
    const empty = await get(pageTextPath("notes"));
    expect(empty.body).toContain("| State | `empty` |");
    expect(sidecarOf(empty.body).state).toBe("empty");

    const failing = await get(pageTextPath("feed"));
    expect(failing.response.status).toBe(PAGES_TEXT_STATUS.page);
    expect(failing.body).toContain("| State | `recoverable-error` |");
    expect(rowOf(failing.body, "Regions", "items")).toBe(
      '| `items` | `[data-rex-region="feed/items"]` |',
    );
    expect(section(failing.body, "Actions")).toContain("_None._");

    const missing = await get(`${pageTextPath("note")}?id=n9`);
    expect(missing.body).toContain("| State | `terminal-error` |");
  });

  it("reads route params and page params from the query string", async () => {
    const { response, body } = await get(`${pageTextPath("note")}?id=n2`);
    expect(response.status).toBe(PAGES_TEXT_STATUS.page);
    expect(body).toContain("| Route | `/notes/:id` |");
    expect(body).toContain("| URL | `/notes/n2` |");
    expect(body).toContain("| State | `ready` |");
    expect(rowOf(body, "Actions", "add-note")).toContain(
      "`GET /notes/n2?act=add-note&input=<json>`",
    );
    expect(sidecarOf(body).params).toEqual({ id: "n2" });
  });

  it("reports invalid params as a terminal error with the issues", async () => {
    const { response, body } = await get(pageTextPath("note"));
    expect(response.status).toBe(PAGES_TEXT_STATUS.page);
    expect(body).toContain("| URL | - |");
    expect(body).toContain("| State | `terminal-error` |");
    expect(section(body, "Param issues")).toContain("| `id` |");
    expect(rowOf(body, "Actions", "add-note")).toContain("| - | `POST /rex/form/add-note` |");
    expect(sidecarOf(body).state).toBe("terminal-error");
  });

  it("answers 403 with the permission-denied state when the page policy refuses the actor", async () => {
    const { response, body } = await get(pageTextPath("admin"));
    expect(response.status).toBe(PAGES_TEXT_STATUS.denied);
    expect(response.headers.get("content-type")).toBe(MARKDOWN_CONTENT_TYPE);
    expect(body).toContain("| State | `permission-denied` |");
    expect(body).toContain("| Access | denied: never |");
    expect(sidecarOf(body).state).toBe("permission-denied");
  });

  it("answers 404 in markdown for an unknown page and lists the known pages", async () => {
    const { response, body } = await get(pageTextPath("nope"));
    expect(response.status).toBe(PAGES_TEXT_STATUS["not-found"]);
    expect(response.headers.get("content-type")).toBe(MARKDOWN_CONTENT_TYPE);
    expect(body.startsWith("# Page not found\n")).toBe(true);
    expect(body).toContain("No page has id `nope`.");
    for (const id of ["about", "admin", "feed", "note", "notes"]) {
      expect(body).toContain(`| \`${id}\` | \`/rex/pages/${id}.md\` |`);
    }
  });

  it("leaves other files under /rex/pages to the rest of the app", async () => {
    const { response, body } = await get("/rex/pages/notes.json");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).not.toBe(MARKDOWN_CONTENT_TYPE);
    expect(body).not.toContain("# ");
  });

  it("refuses an unknown density header like the other Rex routes", async () => {
    const { response } = await get(pageTextPath("about"), "alice", { "x-rex-density": "dense" });
    expect(response.status).toBe(400);
  });

  it("resolves message keys and the locale prefix through the request locale", async () => {
    registerI18n(registry, {
      config: { locales: ["en", "fr"], default: "en", routing: "prefix" },
      messages: MESSAGES,
    });
    const french = await get(pageTextPath("notes"), "alice", { "accept-language": "fr" });
    expect(french.body.startsWith("# Carnet\n")).toBe(true);
    expect(french.body).toContain("| URL | `/fr/notes` |");
    expect(rowOf(french.body, "Actions", "add-note")).toContain(
      "| Ajouter une note | reversible | yes |",
    );
    expect(rowOf(french.body, "Actions", "add-note")).toContain(
      "`GET /fr/notes?act=add-note&input=<json>`",
    );
    expect(sidecarOf(french.body).actions[0]?.label).toBe("Ajouter une note");

    const english = await get(pageTextPath("notes"));
    expect(english.body.startsWith("# Notes\n")).toBe(true);
    expect(english.body).toContain("| URL | `/en/notes` |");
  });
});

describe("renderPageText", () => {
  it("fences a sidecar whose strings hold backtick runs and keeps the JSON intact", () => {
    const ticks = page("ticks", {
      route: "/ticks",
      actions: [
        action("mark", {
          input: z.object({}),
          output: z.object({}),
          policy: always(),
          effect: "reversible",
          label: "Mark ```code``` here",
          handler: () => ({}),
        }),
      ],
      regions: ["main"],
      chrome: { title: "Ticks" },
    });
    const source = { entities: [], actions: ticks.actions, pages: [ticks], policies: [] };
    const manifest = buildManifest(source);
    const subject = actor({ id: "carol" });
    const rendered = renderPageText({
      manifest,
      page: ticks,
      params: {},
      issues: [],
      href: "/ticks",
      actor: subject,
      policy: { allowed: true, reason: null },
      state: "ready",
    });
    expect(rendered.markdown).toContain("\n````json\n");
    expect(sidecarOf(rendered.markdown)).toEqual(rendered.sidecar);
    expect(rendered.sidecar.actions[0]?.label).toBe("Mark ```code``` here");
    expect(rowOf(rendered.markdown, "Actions", "mark")).toContain("| Mark ```code``` here |");
  });
});
