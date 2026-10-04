import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { actor, type Actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { can } from "../../core/policy.ts";
import { createRegistry } from "../../core/registry.ts";
import { buildManifest } from "../../manifest/build.ts";
import { createRexApp } from "../app.tsx";
import { definePageModules, view, type PageModuleSet } from "../page.tsx";
import { RexRoutes } from "../router.tsx";
import { ShellOutcome, isNavigable } from "../shell.tsx";
import { BodySlot, RecoverySlot } from "./body.tsx";
import {
  ShellComponentsProvider,
  resolveShellComponents,
  type ShellButtonProps,
  type ShellComponents,
} from "./components.ts";

const home = page("home", { route: "/", chrome: { title: "Home" }, states: ["ready"] });
const vault = page("vault", {
  route: "/vault",
  policy: can("view"),
  recovery: "home",
  chrome: { title: "Vault" },
  states: ["ready", "permission-denied"],
});
const sealed = page("sealed", {
  route: "/sealed",
  policy: can("view"),
  chrome: { title: "Sealed" },
  states: ["ready"],
});

const pages: readonly PageModuleSet[] = [
  definePageModules({ page: home, view: view(() => <p>Home body</p>), states: {} }),
  definePageModules({
    page: vault,
    view: view(() => <p>Vault body</p>),
    states: { PermissionDenied: () => <p>You cannot open the vault</p> },
  }),
  definePageModules({ page: sealed, view: view(() => <p>Sealed body</p>), states: {} }),
];

const registry = createRegistry().register(home, vault, sealed).freeze();
const manifest = buildManifest(registry, { app: "wallet" });
const viewer = actor({ id: "viewer", permissions: ["view"] });
const stranger = actor({ id: "stranger" });
const modules = new Map(pages.map((set) => [set.page.id, set]));
const navPages = registry.pages.filter(isNavigable);

function TaggedButton(props: ShellButtonProps) {
  return <button data-testid="tagged-button" {...props} />;
}

function mount(path: string, subject: Actor = viewer, components?: ShellComponents) {
  const memory = memoryLocation({ path, record: true });
  const RexApp = createRexApp({ registry, manifest, actor: subject, baseUrl: "http://rex.test" });
  const slots = (
    <RexRoutes
      render={(resolution) => {
        const props = {
          resolution,
          active: resolution.kind === "page" ? resolution.page : null,
          modules,
          navPages,
          Outcome: ShellOutcome,
        };
        return (
          <>
            <BodySlot {...props} />
            <RecoverySlot {...props} />
          </>
        );
      }}
    />
  );
  const { container } = render(
    <RexApp>
      <Router hook={memory.hook}>
        {components === undefined ? (
          slots
        ) : (
          <ShellComponentsProvider components={components}>{slots}</ShellComponentsProvider>
        )}
      </Router>
    </RexApp>,
  );
  return { memory, container };
}

function pageRoot(): HTMLElement | null {
  return document.querySelector("main[data-rex-page]");
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

afterEach(() => {
  cleanup();
});

describe("BodySlot", () => {
  it("hosts the module set of the active page as the page landmark", () => {
    mount("/");
    expect(pageRoot()?.getAttribute("data-rex-page")).toBe("home");
    expect(screen.getByRole("main").textContent).toBe("Home body");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders the not-found body for a path no page matches", async () => {
    mount("/missing");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("No page matches /missing.");
    const main = screen.getByRole("main");
    expect(main.getAttribute("data-rex-app-state")).toBe("not-found");
    expect(main.contains(alert)).toBe(true);
    expect(pageRoot()).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("RecoverySlot", () => {
  it("offers the recovery page through the shell Button when the policy denies the page", async () => {
    const { memory } = mount("/vault", stranger);
    expect(screen.getByText("You cannot open the vault")).toBeTruthy();
    expect(screen.queryByText("Vault body")).toBeNull();
    const recover = screen.getByRole("button", { name: "Go to Home" });
    expect(recover.getAttribute("data-rex-nav")).toBe("home");
    expect(recover.getAttribute("type")).toBe("button");
    expect(recover.closest(".rex-recovery")?.tagName).toBe("P");
    await click(recover);
    expect(memory.history.at(-1)).toBe("/");
    expect(screen.getByRole("main").textContent).toBe("Home body");
    expect(screen.queryByRole("button", { name: "Go to Home" })).toBeNull();
  });

  it("renders no recovery control when the page is allowed or declares no recovery", () => {
    mount("/vault", viewer);
    expect(screen.getByText("Vault body")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    cleanup();
    mount("/sealed", stranger);
    const fallback = document.querySelector("[data-rex-default-state]");
    expect(fallback?.getAttribute("data-rex-default-state")).toBe("permission-denied");
    expect(screen.queryByText("Sealed body")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders the recovery control through an overriding shell Button", async () => {
    const { memory } = mount("/vault", stranger, resolveShellComponents({ Button: TaggedButton }));
    const recover = screen.getByTestId("tagged-button");
    expect(recover.textContent).toBe("Go to Home");
    expect(recover.getAttribute("data-rex-nav")).toBe("home");
    await click(recover);
    expect(memory.history.at(-1)).toBe("/");
    expect(screen.queryByTestId("tagged-button")).toBeNull();
  });
});
