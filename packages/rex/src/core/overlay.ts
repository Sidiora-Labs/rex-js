import { RexDeclarationError, isPlainObject } from "./entity.ts";
import { validateComponentName } from "./ids.ts";

export type OverlayDismiss = "escape" | "button" | "both";
export type OverlayBinding = "region" | "url";

export const OVERLAY_DISMISS: readonly OverlayDismiss[] = ["escape", "button", "both"];
export const OVERLAY_BINDINGS: readonly OverlayBinding[] = ["region", "url"];

export interface OverlayDeclaration<N extends string = string> {
  readonly id: N;
  readonly dismiss: OverlayDismiss;
  readonly binding: OverlayBinding;
}

export function overlayDeclaration<const N extends string>(
  input: OverlayDeclaration<N>,
  owner = "overlay",
): OverlayDeclaration<N> {
  const fail = (field: string, problem: string): never => {
    throw new RexDeclarationError("page", owner, field, problem);
  };
  if (!isPlainObject(input)) return fail("overlays", "entries must be overlay declaration objects");
  for (const property of Object.keys(input)) {
    if (property !== "id" && property !== "dismiss" && property !== "binding") {
      fail(`overlays.${String(input.id)}.${property}`, "is not part of the overlay declaration");
    }
  }
  try {
    validateComponentName(input.id, "overlay name");
  } catch (error) {
    fail("overlays", (error as Error).message);
  }
  if (!OVERLAY_DISMISS.includes(input.dismiss)) {
    fail(`overlays.${input.id}.dismiss`, `must be one of ${OVERLAY_DISMISS.join(", ")}`);
  }
  if (!OVERLAY_BINDINGS.includes(input.binding)) {
    fail(`overlays.${input.id}.binding`, `must be one of ${OVERLAY_BINDINGS.join(", ")}`);
  }
  return Object.freeze({ id: input.id, dismiss: input.dismiss, binding: input.binding });
}
