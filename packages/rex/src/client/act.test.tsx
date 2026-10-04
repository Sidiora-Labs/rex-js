import { ORPCError, os } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { useQuery } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { action, type AnyAction } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { always, evaluate, never, policy } from "../core/policy.ts";
import {
  CONFIRM_PROCEDURE,
  REX_CONFIRM_HEADER as CONFIRM_HEADER,
  REX_RPC_PREFIX as REX_RPC_PATH,
} from "../core/protocol.ts";
import { createRegistry } from "../core/registry.ts";
import { money, text } from "../schema/index.ts";
import { z } from "zod/mini";
import type { StandardSchemaV1 } from "../core/standard.ts";
import { buildManifest, stableStringify } from "../manifest/build.ts";
import { useAct, type ActHandle } from "./act.ts";
import { createRexApp, type RexFetch } from "./app.tsx";
import {
  APP_OUTCOME_KEY,
  createOutcomeStore,
  OutcomeProvider,
  useOutcome,
  type OutcomeStore,
} from "./outcome.ts";
import { RexRoutes } from "./router.tsx";

const wallet = policy("wallet", {
  permissions: ["view", "send"],
  resolve: (subject) => subject.permissions.filter((p) => p === "view" || p === "send"),
});

const rename = action("rename", {
  input: z.object({ name: text({ min: 1 }) }),
  output: z.object({ name: text() }),
  policy: always(),
  effect: "reversible",
  label: "Rename",
  invalidates: ["balance"],
  handler: (input) => ({ name: input.name.trim() }),
});

const send = action("send", {
  input: z.object({ amount: money() }),
  output: z.object({ sent: money() }),
  policy: wallet.can("send"),
  effect: "irreversible",
  label: "Send",
  handler: (input) => ({ sent: input.amount }),
});

const purge = action("purge", {
  input: z.object({}),
  output: z.object({ purged: z.boolean() }),
  policy: never(),
  effect: "reversible",
  label: "Purge",
  handler: () => ({ purged: true }),
});

const archive = action("archive", {
  input: z.object({ id: text({ min: 1 }) }),
  output: z.object({ archived: z.boolean() }),
  policy: always(),
  effect: "reversible",
  handler: () => {
    throw new ORPCError("FORBIDDEN", { message: "archive is closed for this account" });
  },
});

const tipAmount: StandardSchemaV1<{ amount: string }, { amount: number }> = {
  "~standard": {
    version: 1,
    vendor: "hand",
    validate: (value) => {
      const raw = (value as { amount?: unknown } | null)?.amount;
      const amount = typeof raw === "string" ? Number(raw) : Number.NaN;
      return Number.isFinite(amount) && amount > 0
        ? { value: { amount } }
        : { issues: [{ message: "must be a positive decimal", path: ["amount"] }] };
    },
  },
};
const tipped: StandardSchemaV1<{ tipped: number }> = {
  "~standard": {
    version: 1,
    vendor: "hand",
    validate: (value) =>
      typeof (value as { tipped?: unknown } | null)?.tipped === "number"
        ? { value: value as { tipped: number } }
        : { issues: [{ message: "must report the tip", path: ["tipped"] }] },
  },
};
const tip = action("tip", {
  input: tipAmount,
  output: tipped,
  policy: always(),
  effect: "reversible",
  label: "Tip",
  jsonSchema: {
    input: { type: "object", properties: { amount: { type: "string" } }, required: ["amount"] },
    output: { type: "object", properties: { tipped: { type: "number" } }, required: ["tipped"] },
  },
  handler: (input) => ({ tipped: input.amount }),
});

const home = page("home", { route: "/", actions: [rename, send, purge, archive, tip] });

const registry = createRegistry()
  .register(wallet, rename, send, purge, archive, tip, home)
  .freeze();
const manifest = buildManifest(registry);
const owner = actor({ id: "owner", permissions: ["view", "send"] });

const confirmTokens = new Map<string, string>();
let tokenCount = 0;

function grantKey(actionId: string, input: unknown): string {
  return `${actionId}:${stableStringify(input, 0)}`;
}

const procedures = os.$context<{ headers: Headers }>();

