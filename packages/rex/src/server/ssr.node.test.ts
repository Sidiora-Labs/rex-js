import { Suspense, createElement, use } from "react";
import { describe, expect, it } from "vitest";
import { z } from "zod/mini";
import type { RexEntryBundle } from "../client/entry.tsx";
import { ActionForm } from "../client/form.tsx";
import { region, view, type LazyPageModuleSet, type LoadedPageModules } from "../client/page.tsx";
import { action } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import { page, type AnyPage } from "../core/page.ts";
import { can } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { buildManifest } from "../manifest/build.ts";
import { text } from "../schema/index.ts";
import { DEFAULT_DENSITY } from "./context.ts";
import { CSRF_FIELD } from "./form.ts";
import { createRexRenderer } from "./ssr.ts";

const STATE_EXPORTS = [
  "Loading",
  "Empty",
  "Stale",
  "Partial",
  "Offline",
  "PermissionDenied",
  "RecoverableError",
  "TerminalError",
] as const;

function statesFor(label: string): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    STATE_EXPORTS.map((name) => [name, () => createElement("p", null, `${label}: ${name}`)]),
  );
}

function lazySet(declared: AnyPage, loaded: LoadedPageModules): LazyPageModuleSet {
  let loading: Promise<LoadedPageModules> | null = null;
  return Object.freeze({
    page: declared,
    chunk: `page-${declared.id}`,
    load: () => {
      loading ??= Promise.resolve().then(() => loaded);
      return loading;
    },
  });
}

const subscribe = action("subscribe", {
  input: z.object({ email: text({ min: 3, max: 120 }) }),
  output: z.object({ email: text() }),
  policy: can("notes.write"),
  effect: "reversible",
  label: "Subscribe",
  handler: (input) => ({ email: input.email }),
});

const signup = page("signup", {
  route: "/signup",
  actions: [subscribe],
  chrome: { title: "Sign up" },
  regions: ["form"],
});

const SignupForm = region("form", () => createElement(ActionForm, { action: subscribe }));
const signupRegistry = createRegistry().register(subscribe, signup).freeze();
const signupBundle: RexEntryBundle = {
  registry: signupRegistry,
  manifest: buildManifest(signupRegistry, { app: "ssr-csrf" }),
  pages: [
    lazySet(signup, {
      view: view(() => createElement(SignupForm)),
      states: statesFor("Sign up"),
      regions: { form: SignupForm },
      overlays: {},
    }),
  ],
};

const waitlist = page("waitlist", {
  route: "/waitlist",
  actions: [subscribe],
  chrome: { title: "Waitlist" },
  regions: ["form"],
});

const SUSPENDED_MS = 40;
let opening: Promise<void> | null = null;

function waitlistOpens(): Promise<void> {
  opening ??= new Promise<void>((resolve) => {
    setTimeout(resolve, SUSPENDED_MS);
  });
  return opening;
}

const WAITLIST_SEATS = 400;

function OpenedForm() {
  use(waitlistOpens());
  return createElement(
    "div",
    null,
    createElement(
      "ol",
      { "data-waitlist-seats": "" },
      Array.from({ length: WAITLIST_SEATS }, (_, seat) =>
        createElement("li", { key: seat }, `Seat ${seat + 1} on the waitlist is still open`),
      ),
    ),
    createElement(ActionForm, { action: subscribe }),
  );
}

const WaitlistForm = region("form", () =>
  createElement(
    Suspense,
    { fallback: createElement("p", { "data-waitlist-pending": "" }, "Opening the waitlist") },
    createElement(OpenedForm),
  ),
);
const waitlistRegistry = createRegistry().register(subscribe, waitlist).freeze();
const waitlistBundle: RexEntryBundle = {
  registry: waitlistRegistry,
  manifest: buildManifest(waitlistRegistry, { app: "ssr-suspended" }),
  pages: [
    lazySet(waitlist, {
      view: view(() => createElement(WaitlistForm)),
      states: statesFor("Waitlist"),
      regions: { form: WaitlistForm },
      overlays: {},
    }),
  ],
};

const owner = actor({ id: "owner", roles: ["owner"], permissions: ["notes.write"] });

function csrfFieldOf(html: string): string | null {
  const input = new RegExp(`<input type="hidden" name="${CSRF_FIELD}" value="([^"]*)"/>`).exec(
    html,
  );
  return input === null ? null : (input[1] as string);
}

describe("the CSRF token in server-rendered forms without a DOM", () => {
  it("renders an empty token when no grant is bound, as prerendering does", async () => {
    expect(globalThis.document).toBeUndefined();
    const renderer = createRexRenderer({ bundle: signupBundle });
    const result = await renderer.render(
      new Request("http://localhost/signup", { headers: { accept: "text/html" } }),
      { actor: owner, density: DEFAULT_DENSITY, nonce: "0123456789abcdef0123456789abcdef" },
    );
    expect(result.kind).toBe("page");
    expect(csrfFieldOf(await new Response(result.body).text())).toBe("");
  });
});

describe("a suspended region in a server-rendered document", () => {
  it("renders the form inline and visible once its Suspense boundary resolves", async () => {
    const renderer = createRexRenderer({ bundle: waitlistBundle });
    const result = await renderer.render(
      new Request("http://localhost/waitlist", { headers: { accept: "text/html" } }),
      { actor: owner, density: DEFAULT_DENSITY, nonce: "0123456789abcdef0123456789abcdef" },
    );
    expect(result.kind).toBe("page");
    const html = await new Response(result.body).text();
    expect(html).not.toContain("Opening the waitlist");
    expect(html).not.toContain("data-waitlist-pending");
    expect(html).not.toMatch(/<div hidden id="S:/);
    expect(html).not.toContain("$RC");
    expect(html).not.toContain("data-rex-page-loading");
    expect(html).not.toContain("<!--$?-->");
    expect(html).toContain(`Seat ${WAITLIST_SEATS} on the waitlist is still open`);
    const regionAt = html.indexOf('data-rex-region="waitlist/form"');
    const formTag = /<form\b[^>]*\bdata-rex-form="waitlist\/subscribe"[^>]*>/.exec(html);
    expect(formTag?.[0]).toContain('method="post"');
    expect(formTag?.[0]).toContain('action="/rex/form/subscribe"');
    const formAt = formTag?.index ?? -1;
    const submitAt = html.indexOf('<button type="submit"', formAt);
    const sectionEnd = html.indexOf("</section>", regionAt);
    expect(regionAt).toBeGreaterThan(-1);
    expect(formAt).toBeGreaterThan(regionAt);
    expect(submitAt).toBeGreaterThan(formAt);
    expect(sectionEnd).toBeGreaterThan(submitAt);
    expect(csrfFieldOf(html)).toBe("");
  });
});
