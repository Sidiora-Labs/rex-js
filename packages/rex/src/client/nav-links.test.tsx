import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { createRegistry } from "../core/registry.ts";
import { buildManifest } from "../manifest/build.ts";
import { createRexApp } from "./app.tsx";
import { useNavLinks } from "./shell/nav.tsx";

const home = page("home", { route: "/" });
const destination = page("destination", {
  route: "/destination",
  chrome: { title: "Destination" },
});
const registry = createRegistry().register(home, destination).freeze();
const manifest = buildManifest(registry);

function Links() {
  const links = useNavLinks(home, [destination]);
  return links.map((link) => (
    <a key={link.id} href={link.href} data-rex-nav={link.address} onClick={link.onClick}>
      {link.label}
    </a>
  ));
}

function mount() {
  const memory = memoryLocation({ path: "/", record: true });
  const RexApp = createRexApp({
    registry,
    manifest,
    actor: actor({ id: "reader", permissions: [] }),
    baseUrl: "http://rex.test",
  });
  render(
    <RexApp>
      <Router hook={memory.hook}>
        <Links />
      </Router>
    </RexApp>,
  );
  return { memory, link: screen.getByRole("link", { name: "Destination" }) };
}

function click(link: HTMLElement, options: MouseEventInit = {}) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, ...options });
  fireEvent(link, event);
  return event;
}

afterEach(cleanup);

describe("shell navigation links", () => {
  it.each([null, "", "_self", "_SELF"])(
    "intercepts ordinary same-context navigation with target %s",
    (target) => {
      const { memory, link } = mount();
      if (target !== null) link.setAttribute("target", target);
      expect(link.getAttribute("href")).toBe("/destination");
      expect(link.getAttribute("data-rex-nav")).toBe("destination");
      expect(click(link).defaultPrevented).toBe(true);
      expect(memory.history).toEqual(["/", "/destination"]);
    },
  );

  it.each<MouseEventInit>([
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
    { button: 2 },
  ])("leaves the browser in control for %j", (options) => {
    const { memory, link } = mount();
    expect(click(link, options).defaultPrevented).toBe(false);
    expect(memory.history).toEqual(["/"]);
  });

  it("respects an already prevented event", () => {
    const { memory, link } = mount();
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    event.preventDefault();
    fireEvent(link, event);
    expect(event.defaultPrevented).toBe(true);
    expect(memory.history).toEqual(["/"]);
  });

  it.each(["_blank", "_parent", "_top", "report"])("preserves the browser target %s", (target) => {
    const { memory, link } = mount();
    link.setAttribute("target", target);
    expect(click(link).defaultPrevented).toBe(false);
    expect(memory.history).toEqual(["/"]);
  });

  it.each(["", "report.html"])("preserves download=%s", (download) => {
    const { memory, link } = mount();
    link.setAttribute("download", download);
    expect(click(link).defaultPrevented).toBe(false);
    expect(memory.history).toEqual(["/"]);
  });

  it("does not intercept an external destination", () => {
    const { memory, link } = mount();
    link.setAttribute("href", "https://example.org/destination");
    expect(click(link).defaultPrevented).toBe(false);
    expect(memory.history).toEqual(["/"]);
  });

  it("does not navigate an anchor without an href", () => {
    const { memory, link } = mount();
    link.removeAttribute("href");
    expect(click(link).defaultPrevented).toBe(false);
    expect(memory.history).toEqual(["/"]);
  });
});
