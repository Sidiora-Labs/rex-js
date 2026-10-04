import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToReadableStream, renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { actor } from "../core/actor.ts";
import { REX_ERROR_CATALOG } from "../core/errors.ts";
import { page } from "../core/page.ts";
import { createRegistry } from "../core/registry.ts";
import { standardJsonSchema } from "../manifest/json-schema.ts";
import { formatMessage } from "./i18n/format.ts";
import { messageFormatter } from "./i18n/formatter.ts";
import {
  LAZY_FAILURE_CODE,
  lazyFailureOutcome,
  lazyModule,
  useLazyModule,
  type LazyModule,
  type LazyModuleOptions,
  type LazyResult,
} from "./lazy.ts";
import { APP_OUTCOME_KEY, OutcomeProvider, createOutcomeStore } from "./outcome.ts";
import { ActiveRouteContext, resolvePage } from "./router.tsx";

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}

interface Counted<T> {
  readonly module: LazyModule<T>;
  calls(): number;
}

function counted<T>(id: string, label: string, importer: () => Promise<T>): Counted<T> {
  let calls = 0;
  const module = lazyModule(id, label, () => {
    calls += 1;
    return importer();
  });
  return { module, calls: () => calls };
}

function describeResult<T>(result: LazyResult<T> | null): string {
  if (result === null) return "pending";
  return result.ok ? `loaded ${String(result.value)}` : `failed ${result.error.message}`;
}

interface ProbeProps<T> {
  readonly module: LazyModule<T>;
  readonly options?: LazyModuleOptions;
  readonly seen: (LazyResult<T> | null)[];
}

function Probe<T>({ module, options, seen }: ProbeProps<T>) {
  const result = useLazyModule(module, options);
  seen.push(result);
  return <p data-testid="state">{describeResult(result)}</p>;
}

const portfolio = page("portfolio", { route: "/", states: ["ready"] });
const registry = createRegistry().register(portfolio).freeze();
const viewer = actor({ id: "viewer" });

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("lazyModule", () => {
  it("imports once, shares the in-flight load and keeps the settled value", async () => {
    const { module, calls } = counted("test.greeting", "the greeting", () =>
      Promise.resolve("hello"),
    );
    expect(module.id).toBe("test.greeting");
    expect(module.label).toBe("the greeting");
    expect(module.peek()).toBeNull();
    expect(calls()).toBe(0);
    const first = module.load();
    expect(module.load()).toBe(first);
    expect(calls()).toBe(1);
    const result = await first;
    expect(result).toEqual({ ok: true, value: "hello" });
    expect(module.peek()).toBe(result);
    await expect(module.load()).resolves.toBe(result);
    expect(calls()).toBe(1);
  });

  it("settles a rejected import as a failure and does not retry it", async () => {
    const { module, calls } = counted("test.broken", "the broken part", () =>
      Promise.reject(new Error("boom")),
    );
    const result = await module.load();
    if (result.ok) throw new Error("expected the load to fail");
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe("boom");
    expect(module.peek()).toBe(result);
    await expect(module.load()).resolves.toBe(result);
    expect(calls()).toBe(1);

    const plain = lazyModule("test.plain", "the plain part", () => Promise.reject("denied"));
    const wrapped = await plain.load();
    if (wrapped.ok) throw new Error("expected the load to fail");
    expect(wrapped.error).toBeInstanceOf(Error);
    expect(wrapped.error.message).toBe("denied");
  });
});

describe("lazyFailureOutcome", () => {
  it("describes the failure as a REX326 outcome the outcome store accepts", () => {
    expect(LAZY_FAILURE_CODE).toBe("REX326");
    expect(REX_ERROR_CATALOG[LAZY_FAILURE_CODE]).toBe("Script failed to load");
    const widget = lazyModule("rex.widget", "the widget", () => Promise.resolve(1));
    const before = Date.now();
    const outcome = lazyFailureOutcome(widget, new Error("network down"));
    expect(outcome).toEqual({
      actionId: "rex.widget",
      ok: false,
      message: "REX326 the widget failed to load: network down",
      at: expect.any(String) as string,
    });
    const at = Date.parse(outcome.at);
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
    expect(outcome.at).toBe(new Date(at).toISOString());
    const store = createOutcomeStore();
    store.set("portfolio", outcome);
    expect(store.get("portfolio")).toEqual(outcome);
  });
});

