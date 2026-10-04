import { createRegistry } from "../../index.ts";
import { definePageModules, type PageModuleSet } from "../../client/index.ts";
import { addNote, listNotes } from "./actions.ts";
import notePage from "./note/page.ts";
import notesPage from "./notes/page.ts";
import ComposerRegion from "./notes/regions/composer/region.tsx";
import ListRegion from "./notes/regions/list/region.tsx";
import * as notesStates from "./notes/states.tsx";
import NotesView from "./notes/view.tsx";

export const registry = createRegistry().register(listNotes, addNote, notesPage, notePage).freeze();

const pages: readonly PageModuleSet[] = [
  definePageModules({
    page: notesPage,
    view: NotesView,
    states: notesStates,
    regions: { list: ListRegion, composer: ComposerRegion },
  }),
  {
    page: notePage,
    chunk: "page-note",
    load: async () => {
      const [view, states, detail] = await Promise.all([
        import("./note/view.tsx"),
        import("./note/states.tsx"),
        import("./note/regions/detail/region.tsx"),
      ]);
      return { view: view.default, states, regions: { detail: detail.default }, overlays: {} };
    },
  },
];

export const notesApp = Object.freeze({ name: "notes", registry, pages });
