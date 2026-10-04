import { cleanup, render, screen } from "@testing-library/react";
import { isValidElement, useContext, type ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { createRegistry } from "../core/registry.ts";
import { buildManifest } from "../manifest/build.ts";
import { ConfirmContext, ConfirmProvider, useConfirm } from "./agent/confirm.tsx";
import { createRexApp } from "./app.tsx";
import { DevtoolsStoreContext } from "./devtools/store.ts";
import { registerI18n, useI18n, useText } from "./i18n/context.ts";
import { messageFormatter } from "./i18n/formatter.ts";
import { I18nProvider } from "./i18n/provider.tsx";
import * as client from "./index.ts";
import {
  REX_PROVIDERS,
  RexProviders,
  composeProviders,
  type RexProvider,
  type RexProviderProps,
} from "./providers.ts";
import { DevtoolsProvider } from "./shell/devtools-slot.tsx";

const home = page("home", { route: "/", chrome: { title: "msg:home.title" }, states: ["ready"] });
const registry = createRegistry().register(home).freeze();
const manifest = buildManifest(registry);
const viewer = actor({ id: "viewer" });
const unregisterI18n = registerI18n(registry, {
  config: { locales: ["en", "pt-BR"], default: "en" },
  messages: { en: { "home.title": "Home" }, "pt-BR": { "home.title": "Início" } },
});

function Probe() {
  const confirm = useContext(ConfirmContext);
  const { source, locale } = useI18n();
  const text = useText();
  const devtools = useContext(DevtoolsStoreContext);
  return (
    <p data-testid="probe">
      {[
        confirm === null ? "no-confirm" : "confirm",
        source === null ? "no-i18n" : `${locale}:${text("msg:home.title")}`,
        devtools === null ? "no-devtools" : "devtools",
      ].join(" ")}
    </p>
  );
}

function NeedsConfirm() {
  useConfirm();
  return null;
}

function mount(tree: ReactNode) {
  const RexApp = createRexApp({ registry, manifest, actor: viewer, baseUrl: "http://rex.test" });
  const memory = memoryLocation({ path: "/" });
  render(
    <RexApp>
      <Router hook={memory.hook}>{tree}</Router>
    </RexApp>,
  );
}

beforeAll(async () => {
  const formatter = await messageFormatter.load();
  expect(formatter.ok).toBe(true);
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  unregisterI18n();
});

describe("REX_PROVIDERS", () => {
  it("lists the i18n, confirm and devtools providers in dev with devtools enabled", () => {
    expect(import.meta.env.DEV).toBe(true);
    expect(import.meta.env.REX_DEVTOOLS).toBeUndefined();
    expect(REX_PROVIDERS.map((entry) => entry.id)).toEqual(["i18n", "confirm", "devtools"]);
    expect(REX_PROVIDERS.map((entry) => entry.Component)).toEqual([
      I18nProvider,
      ConfirmProvider,
      DevtoolsProvider,
    ]);
    expect(client.REX_PROVIDERS).toBe(REX_PROVIDERS);
    expect(client.RexProviders).toBe(RexProviders);
    expect(client.composeProviders).toBe(composeProviders);
  });
});

describe("composeProviders", () => {
  it("nests the providers in list order around the children, keyed by id", () => {
    const children = <p>body</p>;
    const layers: { readonly type: unknown; readonly key: string | null }[] = [];
    let node: ReactNode = composeProviders(REX_PROVIDERS, children);
    while (isValidElement<RexProviderProps>(node) && node !== children) {
      layers.push({ type: node.type, key: node.key });
      node = node.props.children;
    }
    expect(layers).toEqual([
      { type: I18nProvider, key: "i18n" },
      { type: ConfirmProvider, key: "confirm" },
      { type: DevtoolsProvider, key: "devtools" },
    ]);
    expect(node).toBe(children);
    expect(composeProviders([], children)).toBe(children);
    const only = composeProviders([REX_PROVIDERS[1] as RexProvider], children);
    expect(isValidElement(only) ? only.type : null).toBe(ConfirmProvider);
  });
});

describe("RexProviders", () => {
  it("provides the confirmation, i18n and devtools contexts to the shell subtree", () => {
    mount(
      <RexProviders>
        <Probe />
      </RexProviders>,
    );
    expect(screen.getByTestId("probe").textContent).toBe("confirm en:Home devtools");
  });

  it("leaves the contexts unprovided outside the composed providers", () => {
    mount(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("no-confirm no-i18n no-devtools");
    const original = console.error;
    console.error = () => {};
    try {
      expect(() => render(<NeedsConfirm />)).toThrow(
        "rex: irreversible actions need a ConfirmProvider above the shell",
      );
    } finally {
      console.error = original;
    }
  });
});