describe("useLazyModule", () => {
  it("renders null on the first client pass and the value once the import settles", async () => {
    const greeting = lazyModule("test.greeting", "the greeting", () => Promise.resolve("hello"));
    const seen: (LazyResult<string> | null)[] = [];
    render(<Probe module={greeting} seen={seen} />);
    expect(seen).toEqual([null]);
    expect(screen.getByTestId("state").textContent).toBe("pending");
    await screen.findByText("loaded hello");
    expect(seen.at(-1)).toEqual({ ok: true, value: "hello" });
    expect(seen.at(-1)).toBe(greeting.peek());

    cleanup();
    const again: (LazyResult<string> | null)[] = [];
    render(<Probe module={greeting} seen={again} />);
    expect(again[0]).toBe(greeting.peek());
    expect(screen.getByTestId("state").textContent).toBe("loaded hello");
  });

  it("hands the real message formatter to its consumer by identity", async () => {
    const seen: (LazyResult<typeof formatMessage> | null)[] = [];
    render(<Probe module={messageFormatter} seen={seen} />);
    await waitFor(() => expect(seen.at(-1)).toEqual({ ok: true, value: formatMessage }));
    await expect(messageFormatter.load()).resolves.toBe(seen.at(-1));
  });

  it("stays idle while inactive and loads once activated", async () => {
    const { module, calls } = counted("test.gated", "the gated part", () =>
      Promise.resolve("hello"),
    );
    const seen: (LazyResult<string> | null)[] = [];
    const rendered = render(<Probe module={module} options={{ active: false }} seen={seen} />);
    expect(seen).toEqual([null]);
    expect(calls()).toBe(0);
    expect(module.peek()).toBeNull();
    rendered.rerender(<Probe module={module} options={{ active: true }} seen={seen} />);
    await screen.findByText("loaded hello");
    expect(calls()).toBe(1);
    rendered.rerender(<Probe module={module} options={{ active: false }} seen={seen} />);
    expect(seen.at(-1)).toBeNull();
    expect(screen.getByTestId("state").textContent).toBe("pending");
    expect(module.peek()).toEqual({ ok: true, value: "hello" });
  });

  it("suspends on the client when asked to always suspend", async () => {
    const gate = deferred<string>();
    const module = lazyModule("test.suspended", "the suspended part", () => gate.promise);
    const seen: (LazyResult<string> | null)[] = [];
    await act(async () => {
      render(
        <Suspense fallback={<p data-testid="fallback">loading</p>}>
          <Probe module={module} options={{ suspend: "always" }} seen={seen} />
        </Suspense>,
      );
    });
    expect(screen.getByTestId("fallback").textContent).toBe("loading");
    expect(screen.queryByTestId("state")).toBeNull();
    expect(seen).toEqual([]);
    await act(async () => {
      gate.resolve("hello");
      await gate.promise;
    });
    await screen.findByText("loaded hello");
    expect(screen.queryByTestId("fallback")).toBeNull();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((result) => result !== null && result.ok)).toBe(true);
  });

  it("records a failed import as the app outcome and tells the caller", async () => {
    const store = createOutcomeStore();
    const module = lazyModule("test.broken", "the broken part", () =>
      Promise.reject(new Error("boom")),
    );
    const failures: Error[] = [];
    const onFailure = (error: Error) => {
      failures.push(error);
    };
    const seen: (LazyResult<never> | null)[] = [];
    render(
      <OutcomeProvider store={store}>
        <Probe module={module} options={{ onFailure }} seen={seen} />
      </OutcomeProvider>,
    );
    expect(store.get(APP_OUTCOME_KEY)).toBeNull();
    await screen.findByText("failed boom");
    await waitFor(() => expect(store.get(APP_OUTCOME_KEY)).not.toBeNull());
    expect(store.get(APP_OUTCOME_KEY)).toEqual({
      actionId: "test.broken",
      ok: false,
      message: "REX326 the broken part failed to load: boom",
      at: expect.any(String) as string,
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]?.message).toBe("boom");
    const last = seen.at(-1);
    if (last === null || last === undefined || last.ok) throw new Error("expected a failure");
    expect(last.error).toBe(failures[0]);
  });

  it("scopes the failure outcome to the active page or an explicit key", async () => {
    const store = createOutcomeStore();
    const resolution = resolvePage(
      portfolio,
      {},
      "",
      viewer,
      registry,
      standardJsonSchema(portfolio.params, "input"),
    );
    const module = lazyModule("test.page-broken", "the page part", () =>
      Promise.reject(new Error("offline")),
    );
    render(
      <OutcomeProvider store={store}>
        <ActiveRouteContext.Provider value={resolution}>
          <Probe module={module} seen={[]} />
          <Probe module={module} options={{ outcome: "drawer" }} seen={[]} />
        </ActiveRouteContext.Provider>
      </OutcomeProvider>,
    );
    await waitFor(() => expect(store.get("portfolio")).not.toBeNull());
    await waitFor(() => expect(store.get("drawer")).not.toBeNull());
    expect(store.get("portfolio")?.message).toBe("REX326 the page part failed to load: offline");
    expect(store.get("drawer")?.actionId).toBe("test.page-broken");
    expect(store.get(APP_OUTCOME_KEY)).toBeNull();
  });

  it("ignores a load that settles after the consumer unmounted", async () => {
    const store = createOutcomeStore();
    const gate = deferred<string>();
    const module = lazyModule("test.late", "the late part", () => gate.promise);
    const seen: (LazyResult<string> | null)[] = [];
    const rendered = render(
      <OutcomeProvider store={store}>
        <Probe module={module} seen={seen} />
      </OutcomeProvider>,
    );
    rendered.unmount();
    await act(async () => {
      gate.reject(new Error("late"));
      await module.load();
    });
    const result = await module.load();
    expect(result.ok).toBe(false);
    expect(seen).toEqual([null]);
    expect(store.get(APP_OUTCOME_KEY)).toBeNull();
  });

  it("server-renders a loaded module directly and streams a pending one once it settles", async () => {
    const ready = lazyModule("test.ready", "the ready part", () => Promise.resolve("hello"));
    await ready.load();
    const seenReady: (LazyResult<string> | null)[] = [];
    expect(renderToString(<Probe module={ready} seen={seenReady} />)).toBe(
      '<p data-testid="state">loaded hello</p>',
    );
    expect(seenReady).toEqual([{ ok: true, value: "hello" }]);

    const never = lazyModule("test.never", "the never part", () => Promise.resolve("hello"));
    expect(renderToString(<Probe module={never} options={{ suspend: "never" }} seen={[]} />)).toBe(
      '<p data-testid="state">pending</p>',
    );

    const gate = deferred<string>();
    const streamed = lazyModule("test.streamed", "the streamed part", () => gate.promise);
    const seen: (LazyResult<string> | null)[] = [];
    const rendering = renderToReadableStream(<Probe module={streamed} seen={seen} />);
    expect(seen).toEqual([]);
    gate.resolve("streamed");
    const html = await new Response(await rendering).text();
    expect(html).toBe('<p data-testid="state">loaded streamed</p>');
    expect(seen).toEqual([{ ok: true, value: "streamed" }]);
  });

  it("hydrates server markup by suspending until the module loads, without a pending pass", async () => {
    const server = lazyModule("test.hydrated", "the hydrated part", () => Promise.resolve("hello"));
    await server.load();
    const container = document.createElement("div");
    container.innerHTML = renderToString(
      <Suspense fallback={<p>loading</p>}>
        <Probe module={server} seen={[]} />
      </Suspense>,
    );
    document.body.append(container);
    const serverNode = container.querySelector('[data-testid="state"]');
    expect(serverNode?.textContent).toBe("loaded hello");
    const gate = deferred<string>();
    const client = lazyModule("test.hydrated", "the hydrated part", () => gate.promise);
    const seen: (LazyResult<string> | null)[] = [];
    const recoverable: unknown[] = [];
    const root = await act(async () =>
      hydrateRoot(
        container,
        <Suspense fallback={<p>loading</p>}>
          <Probe module={client} seen={seen} />
        </Suspense>,
        { onRecoverableError: (error) => recoverable.push(error) },
      ),
    );
    expect(container.querySelector('[data-testid="state"]')).toBe(serverNode);
    expect(seen).toEqual([]);
    await act(async () => {
      gate.resolve("hello");
      await gate.promise;
    });
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(seen.every((result) => result !== null && result.ok)).toBe(true);
    expect(container.querySelector('[data-testid="state"]')).toBe(serverNode);
    expect(serverNode?.textContent).toBe("loaded hello");
    expect(recoverable).toEqual([]);
    await act(async () => {
      root.unmount();
    });
  });
});
