import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useFallback } from "./fallback-host.ts";
import { NotFoundBody, NotFoundSection, RegionErrorFallback } from "./fallbacks.tsx";
import { DefaultState } from "./page.tsx";
import { NotFound } from "./router.tsx";
import { AgentOutcome } from "./shell.tsx";
import { BodySlot } from "./shell/body.tsx";

const seen: unknown[] = [];

function SectionProbe() {
  const Section = useFallback("NotFoundSection");
  seen.push(Section);
  return Section === null ? <p data-testid="pending">pending</p> : <Section path="/missing" />;
}

const resolved: unknown[][] = [];

function AllProbe() {
  const Body = useFallback("NotFoundBody", "home");
  const Region = useFallback("RegionErrorFallback", "home");
  const Section = useFallback("NotFoundSection");
  resolved.push([Body, Region, Section]);
  if (Region === null) return null;
  return (
    <Region
      address="home/main"
      code="REX330"
      error={new Error("the main region threw")}
      retry={() => {}}
      params={{}}
      Export={undefined}
      Default={DefaultState}
    />
  );
}

afterEach(() => {
  cleanup();
  seen.length = 0;
  resolved.length = 0;
});

describe("useFallback", () => {
  it("yields null on the first client render and then the renderer from fallbacks.tsx", async () => {
    render(<SectionProbe />);
    expect(seen[0]).toBeNull();
    expect(screen.getByTestId("pending").textContent).toBe("pending");
    await screen.findByRole("alert");
    expect(seen.at(-1)).toBe(NotFoundSection);
    expect(screen.queryByTestId("pending")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Page not found");
    expect(screen.getByRole("alert").textContent).toContain("No page matches /missing.");
  });

  it("returns every named export by identity, scoped to an outcome key", async () => {
    render(<AllProbe />);
    await waitFor(() =>
      expect(resolved.at(-1)).toEqual([NotFoundBody, RegionErrorFallback, NotFoundSection]),
    );
    const wrapper = document.querySelector('[data-rex-region-error="home/main"]');
    expect(wrapper?.getAttribute("data-rex-error-code")).toBe("REX330");
    expect(screen.getByRole("alert").textContent).toContain("the main region threw");
  });

  it("drives the real not-found renderers of the router and the shell body", async () => {
    render(
      <div>
        <NotFound path="/nowhere" />
        <BodySlot
          resolution={{ kind: "not-found", path: "/gone" }}
          active={null}
          modules={new Map()}
          navPages={[]}
          Outcome={AgentOutcome}
        />
      </div>,
    );
    await waitFor(() =>
      expect(document.querySelectorAll('[data-rex-app-state="not-found"]')).toHaveLength(2),
    );
    const section = screen.getByRole("heading", { level: 1 }).closest("section");
    expect(section?.getAttribute("data-rex-app-state")).toBe("not-found");
    expect(section?.textContent).toContain("No page matches /nowhere.");
    const main = screen.getByRole("main");
    expect(main.getAttribute("data-rex-app-state")).toBe("not-found");
    expect(main.textContent).toBe("No page matches /gone.");
  });
});
