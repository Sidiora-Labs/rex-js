import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { MouseEvent } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { RexError } from "../../core/errors.ts";
import {
  DEFAULT_SHELL_COMPONENTS,
  NAV_ADDRESS_ATTRIBUTE,
  PALETTE_TRIGGER_ATTRIBUTE,
  SHELL_COMPONENT_NAMES,
  SHELL_NAV_FORMS,
  TokenButton,
  TokenFrame,
  TokenNav,
  ariaKeyShortcuts,
  isApplePlatform,
  registerShellComponents,
  resolveShellComponents,
  shortcutText,
  useShellComponents,
  type ShellFrameProps,
  type ShellNavLink,
  type ShellNavProps,
} from "./components.ts";

function preventNavigation(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
}

const LINKS: readonly ShellNavLink[] = [
  {
    id: "home",
    label: "Home",
    href: "/",
    current: true,
    address: "home",
    onClick: preventNavigation,
  },
  {
    id: "send",
    label: "Send",
    href: "/send",
    current: false,
    address: "send",
    onClick: preventNavigation,
  },
];

function SidebarFrame({ appName, links, children }: ShellFrameProps) {
  const { Nav } = useShellComponents();
  return (
    <div data-testid="sidebar-frame">
      <aside>
        <strong>{appName}</strong>
        <Nav links={links} form="sidebar" />
      </aside>
      <div>{children}</div>
    </div>
  );
}

function ListNav({ links, form }: ShellNavProps) {
  return (
    <nav aria-label="Pages" data-testid="list-nav" data-form={form}>
      {links.map((link) => (
        <a key={link.id} href={link.href} data-rex-nav={link.address} onClick={link.onClick}>
          {link.label}
        </a>
      ))}
    </nav>
  );
}

afterEach(() => {
  cleanup();
});

