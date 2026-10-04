import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { createRegistry } from "../core/registry.ts";
import { buildManifest } from "../manifest/build.ts";
import { validateSidecar, type SidecarPayload } from "../manifest/sidecar.schema.ts";
import {
  OverlayRegistryProvider,
  RexSidecar,
  createOverlayRegistry,
  readSidecar,
} from "./agent/sidecar.tsx";
import { createRexApp } from "./app.tsx";
import * as client from "./index.ts";
import {
  overlay,
  openOverlaysFromSearch,
  searchWithOverlay,
  useOverlay,
  type OverlayComponent,
} from "./overlay.tsx";
import { definePageModules, region, view, type PageModuleSet } from "./page.tsx";
import { RexRoutes } from "./router.tsx";
import { Shell, ShellOutcome, type OutcomeSlotProps } from "./shell.tsx";

const TokenSheet = overlay("TokenSheet", { dismiss: "both", binding: "region" }, ({ close }) => (
  <div>
    <label>
      Search tokens
      <input type="text" />
    </label>
    <button type="button" onClick={close}>
      Pick gold
    </button>
  </div>
));

const ContactSheet = overlay("ContactSheet", { dismiss: "escape", binding: "url" }, () => (
  <label>
    Search contacts
    <input type="text" />
  </label>
));

const NoteDialog = overlay("NoteDialog", { dismiss: "button", binding: "region" }, () => (
  <p>Notes are public</p>
));

const sendPage = page("send", {
  route: "/send",
  regions: ["form"],
  overlays: [
    { id: "TokenSheet", dismiss: "both", binding: "region" },
    { id: "ContactSheet", dismiss: "escape", binding: "url" },
    { id: "NoteDialog", dismiss: "button", binding: "region" },
  ],
  states: ["ready"],
});
const home = page("home", { route: "/", states: ["ready"] });

function Trigger({ target, label }: { readonly target: OverlayComponent; readonly label: string }) {
  const handle = useOverlay(target);
  return (
    <button type="button" {...handle.triggerProps}>
      {label}
    </button>
  );
}

const Form = region("form", () => (
  <div>
    <Trigger target={TokenSheet} label="Choose token" />
    <Trigger target={ContactSheet} label="Choose contact" />
    <Trigger target={NoteDialog} label="Read note" />
    <TokenSheet />
    <ContactSheet />
    <NoteDialog />
  </div>
));

const pages: readonly PageModuleSet[] = [
  definePageModules({
    page: sendPage,
    view: view(() => <Form />),
    states: {},
    regions: { form: Form },
    overlays: { TokenSheet, ContactSheet, NoteDialog },
  }),
  definePageModules({ page: home, view: view(() => <p>Home</p>), states: {} }),
];

const registry = createRegistry().register(sendPage, home).freeze();
const manifest = buildManifest(registry);
const viewer = actor({ id: "viewer" });

function Slot({ page: pageId }: OutcomeSlotProps) {
  return (
    <>
      <ShellOutcome page={pageId} />
      <RexSidecar />
    </>
  );
}

function mount(path: string) {
  const memory = memoryLocation({ path, record: true });
  const overlays = createOverlayRegistry();
  const RexApp = createRexApp({ registry, manifest, actor: viewer, baseUrl: "http://rex.test" });
  render(
    <OverlayRegistryProvider registry={overlays}>
      <RexApp>
        <Router hook={memory.hook}>
          <Shell pages={pages} outcome={Slot} />
        </Router>
      </RexApp>
    </OverlayRegistryProvider>,
  );
  return { memory, overlays };
}

function sidecarOverlays(): SidecarPayload["overlays"] {
  const result = validateSidecar(readSidecar(document));
  if (!result.valid) throw new Error(JSON.stringify(result.issues));
  return result.payload.overlays;
}

function dialog(id: string): HTMLElement | null {
  return document.querySelector(`[data-rex-overlay="send/${id}"]`);
}

async function openWith(label: string): Promise<HTMLElement> {
  const trigger = screen.getByRole("button", { name: label });
  trigger.focus();
  await act(async () => {
    fireEvent.click(trigger);
  });
  return trigger;
}

async function key(target: Element, init: KeyboardEventInit & { key: string }) {
  await act(async () => {
    fireEvent.keyDown(target, init);
  });
}

afterEach(() => {
  cleanup();
});

