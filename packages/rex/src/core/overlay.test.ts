import { describe, expect, it } from "vitest";
import { RexDeclarationError } from "./entity.ts";
import { OVERLAY_BINDINGS, OVERLAY_DISMISS, overlayDeclaration } from "./overlay.ts";
import { page } from "./page.ts";

function failure(run: () => unknown): RexDeclarationError {
  try {
    run();
  } catch (error) {
    if (error instanceof RexDeclarationError) return error;
    throw error;
  }
  throw new Error("expected a RexDeclarationError");
}

describe("overlayDeclaration", () => {
  it("lists the dismiss and binding options", () => {
    expect(OVERLAY_DISMISS).toEqual(["escape", "button", "both"]);
    expect(OVERLAY_BINDINGS).toEqual(["region", "url"]);
  });

  it("returns a frozen copy holding only id, dismiss and binding", () => {
    const input = { id: "TokenSheet", dismiss: "both", binding: "url" } as const;
    const declared = overlayDeclaration(input);
    expect(declared).toEqual(input);
    expect(declared).not.toBe(input);
    expect(Object.isFrozen(declared)).toBe(true);
    expect(Object.keys(declared)).toEqual(["id", "dismiss", "binding"]);
    for (const dismiss of OVERLAY_DISMISS) {
      for (const binding of OVERLAY_BINDINGS) {
        expect(overlayDeclaration({ id: "Sheet", dismiss, binding })).toEqual({
          id: "Sheet",
          dismiss,
          binding,
        });
      }
    }
  });

  it("rejects entries that are not overlay objects", () => {
    const error = failure(() => overlayDeclaration("TokenSheet" as never));
    expect(error.code).toBe("REX213");
    expect([error.declaration, error.id, error.field]).toEqual(["page", "overlay", "overlays"]);
    expect(error.message).toBe(
      'REX213 page "overlay": field "overlays" entries must be overlay declaration objects',
    );
    expect(failure(() => overlayDeclaration(null as never, "send")).id).toBe("send");
  });

  it("rejects unknown properties, naming the owner", () => {
    const error = failure(() =>
      overlayDeclaration(
        { id: "TokenSheet", dismiss: "both", binding: "url", size: "lg" } as never,
        "send",
      ),
    );
    expect(error.field).toBe("overlays.TokenSheet.size");
    expect(error.message).toBe(
      'REX213 page "send": field "overlays.TokenSheet.size" is not part of the overlay declaration',
    );
  });

  it("rejects ids that are not PascalCase", () => {
    const error = failure(() =>
      overlayDeclaration({ id: "token-sheet", dismiss: "both", binding: "url" }, "send"),
    );
    expect(error.field).toBe("overlays");
    expect(error.message).toBe(
      'REX213 page "send": field "overlays" REX218 invalid overlay name "token-sheet": must be PascalCase: an uppercase letter followed by letters and digits',
    );
  });

  it("rejects dismiss and binding values outside their options", () => {
    const dismiss = failure(() =>
      overlayDeclaration({ id: "TokenSheet", dismiss: "click", binding: "url" } as never),
    );
    expect(dismiss.field).toBe("overlays.TokenSheet.dismiss");
    expect(dismiss.message).toBe(
      'REX213 page "overlay": field "overlays.TokenSheet.dismiss" must be one of escape, button, both',
    );
    const binding = failure(() =>
      overlayDeclaration({ id: "TokenSheet", dismiss: "escape", binding: "state" } as never),
    );
    expect(binding.field).toBe("overlays.TokenSheet.binding");
    expect(binding.message).toBe(
      'REX213 page "overlay": field "overlays.TokenSheet.binding" must be one of region, url',
    );
  });

  it("is what page() stores for its overlays", () => {
    const declared = page("send", {
      route: "/send",
      overlays: [{ id: "TokenSheet", dismiss: "both", binding: "url" }],
    });
    expect(declared.overlays).toEqual([
      overlayDeclaration({ id: "TokenSheet", dismiss: "both", binding: "url" }),
    ]);
  });
});
