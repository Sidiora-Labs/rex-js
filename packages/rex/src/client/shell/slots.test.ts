import { describe, expect, it } from "vitest";
import { SHELL_SLOTS as fromShell } from "../shell.tsx";
import { AnnouncerSlot } from "./announcer.tsx";
import { BodySlot, RecoverySlot } from "./body.tsx";
import { withShellComponents } from "./components.ts";
import { DevtoolsSlot } from "./devtools-slot.tsx";
import { HeaderSlot } from "./header.tsx";
import { OutcomeSlot } from "./outcome-slot.tsx";
import { SHELL_SLOTS } from "./slots.ts";

describe("SHELL_SLOTS", () => {
  it("orders the frame from header to announcer and adds the devtools slot in dev", () => {
    expect(import.meta.env.DEV).toBe(true);
    expect(import.meta.env.REX_DEVTOOLS).toBeUndefined();
    expect(SHELL_SLOTS.map((slot) => slot.id)).toEqual([
      "header",
      "outcome",
      "body",
      "recovery",
      "announcer",
      "devtools",
    ]);
  });

  it("binds each slot id to its component exactly once", () => {
    const byId = new Map(SHELL_SLOTS.map((slot) => [slot.id, slot.Component]));
    expect(byId.size).toBe(SHELL_SLOTS.length);
    expect(byId.get("header")).toBe(HeaderSlot);
    expect(byId.get("outcome")).toBe(OutcomeSlot);
    expect(byId.get("body")).toBe(BodySlot);
    expect(byId.get("recovery")).toBe(RecoverySlot);
    expect(byId.get("announcer")).toBe(AnnouncerSlot);
    expect(byId.get("devtools")).toBe(DevtoolsSlot);
    expect(new Set(byId.values()).size).toBe(SHELL_SLOTS.length);
  });

  it("is the list the shell entry re-exports, wrapped through withShellComponents unchanged", () => {
    expect(fromShell).toBe(SHELL_SLOTS);
    expect(withShellComponents(HeaderSlot)).toBe(HeaderSlot);
    expect(withShellComponents(BodySlot)).toBe(BodySlot);
  });
});
