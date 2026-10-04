import { describe, expect, it } from "vitest";
import { RexError } from "../core/errors.ts";
import { registerReset, resetAll } from "./reset.ts";
import { store } from "./store.ts";

describe("registerReset", () => {
  it("runs every registered reset once per resetAll in registration order until unregistered", () => {
    const calls: string[] = [];
    const leaveFirst = registerReset(() => {
      calls.push("first");
    });
    const leaveSecond = registerReset(() => {
      calls.push("second");
    });
    resetAll();
    expect(calls).toEqual(["first", "second"]);
    leaveFirst();
    resetAll();
    expect(calls).toEqual(["first", "second", "second"]);
    leaveSecond();
    leaveSecond();
    resetAll();
    expect(calls).toEqual(["first", "second", "second"]);
  });

  it("registers one function once and keeps a reset that re-registers during a run for next time", () => {
    const calls: number[] = [];
    const reset = () => {
      calls.push(calls.length);
    };
    const leaveA = registerReset(reset);
    const leaveB = registerReset(reset);
    resetAll();
    expect(calls).toEqual([0]);
    leaveA();
    resetAll();
    expect(calls).toEqual([0]);
    leaveB();
    const late: string[] = [];
    let leaveLate = () => {};
    const leaveEarly = registerReset(() => {
      leaveLate = registerReset(() => {
        late.push("late");
      });
    });
    resetAll();
    expect(late).toEqual([]);
    resetAll();
    expect(late).toEqual(["late"]);
    leaveEarly();
    leaveLate();
  });

  it("refuses a reset that is not a function with REX329", () => {
    expect(() => registerReset("reset" as unknown as () => void)).toThrow(
      new RexError("REX329", "registerReset: reset must be a function"),
    );
    expect(() => registerReset(undefined as unknown as () => void)).toThrow(RexError);
  });

  it("restores every declared store to its initial value and notifies its subscribers", () => {
    const counter = store("reset-counter", { initial: 0 });
    const names = store("reset-names", { initial: [] as readonly string[], expose: true });
    counter.set(5);
    names.set(["ada"]);
    const seen: number[] = [];
    const unsubscribe = counter.subscribe(() => seen.push(counter.get()));
    resetAll();
    unsubscribe();
    expect(counter.get()).toBe(0);
    expect(names.get()).toEqual([]);
    expect(seen).toEqual([0]);
    resetAll();
    expect(seen).toEqual([0]);
  });
});