function implement(declared: AnyAction) {
  return procedures
    .input(declared.input)
    .output(declared.output)
    .handler(async ({ input, context }) => {
      const decision = evaluate(declared.policy, owner);
      if (!decision.allowed) throw new ORPCError("FORBIDDEN", { message: decision.reason });
      if (declared.effect === "irreversible") {
        const token = context.headers.get(CONFIRM_HEADER);
        if (token === null || confirmTokens.get(token) !== grantKey(declared.id, input)) {
          throw new ORPCError("PRECONDITION_REQUIRED", { message: "confirmation required" });
        }
        confirmTokens.delete(token);
      }
      return declared.handler(input, { actor: owner });
    });
}

const rpc = new RPCHandler({
  [CONFIRM_PROCEDURE]: procedures
    .input(z.object({ action: z.string(), input: z.unknown() }))
    .output(z.object({ token: z.string(), expiresAt: z.string() }))
    .handler(({ input }) => {
      tokenCount += 1;
      const token = `token-${tokenCount}`;
      confirmTokens.set(token, grantKey(input.action, input.input));
      return { token, expiresAt: new Date(Date.now() + 60_000).toISOString() };
    }),
  rename: implement(rename),
  send: implement(send),
  purge: implement(purge),
  archive: implement(archive),
  tip: implement(tip),
});

interface Harness {
  readonly requests: string[];
  readonly handles: Record<string, ActHandle<AnyAction>>;
  readonly store: OutcomeStore;
  balanceFetches(): number;
}

function Probe({ handles }: { readonly handles: Record<string, ActHandle<AnyAction>> }) {
  handles.rename = useAct(rename) as unknown as ActHandle<AnyAction>;
  handles.send = useAct(send) as unknown as ActHandle<AnyAction>;
  handles.purge = useAct(purge) as unknown as ActHandle<AnyAction>;
  handles.archive = useAct(archive) as unknown as ActHandle<AnyAction>;
  handles.tip = useAct(tip) as unknown as ActHandle<AnyAction>;
  const outcome = useOutcome("home");
  return (
    <div>
      <button type="button" {...handles.rename.controlProps}>
        Rename
      </button>
      <button type="button" {...handles.purge.controlProps}>
        Purge
      </button>
      <p data-testid="outcome">
        {outcome === null ? "none" : `${outcome.actionId}|${outcome.ok}|${outcome.message}`}
      </p>
    </div>
  );
}

function Balance({ counter }: { readonly counter: { count: number } }) {
  const query = useQuery({
    queryKey: ["balance"],
    queryFn: () => {
      counter.count += 1;
      return counter.count;
    },
  });
  return <p data-testid="balance">{query.data ?? "loading"}</p>;
}

function mount(): Harness {
  const requests: string[] = [];
  const fetch: RexFetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const path = decodeURIComponent(new URL(request.url).pathname);
    const token = request.headers.get(CONFIRM_HEADER);
    requests.push(token === null ? path : `${path} ${token}`);
    const { matched, response } = await rpc.handle(request, {
      prefix: REX_RPC_PATH,
      context: { headers: request.headers },
    });
    return matched ? response : new Response("not found", { status: 404 });
  };
  const handles: Record<string, ActHandle<AnyAction>> = {};
  const store = createOutcomeStore();
  const counter = { count: 0 };
  const RexApp = createRexApp({
    registry,
    manifest,
    actor: owner,
    fetch,
    baseUrl: "http://rex.test",
  });
  const memory = memoryLocation({ path: "/" });
  render(
    <OutcomeProvider store={store}>
      <RexApp>
        <Router hook={memory.hook}>
          <RexRoutes
            render={() => (
              <div>
                <Balance counter={counter} />
                <Probe handles={handles} />
              </div>
            )}
          />
        </Router>
      </RexApp>
    </OutcomeProvider>,
  );
  return { requests, handles, store, balanceFetches: () => counter.count };
}

function handle(harness: Harness, id: string): ActHandle<AnyAction> {
  const found = harness.handles[id];
  if (found === undefined) throw new Error(`no handle for ${id}`);
  return found;
}

afterEach(() => {
  cleanup();
  confirmTokens.clear();
});