describe("shell components", () => {
  it("lists the six overridable slots with token-styled defaults", () => {
    expect(SHELL_COMPONENT_NAMES).toEqual([
      "Button",
      "Sheet",
      "PaletteItem",
      "Outcome",
      "Frame",
      "Nav",
    ]);
    expect(Object.keys(DEFAULT_SHELL_COMPONENTS).sort()).toEqual([...SHELL_COMPONENT_NAMES].sort());
    expect(DEFAULT_SHELL_COMPONENTS.Frame).toBe(TokenFrame);
    expect(DEFAULT_SHELL_COMPONENTS.Nav).toBe(TokenNav);
    expect(SHELL_NAV_FORMS).toEqual(["bar", "sidebar", "dock"]);
  });

  it("resolves Frame and Nav overrides beside the defaults", () => {
    const resolved = resolveShellComponents({ Frame: SidebarFrame, Nav: ListNav, unrelated: 1 });
    expect(resolved.Frame).toBe(SidebarFrame);
    expect(resolved.Nav).toBe(ListNav);
    expect(resolved.Button).toBe(TokenButton);
    expect(Object.isFrozen(resolved)).toBe(true);
  });

  it("rejects a Frame or Nav export that is not a component and a module with no slot", () => {
    expect(() => resolveShellComponents({ Frame: "frame" })).toThrow(RexError);
    expect(() => resolveShellComponents({ Nav: 3 })).toThrow(
      'rex.config.ts: field "ui.components" module export Nav must be a component',
    );
    expect(() => resolveShellComponents({ Sidebar: SidebarFrame })).toThrow(
      'rex.config.ts: field "ui.components" module exports none of Button, Sheet, PaletteItem, Outcome, Frame, Nav',
    );
  });

  it("renders the token nav as a list of addressed page links in every form", () => {
    for (const form of SHELL_NAV_FORMS) {
      const { unmount } = render(<TokenNav links={LINKS} form={form} />);
      const nav = screen.getByRole("navigation", { name: "Pages" });
      expect(nav.getAttribute("data-rex-nav-form")).toBe(form);
      const links = within(nav).getAllByRole("link");
      expect(links.map((link) => link.textContent)).toEqual(["Home", "Send"]);
      expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/send"]);
      expect(links.map((link) => link.getAttribute(NAV_ADDRESS_ATTRIBUTE))).toEqual([
        "home",
        "send",
      ]);
      expect(links.map((link) => link.getAttribute("aria-current"))).toEqual(["page", null]);
      expect(fireEvent.click(links[1] as HTMLElement)).toBe(false);
      unmount();
    }
  });

  it("renders no navigation when there are no links", () => {
    const { container } = render(<TokenNav links={[]} form="bar" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the token frame with the app bar, the primary navigation and the content area", () => {
    const opened: string[] = [];
    render(
      <TokenFrame
        appName="wallet"
        links={LINKS}
        palette={{
          label: "Command palette",
          shortcut: "mod+k",
          address: "palette",
          onOpen: () => opened.push("palette"),
        }}
      >
        <main>Page body</main>
      </TokenFrame>,
    );
    const banner = screen.getByRole("banner");
    expect(banner.textContent).toContain("wallet");
    expect(banner.querySelector(".rex-frame-mark")?.textContent).toBe("W");
    const nav = within(banner).getByRole("navigation", { name: "Pages" });
    expect(nav.getAttribute("data-rex-nav-form")).toBe("bar");
    const trigger = within(banner).getByRole("button", { name: /Command palette/ });
    expect(trigger.getAttribute(PALETTE_TRIGGER_ATTRIBUTE)).toBe("palette");
    expect(trigger.getAttribute("aria-keyshortcuts")).toBe("Control+K Meta+K");
    expect(trigger.querySelector("kbd")?.textContent).toBe(
      shortcutText("mod+k", isApplePlatform()),
    );
    fireEvent.click(trigger);
    expect(opened).toEqual(["palette"]);
    const main = screen.getByRole("main");
    expect(banner.contains(main)).toBe(false);
    expect(main.closest(".rex-frame-content")).not.toBeNull();
    expect(main.closest("[data-rex-frame]")).toBe(banner.closest("[data-rex-frame]"));
  });

  it("omits the palette trigger when no palette is mounted", () => {
    render(
      <TokenFrame appName="wallet" links={LINKS} palette={null}>
        <main>Page body</main>
      </TokenFrame>,
    );
    expect(document.querySelector(`[${PALETTE_TRIGGER_ATTRIBUTE}]`)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders the app-wide Nav override inside the default frame", () => {
    const unregister = registerShellComponents({ Nav: ListNav });
    try {
      render(
        <TokenFrame appName="wallet" links={LINKS} palette={null}>
          <main>Page body</main>
        </TokenFrame>,
      );
      const nav = within(screen.getByRole("banner")).getByTestId("list-nav");
      expect(nav.getAttribute("data-form")).toBe("bar");
      expect(
        within(nav)
          .getAllByRole("link")
          .map((link) => link.textContent),
      ).toEqual(["Home", "Send"]);
    } finally {
      unregister();
    }
    expect(resolvedNav()).toBe(DEFAULT_SHELL_COMPONENTS.Nav);
  });

  it("formats shortcuts for display and for aria-keyshortcuts", () => {
    expect(shortcutText("mod+k", false)).toBe("Ctrl K");
    expect(shortcutText("mod+k", true)).toBe("⌘K");
    expect(shortcutText("shift+alt+enter", false)).toBe("Shift Alt Enter");
    expect(ariaKeyShortcuts("mod+k")).toBe("Control+K Meta+K");
    expect(ariaKeyShortcuts("shift+t")).toBe("Shift+T");
    expect(ariaKeyShortcuts("mod+shift+enter")).toBe("Control+Shift+Enter Meta+Shift+Enter");
  });
});

function resolvedNav() {
  let nav: unknown = null;
  function Probe() {
    nav = useShellComponents().Nav;
    return null;
  }
  render(<Probe />);
  return nav;
}
