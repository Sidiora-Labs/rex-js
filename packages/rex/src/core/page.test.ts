import { describe, expect, expectTypeOf, it } from "vitest";
import { action } from "./action.ts";
import { RexDeclarationError } from "./entity.ts";
import { RexDeclarationOptionError, RexError, type RexErrorCode } from "./errors.ts";
import { validateStandardSync } from "./standard.ts";
import { buildManifest } from "../manifest/build.ts";
import {
  PAGE_RENDER_MODES,
  page,
  parseRoute,
  titleFromId,
  type PageParams,
  type PageStates,
  type PageStatesModule,
} from "./page.ts";
import { always, policy } from "./policy.ts";
import { createRegistry } from "./registry.ts";
import { integer, text } from "../schema/index.ts";
import { z } from "zod/mini";
import {
  REX_DATA_STATES,
  STATE_EXPORT_NAMES,
  isRexDataState,
  requiredStateExports,
  stateExportName,
  type RexDataState,
  type StateComponent,
  type StateProps,
  type StatesModule,
} from "./states.ts";

const wallet = policy("wallet", { permissions: ["view", "send"], resolve: () => ["view"] });

const send = action("send", {
  input: z.object({ amount: text() }),
  output: z.object({ ok: z.boolean() }),
  policy: wallet.can("send"),
  effect: "irreversible",
  handler: () => ({ ok: true }),
});
const pickToken = action("pick-token", {
  input: z.object({ symbol: text() }),
  output: z.object({ symbol: text() }),
  policy: always(),
  effect: "reversible",
  handler: (input) => input,
});

const sendPage = page("send", {
  route: "/send/:account",
  params: z.object({
    account: text({ min: 1 }),
    token: text().optional(),
    step: integer().default(1),
  }),
  policy: wallet.can("send"),
  recovery: "portfolio",
  draft: "route",
  actions: [send, pickToken],
  chrome: { back: "portfolio", nav: false },
  regions: ["form", "confirm", "success"],
  overlays: [
    { id: "TokenSelectorSheet", dismiss: "both", binding: "url" },
    { id: "ContactPickerSheet", dismiss: "escape", binding: "region" },
  ],
});

const portfolio = page("portfolio", { route: "/", regions: ["hero", "holdings"] });

const minimal = page("settings.profile", {
  route: "/settings/profile",
  states: ["ready", "loading", "terminal-error"],
});

function fieldOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(RexDeclarationError);
    return (error as RexDeclarationError).field;
  }
  throw new Error("expected a RexDeclarationError");
}

describe("states", () => {
  it("is the closed set of nine data states", () => {
    expect(REX_DATA_STATES).toEqual([
      "loading",
      "empty",
      "stale",
      "partial",
      "offline",
      "permission-denied",
      "recoverable-error",
      "terminal-error",
      "ready",
    ]);
    expectTypeOf<RexDataState>().toEqualTypeOf<
      | "loading"
      | "empty"
      | "stale"
      | "partial"
      | "offline"
      | "permission-denied"
      | "recoverable-error"
      | "terminal-error"
      | "ready"
    >();
    expect(isRexDataState("offline")).toBe(true);
    expect(isRexDataState("error")).toBe(false);
  });

  it("maps every state to its export name", () => {
    expect(stateExportName("permission-denied")).toBe("PermissionDenied");
    expect(stateExportName("terminal-error")).toBe("TerminalError");
    expect(Object.keys(STATE_EXPORT_NAMES)).toEqual([...REX_DATA_STATES]);
    expect(requiredStateExports(REX_DATA_STATES)).toEqual([
      "Loading",
      "Empty",
      "Stale",
      "Partial",
      "Offline",
      "PermissionDenied",
      "RecoverableError",
      "TerminalError",
    ]);
  });
});