describe("useAct", () => {
  it("runs an action through the oRPC client, records the outcome and invalidates queries", async () => {
    const harness = mount();
    await waitFor(() => expect(screen.getByTestId("balance").textContent).toBe("1"));
    const button = screen.getByRole("button", { name: "Rename" });
    expect(button.getAttribute("data-rex")).toBe("home/rename");
    expect(button.getAttribute("data-rex-allowed")).toBe("true");
    expect((button as HTMLButtonElement).disabled).toBe(false);

    let result: Awaited<ReturnType<ActHandle<AnyAction>["run"]>> | undefined;
    await act(async () => {
      result = await handle(harness, "rename").run({ name: " Ada " });
    });
    expect(result).toEqual({ ok: true, output: { name: "Ada" } });
    expect(harness.requests).toEqual([`${REX_RPC_PATH}/rename`]);
    expect(screen.getByTestId("outcome").textContent).toBe("rename|true|Rename succeeded");
    await waitFor(() => expect(screen.getByTestId("balance").textContent).toBe("2"));
    expect(harness.balanceFetches()).toBe(2);
    const stored = harness.store.get("home");
    expect(stored?.actionId).toBe("rename");
    expect(Number.isNaN(Date.parse(stored?.at ?? ""))).toBe(false);
  });

  it("writes a validation outcome without calling the server or throwing", async () => {
    const harness = mount();
    let result: Awaited<ReturnType<ActHandle<AnyAction>["run"]>> | undefined;
    await act(async () => {
      result = await handle(harness, "rename").run({ name: "" });
    });
    expect(result?.ok).toBe(false);
    expect(result).toMatchObject({ code: "BAD_REQUEST" });
    expect(harness.requests).toEqual([]);
    expect(screen.getByTestId("outcome").textContent).toMatch(
      /^rename\|false\|Rename: invalid input: name /,
    );
  });

  it("refuses an action the client policy denies and disables its control", async () => {
    const harness = mount();
    const purgeHandle = handle(harness, "purge");
    expect(purgeHandle.allowed).toBe(false);
    expect(purgeHandle.reason).toBe("never");
    const button = screen.getByRole("button", { name: "Purge" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("data-rex-allowed")).toBe("false");
    expect(button.getAttribute("title")).toBe("Not allowed: never");
    let result: Awaited<ReturnType<ActHandle<AnyAction>["run"]>> | undefined;
    await act(async () => {
      result = await purgeHandle.run({});
    });
    expect(result).toEqual({ ok: false, code: "FORBIDDEN", message: "Purge: not allowed (never)" });
    expect(harness.requests).toEqual([]);
    expect(screen.getByTestId("outcome").textContent).toBe(
      "purge|false|Purge: not allowed (never)",
    );
  });

  it("records a server FORBIDDEN as a failed outcome; the server is authoritative", async () => {
    const harness = mount();
    expect(handle(harness, "archive").allowed).toBe(true);
    let result: Awaited<ReturnType<ActHandle<AnyAction>["run"]>> | undefined;
    await act(async () => {
      result = await handle(harness, "archive").run({ id: "acc-1" });
    });
    expect(result).toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "archive is closed for this account",
    });
    expect(harness.requests).toEqual([`${REX_RPC_PATH}/archive`]);
    expect(screen.getByTestId("outcome").textContent).toBe(
      "archive|false|archive failed: archive is closed for this account",
    );
  });

  it("requests a confirm token before running an irreversible action", async () => {
    const harness = mount();
    let result: Awaited<ReturnType<ActHandle<AnyAction>["run"]>> | undefined;
    await act(async () => {
      result = await handle(harness, "send").run({ amount: "12.50" });
    });
    expect(result).toEqual({ ok: true, output: { sent: "12.50" } });
    expect(harness.requests).toEqual([
      `${REX_RPC_PATH}/${CONFIRM_PROCEDURE}`,
      `${REX_RPC_PATH}/send token-${tokenCount}`,
    ]);
    expect(screen.getByTestId("outcome").textContent).toBe("send|true|Send succeeded");
  });

  it("uses a confirm token obtained ahead of time and fails on a mismatched token", async () => {
    const harness = mount();
    const sendHandle = handle(harness, "send");
    let grantToken = "";
    await act(async () => {
      grantToken = (await sendHandle.requestConfirm({ amount: "5" })).token;
    });
    let mismatch: Awaited<ReturnType<ActHandle<AnyAction>["run"]>> | undefined;
    await act(async () => {
      mismatch = await sendHandle.run({ amount: "6" }, { confirmToken: grantToken });
    });
    expect(mismatch).toEqual({
      ok: false,
      code: "PRECONDITION_REQUIRED",
      message: "confirmation required",
    });
    expect(screen.getByTestId("outcome").textContent).toBe(
      "send|false|Send failed: confirmation required",
    );
    let matched: Awaited<ReturnType<ActHandle<AnyAction>["run"]>> | undefined;
    await act(async () => {
      matched = await handle(harness, "send").run({ amount: "5" }, { confirmToken: grantToken });
    });
    expect(matched).toEqual({ ok: true, output: { sent: "5" } });
    expect(harness.requests).toEqual([
      `${REX_RPC_PATH}/${CONFIRM_PROCEDURE}`,
      `${REX_RPC_PATH}/send ${grantToken}`,
      `${REX_RPC_PATH}/send ${grantToken}`,
    ]);
  });
});

