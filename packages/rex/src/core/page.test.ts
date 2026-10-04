import { describe, expect, expectTypeOf, it } from "vitest";
import { action } from "./action.ts";
import { RexDeclarationError } from "./entity.ts";
import {
  page,
  parseRoute,
  titleFromId,
  type PageParams,
  type PageStates,
  type PageStatesModule,
} from "./page.ts";
import { always, policy } from "./policy.ts";
import { createRegistry } from "./registry.ts";
import { integer, text, z } from "./schema.ts";
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
    expect(portfolio.params.parse({})).toEqual({});
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

  it("emits a params JSON schema", () => {
    expect(sendPage.paramsJsonSchema.type).toBe("object");
    expect(sendPage.paramsJsonSchema.required).toEqual(["account"]);
    expect(Object.keys(sendPage.paramsJsonSchema.properties as object)).toEqual([
      "account",
      "token",
      "step",
    ]);
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
    expect(fieldOf(() => page("send", { route: "/", params: z.object({ at: z.date() }) }))).toBe(
      "params",
    );
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
