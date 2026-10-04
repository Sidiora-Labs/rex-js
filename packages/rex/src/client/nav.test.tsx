import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { actor, type Actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { policy } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { integer, text } from "../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest } from "../manifest/build.ts";
import { standardJsonSchema } from "../manifest/json-schema.ts";
import { STATIC_HOST_ENV_KEY } from "../vite/entry-module.ts";
import { createRexApp, type RexFetch } from "./app.tsx";
import { draftStorageKey, useDraft, useNav, type Nav, type NavOutcome } from "./nav.ts";
import {
  NotFound,
  RexRoutes,
  orderPages,
  pageHref,
  parsePageParams,
  runRouteChange,
  type RouteResolution,
  type ViewTransitionHost,
} from "./router.tsx";
import { isStaticHost } from "./static-host.ts";

const wallet = policy("wallet", {
  permissions: ["view", "send"],
  resolve: (subject) => subject.permissions.filter((p) => p === "view" || p === "send"),
});

const portfolio = page("portfolio", { route: "/", policy: wallet.can("view") });

const sendPage = page("send", {
  route: "/send/:account",
  params: z.object({
    account: text({ min: 1 }),
    token: text().optional(),
    step: integer({ min: 1 }).default(1),
  }),
  policy: wallet.can("send"),
  recovery: "portfolio",
  draft: "route",
  chrome: { back: "portfolio", nav: false },
  transition: "view",
});

const sendNew = page("send.new", { route: "/send/new", chrome: { back: "portfolio" } });

const settings = page("settings", { route: "/settings", draft: "session" });

const registry = createRegistry().register(wallet, portfolio, sendPage, sendNew, settings).freeze();
const manifest = buildManifest(registry);

const owner = actor({ id: "owner", permissions: ["view", "send"] });
const viewer = actor({ id: "viewer", permissions: ["view"] });

const draftSchema = z.object({ amount: z.string() });

function DraftProbe() {
  const draft = useDraft(draftSchema);
  return (
    <div>
      <p data-testid="draft">
        {draft.mode}:{JSON.stringify(draft.value)}
      </p>
      <button type="button" onClick={() => draft.set({ amount: "12.5" })}>
        save draft
      </button>
    </div>
  );
}

function Screen({ resolution }: { readonly resolution: RouteResolution }) {
  const nav = useNav();
  const [last, setLast] = useState<NavOutcome | null>(null);
  if (resolution.kind === "not-found") return <NotFound path={resolution.path} />;
  const status = !resolution.policy.allowed
    ? "denied"
    : resolution.issues.length > 0
      ? "invalid"
      : "ready";
  const recovery = resolution.recovery;
  return (
    <div>
      <p data-testid="page">{resolution.page.id}</p>
      <p data-testid="status">{status}</p>
      <p data-testid="params">{JSON.stringify(resolution.params)}</p>
      <p data-testid="issues">{resolution.issues.map((issue) => issue.path).join(",")}</p>
      {status === "denied" && recovery !== null ? (
        <button type="button" onClick={() => setLast(nav.to(recovery))}>
          recover
        </button>
      ) : null}
      {status === "ready" && resolution.page.draft !== "none" ? <DraftProbe /> : null}
      <button
        type="button"
        onClick={() => setLast(nav.to(sendPage, { account: "acc-1", token: "PAX", step: 2 }))}
      >
        to send
      </button>
      <button type="button" onClick={() => setLast(nav.to(sendPage, { account: "" }))}>
        to send invalid
      </button>
      <button type="button" onClick={() => setLast(nav.replace(settings))}>
        replace settings
      </button>
      <button type="button" onClick={() => setLast(nav.back())}>
        back
      </button>
      <p data-testid="last">{last === null ? "none" : last.ok ? last.href : last.message}</p>
    </div>
  );
}

function mount(path: string, subject: Actor = owner) {
  const memory = memoryLocation({ path, record: true });
  const RexApp = createRexApp({ registry, manifest, actor: subject, baseUrl: "http://rex.test" });
  render(
    <RexApp>
      <Router hook={memory.hook}>
        <RexRoutes render={(resolution) => <Screen resolution={resolution} />} />
      </Router>
    </RexApp>,
  );
  return memory;
}

function text_(id: string): string | null {
  return screen.getByTestId(id).textContent;
}

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("router", () => {
  it("builds a route per page and parses params from the path and the query", () => {
    mount("/send/acc%201?token=PAX&step=3&act=send&unknown=1");
    expect(text_("page")).toBe("send");
    expect(text_("status")).toBe("ready");
    expect(JSON.parse(text_("params") ?? "")).toEqual({ account: "acc 1", token: "PAX", step: 3 });
  });

  it("applies schema defaults for params absent from the URL", () => {
    mount("/send/acc-1");
    expect(JSON.parse(text_("params") ?? "")).toEqual({ account: "acc-1", step: 1 });
  });

  it("prefers a static route over a param route of the same length", () => {
    mount("/send/new");
    expect(text_("page")).toBe("send.new");
    expect(orderPages(registry.pages).map((p) => p.id)).toEqual([
      "send.new",
      "send",
      "settings",
      "portfolio",
    ]);
  });

  it("renders the app-level not-found state for unknown routes", async () => {
    mount("/nowhere/at/all");
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Page not foundNo page matches /nowhere/at/all.",
    );
  });

  it("reports params that fail the page schema as issues", () => {
    mount("/send/acc-1?step=0");
    expect(text_("status")).toBe("invalid");
    expect(text_("issues")).toBe("step");
    expect(text_("params")).toBe("{}");
  });

  it("resolves a denied page with its recovery target and recovers through nav", async () => {
    const memory = mount("/send/acc-1", viewer);
    expect(text_("status")).toBe("denied");
    await click("recover");
    expect(memory.history.at(-1)).toBe("/");
    expect(text_("page")).toBe("portfolio");
    expect(text_("status")).toBe("ready");
  });
});

