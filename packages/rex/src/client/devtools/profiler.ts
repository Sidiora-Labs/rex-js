import { ADDRESS_ATTRIBUTES } from "../agent/address.tsx";
import type { RegionRenderSample } from "./store.ts";

const FIBER_KEY_PREFIX = "__reactFiber$";

interface ProfiledFiber {
  readonly actualDuration?: unknown;
  readonly actualStartTime?: unknown;
  readonly alternate: ProfiledFiber | null;
}

function fiberOf(element: Element): ProfiledFiber | null {
  for (const key of Object.keys(element)) {
    if (key.startsWith(FIBER_KEY_PREFIX)) {
      const fiber = (element as unknown as Record<string, unknown>)[key];
      return typeof fiber === "object" && fiber !== null ? (fiber as ProfiledFiber) : null;
    }
  }
  return null;
}

function renderedSince(fiber: ProfiledFiber, commitStart: number): number | null {
  const start = fiber.actualStartTime;
  const duration = fiber.actualDuration;
  if (typeof start !== "number" || typeof duration !== "number") return null;
  return start >= commitStart ? start : null;
}

export function regionRenderSamples(
  root: ParentNode,
  commitStart: number,
): readonly RegionRenderSample[] {
  const samples: RegionRenderSample[] = [];
  for (const element of root.querySelectorAll(`[${ADDRESS_ATTRIBUTES.region}]`)) {
    const address = element.getAttribute(ADDRESS_ATTRIBUTES.region);
    const fiber = fiberOf(element);
    if (address === null || fiber === null) continue;
    let rendered: ProfiledFiber | null = null;
    let latest = Number.NEGATIVE_INFINITY;
    for (const candidate of [fiber, fiber.alternate]) {
      if (candidate === null) continue;
      const start = renderedSince(candidate, commitStart);
      if (start !== null && start > latest) {
        latest = start;
        rendered = candidate;
      }
    }
    if (rendered === null) continue;
    samples.push({ address, durationMs: Math.max(0, rendered.actualDuration as number) });
  }
  return samples;
}
