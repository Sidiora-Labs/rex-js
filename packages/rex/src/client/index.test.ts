import { describe, expect, expectTypeOf, it } from "vitest";
import * as act from "./act.ts";
import * as address from "./agent/address.tsx";
import * as confirm from "./agent/confirm.tsx";
import * as density from "./agent/density.ts";
import * as flow from "./agent/flow.tsx";
import * as agentOutcome from "./agent/outcome.tsx";
import * as palette from "./agent/palette.tsx";
import * as shortcuts from "./agent/shortcuts.ts";
import * as sidecar from "./agent/sidecar.tsx";
import * as urlInvoke from "./agent/url-invoke.ts";
import * as app from "./app.tsx";
import * as boundary from "./boundary.tsx";
import * as context from "./context.ts";
import * as entry from "./entry.tsx";
import * as form from "./form.tsx";
import * as i18nContext from "./i18n/context.ts";
import * as client from "./index.ts";
import * as layout from "./layout.tsx";
import * as list from "./list.tsx";
import * as loaders from "./loaders.ts";
import * as nav from "./nav.ts";
import * as outcome from "./outcome.ts";
import * as overlay from "./overlay.tsx";
import * as page from "./page.tsx";
import * as providers from "./providers.ts";
import * as reset from "./reset.ts";
import * as router from "./router.tsx";
import * as screen from "./screen.ts";
import * as components from "./shell/components.ts";
import * as shell from "./shell.tsx";
import * as states from "./states.ts";
import * as store from "./store.ts";
import * as unsafeHtml from "./unsafe-html.tsx";

type Namespace = Readonly<Record<string, unknown>>;

function namespace(module: object): Namespace {
  return module as Namespace;
}

const starred: readonly (readonly [string, Namespace])[] = [
  ["./context.ts", namespace(context)],
  ["./app.tsx", namespace(app)],
  ["./router.tsx", namespace(router)],
  ["./nav.ts", namespace(nav)],
  ["./act.ts", namespace(act)],
  ["./outcome.ts", namespace(outcome)],
  ["./states.ts", namespace(states)],
  ["./page.tsx", namespace(page)],
  ["./boundary.tsx", namespace(boundary)],
  ["./layout.tsx", namespace(layout)],
  ["./screen.ts", namespace(screen)],
  ["./shell.tsx", namespace(shell)],
  ["./shell/components.ts", namespace(components)],
  ["./providers.ts", namespace(providers)],
  ["./reset.ts", namespace(reset)],
  ["./store.ts", namespace(store)],
  ["./overlay.tsx", namespace(overlay)],
  ["./unsafe-html.tsx", namespace(unsafeHtml)],
  ["./form.tsx", namespace(form)],
  ["./agent/address.tsx", namespace(address)],
  ["./agent/sidecar.tsx", namespace(sidecar)],
  ["./agent/outcome.tsx", namespace(agentOutcome)],
  ["./agent/palette.tsx", namespace(palette)],
  ["./agent/shortcuts.ts", namespace(shortcuts)],
  ["./agent/url-invoke.ts", namespace(urlInvoke)],
  ["./agent/confirm.tsx", namespace(confirm)],
  ["./agent/density.ts", namespace(density)],
  ["./agent/flow.tsx", namespace(flow)],
  ["./loaders.ts", namespace(loaders)],
];

const LIST_EXPORTS = [
  "DEFAULT_LIST_SIZE",
  "LIST_EMPTY_TEXT",
  "LIST_MORE_LABEL",
  "LIST_PAGE_PARAM",
  "LIST_SIZE_PARAM",
  "MAX_LIST_SIZE",
  "listParamNames",
  "listSearch",
  "listWindow",
  "readListParams",
] as const;

const NAMED_EXPORTS = [
  "startRexEntry",
  "findRootElement",
  "DENSITY_HEADER",
  "registerI18n",
  ...LIST_EXPORTS,
] as const;

const entryPoint = namespace(client);

function names(module: Namespace): string[] {
  return Object.keys(module).sort();
}

describe("client entry", () => {
  it("re-exports every runtime binding of its star modules by identity", () => {
    const bindings = new Map<string, Set<unknown>>();
    for (const [, module] of starred) {
      for (const name of Object.keys(module)) {
        const values = bindings.get(name) ?? new Set<unknown>();
        values.add(module[name]);
        bindings.set(name, values);
      }
    }
    const ambiguous = [...bindings].filter(([, values]) => values.size > 1).map(([name]) => name);
    expect(ambiguous).toEqual([]);
    expect(bindings.size).toBeGreaterThan(50);
    for (const [path, module] of starred) {
      for (const name of Object.keys(module)) {
        expect(entryPoint[name], `${name} from ${path}`).toBe(module[name]);
      }
    }
  });

  it("exposes the entry, list and i18n bindings selectively", () => {
    expect(client.startRexEntry).toBe(entry.startRexEntry);
    expect(client.findRootElement).toBe(entry.findRootElement);
    expect(client.createRexEntry).toBe(entry.createRexEntry);
    expect(client.DENSITY_HEADER).toBe(context.DENSITY_HEADER);
    expect(client.registerI18n).toBe(i18nContext.registerI18n);
    for (const name of LIST_EXPORTS) expect(client[name], name).toBe(list[name]);
    expect(names(namespace(list))).toEqual([...LIST_EXPORTS, "List"].sort());
    expect("List" in client).toBe(false);
    const starNames = new Set(starred.flatMap(([, module]) => Object.keys(module)));
    for (const name of names(namespace(i18nContext))) {
      if (name === "registerI18n") continue;
      expect(name in client, name).toBe(starNames.has(name));
    }
    expect(
      ["defineI18n", "i18nFor", "useI18n", "useT", "useText", "useLocale"].filter(
        (name) => name in client,
      ),
    ).toEqual([]);
    expectTypeOf<client.StartRexOptions>().toEqualTypeOf<entry.StartRexOptions>();
    expectTypeOf<client.StartedRex>().toEqualTypeOf<entry.StartedRex>();
    expectTypeOf<client.ListProps<string>>().toEqualTypeOf<list.ListProps<string>>();
    expectTypeOf<client.ListWindow>().toEqualTypeOf<list.ListWindow>();
    expectTypeOf<client.ListParams>().toEqualTypeOf<list.ListParams>();
    expectTypeOf<client.ListParamNames>().toEqualTypeOf<list.ListParamNames>();
    expectTypeOf<client.ConfirmRequest>().toEqualTypeOf<context.ConfirmRequest>();
    expectTypeOf<client.ConfirmDialogRequest>().toEqualTypeOf<confirm.ConfirmRequest>();
  });

  it("exports exactly the union of its star modules and named bindings", () => {
    const expected = new Set<string>(NAMED_EXPORTS);
    for (const [, module] of starred) {
      for (const name of Object.keys(module)) expected.add(name);
    }
    expect(names(entryPoint)).toEqual([...expected].sort());
  });
});