describe("useNav", () => {
  it("navigates to a page with a deterministic href", async () => {
    const memory = mount("/");
    await click("to send");
    expect(memory.history).toEqual(["/", "/send/acc-1?step=2&token=PAX"]);
    expect(text_("page")).toBe("send");
    expect(JSON.parse(text_("params") ?? "")).toEqual({ account: "acc-1", token: "PAX", step: 2 });
  });

  it("returns a validation outcome and does not navigate when params fail the schema", async () => {
    const memory = mount("/");
    await click("to send invalid");
    expect(memory.history).toEqual(["/"]);
    expect(text_("page")).toBe("portfolio");
    expect(text_("last")).toMatch(/^invalid params for page "send": account /);
  });

  it("replaces the current entry", async () => {
    const memory = mount("/");
    await click("replace settings");
    expect(memory.history).toEqual(["/settings"]);
    expect(text_("page")).toBe("settings");
  });

  it("goes back to the declared back target carrying matching params", async () => {
    const memory = mount("/send/acc-1?token=PAX");
    await click("back");
    expect(memory.history.at(-1)).toBe("/");
    expect(text_("page")).toBe("portfolio");
    await click("back");
    expect(text_("last")).toBe('page "portfolio" declares no back target');
  });

  it("restores the same screen when the URL is reloaded", async () => {
    const first = mount("/");
    await click("to send");
    const href = first.history.at(-1) as string;
    const before = text_("params");
    cleanup();
    mount(href);
    expect(text_("page")).toBe("send");
    expect(text_("params")).toBe(before);
  });

  it("serializes route drafts into the URL and restores them on reload", async () => {
    const memory = mount("/send/acc-1?token=PAX");
    expect(text_("draft")).toBe("route:null");
    await click("save draft");
    const href = memory.history.at(-1) as string;
    expect(href).toBe(`/send/acc-1?token=PAX&draft=${encodeURIComponent('{"amount":"12.5"}')}`);
    expect(memory.history).toHaveLength(1);
    expect(text_("draft")).toBe('route:{"amount":"12.5"}');
    expect(JSON.parse(text_("params") ?? "")).toEqual({ account: "acc-1", token: "PAX", step: 1 });
    cleanup();
    mount(href);
    expect(text_("draft")).toBe('route:{"amount":"12.5"}');
  });

  it("keeps session drafts in session storage across remounts", async () => {
    mount("/settings");
    expect(text_("draft")).toBe("session:null");
    await click("save draft");
    expect(text_("draft")).toBe('session:{"amount":"12.5"}');
    expect(sessionStorage.getItem(draftStorageKey("settings"))).toBe('{"amount":"12.5"}');
    cleanup();
    mount("/settings");
    expect(text_("draft")).toBe('session:{"amount":"12.5"}');
  });
});

describe("route changes", () => {
  it("runs the update directly when the page transition is none or the View Transitions API is absent", () => {
    const started: string[] = [];
    const host: ViewTransitionHost = {
      startViewTransition: (update?: ViewTransitionUpdateCallback | StartViewTransitionOptions) => {
        started.push(typeof update === "function" ? "callback" : "options");
        const done = Promise.resolve();
        return {
          updateCallbackDone: done,
          ready: done,
          finished: done,
          skipTransition: () => undefined,
          types: new Set<string>() as ViewTransitionTypeSet,
        };
      },
    };
    const updates: string[] = [];
    runRouteChange("none", () => updates.push("none"), host);
    runRouteChange("view", () => updates.push("absent"), {});
    runRouteChange("view", () => updates.push("no document"), undefined);
    expect(updates).toEqual(["none", "absent", "no document"]);
    expect(started).toEqual([]);
  });

  it("keeps useNav navigating to a view-transition page when the API is absent", async () => {
    expect("startViewTransition" in document).toBe(false);
    const memory = mount("/");
    await click("to send");
    expect(memory.history.at(-1)).toBe("/send/acc-1?step=2&token=PAX");
    expect(text_("page")).toBe("send");
  });
});

