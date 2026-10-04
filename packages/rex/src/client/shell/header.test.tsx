import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { createRegistry } from "../../core/registry.ts";
import { buildManifest } from "../../manifest/build.ts";
import { createRexApp } from "../app.tsx";
import basicPage, { greet } from "../fixtures/page-basic/page.ts";
import MainRegion from "../fixtures/page-basic/regions/main/region.tsx";
import * as basicStates from "../fixtures/page-basic/states.tsx";
import BasicView from "../fixtures/page-basic/view.tsx";
import secondPage from "../fixtures/page-second/page.ts";
import * as secondStates from "../fixtures/page-second/states.tsx";
import SecondView from "../fixtures/page-second/view.tsx";
import { definePageModules, view, type PageModuleSet } from "../page.tsx";
import { RexRoutes } from "../router.tsx";
import { NOT_FOUND_TITLE as fromShell, ShellOutcome, isNavigable } from "../shell.tsx";
import {
  ShellComponentsProvider,
  resolveShellComponents,
  type ShellButtonProps,
  type ShellComponents,
} from "./components.ts";
import { HeaderSlot, NOT_FOUND_TITLE } from "./header.tsx";

const home = page("home", { route: "/", chrome: { title: "Home" }, states: ["ready"] });
const focus = page("focus", {
  route: "/focus",
  chrome: { title: "Focus", header: false, back: "home" },
  states: ["ready"],
});

const pages: readonly PageModuleSet[] = [
  definePageModules({ page: home, view: view(() => <p>Home body</p>), states: {} }),
  definePageModules({ page: focus, view: view(() => <p>Focus body</p>), states: {} }),
  definePageModules({
    page: basicPage,
    view: BasicView,
    states: basicStates,
    regions: { main: MainRegion },
  }),
  definePageModules({ page: secondPage, view: SecondView, states: secondStates }),
];

const registry = createRegistry().register(greet, home, focus, basicPage, secondPage).freeze();
const manifest = buildManifest(registry, { app: "wallet" });
const viewer = actor({ id: "viewer", permissions: ["view"] });
const modules = new Map(pages.map((set) => [set.page.id, set]));
const navPages = registry.pages.filter(isNavigable);

function TaggedButton(props: ShellButtonProps) {
  return <button data-testid="tagged-button" {...props} />;
}

function mount(path: string, components?: ShellComponents) {
  const memory = memoryLocation({ path, record: true });
  const RexApp = createRexApp({ registry, manifest, actor: viewer, baseUrl: "http://rex.test" });
  const slot = (
    <RexRoutes
      render={(resolution) => (
        <HeaderSlot
          resolution={resolution}
          active={resolution.kind === "page" ? resolution.page : null}
          modules={modules}
          navPages={navPages}
          Outcome={ShellOutcome}
        />
      )}
    />
  );
  const { container } = render(
    <RexApp>
      <Router hook={memory.hook}>
        {components === undefined ? (
          slot
        ) : (
          <ShellComponentsProvider components={components}>{slot}</ShellComponentsProvider>
        )}
      </Router>
    </RexApp>,
  );
  return { memory, container };
}

function heading(): string | null {
  return screen.getByRole("heading", { level: 1 }).textContent;
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

afterEach(() => {
  cleanup();
});

describe("HeaderSlot", () => {
  it("renders the active page title as the level-one heading of the page header", () => {
    const { container } = mount("/");
    expect(heading()).toBe("Home");
    const header = container.querySelector(".rex-page-header") as HTMLElement;
    expect(header.contains(screen.getByRole("heading", { level: 1 }))).toBe(true);
    expect(screen.getByRole("heading", { level: 1 }).className).toBe("rex-page-title");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders the not-found title when no page is active", () => {
    mount("/missing");
    expect(heading()).toBe(NOT_FOUND_TITLE);
    expect(NOT_FOUND_TITLE).toBe("Page not found");
    expect(fromShell).toBe(NOT_FOUND_TITLE);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing for a page whose chrome turns the header off", () => {
    const { container } = mount("/focus");
    expect(container.innerHTML).toBe("");
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("offers the declared back target and navigates back carrying matching params", async () => {
    const { memory } = mount("/second?name=ada");
    expect(heading()).toBe("Second");
    const back = screen.getByRole("button", { name: "Back to Basic" });
    expect(back.getAttribute("data-rex-nav")).toBe("basic");
    expect(back.getAttribute("type")).toBe("button");
    await click(back);
    expect(memory.history.at(-1)).toBe("/basic/ada");
    expect(heading()).toBe("Basic");
    expect(screen.queryByRole("button", { name: /^Back to / })).toBeNull();
  });

  it("renders the back control through an overriding shell Button", async () => {
    const { memory } = mount("/second?name=lin", resolveShellComponents({ Button: TaggedButton }));
    const back = screen.getByTestId("tagged-button");
    expect(back.textContent).toBe("Back to Basic");
    expect(back.getAttribute("data-rex-nav")).toBe("basic");
    await click(back);
    expect(memory.history.at(-1)).toBe("/basic/lin");
    expect(heading()).toBe("Basic");
    expect(screen.queryByTestId("tagged-button")).toBeNull();
  });
});
