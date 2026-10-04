import { actionAddress, pageAddress, regionAddress } from "@sidioralabs/rex";
import {
  useActivePage,
  useOutcomeStore,
  useRegisterAffordances,
  useSidecarPayload,
  type Affordance,
} from "@sidioralabs/rex/client";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import homePage from "../page.ts";

const COPY_ID = "copy-addresses";
const COPY_LABEL = "Copy addresses";
const NO_INPUT = Object.freeze({ type: "object", properties: {}, additionalProperties: false });

type CopyResult =
  | { readonly ok: true; readonly addresses: readonly string[] }
  | { readonly ok: false; readonly message: string };

export function useLiveSidecar(): {
  readonly json: string;
  readonly copyAddress: string;
  readonly copy: () => Promise<CopyResult>;
} {
  const resolution = useActivePage();
  if (resolution === null || resolution.page.id !== homePage.id) {
    throw new Error("useLiveSidecar renders the sidecar of the active home page");
  }
  const payload = useSidecarPayload(resolution);
  const outcomes = useOutcomeStore();
  const latest = useRef(payload);
  const pageId = resolution.page.id;
  const regions = resolution.page.regions;

  useLayoutEffect(() => {
    latest.current = payload;
  }, [payload]);

  const copy = useCallback(async (): Promise<CopyResult> => {
    const current = latest.current;
    const addresses = [
      pageAddress(current.page),
      ...regions.map((name) => regionAddress(current.page, name)),
      ...current.actions.map((entry) => actionAddress(current.page, entry.id)),
    ];
    const record = (ok: boolean, message: string) =>
      outcomes.set(pageId, { actionId: COPY_ID, ok, message, at: new Date().toISOString() });
    const clipboard = globalThis.navigator?.clipboard;
    if (clipboard === undefined) {
      const message = `${COPY_LABEL} failed: this browser gives the page no clipboard`;
      record(false, message);
      return { ok: false, message };
    }
    try {
      await clipboard.writeText(addresses.join("\n"));
    } catch (error) {
      const message = `${COPY_LABEL} failed: ${error instanceof Error ? error.message : String(error)}`;
      record(false, message);
      return { ok: false, message };
    }
    record(true, `${COPY_LABEL} succeeded: ${addresses.length} addresses copied`);
    return { ok: true, addresses };
  }, [outcomes, pageId, regions]);

  const affordances = useMemo<readonly Affordance[]>(
    () => [
      {
        id: COPY_ID,
        label: COPY_LABEL,
        allowed: true,
        reason: null,
        effect: "read",
        input: NO_INPUT,
        via: ["click", "palette"],
        invoke: () => copy(),
      },
    ],
    [copy],
  );
  useRegisterAffordances(pageId, affordances);

  return {
    json: JSON.stringify(payload, null, 2),
    copyAddress: actionAddress(pageId, COPY_ID),
    copy,
  };
}