const paramsOf = (declared: { readonly params: Parameters<typeof standardJsonSchema>[0] }) =>
  standardJsonSchema(declared.params, "input");

describe("hrefs and params", () => {
  it("builds hrefs from declarations and rejects invalid or reserved params", () => {
    expect(pageHref(sendPage, { account: "a/b", step: 2 }, {}, paramsOf(sendPage))).toEqual({
      ok: true,
      href: "/send/a%2Fb?step=2",
    });
    expect(pageHref(portfolio, {}, {}, paramsOf(portfolio))).toEqual({ ok: true, href: "/" });
    const invalid = pageHref(sendPage, { account: "a", step: "two" }, {}, paramsOf(sendPage));
    expect(invalid.ok).toBe(false);
    const reserved = page("reserved", {
      route: "/reserved",
      params: z.object({ act: text().optional() }),
    });
    expect(pageHref(reserved, { act: "x" }, {}, paramsOf(reserved))).toEqual({
      ok: false,
      issues: [{ path: "act", message: '"act" is reserved by Rex URL invocation' }],
    });
  });

  it("round-trips params through the URL", () => {
    const href = pageHref(
      sendPage,
      { account: "acc 9", token: "true", step: 4 },
      {},
      paramsOf(sendPage),
    );
    expect(href.ok).toBe(true);
    if (!href.ok) return;
    const [path, search = ""] = href.href.split("?");
    const account = (path as string).split("/")[2] as string;
    expect(parsePageParams(sendPage, { account }, search, paramsOf(sendPage))).toEqual({
      ok: true,
      params: { account: "acc 9", token: "true", step: 4 },
    });
  });

  it("types navigation params against the page declaration", () => {
    function typeOnly(nav: Nav) {
      nav.to(sendPage, { account: "a" });
      nav.to(sendPage, { account: "a", step: 2, token: "PAX" });
      nav.to(portfolio);
      nav.href(settings, {});
      // @ts-expect-error account is required by the send page params
      nav.to(sendPage, {});
      // @ts-expect-error step must be a number
      nav.to(sendPage, { account: "a", step: "two" });
      // @ts-expect-error the send page requires params
      nav.to(sendPage);
      // @ts-expect-error back takes no arguments
      nav.back(portfolio);
    }
    expectTypeOf(typeOnly).toBeFunction();
    expectTypeOf<Parameters<Nav["to"]>>().not.toBeNever();
  });
});

describe("useNav in a static build", () => {
  const requested: string[] = [];
  const recordingFetch: RexFetch = (input, init) => {
    requested.push(input instanceof Request ? input.url : String(input));
    return globalThis.fetch(input, init);
  };

  function mountStatic(path: string, subject: Actor = owner) {
    vi.stubEnv(STATIC_HOST_ENV_KEY, "true");
    window.history.replaceState(null, "", "/start");
    const memory = memoryLocation({ path, record: true });
    const RexApp = createRexApp({
      registry,
      manifest,
      actor: subject,
      baseUrl: "http://rex.test",
      fetch: recordingFetch,
    });
    render(
      <RexApp>
        <Router hook={memory.hook}>
          <RexRoutes render={(resolution) => <Screen resolution={resolution} />} />
        </Router>
      </RexApp>,
    );
    return memory;
  }

  async function documentAt(href: string): Promise<void> {
    await vi.waitFor(() =>
      expect(`${window.location.pathname}${window.location.search}`).toBe(href),
    );
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState(null, "", "/");
    requested.length = 0;
  });

  it("loads the target page as a document instead of a router transition, with no fetch", async () => {
    const memory = mountStatic("/");
    expect(isStaticHost()).toBe(true);
    await click("to send");
    expect(text_("last")).toBe("/send/acc-1?step=2&token=PAX");
    await documentAt("/send/acc-1?step=2&token=PAX");
    expect(memory.history).toEqual(["/"]);
    expect(text_("page")).toBe("portfolio");
    expect(requested).toEqual([]);
  });

  it("replaces the document for nav.replace and loads the back target for nav.back", async () => {
    let memory = mountStatic("/");
    await click("replace settings");
    await documentAt("/settings");
    expect(memory.history).toEqual(["/"]);
    cleanup();

    memory = mountStatic("/send/acc-1?token=PAX");
    await click("back");
    await documentAt("/");
    expect(memory.history).toEqual(["/send/acc-1?token=PAX"]);
    expect(text_("page")).toBe("send");
    expect(requested).toEqual([]);
  });

  it("loads the recovery page as a document and leaves the document alone on invalid params", async () => {
    const memory = mountStatic("/send/acc-1", viewer);
    expect(text_("status")).toBe("denied");
    await click("recover");
    await documentAt("/");
    expect(memory.history).toEqual(["/send/acc-1"]);
    cleanup();

    window.history.replaceState(null, "", "/start");
    mountStatic("/");
    await click("to send invalid");
    expect(text_("last")).toMatch(/^invalid params for page "send": account /);
    expect(window.location.pathname).toBe("/start");
    expect(requested).toEqual([]);
  });
});