describe("useAct with a hand-written Standard Schema", () => {
  it("validates input through ~standard.validate before calling the server", async () => {
    const harness = mount();
    await waitFor(() => expect(screen.getByTestId("balance").textContent).toBe("1"));
    let result: Awaited<ReturnType<ActHandle<AnyAction>["run"]>> | undefined;
    await act(async () => {
      result = await handle(harness, "tip").run({ amount: "nope" });
    });
    expect(result).toEqual({
      ok: false,
      code: "BAD_REQUEST",
      message: "Tip: invalid input: amount must be a positive decimal",
    });
    expect(harness.requests).toEqual([]);
    expect(screen.getByTestId("outcome").textContent).toBe(
      "tip|false|Tip: invalid input: amount must be a positive decimal",
    );
  });

  it("runs the action and validates the output through ~standard.validate", async () => {
    const harness = mount();
    await waitFor(() => expect(screen.getByTestId("balance").textContent).toBe("1"));
    let result: Awaited<ReturnType<ActHandle<AnyAction>["run"]>> | undefined;
    await act(async () => {
      result = await handle(harness, "tip").run({ amount: "1.5" });
    });
    expect(result).toEqual({ ok: true, output: { tipped: 1.5 } });
    expect(harness.requests).toEqual([`${REX_RPC_PATH}/tip`]);
    expect(screen.getByTestId("outcome").textContent).toBe("tip|true|Tip succeeded");
  });
});

describe("outcome store", () => {
  it("keeps the last outcome per page and notifies subscribers", () => {
    const store = createOutcomeStore();
    let notified = 0;
    const unsubscribe = store.subscribe(() => {
      notified += 1;
    });
    const at = new Date(0).toISOString();
    store.set("home", { actionId: "rename", ok: true, message: "Rename succeeded", at });
    store.set("send", { actionId: "send", ok: false, message: "Send failed", at });
    store.set("home", { actionId: "purge", ok: false, message: "Purge failed", at });
    expect(store.get("home")).toEqual({ actionId: "purge", ok: false, message: "Purge failed", at });
    expect(store.get("send")?.actionId).toBe("send");
    expect(store.get(APP_OUTCOME_KEY)).toBeNull();
    store.clear("home");
    store.clear("home");
    expect(store.get("home")).toBeNull();
    expect(notified).toBe(4);
    unsubscribe();
    store.set("home", { actionId: "rename", ok: true, message: "ok", at });
    expect(notified).toBe(4);
    const invalidOutcome = expect.objectContaining({ name: "RexError", code: "REX322" });
    expect(() => store.set("home", { actionId: "", ok: true, message: "", at })).toThrow(
      invalidOutcome,
    );
    expect(() => store.set("home", { actionId: "x", ok: true, message: "", at: "later" })).toThrow(
      invalidOutcome,
    );
  });
});
