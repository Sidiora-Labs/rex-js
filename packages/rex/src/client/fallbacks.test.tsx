import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RecoverableError } from "../testing/fixtures/notes/states.tsx";
import { NotFoundBody, NotFoundSection, RegionErrorFallback } from "./fallbacks.tsx";
import { DefaultState } from "./page.tsx";

afterEach(cleanup);

describe("RegionErrorFallback", () => {
  it("renders the default recoverable-error state inside the addressed wrapper", () => {
    let retries = 0;
    const error = new Error("the list store is down");
    const { container } = render(
      <RegionErrorFallback
        address="notes/list"
        code="REX330"
        error={error}
        retry={() => {
          retries += 1;
        }}
        params={{ filter: "ada" }}
        Export={undefined}
        Default={DefaultState}
      />,
    );
    const wrapper = container.firstElementChild;
    expect(wrapper?.getAttribute("data-rex-region-error")).toBe("notes/list");
    expect(wrapper?.getAttribute("data-rex-error-code")).toBe("REX330");
    const state = screen.getByRole("alert");
    expect(state.getAttribute("data-rex-default-state")).toBe("recoverable-error");
    expect(state.textContent).toContain("Something went wrong");
    expect(state.textContent).toContain("the list store is down");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retries).toBe(1);
  });

  it("prefers the page's RecoverableError export with the same error and retry", () => {
    let retries = 0;
    const { container } = render(
      <RegionErrorFallback
        address="notes/list"
        code="REX330"
        error={new Error("boom")}
        retry={() => {
          retries += 1;
        }}
        params={{ noteId: "n1" }}
        Export={RecoverableError}
        Default={DefaultState}
      />,
    );
    expect(container.querySelector("[data-rex-default-state]")).toBeNull();
    expect(container.firstElementChild?.getAttribute("data-rex-region-error")).toBe("notes/list");
    expect(screen.getByRole("status").textContent).toContain("Notes failed: boom");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retries).toBe(1);
  });
});

describe("not-found fallbacks", () => {
  it("NotFoundSection announces the missing path as an alert section with a heading", () => {
    render(<NotFoundSection path="/notes/404" />);
    const section = screen.getByRole("alert");
    expect(section.tagName).toBe("SECTION");
    expect(section.getAttribute("data-rex-app-state")).toBe("not-found");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Page not found");
    expect(section.textContent).toContain("No page matches /notes/404.");
  });

  it("NotFoundBody renders a main landmark whose alert names the path", () => {
    render(<NotFoundBody path="/gone" />);
    const main = screen.getByRole("main");
    expect(main.getAttribute("data-rex-app-state")).toBe("not-found");
    const alert = screen.getByRole("alert");
    expect(alert.tagName).toBe("P");
    expect(alert.textContent).toBe("No page matches /gone.");
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