describe("page", () => {
  it("returns a frozen declaration", () => {
    expect(sendPage.kind).toBe("page");
    expect(sendPage.id).toBe("send");
    expect(sendPage.route).toBe("/send/:account");
    expect(sendPage.routeParams).toEqual(["account"]);
    expect(sendPage.recovery).toBe("portfolio");
    expect(sendPage.draft).toBe("route");
    expect(sendPage.actions.map((declared) => declared.id)).toEqual(["send", "pick-token"]);
    expect(sendPage.regions).toEqual(["form", "confirm", "success"]);
    expect(sendPage.overlays).toEqual([
      { id: "TokenSelectorSheet", dismiss: "both", binding: "url" },
      { id: "ContactPickerSheet", dismiss: "escape", binding: "region" },
    ]);
    expect(Object.isFrozen(sendPage)).toBe(true);
    expect(Object.isFrozen(sendPage.chrome)).toBe(true);
    expect(Object.isFrozen(sendPage.overlays[0])).toBe(true);
  });

  it("defaults states to all nine, policy to always, draft to none", () => {
    expect(portfolio.states).toEqual([...REX_DATA_STATES]);
    expect(portfolio.policy).toEqual(always());
    expect(portfolio.draft).toBe("none");
    expect(portfolio.recovery).toBeNull();
    expect(portfolio.actions).toEqual([]);
    expect(portfolio.overlays).toEqual([]);
    expect(validateStandardSync(portfolio.params, {})).toEqual({ value: {} });
  });

  it("orders declared states canonically", () => {
    expect(minimal.states).toEqual(["loading", "terminal-error", "ready"]);
  });

  it("defaults chrome", () => {
    expect(portfolio.chrome).toEqual({ header: true, nav: true, back: null, title: "Portfolio" });
    expect(sendPage.chrome).toEqual({ header: true, nav: false, back: "portfolio", title: "Send" });
    expect(minimal.chrome.title).toBe("Settings profile");
    expect(titleFromId("toggle-hide-dust")).toBe("Toggle hide dust");
    const titled = page("home", { route: "/home", chrome: { title: "Wallet", header: false } });
    expect(titled.chrome).toEqual({ header: false, nav: true, back: null, title: "Wallet" });
  });

  it("keeps the declared params schema and leaves its JSON Schema to the manifest", () => {
    expect(Object.hasOwn(sendPage, "paramsJsonSchema")).toBe(false);
    const built = buildManifest({
      entities: [],
      actions: [send, pickToken],
      pages: [sendPage, portfolio],
      policies: [],
    });
    const params = (
      built.pages.find((entry) => entry.id === "send") as (typeof built.pages)[number]
    ).params;
    expect(params.type).toBe("object");
    expect(params.required).toEqual(["account"]);
    expect(Object.keys(params.properties as object)).toEqual(["account", "token", "step"]);
  });

  it("registers in the registry under pages", () => {
    const snapshot = createRegistry().register(sendPage, portfolio, send).freeze();
    expect(snapshot.pages.map((declared) => declared.id)).toEqual(["portfolio", "send"]);
    expect(snapshot.find("page", "send")).toBe(sendPage);
    expect(() => createRegistry().register(portfolio, page("portfolio", { route: "/x" }))).toThrow(
      RexDeclarationError,
    );
  });

  it("contains no React dependency", async () => {
    const { readFile } = await import("node:fs/promises");
    for (const file of ["./page.ts", "./states.ts", "./overlay.ts"]) {
      const source = await readFile(new URL(file, import.meta.url), "utf8");
      expect(source).not.toMatch(/from "react/);
    }
  });
});

describe("routes", () => {
  it("parses static and param segments", () => {
    expect(parseRoute("/")).toEqual({ route: "/", segments: [], params: [] });
    expect(parseRoute("/send/:account/token/:tokenId")).toEqual({
      route: "/send/:account/token/:tokenId",
      segments: [
        { kind: "static", value: "send" },
        { kind: "param", name: "account" },
        { kind: "static", value: "token" },
        { kind: "param", name: "tokenId" },
      ],
      params: ["account", "tokenId"],
    });
  });

  it.each(["send", "/send/", "//", "/Send", "/send/:Account", "/a/:x/:x", "/a b", "/:"])(
    "rejects %j",
    (route) => {
      expect(() => parseRoute(route)).toThrow();
    },
  );
});

describe("page declaration errors name the field", () => {
  it("id and config", () => {
    expect(fieldOf(() => page("Send", { route: "/" }))).toBe("id");
    expect(fieldOf(() => page("send", null as never))).toBe("config");
    expect(fieldOf(() => page("send", { route: "/", layout: "x" } as never))).toBe("layout");
  });

  it("route", () => {
    expect(fieldOf(() => page("send", { route: "send" }))).toBe("route");
    expect(fieldOf(() => page("send", {} as never))).toBe("route");
  });

  it("params", () => {
    expect(fieldOf(() => page("send", { route: "/", params: {} as never }))).toBe("params");
    expect(fieldOf(() => page("send", { route: "/send/:account" }))).toBe("params");
    expect(
      fieldOf(() =>
        page("send", { route: "/send/:account", params: z.object({ account: text().optional() }) }),
      ),
    ).toBe("params.account");
    const dated = page("send", { route: "/", params: z.object({ at: z.date() }) });
    let error: unknown;
    try {
      buildManifest({ entities: [], actions: [], pages: [dated], policies: [] });
    } catch (thrown) {
      error = thrown;
    }
    expect(error).toBeInstanceOf(RexError);
    expect((error as RexError).code).toBe("REX210");
    expect((error as RexError).message).toContain('page "send" params');
  });

  it("policy, recovery, draft", () => {
    expect(fieldOf(() => page("send", { route: "/", policy: "wallet" } as never))).toBe("policy");
    expect(fieldOf(() => page("send", { route: "/", recovery: "Portfolio" }))).toBe("recovery");
    expect(fieldOf(() => page("send", { route: "/", recovery: "send" }))).toBe("recovery");
    expect(fieldOf(() => page("send", { route: "/", draft: "local" } as never))).toBe("draft");
  });

  it("actions", () => {
    expect(fieldOf(() => page("send", { route: "/", actions: "send" } as never))).toBe("actions");
    expect(fieldOf(() => page("send", { route: "/", actions: [{ id: "x" }] } as never))).toBe(
      "actions.0",
    );
    expect(fieldOf(() => page("send", { route: "/", actions: [send, send] }))).toBe("actions.1");
  });

  it("chrome", () => {
    expect(fieldOf(() => page("send", { route: "/", chrome: [] as never }))).toBe("chrome");
    expect(fieldOf(() => page("send", { route: "/", chrome: { icon: "x" } as never }))).toBe(
      "chrome.icon",
    );
    expect(fieldOf(() => page("send", { route: "/", chrome: { nav: "yes" } as never }))).toBe(
      "chrome.nav",
    );
    expect(fieldOf(() => page("send", { route: "/", chrome: { header: 1 } as never }))).toBe(
      "chrome.header",
    );
    expect(fieldOf(() => page("send", { route: "/", chrome: { back: "Home" } }))).toBe(
      "chrome.back",
    );
    expect(fieldOf(() => page("send", { route: "/", chrome: { title: "" } }))).toBe("chrome.title");
  });

  it("regions", () => {
    expect(fieldOf(() => page("send", { route: "/", regions: ["Form"] }))).toBe("regions.0");
    expect(fieldOf(() => page("send", { route: "/", regions: ["form", "form"] }))).toBe(
      "regions.1",
    );
  });

  it("overlays", () => {
    expect(
      fieldOf(() =>
        page("send", {
          route: "/",
          overlays: [{ id: "token-sheet", dismiss: "both", binding: "url" }],
        }),
      ),
    ).toBe("overlays");
    expect(
      fieldOf(() =>
        page("send", {
          route: "/",
          overlays: [{ id: "TokenSheet", dismiss: "click", binding: "url" } as never],
        }),
      ),
    ).toBe("overlays.TokenSheet.dismiss");
    expect(
      fieldOf(() =>
        page("send", {
          route: "/",
          overlays: [{ id: "TokenSheet", dismiss: "both", binding: "state" } as never],
        }),
      ),
    ).toBe("overlays.TokenSheet.binding");
    expect(
      fieldOf(() =>
        page("send", {
          route: "/",
          overlays: [
            { id: "TokenSheet", dismiss: "both", binding: "url" },
            { id: "TokenSheet", dismiss: "escape", binding: "url" },
          ],
        }),
      ),
    ).toBe("overlays.1");
    expect(fieldOf(() => page("send", { route: "/", overlays: ["TokenSheet"] as never }))).toBe(
      "overlays",
    );
  });

  it("states", () => {
    expect(fieldOf(() => page("send", { route: "/", states: ["ready", "error"] as never }))).toBe(
      "states.1",
    );
    expect(fieldOf(() => page("send", { route: "/", states: ["ready", "ready"] }))).toBe(
      "states.1",
    );
    expect(fieldOf(() => page("send", { route: "/", states: ["loading"] }))).toBe("states");
  });
});

describe("types", () => {
  it("infers params, states, regions and overlays", () => {
    expectTypeOf<PageParams<typeof sendPage>>().toEqualTypeOf<{
      account: string;
      token?: string | undefined;
      step: number;
    }>();
    expectTypeOf<PageStates<typeof minimal>>().toEqualTypeOf<
      "ready" | "loading" | "terminal-error"
    >();
    expectTypeOf<PageStates<typeof portfolio>>().toEqualTypeOf<RexDataState>();
    expectTypeOf(sendPage.regions).toEqualTypeOf<readonly ("form" | "confirm" | "success")[]>();
    expectTypeOf(sendPage.overlays[0]!.id).toEqualTypeOf<
      "TokenSelectorSheet" | "ContactPickerSheet"
    >();
    expectTypeOf(sendPage.id).toEqualTypeOf<"send">();
  });

  it("requires one states export per declared state except ready", () => {
    type Full = StatesModule;
    expectTypeOf<keyof Full>().toEqualTypeOf<
      | "Loading"
      | "Empty"
      | "Stale"
      | "Partial"
      | "Offline"
      | "PermissionDenied"
      | "RecoverableError"
      | "TerminalError"
    >();
    type Minimal = PageStatesModule<typeof minimal>;
    expectTypeOf<keyof Minimal>().toEqualTypeOf<"Loading" | "TerminalError">();

    const component: StateComponent = () => null;
    const complete: Minimal = { Loading: component, TerminalError: component };
    expect(Object.keys(complete)).toEqual(["Loading", "TerminalError"]);
    // @ts-expect-error a declared state without its export is a type error
    const missing: Minimal = { Loading: component };
    expect(missing).toBeDefined();
  });

  it("types state props with page params, retry and error", () => {
    type SendStates = PageStatesModule<typeof sendPage>;
    expectTypeOf<Parameters<SendStates["Offline"]>[0]>().toEqualTypeOf<
      StateProps<{ account: string; token?: string | undefined; step: number }>
    >();
    expectTypeOf<StateProps["retry"]>().toEqualTypeOf<() => void>();
    expectTypeOf<StateProps["error"]>().toEqualTypeOf<Error | null>();
  });
});

const holdings = action("holdings", {
  input: z.object({ account: text() }),
  output: z.object({ total: text() }),
  policy: always(),
  effect: "read",
  handler: (input) => ({ total: input.account }),
});
const prices = action("prices", {
  input: z.object({}),
  output: z.object({ count: integer() }),
  policy: always(),
  effect: "read",
  handler: () => ({ count: 1 }),
});

function optionError(run: () => unknown): { code: RexErrorCode; field: string } {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(RexDeclarationOptionError);
    const failure = error as RexDeclarationOptionError;
    expect(failure.declaration).toBe("page");
    expect(failure.message).toContain(`field "${failure.field}"`);
    return { code: failure.code, field: failure.field };
  }
  throw new Error("expected a RexDeclarationOptionError");
}