describe("overlay()", () => {
  it("is exported from the client entry and validates its declaration", () => {
    expect(client.overlay).toBe(overlay);
    expect(TokenSheet.rexKind).toBe("overlay");
    expect(TokenSheet.overlayId).toBe("TokenSheet");
    expect(ContactSheet.binding).toBe("url");
    expect(() => overlay("sheet", { dismiss: "both", binding: "region" }, () => null)).toThrow();
    expect(() =>
      overlay("Sheet", { dismiss: "swipe" as "both", binding: "region" }, () => null),
    ).toThrow("dismiss must be one of escape, button, both");
    expect(searchWithOverlay("tab=1", "ContactSheet", true)).toBe("tab=1&overlay=ContactSheet");
    expect(searchWithOverlay("tab=1&overlay=ContactSheet", "ContactSheet", false)).toBe("tab=1");
    expect(openOverlaysFromSearch("overlay=A&overlay=B")).toEqual(["A", "B"]);
  });

  it("refuses an overlay the page does not declare or declares differently", () => {
    const Stray = overlay("StraySheet", { dismiss: "both", binding: "region" }, () => null);
    const Drift = overlay("TokenSheet", { dismiss: "escape", binding: "region" }, () => null);
    const original = console.error;
    console.error = () => {};
    try {
      const RexApp = createRexApp({
        registry,
        manifest,
        actor: viewer,
        baseUrl: "http://rex.test",
      });
      for (const [Component, message] of [
        [Stray, 'rex: overlay "StraySheet" is not declared by page "send"'],
        [Drift, 'rex: overlay "TokenSheet" declares dismiss "escape"'],
      ] as const) {
        const memory = memoryLocation({ path: "/send" });
        expect(() =>
          render(
            <RexApp>
              <Router hook={memory.hook}>
                <RexRoutes render={() => <Component />} />
              </Router>
            </RexApp>,
          ),
        ).toThrow(message);
        cleanup();
      }
    } finally {
      console.error = original;
    }
  });
});

describe("region-bound overlays", () => {
  it("opens from its trigger, renders data-rex-overlay and registers in the sidecar", async () => {
    mount("/send");
    expect(dialog("TokenSheet")).toBeNull();
    expect(sidecarOverlays()).toEqual([
      { id: "TokenSheet", open: false, dismiss: "both" },
      { id: "ContactSheet", open: false, dismiss: "escape" },
      { id: "NoteDialog", open: false, dismiss: "button" },
    ]);
    const trigger = await openWith("Choose token");
    const sheet = dialog("TokenSheet");
    expect(sheet?.getAttribute("role")).toBe("dialog");
    expect(sheet?.getAttribute("aria-modal")).toBe("true");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("data-rex-overlay-trigger")).toBe("send/TokenSheet");
    expect(sidecarOverlays()).toContainEqual({ id: "TokenSheet", open: true, dismiss: "both" });
  });

  it("closes on Escape and restores focus to the opener", async () => {
    mount("/send");
    const trigger = await openWith("Choose token");
    const sheet = dialog("TokenSheet") as HTMLElement;
    expect(document.activeElement).toBe(within(sheet).getByRole("textbox"));
    await key(document.activeElement as Element, { key: "Escape" });
    expect(dialog("TokenSheet")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(sidecarOverlays()).toContainEqual({ id: "TokenSheet", open: false, dismiss: "both" });
  });

  it("closes on the declared dismiss control and restores focus", async () => {
    mount("/send");
    const trigger = await openWith("Choose token");
    await act(async () => {
      fireEvent.click(
        within(dialog("TokenSheet") as HTMLElement).getByRole("button", { name: "Close" }),
      );
    });
    expect(dialog("TokenSheet")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("traps focus while open", async () => {
    mount("/send");
    await openWith("Choose token");
    const sheet = dialog("TokenSheet") as HTMLElement;
    const input = within(sheet).getByRole("textbox");
    const close = within(sheet).getByRole("button", { name: "Close" });
    close.focus();
    await key(close, { key: "Tab" });
    expect(document.activeElement).toBe(input);
    await key(input, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(close);
  });

  it("honours a button-only dismissal: Escape keeps it open, the control closes it", async () => {
    mount("/send");
    const trigger = await openWith("Read note");
    const note = dialog("NoteDialog") as HTMLElement;
    expect(document.activeElement).toBe(within(note).getByRole("button", { name: "Close" }));
    await key(note, { key: "Escape" });
    expect(dialog("NoteDialog")).not.toBeNull();
    await act(async () => {
      fireEvent.click(within(note).getByRole("button", { name: "Close" }));
    });
    expect(dialog("NoteDialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("URL-bound overlays", () => {
  it("binds open state to the URL and closes on Escape", async () => {
    const { memory } = mount("/send");
    const trigger = await openWith("Choose contact");
    expect(memory.history.at(-1)).toBe("/send?overlay=ContactSheet");
    const sheet = dialog("ContactSheet") as HTMLElement;
    expect(sheet).not.toBeNull();
    expect(within(sheet).queryByRole("button", { name: "Close" })).toBeNull();
    expect(sidecarOverlays()).toContainEqual({ id: "ContactSheet", open: true, dismiss: "escape" });
    await key(within(sheet).getByRole("textbox"), { key: "Escape" });
    expect(memory.history.at(-1)).toBe("/send");
    expect(dialog("ContactSheet")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(sidecarOverlays()).toContainEqual({
      id: "ContactSheet",
      open: false,
      dismiss: "escape",
    });
  });

  it("restores an open overlay from the URL on load", () => {
    mount("/send?overlay=ContactSheet");
    expect(dialog("ContactSheet")).not.toBeNull();
    expect(sidecarOverlays()).toContainEqual({ id: "ContactSheet", open: true, dismiss: "escape" });
  });

  it("clears the registry when the page unmounts", async () => {
    const { memory, overlays } = mount("/send");
    await openWith("Choose token");
    expect(overlays.isOpen("send", "TokenSheet")).toBe(true);
    await act(async () => {
      memory.navigate("/");
    });
    expect(overlays.isOpen("send", "TokenSheet")).toBe(false);
  });
});
