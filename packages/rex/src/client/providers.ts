import { createElement, type ComponentType, type ReactNode } from "react";
import { ConfirmProvider } from "./agent/confirm.tsx";
import { I18nProvider } from "./i18n/provider.tsx";

export interface RexProviderProps {
  readonly children: ReactNode;
}

export interface RexProvider {
  readonly id: string;
  readonly Component: ComponentType<RexProviderProps>;
}

export const REX_PROVIDERS: readonly RexProvider[] = [
  { id: "i18n", Component: I18nProvider },
  { id: "confirm", Component: ConfirmProvider },
];

export function composeProviders(
  providers: readonly RexProvider[],
  children: ReactNode,
): ReactNode {
  return providers.reduceRight<ReactNode>(
    (inner, { id, Component }) => createElement(Component, { key: id, children: inner }),
    children,
  );
}

export function RexProviders({ children }: RexProviderProps) {
  return composeProviders(REX_PROVIDERS, children);
}
