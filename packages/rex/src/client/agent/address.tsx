import { createContext, useContext, useMemo, type ReactNode } from "react";
import { RexError } from "../../core/errors.ts";
import {
  actionAddress,
  actionId,
  overlayAddress,
  overlayName,
  pageAddress,
  regionAddress,
  regionName,
} from "../../core/ids.ts";
import { useActivePage } from "../router.tsx";

export const ADDRESS_ATTRIBUTES = Object.freeze({
  page: "data-rex-page",
  region: "data-rex-region",
  overlay: "data-rex-overlay",
  action: "data-rex",
} as const);

export type AddressKind = keyof typeof ADDRESS_ATTRIBUTES;

export const ADDRESS_KINDS: readonly AddressKind[] = Object.freeze([
  "page",
  "region",
  "overlay",
  "action",
]);

export function pageAttributes(page: string): { readonly "data-rex-page": string } {
  return { "data-rex-page": pageAddress(page) };
}

export function regionAttributes(
  page: string,
  region: string,
): { readonly "data-rex-region": string } {
  return { "data-rex-region": regionAddress(page, region) };
}

export function overlayAttributes(
  page: string,
  overlay: string,
): { readonly "data-rex-overlay": string } {
  return { "data-rex-overlay": overlayAddress(page, overlay) };
}

export function actionAttributes(page: string, action: string): { readonly "data-rex": string } {
  return { "data-rex": actionAddress(page, action) };
}

interface AddressScopeValue {
  readonly region: string | null;
  readonly overlay: string | null;
}

const ROOT_SCOPE: AddressScopeValue = Object.freeze({ region: null, overlay: null });

export const AddressScopeContext = createContext<AddressScopeValue>(ROOT_SCOPE);
AddressScopeContext.displayName = "RexAddressScope";

export interface AddressScopeProps {
  readonly region?: string;
  readonly overlay?: string;
  readonly children?: ReactNode;
}

export function AddressScope({ region, overlay, children }: AddressScopeProps) {
  const outer = useContext(AddressScopeContext);
  const active = useActivePage();
  if (active === null)
    throw new RexError("REX306", "rex: AddressScope must render inside an active page");
  const declared = active.page;
  if (region !== undefined) {
    regionName(region);
    if (!declared.regions.includes(region)) {
      throw new RexError(
        "REX307",
        `rex: region "${region}" is not declared by page "${declared.id}"`,
      );
    }
  }
  if (overlay !== undefined) {
    overlayName(overlay);
    if (!declared.overlays.some((entry) => entry.id === overlay)) {
      throw new RexError(
        "REX307",
        `rex: overlay "${overlay}" is not declared by page "${declared.id}"`,
      );
    }
  }
  const nextRegion = region ?? outer.region;
  const nextOverlay = overlay ?? outer.overlay;
  const value = useMemo<AddressScopeValue>(
    () => ({ region: nextRegion, overlay: nextOverlay }),
    [nextRegion, nextOverlay],
  );
  return <AddressScopeContext.Provider value={value}>{children}</AddressScopeContext.Provider>;
}

export interface RexAddress {
  readonly page: string | null;
  readonly region: string | null;
  readonly overlay: string | null;
  readonly pageAddress: string | null;
  readonly regionAddress: string | null;
  readonly overlayAddress: string | null;
  action(id: string): string | null;
}

export function useAddress(): RexAddress {
  const active = useActivePage();
  const scope = useContext(AddressScopeContext);
  const page = active === null ? null : active.page.id;
  return useMemo<RexAddress>(
    () => ({
      page,
      region: page === null ? null : scope.region,
      overlay: page === null ? null : scope.overlay,
      pageAddress: page === null ? null : pageAddress(page),
      regionAddress:
        page === null || scope.region === null ? null : regionAddress(page, scope.region),
      overlayAddress:
        page === null || scope.overlay === null ? null : overlayAddress(page, scope.overlay),
      action: (id: string) => (page === null ? null : actionAddress(page, actionId(id))),
    }),
    [page, scope],
  );
}

export interface FoundAddress {
  readonly kind: AddressKind;
  readonly address: string;
}

function compareFound(a: FoundAddress, b: FoundAddress): number {
  if (a.kind !== b.kind) return ADDRESS_KINDS.indexOf(a.kind) - ADDRESS_KINDS.indexOf(b.kind);
  return a.address < b.address ? -1 : a.address > b.address ? 1 : 0;
}

export function readAddresses(root: ParentNode): readonly FoundAddress[] {
  const found: FoundAddress[] = [];
  for (const kind of ADDRESS_KINDS) {
    const attribute = ADDRESS_ATTRIBUTES[kind];
    for (const element of root.querySelectorAll(`[${attribute}]`)) {
      const address = element.getAttribute(attribute);
      if (address !== null && address !== "") found.push({ kind, address });
    }
  }
  return found.sort(compareFound);
}

export function findAddressed(
  root: ParentNode,
  kind: AddressKind,
  address: string,
): readonly Element[] {
  const attribute = ADDRESS_ATTRIBUTES[kind];
  return [...root.querySelectorAll(`[${attribute}]`)].filter(
    (element) => element.getAttribute(attribute) === address,
  );
}