function ShellButton() {
  return null;
}

describe("0.2 page options", () => {
  it("defaults render to the app default, transition to none and leaves the rest unset", () => {
    expect(PAGE_RENDER_MODES).toEqual(["ssr", "csr", "ssg", "static"]);
    expect(portfolio.render).toBeNull();
    expect(portfolio.revalidate).toBeNull();
    expect(portfolio.paths).toBeNull();
    expect(portfolio.load).toEqual({});
    expect(portfolio.loaders).toEqual([]);
    expect(portfolio.cache).toBeNull();
    expect(portfolio.transition).toBe("none");
    expect(portfolio.chrome).toEqual({ header: true, nav: true, back: null, title: "Portfolio" });
  });

  it("records render, revalidate, paths, load, cache and transition", async () => {
    const paths = () => [{ account: "main" }, { account: "savings" }];
    const declared = page("statement", {
      route: "/statement/:account",
      params: z.object({ account: text() }),
      render: "ssg",
      revalidate: 60,
      paths,
      load: {
        holdings,
        prices: { action: prices, input: () => ({}) },
      },
      cache: { staleTime: 30_000 },
      transition: "view",
      chrome: { title: "Statement" },
    });
    expect(declared.render).toBe("ssg");
    expect(declared.revalidate).toBe(60);
    expect(declared.paths).toBe(paths);
    expect(await declared.paths?.()).toEqual([{ account: "main" }, { account: "savings" }]);
    expect(declared.load.holdings).toBe(holdings);
    expect(declared.loaders.map((loader) => [loader.name, loader.action.id])).toEqual([
      ["holdings", "holdings"],
      ["prices", "prices"],
    ]);
    expect(declared.loaders[0]?.input).toBeNull();
    expect(declared.loaders[1]?.input?.({ account: "main" })).toEqual({});
    expect(declared.cache).toEqual({ staleTime: 30_000 });
    expect(declared.transition).toBe("view");
    expect(declared.chrome.title).toBe("Statement");
    expect(Object.isFrozen(declared.loaders)).toBe(true);
    expect(Object.isFrozen(declared.chrome)).toBe(true);
    expectTypeOf(declared.load.holdings).toEqualTypeOf<typeof holdings>();
    const staticPage = page("about", {
      route: "/about/:section",
      params: z.object({ section: text() }),
      render: "static",
      paths: () => [{ section: "team" }],
    });
    expect(staticPage.render).toBe("static");
  });

  it("records invalidatedBy action ids on a loader, with or without an input mapper", () => {
    const declared = page("ledger", {
      route: "/ledger/:account",
      params: z.object({ account: text() }),
      load: {
        holdings,
        prices: { action: prices, invalidatedBy: ["send", "pick-token"] },
        mapped: {
          action: holdings,
          input: (params: Readonly<Record<string, unknown>>) => ({
            account: String(params.account),
          }),
          invalidatedBy: ["send"],
        },
      },
    });
    expect(
      declared.loaders.map((loader) => ({
        name: loader.name,
        action: loader.action.id,
        input: loader.input === null ? "params" : "mapped",
        invalidatedBy: loader.invalidatedBy,
      })),
    ).toEqual([
      { name: "holdings", action: "holdings", input: "params", invalidatedBy: [] },
      { name: "prices", action: "prices", input: "params", invalidatedBy: ["send", "pick-token"] },
      { name: "mapped", action: "holdings", input: "mapped", invalidatedBy: ["send"] },
    ]);
    expect(declared.loaders[2]?.input?.({ account: "main" })).toEqual({ account: "main" });
    expect(declared.loaders.every((loader) => Object.isFrozen(loader.invalidatedBy))).toBe(true);
    expect(declared.load.prices).toEqual({ action: prices, invalidatedBy: ["send", "pick-token"] });
  });

  it.each([
    [{ route: "/", render: "edge" }, "REX200", "render"],
    [{ route: "/", revalidate: 60 }, "REX201", "revalidate"],
    [{ route: "/", render: "static", revalidate: 60 }, "REX201", "revalidate"],
    [{ route: "/", render: "ssg", revalidate: 0 }, "REX201", "revalidate"],
    [{ route: "/", render: "ssg", revalidate: 1.5 }, "REX201", "revalidate"],
    [{ route: "/", render: "ssg", paths: () => [] }, "REX202", "paths"],
    [
      { route: "/a/:id", params: z.object({ id: text() }), render: "ssr", paths: () => [] },
      "REX202",
      "paths",
    ],
    [
      { route: "/a/:id", params: z.object({ id: text() }), render: "ssg", paths: [] },
      "REX202",
      "paths",
    ],
    [{ route: "/", load: [] }, "REX203", "load"],
    [{ route: "/", load: { Holdings: holdings } }, "REX203", "load.Holdings"],
    [{ route: "/", load: { sent: send } }, "REX203", "load.sent"],
    [{ route: "/", load: { list: { action: holdings } } }, "REX203", "load.list.input"],
    [{ route: "/", load: { list: { action: send, input: () => ({}) } } }, "REX203", "load.list"],
    [
      { route: "/", load: { list: { action: "holdings", input: () => ({}) } } },
      "REX203",
      "load.list",
    ],
    [
      { route: "/", load: { list: { action: holdings, input: () => ({}), key: 1 } } },
      "REX203",
      "load.list.key",
    ],
    [{ route: "/", load: { list: "holdings" } }, "REX203", "load.list"],
    [
      { route: "/", load: { list: { action: holdings, invalidatedBy: "send" } } },
      "REX203",
      "load.list.invalidatedBy",
    ],
    [
      { route: "/", load: { list: { action: holdings, invalidatedBy: ["Send"] } } },
      "REX203",
      "load.list.invalidatedBy.0",
    ],
    [
      { route: "/", load: { list: { action: holdings, invalidatedBy: [send] } } },
      "REX203",
      "load.list.invalidatedBy.0",
    ],
    [
      { route: "/", load: { list: { action: holdings, invalidatedBy: ["send", "send"] } } },
      "REX203",
      "load.list.invalidatedBy.1",
    ],
    [
      { route: "/", load: { list: { action: holdings, input: 1, invalidatedBy: ["send"] } } },
      "REX203",
      "load.list.input",
    ],
    [
      { route: "/", load: { list: { action: send, invalidatedBy: ["send"] } } },
      "REX203",
      "load.list",
    ],
    [{ route: "/", cache: { staleTime: -1 } }, "REX204", "cache.staleTime"],
    [{ route: "/", cache: { gcTime: 1, staleTime: 1 } }, "REX204", "cache.gcTime"],
    [{ route: "/", cache: 10 }, "REX204", "cache"],
    [{ route: "/", transition: "fade" }, "REX205", "transition"],
  ] as const)("rejects %j with %s naming %s", (config, code, field) => {
    expect(optionError(() => page("probe", config as never))).toEqual({ code, field });
  });

  it("rejects chrome.components because shell overrides are app-wide in rex.config ui.components", () => {
    expect(
      fieldOf(() =>
        page("home", { route: "/", chrome: { components: { Button: ShellButton } } } as never),
      ),
    ).toBe("chrome.components");
  });
});
