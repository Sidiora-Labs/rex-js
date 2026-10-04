import type { ComponentType } from "react";
import type { StateProps } from "../core/states.ts";
import type { PageParamsValue } from "./page.tsx";

export interface RegionErrorFallbackProps {
  readonly address: string;
  readonly code: string;
  readonly error: Error;
  readonly retry: () => void;
  readonly params: PageParamsValue;
  readonly Export: ComponentType<StateProps<PageParamsValue>> | undefined;
  readonly Default: ComponentType<
    { readonly state: "recoverable-error" } & StateProps<PageParamsValue>
  >;
}

export function RegionErrorFallback({
  address,
  code,
  error,
  retry,
  params,
  Export,
  Default,
}: RegionErrorFallbackProps) {
  return (
    <div data-rex-region-error={address} data-rex-error-code={code}>
      {Export === undefined ? (
        <Default state="recoverable-error" params={params} retry={retry} error={error} />
      ) : (
        <Export params={params} retry={retry} error={error} />
      )}
    </div>
  );
}

export function NotFoundSection({ path }: { readonly path: string }) {
  return (
    <section role="alert" data-rex-app-state="not-found">
      <h1>Page not found</h1>
      <p>No page matches {path}.</p>
    </section>
  );
}

export function NotFoundBody({ path }: { readonly path: string }) {
  return (
    <main data-rex-app-state="not-found">
      <p role="alert">No page matches {path}.</p>
    </main>
  );
}
